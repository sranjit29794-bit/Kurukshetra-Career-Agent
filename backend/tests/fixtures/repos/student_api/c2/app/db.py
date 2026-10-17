import sqlite3
from contextlib import contextmanager
from typing import Any

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


def insert_item(name: str, price: float) -> dict[str, Any]:
    """Execute parameterized INSERT query with bound parameters."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO items (name, price) VALUES (?, ?)", (name, price))
        conn.commit()
        return {"id": cursor.lastrowid, "name": name, "price": price}


def get_items() -> list[dict[str, Any]]:
    """Execute parameterized SELECT query returning item dictionaries."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, price FROM items ORDER BY id ASC")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
