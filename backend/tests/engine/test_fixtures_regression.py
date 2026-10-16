"""Mandatory regression tests from BRAIN §17 using fixture repositories.

Tests:
- C0 baseline: REST demonstrated, SQL/Testing/Deployment not demonstrated
- C1 live push: README-only commit, 0 skill upgrades
- C2 live push: SQL becomes Demonstrated, Testing becomes Partial, Deployment unchanged
- Decoy repo: SQL in docstring + assert 1 == 1 earns nothing
- Injection repo: prompt injection comment ignored as data
- Non-Python repo: scope analyzed is 0 supported files
"""

from __future__ import annotations

from backend.app.engine_cli import assess_snapshot
from backend.app.schemas import RequirementIn, Status
from backend.tests.fixtures.loader import load_repo_fixture_snapshot


def get_demo_requirements() -> list[RequirementIn]:
    return [
        RequirementIn(
            id="req_rest_api",
            name="REST APIs",
            category="Backend",
            taxonomy_key="rest_api",
            source_sentence="Build REST APIs with FastAPI",
        ),
        RequirementIn(
            id="req_sql_database",
            name="SQL Database",
            category="Database",
            taxonomy_key="sql_database",
            source_sentence="SQL database integration required",
        ),
        RequirementIn(
            id="req_testing",
            name="Testing",
            category="Quality",
            taxonomy_key="testing",
            source_sentence="Unit and integration testing with Pytest",
        ),
        RequirementIn(
            id="req_deployment",
            name="Deployment",
            category="DevOps",
            taxonomy_key="deployment",
            source_sentence="Docker containerization",
        ),
        RequirementIn(
            id="req_python",
            name="Python",
            category="Language",
            taxonomy_key="python",
            source_sentence="Python 3.11+",
        ),
    ]


def test_student_api_c0_baseline():
    """Verify C0 baseline: REST is demonstrated; SQL, Testing, and Deployment are NOT demonstrated."""
    snapshot = load_repo_fixture_snapshot("student_api", "c0")
    results = assess_snapshot(snapshot, get_demo_requirements())

    assert results["REST APIs"][0] == Status.DEMONSTRATED
    assert results["SQL Database"][0] == Status.NOT_DEMONSTRATED
    assert results["Testing"][0] == Status.NOT_DEMONSTRATED
    assert results["Deployment"][0] == Status.NOT_DEMONSTRATED
    assert results["Python"][0] == Status.DEMONSTRATED


def test_student_api_c1_readme_only_no_upgrade():
    """Verify C1 README-only commit produces identical skill statuses as C0."""
    snapshot_c0 = load_repo_fixture_snapshot("student_api", "c0")
    snapshot_c1 = load_repo_fixture_snapshot("student_api", "c1")
    reqs = get_demo_requirements()

    results_c0 = assess_snapshot(snapshot_c0, reqs)
    results_c1 = assess_snapshot(snapshot_c1, reqs)

    for req in reqs:
        assert results_c1[req.name][0] == results_c0[req.name][0]


def test_student_api_c2_sql_and_testing_transitions():
    """Verify C2 commit: SQL becomes DEMONSTRATED, Testing becomes PARTIAL (never DEMONSTRATED)."""
    snapshot = load_repo_fixture_snapshot("student_api", "c2")
    results = assess_snapshot(snapshot, get_demo_requirements())

    assert results["SQL Database"][0] == Status.DEMONSTRATED
    assert results["Testing"][0] == Status.PARTIAL  # Capped per Invariant #6
    assert results["Deployment"][0] == Status.NOT_DEMONSTRATED
    assert results["REST APIs"][0] == Status.DEMONSTRATED


def test_decoy_repo_earns_nothing():
    """Verify decoy repo with SQL only in docstring and test with assert 1 == 1 earns 0 credit."""
    snapshot = load_repo_fixture_snapshot("decoy_repo")
    results = assess_snapshot(snapshot, get_demo_requirements())

    assert results["SQL Database"][0] == Status.NOT_DEMONSTRATED
    assert results["Testing"][0] == Status.NOT_DEMONSTRATED


def test_injection_repo_treated_as_data():
    """Verify malicious instructions in repo comments do not alter statuses."""
    snapshot = load_repo_fixture_snapshot("injection_repo")
    results = assess_snapshot(snapshot, get_demo_requirements())

    # Injection text claimed all demonstrated, but real code has neither REST, SQL, nor tests
    assert results["SQL Database"][0] == Status.NOT_DEMONSTRATED
    assert results["Testing"][0] == Status.NOT_DEMONSTRATED
    assert results["Deployment"][0] == Status.NOT_DEMONSTRATED
    assert results["REST APIs"][0] == Status.NOT_DEMONSTRATED


def test_non_python_repo_analyzed_zero_supported():
    """Verify non-Python repo has 0 supported files analyzed."""
    snapshot = load_repo_fixture_snapshot("non_python_repo")
    assert snapshot.scope.analyzed == 0
    assert snapshot.scope.skipped >= 1
