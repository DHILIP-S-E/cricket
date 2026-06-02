"""
Gemini Scout — a tool-using (function-calling) agent.

The user asks a natural-language question ("who are the best uncapped bowlers?",
"what's Kohli worth?", "how's the auction going?"). The agent, powered by Gemini
via a JSON tool-loop, decides which backend TOOLS to call, runs them against the
real database/ML, observes the results, and answers — a perceive → plan → act →
observe loop. Provider-agnostic (uses llm_agent.complete_json); when no LLM key
is set it falls back to a simple keyword router so the endpoint still responds.
"""
from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.orm import Session

from crud.auction import get_active_sessions
from crud.player import get_player_profile, get_player_form, get_player_rating
from models import Player, AuctionLot, AuctionSession
from ml.serve import predict_player_valuation
from services.auction_service import _extract_player_features
from services import llm_agent

logger = logging.getLogger(__name__)

MAX_STEPS = 4

_SYSTEM = (
    "You are the Scout, an AI assistant for a T20 franchise's analysts. "
    "Answer the user's question by calling tools to fetch real data, then giving a concise answer. "
    "You have these tools:\n"
    "  find_players(name?: str, limit?: int) — search players by (partial) name\n"
    "  get_valuation(name: str) — the ML fair market value (Cr) for a player\n"
    "  auction_status() — current auction: sold/unsold counts and latest sold players\n"
    "Respond with ONLY a JSON object, one of:\n"
    '  {"action":"tool","tool":"<name>","args":{...}}  — to call a tool\n'
    '  {"action":"final","answer":"<your answer>"}      — when you can answer\n'
    "Call at most a few tools, then finalize. Ground every claim in tool results."
)


# ── tools ───────────────────────────────────────────────────────────────

def _find_players(db: Session, name: str | None = None, limit: int = 8) -> list[dict]:
    q = db.query(Player)
    if name:
        q = q.filter(Player.full_name.ilike(f"%{name}%"))
    rows = q.limit(min(int(limit or 8), 15)).all()
    return [{"name": p.full_name, "role": p.playing_role.value,
             "ipl_caps": p.ipl_caps} for p in rows]


def _get_valuation(db: Session, name: str) -> dict:
    p = db.query(Player).filter(Player.full_name.ilike(f"%{name}%")).first()
    if not p:
        return {"error": f"No player matching '{name}'."}
    prof = get_player_profile(db, p.id)
    try:
        feats = _extract_player_features(prof, get_player_form(db, p.id), get_player_rating(db, p.id))
        val = predict_player_valuation(feats)
    except Exception:
        logger.exception("valuation tool failed")
        return {"error": "valuation unavailable"}
    return {"name": p.full_name, "role": p.playing_role.value,
            "fair_value_cr": val.get("fair_value_cr"),
            "range_cr": [val.get("confidence_low_cr"), val.get("confidence_high_cr")]}


def _auction_status(db: Session) -> dict:
    sessions = get_active_sessions(db)
    if not sessions:
        return {"active_auction": False}
    s = sessions[0]
    sold = (db.query(AuctionLot)
            .filter(AuctionLot.session_id == s.id, AuctionLot.is_sold == True)
            .order_by(AuctionLot.auction_ended_at.desc()).limit(5).all())
    return {
        "active_auction": True,
        "name": s.name,
        "players_sold": s.total_players_sold,
        "players_unsold": s.total_players_unsold,
        "recent_sold": [
            {"player": l.player.full_name, "price_cr": float(l.final_price_cr or 0),
             "to": l.sold_to.short_name if l.sold_to else None}
            for l in sold
        ],
    }


def _run_tool(db: Session, tool: str, args: dict) -> dict | list:
    try:
        if tool == "find_players":
            return _find_players(db, args.get("name"), args.get("limit", 8))
        if tool == "get_valuation":
            return _get_valuation(db, args.get("name", ""))
        if tool == "auction_status":
            return _auction_status(db)
        return {"error": f"unknown tool '{tool}'"}
    except Exception:
        logger.exception("scout tool error")
        return {"error": "tool execution failed"}


# ── agent loop ──────────────────────────────────────────────────────────

def ask_scout(db: Session, question: str) -> dict:
    if not llm_agent.llm_available():
        return {"available": False, "answer": _fallback(db, question),
                "provider": "none", "steps": []}

    transcript: list[dict] = []
    for _ in range(MAX_STEPS):
        user = _build_user(question, transcript)
        plan = llm_agent.complete_json(_SYSTEM, user)
        if not plan:
            break
        if plan.get("action") == "final" or "answer" in plan:
            return {"available": True, "answer": plan.get("answer", ""),
                    "provider": llm_agent.provider_name(), "steps": transcript}
        tool, args = plan.get("tool"), plan.get("args", {}) or {}
        result = _run_tool(db, tool, args)
        transcript.append({"tool": tool, "args": args, "result": result})

    return {"available": True,
            "answer": "I gathered data but couldn't finalise an answer — try rephrasing.",
            "provider": llm_agent.provider_name(), "steps": transcript}


def _build_user(question: str, transcript: list[dict]) -> str:
    import json
    parts = [f"User question: {question}"]
    if transcript:
        parts.append("Tool results so far:")
        for t in transcript:
            parts.append(f"- {t['tool']}({t['args']}) -> {json.dumps(t['result'])[:500]}")
    parts.append("Decide the next tool call or give your final answer as JSON.")
    return "\n".join(parts)


def _fallback(db: Session, question: str) -> str:
    """No LLM key: best-effort keyword routing so the endpoint still helps."""
    q = question.lower()
    if any(w in q for w in ("auction", "sold", "bought", "budget")):
        st = _auction_status(db)
        if not st["active_auction"]:
            return "No active auction right now."
        return (f"Auction '{st['name']}': {st['players_sold']} sold, "
                f"{st['players_unsold']} unsold. Set a Gemini key for full Scout reasoning.")
    # try to treat the question as a player name
    rows = _find_players(db, question.strip(), 5)
    if rows:
        names = ", ".join(r["name"] for r in rows[:5])
        return f"Players matching that: {names}. (Set GEMINI_API_KEY to enable the reasoning Scout.)"
    return "Set GEMINI_API_KEY in backend/.env to enable the AI Scout's natural-language reasoning."
