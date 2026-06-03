"""
Pre-Match, Players ML, Scout & semantic-search integration tests (real PostgreSQL).
"""
import pytest

pytestmark = pytest.mark.integration


# ── Pre-Match ──────────────────────────────────────────────────────────

def test_prematch_win_probability(pg_client, pg_ids):
    res = pg_client.get(f"/api/v1/prematch/{pg_ids['match']}/win-probability")
    assert res.status_code == 200
    d = res.json()["data"]
    assert d["team1_name"] and d["team2_name"]
    assert abs(d["team1_win_prob"] + d["team2_win_prob"] - 1.0) < 0.05


def test_xi_recommendation_picks_eleven(pg_client, pg_ids):
    if not pg_ids.get("xi_match"):
        pytest.skip("no squad/match combo available")
    res = pg_client.get(
        f"/api/v1/prematch/{pg_ids['xi_match']}/xi-recommendation",
        params={"franchise_id": pg_ids["xi_franchise"], "season_id": pg_ids["xi_season"]},
    )
    assert res.status_code == 200
    d = res.json()["data"]
    assert len(d["recommended_xi"]) == 11
    assert d["total_ai_score"] > 0


def test_prematch_advisor(pg_client, pg_ids):
    res = pg_client.get(f"/api/v1/prematch/{pg_ids['match']}/advisor")
    assert res.status_code == 200
    assert isinstance(res.json()["data"]["advice"], str)


# ── Players (ML) ───────────────────────────────────────────────────────

def test_players_list(pg_client):
    res = pg_client.get("/api/v1/players", params={"size": 5})
    assert res.status_code == 200
    body = res.json()
    assert len(body["data"]) <= 5
    assert body["total"] >= 1


def test_player_valuation_ml(pg_client, pg_ids):
    res = pg_client.get(f"/api/v1/players/{pg_ids['player']}/valuation")
    assert res.status_code == 200
    d = res.json()["data"]
    assert d["fair_market_value_cr"] is not None or d.get("fair_value_cr") is not None


# ── Semantic search + Scout ────────────────────────────────────────────

def test_scout_search_returns_results(pg_client):
    res = pg_client.get("/api/v1/players/scout-search", params={"q": "Sharma"})
    assert res.status_code == 200
    d = res.json()["data"]
    assert isinstance(d["results"], list)
    assert len(d["results"]) >= 1  # text fallback finds the Sharmas


def test_scout_ask_uses_real_data(pg_client, pg_ids):
    # Open the auction so auction_status has something to report.
    pg_client.post(f"/api/v1/auction/sessions/{pg_ids['session']}/open",
                   params={"franchise_id": pg_ids["franchise"]})
    res = pg_client.post("/api/v1/scout/ask", json={"question": "how is the auction going?"})
    assert res.status_code == 200
    assert "auction" in res.json()["data"]["answer"].lower()
