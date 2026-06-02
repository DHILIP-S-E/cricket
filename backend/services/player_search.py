"""
Semantic player search using Gemini embeddings (text-embedding-004).

Natural-language scouting: "aggressive top-order batter", "death-overs bowler".
The player corpus is embedded once and cached in memory; queries are embedded
and ranked by cosine similarity. With no GEMINI/GOOGLE key, falls back to a
plain name/role text match so the endpoint always works.
"""
from __future__ import annotations

import logging
import os

import numpy as np
from sqlalchemy.orm import Session

from models import Player

logger = logging.getLogger(__name__)

_EMBED_MODEL = os.environ.get("GEMINI_EMBED_MODEL", "models/text-embedding-004")
_KEY = (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or "").strip()

# in-memory cache: (ids, names, matrix)
_INDEX: dict | None = None


def embeddings_available() -> bool:
    return bool(_KEY)


def _embed(texts: list[str]) -> np.ndarray | None:
    try:
        import google.generativeai as genai
        genai.configure(api_key=_KEY)
        out = genai.embed_content(model=_EMBED_MODEL, content=texts)
        vecs = out["embedding"]
        if vecs and isinstance(vecs[0], float):  # single string returned flat
            vecs = [vecs]
        return np.array(vecs, dtype=float)
    except Exception:
        logger.exception("Gemini embedding failed")
        return None


def _player_text(p: Player) -> str:
    cs = p.career_stats if hasattr(p, "career_stats") else None
    bits = [p.full_name, p.playing_role.value]
    if p.ipl_caps:
        bits.append(f"{p.ipl_caps} IPL caps")
    return " · ".join(bits)


def _build_index(db: Session) -> dict | None:
    players = db.query(Player).all()
    texts = [_player_text(p) for p in players]
    mat = _embed(texts)
    if mat is None:
        return None
    return {
        "ids": [str(p.id) for p in players],
        "names": [p.full_name for p in players],
        "roles": [p.playing_role.value for p in players],
        "matrix": mat,
    }


def search(db: Session, query: str, limit: int = 10) -> dict:
    global _INDEX
    if not embeddings_available():
        return {"semantic": False, "results": _text_fallback(db, query, limit)}

    if _INDEX is None:
        _INDEX = _build_index(db)
    if _INDEX is None:
        return {"semantic": False, "results": _text_fallback(db, query, limit)}

    qv = _embed([query])
    if qv is None:
        return {"semantic": False, "results": _text_fallback(db, query, limit)}

    mat = _INDEX["matrix"]
    sims = mat @ qv[0] / (np.linalg.norm(mat, axis=1) * np.linalg.norm(qv[0]) + 1e-9)
    top = np.argsort(-sims)[:limit]
    return {
        "semantic": True,
        "results": [
            {"player_id": _INDEX["ids"][i], "full_name": _INDEX["names"][i],
             "playing_role": _INDEX["roles"][i], "score": round(float(sims[i]), 3)}
            for i in top
        ],
    }


def _text_fallback(db: Session, query: str, limit: int) -> list[dict]:
    rows = (db.query(Player)
            .filter(Player.full_name.ilike(f"%{query}%"))
            .limit(limit).all())
    return [{"player_id": str(p.id), "full_name": p.full_name,
             "playing_role": p.playing_role.value, "score": None} for p in rows]
