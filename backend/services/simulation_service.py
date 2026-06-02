"""
Interactive match simulation engine.

Lets a user *drive* a live T20 chase ball-by-ball from the UI:
  - start(): set up a 2nd-innings chase (target taken from the real 1st innings
             if it exists in the DB, else a sensible default), write live state.
  - step():  simulate one ball with a realistic T20 outcome distribution,
             update the live state, run the real ML win-probability model,
             record a win-probability snapshot, and return the new state.
  - reset(): clear the live state + snapshots so the user can start over.

Writes to live_match_states + win_probability_snapshots, so the existing Live
Match read endpoints / page light up automatically — no new read path needed.
"""
from __future__ import annotations

import random
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from crud.live import (
    get_live_state,
    upsert_live_state,
    record_win_probability_snapshot,
)
from crud.match import get_match
from services.live_service import compute_live_win_probability

INNINGS = 2          # we simulate the chase
TOTAL_OVERS = 20
DEFAULT_TARGET = 180

# Realistic-ish T20 per-ball outcome weights. "extra" = wide/no-ball: +1 run,
# ball does NOT count. "W" = wicket.
_OUTCOMES = [
    ("0", 0, 0.36),
    ("1", 1, 0.32),
    ("2", 2, 0.07),
    ("3", 3, 0.01),
    ("4", 4, 0.11),
    ("6", 6, 0.05),
    ("W", 0, 0.05),
    ("extra", 1, 0.03),
]


def _derive_target(db: Session, match_id: UUID) -> int:
    """Use the real 1st-innings total + 1 if present, else a default."""
    row = db.execute(
        text(
            "SELECT total_runs FROM innings "
            "WHERE match_id = :m AND innings_number = 1 "
            "ORDER BY total_runs DESC LIMIT 1"
        ),
        {"m": str(match_id)},
    ).fetchone()
    if row and row[0]:
        return int(row[0]) + 1
    return DEFAULT_TARGET


def _clear(db: Session, match_id: UUID) -> None:
    db.execute(
        text("DELETE FROM win_probability_snapshots WHERE match_id = :m"),
        {"m": str(match_id)},
    )
    db.execute(
        text("DELETE FROM live_match_states WHERE match_id = :m"),
        {"m": str(match_id)},
    )
    db.commit()


def start_simulation(db: Session, match_id: UUID) -> dict:
    match = get_match(db, match_id)
    if not match:
        return {"error": "Match not found"}

    _clear(db, match_id)
    target = _derive_target(db, match_id)

    upsert_live_state(db, match_id, INNINGS, {
        "current_over": 0,
        "current_ball": 0,
        "batting_team_id": match.team2_id,   # team2 chases
        "bowling_team_id": match.team1_id,
        "batting_team_score": 0,
        "batting_team_wickets": 0,
        "current_run_rate": 0,
        "required_run_rate": round(target / TOTAL_OVERS, 2),
        "target_runs": target,
        "runs_required": target,
        "balls_remaining": TOTAL_OVERS * 6,
        "win_probability": 0.5,
        "momentum": "Stable",
        "last_ball_event": {"type": "start"},
    })
    prob = compute_live_win_probability(db, match_id)
    upsert_live_state(db, match_id, INNINGS, {"win_probability": prob})
    record_win_probability_snapshot(db, match_id, INNINGS, 0, 0, prob, 0, 0)

    return {
        "status": "started",
        "match_id": str(match_id),
        "target": target,
        "win_probability": prob,
        "innings_over": False,
    }


def _simulate_outcome(over_number: int) -> tuple[str, int, bool, bool]:
    """Returns (label, runs, is_wicket, is_extra). Death overs raise risk a bit."""
    weights = [w for _, _, w in _OUTCOMES]
    if over_number >= 15:  # death overs: more boundaries and more wickets
        weights = [w * m for w, m in zip(
            weights, [0.85, 0.95, 1.0, 1.0, 1.4, 1.6, 1.5, 1.0]
        )]
    label, runs, _ = random.choices(_OUTCOMES, weights=weights, k=1)[0]
    return label, runs, label == "W", label == "extra"


def step_ball(db: Session, match_id: UUID) -> dict:
    live = get_live_state(db, match_id)
    if not live or live.innings_number != INNINGS:
        return {"error": "No simulation running. Start one first."}

    target = live.target_runs or DEFAULT_TARGET
    score = live.batting_team_score
    wickets = live.batting_team_wickets
    over = live.current_over
    ball = live.current_ball

    # Already finished?
    if score >= target or wickets >= 10 or (over * 6 + ball) >= TOTAL_OVERS * 6:
        return _result(db, match_id, live, finished=True)

    label, runs, is_wicket, is_extra = _simulate_outcome(over)

    score += runs
    if is_wicket:
        wickets += 1
    if not is_extra:
        ball += 1
        if ball >= 6:
            ball = 0
            over += 1

    balls_done = over * 6 + ball
    balls_remaining = max(0, TOTAL_OVERS * 6 - balls_done)
    runs_required = max(0, target - score)
    crr = round(score / (balls_done / 6), 2) if balls_done > 0 else 0.0
    rrr = round(runs_required / (balls_remaining / 6), 2) if balls_remaining > 0 else 0.0

    upsert_live_state(db, match_id, INNINGS, {
        "current_over": over,
        "current_ball": ball,
        "batting_team_score": score,
        "batting_team_wickets": wickets,
        "current_run_rate": crr,
        "required_run_rate": rrr,
        "runs_required": runs_required,
        "balls_remaining": balls_remaining,
        "last_ball_event": {"label": label, "runs": runs, "wicket": is_wicket, "extra": is_extra},
    })

    prob = compute_live_win_probability(db, match_id)
    upsert_live_state(db, match_id, INNINGS, {"win_probability": prob})
    record_win_probability_snapshot(db, match_id, INNINGS, over, ball, prob, score, wickets)

    live = get_live_state(db, match_id)
    return _result(db, match_id, live, last_ball={
        "label": label, "runs": runs, "wicket": is_wicket, "extra": is_extra,
    })


def reset_simulation(db: Session, match_id: UUID) -> dict:
    _clear(db, match_id)
    return {"status": "reset", "match_id": str(match_id)}


def _result(db: Session, match_id: UUID, live, last_ball: dict | None = None,
            finished: bool = False) -> dict:
    target = live.target_runs or DEFAULT_TARGET
    score = live.batting_team_score
    wickets = live.batting_team_wickets
    balls_remaining = live.balls_remaining or 0

    won = score >= target
    all_out = wickets >= 10
    overs_done = balls_remaining <= 0
    is_over = finished or won or all_out or overs_done

    outcome = None
    if is_over:
        if won:
            outcome = f"{live.batting_team.name} win by {10 - wickets} wickets"
        elif all_out or overs_done:
            margin = target - score - 1
            outcome = (
                f"{live.bowling_team.name} win by {margin} runs"
                if margin > 0 else "Match tied"
            )

    return {
        "match_id": str(match_id),
        "innings_over": is_over,
        "outcome": outcome,
        "win_probability": float(live.win_probability) if live.win_probability else 0.5,
        "score": score,
        "wickets": wickets,
        "over": live.current_over,
        "ball": live.current_ball,
        "runs_required": live.runs_required,
        "balls_remaining": balls_remaining,
        "target": target,
        "last_ball": last_ball,
    }
