from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from core.database import get_db
from crud.tournament import (
    get_tournaments, get_seasons, get_season, get_fixtures,
    get_points_table, get_squad, get_franchises_by_season,
)
from crud.match import get_matches_by_season
from schemas.tournament import (
    TournamentOut, SeasonOut, FixtureOut, PointsTableRowOut, SquadOut, SquadPlayerOut,
)
from schemas.match import MatchOut, FranchiseOut, VenueOut
from schemas.response import APIResponse, PaginatedResponse

router = APIRouter(prefix="/tournaments", tags=["Tournaments & Seasons"])


@router.get("", response_model=APIResponse[list[TournamentOut]])
def list_tournaments(db: Session = Depends(get_db)):
    tournaments = get_tournaments(db)
    return APIResponse(data=[TournamentOut.model_validate(t) for t in tournaments])


@router.get("/{tournament_id}/seasons", response_model=APIResponse[list[SeasonOut]])
def list_seasons(tournament_id: UUID, db: Session = Depends(get_db)):
    seasons = get_seasons(db, tournament_id)
    return APIResponse(data=[
        SeasonOut(
            id=s.id,
            tournament_id=s.tournament_id,
            tournament_name=str(s.tournament.name),
            year=s.year,
            start_date=s.start_date,
            end_date=s.end_date,
            total_teams=s.total_teams,
            is_active=s.is_active,
        )
        for s in seasons
    ])


@router.get("/seasons/{season_id}/fixtures", response_model=APIResponse[list[FixtureOut]])
def season_fixtures(
    season_id: UUID,
    franchise_id: UUID | None = None,
    db: Session = Depends(get_db),
):
    fixtures = get_fixtures(db, season_id, franchise_id=franchise_id)
    return APIResponse(data=[
        FixtureOut(
            id=f.id,
            match_id=f.match_id,
            team1=FranchiseOut.model_validate(f.team1),
            team2=FranchiseOut.model_validate(f.team2),
            scheduled_date=f.scheduled_date,
            venue_name=f.venue.name if f.venue else None,
            match_number=f.match_number,
            match_type=str(f.match_type) if f.match_type else None,
            is_completed=bool(f.match_id),
        )
        for f in fixtures
    ])


@router.get("/seasons/{season_id}/points-table", response_model=APIResponse[list[PointsTableRowOut]])
def points_table(season_id: UUID, db: Session = Depends(get_db)):
    rows = get_points_table(db, season_id)
    return APIResponse(data=[
        PointsTableRowOut(
            rank=i + 1,
            franchise=FranchiseOut.model_validate(row.franchise),
            matches_played=row.matches_played,
            wins=row.wins,
            losses=row.losses,
            ties=row.ties,
            no_results=row.no_results,
            points=row.points,
            net_run_rate=float(row.net_run_rate),
            for_runs=row.for_runs,
            against_runs=row.against_runs,
        )
        for i, row in enumerate(rows)
    ])


@router.get("/seasons/{season_id}/squads/{franchise_id}", response_model=APIResponse[SquadOut])
def squad(season_id: UUID, franchise_id: UUID, db: Session = Depends(get_db)):
    squad_entries = get_squad(db, franchise_id, season_id)
    if not squad_entries:
        raise HTTPException(status_code=404, detail="No squad found for this franchise and season")

    franchise = squad_entries[0].franchise
    players = []
    total_spend = 0.0
    overseas_count = 0

    for entry in squad_entries:
        p = entry.player
        if entry.is_overseas:
            overseas_count += 1
        if entry.contracted_price_cr:
            total_spend += float(entry.contracted_price_cr)

        players.append(SquadPlayerOut(
            player_id=p.id,
            full_name=p.full_name,
            playing_role=str(p.playing_role),
            batting_style=str(p.batting_style),
            bowling_style=str(p.bowling_style),
            nationality=str(p.nationality),
            is_overseas=entry.is_overseas,
            is_uncapped=entry.is_uncapped,
            contracted_price_cr=float(entry.contracted_price_cr) if entry.contracted_price_cr else None,
            base_price_cr=float(entry.base_price_cr) if entry.base_price_cr else None,
            is_retained=entry.is_retained,
        ))

    return APIResponse(data=SquadOut(
        franchise=FranchiseOut.model_validate(franchise),
        season_year=squad_entries[0].season.year,
        players=players,
        total_players=len(players),
        overseas_count=overseas_count,
        total_spend_cr=round(total_spend, 2),
    ))


@router.get("/seasons/{season_id}/matches", response_model=PaginatedResponse[MatchOut])
def season_matches(
    season_id: UUID,
    franchise_id: UUID | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    matches, total = get_matches_by_season(db, season_id, franchise_id, page, size)
    return PaginatedResponse(
        data=[_map_match(m) for m in matches],
        total=total, page=page, size=size,
    )


def _map_match(m) -> MatchOut:
    return MatchOut(
        id=m.id,
        season_id=m.season_id,
        venue=VenueOut.model_validate(m.venue),
        team1=FranchiseOut.model_validate(m.team1),
        team2=FranchiseOut.model_validate(m.team2),
        match_date=m.match_date,
        match_number=m.match_number,
        match_type=str(m.match_type),
        toss_winner=FranchiseOut.model_validate(m.toss_winner) if m.toss_winner else None,
        toss_decision=str(m.toss_decision) if m.toss_decision else None,
        winner=FranchiseOut.model_validate(m.winner) if m.winner else None,
        win_margin_runs=m.win_margin_runs,
        win_margin_wickets=m.win_margin_wickets,
        no_result=m.no_result,
        pitch_type=str(m.pitch_type) if m.pitch_type else None,
        is_completed=m.is_completed,
    )
