"""
Live match simulator integration tests (real PostgreSQL).

start → step (ball-by-ball, ML win-prob, opposition-captain agent) → reset,
and the read endpoints that light up while a sim is running.
"""
import pytest

pytestmark = pytest.mark.integration


def test_start_step_reset_cycle(pg_client, pg_ids):
    mid = pg_ids["match"]

    start = pg_client.post(f"/api/v1/live/{mid}/sim/start")
    assert start.status_code == 200
    sd = start.json()["data"]
    assert sd["status"] == "started"
    assert sd["target"] >= 1
    assert sd["innings_over"] is False

    # State now exists for the read endpoint.
    assert pg_client.get(f"/api/v1/live/{mid}/state").status_code == 200

    plans = set()
    saw_prob = False
    for _ in range(30):
        d = pg_client.post(f"/api/v1/live/{mid}/sim/step").json()["data"]
        assert 0.0 <= d["win_probability"] <= 1.0
        saw_prob = True
        if d.get("opposition_plan"):
            plans.add(d["opposition_plan"])
        if d["innings_over"]:
            assert d["outcome"]
            break
    assert saw_prob
    # The opposition-captain agent must have chosen a real plan.
    assert plans <= {"attack", "contain", "balanced"} and len(plans) >= 1

    # Reset clears the live state.
    assert pg_client.post(f"/api/v1/live/{mid}/sim/reset").status_code == 200
    assert pg_client.get(f"/api/v1/live/{mid}/state").status_code == 404


def test_live_advisor_with_running_sim(pg_client, pg_ids):
    mid = pg_ids["match"]
    pg_client.post(f"/api/v1/live/{mid}/sim/start")
    for _ in range(6):
        pg_client.post(f"/api/v1/live/{mid}/sim/step")
    res = pg_client.get(f"/api/v1/live/{mid}/advisor")
    assert res.status_code == 200
    data = res.json()["data"]
    assert isinstance(data["advice"], str) and data["advice"]
    pg_client.post(f"/api/v1/live/{mid}/sim/reset")


def test_win_probability_history_grows(pg_client, pg_ids):
    mid = pg_ids["match"]
    pg_client.post(f"/api/v1/live/{mid}/sim/start")
    for _ in range(12):
        pg_client.post(f"/api/v1/live/{mid}/sim/step")
    wp = pg_client.get(f"/api/v1/live/{mid}/win-probability")
    assert wp.status_code == 200
    assert len(wp.json()["data"]["history"]) >= 1
    pg_client.post(f"/api/v1/live/{mid}/sim/reset")
