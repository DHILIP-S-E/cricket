"""
Auction decision engine — bid recommendations and squad optimization.
Called by the auction router on every lot change.
"""
from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.orm import Session

from crud.auction import get_team_state, get_auction_strategy, get_upcoming_lots
from crud.player import get_player_profile, get_player_form, get_player_rating, get_player_valuation
from crud.tournament import get_squad
from ml.serve import predict_player_valuation, optimize_playing_xi

logger = logging.getLogger(__name__)


def get_bid_recommendation(
    db: Session,
    session_id: UUID,
    franchise_id: UUID,
    lot_player_id: UUID,
    season_id: UUID,
) -> dict:
    """
    Generate a bid recommendation for the current lot player.
    Returns structured recommendation with max bid, reasoning, and alternatives.
    """
    team_state = get_team_state(db, session_id, franchise_id)
    player = get_player_profile(db, lot_player_id)
    form = get_player_form(db, lot_player_id)
    rating = get_player_rating(db, lot_player_id)
    valuation = get_player_valuation(db, lot_player_id, season_id)

    if not player or not team_state:
        return {"should_bid": False, "reasoning": "Insufficient data."}

    remaining_budget = float(team_state.remaining_budget_cr)
    remaining_slots = team_state.squad_size_max - team_state.squad_size
    overseas_remaining = team_state.overseas_slots_max - team_state.overseas_slots_used

    # Check hard constraints
    # NOTE: source data has nationality == "Other" for everyone, so treat only
    # explicitly non-India/Other nationalities as overseas (else every squad
    # would hit the 4-overseas cap and the auction couldn't fill 25-man squads).
    is_overseas = player.nationality not in ("India", "Other")
    if is_overseas and overseas_remaining <= 0:
        return {
            "should_bid": False,
            "reasoning": f"Overseas quota full ({team_state.overseas_slots_max}/{team_state.overseas_slots_max}). Cannot bid.",
        }
    if remaining_slots <= 0:
        return {"should_bid": False, "reasoning": "Squad is full (25 players)."}
    if remaining_budget < float(player.career_stats.batting_avg if player.career_stats else 0.20):
        return {"should_bid": False, "reasoning": f"Budget too low (₹{remaining_budget:.2f} Cr remaining)."}

    # Get or compute fair value
    if valuation:
        fair_value = float(valuation.fair_market_value_cr)
        conf_low = float(valuation.confidence_low_cr or fair_value * 0.7)
        conf_high = float(valuation.confidence_high_cr or fair_value * 1.4)
    else:
        player_features = _extract_player_features(player, form, rating)
        val_result = predict_player_valuation(player_features)
        fair_value = val_result["fair_value_cr"]
        conf_low = val_result["confidence_low_cr"]
        conf_high = val_result["confidence_high_cr"]

    # Max bid: fair value + premium for need, capped at 60% of remaining budget
    strategy_entry = _get_strategy_priority(db, session_id, franchise_id, lot_player_id)
    need_premium = _compute_need_premium(team_state, player)
    max_bid = min(
        fair_value * (1 + need_premium),
        remaining_budget * 0.60,
    )
    max_bid = round(max(conf_low, max_bid), 2)

    # Should bid?
    should_bid = max_bid >= conf_low

    # Squad impact analysis
    squad_impact = _analyze_squad_impact(team_state, player)

    # Reasoning
    reasoning = _build_reasoning(
        player, fair_value, max_bid, need_premium,
        team_state, strategy_entry,
    )

    return {
        "player_id": str(lot_player_id),
        "player_name": player.full_name,
        "fair_value_cr": fair_value,
        "recommended_max_bid_cr": max_bid,
        "confidence_low_cr": conf_low,
        "confidence_high_cr": conf_high,
        "confidence": "High" if rating and rating.overall_rating > 70 else "Medium",
        "should_bid": should_bid,
        "reasoning": reasoning,
        "budget_after_bid_cr": round(remaining_budget - max_bid, 2),
        "squad_impact": squad_impact,
        "alternatives": [],
    }


def _extract_player_features(player, form, rating) -> dict:
    cs = player.career_stats
    return {
        "batting_avg": float(cs.batting_avg or 0) if cs else 0,
        "batting_strike_rate": float(cs.batting_strike_rate or 0) if cs else 0,
        "batting_50s": cs.batting_50s if cs else 0,
        "batting_innings": cs.batting_innings if cs else 0,
        "bowling_wickets": cs.bowling_wickets if cs else 0,
        "bowling_economy": float(cs.bowling_economy or 8.5) if cs else 8.5,
        "bowling_avg": float(cs.bowling_avg or 30) if cs else 30,
        "overall_rating": float(rating.overall_rating) if rating else 50,
        "ipl_caps": player.ipl_caps,
        "international_caps": player.international_caps,
        "is_overseas": 1 if player.nationality != "India" else 0,
        "playing_role_enc": _role_enc(str(player.playing_role)),
        "form_score": float(form.form_score) if form else 0.5,
    }


def _role_enc(role: str) -> int:
    mapping = {
        "Top-order Batter": 0, "Middle-order Batter": 1,
        "Batting All-rounder": 2, "Bowling All-rounder": 3,
        "Wicket-keeper Batter": 4, "Pace Bowler": 5, "Spin Bowler": 6,
    }
    return mapping.get(role, 0)


def _compute_need_premium(team_state, player) -> float:
    """How much extra to pay above fair value based on squad needs."""
    role = str(player.playing_role)
    premium = 0.0

    if role == "Wicket-keeper Batter" and team_state.wk_count == 0:
        premium = 0.30  # Desperate need
    elif role in ("Pace Bowler", "Bowling All-rounder") and team_state.bowler_count < 3:
        premium = 0.20
    elif role in ("Batting All-rounder",) and team_state.all_rounder_count < 2:
        premium = 0.15

    # Slots premium — if few slots left, be more selective
    remaining_slots = team_state.squad_size_max - team_state.squad_size
    if remaining_slots <= 3:
        premium *= 0.5

    return premium


def _get_strategy_priority(db, session_id, franchise_id, player_id) -> str | None:
    strategies = get_auction_strategy(db, session_id, franchise_id)
    for s in strategies:
        if str(s.target_player_id) == str(player_id):
            return s.tier
    return None


def _analyze_squad_impact(team_state, player) -> str:
    role = str(player.playing_role)
    parts = []
    if role == "Wicket-keeper Batter" and team_state.wk_count == 0:
        parts.append("Fills critical WK slot")
    if role in ("Pace Bowler", "Spin Bowler") and team_state.bowler_count < 4:
        parts.append(f"Adds bowling depth (currently {team_state.bowler_count} bowlers)")
    if player.nationality != "India":
        parts.append(f"Uses overseas slot ({team_state.overseas_slots_used+1}/{team_state.overseas_slots_max})")
    return "; ".join(parts) if parts else "Strengthens squad balance"


def _build_reasoning(player, fair_value, max_bid, premium, team_state, strategy_tier) -> str:
    lines = [
        f"AI Fair Value: ₹{fair_value:.2f} Cr | Recommended Max: ₹{max_bid:.2f} Cr",
        f"Remaining Budget: ₹{team_state.remaining_budget_cr:.2f} Cr | Squad: {team_state.squad_size}/{team_state.squad_size_max}",
    ]
    if strategy_tier:
        lines.append(f"Pre-auction priority: {strategy_tier}")
    if premium > 0:
        lines.append(f"Squad-need premium applied: +{int(premium*100)}%")
    return " | ".join(lines)
