from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from .base import OurBaseModel
from .player import PlayerOut


class TeamAuctionStateOut(OurBaseModel):
    franchise_id: UUID
    franchise_name: str
    franchise_short_name: str
    initial_purse_cr: float
    remaining_budget_cr: float
    squad_size: int
    squad_size_max: int
    overseas_slots_used: int
    overseas_slots_max: int
    wk_count: int
    batter_count: int
    bowler_count: int
    all_rounder_count: int
    rtm_available: bool
    rtm_count: int
    players_bought: list[dict] = []


class AuctionLotOut(OurBaseModel):
    id: UUID
    lot_number: int
    set_number: int | None = None
    player: PlayerOut
    base_price_cr: float
    final_price_cr: float | None = None
    is_sold: bool
    is_unsold: bool
    sold_to_franchise_id: UUID | None = None
    sold_to_franchise_name: str | None = None
    rtm_used: bool


class BidOut(OurBaseModel):
    id: UUID
    franchise_id: UUID
    franchise_short_name: str
    bid_amount_cr: float
    bid_time: datetime
    is_rtm: bool


class AuctionSessionOut(OurBaseModel):
    id: UUID
    season_id: UUID
    name: str
    status: str
    auction_date: datetime | None = None
    total_players_sold: int
    total_players_unsold: int
    current_lot: AuctionLotOut | None = None
    current_bid_amount_cr: float | None = None
    current_highest_bidder_id: UUID | None = None


class BidRecommendationOut(OurBaseModel):
    player_id: UUID
    player_name: str
    fair_value_cr: float
    recommended_max_bid_cr: float
    confidence_low_cr: float
    confidence_high_cr: float
    confidence: str
    should_bid: bool
    reasoning: str
    budget_after_bid_cr: float
    squad_impact: str  # How this player improves the squad
    alternatives: list[dict] = []  # Top 3 alternative players if this one goes over max


class BidIn(OurBaseModel):
    lot_id: UUID
    franchise_id: UUID
    bid_amount_cr: float = Field(..., gt=0, le=200)
    is_rtm: bool = False


class AuctionQueueItem(OurBaseModel):
    lot_number: int
    player: PlayerOut
    base_price_cr: float
    ai_value_estimate_cr: float | None = None
    priority_for_franchise: str | None = None  # Must-have / High-value / Monitor
