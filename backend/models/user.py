from sqlalchemy import Boolean, Column, Integer, String, Enum, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    email           = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name       = Column(String(255), nullable=True)
    is_active       = Column(Boolean, default=True, nullable=False)
    is_superuser    = Column(Boolean, default=False, nullable=False)
    role            = Column(Enum("Franchise Owner", "Head Analyst", "Support Analyst", "Captain", "Scout", "Data Engineer", "Super Admin", name="user_role_enum"), nullable=False, default="Support Analyst")
    franchise_id    = Column(UUID(as_uuid=True), ForeignKey("franchises.id"), nullable=True)
    last_login      = Column(DateTime(timezone=True))

    franchise = relationship("Franchise")
