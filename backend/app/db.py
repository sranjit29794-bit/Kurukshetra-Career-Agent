"""Database session setup and initialization using SQLAlchemy 2.x.

Reference: docs/BRAIN.md (§7.1, §9) and PLAN-5H (§1.2, §1.3, R0).
"""

from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from backend.app.config import settings
from backend.app.models import Base


def create_app_engine(database_url: str) -> Engine:
    """Build the SQLAlchemy engine from DATABASE_URL.

    - SQLite: check_same_thread=False and PRAGMA journal_mode=WAL + foreign_keys=ON on connect.
    - PostgreSQL (postgresql+psycopg://): connects directly without code changes.
    """
    if database_url.startswith("sqlite"):
        engine = create_engine(
            database_url,
            connect_args={"check_same_thread": False},
            echo=False,
        )

        @event.listens_for(engine, "connect")
        def set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        return engine

    return create_engine(database_url, echo=False)


# Default engine instance bound to configured settings.resolved_database_url
engine = create_app_engine(settings.resolved_database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db(engine_override: Engine | None = None) -> None:
    """Create all database tables on application startup."""
    target_engine = engine_override or engine
    Base.metadata.create_all(bind=target_engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency for acquiring a scoped database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
