"""Taxonomy detector registry.

Reference: docs/BRAIN.md (§10.3, §11).
Maps taxonomy keys to detector instances.
"""

from __future__ import annotations

from backend.app.detectors.base import BaseDetector
from backend.app.detectors.deployment import DeploymentDetector
from backend.app.detectors.generic_keyword import GenericKeywordDetector
from backend.app.detectors.python_lang import PythonLangDetector
from backend.app.detectors.rest_api import RestApiDetector
from backend.app.detectors.sql import SqlDatabaseDetector
from backend.app.detectors.testing import TestingDetector

_REGISTRY: dict[str, BaseDetector] = {
    "python": PythonLangDetector(),
    "rest_api": RestApiDetector(),
    "sql_database": SqlDatabaseDetector(),
    "testing": TestingDetector(),
    "deployment": DeploymentDetector(),
}


def get_detector(taxonomy_key: str | None) -> BaseDetector:
    """Retrieve detector instance for a taxonomy key, defaulting to generic keyword."""
    if taxonomy_key and taxonomy_key in _REGISTRY:
        return _REGISTRY[taxonomy_key]
    return GenericKeywordDetector()


def list_registered_detectors() -> dict[str, BaseDetector]:
    """Return all registered taxonomy detectors."""
    return dict(_REGISTRY)
