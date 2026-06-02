"""
Injury Risk Model — LightGBM Classifier
Classifies players as Low / Medium / High injury risk.
Runs as a nightly batch job.
"""
from __future__ import annotations

import logging
from pathlib import Path

import joblib  # safe: self-authored artifacts loaded from controlled local path
import pandas as pd
import numpy as np
from lightgbm import LGBMClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from sklearn.preprocessing import LabelEncoder

from ..features import INJURY_FEATURES, INJURY_LABEL, load_injury_risk_data

logger = logging.getLogger(__name__)

RISK_LEVELS = ["Low", "Medium", "High"]


def train(db_url: str, artifact_dir: Path = Path("ml_artifacts")) -> dict:
    artifact_dir.mkdir(parents=True, exist_ok=True)

    df = load_injury_risk_data(db_url)
    if len(df) < 50:
        logger.warning("Insufficient data for injury risk model (%d rows). Skipping.", len(df))
        return {"status": "skipped", "rows": len(df)}

    X = df[INJURY_FEATURES].astype(float)
    y = df[INJURY_LABEL].astype(int)

    # For binary injury_prone_flag we train binary; in production this
    # becomes a 3-class model once workload labels are collected
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.20, random_state=42
    )

    model = LGBMClassifier(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=4,
        num_leaves=15,
        min_child_samples=20,
        class_weight="balanced",
        n_jobs=-1,
        random_state=42,
        verbose=-1,
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_val)
    report = classification_report(y_val, preds, output_dict=True)
    logger.info("Injury risk model trained. Report: %s", report)

    joblib.dump({
        "model": model,
        "features": INJURY_FEATURES,
        "version": "1.0",
    }, artifact_dir / "injury_risk.joblib")

    return {"status": "ok", "rows": len(df), "report": report}


def predict_batch(players: list[dict], artifact_dir: Path = Path("ml_artifacts")) -> list[dict]:
    """
    Predict injury risk for a list of players.
    Returns each player dict augmented with risk_level and risk_score.
    """
    model_path = artifact_dir / "injury_risk.joblib"
    if not model_path.exists():
        for p in players:
            p["risk_level"] = "Low"
            p["risk_score"] = 0.1
        return players

    artifact = joblib.load(model_path)
    model = artifact["model"]
    features = artifact["features"]

    rows = [{f: p.get(f, 0) for f in features} for p in players]
    X = pd.DataFrame(rows).astype(float)

    probas = model.predict_proba(X)[:, 1]

    results = []
    for player, prob in zip(players, probas):
        risk = "High" if prob > 0.65 else "Medium" if prob > 0.35 else "Low"
        results.append({**player, "risk_level": risk, "risk_score": round(float(prob), 4)})

    return results
