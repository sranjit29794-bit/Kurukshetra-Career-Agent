import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from backend.app.db import Base
from backend.app.models import (
    Analysis,
    Assessment,
    Evidence,
    Job,
    Repo,
    Requirement,
    Track,
)


@pytest.fixture
def db_session():
    # Use in-memory SQLite database for test isolation
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def test_table_creation_and_insertion(db_session):
    # Create Job
    job = Job(
        title="Backend Intern",
        company="TechCorp",
        source_url="https://techcorp.com/jobs/1",
        source_type="fetched",
        confirmed=True,
    )
    db_session.add(job)
    db_session.flush()

    assert job.id is not None

    # Create Requirement
    req = Requirement(
        job_id=job.id,
        name="REST API Development",
        category="Backend",
        priority="must",
        source_sentence="Must build REST APIs.",
        search_terms=["fastapi", "rest"],
        taxonomy_key="rest_api",
    )
    db_session.add(req)

    # Create Repo
    repo = Repo(
        owner="developer",
        name="api-project",
        default_branch="main",
        html_url="https://github.com/developer/api-project",
        webhook_status="registered",
    )
    db_session.add(repo)
    db_session.flush()

    # Create Track
    track = Track(
        job_id=job.id,
        repo_id=repo.id,
        branch="main",
        watcher_mode="polling",
    )
    db_session.add(track)
    db_session.flush()

    # Create Analysis
    analysis = Analysis(
        track_id=track.id,
        commit_sha="abc1234567890def",
        commit_message="Initial commit",
        trigger="manual",
        kind="initial",
        status="complete",
        scope={"analyzed": 10, "skipped": 2},
    )
    db_session.add(analysis)
    db_session.flush()

    # Create Assessment and Evidence
    assessment = Assessment(
        analysis_id=analysis.id,
        requirement_id=req.id,
        status="DEMONSTRATED",
        strength="strong",
        summary="Verified endpoints found in code.",
    )
    db_session.add(assessment)
    db_session.flush()

    ev = Evidence(
        assessment_id=assessment.id,
        signal_id="sig_test_1",
        detector="rest_api",
        file_path="app/main.py",
        line_start=10,
        line_end=20,
        snippet="@app.get('/')\ndef root(): pass",
        blob_sha="blobsha123",
        strength="strong",
        counted=True,
    )
    db_session.add(ev)
    db_session.commit()

    # Verify retrieval
    saved_analysis = db_session.query(Analysis).filter_by(commit_sha="abc1234567890def").first()
    assert saved_analysis is not None
    assert len(saved_analysis.assessments) == 1
    assert len(saved_analysis.assessments[0].evidence) == 1
    assert saved_analysis.assessments[0].evidence[0].signal_id == "sig_test_1"


def test_duplicate_analysis_protection(db_session):
    # Setup track
    job = Job(title="J", company="C", source_type="fetched")
    repo = Repo(owner="O", name="R", html_url="https://github.com/O/R")
    db_session.add_all([job, repo])
    db_session.flush()

    track = Track(job_id=job.id, repo_id=repo.id, branch="main")
    db_session.add(track)
    db_session.flush()

    # First analysis at commit SHA 9999
    analysis_1 = Analysis(
        track_id=track.id,
        commit_sha="9999999999999999999999999999999999999999",
        status="complete",
    )
    db_session.add(analysis_1)
    db_session.commit()

    # Attempt second analysis with identical (track_id, commit_sha)
    analysis_2 = Analysis(
        track_id=track.id,
        commit_sha="9999999999999999999999999999999999999999",
        status="queued",
    )
    db_session.add(analysis_2)

    # Invariant #10 & DB constraint: Must raise IntegrityError
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
