import enum
from sqlalchemy import Column, String, Integer, Boolean, Numeric, ForeignKey, DateTime, func, Text, UniqueConstraint, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid

from .base import Base, TimestampMixin, sa_enum


class AuctionStatusEnum(str, enum.Enum):
    Pending = "Pending"
    Active = "Active"
    Paused = "Paused"
    Completed = "Completed"


class AuctionSession(Base, TimestampMixin):
    __tablename__ = "auction_sessions"

    id                          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    season_id                   = Column(UUID(as_uuid=True), ForeignKey("seasons.id"), nullable=False)
    name                        = Column(String(100), nullable=False)
    status                      = Column(sa_enum(AuctionStatusEnum, name="auction_status_enum"), nullable=False, default=AuctionStatusEnum.Pending)
    auction_date                = Column(Date)
    location                    = Column(String(100))
    current_lot_player_id       = Column(UUID(as_uuid=True), ForeignKey("players.id"))
    current_base_price_cr       = Column(Numeric(6, 2))
    current_bid_amount_cr       = Column(Numeric(6, 2))
    current_highest_bidder_id   = Column(UUID(as_uuid=True), ForeignKey("franchises.id"))
    total_players_sold          = Column(Integer, nullable=False, default=0)
    total_players_unsold        = Column(Integer, nullable=False, default=0)

    season              = relationship("Season")
    current_lot_player  = relationship("Player", foreign_keys=[current_lot_player_id])
    lots                = relationship("AuctionLot", back_populates="session")
    team_states         = relationship("TeamAuctionState", back_populates="session")
    strategies          = relationship("AuctionStrategy", back_populates="session")


class AuctionLot(Base, TimestampMixin):
    __tablename__ = "auction_lots"
    __table_args__ = (UniqueConstraint("session_id", "player_id"),)

    id                      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id              = Column(UUID(as_uuid=True), ForeignKey("auction_sessions.id", ondelete="CASCADE"), nullable=False)
    player_id               = Column(UUID(as_uuid=True), ForeignKey("players.id"), nullable=False)
    lot_number              = Column(Integer, nullable=False)
    set_number              = Column(Integer)
    base_price_cr           = Column(Numeric(6, 2), nullable=False)
    final_price_cr          = Column(Numeric(6, 2))
    sold_to_franchise_id    = Column(UUID(as_uuid=True), ForeignKey("franchises.id"))
    is_sold                 = Column(Boolean, nullable=False, default=False)
    is_unsold               = Column(Boolean, nullable=False, default=False)
    rtm_used                = Column(Boolean, nullable=False, default=False)
    rtm_franchise_id        = Column(UUID(as_uuid=True), ForeignKey("franchises.id"))
    auction_started_at      = Column(DateTime(timezone=True))
    auction_ended_at        = Column(DateTime(timezone=True))

    session         = relationship("AuctionSession", back_populates="lots")
    player          = relationship("Player")
    sold_to         = relationship("Franchise", foreign_keys=[sold_to_franchise_id])
    bids            = relationship("Bid", back_populates="lot", order_by="Bid.bid_time")


class Bid(Base):
    __tablename__ = "bids"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lot_id          = Column(UUID(as_uuid=True), ForeignKey("auction_lots.id", ondelete="CASCADE"), nullable=False)
    franchise_id    = Column(UUID(as_uuid=True), ForeignKey("franchises.id"), nullable=False)
    bid_amount_cr   = Column(Numeric(6, 2), nullable=False)
    bid_time        = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_rtm          = Column(Boolean, nullable=False, default=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    lot         = relationship("AuctionLot", back_populates="bids")
    franchise   = relationship("Franchise")


class TeamAuctionState(Base):
    __tablename__ = "team_auction_states"
    __table_args__ = (UniqueConstraint("session_id", "franchise_id"),)

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id          = Column(UUID(as_uuid=True), ForeignKey("auction_sessions.id", ondelete="CASCADE"), nullable=False)
    franchise_id        = Column(UUID(as_uuid=True), ForeignKey("franchises.id"), nullable=False)
    initial_purse_cr    = Column(Numeric(8, 2), nullable=False, default=90.0)
    remaining_budget_cr = Column(Numeric(8, 2), nullable=False)
    players_bought      = Column(JSONB, nullable=False, default=list)
    overseas_slots_used = Column(Integer, nullable=False, default=0)
    overseas_slots_max  = Column(Integer, nullable=False, default=4)
    wk_count            = Column(Integer, nullable=False, default=0)
    batter_count        = Column(Integer, nullable=False, default=0)
    bowler_count        = Column(Integer, nullable=False, default=0)
    all_rounder_count   = Column(Integer, nullable=False, default=0)
    squad_size          = Column(Integer, nullable=False, default=0)
    squad_size_max      = Column(Integer, nullable=False, default=25)
    rtm_available       = Column(Boolean, nullable=False, default=False)
    rtm_count           = Column(Integer, nullable=False, default=0)
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_at          = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    session     = relationship("AuctionSession", back_populates="team_states")
    franchise   = relationship("Franchise", back_populates="auction_states")


class AuctionStrategy(Base, TimestampMixin):
    __tablename__ = "auction_strategies"
    __table_args__ = (UniqueConstraint("session_id", "franchise_id", "target_player_id"),)

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id          = Column(UUID(as_uuid=True), ForeignKey("auction_sessions.id"), nullable=False)
    franchise_id        = Column(UUID(as_uuid=True), ForeignKey("franchises.id"), nullable=False)
    target_player_id    = Column(UUID(as_uuid=True), ForeignKey("players.id"), nullable=False)
    priority            = Column(Integer, nullable=False)
    max_bid_cr          = Column(Numeric(6, 2), nullable=False)
    tier                = Column(String(20))
    reasoning           = Column(Text)
    is_acquired         = Column(Boolean, nullable=False, default=False)

    session         = relationship("AuctionSession", back_populates="strategies")
    franchise       = relationship("Franchise")
    target_player   = relationship("Player")
