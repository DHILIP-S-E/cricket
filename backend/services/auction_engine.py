"""
Interactive auction engine — the real auction *loop*.

Turns "place a bid → nothing happens" into a playable, AI-driven auction:
  - open():  reset the session, present lot #1.
  - tick():  the heartbeat. One step per call — either a rival AI agent
             counter-bids, or (after a few idle ticks) the lot is gavelled
             SOLD/UNSOLD and the next lot is presented.
  - user_bid(): the human franchise raises the bid; resets the countdown.
  - pass_lot(): bring the hammer down now (sell to highest, or unsold).

The 9 rival franchises are autonomous **Bidder Agents**: each evaluates the
current player against its own budget + squad needs using the existing ML
valuation (`get_bid_recommendation`), scaled by a per-franchise persona
"aggression". Reusing that engine makes the agents' decisions real, not random.

Transient per-lot state (countdown, cached agent max-bids) is held in memory;
durable facts (sold lots, budgets, squad counts) are persisted to the DB so
the existing read endpoints / page reflect them immediately.
"""
from __future__ import annotations

import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from crud.auction import (
    get_session, get_all_team_states, get_team_state, get_current_lot,
    get_upcoming_lots, create_bid,
)
from models import AuctionLot, AuctionSession, Player, TeamAuctionState
from services.auction_service import get_bid_recommendation
from services import llm_agent

logger = logging.getLogger(__name__)

MAX_IDLE_TICKS = 3          # ticks with no new bid before the hammer falls
RECENT_EVENTS = 10


# ── transient in-memory engine state, keyed by session id ──────────────
_ENGINE: dict[str, dict] = {}


def _persona_aggression(franchise_id: str) -> float:
    """Deterministic 0.85–1.24 aggression factor per franchise."""
    h = sum(ord(c) for c in franchise_id)
    return round(0.85 + (h % 40) / 100.0, 2)


def _increment_for(price: float) -> float:
    if price < 2:
        return 0.10
    if price < 5:
        return 0.20
    if price < 10:
        return 0.25
    return 0.50


def _is_overseas(player: Player) -> bool:
    return player.nationality not in ("India", "Other")


def _role_bucket(role_value: str) -> str:
    if role_value == "Wicket-keeper Batter":
        return "wk_count"
    if role_value in ("Pace Bowler", "Spin Bowler"):
        return "bowler_count"
    if role_value in ("Batting All-rounder", "Bowling All-rounder"):
        return "all_rounder_count"
    return "batter_count"


# ── lifecycle ──────────────────────────────────────────────────────────

def open_auction(db: Session, session_id: UUID, user_franchise_id: str | None) -> dict:
    """Reset the session to a clean state and present the first lot."""
    session = get_session(db, session_id)
    if not session:
        return {"error": "Auction session not found"}

    # Full reset for a clean, repeatable game.
    db.query(AuctionLot).filter(AuctionLot.session_id == session_id).update(
        {"is_sold": False, "is_unsold": False, "final_price_cr": None,
         "sold_to_franchise_id": None, "auction_ended_at": None},
        synchronize_session=False,
    )
    for ts in get_all_team_states(db, session_id):
        ts.remaining_budget_cr = ts.initial_purse_cr
        ts.players_bought = []
        ts.squad_size = 0
        ts.wk_count = ts.batter_count = ts.bowler_count = ts.all_rounder_count = 0
        ts.overseas_slots_used = 0
    session.status = "Active"
    session.total_players_sold = 0
    session.total_players_unsold = 0
    session.current_lot_player_id = None
    session.current_bid_amount_cr = None
    session.current_highest_bidder_id = None
    db.commit()

    _ENGINE[str(session_id)] = {
        "user_franchise_id": str(user_franchise_id) if user_franchise_id else None,
        "phase": "idle",
        "ticks_idle": 0,
        "increment": 0.10,
        "agent_max": {},        # franchise_id -> max bid this lot
        "events": [],
        "last_result": None,
    }
    return _present_next_lot(db, session_id)


def _present_next_lot(db: Session, session_id: UUID) -> dict:
    st = _ENGINE[str(session_id)]
    session = get_session(db, session_id)
    upcoming = get_upcoming_lots(db, session_id, limit=1)
    if not upcoming:
        st["phase"] = "finished"
        session.status = "Completed"
        session.current_lot_player_id = None
        session.current_bid_amount_cr = None
        session.current_highest_bidder_id = None
        db.commit()
        return _snapshot(db, session_id)

    lot = upcoming[0]
    session.current_lot_player_id = lot.player_id
    session.current_base_price_cr = lot.base_price_cr
    session.current_bid_amount_cr = None
    session.current_highest_bidder_id = None
    if not lot.auction_started_at:
        lot.auction_started_at = datetime.utcnow()
    db.commit()

    base = float(lot.base_price_cr)
    st["phase"] = "bidding"
    st["ticks_idle"] = 0
    st["increment"] = _increment_for(base)
    st["agent_max"] = _compute_agent_maxbids(db, session_id, lot)
    st["events"] = ([{"actor": "Auctioneer", "action": "presented",
                      "amount": base, "player": lot.player.full_name}]
                    + st["events"])[:RECENT_EVENTS]
    return _snapshot(db, session_id)


def _compute_agent_maxbids(db: Session, session_id: UUID, lot: AuctionLot) -> dict:
    """Each rival franchise's persona-scaled max bid for this lot (cached)."""
    st = _ENGINE[str(session_id)]
    session = get_session(db, session_id)
    user_fid = st["user_franchise_id"]
    out: dict[str, float] = {}
    for ts in get_all_team_states(db, session_id):
        fid = str(ts.franchise_id)
        if fid == user_fid:
            continue
        try:
            rec = get_bid_recommendation(db, session_id, ts.franchise_id,
                                         lot.player_id, session.season_id)
        except Exception:
            logger.exception("agent maxbid failed for %s", fid)
            rec = {"should_bid": False}
        if not rec.get("should_bid"):
            out[fid] = 0.0
            continue
        agg = _persona_aggression(fid)
        out[fid] = round(float(rec.get("recommended_max_bid_cr", 0)) * agg, 2)
    return out


# ── the heartbeat ───────────────────────────────────────────────────────

def tick(db: Session, session_id: UUID) -> dict:
    st = _ENGINE.get(str(session_id))
    if not st:
        return {"error": "Auction not open. Call open first."}
    phase = st["phase"]

    if phase in ("sold", "unsold"):
        return _present_next_lot(db, session_id)
    if phase == "finished":
        return _snapshot(db, session_id)
    if phase != "bidding":
        return _snapshot(db, session_id)

    session = get_session(db, session_id)
    lot = get_current_lot(db, session_id)
    if not lot:
        return _present_next_lot(db, session_id)

    price = float(session.current_bid_amount_cr) if session.current_bid_amount_cr else None
    base = float(lot.base_price_cr)
    highest = str(session.current_highest_bidder_id) if session.current_highest_bidder_id else None
    inc = st["increment"]
    next_price = round((price + inc) if price is not None else base, 2)

    # Which rival agent (if any) is willing to bid next_price?
    candidates = [
        (fid, mx) for fid, mx in st["agent_max"].items()
        if mx >= next_price and fid != highest and _has_room(db, session_id, fid)
    ]
    if candidates:
        # Most aggressive willing agent bids one increment.
        fid, _ = max(candidates, key=lambda kv: kv[1])
        create_bid(db, lot.id, UUID(fid), next_price)
        st["ticks_idle"] = 0
        name = _franchise_name(db, fid)
        st["events"] = ([{"actor": name, "action": "bid", "amount": next_price,
                          "player": lot.player.full_name}] + st["events"])[:RECENT_EVENTS]
        return _snapshot(db, session_id)

    # No agent willing → count down to the hammer.
    st["ticks_idle"] += 1
    if st["ticks_idle"] >= MAX_IDLE_TICKS:
        if highest:
            return _resolve_sold(db, session_id, lot, float(session.current_bid_amount_cr), highest)
        return _resolve_unsold(db, session_id, lot)
    return _snapshot(db, session_id)


def user_bid(db: Session, session_id: UUID, franchise_id: UUID, amount: float) -> dict:
    st = _ENGINE.get(str(session_id))
    if not st or st["phase"] != "bidding":
        return {"error": "No lot is currently up for bidding."}
    session = get_session(db, session_id)
    lot = get_current_lot(db, session_id)
    if not lot:
        return {"error": "No current lot."}

    price = float(session.current_bid_amount_cr) if session.current_bid_amount_cr else None
    min_next = round((price + st["increment"]) if price is not None else float(lot.base_price_cr), 2)
    if amount < min_next:
        return {"error": f"Bid must be at least ₹{min_next:.2f} Cr."}

    ts = get_team_state(db, session_id, franchise_id)
    if ts and amount > float(ts.remaining_budget_cr):
        return {"error": f"Insufficient budget (₹{float(ts.remaining_budget_cr):.2f} Cr left)."}

    create_bid(db, lot.id, franchise_id, amount)
    st["ticks_idle"] = 0
    st["events"] = ([{"actor": "You", "action": "bid", "amount": round(amount, 2),
                      "player": lot.player.full_name}] + st["events"])[:RECENT_EVENTS]
    return _snapshot(db, session_id)


def pass_lot(db: Session, session_id: UUID) -> dict:
    """Bring the hammer down now: sell to current highest, else unsold."""
    st = _ENGINE.get(str(session_id))
    if not st or st["phase"] != "bidding":
        return _snapshot(db, session_id) if st else {"error": "Auction not open."}
    session = get_session(db, session_id)
    lot = get_current_lot(db, session_id)
    if not lot:
        return _present_next_lot(db, session_id)
    highest = str(session.current_highest_bidder_id) if session.current_highest_bidder_id else None
    if highest:
        return _resolve_sold(db, session_id, lot, float(session.current_bid_amount_cr), highest)
    return _resolve_unsold(db, session_id, lot)


# ── resolution ──────────────────────────────────────────────────────────

def _resolve_sold(db: Session, session_id: UUID, lot: AuctionLot,
                  price: float, franchise_id: str) -> dict:
    st = _ENGINE[str(session_id)]
    session = get_session(db, session_id)
    player = db.query(Player).filter(Player.id == lot.player_id).first()
    ts = get_team_state(db, session_id, UUID(franchise_id))

    lot.is_sold = True
    lot.final_price_cr = price
    lot.sold_to_franchise_id = UUID(franchise_id)
    lot.auction_ended_at = datetime.utcnow()

    if ts:
        ts.remaining_budget_cr = float(ts.remaining_budget_cr) - price
        ts.squad_size += 1
        bucket = _role_bucket(player.playing_role.value if player else "Top-order Batter")
        setattr(ts, bucket, getattr(ts, bucket) + 1)
        if player and _is_overseas(player):
            ts.overseas_slots_used += 1
        bought = list(ts.players_bought or [])
        bought.append({"player_id": str(lot.player_id),
                       "player_name": player.full_name if player else "",
                       "price_cr": round(price, 2)})
        ts.players_bought = bought

    session.total_players_sold += 1
    session.current_lot_player_id = None
    session.current_bid_amount_cr = None
    session.current_highest_bidder_id = None
    db.commit()

    name = _franchise_name(db, franchise_id)
    st["phase"] = "sold"
    st["last_result"] = {"player_name": player.full_name if player else "",
                         "price_cr": round(price, 2), "sold_to_name": name, "sold": True}
    st["events"] = ([{"actor": name, "action": "SOLD", "amount": round(price, 2),
                      "player": player.full_name if player else ""}] + st["events"])[:RECENT_EVENTS]
    return _snapshot(db, session_id)


def _resolve_unsold(db: Session, session_id: UUID, lot: AuctionLot) -> dict:
    st = _ENGINE[str(session_id)]
    session = get_session(db, session_id)
    player = db.query(Player).filter(Player.id == lot.player_id).first()
    lot.is_unsold = True
    lot.auction_ended_at = datetime.utcnow()
    session.total_players_unsold += 1
    session.current_lot_player_id = None
    session.current_bid_amount_cr = None
    session.current_highest_bidder_id = None
    db.commit()
    st["phase"] = "unsold"
    st["last_result"] = {"player_name": player.full_name if player else "",
                         "price_cr": None, "sold_to_name": None, "sold": False}
    st["events"] = ([{"actor": "Auctioneer", "action": "UNSOLD", "amount": None,
                      "player": player.full_name if player else ""}] + st["events"])[:RECENT_EVENTS]
    return _snapshot(db, session_id)


# ── AI Advisor agent (LLM reasoning, grounded in the ML numbers) ──────────

_ADVISOR_SYSTEM = (
    "You are the AI auction strategist for an IPL-style T20 franchise. "
    "Give sharp, concise tactical advice grounded ONLY in the numbers given — "
    "do not invent stats. Speak directly to the team owner in 2-3 sentences. "
    "Then on a final line output exactly one of: 'CALL: BID', 'CALL: HOLD', or 'CALL: PASS'."
)


def advisor(db: Session, session_id: UUID, franchise_id: UUID) -> dict:
    """The user's AI coach: reasons about the current lot in natural language."""
    session = get_session(db, session_id)
    lot = get_current_lot(db, session_id)
    if not session or not lot:
        return {"available": False, "advice": "No lot is currently under the hammer.",
                "call": "HOLD", "provider": llm_agent.provider_name()}

    st = _ENGINE.get(str(session_id), {})
    price = (float(session.current_bid_amount_cr) if session.current_bid_amount_cr
             else float(lot.base_price_cr))
    highest = str(session.current_highest_bidder_id) if session.current_highest_bidder_id else None
    you_high = highest == str(franchise_id)

    try:
        rec = get_bid_recommendation(db, session_id, franchise_id, lot.player_id, session.season_id)
    except Exception:
        rec = {"should_bid": False}
    ts = get_team_state(db, session_id, franchise_id)

    facts = (
        f"Player: {lot.player.full_name} ({lot.player.playing_role.value})\n"
        f"Base price: Rs {float(lot.base_price_cr):.2f} Cr\n"
        f"Current bid: Rs {price:.2f} Cr ({'YOU are highest' if you_high else 'a rival is highest' if highest else 'no bids yet'})\n"
        f"AI fair value: Rs {rec.get('fair_value_cr', 0):.2f} Cr\n"
        f"AI recommended max bid: Rs {rec.get('recommended_max_bid_cr', 0):.2f} Cr\n"
        f"Your remaining budget: Rs {float(ts.remaining_budget_cr):.2f} Cr\n" if ts else ""
    )
    if ts:
        facts += (
            f"Your squad: {ts.squad_size}/{ts.squad_size_max} "
            f"(WK {ts.wk_count}, BAT {ts.batter_count}, BWL {ts.bowler_count}, ALR {ts.all_rounder_count})\n"
            f"AI verdict: {'worth bidding' if rec.get('should_bid') else 'not worth it'}"
        )

    text = llm_agent.complete(_ADVISOR_SYSTEM, facts, max_tokens=220)

    if text:
        call = "HOLD"
        for c in ("BID", "PASS", "HOLD"):
            if f"CALL: {c}" in text.upper():
                call = c
                break
        advice = text.split("CALL:")[0].strip()
        return {"available": True, "advice": advice, "call": call,
                "provider": llm_agent.provider_name()}

    # Fallback: no LLM key configured → use the ML recommendation directly.
    should = rec.get("should_bid")
    fallback = rec.get("reasoning") or (
        "Within fair value — worth a bid." if should else "Above value or squad-constrained — hold off."
    )
    return {"available": False, "advice": fallback,
            "call": "BID" if should else "PASS",
            "provider": "none"}


# ── helpers ─────────────────────────────────────────────────────────────

def _has_room(db: Session, session_id: UUID, franchise_id: str) -> bool:
    ts = get_team_state(db, session_id, UUID(franchise_id))
    return bool(ts and ts.squad_size < ts.squad_size_max)


def _franchise_name(db: Session, franchise_id: str) -> str:
    from models import Franchise
    f = db.query(Franchise).filter(Franchise.id == UUID(franchise_id)).first()
    return f.short_name if f else "?"


def _snapshot(db: Session, session_id: UUID) -> dict:
    st = _ENGINE[str(session_id)]
    session = get_session(db, session_id)
    lot = get_current_lot(db, session_id)
    user_fid = st["user_franchise_id"]
    highest = str(session.current_highest_bidder_id) if session.current_highest_bidder_id else None
    price = (float(session.current_bid_amount_cr)
             if session.current_bid_amount_cr else
             (float(lot.base_price_cr) if lot else None))

    lot_out = None
    if lot and st["phase"] == "bidding":
        lot_out = {
            "lot_number": lot.lot_number,
            "player_id": str(lot.player_id),
            "player_name": lot.player.full_name,
            "playing_role": lot.player.playing_role.value,
            "base_price_cr": float(lot.base_price_cr),
        }

    return {
        "phase": st["phase"],
        "lot": lot_out,
        "current_price_cr": round(price, 2) if price is not None else None,
        "increment_cr": st["increment"],
        "highest_bidder_id": highest,
        "highest_bidder_name": _franchise_name(db, highest) if highest else None,
        "user_is_highest": highest is not None and highest == user_fid,
        "countdown": max(0, MAX_IDLE_TICKS - st["ticks_idle"]),
        "max_countdown": MAX_IDLE_TICKS,
        "events": st["events"][:RECENT_EVENTS],
        "last_result": st["last_result"],
        "finished": st["phase"] == "finished",
        "total_sold": session.total_players_sold,
        "total_unsold": session.total_players_unsold,
    }
