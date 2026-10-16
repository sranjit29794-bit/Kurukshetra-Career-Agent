from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()

    assert data["backend"] == "ok"
    assert "llm" in data
    assert "github" in data
    assert "watcher" in data
    assert "timestamp" in data
    assert data["llm"] in ["ok", "down", "disabled", "unconfigured"]
    assert data["github"] in ["ok", "rate_limited", "unconfigured", "error"]
    assert data["watcher"] in ["webhook", "polling", "both", "unconfigured", "idle"]


def test_consistent_error_shape_on_404():
    response = client.get("/api/nonexistent-endpoint")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert "code" in data["error"]
    assert "message" in data["error"]
    assert "retryable" in data["error"]
