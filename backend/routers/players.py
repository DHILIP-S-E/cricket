from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from core.database import get_db
from crud.player import (
    get_players, get_player_profile, get_player_form,
    get_player_rating, get_player_valuation,
    get_player_matchups_as_batter, get_player_matchups_as_bowler,
)
from ml.serve import predict_player_valuation
from services.player_search import search as semantic_search
from schemas.player import (
    PlayerOut, PlayerProfileOut, PlayerFormOut,
    PlayerRatingOut, PlayerValuationOut, PlayerMatchupOut,
)
from schemas.response import APIResponse, PaginatedResponse

router = APIRouter(prefix="/players", tags=["Players"])


@router.get("/scout-search", response_model=APIResponse[dict])
def scout_search(q: str = Query(..., min_length=2), limit: int = 10, db: Session = Depends(get_db)):
    """Semantic player search via Gemini embeddings (falls back to text match)."""
    return APIResponse(data=semantic_search(db, q, limit))


@router.get("", response_model=PaginatedResponse[PlayerOut])
def list_players(
    q: str | None = Query(None, description="Search by name"),
    playing_role: str | None = None,
    nationality: str | None = None,
    min_ipl_caps: int | None = None,
    is_active: bool = True,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    players, total = get_players(
        db, playing_role=playing_role, nationality=nationality,
        min_ipl_caps=min_ipl_caps, is_active=is_active,
        q=q, page=page, size=size,
    )
    return PaginatedResponse(
        data=[PlayerOut.model_validate(p) for p in players],
        total=total,
        page=page,
        size=size,
    )


@router.get("/{player_id}", response_model=APIResponse[PlayerProfileOut])
def get_player(player_id: UUID, db: Session = Depends(get_db)):
    player = get_player_profile(db, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    form = get_player_form(db, player_id)
    rating = get_player_rating(db, player_id)
    valuation = get_player_valuation(db, player_id)

    profile = PlayerProfileOut.model_validate(player)
    profile.form = PlayerFormOut.model_validate(form) if form else None
    profile.rating = PlayerRatingOut.model_validate(rating) if rating else None
    profile.valuation = PlayerValuationOut.model_validate(valuation) if valuation else None

    return APIResponse(data=profile)


@router.get("/{player_id}/form", response_model=APIResponse[PlayerFormOut])
def player_form(player_id: UUID, db: Session = Depends(get_db)):
    form = get_player_form(db, player_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form data not yet computed for this player")
    return APIResponse(data=PlayerFormOut.model_validate(form))


@router.get("/{player_id}/valuation", response_model=APIResponse[PlayerValuationOut])
def player_valuation(player_id: UUID, db: Session = Depends(get_db)):
    valuation = get_player_valuation(db, player_id)
    if valuation:
        return APIResponse(data=PlayerValuationOut.model_validate(valuation))

    # Compute on-the-fly from ML model
    player = get_player_profile(db, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    cs = player.career_stats
    rating = get_player_rating(db, player_id)
    features = {
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
        "is_overseas": 0 if str(player.nationality) == "India" else 1,
        "playing_role_enc": 0,
    }
    result = predict_player_valuation(features)
    return APIResponse(data=PlayerValuationOut(
        fair_market_value_cr=result["fair_value_cr"],
        confidence_low_cr=result["confidence_low_cr"],
        confidence_high_cr=result["confidence_high_cr"],
        budget_efficiency_score=result["budget_efficiency"],
        model_version="1.0",
        computed_at=__import__('datetime').datetime.utcnow(),
    ))


@router.get("/{player_id}/matchups", response_model=APIResponse[list[PlayerMatchupOut]])
def player_matchups(
    player_id: UUID,
    as_role: str = Query("batter", pattern="^(batter|bowler)$"),
    phase: str = Query("All"),
    db: Session = Depends(get_db),
):
    if as_role == "batter":
        matchups = get_player_matchups_as_batter(db, player_id, phase)
    else:
        matchups = get_player_matchups_as_bowler(db, player_id, phase)
    return APIResponse(data=[PlayerMatchupOut.model_validate(m) for m in matchups])
