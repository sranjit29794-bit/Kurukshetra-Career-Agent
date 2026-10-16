"""Unit tests for Phase EN-2: Engine Facade, Evidence Judge, Verifier, and Coach.

Reference: docs/BRAIN.md (§5, §10, §14) and docs/PLAN-5H.md (Phase EN-2).
"""

from __future__ import annotations

import pytest

from backend.app.agents.coach import coach
from backend.app.agents.evidence_verifier import evidence_verifier
from backend.app.engine_facade import engine_facade
from backend.app.schemas import (
    CommitInfo,
    DraftAssessment,
    RepoFile,
    RepoSnapshot,
    RequirementIn,
    Status,
    Strength,
)


@pytest.fixture
def mock_snapshot() -> RepoSnapshot:
    sql_code = """import sqlite3

def get_db():
    conn = sqlite3.connect('test.db')
    cursor = conn.cursor()
    cursor.execute('SELECT id, name FROM users WHERE id = ?', (1,))
    return cursor.fetchall()
"""
    return RepoSnapshot(
        repo_url="https://github.com/testuser/testapi",
        commit_sha="c3d4e5f67890123456789abcdef0123456789012",
        commit_info=CommitInfo(
            sha="c3d4e5f67890123456789abcdef0123456789012",
            message="feat: add database queries",
            author="tester",
            date="2026-02-01",
        ),
        files=[
            RepoFile(
                path="app/db.py",
                blob_sha="blob_sql",
                size_bytes=len(sql_code),
                content=sql_code,
            )
        ],
    )


class TestEngineFacadeAndAgents:
    @pytest.mark.asyncio
    async def test_engine_facade_extract_job(self) -> None:
        job = await engine_facade.extract_job(
            raw_text="We need Python and FastAPI to build REST APIs with PostgreSQL."
        )
        assert job.title != ""
        assert len(job.requirements) >= 3
        taxonomy_keys = {r.taxonomy_key for r in job.requirements}
        assert "python_lang" in taxonomy_keys or "rest_api" in taxonomy_keys

    @pytest.mark.asyncio
    async def test_engine_facade_assess_and_verify(
        self, mock_snapshot: RepoSnapshot
    ) -> None:
        req = RequirementIn(
            id="req_sql_database",
            name="SQL",
            category="Database",
            source_sentence="Work with SQL databases.",
            taxonomy_key="sql_database",
        )

        # Assess
        drafts = await engine_facade.assess(mock_snapshot, [req])
        assert len(drafts) == 1
        draft = drafts[0]
        assert draft.status == Status.DEMONSTRATED
        assert draft.strength == Strength.moderate
        assert len(draft.cited_signal_ids) >= 1

        # Verify
        verified = await engine_facade.verify(drafts, mock_snapshot)
        assert len(verified) == 1
        asmt = verified[0]
        assert asmt.status == Status.DEMONSTRATED
        assert len(asmt.evidence) >= 1
        assert asmt.evidence[0].file_path == "app/db.py"

        # Coach
        coached = await engine_facade.coach(verified)
        assert len(coached) == 1
        assert coached[0].summary != ""
        assert coached[0].next_step != ""

    def test_coach_suggestions_distinct_from_facts(self) -> None:
        asmt = DraftAssessment(
            requirement_id="req_empty",
            status=Status.NOT_DEMONSTRATED,
            strength=Strength.none,
            summary="Not demonstrated in analyzed scope for 'Deployment'.",
            limitation="No Dockerfile found.",
            next_step="",
        )
        verified_asmt = evidence_verifier.verify_assessments(
            [asmt],
            RepoSnapshot(
                repo_url="https://github.com/u/r",
                commit_sha="s",
                commit_info=CommitInfo(sha="s", message="", author="", date=""),
                files=[],
            ),
            candidate_signals=[],
        )[0]

        coached = coach.generate_coaching([verified_asmt])
        assert len(coached) == 1
        assert "Suggestion:" in coached[0].next_step
        assert "not demonstrated in analyzed scope" in coached[0].summary.lower()
