from sqlalchemy import Column, DateTime, Enum as SAEnum, func


def sa_enum(enum_cls, name: str):
    """
    Create a SQLAlchemy Enum that uses Python enum VALUES for DB storage.
    By default SQLAlchemy uses enum member NAMES; this helper uses VALUES instead,
    so 'Top-order Batter' (value) not 'TopOrderBatter' (name) is stored.
    """
    return SAEnum(
        enum_cls,
        name=name,
        values_callable=lambda x: [e.value for e in x],
    )
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB

# SQLite doesn't natively support JSONB, so compile JSONB columns as JSON for SQLite/testing
@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
