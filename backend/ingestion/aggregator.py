"""
Post-ingestion aggregation.
Runs after all raw ball data is loaded.

Computes:
 1. player_career_stats  — from batting/bowling_performances
 2. player_matchups      — from balls table (batter × bowler × phase)
 3. player_form          — rolling last-5-match averages
 4. player_ratings       — composite 0–100 rating
"""
from __future__ import annotations

import logging

import psycopg2

logger = logging.getLogger(__name__)


def run_all(db_url: str) -> None:
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            logger.info("Aggregating career stats...")
            _aggregate_career_stats(cur)
            conn.commit()

            logger.info("Aggregating matchups...")
            _aggregate_matchups(cur)
            conn.commit()

            logger.info("Aggregating player form (last 5 matches)...")
            _aggregate_player_form(cur)
            conn.commit()

            logger.info("Computing player ratings...")
            _compute_player_ratings(cur)
            conn.commit()

        logger.info("Aggregation complete.")
    except Exception as e:
        conn.rollback()
        logger.error("Aggregation failed: %s", e)
        raise
    finally:
        conn.close()


def _aggregate_career_stats(cur) -> None:
    """Upsert player_career_stats from batting/bowling performances."""
    cur.execute("TRUNCATE player_career_stats")

    # Batting
    cur.execute("""
        INSERT INTO player_career_stats (
            id, player_id, format,
            batting_innings, batting_not_outs, batting_runs,
            batting_avg, batting_strike_rate,
            batting_50s, batting_100s, batting_highest_score,
            catches, last_computed_at
        )
        SELECT
            gen_random_uuid(),
            bp.player_id,
            'T20',
            COUNT(*),
            SUM(CASE WHEN bp.is_not_out THEN 1 ELSE 0 END),
            SUM(bp.runs_scored),
            CASE
                WHEN COUNT(*) - SUM(CASE WHEN bp.is_not_out THEN 1 ELSE 0 END) > 0
                THEN ROUND(
                    SUM(bp.runs_scored)::NUMERIC /
                    (COUNT(*) - SUM(CASE WHEN bp.is_not_out THEN 1 ELSE 0 END)),
                    2
                )
                ELSE SUM(bp.runs_scored)
            END,
            CASE
                WHEN SUM(bp.balls_faced) > 0
                THEN ROUND(SUM(bp.runs_scored)::NUMERIC / SUM(bp.balls_faced) * 100, 2)
                ELSE 0
            END,
            SUM(CASE WHEN bp.runs_scored >= 50 AND bp.runs_scored < 100 THEN 1 ELSE 0 END),
            SUM(CASE WHEN bp.runs_scored >= 100 THEN 1 ELSE 0 END),
            MAX(bp.runs_scored),
            0,
            now()
        FROM batting_performances bp
        GROUP BY bp.player_id
        ON CONFLICT (player_id, format) DO UPDATE SET
            batting_innings = EXCLUDED.batting_innings,
            batting_not_outs = EXCLUDED.batting_not_outs,
            batting_runs = EXCLUDED.batting_runs,
            batting_avg = EXCLUDED.batting_avg,
            batting_strike_rate = EXCLUDED.batting_strike_rate,
            batting_50s = EXCLUDED.batting_50s,
            batting_100s = EXCLUDED.batting_100s,
            batting_highest_score = EXCLUDED.batting_highest_score,
            last_computed_at = now()
    """)

    # Update bowling stats into existing rows
    cur.execute("""
        INSERT INTO player_career_stats (
            id, player_id, format,
            bowling_innings, bowling_wickets, bowling_avg,
            bowling_economy, bowling_strike_rate,
            last_computed_at
        )
        SELECT
            gen_random_uuid(),
            bwp.player_id,
            'T20',
            COUNT(*),
            SUM(bwp.wickets),
            CASE
                WHEN SUM(bwp.wickets) > 0
                THEN ROUND(SUM(bwp.runs_conceded)::NUMERIC / SUM(bwp.wickets), 2)
                ELSE NULL
            END,
            CASE
                WHEN SUM(bwp.overs_bowled) > 0
                THEN ROUND(SUM(bwp.runs_conceded)::NUMERIC / SUM(bwp.overs_bowled), 2)
                ELSE NULL
            END,
            CASE
                WHEN SUM(bwp.wickets) > 0
                THEN ROUND(
                    (SUM(bwp.overs_bowled) * 6)::NUMERIC / SUM(bwp.wickets), 2
                )
                ELSE NULL
            END,
            now()
        FROM bowling_performances bwp
        GROUP BY bwp.player_id
        ON CONFLICT (player_id, format) DO UPDATE SET
            bowling_innings = EXCLUDED.bowling_innings,
            bowling_wickets = EXCLUDED.bowling_wickets,
            bowling_avg = EXCLUDED.bowling_avg,
            bowling_economy = EXCLUDED.bowling_economy,
            bowling_strike_rate = EXCLUDED.bowling_strike_rate,
            last_computed_at = now()
    """)


def _aggregate_matchups(cur) -> None:
    """Compute player_matchups from balls table for all 4 phases."""
    cur.execute("TRUNCATE player_matchups")

    phases = [
        ("All",       "TRUE"),
        ("Powerplay", "b.is_powerplay"),
        ("Middle",    "b.is_middle_overs"),
        ("Death",     "b.is_death_overs"),
    ]

    for phase_name, phase_filter in phases:
        cur.execute(f"""
            INSERT INTO player_matchups (
                id, batter_id, bowler_id, phase,
                balls_faced, runs_scored, dismissals,
                boundaries_4, boundaries_6, dot_balls,
                strike_rate, dismissal_rate, boundary_rate, dot_ball_rate,
                confidence_level,
                smoothed_strike_rate, smoothed_wicket_prob, smoothed_boundary_prob,
                last_updated
            )
            SELECT
                gen_random_uuid(),
                b.batter_id,
                b.bowler_id,
                %s::phase_type_enum,
                COUNT(*) AS balls_faced,
                SUM(b.runs_off_bat) AS runs_scored,
                SUM(CASE WHEN b.is_wicket THEN 1 ELSE 0 END) AS dismissals,
                SUM(CASE WHEN b.runs_off_bat = 4 THEN 1 ELSE 0 END) AS boundaries_4,
                SUM(CASE WHEN b.runs_off_bat = 6 THEN 1 ELSE 0 END) AS boundaries_6,
                SUM(CASE WHEN b.runs_off_bat = 0 AND b.extras_runs = 0 THEN 1 ELSE 0 END) AS dot_balls,
                -- Raw rates
                ROUND(SUM(b.runs_off_bat)::NUMERIC / COUNT(*) * 100, 2),
                ROUND(SUM(CASE WHEN b.is_wicket THEN 1 ELSE 0 END)::NUMERIC / COUNT(*), 4),
                ROUND(
                    SUM(CASE WHEN b.runs_off_bat >= 4 THEN 1 ELSE 0 END)::NUMERIC / COUNT(*),
                    4
                ),
                ROUND(
                    SUM(CASE WHEN b.runs_off_bat = 0 AND b.extras_runs = 0 THEN 1 ELSE 0 END)::NUMERIC / COUNT(*),
                    4
                ),
                -- Confidence
                CASE
                    WHEN COUNT(*) < 12  THEN 'Low'::confidence_level_enum
                    WHEN COUNT(*) < 50  THEN 'Medium'::confidence_level_enum
                    ELSE                     'High'::confidence_level_enum
                END,
                -- Bayesian smoothed (shrink toward league average: SR=130, wicket=5pct, boundary=25pct)
                ROUND(
                    (SUM(b.runs_off_bat) + 130.0 * 6) / (COUNT(*) + 6) * 100,
                    2
                ),
                ROUND(
                    (SUM(CASE WHEN b.is_wicket THEN 1 ELSE 0 END) + 0.055 * 18) / (COUNT(*) + 18),
                    4
                ),
                ROUND(
                    (SUM(CASE WHEN b.runs_off_bat >= 4 THEN 1 ELSE 0 END) + 0.25 * 6) / (COUNT(*) + 6),
                    4
                ),
                now()
            FROM balls b
            WHERE {phase_filter}
            GROUP BY b.batter_id, b.bowler_id
            HAVING COUNT(*) >= 6
            ON CONFLICT (batter_id, bowler_id, phase) DO UPDATE SET
                balls_faced = EXCLUDED.balls_faced,
                runs_scored = EXCLUDED.runs_scored,
                dismissals = EXCLUDED.dismissals,
                boundaries_4 = EXCLUDED.boundaries_4,
                boundaries_6 = EXCLUDED.boundaries_6,
                dot_balls = EXCLUDED.dot_balls,
                strike_rate = EXCLUDED.strike_rate,
                dismissal_rate = EXCLUDED.dismissal_rate,
                boundary_rate = EXCLUDED.boundary_rate,
                dot_ball_rate = EXCLUDED.dot_ball_rate,
                confidence_level = EXCLUDED.confidence_level,
                smoothed_strike_rate = EXCLUDED.smoothed_strike_rate,
                smoothed_wicket_prob = EXCLUDED.smoothed_wicket_prob,
                smoothed_boundary_prob = EXCLUDED.smoothed_boundary_prob,
                last_updated = now()
        """, (phase_name,))
        logger.info("Matchups computed for phase: %s", phase_name)


def _aggregate_player_form(cur) -> None:
    """Compute rolling last-5-match form for all players."""
    cur.execute("TRUNCATE player_form")

    cur.execute("""
        INSERT INTO player_form (id, player_id, last_n_matches, form_score,
                                  batting_avg_recent, strike_rate_recent,
                                  bowling_avg_recent, economy_recent, computed_at)
        WITH ranked AS (
            SELECT
                bp.player_id,
                bp.runs_scored,
                bp.balls_faced,
                m.match_date,
                ROW_NUMBER() OVER (PARTITION BY bp.player_id ORDER BY m.match_date DESC) AS rn
            FROM batting_performances bp
            JOIN matches m ON m.id = bp.match_id
        ),
        last5_bat AS (
            SELECT
                player_id,
                COUNT(*) AS innings,
                AVG(runs_scored) AS avg_runs,
                CASE WHEN SUM(balls_faced) > 0 THEN
                    SUM(runs_scored)::NUMERIC / SUM(balls_faced) * 100
                ELSE 0 END AS sr
            FROM ranked
            WHERE rn <= 5
            GROUP BY player_id
        ),
        last5_bowl AS (
            SELECT
                bwp.player_id,
                CASE WHEN SUM(bwp.wickets) > 0
                    THEN SUM(bwp.runs_conceded)::NUMERIC / SUM(bwp.wickets)
                    ELSE NULL END AS avg_wkts,
                CASE WHEN SUM(bwp.overs_bowled) > 0
                    THEN SUM(bwp.runs_conceded)::NUMERIC / SUM(bwp.overs_bowled)
                    ELSE NULL END AS econ
            FROM (
                SELECT bwp.player_id, bwp.runs_conceded, bwp.wickets, bwp.overs_bowled,
                       ROW_NUMBER() OVER (PARTITION BY bwp.player_id ORDER BY m2.match_date DESC) AS rn2
                FROM bowling_performances bwp
                JOIN matches m2 ON m2.id = bwp.match_id
            ) bwp
            WHERE rn2 <= 5
            GROUP BY player_id
        )
        SELECT
            gen_random_uuid(),
            b.player_id,
            5,
            -- form_score: normalize batting avg to 0-1 (100 avg = 1.0)
            LEAST(1.0, GREATEST(0.0, COALESCE(b.avg_runs, 0) / 60.0)),
            ROUND(b.avg_runs::NUMERIC, 2),
            ROUND(b.sr::NUMERIC, 2),
            ROUND(bw.avg_wkts::NUMERIC, 2),
            ROUND(bw.econ::NUMERIC, 2),
            now()
        FROM last5_bat b
        LEFT JOIN last5_bowl bw ON bw.player_id = b.player_id
    """)


def _compute_player_ratings(cur) -> None:
    """Compute composite 0-100 player ratings from career stats."""
    cur.execute("TRUNCATE player_ratings")

    cur.execute("""
        INSERT INTO player_ratings (id, player_id, overall_rating, batting_rating, bowling_rating,
                                     powerplay_rating, death_overs_rating, computed_at)
        SELECT
            gen_random_uuid(),
            cs.player_id,
            -- Overall: weighted batting (60%) + bowling (40%)
            LEAST(100, GREATEST(0, ROUND(
                0.6 * LEAST(100,
                    COALESCE(cs.batting_avg, 0) * 0.8 +
                    COALESCE(cs.batting_strike_rate, 0) * 0.15 +
                    COALESCE(cs.batting_50s, 0) * 0.5
                ) +
                0.4 * LEAST(100, CASE
                    WHEN cs.bowling_economy IS NOT NULL
                    THEN GREATEST(0, 100 - cs.bowling_economy * 8)
                    ELSE 0
                END),
                2
            ))),
            -- Batting rating (0-100)
            LEAST(100, GREATEST(0, ROUND(
                COALESCE(cs.batting_avg, 0) * 0.8 +
                COALESCE(cs.batting_strike_rate, 0) * 0.15,
                2
            ))),
            -- Bowling rating (0-100)
            LEAST(100, GREATEST(0, ROUND(
                CASE WHEN cs.bowling_economy IS NOT NULL
                    THEN 100 - cs.bowling_economy * 8
                    ELSE 0
                END,
                2
            ))),
            50, 50,  -- placeholder for phase-specific ratings
            now()
        FROM player_career_stats cs
        WHERE cs.format = 'T20'
        ON CONFLICT (player_id) DO UPDATE SET
            overall_rating = EXCLUDED.overall_rating,
            batting_rating = EXCLUDED.batting_rating,
            bowling_rating = EXCLUDED.bowling_rating,
            computed_at = now()
    """)
