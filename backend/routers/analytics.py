"""
Analytics API — real aggregations from ball-by-ball data.
Powers the dashboard charts and AI agent intelligence layer.
"""
from __future__ import annotations

import re
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from core.database import get_db
from schemas.response import APIResponse

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/summary")
def platform_summary(db: Session = Depends(get_db)):
    """Top-line platform stats for the dashboard header."""
    row = db.execute(text("""
        SELECT
            (SELECT COUNT(*) FROM matches)               AS total_matches,
            (SELECT COUNT(*) FROM balls)                 AS total_balls,
            (SELECT COUNT(*) FROM players)               AS total_players,
            (SELECT COUNT(*) FROM player_matchups)       AS total_matchups,
            (SELECT COUNT(*) FROM tournaments)           AS total_tournaments,
            (SELECT COUNT(DISTINCT season_id) FROM matches) AS total_seasons
    """)).fetchone()
    return APIResponse(data={
        "total_matches":     row[0],
        "total_balls":       row[1],
        "total_players":     row[2],
        "total_matchups":    row[3],
        "total_tournaments": row[4],
        "total_seasons":     row[5],
    })


@router.get("/top-batters")
def top_batters(
    limit: int = Query(15, le=50),
    min_innings: int = Query(10, le=50),
    db: Session = Depends(get_db),
):
    """Top run scorers by total runs with average and strike rate."""
    rows = db.execute(text("""
        SELECT
            p.full_name,
            p.playing_role,
            COUNT(*)                                            AS innings,
            SUM(bp.runs_scored)                                 AS total_runs,
            ROUND(AVG(bp.runs_scored)::NUMERIC, 2)             AS avg_runs,
            ROUND(
                SUM(bp.runs_scored)::NUMERIC /
                NULLIF(SUM(bp.balls_faced), 0) * 100, 2
            )                                                   AS career_sr,
            SUM(bp.fours)                                       AS fours,
            SUM(bp.sixes)                                       AS sixes,
            SUM(CASE WHEN bp.runs_scored >= 50 THEN 1 ELSE 0 END) AS fifties,
            MAX(bp.runs_scored)                                 AS highest
        FROM batting_performances bp
        JOIN players p ON p.id = bp.player_id
        GROUP BY p.id, p.full_name, p.playing_role
        HAVING COUNT(*) >= :min_innings
        ORDER BY total_runs DESC
        LIMIT :limit
    """), {"limit": limit, "min_innings": min_innings}).fetchall()

    return APIResponse(data=[
        {
            "name": r[0], "role": r[1], "innings": r[2],
            "total_runs": r[3], "avg": float(r[4] or 0),
            "sr": float(r[5] or 0), "fours": r[6],
            "sixes": r[7], "fifties": r[8], "highest": r[9],
        }
        for r in rows
    ])


@router.get("/top-bowlers")
def top_bowlers(
    limit: int = Query(15, le=50),
    min_innings: int = Query(10, le=50),
    db: Session = Depends(get_db),
):
    """Top wicket takers with economy and average."""
    rows = db.execute(text("""
        SELECT
            p.full_name,
            p.playing_role,
            COUNT(*)                                              AS innings,
            SUM(bwp.wickets)                                      AS total_wickets,
            ROUND(AVG(bwp.economy)::NUMERIC, 2)                  AS avg_economy,
            ROUND(
                SUM(bwp.runs_conceded)::NUMERIC /
                NULLIF(SUM(bwp.wickets), 0), 2
            )                                                     AS bowling_avg,
            ROUND(SUM(bwp.overs_bowled)::NUMERIC, 1)             AS total_overs,
            SUM(bwp.dots)                                         AS total_dots
        FROM bowling_performances bwp
        JOIN players p ON p.id = bwp.player_id
        GROUP BY p.id, p.full_name, p.playing_role
        HAVING COUNT(*) >= :min_innings AND SUM(bwp.wickets) > 0
        ORDER BY total_wickets DESC
        LIMIT :limit
    """), {"limit": limit, "min_innings": min_innings}).fetchall()

    return APIResponse(data=[
        {
            "name": r[0], "role": r[1], "innings": r[2],
            "total_wickets": r[3], "economy": float(r[4] or 0),
            "avg": float(r[5] or 0), "overs": float(r[6] or 0),
            "dots": r[7],
        }
        for r in rows
    ])


@router.get("/team-stats")
def team_stats(db: Session = Depends(get_db)):
    """Win/loss record per franchise across all IPL seasons."""
    rows = db.execute(text("""
        WITH all_results AS (
            SELECT team1_id AS team_id,
                   CASE WHEN winner_id = team1_id THEN 1 ELSE 0 END AS won
            FROM matches WHERE no_result = FALSE AND winner_id IS NOT NULL
            UNION ALL
            SELECT team2_id,
                   CASE WHEN winner_id = team2_id THEN 1 ELSE 0 END
            FROM matches WHERE no_result = FALSE AND winner_id IS NOT NULL
        )
        SELECT
            f.name,
            f.short_name,
            f.primary_color,
            COUNT(*)                                AS played,
            SUM(won)                                AS wins,
            COUNT(*) - SUM(won)                     AS losses,
            ROUND(SUM(won)::NUMERIC / COUNT(*) * 100, 1) AS win_pct
        FROM all_results ar
        JOIN franchises f ON f.id = ar.team_id
        GROUP BY f.id, f.name, f.short_name, f.primary_color
        HAVING COUNT(*) >= 10
        ORDER BY win_pct DESC
    """)).fetchall()

    return APIResponse(data=[
        {
            "name": r[0], "short_name": r[1], "color": r[2],
            "played": r[3], "wins": r[4], "losses": r[5],
            "win_pct": float(r[6] or 0),
        }
        for r in rows
    ])


@router.get("/run-rate-phases")
def run_rate_phases(db: Session = Depends(get_db)):
    """Average runs per over by phase (Powerplay / Middle / Death) across all IPL matches."""
    rows = db.execute(text("""
        SELECT
            CASE
                WHEN b.over_number < 6  THEN 'Powerplay'
                WHEN b.over_number < 15 THEN 'Middle'
                ELSE 'Death'
            END                                                       AS phase,
            b.over_number,
            ROUND(AVG((b.runs_off_bat + b.extras_runs) * 6.0), 2)   AS avg_rpo
        FROM balls b
        GROUP BY phase, b.over_number
        ORDER BY b.over_number
    """)).fetchall()

    return APIResponse(data=[
        {"phase": r[0], "over": r[1], "avg_rpo": float(r[2] or 0)}
        for r in rows
    ])


@router.get("/wicket-types")
def wicket_types(db: Session = Depends(get_db)):
    """Distribution of wicket types across all IPL matches."""
    rows = db.execute(text("""
        SELECT
            wicket_type::TEXT AS wicket_type,
            COUNT(*) AS count
        FROM balls
        WHERE is_wicket = TRUE AND wicket_type IS NOT NULL
        GROUP BY wicket_type
        ORDER BY count DESC
    """)).fetchall()

    total = sum(r[1] for r in rows)
    return APIResponse(data=[
        {"type": r[0], "count": r[1], "pct": round(r[1] / total * 100, 1)}
        for r in rows
    ])


@router.get("/innings-scores")
def innings_scores(db: Session = Depends(get_db)):
    """Distribution of first-innings totals — bucketised for histogram."""
    rows = db.execute(text("""
        SELECT
            (FLOOR(total_runs / 10) * 10)::INT AS bucket,
            COUNT(*)                            AS count
        FROM innings
        WHERE innings_number = 1 AND total_runs > 0
        GROUP BY bucket
        ORDER BY bucket
    """)).fetchall()

    return APIResponse(data=[
        {"score_range": f"{r[0]}-{r[0]+9}", "count": r[1]}
        for r in rows
    ])


@router.get("/agent/ask")
def agent_ask(
    q: str = Query(..., description="Natural language question"),
    db: Session = Depends(get_db),
):
    """
    Agentic intelligence layer.
    Parses natural language queries, runs the right DB query, returns structured answer.
    """
    q_lower = q.lower()

    # ── Best batters ──────────────────────────────────────────────
    if any(w in q_lower for w in ["top bat", "best bat", "run scor", "most run", "opener"]):
        rows = db.execute(text("""
            SELECT p.full_name, p.playing_role,
                   SUM(bp.runs_scored) as runs,
                   ROUND(AVG(bp.runs_scored)::NUMERIC, 1) as avg,
                   ROUND(SUM(bp.runs_scored)::NUMERIC / NULLIF(SUM(bp.balls_faced),0)*100, 1) as sr
            FROM batting_performances bp JOIN players p ON p.id = bp.player_id
            GROUP BY p.id, p.full_name, p.playing_role
            HAVING COUNT(*) >= 15 ORDER BY runs DESC LIMIT 5
        """)).fetchall()
        players = [{"name": r[0], "role": r[1], "runs": r[2], "avg": float(r[3] or 0), "sr": float(r[4] or 0)} for r in rows]
        insight = f"{players[0]['name']} leads with {players[0]['runs']:,} runs at SR {players[0]['sr']}." if players else "No data yet."
        return APIResponse(data={
            "answer": f"Top IPL run-scorers: {', '.join(p['name'] for p in players) or 'None found'}.",
            "insight": insight, "data": players, "type": "top_batters",
        })

    # ── Best bowlers ──────────────────────────────────────────────
    if any(w in q_lower for w in ["top bowl", "best bowl", "wicket tak", "most wicket"]):
        rows = db.execute(text("""
            SELECT p.full_name, p.playing_role,
                   SUM(bwp.wickets) as wkts,
                   ROUND(AVG(bwp.economy)::NUMERIC, 2) as eco
            FROM bowling_performances bwp JOIN players p ON p.id = bwp.player_id
            GROUP BY p.id, p.full_name, p.playing_role
            HAVING COUNT(*) >= 15 AND SUM(bwp.wickets) > 0 ORDER BY wkts DESC LIMIT 5
        """)).fetchall()
        players = [{"name": r[0], "role": r[1], "wickets": r[2], "economy": float(r[3] or 0)} for r in rows]
        insight = f"{players[0]['name']} leads with {players[0]['wickets']} wickets at economy {players[0]['economy']}." if players else "No data yet."
        return APIResponse(data={
            "answer": f"Top IPL wicket-takers: {', '.join(p['name'] for p in players) or 'None found'}.",
            "insight": insight, "data": players, "type": "top_bowlers",
        })

    # ── Death over bowlers ────────────────────────────────────────
    if any(w in q_lower for w in ["death", "last over", "16th", "17th", "18th", "19th", "20th"]):
        rows = db.execute(text("""
            SELECT p.full_name,
                   SUM(bwp.death_wickets) as wkts,
                   ROUND(SUM(bwp.death_runs)::NUMERIC / NULLIF(SUM(bwp.death_overs),0), 2) as eco
            FROM bowling_performances bwp JOIN players p ON p.id = bwp.player_id
            WHERE bwp.death_overs > 0
            GROUP BY p.id, p.full_name
            HAVING SUM(bwp.death_overs) >= 10
            ORDER BY eco ASC, wkts DESC LIMIT 5
        """)).fetchall()
        players = [{"name": r[0], "wickets": r[1], "economy": float(r[2] or 0)} for r in rows]
        insight = f"{players[0]['name']} — Economy {players[0]['economy']} in death overs." if players else "Phase-level data not yet available."
        return APIResponse(data={"answer": f"Best death-over bowlers: {', '.join(p['name'] for p in players) or 'Insufficient phase data'}.", "insight": insight, "data": players, "type": "death_bowlers"})

    # ── Powerplay bowlers ─────────────────────────────────────────
    if any(w in q_lower for w in ["powerplay", "pp bowl", "first 6"]):
        rows = db.execute(text("""
            SELECT p.full_name,
                   SUM(bwp.powerplay_wickets) as wkts,
                   ROUND(SUM(bwp.powerplay_runs)::NUMERIC / NULLIF(SUM(bwp.powerplay_overs),0), 2) as eco
            FROM bowling_performances bwp JOIN players p ON p.id = bwp.player_id
            WHERE bwp.powerplay_overs > 0
            GROUP BY p.id, p.full_name
            HAVING SUM(bwp.powerplay_overs) >= 10
            ORDER BY wkts DESC, eco ASC LIMIT 5
        """)).fetchall()
        players = [{"name": r[0], "wickets": r[1], "economy": float(r[2] or 0)} for r in rows]
        insight = f"{players[0]['name']} leads with {players[0]['wickets']} PP wickets." if players else "Phase-level data not yet available."
        return APIResponse(data={"answer": f"Best powerplay bowlers: {', '.join(p['name'] for p in players) or 'Insufficient phase data'}.", "insight": insight, "data": players, "type": "pp_bowlers"})

    # ── Win percentage / team form ─────────────────────────────────
    if any(w in q_lower for w in ["win", "best team", "top team", "strongest"]):
        rows = db.execute(text("""
            WITH res AS (
                SELECT team1_id AS tid, CASE WHEN winner_id=team1_id THEN 1 ELSE 0 END AS w FROM matches WHERE no_result=FALSE AND winner_id IS NOT NULL
                UNION ALL
                SELECT team2_id, CASE WHEN winner_id=team2_id THEN 1 ELSE 0 END FROM matches WHERE no_result=FALSE AND winner_id IS NOT NULL
            )
            SELECT f.name, f.short_name, COUNT(*) as played, SUM(w) as wins,
                   ROUND(SUM(w)::NUMERIC/COUNT(*)*100,1) as win_pct
            FROM res JOIN franchises f ON f.id = res.tid
            GROUP BY f.id, f.name, f.short_name HAVING COUNT(*) >= 10
            ORDER BY win_pct DESC LIMIT 5
        """)).fetchall()
        teams = [{"name": r[0], "short": r[1], "played": r[2], "wins": r[3], "win_pct": float(r[4])} for r in rows]
        return APIResponse(data={"answer": f"Top IPL teams by win%%: {', '.join(t['name'] for t in teams)}.", "insight": f"{teams[0]['name']} leads with {teams[0]['win_pct']}%% win rate ({teams[0]['wins']}/{teams[0]['played']}).", "data": teams, "type": "team_stats"})

    # ── Matchup specific ──────────────────────────────────────────
    name_match = re.findall(r'\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)\b', q)
    if name_match and any(w in q_lower for w in ["vs", "against", "matchup", "face"]):
        name = name_match[0]
        rows = db.execute(text("""
            SELECT p.full_name, pm.phase::TEXT, pm.balls_faced,
                   pm.smoothed_strike_rate, pm.smoothed_wicket_prob, pm.confidence_level::TEXT
            FROM player_matchups pm
            JOIN players p ON p.id = pm.batter_id OR p.id = pm.bowler_id
            WHERE p.full_name ILIKE :name AND pm.balls_faced >= 10
            ORDER BY pm.balls_faced DESC LIMIT 8
        """), {"name": f"%{name}%"}).fetchall()
        if rows:
            return APIResponse(data={"answer": f"Found {len(rows)} matchup records involving {name}.", "data": [{"player": r[0], "phase": r[1], "balls": r[2], "sr": float(r[3] or 0), "wkt_prob": float(r[4] or 0), "confidence": r[5]} for r in rows], "type": "matchups"})

    # ── Default: platform summary ─────────────────────────────────
    row = db.execute(text("SELECT COUNT(*) FROM matches")).scalar()
    return APIResponse(data={
        "answer": f"I have data on {row:,} IPL matches. Try asking: 'Who are the top batters?', 'Best death-over bowlers?', 'Which team has the best win rate?'",
        "data": [], "type": "help",
    })
