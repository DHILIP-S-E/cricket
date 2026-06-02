"""
Tests for the /api/v1/players endpoints.
Uses SQLite in-memory DB via conftest fixtures.
"""
import uuid
import pytest
from fastapi.testclient import TestClient


def _create_player(db, full_name="Virat Kohli", playing_role="Top-order Batter",
                   nationality="India", is_active=True):
    from models.player import Player, PlayingRoleEnum, NationalityEnum, BattingStyleEnum, BowlingStyleEnum
    p = Player(
        id=uuid.uuid4(),
        full_name=full_name,
        nationality=NationalityEnum.India if nationality == "India" else NationalityEnum.Other,
        playing_role=PlayingRoleEnum.TopOrderBatter,
        batting_style=BattingStyleEnum.RightHand,
        bowling_style=BowlingStyleEnum.Nobowling,
        is_active=is_active,
        ipl_caps=0,
        international_caps=0,
    )
    db.add(p)
    db.commit()
    return p


class TestPlayerList:
    def test_list_players_empty(self, client: TestClient):
        res = client.get("/api/v1/players")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["total"] == 0
        assert data["data"] == []

    def test_list_players_returns_active(self, client: TestClient, db):
        _create_player(db, "Rohit Sharma")
        _create_player(db, "Jasprit Bumrah")
        _create_player(db, "Inactive Player", is_active=False)

        res = client.get("/api/v1/players?is_active=true")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 2
        names = [p["full_name"] for p in data["data"]]
        assert "Rohit Sharma" in names
        assert "Inactive Player" not in names

    def test_list_players_search(self, client: TestClient, db):
        _create_player(db, "Virat Kohli")
        _create_player(db, "Rohit Sharma")

        res = client.get("/api/v1/players?q=Virat")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 1
        assert data["data"][0]["full_name"] == "Virat Kohli"

    def test_list_players_pagination(self, client: TestClient, db):
        for i in range(5):
            _create_player(db, f"Player {i}")

        res = client.get("/api/v1/players?page=1&size=2")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 5
        assert len(data["data"]) == 2

        res2 = client.get("/api/v1/players?page=2&size=2")
        assert res2.status_code == 200
        assert len(res2.json()["data"]) == 2

    def test_list_players_role_filter(self, client: TestClient, db):
        _create_player(db, "Batter 1", playing_role="Top-order Batter")
        _create_player(db, "Batter 2", playing_role="Top-order Batter")

        res = client.get("/api/v1/players?playing_role=Top-order+Batter")
        assert res.status_code == 200
        assert res.json()["total"] == 2


class TestPlayerGet:
    def test_get_player_success(self, client: TestClient, db):
        p = _create_player(db, "MS Dhoni")
        res = client.get(f"/api/v1/players/{p.id}")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["data"]["full_name"] == "MS Dhoni"
        assert data["data"]["playing_role"] == "Top-order Batter"

    def test_get_player_not_found(self, client: TestClient):
        res = client.get(f"/api/v1/players/{uuid.uuid4()}")
        assert res.status_code == 404

    def test_get_player_returns_correct_fields(self, client: TestClient, db):
        p = _create_player(db, "Hardik Pandya")
        res = client.get(f"/api/v1/players/{p.id}")
        player = res.json()["data"]
        required_fields = ["id", "full_name", "nationality", "playing_role",
                           "batting_style", "bowling_style", "ipl_caps",
                           "international_caps", "is_active"]
        for f in required_fields:
            assert f in player, f"Missing field: {f}"


class TestPlayerForm:
    def test_get_form_not_found_returns_404(self, client: TestClient, db):
        p = _create_player(db, "New Player")
        res = client.get(f"/api/v1/players/{p.id}/form")
        assert res.status_code == 404


class TestPlayerValuation:
    def test_get_valuation_computes_on_fly(self, client: TestClient, db):
        p = _create_player(db, "Star Player")
        res = client.get(f"/api/v1/players/{p.id}/valuation")
        assert res.status_code == 200
        data = res.json()["data"]
        assert "fair_market_value_cr" in data
        assert data["fair_market_value_cr"] >= 0.20

    def test_get_valuation_nonexistent_player(self, client: TestClient):
        res = client.get(f"/api/v1/players/{uuid.uuid4()}/valuation")
        assert res.status_code == 404
