"""Comprehensive unit tests for deterministic skill detectors.

Reference: docs/BRAIN.md (§3, §10, §11, §17) and rule 30-testing-standards.
Tests each detector with:
- Positive (strong signals)
- Weak (must NOT count, counted=False)
- Negative (no signals)
"""

from __future__ import annotations

from backend.app.detectors.deployment import DeploymentDetector
from backend.app.detectors.generic_keyword import GenericKeywordDetector
from backend.app.detectors.python_lang import PythonLangDetector
from backend.app.detectors.rest_api import RestApiDetector
from backend.app.detectors.sql import SqlDatabaseDetector
from backend.app.detectors.testing import TestingDetector
from backend.app.schemas import SignalStrength

# ==============================================================================
# Python Language Detector
# ==============================================================================


class TestPythonLangPositive:
    def test_python_implemented_functions(self):
        code = "def calculate_total(price: float, qty: int) -> float:\n    subtotal = price * qty\n    return subtotal\n"
        detector = PythonLangDetector()
        signals = detector.detect("calculator.py", code)
        strong = [
            s for s in signals if s.counted and s.strength == SignalStrength.strong
        ]
        assert len(strong) >= 1
        assert "calculate_total" in strong[0].reason

    def test_python_class_definition(self):
        code = "class ShoppingCart:\n    def __init__(self):\n        self.items = []\n"
        detector = PythonLangDetector()
        signals = detector.detect("cart.py", code)
        strong = [
            s for s in signals if s.counted and s.strength == SignalStrength.strong
        ]
        assert any("ShoppingCart" in s.reason for s in strong)


class TestPythonLangWeak:
    def test_python_pass_only_function(self):
        code = "def stub_function():\n    pass\n"
        detector = PythonLangDetector()
        signals = detector.detect("stub.py", code)
        strong = [s for s in signals if s.counted]
        assert len(strong) == 0
        weak = [s for s in signals if not s.counted]
        assert len(weak) == 1
        assert "pass-only" in weak[0].reason

    def test_python_syntax_error_never_crashes(self):
        code = "def broken_syntax(:\n    return 42\n"
        detector = PythonLangDetector()
        signals = detector.detect("broken.py", code)
        # Must never crash, must return weak signal with counted=False
        assert all(not s.counted for s in signals)


class TestPythonLangNegative:
    def test_python_non_python_file(self):
        detector = PythonLangDetector()
        signals = detector.detect("styles.css", "body { margin: 0; }")
        assert signals == []


# ==============================================================================
# REST API Detector
# ==============================================================================


class TestRestApiPositive:
    def test_fastapi_route_handlers(self):
        code = """from fastapi import FastAPI
app = FastAPI()

@app.get("/users")
def get_users():
    return [{"id": 1, "name": "Alice"}]

@app.post("/users")
def create_user(user: dict):
    return {"status": "created"}
"""
        detector = RestApiDetector()
        signals = detector.detect("routes.py", code)
        strong = [
            s for s in signals if s.counted and s.strength == SignalStrength.strong
        ]
        assert len(strong) >= 2


class TestRestApiWeak:
    def test_rest_api_readme_claim_only(self):
        readme = "# Project\nThis is a REST API with full JSON endpoints.\n"
        detector = RestApiDetector()
        signals = detector.detect("README.md", readme)
        assert all(not s.counted for s in signals)
        assert any(s.strength == SignalStrength.weak for s in signals)

    def test_rest_api_pass_handler(self):
        code = """from fastapi import FastAPI
app = FastAPI()

@app.get("/stub")
def stub():
    pass
"""
        detector = RestApiDetector()
        signals = detector.detect("stub.py", code)
        assert all(not s.counted for s in signals)


class TestRestApiNegative:
    def test_rest_api_unrelated_code(self):
        code = "def add(a, b):\n    return a + b\n"
        detector = RestApiDetector()
        signals = detector.detect("math_utils.py", code)
        assert signals == []


# ==============================================================================
# SQL Database Detector
# ==============================================================================


class TestSqlDatabasePositive:
    def test_sql_parameterized_query(self):
        code = """import sqlite3
def get_user(user_id):
    conn = sqlite3.connect("test.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM users WHERE id = ?", (user_id,))
    return cursor.fetchone()
"""
        detector = SqlDatabaseDetector()
        signals = detector.detect("db.py", code)
        strong = [
            s for s in signals if s.counted and s.strength == SignalStrength.strong
        ]
        assert len(strong) == 1
        assert "Parameterized SQL query" in strong[0].reason

    def test_sql_migration_file(self):
        sql = "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL);\n"
        detector = SqlDatabaseDetector()
        signals = detector.detect("migrations/001_initial.sql", sql)
        strong = [
            s for s in signals if s.counted and s.strength == SignalStrength.strong
        ]
        assert len(strong) == 1


class TestSqlDatabaseWeak:
    def test_sql_readme_claim_rejected(self):
        readme = (
            "# Database\nUses PostgreSQL for high-concurrency production storage.\n"
        )
        detector = SqlDatabaseDetector()
        signals = detector.detect("README.md", readme)
        assert all(not s.counted for s in signals)
        assert any("README" in s.reason for s in signals)

    def test_sql_in_docstring_decoy(self):
        code = 'def fake_db():\n    """SELECT * FROM accounts WHERE balance > 0"""\n    return []\n'
        detector = SqlDatabaseDetector()
        signals = detector.detect("decoy.py", code)
        assert all(not s.counted for s in signals)

    def test_sql_f_string_is_medium_unsafe(self):
        code = """def unsafe_query(user_input):
    cursor.execute(f"SELECT * FROM users WHERE name = '{user_input}'")
"""
        detector = SqlDatabaseDetector()
        signals = detector.detect("unsafe.py", code)
        medium = [
            s for s in signals if s.counted and s.strength == SignalStrength.medium
        ]
        assert len(medium) == 1
        assert "unsafe" in medium[0].reason.lower()


class TestSqlDatabaseNegative:
    def test_sql_unrelated_code(self):
        code = "def render_template(name):\n    return f'Hello {name}'\n"
        detector = SqlDatabaseDetector()
        signals = detector.detect("views.py", code)
        assert signals == []


# ==============================================================================
# Testing Detector
# ==============================================================================


class TestTestingPositive:
    def test_meaningful_test_with_assertions(self):
        code = """import pytest
from app import calculator

def test_addition():
    result = calculator.add(2, 3)
    assert result == 5
    assert result > 0
"""
        detector = TestingDetector()
        signals = detector.detect("tests/test_calculator.py", code)
        strong = [
            s for s in signals if s.counted and s.strength == SignalStrength.strong
        ]
        assert len(strong) == 1


class TestTestingWeak:
    def test_assert_true_weak_rejected(self):
        code = """def test_smoke():
    assert True
"""
        detector = TestingDetector()
        signals = detector.detect("tests/test_smoke.py", code)
        assert all(not s.counted for s in signals)
        assert any("assert True" in s.reason for s in signals)

    def test_assert_one_equals_one_rejected(self):
        code = """def test_dummy():
    assert 1 == 1
"""
        detector = TestingDetector()
        signals = detector.detect("tests/test_dummy.py", code)
        assert all(not s.counted for s in signals)

    def test_test_without_asserts(self):
        code = """def test_no_assert():
    pass
"""
        detector = TestingDetector()
        signals = detector.detect("tests/test_empty.py", code)
        assert all(not s.counted for s in signals)

    def test_test_not_importing_project_code(self):
        code = """import pytest

def test_isolated():
    val = 10 + 20
    assert val == 30
"""
        detector = TestingDetector()
        signals = detector.detect("tests/test_isolated.py", code)
        assert all(not s.counted for s in signals)
        assert any("does not import any project code" in s.reason for s in signals)


class TestTestingNegative:
    def test_non_test_file(self):
        code = "def test_helper():\n    return 42\n"
        detector = TestingDetector()
        # Not a test path
        signals = detector.detect("src/helpers.py", code)
        assert signals == []


# ==============================================================================
# Deployment Detector
# ==============================================================================


class TestDeploymentPositive:
    def test_valid_dockerfile(self):
        content = """FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
CMD ["uvicorn", "main:app", "--host", "0.0.0.0"]
"""
        detector = DeploymentDetector()
        signals = detector.detect("Dockerfile", content)
        strong = [
            s for s in signals if s.counted and s.strength == SignalStrength.strong
        ]
        assert len(strong) == 1


class TestDeploymentWeak:
    def test_deployment_readme_only(self):
        readme = (
            "# Deploy\nDeployed and live on Render at https://devproof.onrender.com\n"
        )
        detector = DeploymentDetector()
        signals = detector.detect("README.md", readme)
        assert all(not s.counted for s in signals)

    def test_dockerfile_missing_cmd(self):
        content = "FROM python:3.11\nWORKDIR /app\n"
        detector = DeploymentDetector()
        signals = detector.detect("Dockerfile", content)
        medium = [s for s in signals if s.strength == SignalStrength.medium]
        assert len(medium) == 1


class TestDeploymentNegative:
    def test_unrelated_file(self):
        detector = DeploymentDetector()
        signals = detector.detect("app/main.py", "print('hello')")
        assert signals == []


# ==============================================================================
# Generic Keyword Detector
# ==============================================================================


class TestGenericKeyword:
    def test_generic_keyword_code_hit_is_medium(self):
        code = "import redis\nr = redis.Redis(host='localhost', port=6379)\n"
        detector = GenericKeywordDetector(search_terms=["redis"])
        signals = detector.detect("cache.py", code)
        medium = [
            s for s in signals if s.counted and s.strength == SignalStrength.medium
        ]
        assert len(medium) >= 1

    def test_generic_keyword_comment_hit_is_weak(self):
        code = "# TODO: integrate Redis caching\nval = 1\n"
        detector = GenericKeywordDetector(search_terms=["redis"])
        signals = detector.detect("cache.py", code)
        assert all(not s.counted for s in signals)
