from sqlalchemy import Column, Numeric, ForeignKey, Text, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid

from .base import Base, TimestampMixin, sa_enum
from .player import DomesticLeagueEnum


class ScoutingReport(Base, TimestampMixin):
    __tablename__ = "scouting_reports"

    id                          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    player_id                   = Column(UUID(as_uuid=True), ForeignKey("players.id"), nullable=False)
    authored_by_franchise_id    = Column(UUID(as_uuid=True), ForeignKey("franchises.id"))
    report_date                 = Column(Date, nullable=False)
    league                      = Column(sa_enum(DomesticLeagueEnum, name="domestic_league_enum"))
    summary                     = Column(Text, nullable=False)
    batting_analysis            = Column(Text)
    bowling_analysis            = Column(Text)
    fielding_analysis           = Column(Text)
    weaknesses                  = Column(Text)
    strengths                   = Column(Text)
    hidden_talent_score         = Column(Numeric(5, 2))
    undervalue_score            = Column(Numeric(5, 2))
    recommended_base_price_cr   = Column(Numeric(6, 2))
    comparable_players          = Column(JSONB)
    raw_data                    = Column(JSONB)

    player      = relationship("Player", back_populates="scouting_reports")
    franchise   = relationship("Franchise")
