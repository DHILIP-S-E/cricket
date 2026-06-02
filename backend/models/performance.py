from sqlalchemy import (
    Column, Integer, Boolean, Numeric, ForeignKey,
    DateTime, func, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from .base import Base, sa_enum
from .match import WicketTypeEnum


class BattingPerformance(Base):
    __tablename__ = "batting_performances"
    __table_args__ = (UniqueConstraint("innings_id", "player_id"),)

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id            = Column(UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    innings_id          = Column(UUID(as_uuid=True), ForeignKey("innings.id", ondelete="CASCADE"), nullable=False)
    player_id           = Column(UUID(as_uuid=True), ForeignKey("players.id"), nullable=False)
    franchise_id        = Column(UUID(as_uuid=True), ForeignKey("franchises.id"), nullable=False)
    batting_position    = Column(Integer, nullable=False)
    runs_scored         = Column(Integer, nullable=False, default=0)
    balls_faced         = Column(Integer, nullable=False, default=0)
    fours               = Column(Integer, nullable=False, default=0)
    sixes               = Column(Integer, nullable=False, default=0)
    strike_rate         = Column(Numeric(6, 2))
    is_not_out          = Column(Boolean, nullable=False, default=False)
    dismissal_type      = Column(sa_enum(WicketTypeEnum, name="wicket_type_enum"))
    dismissed_by_id     = Column(UUID(as_uuid=True), ForeignKey("players.id"))
    caught_by_id        = Column(UUID(as_uuid=True), ForeignKey("players.id"))
    powerplay_runs      = Column(Integer, nullable=False, default=0)
    powerplay_balls     = Column(Integer, nullable=False, default=0)
    middle_overs_runs   = Column(Integer, nullable=False, default=0)
    middle_overs_balls  = Column(Integer, nullable=False, default=0)
    death_overs_runs    = Column(Integer, nullable=False, default=0)
    death_overs_balls   = Column(Integer, nullable=False, default=0)
    created_at          = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    player      = relationship("Player", foreign_keys=[player_id])
    dismissed_by = relationship("Player", foreign_keys=[dismissed_by_id])
    caught_by   = relationship("Player", foreign_keys=[caught_by_id])


class BowlingPerformance(Base):
    __tablename__ = "bowling_performances"
    __table_args__ = (UniqueConstraint("innings_id", "player_id"),)

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id            = Column(UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    innings_id          = Column(UUID(as_uuid=True), ForeignKey("innings.id", ondelete="CASCADE"), nullable=False)
    player_id           = Column(UUID(as_uuid=True), ForeignKey("players.id"), nullable=False)
    franchise_id        = Column(UUID(as_uuid=True), ForeignKey("franchises.id"), nullable=False)
    overs_bowled        = Column(Numeric(4, 1), nullable=False, default=0)
    maidens             = Column(Integer, nullable=False, default=0)
    runs_conceded       = Column(Integer, nullable=False, default=0)
    wickets             = Column(Integer, nullable=False, default=0)
    economy             = Column(Numeric(5, 2))
    dots                = Column(Integer, nullable=False, default=0)
    fours_conceded      = Column(Integer, nullable=False, default=0)
    sixes_conceded      = Column(Integer, nullable=False, default=0)
    wides               = Column(Integer, nullable=False, default=0)
    no_balls            = Column(Integer, nullable=False, default=0)
    powerplay_overs     = Column(Numeric(4, 1), nullable=False, default=0)
    powerplay_runs      = Column(Integer, nullable=False, default=0)
    powerplay_wickets   = Column(Integer, nullable=False, default=0)
    death_overs         = Column(Numeric(4, 1), nullable=False, default=0)
    death_runs          = Column(Integer, nullable=False, default=0)
    death_wickets       = Column(Integer, nullable=False, default=0)
    created_at          = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    player = relationship("Player", foreign_keys=[player_id])


class FieldingPerformance(Base):
    __tablename__ = "fielding_performances"
    __table_args__ = (UniqueConstraint("innings_id", "player_id"),)

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id            = Column(UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    innings_id          = Column(UUID(as_uuid=True), ForeignKey("innings.id", ondelete="CASCADE"), nullable=False)
    player_id           = Column(UUID(as_uuid=True), ForeignKey("players.id"), nullable=False)
    catches             = Column(Integer, nullable=False, default=0)
    run_outs_direct     = Column(Integer, nullable=False, default=0)
    run_outs_indirect   = Column(Integer, nullable=False, default=0)
    stumpings           = Column(Integer, nullable=False, default=0)
    dropped_catches     = Column(Integer, nullable=False, default=0)
    created_at          = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    player = relationship("Player", foreign_keys=[player_id])


class PartnershipRecord(Base):
    __tablename__ = "partnership_records"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    innings_id      = Column(UUID(as_uuid=True), ForeignKey("innings.id", ondelete="CASCADE"), nullable=False)
    batter1_id      = Column(UUID(as_uuid=True), ForeignKey("players.id"), nullable=False)
    batter2_id      = Column(UUID(as_uuid=True), ForeignKey("players.id"), nullable=False)
    wicket_number   = Column(Integer, nullable=False)
    runs            = Column(Integer, nullable=False, default=0)
    balls           = Column(Integer, nullable=False, default=0)
    run_rate        = Column(Numeric(5, 2))
    batter1_runs    = Column(Integer, nullable=False, default=0)
    batter2_runs    = Column(Integer, nullable=False, default=0)
    created_at      = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    batter1 = relationship("Player", foreign_keys=[batter1_id])
    batter2 = relationship("Player", foreign_keys=[batter2_id])
