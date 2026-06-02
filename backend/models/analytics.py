import enum
from sqlalchemy import Column, String, Integer, Boolean, Numeric, ForeignKey, DateTime, func, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid

from .base import Base, sa_enum


class ConfidenceLevelEnum(str, enum.Enum):
    Low = "Low"
    Medium = "Medium"
    High = "High"


class PhaseTypeEnum(str, enum.Enum):
    Powerplay = "Powerplay"
    Middle = "Middle"
    Death = "Death"
    All = "All"


class RecommendationTypeEnum(str, enum.Enum):
    BidRecommendation = "BidRecommendation"
    PlayingXI = "PlayingXI"
    BowlerChange = "BowlerChange"
    BattingStrategy = "BattingStrategy"
    FieldPlacement = "FieldPlacement"
    TossDecision = "TossDecision"
    ImpactPlayer = "ImpactPlayer"
    BowlingAllocation = "BowlingAllocation"


class PlayerMatchup(Base):
    __tablename__ = "player_matchups"
    __table_args__ = (UniqueConstraint("batter_id", "bowler_id", "phase"),)

    id                      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batter_id               = Column(UUID(as_uuid=True), ForeignKey("players.id"), nullable=False)
    bowler_id               = Column(UUID(as_uuid=True), ForeignKey("players.id"), nullable=False)
    phase                   = Column(sa_enum(PhaseTypeEnum, name="phase_type_enum"), nullable=False, default=PhaseTypeEnum.All)
    balls_faced             = Column(Integer, nullable=False, default=0)
    runs_scored             = Column(Integer, nullable=False, default=0)
    dismissals              = Column(Integer, nullable=False, default=0)
    boundaries_4            = Column(Integer, nullable=False, default=0)
    boundaries_6            = Column(Integer, nullable=False, default=0)
    dot_balls               = Column(Integer, nullable=False, default=0)
    strike_rate             = Column(Numeric(6, 2))
    dismissal_rate          = Column(Numeric(6, 4))
    boundary_rate           = Column(Numeric(6, 4))
    dot_ball_rate           = Column(Numeric(6, 4))
    confidence_level        = Column(sa_enum(ConfidenceLevelEnum, name="confidence_level_enum"), nullable=False, default=ConfidenceLevelEnum.Low)
    smoothed_strike_rate    = Column(Numeric(6, 2))
    smoothed_wicket_prob    = Column(Numeric(6, 4))
    smoothed_boundary_prob  = Column(Numeric(6, 4))
    last_updated            = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at              = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at              = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    batter = relationship("Player", foreign_keys=[batter_id], back_populates="matchups_as_batter")
    bowler = relationship("Player", foreign_keys=[bowler_id], back_populates="matchups_as_bowler")


class WinProbabilitySnapshot(Base):
    __tablename__ = "win_probability_snapshots"

    id                      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id                = Column(UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    innings_number          = Column(Integer, nullable=False)
    over_number             = Column(Integer, nullable=False)
    ball_number             = Column(Integer, nullable=False)
    batting_team_win_prob   = Column(Numeric(5, 4), nullable=False)
    score_at_snapshot       = Column(Integer)
    wickets_at_snapshot     = Column(Integer)
    model_version           = Column(String(20))
    computed_at             = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    match = relationship("Match")


class AIRecommendation(Base):
    __tablename__ = "ai_recommendations"

    id                      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id                = Column(UUID(as_uuid=True), ForeignKey("matches.id"))
    session_id              = Column(UUID(as_uuid=True), ForeignKey("auction_sessions.id"))
    franchise_id            = Column(UUID(as_uuid=True), ForeignKey("franchises.id"))
    recommendation_type     = Column(sa_enum(RecommendationTypeEnum, name="recommendation_type_enum"), nullable=False)
    context_snapshot        = Column(JSONB, nullable=False)
    recommended_action      = Column(JSONB, nullable=False)
    confidence_score        = Column(Numeric(4, 3))
    reasoning_text          = Column(Text)
    model_version           = Column(String(20))
    was_followed            = Column(Boolean)
    actual_outcome          = Column(JSONB)
    win_prob_delta          = Column(Numeric(5, 4))
    generated_at            = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at              = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    match       = relationship("Match")
    franchise   = relationship("Franchise")
