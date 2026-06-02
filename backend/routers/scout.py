from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from schemas.response import APIResponse
from services.scout_agent import ask_scout

router = APIRouter(prefix="/scout", tags=["AI Scout"])


class ScoutQuestion(BaseModel):
    question: str


@router.post("/ask", response_model=APIResponse[dict])
def scout_ask(payload: ScoutQuestion, db: Session = Depends(get_db)):
    """Gemini Scout — a tool-using agent that answers questions over real data."""
    return APIResponse(data=ask_scout(db, payload.question))
