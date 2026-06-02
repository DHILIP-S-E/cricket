from __future__ import annotations

import uuid
from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from models import (
    LiveMatchState, LiveBatterState, LiveBowlerState,
    WinProbabilitySnapshot, AIRecommendation, Ball, Player,
)


def get_live_state(db: Session, match_id: UUID) -> LiveMatchState | None:
    return (
        db.query(LiveMatchState)
        .options(
            joinedload(LiveMatchState.batting_team),
            joinedload(LiveMatchState.bowling_team),
            joinedload(LiveMatchState.striker),
            joinedload(LiveMatchState.non_striker),
            joinedload(LiveMatchState.current_bowler),
        )
        .filter(LiveMatchState.match_id == match_id)
        .order_by(LiveMatchState.innings_number.desc())
        .first()
    )


def get_live_batters(db: Session, match_id: UUID) -> list[LiveBatterState]:
    return (
        db.query(LiveBatterState)
        .options(joinedload(LiveBatterState.player))
        .filter(LiveBatterState.match_id == match_id)
        .all()
    )


def get_live_bowlers(db: Session, match_id: UUID) -> list[LiveBowlerState]:
    return (
        db.query(LiveBowlerState)
        .options(joinedload(LiveBowlerState.player))
        .filter(LiveBowlerState.match_id == match_id)
        .all()
    )


def get_win_probability_history(
    db: Session, match_id: UUID, innings_number: int = 2
) -> list[WinProbabilitySnapshot]:
    return (
        db.query(WinProbabilitySnapshot)
        .filter(
            WinProbabilitySnapshot.match_id == match_id,
            WinProbabilitySnapshot.innings_number == innings_number,
        )
        .order_by(WinProbabilitySnapshot.over_number, WinProbabilitySnapshot.ball_number)
        .all()
    )


def upsert_live_state(db: Session, match_id: UUID, innings_number: int, state: dict) -> LiveMatchState:
    existing = (
        db.query(LiveMatchState)
        .filter(
            LiveMatchState.match_id == match_id,
            LiveMatchState.innings_number == innings_number,
        )
        .first()
    )
    if existing:
        for k, v in state.items():
            setattr(existing, k, v)
        existing.updated_at = datetime.utcnow()
        db.commit()
        return existing

    live = LiveMatchState(id=uuid.uuid4(), match_id=match_id, innings_number=innings_number, **state)
    db.add(live)
    db.commit()
    return live


def record_win_probability_snapshot(
    db: Session, match_id: UUID, innings_number: int,
    over_number: int, ball_number: int, prob: float,
    score: int, wickets: int,
) -> None:
    snapshot = WinProbabilitySnapshot(
        id=uuid.uuid4(),
        match_id=match_id,
        innings_number=innings_number,
        over_number=over_number,
        ball_number=ball_number,
        batting_team_win_prob=prob,
        score_at_snapshot=score,
        wickets_at_snapshot=wickets,
        model_version="1.0",
    )
    db.add(snapshot)
    db.commit()


def log_ai_recommendation(
    db: Session,
    recommendation_type: str,
    context: dict,
    action: dict,
    match_id: UUID | None = None,
    franchise_id: UUID | None = None,
    confidence: float | None = None,
    reasoning: str | None = None,
) -> AIRecommendation:
    rec = AIRecommendation(
        id=uuid.uuid4(),
        match_id=match_id,
        franchise_id=franchise_id,
        recommendation_type=recommendation_type,
        context_snapshot=context,
        recommended_action=action,
        confidence_score=confidence,
        reasoning_text=reasoning,
        model_version="1.0",
    )
    db.add(rec)
    db.commit()
    return rec
