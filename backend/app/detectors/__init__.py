"""Detectors package for analyzing repository source files.

Reference: docs/BRAIN.md (§11).
"""

from backend.app.detectors.base import BaseDetector, compute_blob_sha, compute_signal_id
from backend.app.detectors.deployment import DeploymentDetector
from backend.app.detectors.generic_keyword import GenericKeywordDetector
from backend.app.detectors.python_lang import PythonLangDetector
from backend.app.detectors.registry import get_detector, list_registered_detectors
from backend.app.detectors.rest_api import RestApiDetector
from backend.app.detectors.sql import SqlDatabaseDetector
from backend.app.detectors.testing import TestingDetector
from backend.app.detectors.weak_signals import (
    is_empty_or_pass_only,
    is_readme_or_doc,
    is_trivial_assert_node,
)

__all__ = [
    "BaseDetector",
    "DeploymentDetector",
    "GenericKeywordDetector",
    "PythonLangDetector",
    "RestApiDetector",
    "SqlDatabaseDetector",
    "TestingDetector",
    "compute_blob_sha",
    "compute_signal_id",
    "get_detector",
    "is_empty_or_pass_only",
    "is_readme_or_doc",
    "is_trivial_assert_node",
    "list_registered_detectors",
]
