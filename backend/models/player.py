import enum
from sqlalchemy import (
    Column, String, Integer, Boolean, Date, Numeric, ForeignKey,
    DateTime, func, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from .base import Base, TimestampMixin, sa_enum


class NationalityEnum(str, enum.Enum):
    India = "India"
    Australia = "Australia"
    England = "England"
    WestIndies = "West Indies"
    NewZealand = "New Zealand"
    SouthAfrica = "South Africa"
    Pakistan = "Pakistan"
    SriLanka = "Sri Lanka"
    Bangladesh = "Bangladesh"
    Afghanistan = "Afghanistan"
    Zimbabwe = "Zimbabwe"
    Ireland = "Ireland"
    Netherlands = "Netherlands"
    Scotland = "Scotland"
    UAE = "UAE"
    Other = "Other"


class PlayingRoleEnum(str, enum.Enum):
    TopOrderBatter = "Top-order Batter"
    MiddleOrderBatter = "Middle-order Batter"
    BattingAllRounder = "Batting All-rounder"
    BowlingAllRounder = "Bowling All-rounder"
    WicketKeeperBatter = "Wicket-keeper Batter"
    PaceBowler = "Pace Bowler"
    SpinBowler = "Spin Bowler"


class BattingStyleEnum(str, enum.Enum):
    RightHand = "Right-hand"
    LeftHand = "Left-hand"


class BowlingStyleEnum(str, enum.Enum):
    RightArmFast = "Right-arm Fast"
    RightArmMedium = "Right-arm Medium"
    LeftArmFast = "Left-arm Fast"
    RightArmOffbreak = "Right-arm Offbreak"
    LeftArmOrthodox = "Left-arm Orthodox"
    LegSpin = "Leg-spin"
    Nobowling = "None"


class DomesticLeagueEnum(str, enum.Enum):
    TNPL = "TNPL"
    KPL = "KPL"
    MPL = "MPL"
    Ranji = "Ranji"
    VijayHazare = "Vijay Hazare"
    SyedMushtaqAli = "Syed Mushtaq Ali"
    BBL = "BBL"
    PSL = "PSL"
    CPL = "CPL"
    DuleepTrophy = "Duleep Trophy"
    Other = "Other"


class RiskLevelEnum(str, enum.Enum):
    Low = "Low"
    Medium = "Medium"
    High = "High"


class Player(Base, TimestampMixin):
    __tablename__ = "players"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name           = Column(String(150), nullable=False)
    display_name        = Column(String(100))
    nationality         = Column(sa_enum(NationalityEnum, "nationality_enum"), nullable=False)
    date_of_birth       = Column(Date)
    playing_role        = Column(sa_enum(PlayingRoleEnum, "playing_role_enum"), nullable=False)
    batting_style       = Column(sa_enum(BattingStyleEnum, "batting_style_enum"), nullable=False, default=BattingStyleEnum.RightHand)
    bowling_style       = Column(sa_enum(BowlingStyleEnum, "bowling_style_enum"), nullable=False, default=BowlingStyleEnum.Nobowling)
    ipl_caps            = Column(Integer, nullable=False, default=0)
    international_caps  = Column(Integer, nullable=False, default=0)
    domestic_league     = Column(sa_enum(DomesticLeagueEnum, "domestic_league_enum"))
    injury_prone_flag   = Column(Boolean, nullable=False, default=False)
    is_active           = Column(Boolean, nullable=False, default=True)
    photo_url           = Column(String(500))
    cricsheet_id        = Column(String(50), unique=True)
    espn_id             = Column(String(50), unique=True)
    cricbuzz_id         = Column(String(50), unique=True)

    career_stats        = relationship("PlayerCareerStats", back_populates="player", uselist=False)
    season_stats        = relationship("PlayerSeasonStats", back_populates="player")
    form_records        = relationship("PlayerForm", back_populates="player", order_by="PlayerForm.computed_at.desc()")
    injury_records      = relationship("PlayerInjuryRecord", back_populates="player")
    workload            = relationship("PlayerWorkload", back_populates="player")
    rating              = relationship("PlayerRating", back_populates="player", uselist=False)
    valuations          = relationship("PlayerValuation", back_populates="player")
    matchups_as_batter  = relationship("PlayerMatchup", foreign_keys="PlayerMatchup.batter_id", back_populates="batter")
    matchups_as_bowler  = relationship("PlayerMatchup", foreign_keys="PlayerMatchup.bowler_id", back_populates="bowler")
    scouting_reports    = relationship("ScoutingReport", back_populates="player")


class PlayerCareerStats(Base, TimestampMixin):
    __tablename__ = "player_career_stats"
    __table_args__ = (UniqueConstraint("player_id", "format"),)

    id                          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    player_id                   = Column(UUID(as_uuid=True), ForeignKey("players.id", ondelete="CASCADE"), nullable=False)
    format                      = Column(String(20), nullable=False, default="T20")
    batting_innings             = Column(Integer, nullable=False, default=0)
    batting_not_outs            = Column(Integer, nullable=False, default=0)
    batting_runs                = Column(Integer, nullable=False, default=0)
    batting_avg                 = Column(Numeric(6, 2))
    batting_strike_rate         = Column(Numeric(6, 2))
    batting_50s                 = Column(Integer, nullable=False, default=0)
    batting_100s                = Column(Integer, nullable=False, default=0)
    batting_highest_score       = Column(Integer)
    bowling_innings             = Column(Integer, nullable=False, default=0)
    bowling_wickets             = Column(Integer, nullable=False, default=0)
    bowling_avg                 = Column(Numeric(6, 2))
    bowling_economy             = Column(Numeric(5, 2))
    bowling_strike_rate         = Column(Numeric(6, 2))
    bowling_best_figures        = Column(String(10))
    catches                     = Column(Integer, nullable=False, default=0)
    run_outs                    = Column(Integer, nullable=False, default=0)
    stumpings                   = Column(Integer, nullable=False, default=0)
    powerplay_batting_avg       = Column(Numeric(6, 2))
    powerplay_bowling_economy   = Column(Numeric(5, 2))
    death_batting_strike_rate   = Column(Numeric(6, 2))
    death_bowling_economy       = Column(Numeric(5, 2))
    last_computed_at            = Column(DateTime(timezone=True), server_default=func.now())

    player = relationship("Player", back_populates="career_stats")


class PlayerSeasonStats(Base, TimestampMixin):
    __tablename__ = "player_season_stats"
    __table_args__ = (UniqueConstraint("player_id", "season_id"),)

    id                      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    player_id               = Column(UUID(as_uuid=True), ForeignKey("players.id", ondelete="CASCADE"), nullable=False)
    season_id               = Column(UUID(as_uuid=True), ForeignKey("seasons.id"), nullable=False)
    franchise_id            = Column(UUID(as_uuid=True), ForeignKey("franchises.id"))
    matches_played          = Column(Integer, nullable=False, default=0)
    batting_runs            = Column(Integer, nullable=False, default=0)
    batting_avg             = Column(Numeric(6, 2))
    batting_strike_rate     = Column(Numeric(6, 2))
    bowling_wickets         = Column(Integer, nullable=False, default=0)
    bowling_economy         = Column(Numeric(5, 2))
    bowling_avg             = Column(Numeric(6, 2))
    player_of_match_count   = Column(Integer, nullable=False, default=0)

    player  = relationship("Player", back_populates="season_stats")
    season  = relationship("Season")


class PlayerForm(Base):
    __tablename__ = "player_form"

    id                      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    player_id               = Column(UUID(as_uuid=True), ForeignKey("players.id", ondelete="CASCADE"), nullable=False)
    last_n_matches          = Column(Integer, nullable=False, default=5)
    form_score              = Column(Numeric(5, 4), nullable=False)
    batting_avg_recent      = Column(Numeric(6, 2))
    bowling_avg_recent      = Column(Numeric(6, 2))
    economy_recent          = Column(Numeric(5, 2))
    strike_rate_recent      = Column(Numeric(6, 2))
    computed_at             = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at              = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    player = relationship("Player", back_populates="form_records")


class PlayerInjuryRecord(Base, TimestampMixin):
    __tablename__ = "player_injury_records"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    player_id       = Column(UUID(as_uuid=True), ForeignKey("players.id", ondelete="CASCADE"), nullable=False)
    injury_type     = Column(String(100), nullable=False)
    body_part       = Column(String(100))
    injury_date     = Column(Date, nullable=False)
    recovery_date   = Column(Date)
    matches_missed  = Column(Integer)
    severity        = Column(String(20))
    source          = Column(String(200))
    notes           = Column(String(1000))

    player = relationship("Player", back_populates="injury_records")


class PlayerWorkload(Base):
    __tablename__ = "player_workload"

    id                          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    player_id                   = Column(UUID(as_uuid=True), ForeignKey("players.id", ondelete="CASCADE"), nullable=False)
    season_id                   = Column(UUID(as_uuid=True), ForeignKey("seasons.id"))
    matches_last_30_days        = Column(Integer, nullable=False, default=0)
    overs_bowled_last_30_days   = Column(Numeric(5, 1), nullable=False, default=0)
    rest_days_since_last_match  = Column(Integer)
    travel_km_last_30_days      = Column(Integer)
    injury_risk_score           = Column(Numeric(4, 3))
    risk_level                  = Column(sa_enum(RiskLevelEnum, "risk_level_enum"))
    computed_at                 = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at                  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    player = relationship("Player", back_populates="workload")


class PlayerRating(Base, TimestampMixin):
    __tablename__ = "player_ratings"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    player_id           = Column(UUID(as_uuid=True), ForeignKey("players.id", ondelete="CASCADE"), nullable=False, unique=True)
    overall_rating      = Column(Numeric(5, 2), nullable=False)
    batting_rating      = Column(Numeric(5, 2))
    bowling_rating      = Column(Numeric(5, 2))
    fielding_rating     = Column(Numeric(5, 2))
    powerplay_rating    = Column(Numeric(5, 2))
    death_overs_rating  = Column(Numeric(5, 2))
    potential_rating    = Column(Numeric(5, 2))
    model_version       = Column(String(20))
    computed_at         = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    player = relationship("Player", back_populates="rating")


class PlayerValuation(Base):
    __tablename__ = "player_valuations"

    id                          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    player_id                   = Column(UUID(as_uuid=True), ForeignKey("players.id", ondelete="CASCADE"), nullable=False)
    season_id                   = Column(UUID(as_uuid=True), ForeignKey("seasons.id"))
    fair_market_value_cr        = Column(Numeric(6, 2), nullable=False)
    predicted_auction_price_cr  = Column(Numeric(6, 2))
    confidence_low_cr           = Column(Numeric(6, 2))
    confidence_high_cr          = Column(Numeric(6, 2))
    budget_efficiency_score     = Column(Numeric(5, 4))
    model_version               = Column(String(20))
    computed_at                 = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at                  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    player = relationship("Player", back_populates="valuations")
    season = relationship("Season")
