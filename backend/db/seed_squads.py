"""
Seed the `squads` table from real match participation.

A squad row = (franchise, season, player) for every player who actually batted
or bowled for that franchise in that season's matches. This is derived from
batting_performances + bowling_performances joined to matches (for season_id),
so the squads reflect genuine historical line-ups — not synthetic data.

Notes:
- is_overseas is set False for everyone: the players table has no usable
  nationality data (all rows are 'Other'), so we cannot infer overseas status.
  The Playing-XI optimizer still runs; it simply isn't constrained by an
  overseas cap until real nationality data is ingested.
- role_in_squad is copied from players.playing_role (same enum).

Idempotent: ON CONFLICT (franchise_id, season_id, player_id) DO NOTHING.

Run:  python -m db.seed_squads          (from the backend/ directory)
"""
from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine, text


def _database_url() -> str:
    env = Path(__file__).resolve().parent.parent / ".env"
    for line in env.read_text().splitlines():
        if line.startswith("DATABASE_URL="):
            return line.split("DATABASE_URL=", 1)[1].strip()
    raise RuntimeError("DATABASE_URL not found in .env")


INSERT_SQL = text(
    """
    INSERT INTO squads (
        id, franchise_id, season_id, player_id,
        is_overseas, is_uncapped, role_in_squad,
        is_retained, is_rtm, created_at, updated_at
    )
    SELECT
        gen_random_uuid(),
        sq.franchise_id,
        sq.season_id,
        sq.player_id,
        false,                 -- is_overseas (no nationality data available)
        false,                 -- is_uncapped
        p.playing_role,        -- role_in_squad
        false,                 -- is_retained
        false,                 -- is_rtm
        now(),
        now()
    FROM (
        SELECT DISTINCT bp.franchise_id, m.season_id, bp.player_id
        FROM batting_performances bp
        JOIN matches m ON m.id = bp.match_id
        WHERE bp.franchise_id IS NOT NULL
        UNION
        SELECT DISTINCT bw.franchise_id, m.season_id, bw.player_id
        FROM bowling_performances bw
        JOIN matches m ON m.id = bw.match_id
        WHERE bw.franchise_id IS NOT NULL
    ) sq
    JOIN players p ON p.id = sq.player_id
    ON CONFLICT (franchise_id, season_id, player_id) DO NOTHING;
    """
)


def main() -> None:
    engine = create_engine(_database_url())
    with engine.begin() as conn:
        before = conn.execute(text("SELECT count(*) FROM squads")).scalar()
        conn.execute(INSERT_SQL)
        after = conn.execute(text("SELECT count(*) FROM squads")).scalar()
    print(f"squads: {before} -> {after}  (+{after - before} inserted)")


if __name__ == "__main__":
    main()
