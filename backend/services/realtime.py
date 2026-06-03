"""
Shared real-time loop runner.

This is the heart of the "server drives the simulation" model. Instead of the
browser polling an endpoint on a timer, the *server* runs one background task
per active room (an auction session or a live match), steps the engine on its
own clock, and pushes each new state to every connected client.

Generic on purpose: the auction and the live match both plug a `step` callable
into the same runner. `step` is a *synchronous* function (it does blocking DB
work) and is executed in a worker thread so it never stalls the event loop.

    step() -> (payload: dict | None, finished: bool)
        payload  : the state snapshot to broadcast (None = nothing changed)
        finished : True once the simulation is over → the loop stops itself

State is in-memory and single-process (fine for dev / one server). If the
process restarts, running loops stop and their rooms reset — see the engines'
own notes on durability.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Awaitable, Callable

logger = logging.getLogger(__name__)

# A step returns the snapshot to broadcast (or None) and whether it's finished.
StepFn = Callable[[], "tuple[dict | None, bool]"]
BroadcastFn = Callable[[dict], Awaitable[None]]


class RoomRunner:
    """Owns the background loop task for each room, keyed by room id."""

    def __init__(self) -> None:
        self._tasks: dict[str, asyncio.Task] = {}

    def is_running(self, room: str) -> bool:
        task = self._tasks.get(room)
        return task is not None and not task.done()

    async def start(
        self,
        room: str,
        step: StepFn,
        broadcast: BroadcastFn,
        interval: float,
    ) -> None:
        """Start (or no-op if already running) the loop for `room`."""
        if self.is_running(room):
            return
        loop = asyncio.get_running_loop()
        self._tasks[room] = loop.create_task(
            self._run(room, step, broadcast, interval)
        )
        logger.info("realtime loop started: room=%s interval=%.2fs", room, interval)

    async def _run(
        self,
        room: str,
        step: StepFn,
        broadcast: BroadcastFn,
        interval: float,
    ) -> None:
        try:
            while True:
                await asyncio.sleep(interval)
                try:
                    payload, finished = await asyncio.to_thread(step)
                except Exception:
                    logger.exception("realtime step failed: room=%s", room)
                    continue
                if payload is not None:
                    try:
                        await broadcast(payload)
                    except Exception:
                        logger.exception("realtime broadcast failed: room=%s", room)
                if finished:
                    logger.info("realtime loop finished: room=%s", room)
                    break
        except asyncio.CancelledError:  # graceful stop()
            pass
        finally:
            self._tasks.pop(room, None)

    async def stop(self, room: str) -> None:
        """Cancel and await the loop for `room` (no-op if not running)."""
        task = self._tasks.pop(room, None)
        if task and not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        logger.info("realtime loop stopped: room=%s", room)


# Process-wide singleton shared by every real-time surface.
runner = RoomRunner()
