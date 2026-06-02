"""
WebSocket endpoints for real-time updates.

/ws/auction/{session_id}  — auction war room live feed
/ws/live/{match_id}       — live match ball-by-ball feed
"""
from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)
router = APIRouter(tags=["WebSockets"])


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


# ── Auction WebSocket ─────────────────────────────────────────────

@router.websocket("/ws/auction/{session_id}")
async def auction_ws(session_id: UUID, ws: WebSocket):
    """
    Real-time auction room. Clients receive updates whenever:
    - A new lot starts
    - A bid is placed
    - A lot is sold/unsold
    - Any team budget changes

    Push from server → client only (read-only feed).
    Bid actions go through the REST endpoint POST /auction/bids.
    """
    room = f"auction:{session_id}"
    await manager.connect(room, ws)
    try:
        await ws.send_json({"type": "connected", "room": room, "clients": manager.room_size(room)})
        while True:
            # Keep alive — clients can ping us
            try:
                data = await asyncio.wait_for(ws.receive_text(), timeout=30.0)
                if data == "ping":
                    await ws.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                await ws.send_json({"type": "heartbeat"})
    except WebSocketDisconnect:
        manager.disconnect(room, ws)


# ── Live Match WebSocket ──────────────────────────────────────────

@router.websocket("/ws/live/{match_id}")
async def live_match_ws(match_id: UUID, ws: WebSocket):
    """
    Ball-by-ball live match feed. Receives updates after every ball is recorded
    via POST /live/{match_id}/ball. Clients get:
    - Updated live state (score, wickets, overs)
    - Current win probability
    - Tactical recommendations
    """
    room = f"live:{match_id}"
    await manager.connect(room, ws)
    try:
        await ws.send_json({"type": "connected", "room": room, "clients": manager.room_size(room)})
        while True:
            try:
                data = await asyncio.wait_for(ws.receive_text(), timeout=30.0)
                if data == "ping":
                    await ws.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                await ws.send_json({"type": "heartbeat"})
    except WebSocketDisconnect:
        manager.disconnect(room, ws)


async def push_auction_update(session_id: str, payload: dict) -> None:
    """Call this after any auction state change to push to all connected clients."""
    await manager.broadcast(f"auction:{session_id}", {"type": "auction_update", **payload})


async def push_live_update(match_id: str, payload: dict) -> None:
    """Call this after every ball to push to all connected live-match clients."""
    await manager.broadcast(f"live:{match_id}", {"type": "ball_update", **payload})
