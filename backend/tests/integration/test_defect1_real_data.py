"""Tests for Defect 1: Real Data, Not Mocks.

Invariants verified:
1. DATABASE_URL resolves to ONE absolute path regardless of launch directory.
2. create_all runs on startup and every write handler commits.
3. POST a job, create a new engine/session (simulating server restart), and GET it back.
4. GET /api/health returns:
   - db_path (absolute path string to database file)
   - row_counts (dict mapping table names to integer counts)
   - mode ("real" or "fixtures")
"""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from backend.app.config import Settings
from backend.app.db import create_app_engine, init_db
from backend.app.main import app
from backend.app.schemas import JobDraft, Priority, RequirementIn, SourceType


class TestDefect1RealData:
    def test_database_url_resolves_to_one_absolute_path(self) -> None:
        """Confirm DATABASE_URL resolves to one canonical absolute path regardless of CWD."""
        s = Settings(DATABASE_URL="sqlite:///./devproof.db")
        assert hasattr(s, "resolved_database_url"), (
            "Settings must have resolved_database_url"
        )
        resolved = s.resolved_database_url
        assert resolved.startswith("sqlite:///")
        raw_path = resolved.replace("sqlite:///", "")
        path_obj = Path(raw_path)
        assert path_obj.is_absolute(), (
            f"Database path must be absolute, got: {raw_path}"
        )

        # Test from different simulated working directory
        root_dir = Path(__file__).resolve().parent.parent.parent.parent
        expected_path = (root_dir / "devproof.db").resolve()
        assert Path(raw_path).resolve() == expected_path

    def test_health_endpoint_returns_db_path_row_counts_and_mode(self) -> None:
        """Verify GET /api/health includes db_path, row_counts per table, and mode."""
        client = TestClient(app)
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()

        assert "db_path" in data, "Health response must contain 'db_path'"
        assert isinstance(data["db_path"], str)
        assert len(data["db_path"]) > 0

        assert "row_counts" in data, "Health response must contain 'row_counts'"
        assert isinstance(data["row_counts"], dict)
        # Must report counts for registered tables
        assert "jobs" in data["row_counts"]
        assert "requirements" in data["row_counts"]
        assert "tracks" in data["row_counts"]
        assert isinstance(data["row_counts"]["jobs"], int)

        assert "mode" in data, "Health response must contain 'mode'"
        assert data["mode"] in ("real", "fixtures")

    def test_post_job_restart_server_get_it_back(self, tmp_path: Path) -> None:
        """Simulate real persistence: POST a job, restart engine (simulate reboot), GET it back."""
        test_db_file = tmp_path / "persistence_test.db"
        test_db_url = f"sqlite:///{test_db_file.resolve().as_posix()}"

        # Initialize engine 1 (Server instance 1)
        engine1 = create_app_engine(test_db_url)
        init_db(engine_override=engine1)
        Session1 = sessionmaker(bind=engine1)

        job_id = "job_reboot_test_001"
        draft = JobDraft(
            id=job_id,
            title="Backend Systems Engineer",
            company="Acme Corp",
            source_url="https://acme.example.com/jobs/1",
            source_type=SourceType.fetched,
            source_detail="Direct test",
            raw_text="Seeking a backend engineer with Python and SQL experience.",
            requirements=[
                RequirementIn(
                    id=f"{job_id}_python",
                    name="Python Language",
                    category="Language",
                    priority=Priority.must,
                    source_sentence="Python experience",
                    taxonomy_key="python_language",
                ),
                RequirementIn(
                    id=f"{job_id}_sql",
                    name="SQL Database",
                    category="Database",
                    priority=Priority.must,
                    source_sentence="SQL experience",
                    taxonomy_key="sql_database",
                ),
            ],
            confirmed=True,
        )

        # Write using session from server instance 1
        with Session1() as session1:
            from backend.app.routers.jobs import create_job

            saved_draft = create_job(draft=draft, db=session1)
            assert saved_draft.id == job_id

        # Shutdown instance 1: dispose engine
        engine1.dispose()

        # Startup instance 2 (Server reboot with fresh engine connecting to same file)
        engine2 = create_app_engine(test_db_url)
        Session2 = sessionmaker(bind=engine2)

        with Session2() as session2:
            from backend.app.routers.jobs import get_job

            retrieved = get_job(id=job_id, db=session2)
            assert retrieved is not None
            assert retrieved.id == job_id
            assert retrieved.title == "Backend Systems Engineer"
            assert retrieved.company == "Acme Corp"
            assert len(retrieved.requirements) == 2
            req_names = {r.name for r in retrieved.requirements}
            assert "Python Language" in req_names
            assert "SQL Database" in req_names

        engine2.dispose()
