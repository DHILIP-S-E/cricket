"""
Training orchestrator — trains all models in sequence.

Usage:
    DATABASE_URL=postgres://... python -m ml.train
    DATABASE_URL=postgres://... python -m ml.train --models live_wp valuation
    DATABASE_URL=postgres://... python -m ml.train --artifact-dir /srv/ml_artifacts
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("ml.train")


ALL_MODELS = ["live_wp", "prematch_wp", "valuation", "injury_risk"]


def train_all(db_url: str, models: list[str], artifact_dir: Path) -> dict:
    results = {}

    if "live_wp" in models:
        logger.info("=== Training: Live Win Probability ===")
        from .models.win_prob_live import train
        results["live_wp"] = train(db_url, artifact_dir)

    if "prematch_wp" in models:
        logger.info("=== Training: Pre-Match Win Probability ===")
        from .models.win_prob_prematch import train
        results["prematch_wp"] = train(db_url, artifact_dir)

    if "valuation" in models:
        logger.info("=== Training: Player Valuation ===")
        from .models.valuation import train
        results["valuation"] = train(db_url, artifact_dir)

    if "injury_risk" in models:
        logger.info("=== Training: Injury Risk ===")
        from .models.injury_risk import train
        results["injury_risk"] = train(db_url, artifact_dir)

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Train cricket ML models")
    parser.add_argument(
        "--models", nargs="+", default=ALL_MODELS,
        choices=ALL_MODELS,
        help="Which models to train (default: all)",
    )
    parser.add_argument(
        "--artifact-dir", type=Path,
        default=Path("ml_artifacts"),
        help="Where to save trained model files",
    )
    args = parser.parse_args()

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        logger.error("DATABASE_URL environment variable is not set.")
        sys.exit(1)

    logger.info("Training models: %s", args.models)
    results = train_all(db_url, args.models, args.artifact_dir)

    logger.info("Training complete. Results:")
    print(json.dumps(results, indent=2, default=str))

    failed = [k for k, v in results.items() if isinstance(v, dict) and v.get("status") == "skipped"]
    if failed:
        logger.warning(
            "These models were skipped due to insufficient data: %s. "
            "Run the Cricsheet ingestion pipeline first, then re-train.",
            failed,
        )


if __name__ == "__main__":
    main()
