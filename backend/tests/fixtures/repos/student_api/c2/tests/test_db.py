import sqlite3

import pytest
from app import db


@pytest.fixture
def temp_db(monkeypatch, tmp_path):
    """Provision isolated SQLite database for unit tests."""
    test_db_file = tmp_path / "test.db"
    monkeypatch.setattr(db, "DB_PATH", str(test_db_file))
    with sqlite3.connect(str(test_db_file)) as conn:
        conn.execute(
            "CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT, price REAL)"
        )
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
