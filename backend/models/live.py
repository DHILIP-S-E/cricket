from sqlalchemy import Column, Integer, Boolean, Numeric, ForeignKey, DateTime, func, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid

from .base import Base


class LiveMatchState(Base):
    __tablename__ = "live_match_states"

    id                      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id                = Column(UUID(as_uuid=True), ForeignKey("matches.id"), nullable=False)
    innings_number          = Column(Integer, nullable=False)
    current_over            = Column(Integer, nullable=False, default=0)
    current_ball            = Column(Integer, nullable=False, default=0)
    batting_team_id         = Column(UUID(as_uuid=True), ForeignKey("franchises.id"), nullable=False)
    bowling_team_id         = Column(UUID(as_uuid=True), ForeignKey("franchises.id"), nullable=False)
    batting_team_score      = Column(Integer, nullable=False, default=0)
    batting_team_wickets    = Column(Integer, nullable=False, default=0)
    current_run_rate        = Column(Numeric(5, 2), nullable=False, default=0)
    required_run_rate       = Column(Numeric(5, 2))
    target_runs             = Column(Integer)
    runs_required           = Column(Integer)
    balls_remaining         = Column(Integer)
    striker_id              = Column(UUID(as_uuid=True), ForeignKey("players.id"))
    non_striker_id          = Column(UUID(as_uuid=True), ForeignKey("players.id"))
    current_bowler_id       = Column(UUID(as_uuid=True), ForeignKey("players.id"))
    win_probability         = Column(Numeric(5, 4))
    momentum                = Column(String(20))
    last_ball_event         = Column(JSONB)
    updated_at              = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_at              = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    match           = relationship("Match")
    batting_team    = relationship("Franchise", foreign_keys=[batting_team_id])
    bowling_team    = relationship("Franchise", foreign_keys=[bowling_team_id])
    striker         = relationship("Player", foreign_keys=[striker_id])
    non_striker     = relationship("Player", foreign_keys=[non_striker_id])
    current_bowler  = relationship("Player", foreign_keys=[current_bowler_id])


class LiveBatterState(Base):
    __tablename__ = "live_batter_states"
    __table_args__ = (UniqueConstraint("match_id", "player_id"),)

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id            = Column(UUID(as_uuid=True), ForeignKey("matches.id"), nullable=False)
    player_id           = Column(UUID(as_uuid=True), ForeignKey("players.id"), nullable=False)
    runs_scored         = Column(Integer, nullable=False, default=0)
    balls_faced         = Column(Integer, nullable=False, default=0)
    fours               = Column(Integer, nullable=False, default=0)
    sixes               = Column(Integer, nullable=False, default=0)
    current_strike_rate = Column(Numeric(6, 2))
    is_on_strike        = Column(Boolean, nullable=False, default=False)
    dots_in_row         = Column(Integer, nullable=False, default=0)
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_at          = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    player = relationship("Player")


class LiveBowlerState(Base):
    __tablename__ = "live_bowler_states"
    __table_args__ = (UniqueConstraint("match_id", "player_id"),)

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id            = Column(UUID(as_uuid=True), ForeignKey("matches.id"), nullable=False)
    player_id           = Column(UUID(as_uuid=True), ForeignKey("players.id"), nullable=False)
    overs_bowled        = Column(Numeric(4, 1), nullable=False, default=0)
    runs_conceded       = Column(Integer, nullable=False, default=0)
    wickets             = Column(Integer, nullable=False, default=0)
    current_economy     = Column(Numeric(5, 2))
    overs_remaining     = Column(Numeric(4, 1))
    is_current_bowler   = Column(Boolean, nullable=False, default=False)
    last_over_runs      = Column(Integer)
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_at          = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    player = relationship("Player")


class LivePartnershipState(Base):
    __tablename__ = "live_partnership_states"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id        = Column(UUID(as_uuid=True), ForeignKey("matches.id"), nullable=False)
    batter1_id      = Column(UUID(as_uuid=True), ForeignKey("players.id"), nullable=False)
    batter2_id      = Column(UUID(as_uuid=True), ForeignKey("players.id"), nullable=False)
    wicket_number   = Column(Integer, nullable=False)
    runs            = Column(Integer, nullable=False, default=0)
    balls           = Column(Integer, nullable=False, default=0)
    run_rate        = Column(Numeric(5, 2))
    batter1_runs    = Column(Integer, nullable=False, default=0)
    batter2_runs    = Column(Integer, nullable=False, default=0)
    is_active       = Column(Boolean, nullable=False, default=True)
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    batter1 = relationship("Player", foreign_keys=[batter1_id])
    batter2 = relationship("Player", foreign_keys=[batter2_id])
