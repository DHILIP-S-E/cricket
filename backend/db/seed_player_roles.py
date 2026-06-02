"""
Derive a realistic `players.playing_role` from real performance data.

The raw ingest left every player as 'Top-order Batter' (and bowling_style
'None'), which made the Playing-XI optimizer's role constraints meaningless —
it could never field 5 bowlers / 4 batters, so it always fell back to greedy.

This script classifies each player from their *actual* batting + bowling
workload across all recorded performances:

  - bowls a real workload + bats usefully  -> Batting / Bowling All-rounder
  - bowls a real workload, bats little      -> Pace Bowler*
  - doesn't bowl, bats top of the order     -> Top-order Batter
  - doesn't bowl, bats the middle/lower      -> Middle-order Batter

  * pace vs spin can't be inferred — bowling_style is 'None' for everyone in
    the source data — so pure bowlers are labelled "Pace Bowler". This is
    cosmetic: the optimizer only cares whether a player is a bowling option.

Wicket-keepers: the source data has NO keeper signal (dismissal_type is NULL
everywhere, no stumping records), so keepers cannot be derived. To give each
franchise a realistic keeper-batter, the top pure-batters (by innings) per
franchise are designated 'Wicket-keeper Batter'.

After updating players, `squads.role_in_squad` is re-synced to match.

Idempotent. Run:  python -m db.seed_player_roles   (from backend/)
"""
from __future__ import annotations

from collections import defaultdict

from sqlalchemy import create_engine, text

from db.seed_squads import _database_url

# Tunables ----------------------------------------------------------------
BOWLER_MIN_OVERS = 10.0       # career overs to count as a real bowling option
ALLROUNDER_MIN_BAT_INNINGS = 3
ALLROUNDER_MAX_POS = 7.0      # must bat in the top 7 to be an all-rounder
BATTING_AR_MAX_POS = 5.0      # bats top 5 -> batting all-rounder, else bowling
TOP_ORDER_MAX_POS = 4.0       # avg position <= 4 -> top order, else middle
KEEPERS_PER_FRANCHISE = 2     # designated keeper-batters per franchise


def classify(bat_inns: int, avg_pos: float, balls_faced: int,
             bowl_overs: float) -> str:
    bowls = bowl_overs >= BOWLER_MIN_OVERS
    bats = bat_inns >= ALLROUNDER_MIN_BAT_INNINGS and (
        balls_faced >= 60 or avg_pos <= ALLROUNDER_MAX_POS
    )

    if bowls:
        if bats and avg_pos <= ALLROUNDER_MAX_POS:
            return "Batting All-rounder" if avg_pos <= BATTING_AR_MAX_POS \
                else "Bowling All-rounder"
        return "Pace Bowler"

    # Doesn't bowl a meaningful workload -> a batter (or a fringe bowler who
    # bowled a little). If they never batted but bowled at all, call them a
    # bowler; otherwise classify by where they bat.
    if bat_inns == 0:
        return "Pace Bowler" if bowl_overs > 0 else "Middle-order Batter"
    if avg_pos <= TOP_ORDER_MAX_POS:
        return "Top-order Batter"
    return "Middle-order Batter"


AGG_SQL = text(
    """
    SELECT
        p.id,
        COALESCE(b.inns, 0)        AS bat_inns,
        COALESCE(b.avg_pos, 99)    AS avg_pos,
        COALESCE(b.balls, 0)       AS balls_faced,
        COALESCE(w.overs, 0)       AS bowl_overs,
        b.primary_franchise        AS primary_franchise
    FROM players p
    LEFT JOIN (
        SELECT player_id,
               count(*)                 AS inns,
               avg(batting_position)    AS avg_pos,
               sum(balls_faced)         AS balls,
               (SELECT bp2.franchise_id
                  FROM batting_performances bp2
                 WHERE bp2.player_id = bp.player_id
              GROUP BY bp2.franchise_id
              ORDER BY count(*) DESC
                 LIMIT 1)               AS primary_franchise
          FROM batting_performances bp
      GROUP BY player_id
    ) b ON b.player_id = p.id
    LEFT JOIN (
        SELECT player_id, sum(overs_bowled) AS overs
          FROM bowling_performances
      GROUP BY player_id
    ) w ON w.player_id = p.id
    """
)


def main() -> None:
    engine = create_engine(_database_url())
    with engine.begin() as conn:
        rows = list(conn.execute(AGG_SQL))

        role_by_player: dict[str, str] = {}
        # Track pure batters per franchise to pick keepers from.
        batters_by_franchise: dict[str, list] = defaultdict(list)

        for r in rows:
            pid = str(r.id)
            bat_inns = int(r.bat_inns)
            avg_pos = float(r.avg_pos)
            balls = int(r.balls_faced)
            overs = float(r.bowl_overs)

            role = classify(bat_inns, avg_pos, balls, overs)
            role_by_player[pid] = role

            # Keeper candidates: genuine batters who don't bowl.
            if role in ("Top-order Batter", "Middle-order Batter") \
                    and overs < 5 and r.primary_franchise is not None:
                batters_by_franchise[str(r.primary_franchise)].append(
                    (bat_inns, pid)
                )

        # Designate the busiest pure-batters per franchise as keeper-batters.
        keepers = 0
        for _fid, cands in batters_by_franchise.items():
            cands.sort(reverse=True)  # most innings first
            for _inns, pid in cands[:KEEPERS_PER_FRANCHISE]:
                role_by_player[pid] = "Wicket-keeper Batter"
                keepers += 1

        # Bulk update players.playing_role.
        conn.execute(
            text("UPDATE players SET playing_role = :role, updated_at = now() "
                 "WHERE id = :id"),
            [{"id": pid, "role": role} for pid, role in role_by_player.items()],
        )

        # Re-sync the squads snapshot.
        conn.execute(
            text("UPDATE squads s SET role_in_squad = p.playing_role, "
                 "updated_at = now() FROM players p WHERE p.id = s.player_id")
        )

        # Report the new distribution.
        dist = conn.execute(
            text("SELECT playing_role, count(*) FROM players "
                 "GROUP BY 1 ORDER BY 2 DESC")
        ).all()

    print(f"Updated {len(role_by_player)} players ({keepers} keepers).")
    print("New playing_role distribution:")
    for role, cnt in dist:
        print(f"  {role}: {cnt}")


if __name__ == "__main__":
    main()
