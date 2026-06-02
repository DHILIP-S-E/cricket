import enum
from sqlalchemy import Column, String, Integer, Boolean, Numeric, ForeignKey, Text, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from .base import Base, TimestampMixin, sa_enum


class PitchTypeEnum(str, enum.Enum):
    BattingFriendly = "Batting-friendly"
    BowlingFriendly = "Bowling-friendly"
    Balanced = "Balanced"
    SpinFriendly = "Spin-friendly"
    PaceFriendly = "Pace-friendly"


class Venue(Base, TimestampMixin):
    __tablename__ = "venues"

    id                          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name                        = Column(String(150), nullable=False)
    city                        = Column(String(100), nullable=False)
    country                     = Column(String(60), nullable=False)
    capacity                    = Column(Integer)
    avg_first_innings_score     = Column(Numeric(6, 2))
    avg_second_innings_score    = Column(Numeric(6, 2))
    pace_assistance_rating      = Column(Numeric(4, 2))
    spin_assistance_rating      = Column(Numeric(4, 2))
    dew_probability             = Column(Numeric(4, 3))
    boundary_short_side_m       = Column(Integer)
    boundary_long_side_m        = Column(Integer)
    powerplay_avg_score         = Column(Numeric(6, 2))
    death_overs_avg_per_over    = Column(Numeric(4, 2))
    latitude                    = Column(Numeric(9, 6))
    longitude                   = Column(Numeric(9, 6))
    timezone                    = Column(String(50))

    pitch_profiles  = relationship("VenuePitchProfile", back_populates="venue", lazy="select")
    matches         = relationship("Match", back_populates="venue", lazy="select")
    franchises      = relationship("Franchise", back_populates="home_venue", lazy="select")


class VenuePitchProfile(Base, TimestampMixin):
    __tablename__ = "venue_pitch_profiles"

    id                      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    venue_id                = Column(UUID(as_uuid=True), ForeignKey("venues.id"), nullable=False)
    season_year             = Column(Integer)
    pitch_type              = Column(sa_enum(PitchTypeEnum, "pitch_type_enum"), nullable=False)
    matches_analysed        = Column(Integer, nullable=False, default=0)
    avg_first_innings_score = Column(Numeric(6, 2))
    avg_wickets_per_innings = Column(Numeric(4, 2))
    pace_wicket_pct         = Column(Numeric(5, 2))
    spin_wicket_pct         = Column(Numeric(5, 2))
    powerplay_avg_score     = Column(Numeric(6, 2))
    death_avg_per_over      = Column(Numeric(4, 2))
    batting_first_win_pct   = Column(Numeric(5, 2))
    computed_at             = Column(DateTime(timezone=True), server_default=func.now())

    venue = relationship("Venue", back_populates="pitch_profiles")


class PitchReport(Base):
    __tablename__ = "pitch_reports"

    id                      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id                = Column(UUID(as_uuid=True), ForeignKey("matches.id"), nullable=False)
    venue_id                = Column(UUID(as_uuid=True), ForeignKey("venues.id"), nullable=False)
    report_time             = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    pitch_type              = Column(sa_enum(PitchTypeEnum, "pitch_type_enum"), nullable=False)
    pace_assistance_rating  = Column(Numeric(4, 2))
    spin_assistance_rating  = Column(Numeric(4, 2))
    bounce_rating           = Column(Numeric(4, 2))
    dew_expected            = Column(Boolean, nullable=False, default=False)
    first_innings_par_score = Column(Integer)
    curator_name            = Column(String(100))
    expert_analysis         = Column(Text)
    raw_notes               = Column(Text)
    created_at              = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
