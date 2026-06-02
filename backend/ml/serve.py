"""
ML Inference Layer — single import point for all prediction calls.

FastAPI services import from here. All model artifacts are loaded once
at module import and cached. Re-load is triggered by calling reload().
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

ARTIFACT_DIR = Path(os.environ.get("ML_ARTIFACT_DIR", "ml_artifacts"))
DB_URL = os.environ.get("DATABASE_URL", "")


# ------------------------------------------------------------------ #
# Live Win Probability
# ------------------------------------------------------------------ #

def predict_live_win_prob(state: dict) -> float:
    """
    state = {
        balls_remaining, runs_required, wickets_remaining,
        required_run_rate, current_run_rate, run_rate_ratio,
        target, current_score, is_powerplay, is_middle_overs,
        is_death_overs, over_number, wickets_fallen
    }
    Returns float 0–1.
    """
    from .models.win_prob_live import predict
    return predict(state, ARTIFACT_DIR)


# ------------------------------------------------------------------ #
# Pre-Match Win Probability
# ------------------------------------------------------------------ #

def predict_prematch_win_prob(match_context: dict) -> dict:
    """
    Returns {"team1_win_prob": float, "team2_win_prob": float, "confidence": str}
    """
    from .models.win_prob_prematch import predict
    return predict(match_context, ARTIFACT_DIR)


# ------------------------------------------------------------------ #
# Player Valuation
# ------------------------------------------------------------------ #

def predict_player_valuation(player_features: dict) -> dict:
    """
    Returns {"fair_value_cr": float, "confidence_low_cr": float, "confidence_high_cr": float}
    """
    from .models.valuation import predict_player
    return predict_player(player_features, ARTIFACT_DIR)


# ------------------------------------------------------------------ #
# Batter-Bowler Matchup
# ------------------------------------------------------------------ #

def get_matchup(batter_id: str, bowler_id: str, phase: str = "All") -> dict:
    """Returns matchup stats dict with smoothed probabilities."""
    from .models.matchup import get_matchup as _get
    return _get(batter_id, bowler_id, phase, DB_URL)


def get_matchup_matrix(
    batter_ids: list[str],
    bowler_ids: list[str],
    phase: str = "All",
):
    """Returns a DataFrame with strike_rate/wicket_prob for all batter×bowler pairs."""
    from .models.matchup import get_matchup_matrix as _get
    return _get(batter_ids, bowler_ids, phase, DB_URL)


# ------------------------------------------------------------------ #
# Playing XI Optimizer
# ------------------------------------------------------------------ #

def optimize_playing_xi(
    squad: list[dict],
    match_context: dict,
    overseas_slots: int = 4,
) -> dict:
    """
    squad: list of player dicts with player_id, playing_role, is_overseas,
           overall_rating, form_score, etc.
    Returns {"playing_xi": [...], "total_score": float, ...}
    """
    from .models.playing_xi import optimize_xi
    return optimize_xi(squad, match_context, overseas_slots, ARTIFACT_DIR)


# ------------------------------------------------------------------ #
# Injury Risk
# ------------------------------------------------------------------ #

def predict_injury_risk(players: list[dict]) -> list[dict]:
    """
    Returns each player dict augmented with risk_level and risk_score.
    """
    from .models.injury_risk import predict_batch
    return predict_batch(players, ARTIFACT_DIR)
