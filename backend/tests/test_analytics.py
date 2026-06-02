"""
Tests for /api/v1/analytics endpoints.

- Unit tests (no DB marker): test basic structure and agent/ask fallback.
- Integration tests (@pytest.mark.integration): require real PostgreSQL with
  data loaded. Run with: DATABASE_URL=... pytest -m integration
"""
import pytest
from fastapi.testclient import TestClient


# ── Unit tests — no real DB needed ────────────────────────────────────────────

class TestAnalyticsUnit:
    def test_agent_ask_returns_200(self, client: TestClient):
        """Agent ask endpoint must return 200 even on an empty DB."""
        res = client.get("/api/v1/analytics/agent/ask?q=hello")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "answer" in data["data"]
        assert "type" in data["data"]

    def test_agent_ask_has_correct_shape(self, client: TestClient):
        # Use a neutral query that hits the fallback path (no PostgreSQL-specific SQL)
        res = client.get("/api/v1/analytics/agent/ask?q=tell+me+something")
        assert res.status_code == 200
        body = res.json()["data"]
        assert isinstance(body["answer"], str)
        assert isinstance(body["data"], list)
        assert body["type"] == "help"

    def test_summary_returns_200(self, client: TestClient):
        res = client.get("/api/v1/analytics/summary")
        assert res.status_code == 200
        data = res.json()["data"]
        for key in ["total_matches", "total_balls", "total_players", "total_matchups"]:
            assert key in data


# ── Integration tests — require real PostgreSQL with IPL data loaded ───────────

@pytest.mark.integration
class TestAnalyticsIntegration:
    """
    These tests hit the real PostgreSQL database.
    Prerequisites:
      - DATABASE_URL points to the PostgreSQL instance
      - Cricsheet ingestion has been run (1,241+ matches loaded)
    """

    def test_summary_has_real_data(self, pg_client: TestClient):
        res = pg_client.get("/api/v1/analytics/summary")
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["total_matches"] >= 1000, f"Expected 1000+ matches, got {data['total_matches']}"
        assert data["total_balls"] >= 200000
        assert data["total_players"] >= 500

    def test_top_batters_returns_results(self, pg_client: TestClient):
        res = pg_client.get("/api/v1/analytics/top-batters?limit=10&min_innings=10")
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data) > 0
        # Should be sorted by runs descending
        runs = [p["total_runs"] for p in data]
        assert runs == sorted(runs, reverse=True)
        # Top batter should have significant runs
        assert data[0]["total_runs"] > 1000

    def test_top_batters_has_required_fields(self, pg_client: TestClient):
        res = pg_client.get("/api/v1/analytics/top-batters?limit=5&min_innings=10")
        assert res.status_code == 200
        for batter in res.json()["data"]:
            for field in ["name", "total_runs", "avg", "sr", "innings"]:
                assert field in batter, f"Missing field '{field}'"

    def test_top_bowlers_returns_results(self, pg_client: TestClient):
        res = pg_client.get("/api/v1/analytics/top-bowlers?limit=10&min_innings=10")
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data) > 0
        wickets = [b["total_wickets"] for b in data]
        assert wickets == sorted(wickets, reverse=True)
        assert data[0]["total_wickets"] > 50

    def test_team_stats_all_active_franchises(self, pg_client: TestClient):
        res = pg_client.get("/api/v1/analytics/team-stats")
        assert res.status_code == 200
        teams = res.json()["data"]
        names = [t["name"] for t in teams]
        # Key IPL teams must appear
        for team in ["Chennai Super Kings", "Mumbai Indians"]:
            assert team in names, f"Expected '{team}' in team stats"

    def test_team_stats_win_pct_range(self, pg_client: TestClient):
        res = pg_client.get("/api/v1/analytics/team-stats")
        assert res.status_code == 200
        for team in res.json()["data"]:
            assert 0 <= team["win_pct"] <= 100

    def test_phase_run_rates(self, pg_client: TestClient):
        res = pg_client.get("/api/v1/analytics/run-rate-phases")
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data) == 20  # 20 overs
        # Death overs (15-19) should average more runs than middle overs (6-14)
        death = [d["avg_rpo"] for d in data if d["over"] >= 15]
        middle = [d["avg_rpo"] for d in data if 6 <= d["over"] < 15]
        assert sum(death) / len(death) > sum(middle) / len(middle)

    def test_wicket_types(self, pg_client: TestClient):
        res = pg_client.get("/api/v1/analytics/wicket-types")
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data) > 0
        # Caught should be most common
        caught = next((w for w in data if w["type"] == "Caught"), None)
        assert caught is not None
        assert caught["pct"] > 30  # Caught is ~45% in T20

    def test_innings_score_distribution(self, pg_client: TestClient):
        res = pg_client.get("/api/v1/analytics/innings-scores")
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data) > 5
        # Total across all buckets = number of first innings
        total = sum(b["count"] for b in data)
        assert total > 500

    def test_agent_top_batters(self, pg_client: TestClient):
        res = pg_client.get("/api/v1/analytics/agent/ask?q=who+are+the+top+run+scorers")
        assert res.status_code == 200
        body = res.json()["data"]
        assert body["type"] == "top_batters"
        assert len(body["data"]) > 0
        assert body["insight"]  # should have an insight string

    def test_agent_best_bowlers(self, pg_client: TestClient):
        res = pg_client.get("/api/v1/analytics/agent/ask?q=best+wicket+takers+in+ipl")
        assert res.status_code == 200
        body = res.json()["data"]
        assert body["type"] == "top_bowlers"

    def test_agent_win_rate(self, pg_client: TestClient):
        res = pg_client.get("/api/v1/analytics/agent/ask?q=which+team+has+best+win+rate")
        assert res.status_code == 200
        body = res.json()["data"]
        assert body["type"] == "team_stats"
        assert len(body["data"]) > 0

    def test_agent_death_bowlers(self, pg_client: TestClient):
        res = pg_client.get("/api/v1/analytics/agent/ask?q=best+death+over+bowlers")
        assert res.status_code == 200
        body = res.json()["data"]
        assert body["type"] == "death_bowlers"
        assert "answer" in body
        # Phase data may not be populated — just check the response is valid
        assert isinstance(body["data"], list)
