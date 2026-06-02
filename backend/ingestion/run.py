"""
CLI entry point for the Cricsheet ingestion pipeline.

Usage:
    DATABASE_URL=postgres://... python -m ingestion.run --leagues ipl bbl --data-dir /tmp/cricsheet
    DATABASE_URL=postgres://... python -m ingestion.run --leagues ipl --skip-download
    DATABASE_URL=postgres://... python -m ingestion.run --aggregate-only
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

from tqdm import tqdm

from .aggregator import run_all as run_aggregation
from .downloader import download_all
from .loader import IngestionSession
from .parser import parse_match_file

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("ingestion")


def main() -> None:
    parser = argparse.ArgumentParser(description="Cricsheet → PostgreSQL ingestion pipeline")
    parser.add_argument(
        "--leagues",
        nargs="+",
        default=["ipl"],
        choices=["ipl", "t20i", "bbl", "psl", "cpl", "sa20", "ilt20"],
        help="Leagues to ingest",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path("cricsheet_data"),
        help="Directory to store downloaded files",
    )
    parser.add_argument("--skip-download", action="store_true", help="Skip download, use existing files")
    parser.add_argument("--skip-aggregate", action="store_true", help="Skip post-load aggregation")
    parser.add_argument("--aggregate-only", action="store_true", help="Only run aggregation, skip ingestion")
    parser.add_argument("--force", action="store_true", help="Re-download even if files exist")
    args = parser.parse_args()

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        logger.error("DATABASE_URL environment variable is not set.")
        sys.exit(1)

    if args.aggregate_only:
        logger.info("Running aggregation only...")
        run_aggregation(db_url)
        return

    # Download
    if not args.skip_download:
        logger.info("Downloading leagues: %s", args.leagues)
        league_dirs = download_all(args.leagues, args.data_dir, force=args.force)
    else:
        league_dirs = {
            league: args.data_dir / league
            for league in args.leagues
        }

    # Ingest
    session = IngestionSession(db_url)
    total_loaded = 0
    total_skipped = 0
    total_failed = 0

    for league, league_dir in league_dirs.items():
        json_files = sorted(league_dir.glob("*.json"))
        if not json_files:
            logger.warning("No JSON files found in %s", league_dir)
            continue

        logger.info("Ingesting %d matches for league: %s", len(json_files), league)

        for path in tqdm(json_files, desc=league, unit="match"):
            match = parse_match_file(path)
            if match is None:
                total_failed += 1
                continue

            loaded = session.load_match(match)
            if loaded:
                total_loaded += 1
            else:
                total_skipped += 1

    session.close()

    logger.info(
        "Ingestion complete — loaded: %d, skipped (already exists): %d, failed: %d",
        total_loaded, total_skipped, total_failed,
    )

    # Post-load aggregation
    if not args.skip_aggregate:
        logger.info("Running post-load aggregation...")
        run_aggregation(db_url)


if __name__ == "__main__":
    main()
