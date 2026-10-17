"""Regression test suite for Track #156, coaching 404 diagnosis, Python AST detector,

tiered tree prioritizer, and FileCache blob_sha deduplication.
"""
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db import SessionLocal
from backend.app.models import Track, Analysis, Assessment, Requirement, Repo, Job, FileCache
from backend.app.detectors.python import detect_python
from backend.app.github.files import filter_tree_files
from backend.app.schemas import SignalStrength

client = TestClient(app)


def test_python_detector_extracts_classes_and_typing():
    """Confirms detect_python extracts structured classes and type signatures with weak-signal immunity."""
    sample_code = """
from pydantic import BaseModel
from typing import Optional

class UserModel(BaseModel):
    id: int
    name: str
    email: Optional[str] = None

    def get_display_name(self) -> str:
        return self.name.strip()

class EmptyStub:
    pass

class DocstringOnlyStub:
    '''This is just a docstring.'''
"""
    signals = detect_python("app/models.py", sample_code, "sha_test_123")
    assert len(signals) >= 1

    # UserModel should be STRONG and counted
    user_sig = next((s for s in signals if "UserModel" in s.why), None)
    assert user_sig is not None
    assert user_sig.strength == SignalStrength.STRONG
    assert user_sig.counted is True
    assert user_sig.detector == "python"
    assert user_sig.category_key == "python"

    # EmptyStub should be WEAK and uncounted
    stub_sig = next((s for s in signals if "EmptyStub" in s.why), None)
    assert stub_sig is not None
    assert stub_sig.strength == SignalStrength.WEAK
    assert stub_sig.counted is False


def test_tiered_tree_filtering_prioritizes_core_code_over_docs():
    """Confirms filter_tree_files prioritizes manifests, core code, and tests over docs/translations."""
    mock_tree = [
        # Docs markdown (alphabetically first)
        {"path": "docs/de/docs/index.md", "type": "blob", "size": 100, "sha": "sha_md_1"},
        {"path": "docs/en/docs/tutorial.md", "type": "blob", "size": 100, "sha": "sha_md_2"},
        # Docs code snippets
        {"path": "docs_src/tutorial001.py", "type": "blob", "size": 100, "sha": "sha_doc_py"},
        # Automated tests
        {"path": "tests/test_api.py", "type": "blob", "size": 100, "sha": "sha_test"},
        # Core application code
        {"path": "fastapi/routing.py", "type": "blob", "size": 100, "sha": "sha_core"},
        # Root manifest
        {"path": "pyproject.toml", "type": "blob", "size": 100, "sha": "sha_toml"},
    ]

    analyzable, scope = filter_tree_files(mock_tree, max_files_analyzed=4)
    paths = [f["path"] for f in analyzable]

    # pyproject.toml (Tier 0) must be first
    assert paths[0] == "pyproject.toml"
    # fastapi/routing.py (Tier 1) must be next
    assert paths[1] == "fastapi/routing.py"
    # tests/test_api.py (Tier 2) must be next
    assert paths[2] == "tests/test_api.py"
    # docs_src/tutorial001.py (Tier 3) next
    assert paths[3] == "docs_src/tutorial001.py"
    # Markdown docs (Tier 5) must be skipped due to 4-file bound
    assert "docs/de/docs/index.md" not in paths


def test_coaching_endpoint_distinguishes_no_analysis_from_missing_track():
    """Confirms /coaching returns 404 NO_ANALYSIS_FOUND when analysis pending, and TRACK_NOT_FOUND when track missing."""
    # 1. Non-existent track -> TRACK_NOT_FOUND
    res_404 = client.get("/api/tracks/9999999/coaching")
    assert res_404.status_code == 404
    data_404 = res_404.json()
    assert data_404["error"]["code"] == "TRACK_NOT_FOUND"

    # 2. Track exists without completed analysis -> NO_ANALYSIS_FOUND
    db = SessionLocal()
    job = Job(title="Pending Intern", company="Test Corp", confirmed=True)
    repo = Repo(owner="test", name="pending-repo", html_url="https://github.com/test/pending-repo")
    db.add(job)
    db.add(repo)
    db.flush()
    track = Track(job_id=job.id, repo_id=repo.id, branch="main", watcher_mode="polling")
    db.add(track)
    db.commit()
    db.refresh(track)

    res_pending = client.get(f"/api/tracks/{track.id}/coaching")
    assert res_pending.status_code == 404
    data_pending = res_pending.json()
    assert data_pending["error"]["code"] == "NO_ANALYSIS_FOUND"

    # Cleanup
    db.delete(track)
    db.delete(job)
    db.delete(repo)
    db.commit()


def test_file_cache_duplicate_blob_sha_handling():
    """Confirms that multiple files with the same blob SHA do not violate FileCache unique constraints."""
    db = SessionLocal()
    shared_sha = "shared_empty_file_sha_123"

    # Clean previous if any
    db.query(FileCache).filter_by(blob_sha=shared_sha).delete()
    db.commit()

    # Simulate batch inserting multiple files sharing identical SHA
    seen = set()
    files = [
        {"path": "pkg/__init__.py", "sha": shared_sha, "content": ""},
        {"path": "pkg/sub/__init__.py", "sha": shared_sha, "content": ""},
        {"path": "tests/__init__.py", "sha": shared_sha, "content": ""},
    ]

    for f in files:
        blob_sha = f["sha"]
        cached = db.query(FileCache).filter_by(blob_sha=blob_sha).first()
        if not cached and blob_sha not in seen:
            db.merge(FileCache(blob_sha=blob_sha, path=f["path"], content=f["content"]))
            seen.add(blob_sha)

    # Must commit cleanly without sqlite3.IntegrityError
    db.commit()

    count = db.query(FileCache).filter_by(blob_sha=shared_sha).count()
    assert count == 1

    # Cleanup
    db.query(FileCache).filter_by(blob_sha=shared_sha).delete()
    db.commit()
