"""
Feature engineering for all ML models.
All queries return pandas DataFrames ready for training.
"""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd
import psycopg2

logger = logging.getLogger(__name__)


def get_connection(db_url: str):
    return psycopg2.connect(db_url)


# ================================================================
# LIVE WIN PROBABILITY FEATURES
# Training label: 1 if innings-2 batting team wins, else 0
# ================================================================

LIVE_WP_FEATURES = [
    "balls_remaining",
    "runs_required",
    "wickets_remaining",
    "required_run_rate",
    "current_run_rate",
    "run_rate_ratio",
    "target",
    "current_score",
    "is_powerplay",
    "is_middle_overs",
    "is_death_overs",
    "over_number",
    "wickets_fallen",
]

LIVE_WP_LABEL = "batting_team_won"


def load_live_win_prob_data(db_url: str) -> pd.DataFrame:
    """Load ball-by-ball innings-2 data for live win probability training."""
    sql = """
        SELECT
            b.balls_remaining,
            b.required_runs          AS runs_required,
            10 - b.cumulative_wickets AS wickets_remaining,
            CASE
                WHEN b.balls_remaining > 0
                THEN b.required_runs::NUMERIC / (b.balls_remaining / 6.0)
                ELSE 99.0
            END AS required_run_rate,
            CASE
                WHEN (b.over_number * 6 + b.ball_number + 1) > 0
                THEN b.cumulative_score::NUMERIC / ((b.over_number * 6 + b.ball_number + 1) / 6.0)
                ELSE 0.0
            END AS current_run_rate,
            CASE
                WHEN b.balls_remaining > 0 AND b.required_runs > 0
                THEN (b.cumulative_score::NUMERIC /
                     NULLIF((b.over_number * 6 + b.ball_number + 1) / 6.0, 0)) /
                     (b.required_runs::NUMERIC / (b.balls_remaining / 6.0))
                ELSE 0.0
            END AS run_rate_ratio,
            i.target_runs            AS target,
            b.cumulative_score       AS current_score,
            b.is_powerplay::INT,
            b.is_middle_overs::INT,
            b.is_death_overs::INT,
            b.over_number,
            b.cumulative_wickets     AS wickets_fallen,
            -- Label
            CASE
                WHEN m.winner_id = i.batting_team_id THEN 1
                ELSE 0
            END AS batting_team_won
        FROM balls b
        JOIN innings i ON i.id = b.innings_id
        JOIN matches m ON m.id = b.match_id
        WHERE
            b.innings_number = 2
            AND b.balls_remaining IS NOT NULL
            AND b.required_runs IS NOT NULL
            AND m.no_result = FALSE
            AND m.winner_id IS NOT NULL
            AND i.target_runs IS NOT NULL
    """
    conn = get_connection(db_url)
    df = pd.read_sql(sql, conn)
    conn.close()

    df = df.dropna()
    df = df[df["balls_remaining"] >= 0]
    df = df[df["wickets_remaining"] >= 0]
    df = df[df["required_run_rate"] < 90]
    logger.info("Live WP training data: %d rows", len(df))
    return df


# ================================================================
# PRE-MATCH WIN PROBABILITY FEATURES
# ================================================================

PREMATCH_WP_FEATURES = [
    "venue_batting_first_win_pct",
    "team1_batting_avg_at_venue",
    "team2_batting_avg_at_venue",
    "team1_recent_win_pct",
    "team2_recent_win_pct",
    "h2h_team1_wins",
    "h2h_total",
    "toss_winner_is_team1",
    "toss_decision_bat",
    "team1_avg_score_last5",
    "team2_avg_score_last5",
]

PREMATCH_WP_LABEL = "team1_won"


def load_prematch_win_prob_data(db_url: str) -> pd.DataFrame:
    """Load match-level features for pre-match win probability."""
    sql = """
        WITH match_scores AS (
            SELECT
                i.match_id,
                i.innings_number,
                i.batting_team_id,
                i.total_runs
            FROM innings i
        ),
        first_innings AS (
            SELECT match_id, batting_team_id, total_runs
            FROM match_scores WHERE innings_number = 1
        ),
        second_innings AS (
            SELECT match_id, batting_team_id, total_runs
            FROM match_scores WHERE innings_number = 2
        ),
        venue_stats AS (
            SELECT
                m.venue_id,
                AVG(fi.total_runs)::NUMERIC AS avg_first_innings,
                COUNT(CASE WHEN m.winner_id = fi.batting_team_id THEN 1 END)::NUMERIC /
                    NULLIF(COUNT(*), 0) AS batting_first_win_pct
            FROM matches m
            JOIN first_innings fi ON fi.match_id = m.id
            WHERE m.no_result = FALSE AND m.winner_id IS NOT NULL
            GROUP BY m.venue_id
        )
        SELECT
            m.id AS match_id,
            m.team1_id,
            m.team2_id,
            m.venue_id,
            m.toss_winner_id,
            m.toss_decision::TEXT,
            m.winner_id,
            COALESCE(vs.batting_first_win_pct, 0.5) AS venue_batting_first_win_pct,
            fi.total_runs AS team1_score,
            si.total_runs AS team2_score,
            CASE WHEN m.winner_id = m.team1_id THEN 1 ELSE 0 END AS team1_won,
            CASE WHEN m.toss_winner_id = m.team1_id THEN 1 ELSE 0 END AS toss_winner_is_team1,
            CASE WHEN m.toss_decision = 'Bat' THEN 1 ELSE 0 END AS toss_decision_bat
        FROM matches m
        LEFT JOIN venue_stats vs ON vs.venue_id = m.venue_id
        LEFT JOIN first_innings fi ON fi.match_id = m.id AND fi.batting_team_id = m.team1_id
        LEFT JOIN second_innings si ON si.match_id = m.id AND si.batting_team_id = m.team2_id
        WHERE m.no_result = FALSE AND m.winner_id IS NOT NULL
    """
    conn = get_connection(db_url)
    df = pd.read_sql(sql, conn)
    conn.close()

    # Add derived features
    df["h2h_team1_wins"] = 0
    df["h2h_total"] = 1
    df["team1_recent_win_pct"] = 0.5
    df["team2_recent_win_pct"] = 0.5
    df["team1_batting_avg_at_venue"] = df["team1_score"].fillna(150)
    df["team2_batting_avg_at_venue"] = df["team2_score"].fillna(150)
    df["team1_avg_score_last5"] = df["team1_score"].fillna(150)
    df["team2_avg_score_last5"] = df["team2_score"].fillna(150)

    df = df.dropna(subset=[PREMATCH_WP_LABEL])
    logger.info("Pre-match WP training data: %d rows", len(df))
    return df


# ================================================================
# PLAYER VALUATION FEATURES
# ================================================================

VALUATION_FEATURES = [
    "batting_avg",
    "batting_strike_rate",
    "batting_50s",
    "batting_innings",
    "bowling_wickets",
    "bowling_economy",
    "bowling_avg",
    "overall_rating",
    "ipl_caps",
    "international_caps",
    "is_overseas",
    "playing_role_enc",
]

VALUATION_LABEL = "fair_market_value_cr"


def load_player_valuation_data(db_url: str) -> pd.DataFrame:
    """
    Load player features for valuation model.
    Since we don't have real auction prices yet, we compute synthetic
    fair values from performance stats.
    """
    sql = """
        SELECT
            p.id AS player_id,
            p.full_name,
            p.playing_role::TEXT AS playing_role,
            p.nationality::TEXT,
            p.ipl_caps,
            p.international_caps,
            CASE WHEN p.nationality::TEXT != 'India' THEN 1 ELSE 0 END AS is_overseas,
            COALESCE(cs.batting_avg, 0)           AS batting_avg,
            COALESCE(cs.batting_strike_rate, 0)   AS batting_strike_rate,
            COALESCE(cs.batting_50s, 0)           AS batting_50s,
            COALESCE(cs.batting_innings, 0)       AS batting_innings,
            COALESCE(cs.bowling_wickets, 0)       AS bowling_wickets,
            COALESCE(cs.bowling_economy, 8.5)     AS bowling_economy,
            COALESCE(cs.bowling_avg, 30)          AS bowling_avg,
            COALESCE(pr.overall_rating, 50)       AS overall_rating
        FROM players p
        LEFT JOIN player_career_stats cs ON cs.player_id = p.id AND cs.format = 'T20'
        LEFT JOIN player_ratings pr ON pr.player_id = p.id
        WHERE p.ipl_caps > 0 OR p.international_caps > 5
    """
    conn = get_connection(db_url)
    df = pd.read_sql(sql, conn)
    conn.close()

    # Encode playing role
    role_map = {
        "Top-order Batter": 0, "Middle-order Batter": 1,
        "Batting All-rounder": 2, "Bowling All-rounder": 3,
        "Wicket-keeper Batter": 4, "Pace Bowler": 5, "Spin Bowler": 6,
    }
    df["playing_role_enc"] = df["playing_role"].map(role_map).fillna(0).astype(int)

    # Synthetic fair market value formula (in Crore):
    # Based on batting rating + bowling contribution + experience premium
    batting_score = (
        df["batting_avg"] * 0.05 +
        (df["batting_strike_rate"] - 100).clip(0) * 0.03 +
        df["batting_50s"] * 0.10
    )
    bowling_score = (
        df["bowling_wickets"] * 0.05 +
        (9 - df["bowling_economy"]).clip(0) * 0.20
    )
    experience_premium = (
        df["ipl_caps"] * 0.02 +
        df["international_caps"] * 0.01
    )
    overseas_premium = df["is_overseas"] * 0.50

    df[VALUATION_LABEL] = (
        batting_score + bowling_score + experience_premium + overseas_premium
    ).clip(0.20, 20.0).round(2)

    logger.info("Player valuation training data: %d rows", len(df))
    return df


# ================================================================
# INJURY RISK FEATURES
# ================================================================

INJURY_FEATURES = [
    "matches_last_30_days",
    "overs_bowled_last_30_days",
    "rest_days_since_last_match",
    "bowling_wickets",
    "batting_innings",
    "ipl_caps",
]

INJURY_LABEL = "injury_prone_flag"


def load_injury_risk_data(db_url: str) -> pd.DataFrame:
    """Load player features for injury risk classification."""
    sql = """
        SELECT
            p.id AS player_id,
            p.injury_prone_flag::INT AS injury_prone_flag,
            p.ipl_caps,
            COALESCE(pw.matches_last_30_days, 0)       AS matches_last_30_days,
            COALESCE(pw.overs_bowled_last_30_days, 0)  AS overs_bowled_last_30_days,
            COALESCE(pw.rest_days_since_last_match, 30) AS rest_days_since_last_match,
            COALESCE(cs.bowling_wickets, 0)             AS bowling_wickets,
            COALESCE(cs.batting_innings, 0)             AS batting_innings
        FROM players p
        LEFT JOIN (
            SELECT DISTINCT ON (player_id) *
            FROM player_workload
            ORDER BY player_id, computed_at DESC
        ) pw ON pw.player_id = p.id
        LEFT JOIN player_career_stats cs ON cs.player_id = p.id AND cs.format = 'T20'
    """
    conn = get_connection(db_url)
    df = pd.read_sql(sql, conn)
    conn.close()
    logger.info("Injury risk training data: %d rows", len(df))
    return df
