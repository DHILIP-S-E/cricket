"""
Live match decision engine.
Called after every ball to generate tactical recommendations.
"""
from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.orm import Session

from crud.live import get_live_state, get_live_bowlers, get_win_probability_history
from crud.match import get_playing_xi
from crud.player import get_player
from ml.serve import predict_live_win_prob, get_matchup

logger = logging.getLogger(__name__)


def compute_live_win_probability(db: Session, match_id: UUID) -> float:
    live = get_live_state(db, match_id)
    if not live:
        return 0.50

    if live.innings_number == 1:
        # Innings 1: return a simple projection
        balls_done = live.current_over * 6 + live.current_ball
        if balls_done == 0:
            return 0.50
        projected = (live.batting_team_score / balls_done) * 120
        par = 165.0
        prob = min(0.90, max(0.10, 0.5 + (projected - par) / (par * 2)))
        return round(prob, 4)

    # Innings 2
    balls_remaining = live.balls_remaining or 0
    runs_required = live.runs_required or 0
    wickets_remaining = 10 - live.batting_team_wickets

    if balls_remaining <= 0:
        return 0.99 if runs_required <= 0 else 0.01

    balls_done = (live.current_over * 6 + live.current_ball) or 1
    current_rr = (live.batting_team_score / (balls_done / 6)) if balls_done > 0 else 0
    required_rr = runs_required / (balls_remaining / 6) if balls_remaining > 0 else 99

    state = {
        "balls_remaining": balls_remaining,
        "runs_required": runs_required,
        "wickets_remaining": wickets_remaining,
        "required_run_rate": round(required_rr, 2),
        "current_run_rate": round(current_rr, 2),
        "run_rate_ratio": round(current_rr / required_rr, 4) if required_rr > 0 else 1.0,
        "target": live.target_runs or 0,
        "current_score": live.batting_team_score,
        "is_powerplay": int(live.current_over < 6),
        "is_middle_overs": int(6 <= live.current_over < 15),
        "is_death_overs": int(live.current_over >= 15),
        "over_number": live.current_over,
        "wickets_fallen": live.batting_team_wickets,
    }

    return predict_live_win_prob(state)


def get_bowler_recommendation(db: Session, match_id: UUID) -> dict:
    """Recommend the best bowler for the next over."""
    live = get_live_state(db, match_id)
    if not live:
        return {}

    # Get available bowlers (playing XI for bowling team, not maxed out)
    bowling_xi = get_playing_xi(db, match_id, live.bowling_team_id)
    live_bowlers = {str(b.player_id): b for b in get_live_bowlers(db, match_id)}

    striker_id = str(live.striker_id) if live.striker_id else None
    current_over = live.current_over
    phase = (
        "Powerplay" if current_over < 6
        else "Death" if current_over >= 15
        else "Middle"
    )

    candidates = []
    for xi_entry in bowling_xi:
        pid = str(xi_entry.player_id)
        lb = live_bowlers.get(pid)
        overs_bowled = float(lb.overs_bowled if lb else 0)
        max_overs = 4.0

        if overs_bowled >= max_overs:
            continue
        if lb and lb.is_current_bowler:
            continue  # Can't bowl consecutive overs (usually)

        player = get_player(db, xi_entry.player_id)
        if not player:
            continue

        role = str(player.playing_role)
        if role not in ("Pace Bowler", "Spin Bowler", "Bowling All-rounder", "Batting All-rounder"):
            continue

        # Matchup score vs current striker
        matchup_score = 0.5
        if striker_id:
            m = get_matchup(striker_id, pid, phase)
            matchup_score = (
                0.4 * min(1.0, m["wicket_probability"] / 0.15) +
                0.35 * (1 - min(1.0, m["strike_rate"] / 200)) +
                0.25 * min(1.0, m["dot_ball_rate"] / 0.60)
            )

        econ = float(lb.current_economy or 8.0) if lb else 8.0
        economy_score = max(0, (12 - econ) / 12)
        composite = 0.6 * matchup_score + 0.4 * economy_score

        candidates.append({
            "player_id": pid,
            "player_name": player.full_name,
            "composite_score": round(composite, 4),
            "overs_remaining": round(max_overs - overs_bowled, 1),
            "economy": round(econ, 2),
            "matchup_score": round(matchup_score, 4),
        })

    if not candidates:
        return {"error": "No bowling candidates available"}

    candidates.sort(key=lambda x: -x["composite_score"])
    best = candidates[0]

    reasoning_parts = [
        f"Best matchup vs current striker (score {best['matchup_score']:.2f})",
        f"Economy {best['economy']:.1f}",
        f"{best['overs_remaining']} overs remaining in quota",
    ]

    return {
        "recommended_bowler_id": best["player_id"],
        "recommended_bowler_name": best["player_name"],
        "expected_runs_this_over": round(best["economy"], 1),
        "wicket_probability": round(best["matchup_score"] * 0.15, 4),
        "confidence": "High" if best["composite_score"] > 0.65 else "Medium",
        "reasoning": " | ".join(reasoning_parts),
        "alternatives": candidates[1:4],
    }


def get_live_recommendations(db: Session, match_id: UUID) -> dict:
    """Full recommendation bundle for the live match dashboard."""
    win_prob = compute_live_win_probability(db, match_id)
    bowler_rec = get_bowler_recommendation(db, match_id)

    live = get_live_state(db, match_id)
    momentum = "Stable"
    alert = None

    if live:
        # Simple momentum detection from last 3 overs
        history = get_win_probability_history(db, match_id, live.innings_number)
        if len(history) >= 18:  # 3 overs of data
            recent_probs = [float(h.batting_team_win_prob) for h in history[-18:]]
            delta = recent_probs[-1] - recent_probs[0]
            momentum = "Rising" if delta > 0.05 else "Falling" if delta < -0.05 else "Stable"

        # Alert detection
        if live.batting_team_wickets >= 7 and live.innings_number == 2:
            runs_needed = live.runs_required or 0
            if runs_needed > 0:
                alert = f"Tail exposed — {runs_needed} needed, {10 - live.batting_team_wickets} wickets left"

    # Batting risk level (1=defensive, 10=all-out attack)
    batting_risk = 5
    if live and live.innings_number == 2 and live.balls_remaining:
        rrr = (live.runs_required or 0) / (live.balls_remaining / 6) if live.balls_remaining > 0 else 0
        batting_risk = min(10, max(1, int(rrr - 2)))

    batting_strategy = (
        "Bat deep — preserve wickets" if batting_risk <= 3
        else "Rotate strike, take calculated risks" if batting_risk <= 6
        else "Aggressive — boundaries every over" if batting_risk <= 8
        else "All-out attack — every ball is a scoring opportunity"
    )

    return {
        "match_id": str(match_id),
        "win_probability": win_prob,
        "momentum": momentum,
        "bowler_recommendation": bowler_rec if "error" not in bowler_rec else None,
        "batting_risk_level": batting_risk,
        "batting_strategy": batting_strategy,
        "field_placement_note": None,
        "alert": alert,
    }
