from sqlalchemy import Column, Integer, Numeric, ForeignKey, DateTime, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from .base import Base, TimestampMixin, sa_enum
from .match import MatchTypeEnum


class PointsTable(Base):
    __tablename__ = "points_table"
    __table_args__ = (UniqueConstraint("season_id", "franchise_id"),)

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    season_id       = Column(UUID(as_uuid=True), ForeignKey("seasons.id"), nullable=False)
    franchise_id    = Column(UUID(as_uuid=True), ForeignKey("franchises.id"), nullable=False)
    matches_played  = Column(Integer, nullable=False, default=0)
    wins            = Column(Integer, nullable=False, default=0)
    losses          = Column(Integer, nullable=False, default=0)
    ties            = Column(Integer, nullable=False, default=0)
    no_results      = Column(Integer, nullable=False, default=0)
    points          = Column(Integer, nullable=False, default=0)
    net_run_rate    = Column(Numeric(6, 4), nullable=False, default=0)
    for_runs        = Column(Integer, nullable=False, default=0)
    for_overs       = Column(Numeric(7, 1), nullable=False, default=0)
    against_runs    = Column(Integer, nullable=False, default=0)
    against_overs   = Column(Numeric(7, 1), nullable=False, default=0)
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    season      = relationship("Season", back_populates="points_table")
    franchise   = relationship("Franchise")


class FixtureSchedule(Base, TimestampMixin):
    __tablename__ = "fixture_schedule"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    season_id       = Column(UUID(as_uuid=True), ForeignKey("seasons.id"), nullable=False)
    match_id        = Column(UUID(as_uuid=True), ForeignKey("matches.id"))
    team1_id        = Column(UUID(as_uuid=True), ForeignKey("franchises.id"), nullable=False)
    team2_id        = Column(UUID(as_uuid=True), ForeignKey("franchises.id"), nullable=False)
    scheduled_date  = Column(DateTime(timezone=True), nullable=False)
    venue_id        = Column(UUID(as_uuid=True), ForeignKey("venues.id"))
    match_number    = Column(Integer)
    match_type      = Column(sa_enum(MatchTypeEnum, name="match_type_enum"))

    season  = relationship("Season")
    match   = relationship("Match")
    team1   = relationship("Franchise", foreign_keys=[team1_id])
    team2   = relationship("Franchise", foreign_keys=[team2_id])
    venue   = relationship("Venue")
