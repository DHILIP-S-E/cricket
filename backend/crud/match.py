from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from models import (
    Match, Innings, PlayingXI, BattingPerformance, BowlingPerformance,
    Franchise, Venue, Player,
)


def get_match(db: Session, match_id: UUID) -> Match | None:
    return (
        db.query(Match)
        .options(
            joinedload(Match.venue),
            joinedload(Match.team1),
            joinedload(Match.team2),
            joinedload(Match.winner),
            joinedload(Match.toss_winner),
        )
        .filter(Match.id == match_id)
        .first()
    )


def get_matches_by_season(
    db: Session,
    season_id: UUID,
    franchise_id: UUID | None = None,
    page: int = 1,
    size: int = 20,
) -> tuple[list[Match], int]:
    query = (
        db.query(Match)
        .options(joinedload(Match.team1), joinedload(Match.team2), joinedload(Match.venue))
        .filter(Match.season_id == season_id)
    )
    if franchise_id:
        query = query.filter(
            (Match.team1_id == franchise_id) | (Match.team2_id == franchise_id)
        )
    query = query.order_by(Match.match_date.desc())
    total = query.count()
    matches = query.offset((page - 1) * size).limit(size).all()
    return matches, total


def get_innings(db: Session, match_id: UUID) -> list[Innings]:
    return (
        db.query(Innings)
        .options(joinedload(Innings.batting_team), joinedload(Innings.bowling_team))
        .filter(Innings.match_id == match_id)
        .order_by(Innings.innings_number)
        .all()
    )


def get_playing_xi(
    db: Session, match_id: UUID, franchise_id: UUID | None = None
) -> list[PlayingXI]:
    query = db.query(PlayingXI).filter(PlayingXI.match_id == match_id)
    if franchise_id:
        query = query.filter(PlayingXI.franchise_id == franchise_id)
    return query.order_by(PlayingXI.batting_position).all()


def get_batting_performances(db: Session, innings_id: UUID) -> list[BattingPerformance]:
    return (
        db.query(BattingPerformance)
        .filter(BattingPerformance.innings_id == innings_id)
        .order_by(BattingPerformance.batting_position)
        .all()
    )


def get_bowling_performances(db: Session, innings_id: UUID) -> list[BowlingPerformance]:
    return (
        db.query(BowlingPerformance)
        .filter(BowlingPerformance.innings_id == innings_id)
        .order_by(BowlingPerformance.overs_bowled.desc())
        .all()
    )


def get_recent_h2h_matches(
    db: Session, team1_id: UUID, team2_id: UUID, limit: int = 10
) -> list[Match]:
    return (
        db.query(Match)
        .filter(
            ((Match.team1_id == team1_id) & (Match.team2_id == team2_id))
            | ((Match.team1_id == team2_id) & (Match.team2_id == team1_id))
        )
        .filter(Match.is_completed == True)
        .order_by(Match.match_date.desc())
        .limit(limit)
        .all()
    )
