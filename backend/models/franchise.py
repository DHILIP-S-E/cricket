from sqlalchemy import Column, String, Integer, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from .base import Base, TimestampMixin


class Franchise(Base, TimestampMixin):
    __tablename__ = "franchises"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name            = Column(String(100), nullable=False)
    short_name      = Column(String(10), nullable=False)
    tournament_id   = Column(UUID(as_uuid=True), ForeignKey("tournaments.id"), nullable=False)
    home_venue_id   = Column(UUID(as_uuid=True), ForeignKey("venues.id"))
    owner_name      = Column(String(100))
    coach_name      = Column(String(100))
    primary_color   = Column(String(10))
    secondary_color = Column(String(10))
    logo_url        = Column(String(500))
    founded_year    = Column(Integer)
    is_active       = Column(Boolean, nullable=False, default=True)

    tournament      = relationship("Tournament", back_populates="franchises")
    home_venue      = relationship("Venue", back_populates="franchises")
    squads          = relationship("Squad", back_populates="franchise")
    auction_states  = relationship("TeamAuctionState", back_populates="franchise")
