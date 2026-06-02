import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from core.config import settings
from core.database import SessionLocal
from core.logging_config import configure_logging
from middleware.request_id import RequestIDMiddleware
from routers import auth, user
from routers import players, auction, prematch, live, tournaments, ws
from routers import analytics

configure_logging()
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Cricket Decision Intelligence Platform",
    description="AI-powered T20 franchise decision engine — Auction · Pre-Match · Live",
    version="1.0.0",
    debug=settings.DEBUG,
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
)

app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "Internal server error", "data": None},
    )


# ── Auth & User (existing) ─────────────────────────────────────────
app.include_router(auth.router, prefix="/api/v1")
app.include_router(user.router, prefix="/api/v1")

# ── Cricket Platform ───────────────────────────────────────────────
app.include_router(players.router,     prefix="/api/v1")
app.include_router(auction.router,     prefix="/api/v1")
app.include_router(prematch.router,    prefix="/api/v1")
app.include_router(live.router,        prefix="/api/v1")
app.include_router(tournaments.router, prefix="/api/v1")
app.include_router(analytics.router,   prefix="/api/v1")

# ── WebSockets (no /api/v1 prefix — direct path routing) ──────────
app.include_router(ws.router)


@app.get("/health")
def health():
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    finally:
        db.close()
    status_code = 200 if db_ok else 503
    return JSONResponse(
        status_code=status_code,
        content={"status": "ok" if db_ok else "degraded", "db": db_ok},
    )


@app.get("/api/v1")
def api_root():
    return {
        "platform": "Cricket Decision Intelligence Platform",
        "version": "1.0.0",
        "surfaces": {
            "auction_war_room": "/api/v1/auction",
            "pre_match_planner": "/api/v1/prematch",
            "live_match_engine": "/api/v1/live",
            "players": "/api/v1/players",
            "tournaments": "/api/v1/tournaments",
        },
        "websockets": {
            "auction": "/ws/auction/{session_id}",
            "live_match": "/ws/live/{match_id}",
        },
        "docs": "/api/docs" if settings.DEBUG else "disabled in production",
    }
