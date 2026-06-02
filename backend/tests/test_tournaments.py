"""
Tests for tournaments, seasons, fixtures, points table endpoints.
"""
import uuid
import pytest
from fastapi.testclient import TestClient


def _create_tournament_season(db):
    from models.tournament import Tournament, Season, TournamentNameEnum
    t = Tournament(id=uuid.uuid4(), name=TournamentNameEnum.IPL, full_name="Indian Premier League", country="India")
    db.add(t)
    s = Season(id=uuid.uuid4(), tournament_id=t.id, year=2024, is_active=True)
    db.add(s)
    db.commit()
    return t, s


class TestTournamentEndpoints:
    def test_list_tournaments_empty(self, client: TestClient):
        res = client.get("/api/v1/tournaments")
        assert res.status_code == 200
        assert res.json()["data"] == []

    def test_list_tournaments(self, client: TestClient, db):
        _create_tournament_season(db)
        res = client.get("/api/v1/tournaments")
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data) == 1
        assert data[0]["name"] == "IPL"
        assert data[0]["full_name"] == "Indian Premier League"

    def test_list_seasons(self, client: TestClient, db):
        t, s = _create_tournament_season(db)
        res = client.get(f"/api/v1/tournaments/{t.id}/seasons")
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data) == 1
        assert data[0]["year"] == 2024
        assert data[0]["is_active"] is True

    def test_points_table_empty(self, client: TestClient, db):
        t, s = _create_tournament_season(db)
        res = client.get(f"/api/v1/tournaments/seasons/{s.id}/points-table")
        assert res.status_code == 200
        assert res.json()["data"] == []

    def test_points_table_ranked(self, client: TestClient, db):
        from models.tournament import Tournament, Season, TournamentNameEnum
        from models.franchise import Franchise
        from models.standings import PointsTable

        t = Tournament(id=uuid.uuid4(), name=TournamentNameEnum.IPL, full_name="IPL", country="India")
        db.add(t)
        s = Season(id=uuid.uuid4(), tournament_id=t.id, year=2024)
        db.add(s)
        f1 = Franchise(id=uuid.uuid4(), name="CSK", short_name="CSK", tournament_id=t.id)
        f2 = Franchise(id=uuid.uuid4(), name="MI", short_name="MI", tournament_id=t.id)
        db.add_all([f1, f2])

        pt1 = PointsTable(id=uuid.uuid4(), season_id=s.id, franchise_id=f1.id,
                           matches_played=8, wins=6, losses=2, points=12, net_run_rate=0.856)
        pt2 = PointsTable(id=uuid.uuid4(), season_id=s.id, franchise_id=f2.id,
                           matches_played=8, wins=4, losses=4, points=8, net_run_rate=0.123)
        db.add_all([pt1, pt2])
        db.commit()

        res = client.get(f"/api/v1/tournaments/seasons/{s.id}/points-table")
        assert res.status_code == 200
        rows = res.json()["data"]
        assert len(rows) == 2
        assert rows[0]["rank"] == 1
        assert rows[0]["franchise"]["short_name"] == "CSK"
        assert rows[0]["points"] == 12
        assert rows[1]["rank"] == 2
