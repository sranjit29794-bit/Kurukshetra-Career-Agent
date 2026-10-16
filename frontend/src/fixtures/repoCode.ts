/**
 * Pinned file contents at analyzed commit SHAs for CodeViewer citations.
 * Reference: docs/BRAIN.md (§3 Invariant #4, §14, §19.1).
 */

export const REPO_CODE_FIXTURES: Record<string, { path: string; sha: string; language: string; content: string }> = {
  'app/main.py': {
    path: 'app/main.py',
    sha: 'c3d4e5f67890123456789abcdef0123456789012',
    language: 'python',
    content: `from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from app import db

app = FastAPI(title="Student API", version="1.0.0")

class ItemCreate(BaseModel):
    name: str
    price: float

class ItemResponse(BaseModel):
    id: int
    name: str
    price: float

@app.get("/items", response_model=List[ItemResponse])
def list_items():
    """Retrieve all inventory items from the database."""
    items = db.get_items()
    return items

@app.post("/items", response_model=ItemResponse)
def create_item(item: ItemCreate):
    """Insert a new inventory item using parameterized SQL queries."""
    if item.price < 0:
        raise HTTPException(status_code=400, detail="Price must be positive")
    created = db.insert_item(item.name, item.price)
    return created

@app.get("/items/{item_id}", response_model=ItemResponse)
def get_item(item_id: int):
    """Fetch item by unique identifier."""
    item = db.get_item_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item
`,
  },

  'app/db.py': {
    path: 'app/db.py',
    sha: 'c3d4e5f67890123456789abcdef0123456789012',
    language: 'python',
    content: `import sqlite3
from contextlib import contextmanager
from typing import List, Dict, Any, Optional

DB_PATH = "student_api.db"

@contextmanager
def get_connection():
    """Context manager for SQLite database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def insert_item(name: str, price: float) -> Dict[str, Any]:
    """Execute parameterized INSERT query with bound parameters."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO items (name, price) VALUES (?, ?)",
            (name, price)
        )
        conn.commit()
        return {"id": cursor.lastrowid, "name": name, "price": price}

def get_items() -> List[Dict[str, Any]]:
    """Execute parameterized SELECT query returning item dictionaries."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, price FROM items ORDER BY id ASC")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_item_by_id(item_id: int) -> Optional[Dict[str, Any]]:
    """Execute parameterized SELECT query for single row lookup."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, price FROM items WHERE id = ?", (item_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
`,
  },

  'tests/test_db.py': {
    path: 'tests/test_db.py',
    sha: 'c3d4e5f67890123456789abcdef0123456789012',
    language: 'python',
    content: `import pytest
import sqlite3
from app import db

@pytest.fixture
def temp_db(monkeypatch, tmp_path):
    """Provision isolated SQLite database for unit tests."""
    test_db_file = tmp_path / "test.db"
    monkeypatch.setattr(db, "DB_PATH", str(test_db_file))
    with sqlite3.connect(str(test_db_file)) as conn:
        conn.execute("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT, price REAL)")
    return test_db_file

def test_insert_and_get_item(temp_db):
    """Verify parameterized insertion and query retrieval with meaningful assertions."""
    created = db.insert_item("Laptop Stand", 29.99)
    assert created["id"] is not None
    assert created["name"] == "Laptop Stand"
    assert created["price"] == 29.99

    items = db.get_items()
    assert len(items) == 1
    assert items[0]["name"] == "Laptop Stand"

def test_get_item_by_id_found(temp_db):
    """Verify single-record lookup returns correct item."""
    created = db.insert_item("Wireless Mouse", 19.50)
    fetched = db.get_item_by_id(created["id"])
    assert fetched is not None
    assert fetched["name"] == "Wireless Mouse"
`,
  },

  'tests/test_smoke.py': {
    path: 'tests/test_smoke.py',
    sha: 'a1b2c3d4e5f67890123456789abcdef012345678',
    language: 'python',
    content: `def test_smoke():
    # Weak signal: assert True conveys no evidence of test execution or logic
    assert True
`,
  },

  'backend/app/models.py': {
    path: 'backend/app/models.py',
    sha: 'c3d4e5f67890123456789abcdef0123456789012',
    language: 'python',
    content: `from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from backend.app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<User id={self.id} name={self.name}>"
`,
  },

  'backend/app/database.py': {
    path: 'backend/app/database.py',
    sha: 'c3d4e5f67890123456789abcdef0123456789012',
    language: 'python',
    content: `from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./devproof.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
`,
  },

  'backend/app/services/data_processor.py': {
    path: 'backend/app/services/data_processor.py',
    sha: 'c3d4e5f67890123456789abcdef0123456789012',
    language: 'python',
    content: `from sqlalchemy import select
from backend.app.database import SessionLocal
from backend.app.models import User

def get_user_data(user_id: int):
    """Retrieve user entity by primary key using SQLAlchemy select query."""
    with SessionLocal() as db:
        query = select(User).where(User.id == user_id)
        return db.execute(query).fetchone()
`,
  },

  'README.md': {
    path: 'README.md',
    sha: 'c3d4e5f67890123456789abcdef0123456789012',
    language: 'markdown',
    content: `# Student API

A high-performance FastAPI backend service.

## Stack
- Built with PostgreSQL database backend
- FastAPI route handlers with Pydantic request models
- Pytest test suite

## Running Locally
\`\`\`bash
uvicorn app.main:app --reload
\`\`\`
`,
  },
};
