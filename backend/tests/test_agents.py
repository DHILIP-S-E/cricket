"""
Agent / LLM-layer tests (unit, SQLite client — no API key, no real data).

Verifies the graceful-fallback contract: with no LLM key configured every agent
endpoint still returns 200 with available=False / provider="none", and the
llm_agent client reports unavailable without raising.
"""
import uuid

from services import llm_agent


def test_llm_unavailable_without_key():
    # The test environment has no GEMINI/ANTHROPIC/OPENAI key set.
    assert llm_agent.llm_available() is False
    assert llm_agent.provider_name() == "none"


def test_complete_returns_none_without_key():
    assert llm_agent.complete("system", "user") is None
    assert llm_agent.complete_json("system", "user") is None


def test_scout_ask_fallback(client):
    res = client.post("/api/v1/scout/ask", json={"question": "how is the auction going?"})
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["available"] is False
    assert data["provider"] == "none"
    assert isinstance(data["answer"], str) and data["answer"]


def test_scout_ask_player_name_fallback(client):
    res = client.post("/api/v1/scout/ask", json={"question": "Kohli"})
    assert res.status_code == 200
    assert res.json()["data"]["available"] is False


def test_live_advisor_no_match(client):
    res = client.get(f"/api/v1/live/{uuid.uuid4()}/advisor")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["available"] is False
    assert data["provider"] == "none"


def test_prematch_advisor_no_match(client):
    res = client.get(f"/api/v1/prematch/{uuid.uuid4()}/advisor")
    assert res.status_code == 200
    assert res.json()["data"]["available"] is False


def test_auction_advisor_not_open(client):
    res = client.get(
        f"/api/v1/auction/sessions/{uuid.uuid4()}/advisor",
        params={"franchise_id": str(uuid.uuid4())},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["available"] is False
    assert data["call"] in ("BID", "HOLD", "PASS")


def test_scout_search_text_fallback_empty_db(client):
    # No players in SQLite → semantic disabled, empty text results, still 200.
    res = client.get("/api/v1/players/scout-search", params={"q": "Sharma"})
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["semantic"] is False
    assert isinstance(data["results"], list)
