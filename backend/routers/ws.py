"""
WebSocket endpoints for real-time updates.

/ws/auction/{session_id}  — auction war room: server-driven loop + live actions
/ws/live/{match_id}       — live match ball-by-ball feed

The auction socket is now the *control channel* for the real-time game:
clients send actions (start / claim / bid / pass / autopilot) and receive
pushed `auction_state` snapshots. A single server-side loop (RoomRunner) ticks
the engine on its own clock and broadcasts — the browser no longer polls.
"""
from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from typing import Any
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

import time

from core.database import SessionLocal
from services import auction_engine as ae
from services.simulation_service import start_simulation, step_ball, reset_simulation
from services.realtime import runner

logger = logging.getLogger(__name__)
router = APIRouter(tags=["WebSockets"])

AUCTION_TICK_INTERVAL = 1.8  # seconds between server-driven auction steps
LIVE_BASE_TICK = 0.35        # fine base tick; actual ball pace set per-match below


class ConnectionManager:
    """Pub/sub connection manager for WebSocket groups."""

    def __init__(self):
        self._rooms: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, room: str, ws: WebSocket) -> None:
        await ws.accept()
        self._rooms[room].add(ws)
        logger.info("WS connected: room=%s total=%d", room, len(self._rooms[room]))

    def disconnect(self, room: str, ws: WebSocket) -> None:
        self._rooms[room].discard(ws)
        if not self._rooms[room]:
            del self._rooms[room]
        logger.info("WS disconnected: room=%s remaining=%d", room, len(self._rooms.get(room, set())))

    async def broadcast(self, room: str, payload: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for ws in list(self._rooms.get(room, set())):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(room, ws)

    def room_size(self, room: str) -> int:
        return len(self._rooms.get(room, set()))


manager = ConnectionManager()


# ── auth helper ───────────────────────────────────────────────────────

def _resolve_user(token: str | None) -> dict | None:
    """Decode a ?token= JWT into {user_id, name, franchise_id, is_admin}.

    Returns None for spectators (no/invalid token) — they can watch but not act.
    """
    if not token:
        return None
    from core.security import decode_access_token
    from crud.user import get_user_by_id
    from core.dependencies import ADMIN_ROLES
    db = SessionLocal()
    try:
        payload = decode_access_token(token)
        if payload.get("type") != "access":
            return None
        user = get_user_by_id(db, int(payload["sub"]))
        if not user or not user.is_active:
            return None
        return {
            "user_id": str(user.id),
            "name": user.full_name or user.email,
            "franchise_id": str(user.franchise_id) if user.franchise_id else None,
            "is_admin": user.is_superuser or str(user.role) in ADMIN_ROLES,
        }
    except Exception:
        return None
    finally:
        db.close()


def _may_act_for(user: dict | None, franchise_id: str) -> bool:
    """A user may act for their own franchise; admins for any. Spectators: no."""
    if not user:
        return False
    if user["is_admin"]:
        return True
    return user.get("franchise_id") == franchise_id


# ── Auction real-time glue ────────────────────────────────────────────

def _auction_room(session_id: UUID) -> str:
    return f"auction:{session_id}"


def _auction_step(session_id: UUID):
    """Build the per-tick step the RoomRunner calls (runs in a worker thread)."""
    def step():
        db = SessionLocal()
        try:
            snap = ae.tick(db, session_id)
            if "error" in snap:
                return None, True  # engine closed → stop the loop
            return {"type": "auction_state", **snap}, bool(snap.get("finished"))
        finally:
            db.close()
    return step


async def _ensure_auction_loop(session_id: UUID) -> None:
    room = _auction_room(session_id)
    await runner.start(
        room,
        _auction_step(session_id),
        lambda payload: manager.broadcast(room, payload),
        AUCTION_TICK_INTERVAL,
    )


async def _run_action(fn, *args) -> dict:
    """Execute a sync engine action off the event loop and return its snapshot."""
    return await asyncio.to_thread(_action_in_session, fn, *args)


def _action_in_session(fn, *args) -> dict:
    db = SessionLocal()
    try:
        return fn(db, *args)
    finally:
        db.close()


async def _handle_auction_action(session_id: UUID, user: dict | None, msg: dict) -> dict | None:
    """Apply one inbound action; return a snapshot to broadcast (or None)."""
    action = msg.get("action")
    fid = msg.get("franchise_id")

    if action == "start":
        # The opener's franchise seat (their own, or an explicit one for admins).
        opener_fid = fid or (user.get("franchise_id") if user else None)
        snap = await _run_action(ae.open_auction, session_id, opener_fid)
        await _ensure_auction_loop(session_id)
        return snap

    if action == "claim":
        if not fid or not _may_act_for(user, fid):
            return {"error": "Not authorized to claim this franchise."}
        return await _run_action(ae.claim_seat, session_id, UUID(fid),
                                 user["user_id"], user["name"])

    if action == "release":
        if not fid or not _may_act_for(user, fid):
            return {"error": "Not authorized."}
        return await _run_action(ae.release_seat, session_id, UUID(fid))

    if action == "autopilot":
        if not fid or not _may_act_for(user, fid):
            return {"error": "Not authorized."}
        return await _run_action(ae.set_seat_autopilot, session_id, UUID(fid), bool(msg.get("on")))

    if action == "bid":
        if not fid or not _may_act_for(user, fid):
            return {"error": "Not authorized to bid for this franchise."}
        amount = float(msg.get("amount", 0))
        return await _run_action(ae.user_bid, session_id, UUID(fid), amount)

    if action == "pass":
        return await _run_action(ae.pass_lot, session_id)

    return None


@router.websocket("/ws/auction/{session_id}")
async def auction_ws(session_id: UUID, ws: WebSocket):
    """
    Real-time auction control channel.

    Inbound (client → server): JSON actions
      {"action":"start"} | {"action":"claim","franchise_id":...}
      {"action":"bid","franchise_id":...,"amount":...} | {"action":"pass"}
      {"action":"autopilot","franchise_id":...,"on":true} | "ping"
    Outbound (server → client): {"type":"auction_state", ...snapshot}
    """
    room = _auction_room(session_id)
    token = ws.query_params.get("token")
    user = _resolve_user(token)
    await manager.connect(room, ws)
    try:
        await ws.send_json({"type": "connected", "room": room,
                            "clients": manager.room_size(room),
                            "you": user and {"name": user["name"],
                                             "franchise_id": user["franchise_id"]}})
        # If the auction is already live, start/keep the loop and send current state.
        if ae.is_open(session_id):
            await _ensure_auction_loop(session_id)
            snap = await asyncio.to_thread(_action_in_session, ae.current_snapshot, session_id)
            if snap:
                await ws.send_json({"type": "auction_state", **snap})

        while True:
            raw = await ws.receive_text()
            if raw == "ping":
                await ws.send_json({"type": "pong"})
                continue
            try:
                import json
                msg = json.loads(raw)
            except Exception:
                continue
            snap = await _handle_auction_action(session_id, user, msg)
            if snap is None:
                continue
            if "error" in snap:
                await ws.send_json({"type": "action_error", "message": snap["error"]})
            else:
                await manager.broadcast(room, {"type": "auction_state", **snap})
    except WebSocketDisconnect:
        manager.disconnect(room, ws)
        # No viewers left → stop the server loop (AI auction has no audience).
        if manager.room_size(room) == 0:
            await runner.stop(room)


# ── Live Match real-time glue ─────────────────────────────────────────

# Per-match playback state for the server-driven ball clock.
_LIVE: dict[str, dict] = {}  # match_id -> {"playing","interval","next_at"}


def _live_room(match_id: UUID) -> str:
    return f"live:{match_id}"


def _live_state(match_id: UUID) -> dict:
    return _LIVE.setdefault(str(match_id), {"playing": False, "interval": 0.9, "next_at": 0.0})


def _live_step(match_id: UUID):
    """Server clock: when 'playing' and the next ball is due, bowl one and push."""
    def step():
        st = _live_state(match_id)
        if not st["playing"]:
            return None, False
        now = time.monotonic()
        if now < st["next_at"]:
            return None, False
        st["next_at"] = now + st["interval"]
        db = SessionLocal()
        try:
            res = step_ball(db, match_id)
        finally:
            db.close()
        if "error" in res:
            st["playing"] = False
            return None, False
        if res.get("innings_over"):
            st["playing"] = False  # auto-stop the chase; loop idles until disconnect
        return {"type": "live_state", **res}, False
    return step


async def _ensure_live_loop(match_id: UUID) -> None:
    room = _live_room(match_id)
    await runner.start(
        room,
        _live_step(match_id),
        lambda payload: manager.broadcast(room, payload),
        LIVE_BASE_TICK,
    )


async def _handle_live_action(match_id: UUID, msg: dict) -> dict | None:
    action = msg.get("action")
    st = _live_state(match_id)

    if action == "start":
        snap = await _run_action(start_simulation, match_id)
        st["playing"] = False
        return None if "error" in snap else {"type": "live_state", **snap}

    if action == "play":
        st["playing"] = True
        st["next_at"] = time.monotonic()
        return None

    if action == "pause":
        st["playing"] = False
        return None

    if action == "step":  # one manual ball
        snap = await _run_action(step_ball, match_id)
        if "error" in snap:
            return {"type": "action_error", "message": snap["error"]}
        return {"type": "live_state", **snap}

    if action == "reset":
        await _run_action(reset_simulation, match_id)
        st["playing"] = False
        return {"type": "live_reset"}

    if action == "speed":
        st["interval"] = max(0.2, float(msg.get("interval", 0.9)))
        return None

    return None


@router.websocket("/ws/live/{match_id}")
async def live_match_ws(match_id: UUID, ws: WebSocket):
    """
    Real-time ball-by-ball match. The server bowls each ball on its own clock
    and pushes `live_state`. Clients send {"action":"play|pause|step|reset|start"}
    or {"action":"speed","interval":0.6}.
    """
    room = _live_room(match_id)
    await manager.connect(room, ws)
    try:
        await ws.send_json({"type": "connected", "room": room, "clients": manager.room_size(room)})
        await _ensure_live_loop(match_id)
        while True:
            raw = await ws.receive_text()
            if raw == "ping":
                await ws.send_json({"type": "pong"})
                continue
            try:
                import json
                msg = json.loads(raw)
            except Exception:
                continue
            out = await _handle_live_action(match_id, msg)
            if out is None:
                continue
            if out.get("type") == "action_error":
                await ws.send_json(out)
            else:
                await manager.broadcast(room, out)
    except WebSocketDisconnect:
        manager.disconnect(room, ws)
        if manager.room_size(room) == 0:
            _live_state(match_id)["playing"] = False
            await runner.stop(room)


async def push_auction_update(session_id: str, payload: dict) -> None:
    await manager.broadcast(f"auction:{session_id}", {"type": "auction_update", **payload})


async def push_live_update(match_id: str, payload: dict) -> None:
    await manager.broadcast(f"live:{match_id}", {"type": "ball_update", **payload})
