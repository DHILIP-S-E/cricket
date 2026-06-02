import enum
from sqlalchemy import (
    Column, String, Integer, Boolean, Numeric, ForeignKey,
    DateTime, func, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from .base import Base, TimestampMixin, sa_enum
from .venue import PitchTypeEnum


class TossDecisionEnum(str, enum.Enum):
    Bat = "Bat"
    Field = "Field"


class WicketTypeEnum(str, enum.Enum):
    Caught = "Caught"
    Bowled = "Bowled"
    LBW = "LBW"
    RunOut = "Run-out"
    Stumped = "Stumped"
    HitWicket = "Hit Wicket"
    ObstructingField = "Obstructing the field"
    HandledBall = "Handled the ball"
    TimedOut = "Timed out"


class MatchTypeEnum(str, enum.Enum):
    League = "League"
    Qualifier1 = "Qualifier 1"
    Qualifier2 = "Qualifier 2"
    Eliminator = "Eliminator"
    Final = "Final"
    Friendly = "Friendly"


class Match(Base, TimestampMixin):
    __tablename__ = "matches"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    season_id           = Column(UUID(as_uuid=True), ForeignKey("seasons.id"), nullable=False)
    venue_id            = Column(UUID(as_uuid=True), ForeignKey("venues.id"), nullable=False)
    team1_id            = Column(UUID(as_uuid=True), ForeignKey("franchises.id"), nullable=False)
    team2_id            = Column(UUID(as_uuid=True), ForeignKey("franchises.id"), nullable=False)
    match_date          = Column(DateTime(timezone=True), nullable=False)
    match_number        = Column(Integer)
    match_type          = Column(sa_enum(MatchTypeEnum, "match_type_enum"), nullable=False, default=MatchTypeEnum.League)
    toss_winner_id      = Column(UUID(as_uuid=True), ForeignKey("franchises.id"))
    toss_decision       = Column(sa_enum(TossDecisionEnum, "toss_decision_enum"))
    winner_id           = Column(UUID(as_uuid=True), ForeignKey("franchises.id"))
    win_margin_runs     = Column(Integer)
    win_margin_wickets  = Column(Integer)
    no_result           = Column(Boolean, nullable=False, default=False)
    pitch_type          = Column(sa_enum(PitchTypeEnum, "pitch_type_enum"))
    dew_factor          = Column(Boolean, nullable=False, default=False)
    weather_conditions  = Column(String(100))
    umpire1             = Column(String(100))
    umpire2             = Column(String(100))
    match_referee       = Column(String(100))
    cricsheet_match_id  = Column(String(100), unique=True)
    espn_match_id       = Column(String(50), unique=True)
    is_completed        = Column(Boolean, nullable=False, default=False)

    season      = relationship("Season", back_populates="matches")
    venue       = relationship("Venue", back_populates="matches")
    team1       = relationship("Franchise", foreign_keys=[team1_id])
    team2       = relationship("Franchise", foreign_keys=[team2_id])
    toss_winner = relationship("Franchise", foreign_keys=[toss_winner_id])
    winner      = relationship("Franchise", foreign_keys=[winner_id])
    innings     = relationship("Innings", back_populates="match", order_by="Innings.innings_number")
    playing_xi  = relationship("PlayingXI", back_populates="match")
    balls       = relationship("Ball", back_populates="match")
    pitch_reports = relationship("PitchReport", primaryjoin="Match.id == PitchReport.match_id", foreign_keys="PitchReport.match_id")


class Innings(Base, TimestampMixin):
    __tablename__ = "innings"
    __table_args__ = (UniqueConstraint("match_id", "innings_number"),)

    id                      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id                = Column(UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    innings_number          = Column(Integer, nullable=False)
    batting_team_id         = Column(UUID(as_uuid=True), ForeignKey("franchises.id"), nullable=False)
    bowling_team_id         = Column(UUID(as_uuid=True), ForeignKey("franchises.id"), nullable=False)
    total_runs              = Column(Integer, nullable=False, default=0)
    total_wickets           = Column(Integer, nullable=False, default=0)
    total_overs             = Column(Numeric(4, 1), nullable=False, default=0)
    extras                  = Column(Integer, nullable=False, default=0)
    wides                   = Column(Integer, nullable=False, default=0)
    no_balls                = Column(Integer, nullable=False, default=0)
    byes                    = Column(Integer, nullable=False, default=0)
    leg_byes                = Column(Integer, nullable=False, default=0)
    target_runs             = Column(Integer)
    powerplay_runs          = Column(Integer)
    powerplay_wickets       = Column(Integer)
    middle_overs_runs       = Column(Integer)
    middle_overs_wickets    = Column(Integer)
    death_overs_runs        = Column(Integer)
    death_overs_wickets     = Column(Integer)
    is_completed            = Column(Boolean, nullable=False, default=False)

    match           = relationship("Match", back_populates="innings")
    batting_team    = relationship("Franchise", foreign_keys=[batting_team_id])
    bowling_team    = relationship("Franchise", foreign_keys=[bowling_team_id])
    balls           = relationship("Ball", back_populates="innings", order_by="Ball.over_number, Ball.ball_number")


class Ball(Base):
    __tablename__ = "balls"

    id                      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id                = Column(UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    innings_id              = Column(UUID(as_uuid=True), ForeignKey("innings.id", ondelete="CASCADE"), nullable=False)
    innings_number          = Column(Integer, nullable=False)
    over_number             = Column(Integer, nullable=False)
    ball_number             = Column(Integer, nullable=False)
    batter_id               = Column(UUID(as_uuid=True), ForeignKey("players.id"), nullable=False)
    bowler_id               = Column(UUID(as_uuid=True), ForeignKey("players.id"), nullable=False)
    non_striker_id          = Column(UUID(as_uuid=True), ForeignKey("players.id"))
    runs_off_bat            = Column(Integer, nullable=False, default=0)
    extras_runs             = Column(Integer, nullable=False, default=0)
    extras_type             = Column(String(20))
    is_wicket               = Column(Boolean, nullable=False, default=False)
    wicket_type             = Column(sa_enum(WicketTypeEnum, "wicket_type_enum"))
    dismissed_player_id     = Column(UUID(as_uuid=True), ForeignKey("players.id"))
    fielder_id              = Column(UUID(as_uuid=True), ForeignKey("players.id"))
    shot_type               = Column(String(50))
    line                    = Column(String(30))
    length                  = Column(String(30))
    speed_kmh               = Column(Numeric(5, 1))
    is_powerplay            = Column(Boolean, nullable=False, default=False)
    is_middle_overs         = Column(Boolean, nullable=False, default=False)
    is_death_overs          = Column(Boolean, nullable=False, default=False)
    cumulative_score        = Column(Integer, nullable=False, default=0)
    cumulative_wickets      = Column(Integer, nullable=False, default=0)
    required_runs           = Column(Integer)
    balls_remaining         = Column(Integer)
    win_probability_after   = Column(Numeric(5, 4))
    created_at              = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    match       = relationship("Match", back_populates="balls")
    innings     = relationship("Innings", back_populates="balls")
    batter      = relationship("Player", foreign_keys=[batter_id])
    bowler      = relationship("Player", foreign_keys=[bowler_id])
    non_striker = relationship("Player", foreign_keys=[non_striker_id])
    dismissed   = relationship("Player", foreign_keys=[dismissed_player_id])


class PlayingXI(Base, TimestampMixin):
    __tablename__ = "playing_xi"
    __table_args__ = (UniqueConstraint("match_id", "franchise_id", "player_id"),)

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id        = Column(UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    franchise_id    = Column(UUID(as_uuid=True), ForeignKey("franchises.id"), nullable=False)
    player_id       = Column(UUID(as_uuid=True), ForeignKey("players.id"), nullable=False)
    batting_position = Column(Integer)
    is_captain      = Column(Boolean, nullable=False, default=False)
    is_vice_captain = Column(Boolean, nullable=False, default=False)
    is_wicketkeeper = Column(Boolean, nullable=False, default=False)
    is_impact_player = Column(Boolean, nullable=False, default=False)

    match       = relationship("Match", back_populates="playing_xi")
    franchise   = relationship("Franchise")
    player      = relationship("Player")
