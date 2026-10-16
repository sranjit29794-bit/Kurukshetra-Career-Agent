"""Database session setup and initialization using SQLAlchemy 2.x.

Reference: docs/BRAIN.md (§7.1, §9).
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from backend.app.config import settings
from backend.app.models import Base

# SQLite connect_args to allow multithreaded access
connect_args = (
    {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
)

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    """Create all database tables on application startup."""
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency for acquiring a scoped database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
