import logging
import sys
from .config import settings

LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
LOG_LEVEL = logging.DEBUG if settings.DEBUG else logging.INFO


def configure_logging() -> None:
    logging.basicConfig(
        level=LOG_LEVEL,
        format=LOG_FORMAT,
        stream=sys.stdout,
    )
    # Silence noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    # SQL echo is decoupled from DEBUG — it floods the console with every query.
    # Opt in explicitly with SQL_ECHO=true only when debugging SQL.
    sql_echo = str(getattr(settings, "SQL_ECHO", "")).lower() in ("1", "true", "yes")
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.INFO if sql_echo else logging.WARNING
    )


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
