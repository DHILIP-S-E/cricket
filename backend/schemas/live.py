from __future__ import annotations

from datetime import datetime
from uuid import UUID

from .base import OurBaseModel


class LiveBatterOut(OurBaseModel):
    player_id: UUID
    full_name: str
    runs_scored: int
    balls_faced: int
    fours: int
    sixes: int
    strike_rate: float | None = None
    is_on_strike: bool
    dots_in_row: int


class LiveBowlerOut(OurBaseModel):
    player_id: UUID
    full_name: str
    overs_bowled: float
    runs_conceded: int
    wickets: int
    economy: float | None = None
    overs_remaining: float | None = None
    is_current_bowler: bool


class LiveMatchStateOut(OurBaseModel):
    match_id: UUID
    innings_number: int
    current_over: int
    current_ball: int
    batting_team_id: UUID
    batting_team_name: str
    bowling_team_id: UUID
    bowling_team_name: str
    batting_team_score: int
    batting_team_wickets: int
    current_run_rate: float
    required_run_rate: float | None = None
    target_runs: int | None = None
    runs_required: int | None = None
    balls_remaining: int | None = None
    win_probability: float | None = None
    momentum: str | None = None
    striker: LiveBatterOut | None = None
    non_striker: LiveBatterOut | None = None
    current_bowler: LiveBowlerOut | None = None
    updated_at: datetime


class BowlerRecommendationOut(OurBaseModel):
    recommended_bowler_id: UUID
    recommended_bowler_name: str
    expected_runs_this_over: float
    wicket_probability: float
    confidence: str
    reasoning: str
    alternatives: list[dict] = []


class WinProbabilityHistoryPoint(OurBaseModel):
    over_number: int
    ball_number: int
    batting_team_win_prob: float
    score: int
    wickets: int


class LiveRecommendationsOut(OurBaseModel):
    match_id: UUID
    win_probability: float
    momentum: str
    bowler_recommendation: BowlerRecommendationOut | None = None
    batting_risk_level: int  # 1–10
    batting_strategy: str
    field_placement_note: str | None = None
    alert: str | None = None  # e.g. "Danger partnership: 50+ runs"


class BallEventIn(OurBaseModel):
    match_id: UUID
    innings_number: int
    over_number: int
    ball_number: int
    batter_id: UUID
    bowler_id: UUID
    non_striker_id: UUID | None = None
    runs_off_bat: int = 0
    extras_runs: int = 0
    extras_type: str | None = None
    is_wicket: bool = False
    wicket_type: str | None = None
    dismissed_player_id: UUID | None = None
