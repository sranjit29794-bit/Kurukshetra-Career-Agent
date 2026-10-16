"""Tests for Phase 7: Evidence Inspector, History Timeline, Immutable Source Anchors,
and Before/After Comparison between Arbitrary & Consecutive Analyses.
"""
import uuid
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from backend.app.config import get_settings
from backend.app.main import app
from backend.app.schemas import RepoConnectResult, Scope, WebhookStatus


@pytest.fixture
def client():
    return TestClient(app)


def test_phase7_evidence_inspector_and_immutable_anchors(client):
    """Verifies that evidence items include immutable commit-pinned GitHub anchor URLs

    rather than mutable branch links, and tests historical retrieval & diff comparisons.
    """
    settings = get_settings()
    settings.GITHUB_WEBHOOK_SECRET = "change-me"

    # 1. Ingest job with REST API requirement
    extract_resp = client.post(
        "/api/jobs/extract",
        json={"text": "Apex is seeking a Backend Engineer. Must build RESTful APIs using FastAPI."}
    )
    job_id = extract_resp.json()["id"]
    client.put(
        f"/api/jobs/{job_id}/confirm",
        json={
            "title": "Backend Engineer",
            "company": "Apex",
            "requirements": [
                {
                    "name": "REST API Development",
                    "category": "Backend",
                    "priority": "must",
                    "taxonomy_key": "rest_api",
                    "search_terms": ["fastapi", "router"],
                }
            ]
        }
    )

    repo_name = f"sample-repo-{uuid.uuid4().hex[:6]}"
    delivery_id = f"delivery-{uuid.uuid4().hex}"
    commit_1 = "1111111111111111111111111111111111111111"
    commit_2 = "2222222222222222222222222222222222222222"

    # 2. Connect repository (mocked)
    with patch("backend.app.github.client.GitHubClient.connect_repository", new_callable=AsyncMock) as mock_connect:
        mock_connect.return_value = (
            RepoConnectResult(
                id=None,
                owner="test-org",
                name=repo_name,
                html_url=f"https://github.com/test-org/{repo_name}",
                default_branch="main",
                head_sha=commit_1,
                scope=Scope(analyzed=2, skipped=0, skipped_reasons={}, truncated=False),
                webhook_status=WebhookStatus.NONE,
            ),
            []
        )
        repo_resp = client.post("/api/repos/connect", json={"repo_url": f"https://github.com/test-org/{repo_name}"})
        assert repo_resp.status_code == 200
        repo_id = repo_resp.json()["id"]

    # 3. Create persistent track
    track_resp = client.post("/api/tracks", json={
        "job_id": job_id,
        "repo_id": repo_id,
        "branch": "main",
        "head_sha": commit_1,
    })
    track_id = track_resp.json()["id"]

    # 4. Trigger initial analysis (simulated commit_1 with no evidence)
    sample_py_1 = "def helper(): return 42\n"
    with patch("backend.app.routers.tracks.GitHubClient.get_tree", new_callable=AsyncMock) as mock_tree, \
         patch("backend.app.routers.tracks.GitHubClient.get_blob_content", new_callable=AsyncMock) as mock_blob:
        mock_tree.return_value = ([{"path": "app/main.py", "type": "blob", "size": len(sample_py_1), "sha": "blob1"}], False)
        mock_blob.return_value = sample_py_1
        first_analysis = client.post(f"/api/tracks/{track_id}/analyze").json()
        assert first_analysis["commit_sha"] == commit_1
        first_analysis_id = first_analysis["id"]

    # 5. Push commit_2 with verified REST API evidence via webhook
    sample_py_2 = """from fastapi import APIRouter
router = APIRouter()

@router.get("/users")
def get_users():
    return [{"id": 1}]
"""
    push_payload = {
        "ref": "refs/heads/main",
        "after": commit_2,
        "repository": {
            "name": repo_name,
            "owner": {"login": "test-org"},
            "full_name": f"test-org/{repo_name}",
        },
        "head_commit": {
            "id": commit_2,
            "message": "feat: add user GET endpoint",
        },
    }

    with patch("backend.app.evaluator.reassessment.GitHubClient.compare_commits", new_callable=AsyncMock) as mock_compare, \
         patch("backend.app.evaluator.reassessment.GitHubClient.get_tree", new_callable=AsyncMock) as mock_tree2, \
         patch("backend.app.evaluator.reassessment.GitHubClient.get_blob_content", new_callable=AsyncMock) as mock_blob2:
        mock_compare.return_value = {"files_changed": ["app/routes.py"]}
        mock_tree2.return_value = ([{"path": "app/routes.py", "type": "blob", "size": len(sample_py_2), "sha": "blob2"}], False)
        mock_blob2.return_value = sample_py_2

        webhook_resp = client.post(
            "/api/webhooks/github",
            json=push_payload,
            headers={
                "X-GitHub-Event": "push",
                "X-GitHub-Delivery": delivery_id,
            },
        )
        assert webhook_resp.status_code == 200

    # 6. Retrieve track history: GET /api/tracks/{track_id}/history
    history_resp = client.get(f"/api/tracks/{track_id}/history")
    assert history_resp.status_code == 200
    history = history_resp.json()
    assert len(history) >= 2

    # Latest analysis is commit_2
    latest = history[0]
    assert latest["commit_sha"] == commit_2
    assert latest["trigger"] == "webhook"

    # Find the REST API assessment
    rest_asm = next((a for a in latest["assessments"] if a["requirement_name"] == "REST API Development"), None)
    assert rest_asm is not None
    assert rest_asm["status"] == "DEMONSTRATED"
    assert len(rest_asm["evidence"]) > 0

    ev = rest_asm["evidence"][0]
    assert ev["file_path"] == "app/routes.py"
    assert ev["line_start"] > 0
    assert ev["github_url"] is not None
    # Verify immutable commit anchor: pinned to commit_2 SHA, NOT main branch!
    expected_prefix = f"https://github.com/test-org/{repo_name}/blob/{commit_2}/"
    assert ev["github_url"].startswith(expected_prefix)
    assert f"#L{ev['line_start']}-L{ev['line_end']}" in ev["github_url"]

    # 7. Test single historical analysis endpoint: GET /api/tracks/{track_id}/analyses/{analysis_id}
    analysis_resp = client.get(f"/api/tracks/{track_id}/analyses/{first_analysis_id}")
    assert analysis_resp.status_code == 200
    assert analysis_resp.json()["id"] == first_analysis_id
    assert analysis_resp.json()["commit_sha"] == commit_1

    # 8. Test 404 for invalid analysis ID
    err_resp = client.get(f"/api/tracks/{track_id}/analyses/9999999")
    assert err_resp.status_code == 404
    assert "ANALYSIS_NOT_FOUND" in err_resp.text

    # 9. Test diff between specific analyses: from_analysis_id and to_analysis_id
    diff_resp = client.get(f"/api/tracks/{track_id}/diff?from_analysis_id={first_analysis_id}&to_analysis_id={latest['id']}")
    assert diff_resp.status_code == 200
    diff_data = diff_resp.json()
    assert diff_data["from_sha"] == commit_1
    assert diff_data["to_sha"] == commit_2
    assert diff_data["from_analysis_id"] == first_analysis_id
    assert diff_data["to_analysis_id"] == latest["id"]
    assert diff_data["commit_message"] == "feat: add user GET endpoint"

    # Verify item diff shows IMPROVED with evidence_added containing immutable github_url
    diff_item = next(it for it in diff_data["items"] if it["name"] == "REST API Development")
    assert diff_item["change"] == "improved"
    assert diff_item["before_status"] == "NOT_DEMONSTRATED"
    assert diff_item["after_status"] == "DEMONSTRATED"
    assert len(diff_item["evidence_added"]) > 0
    assert diff_item["evidence_added"][0]["github_url"].startswith(expected_prefix)
