"""
Auction engine integration tests (real PostgreSQL).

Exercises the full game loop through the REST surface: open → bid via agents →
SOLD → advance, plus the AI advisor and auto-pilot.

NOTE: `open` deliberately RESETS the auction session to a clean state (this is
the same thing the app's "Start Auction" button does), so these tests rewrite
the auction session's transient state. Player/match/squad data is untouched.
"""
import pytest

pytestmark = pytest.mark.integration


def _open(client, session, franchise):
    return client.post(f"/api/v1/auction/sessions/{session}/open",
                       params={"franchise_id": franchise})


def test_open_presents_first_lot(pg_client, pg_ids):
    res = _open(pg_client, pg_ids["session"], pg_ids["franchise"])
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["phase"] == "bidding"
    assert data["lot"] is not None
    assert data["current_price_cr"] is not None
    assert data["total_sold"] == 0


def test_advisor_returns_call(pg_client, pg_ids):
    _open(pg_client, pg_ids["session"], pg_ids["franchise"])
    res = pg_client.get(f"/api/v1/auction/sessions/{pg_ids['session']}/advisor",
                        params={"franchise_id": pg_ids["franchise"]})
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["call"] in ("BID", "HOLD", "PASS")
    assert "advice" in data


def test_full_loop_sells_players_and_debits_budget(pg_client, pg_ids):
    session, franchise = pg_ids["session"], pg_ids["franchise"]
    _open(pg_client, session, franchise)
    # Auto-pilot on so the human franchise also bids autonomously.
    assert pg_client.post(f"/api/v1/auction/sessions/{session}/autopilot",
                          params={"on": True}).status_code == 200

    purse_before = {t["franchise_short_name"]: t["remaining_budget_cr"]
                    for t in pg_client.get(f"/api/v1/auction/sessions/{session}/teams").json()["data"]}

    sold = 0
    last = None
    for _ in range(120):
        last = pg_client.post(f"/api/v1/auction/sessions/{session}/tick").json()["data"]
        if last["phase"] == "finished":
            break
        if last["total_sold"] >= 3:
            sold = last["total_sold"]
            break
    sold = max(sold, last["total_sold"])
    assert sold >= 1, "expected at least one player to be sold after many ticks"

    # Someone's budget must have dropped (a sale debits the buyer).
    after = pg_client.get(f"/api/v1/auction/sessions/{session}/teams").json()["data"]
    spent_any = any(t["remaining_budget_cr"] < purse_before.get(t["franchise_short_name"], t["initial_purse_cr"])
                    for t in after)
    assert spent_any
    assert any(t["squad_size"] >= 1 for t in after)


def test_tick_before_open_conflicts(pg_client, pg_ids):
    # A fresh engine for an unopened *random* session id should 409.
    import uuid
    res = pg_client.post(f"/api/v1/auction/sessions/{uuid.uuid4()}/tick")
    assert res.status_code == 409


def test_autopilot_toggle(pg_client, pg_ids):
    session, franchise = pg_ids["session"], pg_ids["franchise"]
    _open(pg_client, session, franchise)
    assert pg_client.post(f"/api/v1/auction/sessions/{session}/autopilot",
                          params={"on": True}).status_code == 200
    assert pg_client.post(f"/api/v1/auction/sessions/{session}/autopilot",
                          params={"on": False}).status_code == 200
