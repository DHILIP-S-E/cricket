from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from .base import OurBaseModel


class PlayerOut(OurBaseModel):
    id: UUID
    full_name: str
    display_name: str | None = None
    nationality: str
    date_of_birth: date | None = None
    playing_role: str
    batting_style: str
    bowling_style: str
    ipl_caps: int
    international_caps: int
    is_active: bool
    photo_url: str | None = None
    cricsheet_id: str | None = None


class PlayerCareerStatsOut(OurBaseModel):
    format: str
    batting_innings: int
    batting_runs: int
    batting_avg: float | None = None
    batting_strike_rate: float | None = None
    batting_50s: int
    batting_100s: int
    batting_highest_score: int | None = None
    bowling_wickets: int
    bowling_avg: float | None = None
    bowling_economy: float | None = None
    bowling_strike_rate: float | None = None
    bowling_best_figures: str | None = None
    catches: int
    run_outs: int
    stumpings: int
    last_computed_at: datetime | None = None


class PlayerFormOut(OurBaseModel):
    last_n_matches: int
    form_score: float
    batting_avg_recent: float | None = None
    strike_rate_recent: float | None = None
    bowling_avg_recent: float | None = None
    economy_recent: float | None = None
    computed_at: datetime


class PlayerRatingOut(OurBaseModel):
    overall_rating: float
    batting_rating: float | None = None
    bowling_rating: float | None = None
    fielding_rating: float | None = None
    powerplay_rating: float | None = None
    death_overs_rating: float | None = None
    potential_rating: float | None = None
    computed_at: datetime


class PlayerValuationOut(OurBaseModel):
    fair_market_value_cr: float
    predicted_auction_price_cr: float | None = None
    confidence_low_cr: float | None = None
    confidence_high_cr: float | None = None
    budget_efficiency_score: float | None = None
    model_version: str | None = None
    computed_at: datetime


class PlayerProfileOut(PlayerOut):
    career_stats: PlayerCareerStatsOut | None = None
    form: PlayerFormOut | None = None
    rating: PlayerRatingOut | None = None
    valuation: PlayerValuationOut | None = None


class PlayerMatchupOut(OurBaseModel):
    batter_id: UUID
    bowler_id: UUID
    phase: str
    balls_faced: int
    runs_scored: int
    dismissals: int
    strike_rate: float | None = None
    dismissal_rate: float | None = None
    boundary_rate: float | None = None
    dot_ball_rate: float | None = None
    smoothed_strike_rate: float | None = None
    smoothed_wicket_prob: float | None = None
    smoothed_boundary_prob: float | None = None
    confidence_level: str


class PlayerSearchParams(OurBaseModel):
    q: str | None = None
    playing_role: str | None = None
    nationality: str | None = None
    min_ipl_caps: int | None = None
    is_active: bool | None = True
    page: int = 1
    size: int = 20
