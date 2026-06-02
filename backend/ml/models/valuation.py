"""
Player Valuation Model — CatBoost Regressor
Predicts fair market value (INR Crore) for auction planning.
Includes confidence interval via quantile regression.
"""
from __future__ import annotations

import logging
from pathlib import Path

import joblib  # safe: self-authored artifacts loaded from controlled local path
import numpy as np
import pandas as pd
from catboost import CatBoostRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score

from ..features import VALUATION_FEATURES, VALUATION_LABEL, load_player_valuation_data

logger = logging.getLogger(__name__)


def train(db_url: str, artifact_dir: Path = Path("ml_artifacts")) -> dict:
    artifact_dir.mkdir(parents=True, exist_ok=True)

    df = load_player_valuation_data(db_url)
    if len(df) < 50:
        logger.warning("Insufficient data for valuation model (%d rows). Skipping.", len(df))
        return {"status": "skipped", "rows": len(df)}

    X = df[VALUATION_FEATURES].astype(float)
    y = df[VALUATION_LABEL].astype(float)

    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.15, random_state=42)

    # Point estimate
    model = CatBoostRegressor(
        iterations=400, learning_rate=0.05, depth=6,
        loss_function="RMSE", random_seed=42, verbose=0,
    )
    model.fit(X_train, y_train, eval_set=(X_val, y_val), verbose=False)

    # Quantile models for confidence interval (10th and 90th percentiles)
    model_lo = CatBoostRegressor(
        iterations=300, learning_rate=0.05, depth=5,
        loss_function="Quantile:alpha=0.10", random_seed=42, verbose=0,
    )
    model_lo.fit(X_train, y_train)

    model_hi = CatBoostRegressor(
        iterations=300, learning_rate=0.05, depth=5,
        loss_function="Quantile:alpha=0.90", random_seed=42, verbose=0,
    )
    model_hi.fit(X_train, y_train)

    preds = model.predict(X_val)
    mae = mean_absolute_error(y_val, preds)
    r2 = r2_score(y_val, preds)

    logger.info("Valuation — MAE: %.2f Cr | R²: %.4f (val set %d rows)", mae, r2, len(y_val))

    joblib.dump({
        "model": model, "model_lo": model_lo, "model_hi": model_hi,
        "features": VALUATION_FEATURES, "version": "1.0",
    }, artifact_dir / "valuation.joblib")

    return {"status": "ok", "mae_cr": round(mae, 3), "r2": round(r2, 4), "rows": len(df)}


def predict_player(player_features: dict, artifact_dir: Path = Path("ml_artifacts")) -> dict:
    """
    Returns:
        {
          "fair_value_cr": float,
          "confidence_low_cr": float,
          "confidence_high_cr": float,
          "budget_efficiency": float,   # value / suggested_price
        }
    """
    model_path = artifact_dir / "valuation.joblib"
    if not model_path.exists():
        return _fallback_valuation(player_features)

    artifact = joblib.load(model_path)
    row = pd.DataFrame([{f: player_features.get(f, 0) for f in artifact["features"]}]).astype(float)

    val = float(artifact["model"].predict(row)[0])
    lo  = float(artifact["model_lo"].predict(row)[0])
    hi  = float(artifact["model_hi"].predict(row)[0])

    val = round(max(0.20, val), 2)
    lo  = round(max(0.20, min(lo, val)), 2)
    hi  = round(max(val, hi), 2)

    return {
        "fair_value_cr": val,
        "confidence_low_cr": lo,
        "confidence_high_cr": hi,
        "budget_efficiency": 1.0,
    }


def _fallback_valuation(features: dict) -> dict:
    rating = features.get("overall_rating", 50)
    caps = features.get("ipl_caps", 0)
    val = round(max(0.20, rating / 25 + caps * 0.05), 2)
    return {
        "fair_value_cr": val,
        "confidence_low_cr": round(val * 0.7, 2),
        "confidence_high_cr": round(val * 1.5, 2),
        "budget_efficiency": 1.0,
    }
