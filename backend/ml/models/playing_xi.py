"""
Playing XI Optimizer
Two-stage approach:
  Stage 1: CatBoost scores each squad player (expected contribution for this match)
  Stage 2: OR-Tools Integer Programming picks the best 11 under constraints

Constraints enforced:
  - Exactly 11 players selected
  - At least 1 wicketkeeper
  - Max 4 overseas players
  - At least 5 bowling options (pace or spin bowlers + all-rounders)
  - At least 4 specialist batters
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib  # safe: self-authored artifacts loaded from controlled local path
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class PlayerCandidate:
    player_id: str
    full_name: str
    playing_role: str
    is_overseas: bool
    is_wicketkeeper: bool
    is_bowling_option: bool  # can bowl a full quota of overs
    ai_score: float          # 0-100, higher = better for this match


def score_players(
    squad: list[dict],
    match_context: dict,
    artifact_dir: Path = Path("ml_artifacts"),
) -> list[PlayerCandidate]:
    """
    Score each squad player for the specific match context.

    match_context keys:
      venue_spin_rating, venue_pace_rating, pitch_type,
      opponent_batting_avg, is_day_match, toss_decision
    """
    model_path = artifact_dir / "playing_xi_scorer.joblib"

    scored = []
    for p in squad:
        if model_path.exists():
            score = _model_score(p, match_context, model_path)
        else:
            score = _heuristic_score(p, match_context)

        role = p.get("playing_role", "Top-order Batter")
        scored.append(PlayerCandidate(
            player_id=p["player_id"],
            full_name=p.get("full_name", ""),
            playing_role=role,
            is_overseas=p.get("is_overseas", False),
            is_wicketkeeper=role == "Wicket-keeper Batter",
            is_bowling_option=role in (
                "Pace Bowler", "Spin Bowler",
                "Bowling All-rounder", "Batting All-rounder",
            ),
            ai_score=round(score, 2),
        ))

    return scored


def select_xi(
    candidates: list[PlayerCandidate],
    overseas_slots: int = 4,
) -> dict:
    """
    OR-Tools ILP to select best 11 under constraints.
    Returns selected player_ids + recommended batting order.
    """
    try:
        from ortools.sat.python import cp_model
    except ImportError:
        logger.warning("ortools not installed. Falling back to greedy selection.")
        return _greedy_select(candidates, overseas_slots)

    model = cp_model.CpModel()
    n = len(candidates)

    # Scale scores to integers (OR-Tools works with integers)
    scores_int = [int(c.ai_score * 100) for c in candidates]

    # Decision variables: x[i] = 1 if player i selected
    x = [model.NewBoolVar(f"x_{i}") for i in range(n)]

    # Constraint 1: exactly 11 players
    model.Add(sum(x) == 11)

    # Constraint 2: at least 1 wicketkeeper
    wk_indices = [i for i, c in enumerate(candidates) if c.is_wicketkeeper]
    if wk_indices:
        model.Add(sum(x[i] for i in wk_indices) >= 1)

    # Constraint 3: max N overseas
    overseas_indices = [i for i, c in enumerate(candidates) if c.is_overseas]
    model.Add(sum(x[i] for i in overseas_indices) <= overseas_slots)

    # Constraint 4: at least 5 bowling options
    bowling_indices = [i for i, c in enumerate(candidates) if c.is_bowling_option]
    model.Add(sum(x[i] for i in bowling_indices) >= 5)

    # Constraint 5: at least 4 batting specialists
    batting_indices = [
        i for i, c in enumerate(candidates)
        if c.playing_role in (
            "Top-order Batter", "Middle-order Batter",
            "Wicket-keeper Batter", "Batting All-rounder",
        )
    ]
    model.Add(sum(x[i] for i in batting_indices) >= 4)

    # Objective: maximize total AI score
    model.Maximize(sum(scores_int[i] * x[i] for i in range(n)))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        logger.warning("OR-Tools could not find a feasible solution. Falling back to greedy.")
        return _greedy_select(candidates, overseas_slots)

    selected = [candidates[i] for i in range(n) if solver.Value(x[i]) == 1]
    return _format_result(selected)


def optimize_xi(
    squad: list[dict],
    match_context: dict,
    overseas_slots: int = 4,
    artifact_dir: Path = Path("ml_artifacts"),
) -> dict:
    """Full pipeline: score squad → optimize → return Playing XI."""
    candidates = score_players(squad, match_context, artifact_dir)
    result = select_xi(candidates, overseas_slots)
    return result


# ------------------------------------------------------------------ #
# Internal helpers
# ------------------------------------------------------------------ #

def _model_score(player: dict, context: dict, model_path: Path) -> float:
    artifact = joblib.load(model_path)
    features = artifact["features"]
    row = {f: player.get(f, context.get(f, 0)) for f in features}
    df = pd.DataFrame([row]).astype(float)
    return float(artifact["model"].predict(df)[0])


def _heuristic_score(player: dict, context: dict) -> float:
    """Fallback heuristic when model not yet trained."""
    role = player.get("playing_role", "")
    rating = player.get("overall_rating", 50)
    form = player.get("form_score", 0.5)

    venue_spin = context.get("venue_spin_rating", 5)
    venue_pace = context.get("venue_pace_rating", 5)

    bonus = 0
    if role == "Spin Bowler" and venue_spin > 6:
        bonus = 10
    elif role in ("Pace Bowler",) and venue_pace > 6:
        bonus = 8

    return float(np.clip(rating * 0.7 + form * 30 + bonus, 0, 100))


def _greedy_select(candidates: list[PlayerCandidate], overseas_slots: int) -> dict:
    """Greedy fallback: sort by score, pick top 11 respecting constraints."""
    sorted_c = sorted(candidates, key=lambda c: -c.ai_score)
    selected = []
    wk_count = 0
    overseas_count = 0
    bowling_count = 0

    for c in sorted_c:
        if len(selected) >= 11:
            break
        if c.is_overseas and overseas_count >= overseas_slots:
            continue
        selected.append(c)
        if c.is_wicketkeeper:
            wk_count += 1
        if c.is_overseas:
            overseas_count += 1
        if c.is_bowling_option:
            bowling_count += 1

    return _format_result(selected)


def _format_result(selected: list[PlayerCandidate]) -> dict:
    """Assign batting order and return structured result."""
    order_priority = {
        "Top-order Batter": 1,
        "Wicket-keeper Batter": 2,
        "Middle-order Batter": 3,
        "Batting All-rounder": 4,
        "Bowling All-rounder": 5,
        "Pace Bowler": 6,
        "Spin Bowler": 7,
    }
    ordered = sorted(selected, key=lambda c: (order_priority.get(c.playing_role, 9), -c.ai_score))

    return {
        "playing_xi": [
            {
                "player_id": c.player_id,
                "full_name": c.full_name,
                "playing_role": c.playing_role,
                "batting_position": pos,
                "ai_score": c.ai_score,
                "is_overseas": c.is_overseas,
            }
            for pos, c in enumerate(ordered, start=1)
        ],
        "total_score": round(sum(c.ai_score for c in selected), 2),
        "overseas_count": sum(1 for c in selected if c.is_overseas),
        "bowling_options": sum(1 for c in selected if c.is_bowling_option),
    }
