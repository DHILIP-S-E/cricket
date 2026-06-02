"""
Pre-match intelligence service.
Generates Playing XI recommendations, win probability, and matchup analysis.
"""
from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.orm import Session

from crud.match import get_match, get_recent_h2h_matches
from crud.tournament import get_squad
from crud.player import get_player_form, get_player_rating
from ml.serve import predict_prematch_win_prob, optimize_playing_xi, get_matchup_matrix
from services import llm_agent

logger = logging.getLogger(__name__)


_COACH_SYSTEM = (
    "You are the AI head coach for a T20 franchise giving a pre-match briefing. "
    "Using ONLY the analysis provided, give 2-3 crisp sentences of strategic advice: "
    "toss call, the key threat, and what to prioritise. Do not invent stats."
)


def get_prematch_advisor(db: Session, match_id: UUID) -> dict:
    """AI Coach agent — natural-language pre-match briefing grounded in the ML win-prob."""
    wp = get_prematch_win_probability(db, match_id)
    if "error" in wp:
        return {"available": False, "advice": wp["error"], "provider": "none"}

    facts = (
        f"Match: {wp['team1_name']} vs {wp['team2_name']}\n"
        f"Model win probability: {wp['team1_name']} {round(wp['team1_win_prob']*100)}% "
        f"vs {wp['team2_name']} {round(wp['team2_win_prob']*100)}%\n"
        f"Confidence: {wp['confidence']}\n"
        f"Key factors: {'; '.join(wp['key_factors']) if wp['key_factors'] else 'none flagged'}"
    )
    text = llm_agent.complete(_COACH_SYSTEM, facts, max_tokens=220)
    if text:
        return {"available": True, "advice": text.strip(), "provider": llm_agent.provider_name()}

    fallback = (
        f"{wp['team1_name'] if wp['team1_win_prob'] >= wp['team2_win_prob'] else wp['team2_name']} "
        f"are favoured ({max(wp['team1_win_prob'], wp['team2_win_prob'])*100:.0f}%). "
        + (" ".join(wp["key_factors"]) if wp["key_factors"] else "Match is finely balanced.")
    )
    return {"available": False, "advice": fallback, "provider": "none"}


def get_xi_recommendation(
    db: Session,
    match_id: UUID,
    franchise_id: UUID,
    season_id: UUID,
) -> dict:
    """Generate an optimal Playing XI recommendation for a franchise."""
    match = get_match(db, match_id)
    if not match:
        return {"error": "Match not found"}

    squad = get_squad(db, franchise_id, season_id)
    if not squad:
        return {"error": "Squad not found for this franchise and season"}

    venue = match.venue
    match_context = {
        "venue_spin_rating": float(venue.spin_assistance_rating or 5),
        "venue_pace_rating": float(venue.pace_assistance_rating or 5),
        "pitch_type": str(match.pitch_type or "Balanced"),
        "is_day_match": 1 if match.match_date.hour < 16 else 0,
        "toss_decision": str(match.toss_decision or "Field"),
    }

    squad_dicts = []
    for s in squad:
        player = s.player
        form = get_player_form(db, player.id)
        rating = get_player_rating(db, player.id)

        squad_dicts.append({
            "player_id": str(player.id),
            "full_name": player.full_name,
            "playing_role": player.playing_role.value,
            "is_overseas": s.is_overseas,
            "overall_rating": float(rating.overall_rating) if rating else 50,
            "form_score": float(form.form_score) if form else 0.5,
        })

    result = optimize_playing_xi(squad_dicts, match_context)

    # Identify impact player candidate (best non-selected or impact role)
    selected_ids = {p["player_id"] for p in result["playing_xi"]}
    impact_candidates = [
        p for p in result["playing_xi"]
        if p["playing_role"] in ("Batting All-rounder", "Bowling All-rounder")
    ]
    impact_player = impact_candidates[0] if impact_candidates else None
    if impact_player:
        impact_player["is_impact_player"] = True

    return {
        "recommended_xi": result["playing_xi"],
        "total_ai_score": result["total_score"],
        "overseas_count": result["overseas_count"],
        "bowling_options": result["bowling_options"],
        "win_probability_estimate": None,
        "reasoning": (
            f"Selected {len(result['playing_xi'])} players optimised for "
            f"{match_context['pitch_type']} pitch at {venue.name}. "
            f"Spin factor: {match_context['venue_spin_rating']}/10, "
            f"Pace factor: {match_context['venue_pace_rating']}/10."
        ),
        "impact_player_recommendation": impact_player,
    }


def get_prematch_win_probability(
    db: Session,
    match_id: UUID,
) -> dict:
    match = get_match(db, match_id)
    if not match:
        return {"error": "Match not found"}

    venue = match.venue
    h2h = get_recent_h2h_matches(db, match.team1_id, match.team2_id, 10)
    team1_h2h_wins = sum(1 for m in h2h if m.winner_id == match.team1_id)

    context = {
        "venue_batting_first_win_pct": float(venue.avg_first_innings_score or 175) / 200,
        "team1_batting_avg_at_venue": float(venue.avg_first_innings_score or 165),
        "team2_batting_avg_at_venue": float(venue.avg_second_innings_score or 162),
        "team1_recent_win_pct": 0.5,
        "team2_recent_win_pct": 0.5,
        "h2h_team1_wins": team1_h2h_wins,
        "h2h_total": max(1, len(h2h)),
        "toss_winner_is_team1": 1 if match.toss_winner_id == match.team1_id else 0,
        "toss_decision_bat": 1 if match.toss_decision == "Bat" else 0,
        "team1_avg_score_last5": float(venue.avg_first_innings_score or 165),
        "team2_avg_score_last5": float(venue.avg_second_innings_score or 162),
    }

    result = predict_prematch_win_prob(context)

    key_factors = []
    if float(venue.spin_assistance_rating or 5) > 7:
        key_factors.append(f"Spin-friendly pitch ({venue.city}) favors spin-heavy side")
    if len(h2h) >= 3:
        key_factors.append(f"Head-to-head: Team1 won {team1_h2h_wins}/{len(h2h)} last meetings")
    if match.toss_decision == "Field":
        key_factors.append("Dew factor expected — fielding first is advantageous")

    return {
        "team1_id": str(match.team1_id),
        "team1_name": match.team1.name,
        "team1_win_prob": result["team1_win_prob"],
        "team2_id": str(match.team2_id),
        "team2_name": match.team2.name,
        "team2_win_prob": result["team2_win_prob"],
        "confidence": result["confidence"],
        "key_factors": key_factors,
    }


def get_matchup_analysis(
    db: Session,
    batter_ids: list[str],
    bowler_ids: list[str],
    phase: str = "All",
) -> dict:
    """Compute matchup matrix for pre-match planning."""
    from uuid import UUID
    df = get_matchup_matrix(batter_ids, bowler_ids, phase)

    matchups = []
    danger_matchups = []
    key_threats = []

    if not df.empty:
        for _, row in df.iterrows():
            sr = float(row.get("strike_rate", 130))
            wkt_prob = float(row.get("wicket_prob", 0.055))
            advantage = (
                "Batter" if sr > 150 and wkt_prob < 0.04
                else "Bowler" if sr < 110 and wkt_prob > 0.07
                else "Neutral"
            )
            cell = {
                "batter_id": row["batter_id"],
                "bowler_id": row["bowler_id"],
                "phase": phase,
                "balls_faced": int(row.get("balls_faced", 0)),
                "strike_rate": sr,
                "wicket_probability": wkt_prob,
                "boundary_probability": float(row.get("boundary_prob", 0.25)),
                "confidence": str(row.get("confidence", "Low")),
                "advantage": advantage,
            }
            matchups.append(cell)
            if advantage == "Batter":
                danger_matchups.append(cell)
            elif advantage == "Bowler":
                key_threats.append(cell)

    return {
        "phase": phase,
        "matchups": matchups,
        "danger_matchups": sorted(danger_matchups, key=lambda x: -x["strike_rate"])[:5],
        "key_threats": sorted(key_threats, key=lambda x: -x["wicket_probability"])[:5],
    }
