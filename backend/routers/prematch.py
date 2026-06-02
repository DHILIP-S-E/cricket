from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from core.database import get_db
from services.prematch_service import (
    get_xi_recommendation,
    get_prematch_win_probability,
    get_matchup_analysis,
    get_prematch_advisor,
)
from schemas.prematch import (
    PlayingXIRecommendationOut, WinProbabilityOut, MatchupMatrixOut,
)
from schemas.response import APIResponse

router = APIRouter(prefix="/prematch", tags=["Pre-Match Intelligence"])


@router.get("/{match_id}/xi-recommendation", response_model=APIResponse[PlayingXIRecommendationOut])
def xi_recommendation(
    match_id: UUID,
    franchise_id: UUID = Query(...),
    season_id: UUID = Query(...),
    db: Session = Depends(get_db),
):
    """
    Recommend optimal Playing XI for a franchise in a given match.
    Requires the squad to be loaded for that season.
    """
    result = get_xi_recommendation(db, match_id, franchise_id, season_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return APIResponse(data=result)


@router.get("/{match_id}/win-probability", response_model=APIResponse[WinProbabilityOut])
def win_probability(match_id: UUID, db: Session = Depends(get_db)):
    """Pre-match win probability for both teams."""
    result = get_prematch_win_probability(db, match_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return APIResponse(data=result)


@router.get("/{match_id}/advisor", response_model=APIResponse[dict])
def prematch_advisor(match_id: UUID, db: Session = Depends(get_db)):
    """AI Coach agent: LLM pre-match briefing (falls back to ML factors if no LLM key)."""
    return APIResponse(data=get_prematch_advisor(db, match_id))


@router.post("/matchups", response_model=APIResponse[MatchupMatrixOut])
def matchup_matrix(
    batter_ids: list[str],
    bowler_ids: list[str],
    phase: str = Query("All", pattern="^(All|Powerplay|Middle|Death)$"),
    db: Session = Depends(get_db),
):
    """
    Compute batter vs bowler matchup matrix.
    Pass lists of player UUIDs for batters and bowlers.
    """
    result = get_matchup_analysis(db, batter_ids, bowler_ids, phase)
    return APIResponse(data=result)
