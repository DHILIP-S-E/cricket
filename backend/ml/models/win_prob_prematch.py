"""
Pre-Match Win Probability Model — CatBoost Classifier
Runs on-demand before each match starts.
Target: P(team1 wins) given match context (venue, form, toss).
"""
from __future__ import annotations

import logging
from pathlib import Path

import joblib  # safe: self-authored artifacts loaded from controlled local path
import numpy as np
import pandas as pd
from catboost import CatBoostClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, log_loss

from ..features import (
    PREMATCH_WP_FEATURES,
    PREMATCH_WP_LABEL,
    load_prematch_win_prob_data,
)

logger = logging.getLogger(__name__)

CATBOOST_PARAMS = {
    "iterations": 500,
    "learning_rate": 0.05,
    "depth": 6,
    "loss_function": "Logloss",
    "eval_metric": "AUC",
    "random_seed": 42,
    "verbose": 0,
    "early_stopping_rounds": 50,
}


def train(db_url: str, artifact_dir: Path = Path("ml_artifacts")) -> dict:
    artifact_dir.mkdir(parents=True, exist_ok=True)
    model_path = artifact_dir / "win_prob_prematch.joblib"

    df = load_prematch_win_prob_data(db_url)
    if len(df) < 200:
        logger.warning("Insufficient data for pre-match WP model (%d rows). Skipping.", len(df))
        return {"status": "skipped", "rows": len(df)}

    X = df[PREMATCH_WP_FEATURES].astype(float)
    y = df[PREMATCH_WP_LABEL].astype(int)

    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.15, random_state=42, stratify=y
    )

    model = CatBoostClassifier(**CATBOOST_PARAMS)
    model.fit(
        X_train, y_train,
        eval_set=(X_val, y_val),
        verbose=False,
    )

    proba = model.predict_proba(X_val)[:, 1]
    auc = roc_auc_score(y_val, proba)
    ll = log_loss(y_val, proba)

    feature_importance = dict(zip(PREMATCH_WP_FEATURES, model.get_feature_importance()))
    top_features = sorted(feature_importance.items(), key=lambda x: -x[1])[:5]
    logger.info("Pre-match WP — AUC: %.4f | LogLoss: %.4f | Top features: %s", auc, ll, top_features)

    joblib.dump({
        "model": model,
        "features": PREMATCH_WP_FEATURES,
        "feature_importance": feature_importance,
        "version": "1.0",
    }, model_path)
    logger.info("Saved to %s", model_path)

    return {
        "status": "ok",
        "auc": round(auc, 4),
        "log_loss": round(ll, 4),
        "rows": len(df),
        "top_features": top_features,
    }


def predict(match_context: dict, artifact_dir: Path = Path("ml_artifacts")) -> dict:
    """
    Predict pre-match win probability.

    Args:
        match_context: dict with keys matching PREMATCH_WP_FEATURES

    Returns:
        {"team1_win_prob": float, "team2_win_prob": float, "confidence": str}
    """
    model_path = artifact_dir / "win_prob_prematch.joblib"
    if not model_path.exists():
        return {"team1_win_prob": 0.50, "team2_win_prob": 0.50, "confidence": "none"}

    artifact = joblib.load(model_path)
    model = artifact["model"]
    features = artifact["features"]

    row = pd.DataFrame([{f: match_context.get(f, 0) for f in features}]).astype(float)
    proba = float(model.predict_proba(row)[0, 1])
    proba = round(max(0.05, min(0.95, proba)), 4)

    confidence = "High" if abs(proba - 0.5) > 0.15 else "Medium" if abs(proba - 0.5) > 0.07 else "Low"

    return {
        "team1_win_prob": proba,
        "team2_win_prob": round(1 - proba, 4),
        "confidence": confidence,
    }
