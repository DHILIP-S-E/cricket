from __future__ import annotations

from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models import (
    Tournament, Season, FixtureSchedule, PointsTable,
    Squad, Player, PlayerRating, PlayerForm, Franchise,
)


def get_tournaments(db: Session) -> list[Tournament]:
    return db.query(Tournament).order_by(Tournament.name).all()


def get_seasons(db: Session, tournament_id: UUID) -> list[Season]:
    return (
        db.query(Season)
        .filter(Season.tournament_id == tournament_id)
        .order_by(Season.year.desc())
        .all()
    )


def get_season(db: Session, season_id: UUID) -> Season | None:
    return (
        db.query(Season)
        .options(joinedload(Season.tournament))
        .filter(Season.id == season_id)
        .first()
    )


def get_fixtures(
    db: Session,
    season_id: UUID,
    franchise_id: UUID | None = None,
    upcoming_only: bool = False,
) -> list[FixtureSchedule]:
    query = (
        db.query(FixtureSchedule)
        .options(
            joinedload(FixtureSchedule.team1),
            joinedload(FixtureSchedule.team2),
            joinedload(FixtureSchedule.venue),
        )
        .filter(FixtureSchedule.season_id == season_id)
    )
    if franchise_id:
        query = query.filter(
            (FixtureSchedule.team1_id == franchise_id)
            | (FixtureSchedule.team2_id == franchise_id)
        )
    return query.order_by(FixtureSchedule.scheduled_date).all()


def get_points_table(db: Session, season_id: UUID) -> list[PointsTable]:
    return (
        db.query(PointsTable)
        .options(joinedload(PointsTable.franchise))
        .filter(PointsTable.season_id == season_id)
        .order_by(
            PointsTable.points.desc(),
            PointsTable.net_run_rate.desc(),
        )
        .all()
    )


def get_squad(db: Session, franchise_id: UUID, season_id: UUID) -> list[Squad]:
    return (
        db.query(Squad)
        .options(
            joinedload(Squad.player),
            joinedload(Squad.franchise),
        )
        .filter(
            Squad.franchise_id == franchise_id,
            Squad.season_id == season_id,
        )
        .all()
    )


def get_franchises_by_season(db: Session, season_id: UUID) -> list[Franchise]:
    """Return all franchises that have a squad in this season."""
    franchise_ids = (
        db.query(Squad.franchise_id)
        .filter(Squad.season_id == season_id)
        .distinct()
        .subquery()
    )
    return (
        db.query(Franchise)
        .filter(Franchise.id.in_(franchise_ids))
        .all()
    )
