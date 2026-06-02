"""
Live Win Probability Model — LightGBM Regressor
Updates every ball during a live match.
Target: P(batting team wins) given current match state.
Inference time: <10ms
"""
from __future__ import annotations

import logging
from pathlib import Path

import joblib  # safe: models are trained by us and written to a controlled local path; never loaded from user input
import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, log_loss
from sklearn.calibration import CalibratedClassifierCV

from ..features import (
    LIVE_WP_FEATURES,
    LIVE_WP_LABEL,
    load_live_win_prob_data,
)

logger = logging.getLogger(__name__)

MODEL_PATH = Path("ml_artifacts/live_win_prob.joblib")


LGBM_PARAMS = {
    "n_estimators": 500,
    "learning_rate": 0.05,
    "max_depth": 6,
    "num_leaves": 31,
    "min_child_samples": 50,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "reg_alpha": 0.1,
    "reg_lambda": 0.1,
    "n_jobs": -1,
    "random_state": 42,
    "verbose": -1,
}


def train(db_url: str, artifact_dir: Path = Path("ml_artifacts")) -> dict:
    artifact_dir.mkdir(parents=True, exist_ok=True)
    model_path = artifact_dir / "live_win_prob.joblib"

    df = load_live_win_prob_data(db_url)
    if len(df) < 1000:
        logger.warning("Insufficient data for live WP model (%d rows). Skipping.", len(df))
        return {"status": "skipped", "rows": len(df)}

    X = df[LIVE_WP_FEATURES].astype(float)
    y = df[LIVE_WP_LABEL].astype(int)

    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.15, random_state=42, stratify=y
    )

    base = LGBMClassifier(**LGBM_PARAMS)
    # Platt scaling for probability calibration
    model = CalibratedClassifierCV(base, method="isotonic", cv=3)
    model.fit(X_train, y_train)

    proba = model.predict_proba(X_val)[:, 1]
    auc = roc_auc_score(y_val, proba)
    ll = log_loss(y_val, proba)

    logger.info("Live WP — AUC: %.4f | LogLoss: %.4f (val set %d rows)", auc, ll, len(y_val))

    joblib.dump({"model": model, "features": LIVE_WP_FEATURES, "version": "1.0"}, model_path)
    logger.info("Saved to %s", model_path)

    return {"status": "ok", "auc": round(auc, 4), "log_loss": round(ll, 4), "rows": len(df)}


def predict(state: dict, artifact_dir: Path = Path("ml_artifacts")) -> float:
    """
    Predict win probability from a live match state dict.
    Returns P(batting team wins) as a float 0–1.

    state keys must include LIVE_WP_FEATURES.
    """
    model_path = artifact_dir / "live_win_prob.joblib"
    if not model_path.exists():
        # Fallback: simple run-rate-based heuristic
        return _heuristic_win_prob(state)

    artifact = joblib.load(model_path)
    model = artifact["model"]
    features = artifact["features"]

    row = pd.DataFrame([{f: state.get(f, 0) for f in features}]).astype(float)
    prob = float(model.predict_proba(row)[0, 1])
    return round(max(0.01, min(0.99, prob)), 4)


def _heuristic_win_prob(state: dict) -> float:
    """Simple heuristic when model is not yet trained."""
    balls_remaining = state.get("balls_remaining", 60)
    runs_required = state.get("runs_required", 60)
    wickets_remaining = state.get("wickets_remaining", 10)

    if balls_remaining <= 0:
        return 0.01 if runs_required > 0 else 0.99
    if runs_required <= 0:
        return 0.99

    rrr = runs_required / (balls_remaining / 6.0)
    wkt_factor = wickets_remaining / 10.0

    # Simple sigmoid: lower RRR + more wickets → higher probability
    prob = 1 / (1 + np.exp(0.35 * (rrr - 9) - 0.5 * (wkt_factor - 0.5)))
    return round(float(np.clip(prob, 0.01, 0.99)), 4)
