from __future__ import annotations

from uuid import UUID

from sqlalchemy import or_, func
from sqlalchemy.orm import Session, joinedload

from models import (
    Player, PlayerCareerStats, PlayerForm, PlayerRating,
    PlayerValuation, PlayerMatchup,
)


def get_players(
    db: Session,
    playing_role: str | None = None,
    nationality: str | None = None,
    min_ipl_caps: int | None = None,
    is_active: bool | None = True,
    q: str | None = None,
    page: int = 1,
    size: int = 20,
) -> tuple[list[Player], int]:
    query = db.query(Player)

    if is_active is not None:
        query = query.filter(Player.is_active == is_active)
    if playing_role:
        query = query.filter(Player.playing_role == playing_role)
    if nationality:
        query = query.filter(Player.nationality == nationality)
    if min_ipl_caps is not None:
        query = query.filter(Player.ipl_caps >= min_ipl_caps)
    if q:
        query = query.filter(Player.full_name.ilike(f"%{q}%"))

    total = query.count()
    players = query.offset((page - 1) * size).limit(size).all()
    return players, total


def get_player(db: Session, player_id: UUID) -> Player | None:
    return db.query(Player).filter(Player.id == player_id).first()


def get_player_profile(db: Session, player_id: UUID) -> Player | None:
    return (
        db.query(Player)
        .options(
            joinedload(Player.career_stats),
            joinedload(Player.rating),
        )
        .filter(Player.id == player_id)
        .first()
    )


def get_player_form(db: Session, player_id: UUID) -> PlayerForm | None:
    return (
        db.query(PlayerForm)
        .filter(PlayerForm.player_id == player_id)
        .order_by(PlayerForm.computed_at.desc())
        .first()
    )


def get_player_rating(db: Session, player_id: UUID) -> PlayerRating | None:
    return db.query(PlayerRating).filter(PlayerRating.player_id == player_id).first()


def get_player_valuation(
    db: Session, player_id: UUID, season_id: UUID | None = None
) -> PlayerValuation | None:
    query = db.query(PlayerValuation).filter(PlayerValuation.player_id == player_id)
    if season_id:
        query = query.filter(PlayerValuation.season_id == season_id)
    return query.order_by(PlayerValuation.computed_at.desc()).first()


def get_player_matchups_as_batter(
    db: Session, player_id: UUID, phase: str = "All"
) -> list[PlayerMatchup]:
    return (
        db.query(PlayerMatchup)
        .filter(PlayerMatchup.batter_id == player_id, PlayerMatchup.phase == phase)
        .order_by(PlayerMatchup.balls_faced.desc())
        .all()
    )


def get_player_matchups_as_bowler(
    db: Session, player_id: UUID, phase: str = "All"
) -> list[PlayerMatchup]:
    return (
        db.query(PlayerMatchup)
        .filter(PlayerMatchup.bowler_id == player_id, PlayerMatchup.phase == phase)
        .order_by(PlayerMatchup.balls_faced.desc())
        .all()
    )


def get_players_by_ids(db: Session, player_ids: list[UUID]) -> list[Player]:
    return db.query(Player).filter(Player.id.in_(player_ids)).all()
