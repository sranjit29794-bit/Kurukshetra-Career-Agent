"""SQLAlchemy 2.x ORM models for DevProof.

Reference: docs/BRAIN.md (§9).

Security Note (Row-Level Security):
DevProof is a local-first single-tenant developer application running on SQLite.
SQLite does not natively support Row Level Security (RLS). If migrating to a
multi-tenant PostgreSQL deployment, RLS must be enabled on all user-scoped tables
(jobs, requirements, repos, tracks, analyses, assessments, evidence, change_sets, agent_events).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Declarative base class for all SQLAlchemy models."""


class JobModel(Base):
    """Job descriptions submitted for assessment."""

    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    source_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    source_type: Mapped[str] = mapped_column(
        String(32), default="fetched", nullable=False
    )
    source_detail: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    raw_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    requirements: Mapped[list[RequirementModel]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )
    tracks: Mapped[list[TrackModel]] = relationship(back_populates="job")


class RequirementModel(Base):
    """Skill or concept requirements extracted from job descriptions."""

    __tablename__ = "requirements"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    job_id: Mapped[str] = mapped_column(
        ForeignKey("jobs.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    priority: Mapped[str] = mapped_column(String(16), default="must", nullable=False)
    source_sentence: Mapped[str] = mapped_column(Text, nullable=False)
    search_terms: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    taxonomy_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    job: Mapped[JobModel] = relationship(back_populates="requirements")
    assessments: Mapped[list[AssessmentModel]] = relationship(
        back_populates="requirement"
    )


class RepoModel(Base):
    """Connected GitHub repositories."""

    __tablename__ = "repos"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner: Mapped[str] = mapped_column(String(128), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    default_branch: Mapped[str] = mapped_column(
        String(64), default="main", nullable=False
    )
    html_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    webhook_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    webhook_status: Mapped[str] = mapped_column(
        String(32), default="none", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    tracks: Mapped[list[TrackModel]] = relationship(back_populates="repo")


class ResumeModel(Base):
    """Parsed candidate resume claims and candidate repositories."""

    __tablename__ = "resumes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    extracted_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    claimed_skills: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, default=list, nullable=False
    )
    repo_candidates: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, default=list, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    tracks: Mapped[list[TrackModel]] = relationship(back_populates="resume")


class TrackModel(Base):
    """Pairing of a job posting and a GitHub repository."""

    __tablename__ = "tracks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    job_id: Mapped[str] = mapped_column(
        ForeignKey("jobs.id"), nullable=False, index=True
    )
    repo_id: Mapped[str] = mapped_column(
        ForeignKey("repos.id"), nullable=False, index=True
    )
    resume_id: Mapped[str | None] = mapped_column(
        ForeignKey("resumes.id"), nullable=True, index=True
    )
    branch: Mapped[str] = mapped_column(String(64), default="main", nullable=False)
    last_seen_sha: Mapped[str | None] = mapped_column(String(64), nullable=True)
    watcher_mode: Mapped[str] = mapped_column(
        String(32), default="polling", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    job: Mapped[JobModel] = relationship(back_populates="tracks")
    repo: Mapped[RepoModel] = relationship(back_populates="tracks")
    resume: Mapped[ResumeModel | None] = relationship(back_populates="tracks")
    analyses: Mapped[list[AnalysisModel]] = relationship(back_populates="track")
    events: Mapped[list[AgentEventModel]] = relationship(back_populates="track")


class AnalysisModel(Base):
    """Evidence analysis run at a specific commit SHA."""

    __tablename__ = "analyses"
    __table_args__ = (
        UniqueConstraint("track_id", "commit_sha", name="uq_analysis_track_sha"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    track_id: Mapped[str] = mapped_column(
        ForeignKey("tracks.id"), nullable=False, index=True
    )
    commit_sha: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    commit_message: Mapped[str] = mapped_column(Text, default="", nullable=False)
    trigger: Mapped[str] = mapped_column(String(32), default="manual", nullable=False)
    kind: Mapped[str] = mapped_column(String(32), default="initial", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="complete", nullable=False)
    prev_analysis_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    scope: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    ai_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    track: Mapped[TrackModel] = relationship(back_populates="analyses")
    assessments: Mapped[list[AssessmentModel]] = relationship(
        back_populates="analysis", cascade="all, delete-orphan"
    )
    change_set: Mapped[ChangeSetModel | None] = relationship(
        back_populates="analysis", uselist=False
    )


class AssessmentModel(Base):
    """Per-requirement assessment result within an analysis run."""

    __tablename__ = "assessments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    analysis_id: Mapped[str] = mapped_column(
        ForeignKey("analyses.id"), nullable=False, index=True
    )
    requirement_id: Mapped[str] = mapped_column(
        ForeignKey("requirements.id"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    strength: Mapped[str] = mapped_column(String(32), default="none", nullable=False)
    summary: Mapped[str] = mapped_column(Text, default="", nullable=False)
    limitation: Mapped[str] = mapped_column(Text, default="", nullable=False)
    next_step: Mapped[str] = mapped_column(Text, default="", nullable=False)
    carried_forward: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    reassessed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    ignored_signals: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, default=list, nullable=False
    )
    ai_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    analysis: Mapped[AnalysisModel] = relationship(back_populates="assessments")
    requirement: Mapped[RequirementModel] = relationship(back_populates="assessments")
    evidence: Mapped[list[EvidenceModel]] = relationship(
        back_populates="assessment", cascade="all, delete-orphan"
    )


class EvidenceModel(Base):
    """Verified evidence snippet supporting an assessment."""

    __tablename__ = "evidence"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    assessment_id: Mapped[str] = mapped_column(
        ForeignKey("assessments.id"), nullable=False, index=True
    )
    signal_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    detector: Mapped[str] = mapped_column(String(64), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    line_start: Mapped[int] = mapped_column(Integer, nullable=False)
    line_end: Mapped[int] = mapped_column(Integer, nullable=False)
    snippet: Mapped[str] = mapped_column(Text, nullable=False)
    blob_sha: Mapped[str] = mapped_column(String(64), nullable=False)
    strength: Mapped[str] = mapped_column(String(32), nullable=False)
    counted: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    assessment: Mapped[AssessmentModel] = relationship(back_populates="evidence")


class ChangeSetModel(Base):
    """Git commit delta records and impact classification."""

    __tablename__ = "change_sets"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    analysis_id: Mapped[str] = mapped_column(
        ForeignKey("analyses.id"), nullable=False, unique=True, index=True
    )
    before_sha: Mapped[str] = mapped_column(String(64), nullable=False)
    after_sha: Mapped[str] = mapped_column(String(64), nullable=False)
    files_added: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    files_removed: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    files_modified: Mapped[list[str]] = mapped_column(
        JSON, default=list, nullable=False
    )
    impact_plan: Mapped[dict[str, Any]] = mapped_column(
        JSON, default=dict, nullable=False
    )

    analysis: Mapped[AnalysisModel] = relationship(back_populates="change_set")


class AgentEventModel(Base):
    """Agent pipeline progress events for the Agent Activity Feed."""

    __tablename__ = "agent_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    track_id: Mapped[str] = mapped_column(
        ForeignKey("tracks.id"), nullable=False, index=True
    )
    analysis_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )
    agent: Mapped[str] = mapped_column(String(64), nullable=False)
    level: Mapped[str] = mapped_column(String(16), default="info", nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    track: Mapped[TrackModel] = relationship(back_populates="events")


class WebhookDeliveryModel(Base):
    """Audit log of inbound GitHub webhook deliveries."""

    __tablename__ = "webhook_deliveries"

    delivery_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    event: Mapped[str] = mapped_column(String(64), nullable=False)
    sha: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    outcome: Mapped[str] = mapped_column(
        String(64), default="processed", nullable=False
    )


class FileCacheModel(Base):
    """File content cache indexed by git blob SHA to avoid duplicate fetches."""

    __tablename__ = "file_cache"

    blob_sha: Mapped[str] = mapped_column(String(64), primary_key=True)
    path: Mapped[str] = mapped_column(String(512), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
