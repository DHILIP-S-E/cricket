"""
What-If simulator tests — pure/stateless (no DB needed), runs on SQLite client.

Covers the ML-backed `/live/simulate` endpoint and the underlying
`simulate_what_if` service: terminal states, run-rate maths, and that the win
probability moves sensibly with the scenario.
"""
from services.live_service import simulate_what_if


def _sim(**kw):
    base = dict(target=180, current_score=90, wickets_fallen=3,
                overs_completed=10, balls_this_over=0, total_overs=20)
    base.update(kw)
    return simulate_what_if(base)


# ── service-level logic ────────────────────────────────────────────────

def test_returns_all_keys():
    r = _sim()
    for k in ("win_probability", "chasing_team_win_prob", "defending_team_win_prob",
              "runs_required", "balls_remaining", "wickets_remaining",
              "required_run_rate", "current_run_rate", "batting_risk_level",
              "batting_strategy"):
        assert k in r


def test_probabilities_complementary():
    r = _sim()
    assert abs(r["chasing_team_win_prob"] + r["defending_team_win_prob"] - 1.0) < 1e-6
    assert 0.0 <= r["win_probability"] <= 1.0


def test_runs_and_balls_remaining_maths():
    r = _sim(target=180, current_score=90, overs_completed=10, balls_this_over=0)
    assert r["runs_required"] == 90
    assert r["balls_remaining"] == 60          # 20 overs - 10 completed = 60 balls
    assert r["wickets_remaining"] == 7          # 10 - 3


def test_target_already_reached_is_a_win():
    r = _sim(current_score=185, target=180)
    assert r["win_probability"] >= 0.98
    assert r["runs_required"] == 0


def test_all_out_is_a_loss():
    r = _sim(wickets_fallen=10, current_score=120, target=180)
    assert r["win_probability"] <= 0.05
    assert r["wickets_remaining"] == 0


def test_cruising_beats_collapsing():
    cruising = _sim(target=150, current_score=130, wickets_fallen=2, overs_completed=12)
    collapsing = _sim(target=200, current_score=120, wickets_fallen=8, overs_completed=16)
    assert cruising["win_probability"] > collapsing["win_probability"]


def test_tail_exposed_alert():
    r = _sim(target=200, current_score=120, wickets_fallen=9, overs_completed=16)
    assert r["alert"]  # something is flagged when 9 down and runs still needed


# ── API endpoint (stateless, no DB) ────────────────────────────────────

def test_simulate_endpoint_ok(client):
    res = client.post("/api/v1/live/simulate", json={
        "target": 180, "current_score": 135, "wickets_fallen": 4,
        "overs_completed": 15, "balls_this_over": 0, "total_overs": 20,
    })
    assert res.status_code == 200
    data = res.json()["data"]
    assert 0.0 <= data["win_probability"] <= 1.0
    assert data["required_run_rate"] == 9.0   # 45 needed off 30 balls


def test_simulate_endpoint_defaults(client):
    # Pydantic defaults should make an empty body valid.
    res = client.post("/api/v1/live/simulate", json={})
    assert res.status_code == 200
