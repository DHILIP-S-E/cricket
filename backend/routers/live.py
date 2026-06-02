from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user, require_match_write
from models.user import User
from crud.live import (
    get_live_state, get_live_batters, get_live_bowlers,
    get_win_probability_history, log_ai_recommendation,
)
from services.live_service import (
    compute_live_win_probability, get_bowler_recommendation, get_live_recommendations,
)
from schemas.live import (
    LiveMatchStateOut, LiveRecommendationsOut, BowlerRecommendationOut,
    WinProbabilityHistoryPoint, BallEventIn,
)
from schemas.response import APIResponse

router = APIRouter(prefix="/live", tags=["Live Match Engine"])


@router.get("/{match_id}/state", response_model=APIResponse[LiveMatchStateOut])
def live_state(match_id: UUID, db: Session = Depends(get_db)):
    state = get_live_state(db, match_id)
    if not state:
        raise HTTPException(status_code=404, detail="No live state found for this match")
    return APIResponse(data=_map_state(state))


@router.get("/{match_id}/win-probability", response_model=APIResponse[dict])
def live_win_probability(match_id: UUID, db: Session = Depends(get_db)):
    state = get_live_state(db, match_id)
    if not state:
        raise HTTPException(status_code=404, detail="No live state found")

    prob = compute_live_win_probability(db, match_id)
    history = get_win_probability_history(db, match_id, state.innings_number)

    return APIResponse(data={
        "current": prob,
        "batting_team_id": str(state.batting_team_id),
        "batting_team_name": state.batting_team.name,
        "bowling_team_win_prob": round(1 - prob, 4),
        "history": [
            WinProbabilityHistoryPoint(
                over_number=h.over_number,
                ball_number=h.ball_number,
                batting_team_win_prob=float(h.batting_team_win_prob),
                score=h.score_at_snapshot or 0,
                wickets=h.wickets_at_snapshot or 0,
            )
            for h in history[-60:]  # last 10 overs
        ],
    })


@router.get("/{match_id}/bowler-recommendation", response_model=APIResponse[BowlerRecommendationOut])
def bowler_recommendation(match_id: UUID, db: Session = Depends(get_db)):
    result = get_bowler_recommendation(db, match_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    log_ai_recommendation(
        db, recommendation_type="BowlerChange",
        context={"match_id": str(match_id)},
        action=result,
        match_id=match_id,
    )
    return APIResponse(data=result)


@router.get("/{match_id}/recommendations", response_model=APIResponse[LiveRecommendationsOut])
def live_recommendations(match_id: UUID, db: Session = Depends(get_db)):
    """Full live recommendation bundle: win prob + bowler + batting strategy + alerts."""
    state = get_live_state(db, match_id)
    if not state:
        raise HTTPException(status_code=404, detail="No live state found")

    result = get_live_recommendations(db, match_id)
    return APIResponse(data=result)


@router.post("/{match_id}/ball", response_model=APIResponse[dict])
def record_ball(
    match_id: UUID,
    ball: BallEventIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_match_write),
):
    """
    Manual ball entry for live match tracking.
    Requires Data Engineer or Head Analyst role.
    Updates LiveMatchState and triggers recommendation refresh.
    """
    from crud.live import upsert_live_state, record_win_probability_snapshot
    import uuid as _uuid

    # Update live state
    state = get_live_state(db, match_id)
    balls_done = ball.over_number * 6 + ball.ball_number + 1
    new_score = (state.batting_team_score if state else 0) + ball.runs_off_bat + ball.extras_runs
    new_wickets = (state.batting_team_wickets if state else 0) + (1 if ball.is_wicket else 0)
    target = state.target_runs if state else None
    runs_req = (target - new_score) if target else None
    balls_rem = max(0, 120 - balls_done) if ball.innings_number == 2 else None
    crr = round(new_score / (balls_done / 6), 2) if balls_done > 0 else 0
    rrr = round(runs_req / (balls_rem / 6), 2) if runs_req and balls_rem and balls_rem > 0 else None

    upsert_live_state(db, match_id, ball.innings_number, {
        "current_over": ball.over_number,
        "current_ball": ball.ball_number,
        "batting_team_score": new_score,
        "batting_team_wickets": new_wickets,
        "current_run_rate": crr,
        "required_run_rate": rrr,
        "runs_required": runs_req,
        "balls_remaining": balls_rem,
        "striker_id": ball.batter_id,
        "non_striker_id": ball.non_striker_id,
        "current_bowler_id": ball.bowler_id,
        "batting_team_id": state.batting_team_id if state else None,
        "bowling_team_id": state.bowling_team_id if state else None,
    })

    # Record win probability
    prob = compute_live_win_probability(db, match_id)
    record_win_probability_snapshot(
        db, match_id, ball.innings_number,
        ball.over_number, ball.ball_number,
        prob, new_score, new_wickets,
    )

    return APIResponse(
        message="Ball recorded",
        data={"win_probability": prob, "score": new_score, "wickets": new_wickets},
    )


def _map_state(state) -> LiveMatchStateOut:
    from schemas.live import LiveBatterOut, LiveBowlerOut

    striker = None
    if state.striker:
        striker = LiveBatterOut(
            player_id=state.striker.id,
            full_name=state.striker.full_name,
            runs_scored=0, balls_faced=0, fours=0, sixes=0,
            is_on_strike=True, dots_in_row=0,
        )
    non_striker = None
    if state.non_striker:
        non_striker = LiveBatterOut(
            player_id=state.non_striker.id,
            full_name=state.non_striker.full_name,
            runs_scored=0, balls_faced=0, fours=0, sixes=0,
            is_on_strike=False, dots_in_row=0,
        )
    bowler = None
    if state.current_bowler:
        bowler = LiveBowlerOut(
            player_id=state.current_bowler.id,
            full_name=state.current_bowler.full_name,
            overs_bowled=0, runs_conceded=0, wickets=0,
            is_current_bowler=True,
        )

    return LiveMatchStateOut(
        match_id=state.match_id,
        innings_number=state.innings_number,
        current_over=state.current_over,
        current_ball=state.current_ball,
        batting_team_id=state.batting_team_id,
        batting_team_name=state.batting_team.name,
        bowling_team_id=state.bowling_team_id,
        bowling_team_name=state.bowling_team.name,
        batting_team_score=state.batting_team_score,
        batting_team_wickets=state.batting_team_wickets,
        current_run_rate=float(state.current_run_rate),
        required_run_rate=float(state.required_run_rate) if state.required_run_rate else None,
        target_runs=state.target_runs,
        runs_required=state.runs_required,
        balls_remaining=state.balls_remaining,
        win_probability=float(state.win_probability) if state.win_probability else None,
        momentum=state.momentum,
        striker=striker,
        non_striker=non_striker,
        current_bowler=bowler,
        updated_at=state.updated_at,
    )
