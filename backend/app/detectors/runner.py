"""Detector registry: runs all deterministic detectors over a file."""
from typing import List
from backend.app.detectors.base import DetectedSignal
from backend.app.detectors.rest_api import detect_rest_api
from backend.app.detectors.sql_database import detect_sql_database
from backend.app.detectors.testing import detect_testing
from backend.app.detectors.auth import detect_auth
from backend.app.detectors.async_concurrency import detect_async_concurrency
from backend.app.detectors.deployment import detect_deployment


def run_all_detectors(file_path: str, content: str, blob_sha: str = "") -> List[DetectedSignal]:
    """Runs all registered deterministic detectors on a single file's content."""
    signals: List[DetectedSignal] = []
    signals.extend(detect_rest_api(file_path, content, blob_sha))
    signals.extend(detect_sql_database(file_path, content, blob_sha))
    signals.extend(detect_testing(file_path, content, blob_sha))
    signals.extend(detect_auth(file_path, content, blob_sha))
    signals.extend(detect_async_concurrency(file_path, content, blob_sha))
    signals.extend(detect_deployment(file_path, content, blob_sha))
    return signals
