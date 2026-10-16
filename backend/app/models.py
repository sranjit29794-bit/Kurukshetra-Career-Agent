from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    source_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    source_type: Mapped[str] = mapped_column(String(50), default="fetched", nullable=False)
    raw_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    requirements: Mapped[List["Requirement"]] = relationship("Requirement", back_populates="job", cascade="all, delete-orphan")
    tracks: Mapped[List["Track"]] = relationship("Track", back_populates="job", cascade="all, delete-orphan")


class Requirement(Base):
    __tablename__ = "requirements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    priority: Mapped[str] = mapped_column(String(20), default="must", nullable=False)
    source_sentence: Mapped[str] = mapped_column(Text, nullable=False)
    search_terms: Mapped[Optional[List[str]]] = mapped_column(JSON, default=list, nullable=True)
    taxonomy_key: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    job: Mapped["Job"] = relationship("Job", back_populates="requirements")
    assessments: Mapped[List["Assessment"]] = relationship("Assessment", back_populates="requirement", cascade="all, delete-orphan")


class Repo(Base):
    __tablename__ = "repos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    default_branch: Mapped[str] = mapped_column(String(100), default="main", nullable=False)
    html_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    webhook_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    webhook_status: Mapped[str] = mapped_column(String(50), default="none", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    tracks: Mapped[List["Track"]] = relationship("Track", back_populates="repo", cascade="all, delete-orphan")


class Track(Base):
    __tablename__ = "tracks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    repo_id: Mapped[int] = mapped_column(Integer, ForeignKey("repos.id", ondelete="CASCADE"), nullable=False)
    branch: Mapped[str] = mapped_column(String(100), default="main", nullable=False)
    last_seen_sha: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    watcher_mode: Mapped[str] = mapped_column(String(50), default="polling", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    job: Mapped["Job"] = relationship("Job", back_populates="tracks")
    repo: Mapped["Repo"] = relationship("Repo", back_populates="tracks")
    analyses: Mapped[List["Analysis"]] = relationship("Analysis", back_populates="track", cascade="all, delete-orphan")
    agent_events: Mapped[List["AgentEvent"]] = relationship("AgentEvent", back_populates="track", cascade="all, delete-orphan")


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    track_id: Mapped[int] = mapped_column(Integer, ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False)
    commit_sha: Mapped[str] = mapped_column(String(64), nullable=False)
    commit_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    trigger: Mapped[str] = mapped_column(String(50), default="manual", nullable=False)
    kind: Mapped[str] = mapped_column(String(50), default="initial", nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="queued", nullable=False)
    prev_analysis_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("analyses.id", ondelete="SET NULL"), nullable=True)
    scope: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    ai_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("track_id", "commit_sha", name="uq_track_commit_sha"),
    )

    track: Mapped["Track"] = relationship("Track", back_populates="analyses")
    assessments: Mapped[List["Assessment"]] = relationship("Assessment", back_populates="analysis", cascade="all, delete-orphan")
    change_set: Mapped[Optional["ChangeSet"]] = relationship("ChangeSet", back_populates="analysis", uselist=False, cascade="all, delete-orphan")
    agent_events: Mapped[List["AgentEvent"]] = relationship("AgentEvent", back_populates="analysis", cascade="all, delete-orphan")


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    analysis_id: Mapped[int] = mapped_column(Integer, ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    requirement_id: Mapped[int] = mapped_column(Integer, ForeignKey("requirements.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    strength: Mapped[str] = mapped_column(String(50), default="none", nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    limitation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    next_step: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    carried_forward: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reassessed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ignored_signals: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, default=list, nullable=True)
    ai_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    analysis: Mapped["Analysis"] = relationship("Analysis", back_populates="assessments")
    requirement: Mapped["Requirement"] = relationship("Requirement", back_populates="assessments")
    evidence: Mapped[List["Evidence"]] = relationship("Evidence", back_populates="assessment", cascade="all, delete-orphan")


class Evidence(Base):
    __tablename__ = "evidence"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    assessment_id: Mapped[int] = mapped_column(Integer, ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False)
    signal_id: Mapped[str] = mapped_column(String(128), nullable=False)
    detector: Mapped[str] = mapped_column(String(100), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    line_start: Mapped[int] = mapped_column(Integer, nullable=False)
    line_end: Mapped[int] = mapped_column(Integer, nullable=False)
    snippet: Mapped[str] = mapped_column(Text, nullable=False)
    blob_sha: Mapped[str] = mapped_column(String(64), nullable=False)
    strength: Mapped[str] = mapped_column(String(50), nullable=False)
    counted: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    assessment: Mapped["Assessment"] = relationship("Assessment", back_populates="evidence")


class ChangeSet(Base):
    __tablename__ = "change_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    analysis_id: Mapped[int] = mapped_column(Integer, ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    before_sha: Mapped[str] = mapped_column(String(64), nullable=False)
    after_sha: Mapped[str] = mapped_column(String(64), nullable=False)
    files_added: Mapped[Optional[List[str]]] = mapped_column(JSON, default=list, nullable=True)
    files_removed: Mapped[Optional[List[str]]] = mapped_column(JSON, default=list, nullable=True)
    files_modified: Mapped[Optional[List[str]]] = mapped_column(JSON, default=list, nullable=True)
    impact_plan: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    analysis: Mapped["Analysis"] = relationship("Analysis", back_populates="change_set")


class AgentEvent(Base):
    __tablename__ = "agent_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    track_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("tracks.id", ondelete="CASCADE"), nullable=True)
    analysis_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("analyses.id", ondelete="CASCADE"), nullable=True)
    agent: Mapped[str] = mapped_column(String(100), nullable=False)
    level: Mapped[str] = mapped_column(String(20), default="info", nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    track: Mapped[Optional["Track"]] = relationship("Track", back_populates="agent_events")
    analysis: Mapped[Optional["Analysis"]] = relationship("Analysis", back_populates="agent_events")


class WebhookDelivery(Base):
    __tablename__ = "webhook_deliveries"

    delivery_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    event: Mapped[str] = mapped_column(String(64), nullable=False)
    sha: Mapped[str] = mapped_column(String(64), nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    outcome: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


class FileCache(Base):
    __tablename__ = "file_cache"

    blob_sha: Mapped[str] = mapped_column(String(64), primary_key=True)
    path: Mapped[str] = mapped_column(String(512), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
