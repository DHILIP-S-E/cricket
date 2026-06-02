from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user, verify_franchise_access
from models.user import User
from crud.auction import (
    get_session, get_active_sessions, get_all_team_states,
    get_team_state, get_current_lot, get_lots, get_upcoming_lots,
    get_lot_bids, create_bid,
)
from services.auction_service import get_bid_recommendation
from services.auction_engine import (
    open_auction, tick as engine_tick, user_bid as engine_user_bid, pass_lot as engine_pass,
    advisor as engine_advisor, set_autopilot as engine_autopilot,
)
from schemas.auction import (
    AuctionSessionOut, AuctionLotOut, TeamAuctionStateOut,
    BidOut, BidIn, BidRecommendationOut, AuctionQueueItem,
)
from schemas.player import PlayerOut
from schemas.response import APIResponse, PaginatedResponse

router = APIRouter(prefix="/auction", tags=["Auction War Room"])


# ── Interactive auction engine (live game loop) ───────────────────────────

@router.post("/sessions/{session_id}/open", response_model=APIResponse[dict])
def open_session(session_id: UUID, franchise_id: UUID = Query(...), db: Session = Depends(get_db)):
    """Reset & start the interactive auction for this user franchise; present lot #1."""
    result = open_auction(db, session_id, str(franchise_id))
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return APIResponse(data=result, message="Auction opened")


@router.post("/sessions/{session_id}/tick", response_model=APIResponse[dict])
def tick_session(session_id: UUID, db: Session = Depends(get_db)):
    """Advance the auction one beat: a rival agent bids, or the hammer falls."""
    result = engine_tick(db, session_id)
    if "error" in result:
        raise HTTPException(status_code=409, detail=result["error"])
    return APIResponse(data=result)


@router.post("/sessions/{session_id}/user-bid", response_model=APIResponse[dict])
def user_bid_session(
    session_id: UUID,
    payload: BidIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The human franchise raises the bid on the current lot."""
    verify_franchise_access(current_user, payload.franchise_id)
    result = engine_user_bid(db, session_id, payload.franchise_id, float(payload.bid_amount_cr))
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return APIResponse(data=result, message="Bid placed")


@router.post("/sessions/{session_id}/pass", response_model=APIResponse[dict])
def pass_session(session_id: UUID, db: Session = Depends(get_db)):
    """Bring the hammer down now (sell to highest bidder, or mark unsold)."""
    result = engine_pass(db, session_id)
    if "error" in result:
        raise HTTPException(status_code=409, detail=result["error"])
    return APIResponse(data=result)


@router.get("/sessions/{session_id}/advisor", response_model=APIResponse[dict])
def auction_advisor(session_id: UUID, franchise_id: UUID = Query(...), db: Session = Depends(get_db)):
    """AI Advisor agent: LLM reasoning on the current lot (falls back to ML if no LLM key)."""
    return APIResponse(data=engine_advisor(db, session_id, franchise_id))


@router.post("/sessions/{session_id}/autopilot", response_model=APIResponse[dict])
def auction_autopilot(session_id: UUID, on: bool = Query(...), db: Session = Depends(get_db)):
    """Toggle the AI auto-pilot agent — it bids for the user franchise autonomously."""
    result = engine_autopilot(db, session_id, on)
    if "error" in result:
        raise HTTPException(status_code=409, detail=result["error"])
    return APIResponse(data=result, message=f"Auto-pilot {'on' if on else 'off'}")


@router.get("/sessions/active", response_model=APIResponse[list[AuctionSessionOut]])
def list_active_sessions(db: Session = Depends(get_db)):
    sessions = get_active_sessions(db)
    return APIResponse(data=[_map_session(s) for s in sessions])


@router.get("/sessions/{session_id}", response_model=APIResponse[AuctionSessionOut])
def get_auction_session(session_id: UUID, db: Session = Depends(get_db)):
    session = get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Auction session not found")
    return APIResponse(data=_map_session(session))


@router.get("/sessions/{session_id}/teams", response_model=APIResponse[list[TeamAuctionStateOut]])
def team_states(session_id: UUID, db: Session = Depends(get_db)):
    states = get_all_team_states(db, session_id)
    return APIResponse(data=[_map_team_state(s) for s in states])


@router.get("/sessions/{session_id}/teams/{franchise_id}", response_model=APIResponse[TeamAuctionStateOut])
def team_state(session_id: UUID, franchise_id: UUID, db: Session = Depends(get_db)):
    state = get_team_state(db, session_id, franchise_id)
    if not state:
        raise HTTPException(status_code=404, detail="Team state not found")
    return APIResponse(data=_map_team_state(state))


@router.get("/sessions/{session_id}/current-lot", response_model=APIResponse[AuctionLotOut])
def current_lot(session_id: UUID, db: Session = Depends(get_db)):
    lot = get_current_lot(db, session_id)
    if not lot:
        raise HTTPException(status_code=404, detail="No active lot at this time")
    return APIResponse(data=_map_lot(lot))


@router.get("/sessions/{session_id}/recommendation/{franchise_id}", response_model=APIResponse[BidRecommendationOut])
def bid_recommendation(
    session_id: UUID,
    franchise_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_franchise_access(current_user, franchise_id)
    session = get_session(db, session_id)
    if not session or not session.current_lot_player_id:
        raise HTTPException(status_code=404, detail="No active lot")

    rec = get_bid_recommendation(
        db=db,
        session_id=session_id,
        franchise_id=franchise_id,
        lot_player_id=session.current_lot_player_id,
        season_id=session.season_id,
    )
    return APIResponse(data=rec)


@router.get("/sessions/{session_id}/queue", response_model=APIResponse[list[AuctionQueueItem]])
def auction_queue(session_id: UUID, limit: int = Query(10, le=50), db: Session = Depends(get_db)):
    lots = get_upcoming_lots(db, session_id, limit)
    items = [
        AuctionQueueItem(
            lot_number=lot.lot_number,
            player=PlayerOut.model_validate(lot.player),
            base_price_cr=float(lot.base_price_cr),
        )
        for lot in lots
    ]
    return APIResponse(data=items)


@router.get("/sessions/{session_id}/lots", response_model=PaginatedResponse[AuctionLotOut])
def list_lots(
    session_id: UUID,
    is_sold: bool | None = None,
    page: int = 1,
    size: int = 50,
    db: Session = Depends(get_db),
):
    lots, total = get_lots(db, session_id, is_sold=is_sold, page=page, size=size)
    return PaginatedResponse(data=[_map_lot(l) for l in lots], total=total, page=page, size=size)


@router.get("/lots/{lot_id}/bids", response_model=APIResponse[list[BidOut]])
def lot_bids(lot_id: UUID, db: Session = Depends(get_db)):
    bids = get_lot_bids(db, lot_id)
    return APIResponse(data=[
        BidOut(
            id=b.id,
            franchise_id=b.franchise_id,
            franchise_short_name=b.franchise.short_name,
            bid_amount_cr=float(b.bid_amount_cr),
            bid_time=b.bid_time,
            is_rtm=b.is_rtm,
        )
        for b in bids
    ])


@router.post("/bids", response_model=APIResponse[BidOut])
def place_bid(
    payload: BidIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify the caller is authorised to bid on behalf of this franchise.
    # franchise_id from the body is validated against the authenticated user — not blindly trusted.
    verify_franchise_access(current_user, payload.franchise_id)
    bid = create_bid(db, payload.lot_id, payload.franchise_id, float(payload.bid_amount_cr), payload.is_rtm)
    return APIResponse(
        message="Bid recorded",
        data=BidOut(
            id=bid.id,
            franchise_id=bid.franchise_id,
            franchise_short_name=bid.franchise.short_name if bid.franchise else "",
            bid_amount_cr=float(bid.bid_amount_cr),
            bid_time=bid.bid_time,
            is_rtm=bid.is_rtm,
        ),
    )


# ── Internal mappers ──────────────────────────────────────────────

def _map_session(s) -> AuctionSessionOut:
    return AuctionSessionOut(
        id=s.id,
        season_id=s.season_id,
        name=s.name,
        status=str(s.status),
        auction_date=s.auction_date,
        total_players_sold=s.total_players_sold,
        total_players_unsold=s.total_players_unsold,
        current_bid_amount_cr=float(s.current_bid_amount_cr) if s.current_bid_amount_cr else None,
        current_highest_bidder_id=s.current_highest_bidder_id,
    )


def _map_lot(lot) -> AuctionLotOut:
    return AuctionLotOut(
        id=lot.id,
        lot_number=lot.lot_number,
        set_number=lot.set_number,
        player=PlayerOut.model_validate(lot.player),
        base_price_cr=float(lot.base_price_cr),
        final_price_cr=float(lot.final_price_cr) if lot.final_price_cr else None,
        is_sold=lot.is_sold,
        is_unsold=lot.is_unsold,
        sold_to_franchise_id=lot.sold_to_franchise_id,
        sold_to_franchise_name=lot.sold_to.name if lot.sold_to else None,
        rtm_used=lot.rtm_used,
    )


def _map_team_state(s) -> TeamAuctionStateOut:
    return TeamAuctionStateOut(
        franchise_id=s.franchise_id,
        franchise_name=s.franchise.name,
        franchise_short_name=s.franchise.short_name,
        initial_purse_cr=float(s.initial_purse_cr),
        remaining_budget_cr=float(s.remaining_budget_cr),
        squad_size=s.squad_size,
        squad_size_max=s.squad_size_max,
        overseas_slots_used=s.overseas_slots_used,
        overseas_slots_max=s.overseas_slots_max,
        wk_count=s.wk_count,
        batter_count=s.batter_count,
        bowler_count=s.bowler_count,
        all_rounder_count=s.all_rounder_count,
        rtm_available=s.rtm_available,
        rtm_count=s.rtm_count,
        players_bought=s.players_bought or [],
    )
