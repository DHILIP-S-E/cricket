"""
Compute and populate the points_table (league standings) from real match
results — the Tournaments page reads this.

Business logic (standard T20 league rules):
  * Only completed matches count.
  * Win = 2 pts, Tie / No-result = 1 pt, Loss = 0.
  * Net Run Rate = (runs scored / overs faced) - (runs conceded / overs bowled),
    using each innings' real totals. When a side is bowled out, its full 20-over
    quota is used for "overs faced" (the standard NRR convention) instead of the
    actual (shorter) overs.

Idempotent: recomputes from scratch for every season that has matches and
upserts on (season_id, franchise_id). Nothing is hardcoded — every number is
derived from the matches/innings already in the DB.

Run:  DATABASE_URL=... python -m db.compute_standings            # all seasons
      DATABASE_URL=... python -m db.compute_standings 2026       # one season year
"""
from __future__ import annotations

import sys
from collections import defaultdict
from decimal import Decimal

from core.database import SessionLocal
from models import PointsTable, Match, Innings
from models.tournament import Season
from models.match import MatchTypeEnum

FULL_QUOTA_OVERS = 20.0
ALL_OUT_WICKETS = 10


class Acc:
    __slots__ = ("mp", "w", "l", "t", "nr", "fr", "fo", "ar", "ao")

    def __init__(self) -> None:
        self.mp = self.w = self.l = self.t = self.nr = 0
        self.fr = self.ar = 0          # for / against runs
        self.fo = self.ao = 0.0        # for / against overs


def _overs_faced(total_overs, total_wickets) -> float:
    # NRR rule: a bowled-out side is charged the full quota.
    if total_wickets is not None and total_wickets >= ALL_OUT_WICKETS:
        return FULL_QUOTA_OVERS
    return float(total_overs or 0)


def compute_season(db, season: Season) -> int:
    # League standings count league matches only — playoffs are excluded.
    matches = (
        db.query(Match)
        .filter(
            Match.season_id == season.id,
            Match.is_completed.is_(True),
            Match.match_type == MatchTypeEnum.League,
        )
        .all()
    )
    if not matches:
        return 0

    teams: dict = defaultdict(Acc)
    match_ids = [m.id for m in matches]

    # Innings totals grouped by match for NRR.
    innings = db.query(Innings).filter(Innings.match_id.in_(match_ids)).all()
    by_match: dict = defaultdict(list)
    for inn in innings:
        by_match[inn.match_id].append(inn)

    for m in matches:
        a = teams[m.team1_id]
        b = teams[m.team2_id]
        a.mp += 1
        b.mp += 1

        if m.no_result:
            a.nr += 1
            b.nr += 1
        elif m.winner_id is None:
            a.t += 1
            b.t += 1
        elif m.winner_id == m.team1_id:
            a.w += 1
            b.l += 1
        elif m.winner_id == m.team2_id:
            b.w += 1
            a.l += 1
        else:
            # winner not one of the two teams — treat as tie rather than guess
            a.t += 1
            b.t += 1

        # NRR contributions from each innings of this match.
        for inn in by_match.get(m.id, []):
            runs = inn.total_runs or 0
            overs = _overs_faced(inn.total_overs, inn.total_wickets)
            bat = teams[inn.batting_team_id]
            bowl = teams[inn.bowling_team_id]
            bat.fr += runs
            bat.fo += overs
            bowl.ar += runs
            bowl.ao += overs

    # Wipe and rewrite this season's table.
    db.query(PointsTable).filter(PointsTable.season_id == season.id).delete()

    for franchise_id, t in teams.items():
        for_rate = (t.fr / t.fo) if t.fo > 0 else 0.0
        against_rate = (t.ar / t.ao) if t.ao > 0 else 0.0
        nrr = round(for_rate - against_rate, 4)
        db.add(PointsTable(
            season_id=season.id,
            franchise_id=franchise_id,
            matches_played=t.mp,
            wins=t.w,
            losses=t.l,
            ties=t.t,
            no_results=t.nr,
            points=t.w * 2 + t.t + t.nr,
            net_run_rate=Decimal(str(nrr)),
            for_runs=t.fr,
            for_overs=Decimal(str(round(t.fo, 1))),
            against_runs=t.ar,
            against_overs=Decimal(str(round(t.ao, 1))),
        ))
    return len(teams)


def main(argv: list[str]) -> int:
    db = SessionLocal()
    try:
        q = db.query(Season)
        if len(argv) > 1:
            year = int(argv[1])
            q = q.filter(Season.year == year)
        seasons = q.order_by(Season.year).all()
        if not seasons:
            print("No matching seasons.", file=sys.stderr)
            return 1

        total_rows = 0
        for s in seasons:
            n = compute_season(db, s)
            if n:
                print(f"  {s.year}: {n} teams")
                total_rows += n
        db.commit()
        print(f"Done. {total_rows} standings rows across {len(seasons)} season(s).")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
