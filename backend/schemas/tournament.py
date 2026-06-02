from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from .base import OurBaseModel
from .match import FranchiseOut


class TournamentOut(OurBaseModel):
    id: UUID
    name: str
    full_name: str
    country: str
    format: str
    is_active: bool


class SeasonOut(OurBaseModel):
    id: UUID
    tournament_id: UUID
    tournament_name: str
    year: int
    start_date: date | None = None
    end_date: date | None = None
    total_teams: int | None = None
    is_active: bool


class FixtureOut(OurBaseModel):
    id: UUID
    match_id: UUID | None = None
    team1: FranchiseOut
    team2: FranchiseOut
    scheduled_date: datetime
    venue_name: str | None = None
    match_number: int | None = None
    match_type: str | None = None
    is_completed: bool = False


class PointsTableRowOut(OurBaseModel):
    rank: int
    franchise: FranchiseOut
    matches_played: int
    wins: int
    losses: int
    ties: int
    no_results: int
    points: int
    net_run_rate: float
    for_runs: int
    against_runs: int


class SquadPlayerOut(OurBaseModel):
    player_id: UUID
    full_name: str
    playing_role: str
    batting_style: str
    bowling_style: str
    nationality: str
    is_overseas: bool
    is_uncapped: bool
    contracted_price_cr: float | None = None
    base_price_cr: float | None = None
    is_retained: bool
    overall_rating: float | None = None
    form_score: float | None = None


class SquadOut(OurBaseModel):
    franchise: FranchiseOut
    season_year: int
    players: list[SquadPlayerOut] = []
    total_players: int = 0
    overseas_count: int = 0
    total_spend_cr: float = 0.0
