"""Command-line interface to run deterministic engine analysis on repository fixtures.

Reference: docs/PLAN-5H.md (§5 EN-1).
Usage:
    python -m backend.app.engine_cli --fixture c0|c1|c2
"""

from __future__ import annotations

import argparse

from backend.app.detectors.registry import get_detector
from backend.app.schemas import RepoSnapshot, RequirementIn, Status
from backend.app.services.status_rules import decide
from backend.tests.fixtures.loader import load_repo_fixture_snapshot


def assess_snapshot(
    snapshot: RepoSnapshot,
    requirements: list[RequirementIn],
) -> dict[str, tuple[Status, str, list[dict]]]:
    """Execute deterministic detectors and status rules over a snapshot."""
    results: dict[str, tuple[Status, str, list[dict]]] = {}
    all_files = {f.path: f.content or "" for f in snapshot.files}

    for req in requirements:
        detector = get_detector(req.taxonomy_key)
        all_signals = []
        for f in snapshot.files:
            sigs = detector.detect(
                f.path,
                f.content or "",
                blob_sha=f.blob_sha,
                all_files=all_files,
            )
            all_signals.extend(sigs)

        status, strength, ignored = decide(all_signals, taxonomy_key=req.taxonomy_key)
        results[req.name] = (status, strength.value, ignored)

    return results


def main() -> None:
    """Entry point for engine_cli."""
    parser = argparse.ArgumentParser(description="Run DevProof engine on demo fixtures")
    parser.add_argument(
        "--fixture",
        choices=["c0", "c1", "c2"],
        required=True,
        help="Fixture version to evaluate (c0, c1, or c2)",
    )
    args = parser.parse_args()

    requirements = [
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
            source_sentence="PostgreSQL or SQLite database experience required",
        ),
        RequirementIn(
            id="req_testing",
            name="Testing",
            category="Quality",
            taxonomy_key="testing",
            source_sentence="Automated testing with Pytest",
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

    subpath = args.fixture.lower()
    snapshot = load_repo_fixture_snapshot("student_api", subpath)
    results = assess_snapshot(snapshot, requirements)

    print(f"\n=== DevProof Engine Assessment: student_api ({args.fixture.upper()}) ===")
    print(
        f"Scope: {snapshot.scope.analyzed} files analyzed, {snapshot.scope.skipped} skipped\n"
    )
    print(f"{'Requirement':<20} | {'Status':<25} | {'Strength':<10} | Ignored Signals")
    print("-" * 75)
    for req_name, (status, strength, ignored) in results.items():
        ignored_count = len(ignored)
        print(
            f"{req_name:<20} | {status.value:<25} | {strength:<10} | {ignored_count} ignored"
        )

    print("\nVerification checks:")
    if args.fixture == "c0":
        assert results["REST APIs"][0] == Status.DEMONSTRATED
        assert results["SQL Database"][0] == Status.NOT_DEMONSTRATED
        assert results["Testing"][0] == Status.NOT_DEMONSTRATED
        assert results["Deployment"][0] == Status.NOT_DEMONSTRATED
        print("PASS: C0 baseline matches expected statuses.")
    elif args.fixture == "c1":
        assert results["REST APIs"][0] == Status.DEMONSTRATED
        assert results["SQL Database"][0] == Status.NOT_DEMONSTRATED
        assert results["Testing"][0] == Status.NOT_DEMONSTRATED
        print("PASS: C1 README-only commit has 0 upgrades.")
    elif args.fixture == "c2":
        assert results["SQL Database"][0] == Status.DEMONSTRATED
        assert (
            results["Testing"][0] == Status.PARTIAL
        )  # Capped at PARTIAL per Invariant #6
        assert results["Deployment"][0] == Status.NOT_DEMONSTRATED
        print("PASS: C2 updates SQL to DEMONSTRATED and Testing to PARTIAL.")


if __name__ == "__main__":
    main()
