"""Tests for Phase 4: Push detection, Webhook HMAC signature verification,

targeted reassessment, and diff computation.
"""
import hashlib
import hmac
import json
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from backend.app.config import get_settings
from backend.app.evaluator.impact import map_changed_paths_to_taxonomies
from backend.app.main import app
from backend.app.routers.webhooks import verify_github_signature
from backend.app.schemas import AssessmentStatus, DiffChange, Priority, Trigger


@pytest.fixture
def client():
    return TestClient(app)


# -----------------------------------------------------------------------------
# 1. Webhook Signature & Security Tests
# -----------------------------------------------------------------------------

def test_verify_github_signature_valid():
    secret = "test-secret-key-123"
    payload = b'{"ref": "refs/heads/main", "after": "abc12345"}'
    valid_sig = "sha256=" + hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    assert verify_github_signature(payload, valid_sig, secret) is True


def test_verify_github_signature_invalid():
    secret = "test-secret-key-123"
    payload = b'{"ref": "refs/heads/main"}'
    assert verify_github_signature(payload, "sha256=wrongsignature", secret) is False
    assert verify_github_signature(payload, "invalid_format", secret) is False
    assert verify_github_signature(payload, "", secret) is False


def test_webhook_endpoint_rejects_invalid_signature(client):
    settings = get_settings()
    settings.GITHUB_WEBHOOK_SECRET = "super-secret"
    resp = client.post(
        "/api/webhooks/github",
        data=b'{"ref": "refs/heads/main"}',
        headers={
            "X-GitHub-Event": "push",
            "X-Hub-Signature-256": "sha256=fake00000000000000000000000000000000",
            "Content-Type": "application/json",
        },
    )
    assert resp.status_code == 401
    assert "INVALID_SIGNATURE" in resp.text


# -----------------------------------------------------------------------------
# 2. Impact Mapping Tests
# -----------------------------------------------------------------------------

def test_impact_mapping_identifies_affected_skills():
    # REST API file modified
    paths = ["backend/app/routers/users.py"]
    taxonomies = map_changed_paths_to_taxonomies(paths)
    assert "rest_api" in taxonomies
    assert "python" in taxonomies
    assert "testing" not in taxonomies

    # Test file modified
    paths2 = ["backend/tests/test_api.py"]
    taxonomies2 = map_changed_paths_to_taxonomies(paths2)
    assert "testing" in taxonomies2

    # Dockerfile modified
    paths3 = ["Dockerfile", "docker-compose.yml"]
    taxonomies3 = map_changed_paths_to_taxonomies(paths3)
    assert "deployment" in taxonomies3


# -----------------------------------------------------------------------------
# 3. Targeted Reassessment & Diff Engine E2E Test
# -----------------------------------------------------------------------------

def test_push_webhook_triggers_targeted_reassessment_and_diff(client):
    settings = get_settings()
    settings.GITHUB_WEBHOOK_SECRET = "change-me"  # allow unauthenticated local testing

    # 1. Setup a job draft with 2 requirements (REST API + SQL)
    extract_resp = client.post(
        "/api/jobs/extract",
        json={"text": "Apex is hiring. Must build REST APIs using FastAPI and manage SQL database schemas."}
    )
    job_id = extract_resp.json()["id"]
    client.put(
        f"/api/jobs/{job_id}/confirm",
        json={
            "title": "Backend Engineer",
            "company": "Apex",
            "requirements": extract_resp.json()["requirements"],
            "confirmed": True,
        }
    )

    import uuid
    repo_name = f"service-repo-{uuid.uuid4().hex[:6]}"
    delivery_id = f"delivery-{uuid.uuid4().hex}"

    # 2. Connect repository (mocked)
    with patch("backend.app.github.client.GitHubClient.connect_repository", new_callable=AsyncMock) as mock_connect:
        from backend.app.schemas import RepoConnectResult, Scope, WebhookStatus
        mock_connect.return_value = (
            RepoConnectResult(
                id=None,
                owner="targetdev",
                name=repo_name,
                html_url=f"https://github.com/targetdev/{repo_name}",
                default_branch="main",
                head_sha="1111111111111111111111111111111111111111",
                scope=Scope(analyzed=2, skipped=0, skipped_reasons={}, truncated=False),
                webhook_status=WebhookStatus.NONE,
            ),
            []
        )
        repo_resp = client.post("/api/repos/connect", json={"repo_url": f"https://github.com/targetdev/{repo_name}"})
        repo_id = repo_resp.json()["id"]

    # 3. Create persistent track
    track_resp = client.post("/api/tracks", json={
        "job_id": job_id,
        "repo_id": repo_id,
        "branch": "main",
        "head_sha": "1111111111111111111111111111111111111111",
    })
    track_id = track_resp.json()["id"]

    # 4. First analysis at commit SHA 1111111...
    sample_py_1 = """
# Initial version: no REST or SQL yet
def helper():
    return 42
"""
    with patch("backend.app.routers.tracks.GitHubClient.get_tree", new_callable=AsyncMock) as mock_tree, \
         patch("backend.app.routers.tracks.GitHubClient.get_blob_content", new_callable=AsyncMock) as mock_blob:
        mock_tree.return_value = ([{"path": "app/main.py", "type": "blob", "size": len(sample_py_1), "sha": "blob1"}], False)
        mock_blob.return_value = sample_py_1
        first_analysis = client.post(f"/api/tracks/{track_id}/analyze").json()
        assert first_analysis["commit_sha"] == "1111111111111111111111111111111111111111"
        assert all(a["status"] == "NOT_DEMONSTRATED" for a in first_analysis["assessments"])

    # 5. Simulate GitHub Push Event to SHA 2222222... (Student added REST API endpoint!)
    sample_py_2 = """
from fastapi import APIRouter
router = APIRouter()

@router.get("/users")
def get_users():
    return [{"id": 1}]
"""
    push_payload = {
        "ref": "refs/heads/main",
        "after": "2222222222222222222222222222222222222222",
        "repository": {
            "name": repo_name,
            "owner": {"login": "targetdev"},
            "full_name": f"targetdev/{repo_name}",
        },
        "head_commit": {
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
        assert webhook_resp.status_code == 200, webhook_resp.text
        assert webhook_resp.json()["status"] == "processed"

    # 6. Retrieve Diff response: before vs after comparison
    diff_resp = client.get(f"/api/tracks/{track_id}/diff")
    assert diff_resp.status_code == 200
    diff_data = diff_resp.json()
    assert diff_data is not None
    assert diff_data["from_sha"] == "1111111111111111111111111111111111111111"
    assert diff_data["to_sha"] == "2222222222222222222222222222222222222222"
    assert "app/routes.py" in diff_data["files_changed"]

    # Check that REST API improved!
    rest_diff = next((i for i in diff_data["items"] if i["name"] == "REST API Development"), None)
    assert rest_diff is not None
    assert rest_diff["before_status"] == "NOT_DEMONSTRATED"
    assert rest_diff["after_status"] == "DEMONSTRATED"
    assert rest_diff["change"] == "improved"

    # 7. Deduplication check: Sending duplicate delivery returns "duplicate"
    dup_resp = client.post(
        "/api/webhooks/github",
        json=push_payload,
        headers={
            "X-GitHub-Event": "push",
            "X-GitHub-Delivery": delivery_id,
        },
    )
    assert dup_resp.status_code == 200
    assert dup_resp.json()["status"] == "duplicate"


def test_webhook_ignores_non_push_events(client):
    settings = get_settings()
    settings.GITHUB_WEBHOOK_SECRET = "change-me"
    resp = client.post(
        "/api/webhooks/github",
        json={"zen": "Non-blocking is better than blocking."},
        headers={"X-GitHub-Event": "ping"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ignored"
    assert "not a push event" in resp.json()["reason"]


def test_webhook_ignores_branch_deletion(client):
    settings = get_settings()
    settings.GITHUB_WEBHOOK_SECRET = "change-me"
    resp = client.post(
        "/api/webhooks/github",
        json={"ref": "refs/heads/feature", "after": "0" * 40},
        headers={"X-GitHub-Event": "push"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ignored"
    assert "Branch deletion" in resp.json()["reason"]


def test_webhook_ignores_untracked_repo(client):
    settings = get_settings()
    settings.GITHUB_WEBHOOK_SECRET = "change-me"
    resp = client.post(
        "/api/webhooks/github",
        json={
            "ref": "refs/heads/main",
            "after": "abcdef1234567890abcdef1234567890abcdef12",
            "repository": {"owner": {"login": "unknown-user"}, "name": "unknown-repo"},
        },
        headers={"X-GitHub-Event": "push", "X-GitHub-Delivery": "untracked-test-123"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ignored"
    assert "is not tracked" in resp.json()["reason"]

