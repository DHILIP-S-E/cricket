"""
LLM agent layer — true natural-language reasoning for the platform's agents.

Provider-agnostic and OPTIONAL:
  - If GEMINI_API_KEY / GOOGLE_API_KEY is set → uses Google Gemini (default).
  - elif ANTHROPIC_API_KEY is set             → uses Claude.
  - elif OPENAI_API_KEY is set                → uses OpenAI.
  - else  → llm_available() is False and callers fall back to the deterministic
            ML/template path, so the app works with or without a key.

Set in backend/.env (Gemini):
    GEMINI_API_KEY=AIza...
    # optional override (default: gemini-2.0-flash)
    GEMINI_MODEL=gemini-2.0-flash
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

_GEMINI_KEY = (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or "").strip()
_ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()
_OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "").strip()

_GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash").strip()
_MODEL = os.environ.get("LLM_MODEL", "claude-haiku-4-5-20251001").strip()
_OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip()

_PROVIDER = (
    "gemini" if _GEMINI_KEY
    else "anthropic" if _ANTHROPIC_KEY
    else "openai" if _OPENAI_KEY
    else None
)


def llm_available() -> bool:
    return _PROVIDER is not None


def provider_name() -> str:
    return _PROVIDER or "none"


def complete(system: str, user: str, max_tokens: int = 400) -> str | None:
    """
    Single-shot completion. Returns the model's text, or None if no provider
    is configured or the call fails (caller should fall back gracefully).
    """
    if _PROVIDER == "gemini":
        return _gemini(system, user, max_tokens)
    if _PROVIDER == "anthropic":
        return _anthropic(system, user, max_tokens)
    if _PROVIDER == "openai":
        return _openai(system, user, max_tokens)
    return None


def complete_json(system: str, user: str, max_tokens: int = 600) -> dict | None:
    """Structured output — returns a parsed JSON object, or None on failure.

    Uses Gemini's JSON response mode when available; otherwise instructs the
    model to emit JSON and parses it defensively.
    """
    import json
    import re

    if _PROVIDER == "gemini":
        try:
            import google.generativeai as genai
            genai.configure(api_key=_GEMINI_KEY)
            model = genai.GenerativeModel(_GEMINI_MODEL, system_instruction=system)
            resp = model.generate_content(
                user,
                generation_config={
                    "max_output_tokens": max_tokens,
                    "temperature": 0.4,
                    "response_mime_type": "application/json",
                },
            )
            return json.loads((getattr(resp, "text", "") or "").strip())
        except Exception:
            logger.exception("Gemini JSON completion failed")
            return None

    # Anthropic / OpenAI: ask for JSON, then extract the first {...} block.
    raw = complete(system + "\nRespond with ONLY a single valid JSON object.", user, max_tokens)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                return None
    return None


def _gemini(system: str, user: str, max_tokens: int) -> str | None:
    try:
        import google.generativeai as genai
        genai.configure(api_key=_GEMINI_KEY)
        model = genai.GenerativeModel(_GEMINI_MODEL, system_instruction=system)
        resp = model.generate_content(
            user,
            generation_config={"max_output_tokens": max_tokens, "temperature": 0.7},
        )
        return (getattr(resp, "text", "") or "").strip() or None
    except Exception:
        logger.exception("Gemini completion failed")
        return None


def _anthropic(system: str, user: str, max_tokens: int) -> str | None:
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=_ANTHROPIC_KEY)
        resp = client.messages.create(
            model=_MODEL,
            max_tokens=max_tokens,
            # Cache the (stable) system prompt to cut cost on repeated calls.
            system=[{"type": "text", "text": system,
                     "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user}],
        )
        parts = [b.text for b in resp.content if getattr(b, "type", None) == "text"]
        return "".join(parts).strip() or None
    except Exception:
        logger.exception("Anthropic completion failed")
        return None


def _openai(system: str, user: str, max_tokens: int) -> str | None:
    try:
        from openai import OpenAI
        client = OpenAI(api_key=_OPENAI_KEY)
        resp = client.chat.completions.create(
            model=_OPENAI_MODEL,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        return (resp.choices[0].message.content or "").strip() or None
    except Exception:
        logger.exception("OpenAI completion failed")
        return None
