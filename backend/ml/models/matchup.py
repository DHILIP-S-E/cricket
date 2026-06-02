"""
Batter-Bowler Matchup Engine — Bayesian Lookup Table
Pre-computed from balls data. No training needed — this is a lookup.
Bayesian smoothing prevents overconfidence on small samples.
"""
from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd
import psycopg2

logger = logging.getLogger(__name__)

# League-wide priors (empirical T20 averages for smoothing)
PRIOR_STRIKE_RATE = 130.0
PRIOR_WICKET_PROB = 0.055
PRIOR_BOUNDARY_PROB = 0.25
PRIOR_DOT_PROB = 0.35
PRIOR_WEIGHT = 12  # equivalent to N balls of prior data


def get_matchup(
    batter_id: str,
    bowler_id: str,
    phase: str,
    db_url: str,
) -> dict:
    """
    Fetch smoothed matchup stats for a batter-bowler pair from DB.
    Falls back to league averages if pair has no data.

    phase: 'Powerplay' | 'Middle' | 'Death' | 'All'
    """
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            balls_faced, runs_scored, dismissals,
            smoothed_strike_rate, smoothed_wicket_prob, smoothed_boundary_prob,
            dot_ball_rate, confidence_level::TEXT
        FROM player_matchups
        WHERE batter_id = %s AND bowler_id = %s AND phase = %s::phase_type_enum
        """,
        (batter_id, bowler_id, phase),
    )
    row = cur.fetchone()
    conn.close()

    if row:
        balls, runs, dismissals, sr, wkt_prob, bdry_prob, dot_rate, conf = row
        return {
            "balls_faced": balls,
            "runs_scored": runs,
            "dismissals": dismissals,
            "strike_rate": float(sr or PRIOR_STRIKE_RATE),
            "wicket_probability": float(wkt_prob or PRIOR_WICKET_PROB),
            "boundary_probability": float(bdry_prob or PRIOR_BOUNDARY_PROB),
            "dot_ball_rate": float(dot_rate or PRIOR_DOT_PROB),
            "confidence": conf,
            "source": "historical",
        }

    # No data — return pure league averages
    return {
        "balls_faced": 0,
        "runs_scored": 0,
        "dismissals": 0,
        "strike_rate": PRIOR_STRIKE_RATE,
        "wicket_probability": PRIOR_WICKET_PROB,
        "boundary_probability": PRIOR_BOUNDARY_PROB,
        "dot_ball_rate": PRIOR_DOT_PROB,
        "confidence": "Low",
        "source": "prior",
    }


def get_matchup_matrix(
    batter_ids: list[str],
    bowler_ids: list[str],
    phase: str,
    db_url: str,
) -> pd.DataFrame:
    """
    Return a matrix of smoothed strike rates: rows=batters, cols=bowlers.
    Used for the pre-match matchup heatmap.
    """
    if not batter_ids or not bowler_ids:
        return pd.DataFrame()

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            batter_id::TEXT, bowler_id::TEXT,
            smoothed_strike_rate,
            smoothed_wicket_prob,
            confidence_level::TEXT
        FROM player_matchups
        WHERE
            batter_id = ANY(%s::uuid[])
            AND bowler_id = ANY(%s::uuid[])
            AND phase = %s::phase_type_enum
        """,
        (batter_ids, bowler_ids, phase),
    )
    rows = cur.fetchall()
    conn.close()

    data = {
        "batter_id": [r[0] for r in rows],
        "bowler_id": [r[1] for r in rows],
        "strike_rate": [float(r[2]) if r[2] else PRIOR_STRIKE_RATE for r in rows],
        "wicket_prob": [float(r[3]) if r[3] else PRIOR_WICKET_PROB for r in rows],
        "confidence": [r[4] for r in rows],
    }
    return pd.DataFrame(data)


def score_bowler_for_batter(
    batter_id: str,
    bowler_id: str,
    phase: str,
    db_url: str,
) -> float:
    """
    Single composite score: how dangerous is this bowler against this batter?
    Higher = bowler has advantage.
    Range: 0 (batter dominating) to 1 (bowler dominating).
    """
    m = get_matchup(batter_id, bowler_id, phase, db_url)
    sr_norm = 1 - min(1.0, m["strike_rate"] / 200.0)
    wkt_norm = min(1.0, m["wicket_probability"] / 0.15)
    dot_norm = min(1.0, m["dot_ball_rate"] / 0.60)
    score = 0.4 * wkt_norm + 0.35 * sr_norm + 0.25 * dot_norm
    return round(score, 4)
