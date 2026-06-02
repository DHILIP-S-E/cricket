import enum
from sqlalchemy import Column, String, Integer, Boolean, Date, Numeric, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from .base import Base, TimestampMixin, sa_enum


class TournamentNameEnum(str, enum.Enum):
    IPL = "IPL"
    BBL = "BBL"
    PSL = "PSL"
    CPL = "CPL"
    T20I = "T20I"
    SA20 = "SA20"
    ILT20 = "ILT20"
    MLC = "MLC"
    TNPL = "TNPL"
    KPL = "KPL"
    Ranji = "Ranji"
    VijayHazare = "Vijay Hazare"
    SyedMushtaqAli = "Syed Mushtaq Ali"
    Other = "Other"


class Tournament(Base, TimestampMixin):
    __tablename__ = "tournaments"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name          = Column(sa_enum(TournamentNameEnum, name="tournament_name_enum"), nullable=False)
    full_name     = Column(String(120), nullable=False)
    country       = Column(String(60), nullable=False)
    format        = Column(String(20), nullable=False, default="T20")
    is_active     = Column(Boolean, nullable=False, default=True)

    seasons       = relationship("Season", back_populates="tournament")
    franchises    = relationship("Franchise", back_populates="tournament")


class Season(Base, TimestampMixin):
    __tablename__ = "seasons"
    __table_args__ = (UniqueConstraint("tournament_id", "year"),)

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id   = Column(UUID(as_uuid=True), ForeignKey("tournaments.id"), nullable=False)
    year            = Column(Integer, nullable=False)
    start_date      = Column(Date)
    end_date        = Column(Date)
    total_teams     = Column(Integer)
    total_purse_cr  = Column(Numeric(8, 2))
    is_active       = Column(Boolean, nullable=False, default=False)

    tournament      = relationship("Tournament", back_populates="seasons")
    matches         = relationship("Match", back_populates="season")
    squads          = relationship("Squad", back_populates="season")
    points_table    = relationship("PointsTable", back_populates="season")
