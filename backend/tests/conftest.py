import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool, NullPool

from main import app
from core.database import get_db
from models.base import Base

# ── Unit test DB: in-memory SQLite ─────────────────────────────────────────────

SQLITE_URL = "sqlite:///:memory:"

sqlite_engine = create_engine(
    SQLITE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,  # single shared connection so all sessions see the same in-memory DB
)

@event.listens_for(sqlite_engine, "connect")
def set_sqlite_pragma(dbapi_con, _):
    dbapi_con.execute("PRAGMA foreign_keys=ON")

SqliteSession = sessionmaker(autocommit=False, autoflush=False, bind=sqlite_engine)


@pytest.fixture(autouse=True)
def setup_db():
    """Create all tables before each test, drop them after."""
    Base.metadata.create_all(bind=sqlite_engine)
    yield
    Base.metadata.drop_all(bind=sqlite_engine)


@pytest.fixture
def db():
    session = SqliteSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    """Test client backed by in-memory SQLite — no real DB needed."""
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── Integration test DB: real PostgreSQL ───────────────────────────────────────

def _pg_url():
    return os.environ.get("DATABASE_URL", "")


@pytest.fixture
def pg_client():
    """
    Test client backed by the real PostgreSQL database.
    Only usable in tests marked @pytest.mark.integration.
    """
    pg_url = _pg_url()
    if not pg_url or "sqlite" in pg_url:
        pytest.skip("No PostgreSQL DATABASE_URL set")

    pg_engine = create_engine(pg_url, poolclass=NullPool)
    PgSession = sessionmaker(autocommit=False, autoflush=False, bind=pg_engine)

    session = PgSession()
    try:
        def override_get_db():
            try:
                yield session
            finally:
                pass
        app.dependency_overrides[get_db] = override_get_db
        with TestClient(app) as c:
            yield c
    finally:
        session.close()
        app.dependency_overrides.clear()


# ── Real IDs from the integration DB (for integration tests) ───────────────────

@pytest.fixture
def pg_ids():
    """Fetch representative IDs from the real DB so integration tests aren't
    hardcoded to specific UUIDs."""
    from sqlalchemy import text
    pg_url = _pg_url()
    if not pg_url or "sqlite" in pg_url:
        pytest.skip("No PostgreSQL DATABASE_URL set")
    eng = create_engine(pg_url, poolclass=NullPool)
    ids: dict = {}
    try:
        with eng.connect() as c:
            def one(q):
                r = c.execute(text(q)).fetchone()
                return str(r[0]) if r and r[0] is not None else None
            ids["player"] = one("SELECT id FROM players LIMIT 1")
            ids["match"] = one("SELECT id FROM matches LIMIT 1")
            ids["session"] = one("SELECT id FROM auction_sessions LIMIT 1")
            ids["franchise"] = one("SELECT franchise_id FROM team_auction_states LIMIT 1")
            ids["season"] = one("SELECT id FROM seasons LIMIT 1")
            # A (franchise, season, match) combo where the franchise actually plays —
            # needed for the XI recommendation.
            row = c.execute(text(
                "SELECT s.franchise_id, s.season_id, m.id "
                "FROM squads s JOIN matches m ON m.season_id = s.season_id "
                "AND (m.team1_id = s.franchise_id OR m.team2_id = s.franchise_id) LIMIT 1"
            )).fetchone()
            if row:
                ids["xi_franchise"], ids["xi_season"], ids["xi_match"] = (
                    str(row[0]), str(row[1]), str(row[2]))
    finally:
        eng.dispose()
    return ids


# ── Markers ───────────────────────────────────────────────────────────────────

def pytest_configure(config):
    config.addinivalue_line("markers", "integration: requires real PostgreSQL — run with DATABASE_URL set")


@pytest.fixture(autouse=True)
def skip_integration_without_pg(request):
    """Skip @pytest.mark.integration tests when no real PostgreSQL is available."""
    if request.node.get_closest_marker("integration"):
        pg_url = _pg_url()
        if not pg_url or "sqlite" in pg_url:
            pytest.skip("Set DATABASE_URL to a real PostgreSQL URL to run integration tests.")
