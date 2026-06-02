"""Download and extract Cricsheet ZIP archives."""
import logging
import zipfile
from pathlib import Path

import requests
from tqdm import tqdm

from .constants import CRICSHEET_URLS

logger = logging.getLogger(__name__)


def download_league(league: str, data_dir: Path, force: bool = False) -> Path:
    """Download and extract a Cricsheet league ZIP. Returns the extracted directory."""
    if league not in CRICSHEET_URLS:
        raise ValueError(f"Unknown league '{league}'. Available: {list(CRICSHEET_URLS)}")

    url = CRICSHEET_URLS[league]
    data_dir.mkdir(parents=True, exist_ok=True)
    extract_dir = data_dir / league

    if extract_dir.exists() and not force:
        files = list(extract_dir.glob("*.json"))
        if files:
            logger.info("League '%s' already downloaded (%d files). Use force=True to re-download.", league, len(files))
            return extract_dir

    zip_path = data_dir / f"{league}.zip"
    logger.info("Downloading %s from %s ...", league, url)

    response = requests.get(url, stream=True, timeout=120)
    response.raise_for_status()

    total = int(response.headers.get("content-length", 0))
    with open(zip_path, "wb") as f, tqdm(
        desc=league,
        total=total,
        unit="B",
        unit_scale=True,
        unit_divisor=1024,
    ) as bar:
        for chunk in response.iter_content(chunk_size=65536):
            f.write(chunk)
            bar.update(len(chunk))

    logger.info("Extracting %s ...", zip_path)
    extract_dir.mkdir(exist_ok=True)
    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(extract_dir)

    zip_path.unlink()
    files = list(extract_dir.glob("*.json"))
    logger.info("Extracted %d match files for '%s'.", len(files), league)
    return extract_dir


def download_all(leagues: list[str], data_dir: Path, force: bool = False) -> dict[str, Path]:
    """Download multiple leagues. Returns {league: extract_dir}."""
    return {league: download_league(league, data_dir, force=force) for league in leagues}
