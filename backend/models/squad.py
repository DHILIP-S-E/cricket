from sqlalchemy import Column, Boolean, ForeignKey, UniqueConstraint, String, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from .base import Base, TimestampMixin, sa_enum
from .player import PlayingRoleEnum


class Squad(Base, TimestampMixin):
    __tablename__ = "squads"
    __table_args__ = (UniqueConstraint("franchise_id", "season_id", "player_id"),)

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    franchise_id        = Column(UUID(as_uuid=True), ForeignKey("franchises.id"), nullable=False)
    season_id           = Column(UUID(as_uuid=True), ForeignKey("seasons.id"), nullable=False)
    player_id           = Column(UUID(as_uuid=True), ForeignKey("players.id"), nullable=False)
    base_price_cr       = Column(Numeric(6, 2))
    contracted_price_cr = Column(Numeric(6, 2))
    is_overseas         = Column(Boolean, nullable=False, default=False)
    is_uncapped         = Column(Boolean, nullable=False, default=False)
    role_in_squad       = Column(sa_enum(PlayingRoleEnum, name="playing_role_enum"))
    is_retained         = Column(Boolean, nullable=False, default=False)
    is_rtm              = Column(Boolean, nullable=False, default=False)

    franchise   = relationship("Franchise", back_populates="squads")
    season      = relationship("Season", back_populates="squads")
    player      = relationship("Player")
    availability = relationship("PlayerAvailability", back_populates="squad")


class PlayerAvailability(Base, TimestampMixin):
    __tablename__ = "player_availability"

    id                      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    squad_id                = Column(UUID(as_uuid=True), ForeignKey("squads.id", ondelete="CASCADE"), nullable=False)
    match_id                = Column(UUID(as_uuid=True), ForeignKey("matches.id"))
    is_available            = Column(Boolean, nullable=False, default=True)
    unavailability_reason   = Column(String(60))
    notes                   = Column(String(500))

    squad = relationship("Squad", back_populates="availability")
    match = relationship("Match")
