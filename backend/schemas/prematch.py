from __future__ import annotations

from uuid import UUID

from .base import OurBaseModel
from .match import PlayingXIPlayerOut


class WinProbabilityOut(OurBaseModel):
    team1_id: UUID
    team1_name: str
    team1_win_prob: float
    team2_id: UUID
    team2_name: str
    team2_win_prob: float
    confidence: str
    key_factors: list[str] = []


class PlayingXIRecommendationOut(OurBaseModel):
    recommended_xi: list[PlayingXIPlayerOut]
    total_ai_score: float
    overseas_count: int
    bowling_options: int
    win_probability_estimate: float | None = None
    reasoning: str
    impact_player_recommendation: PlayingXIPlayerOut | None = None


class MatchupCellOut(OurBaseModel):
    batter_id: UUID
    batter_name: str
    bowler_id: UUID
    bowler_name: str
    phase: str
    balls_faced: int
    strike_rate: float
    wicket_probability: float
    boundary_probability: float
    confidence: str
    advantage: str  # "Batter" | "Bowler" | "Neutral"


class MatchupMatrixOut(OurBaseModel):
    phase: str
    matchups: list[MatchupCellOut] = []
    danger_matchups: list[MatchupCellOut] = []   # Batters who dominate opposing bowlers
    key_threats: list[MatchupCellOut] = []        # Bowlers who trouble opposing batters


class TossRecommendationOut(OurBaseModel):
    recommended_decision: str  # "Bat" or "Field"
    reasoning: str
    win_prob_if_bat: float
    win_prob_if_field: float
    venue_batting_first_win_pct: float
    dew_factor: bool


class PhaseStrategyOut(OurBaseModel):
    phase: str
    batting_target_score: int | None = None
    batting_approach: str
    key_batters: list[str] = []
    bowling_allocation: list[dict] = []
    key_bowlers: list[str] = []
    tactical_notes: str
