from __future__ import annotations

from datetime import datetime
from uuid import UUID

from .base import OurBaseModel


class VenueOut(OurBaseModel):
    id: UUID
    name: str
    city: str
    country: str
    avg_first_innings_score: float | None = None
    pace_assistance_rating: float | None = None
    spin_assistance_rating: float | None = None


class FranchiseOut(OurBaseModel):
    id: UUID
    name: str
    short_name: str
    logo_url: str | None = None
    primary_color: str | None = None


class MatchOut(OurBaseModel):
    id: UUID
    season_id: UUID
    venue: VenueOut
    team1: FranchiseOut
    team2: FranchiseOut
    match_date: datetime
    match_number: int | None = None
    match_type: str
    toss_winner: FranchiseOut | None = None
    toss_decision: str | None = None
    winner: FranchiseOut | None = None
    win_margin_runs: int | None = None
    win_margin_wickets: int | None = None
    no_result: bool
    pitch_type: str | None = None
    is_completed: bool


class InningsOut(OurBaseModel):
    id: UUID
    innings_number: int
    batting_team: FranchiseOut
    bowling_team: FranchiseOut
    total_runs: int
    total_wickets: int
    total_overs: float
    extras: int
    target_runs: int | None = None
    powerplay_runs: int | None = None
    powerplay_wickets: int | None = None
    middle_overs_runs: int | None = None
    death_overs_runs: int | None = None
    death_overs_wickets: int | None = None
    is_completed: bool


class PlayingXIPlayerOut(OurBaseModel):
    player_id: UUID
    full_name: str
    playing_role: str
    batting_position: int | None = None
    ai_score: float | None = None
    is_captain: bool
    is_vice_captain: bool
    is_wicketkeeper: bool
    is_impact_player: bool
    is_overseas: bool = False


class BattingPerformanceOut(OurBaseModel):
    player_id: UUID
    full_name: str
    batting_position: int
    runs_scored: int
    balls_faced: int
    fours: int
    sixes: int
    strike_rate: float | None = None
    is_not_out: bool
    dismissal_type: str | None = None


class BowlingPerformanceOut(OurBaseModel):
    player_id: UUID
    full_name: str
    overs_bowled: float
    runs_conceded: int
    wickets: int
    economy: float | None = None
    dots: int
    wides: int
    no_balls: int


class ScorecardOut(OurBaseModel):
    match: MatchOut
    innings: list[InningsOut] = []
    team1_batting: list[BattingPerformanceOut] = []
    team1_bowling: list[BowlingPerformanceOut] = []
    team2_batting: list[BattingPerformanceOut] = []
    team2_bowling: list[BowlingPerformanceOut] = []
