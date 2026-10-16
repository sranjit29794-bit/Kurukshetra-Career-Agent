import pytest
from datetime import datetime
from starlette.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.db import SessionLocal
from backend.app.main import app
from backend.app.models import (
    AgentEvent,
    Analysis,
    Assessment,
    Evidence,
    Job,
    Repo,
    Requirement,
    Track,
)


@pytest.fixture
def client():
    return TestClient(app)


def test_phase8_activity_feed_and_coaching(client: TestClient):
    db: Session = SessionLocal()
    try:
        # Setup test job, requirements, repo, and track
        now = datetime.utcnow()
        job = Job(
            title="Senior Python Backend Lead",
            company="QuantEdge Labs",
            source_type="user_provided",
            confirmed=True,
        )
        db.add(job)
        db.flush()

        req_api = Requirement(
            job_id=job.id,
            name="REST API Architecture",
            category="backend",
            priority="must",
            source_sentence="Build robust REST APIs",
            taxonomy_key="rest_api",
            position=1,
        )
        req_sql = Requirement(
            job_id=job.id,
            name="SQL Query Optimization",
            category="database",
            priority="must",
            source_sentence="Write and optimize SQL queries",
            taxonomy_key="sql_database",
            position=2,
        )
        db.add_all([req_api, req_sql])
        db.flush()

        repo = Repo(
            owner="quantdev",
            name="algo-service",
            default_branch="main",
            html_url="https://github.com/quantdev/algo-service",
        )
        db.add(repo)
        db.flush()

        track = Track(
            job_id=job.id,
            repo_id=repo.id,
            branch="main",
            last_seen_sha="3333333333333333333333333333333333333333",
            watcher_mode="polling",
        )
        db.add(track)
        db.flush()

        analysis = Analysis(
            track_id=track.id,
            commit_sha=track.last_seen_sha,
            trigger="manual",
            kind="initial",
            status="complete",
            started_at=now,
            finished_at=now,
        )
        db.add(analysis)
        db.flush()

        # Assessments: 1 demonstrated (API), 1 not demonstrated (SQL)
        asm_api = Assessment(
            analysis_id=analysis.id,
            requirement_id=req_api.id,
            status="DEMONSTRATED",
            strength="strong",
            summary="Verified REST API endpoints in routes.py",
            limitation=None,
            next_step="Add regression tests",
            carried_forward=False,
            reassessed=True,
            ai_used=False,
        )
        asm_sql = Assessment(
            analysis_id=analysis.id,
            requirement_id=req_sql.id,
            status="NOT_DEMONSTRATED",
            strength="none",
            summary="No SQL evidence observed in examined files",
            limitation="Not demonstrated in analyzed scope; does not mean candidate lacks the skill.",
            next_step="Add parameter-bound database queries",
            carried_forward=False,
            reassessed=True,
            ai_used=False,
        )
        db.add_all([asm_api, asm_sql])
        db.flush()

        # Evidence for API
        ev_api = Evidence(
            assessment_id=asm_api.id,
            signal_id="sig-api-99",
            detector="rest_api",
            file_path="src/api.py",
            line_start=12,
            line_end=18,
            snippet="@app.get('/items')\ndef list_items(): return []",
            blob_sha="blob-api-99",
            strength="strong",
            counted=True,
        )
        db.add(ev_api)

        # Persist AgentEvents
        ev1 = AgentEvent(
            track_id=track.id,
            analysis_id=analysis.id,
            agent="RepoScout",
            level="info",
            message="Analyzed 12 files at commit 33333333.",
            ts=now,
        )
        ev2 = AgentEvent(
            track_id=track.id,
            analysis_id=analysis.id,
            agent="SkepticVerifier",
            level="info",
            message="Verified 4 AST signals.",
            ts=now,
        )
        ev3 = AgentEvent(
            track_id=track.id,
            analysis_id=analysis.id,
            agent="EvidenceEngine",
            level="success",
            message="Deterministic evaluation complete: 1 demonstrated, 1 scope gaps.",
            ts=now,
        )
        db.add_all([ev1, ev2, ev3])
        db.commit()

        # 1. Test GET /api/events
        res_events = client.get("/api/events")
        assert res_events.status_code == 200, res_events.text
        events_data = res_events.json()
        assert len(events_data) >= 3
        track_events = [e for e in events_data if e.get("track_id") == track.id]
        assert len(track_events) == 3
        assert any(e["agent"] == "RepoScout" for e in track_events)
        assert any(e["agent"] == "EvidenceEngine" for e in track_events)
        assert track_events[0]["commit_sha"].startswith("33333333")
        assert track_events[0]["track_title"] == "Senior Python Backend Lead"

        # 2. Test GET /api/tracks/{track_id}/events
        res_track_events = client.get(f"/api/tracks/{track.id}/events")
        assert res_track_events.status_code == 200
        assert len(res_track_events.json()) == 3

        # 3. Test GET /api/tracks/{track_id}/coaching
        res_coaching = client.get(f"/api/tracks/{track.id}/coaching")
        assert res_coaching.status_code == 200, res_coaching.text
        coaching_data = res_coaching.json()

        assert coaching_data["track_id"] == track.id
        assert coaching_data["commit_sha"] == "3333333333333333333333333333333333333333"
        assert coaching_data["strengths_count"] == 1
        assert coaching_data["gaps_count"] == 1
        assert len(coaching_data["items"]) == 2

        # Check actionable gap (SQL)
        sql_item = next(it for it in coaching_data["items"] if "SQL" in it["requirement_name"])
        assert sql_item["is_actionable"] is True
        assert sql_item["status"] == "NOT_DEMONSTRATED"
        assert sql_item["status_claim"] == "recommendation"
        assert "parameterized queries" in sql_item["implementation_guide"]
        assert "Scope caveat:" in sql_item["scope_caveat"]
        assert "does not indicate a lack of candidate skill" in sql_item["scope_caveat"]

        # Check strength item (REST API)
        api_item = next(it for it in coaching_data["items"] if "REST" in it["requirement_name"])
        assert api_item["is_actionable"] is False
        assert api_item["status"] == "DEMONSTRATED"
        assert api_item["status_claim"] == "verified_strength"
        assert len(api_item["verified_proof"]) == 1
        assert api_item["verified_proof"][0]["file_path"] == "src/api.py"
        assert "blob/3333333333333333333333333333333333333333/src/api.py#L12-L18" in api_item["verified_proof"][0]["github_url"]

        # 4. Test 404 for invalid track
        res_404 = client.get("/api/tracks/999999/coaching")
        assert res_404.status_code == 404
        assert res_404.json()["error"]["code"] == "TRACK_NOT_FOUND"

    finally:
        db.close()
