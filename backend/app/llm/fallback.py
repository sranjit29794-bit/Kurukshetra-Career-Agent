"""Deterministic fallback generation for assessments and explanations.

Reference: docs/BRAIN.md (§3, §10.2, §16.1) and rule 10-engine-invariants.md.

Hard Invariants:
1. Missing evidence is always phrased as "not demonstrated in analyzed scope".
2. Never say "student lacks skill" or "candidate is missing the skill".
3. Provides reliable, transparent explanations even when LLM is disabled or unavailable.
"""

from __future__ import annotations

from backend.app.schemas import Signal, Status


def generate_deterministic_explanation(
    status: Status,
    requirement_title: str,
    signals: list[Signal] | None = None,
) -> str:
    """Generate a neutral, factual explanation adhering to engine invariants."""
    sig_count = len(signals) if signals else 0

    if status == Status.DEMONSTRATED:
        return (
            f"Strong verified implementation evidence found in analyzed repository files "
            f"for '{requirement_title}' ({sig_count} signal{'s' if sig_count != 1 else ''})."
        )
    if status == Status.PARTIAL:
        return (
            f"Partial implementation evidence found in analyzed scope for '{requirement_title}' "
            f"({sig_count} signal{'s' if sig_count != 1 else ''}). Additional integration or testing required."
        )
    if status == Status.NOT_DEMONSTRATED:
        return (
            f"Not demonstrated in analyzed scope for '{requirement_title}'. "
            f"No verified implementation signals were found in the examined files."
        )
    # UNABLE_TO_ASSESS
    return (
        f"Unable to assess '{requirement_title}' in analyzed scope. "
        f"Analysis budget limits or unsupported file formats prevented full verification."
    )


def generate_deterministic_limitations(
    status: Status,
    taxonomy_key: str | None,
    signals: list[Signal] | None = None,
) -> list[str]:
    """Generate objective limitations of the current evidence."""
    limitations: list[str] = []

    if status == Status.NOT_DEMONSTRATED:
        limitations.append(
            "No active implementation code identified in the analyzed repository files."
        )
        return limitations

    if taxonomy_key == "testing":
        limitations.append(
            "Static test structure and project imports verified; runtime test suite execution "
            "requires a CI workflow or check run."
        )
    elif taxonomy_key == "deployment":
        limitations.append(
            "Deployment configuration verified statically; runtime deployment health "
            "not verified in static scope."
        )

    # Check if there were any ignored signals (e.g. comments, docstrings)
    if signals:
        ignored = [s for s in signals if not s.counted]
        if ignored:
            limitations.append(
                f"{len(ignored)} weak signal{'s were' if len(ignored) != 1 else ' was'} ignored "
                f"(comments, docstrings, or empty definitions do not count as evidence)."
            )

    return limitations


def generate_deterministic_next_steps(
    status: Status,
    taxonomy_key: str | None,
) -> list[str]:
    """Generate actionable, constructive next steps to raise the evidence ladder."""
    if status == Status.DEMONSTRATED:
        return [
            "Maintain current test coverage and adhere to parameterized query and type safety standards."
        ]

    steps: list[str] = []
    if taxonomy_key == "sql_database":
        steps.append(
            "Add a database schema migration file or execute parameterized queries "
            "with parameter bindings from API route handlers."
        )
    elif taxonomy_key == "testing":
        steps.append(
            "Add pytest test functions that import application modules and assert on return values "
            "(avoid trivial assertions like 'assert True')."
        )
    elif taxonomy_key == "rest_api":
        steps.append(
            "Define FastAPI or Flask route handlers decorated with HTTP methods and typed Pydantic models."
        )
    elif taxonomy_key == "deployment":
        steps.append(
            "Add a Dockerfile with valid base image, port exposure, and ENTRYPOINT/CMD instruction."
        )
    else:
        steps.append(
            "Add concrete implementation files and unit tests demonstrating this requirement in the codebase."
        )

    return steps
