"""Application configuration loaded from environment variables / .env.

Reference: docs/BRAIN.md (§7.4).
Uses pydantic-settings v2 as verified via Context7.
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_backend_dir = Path(__file__).resolve().parent.parent
_project_root = _backend_dir.parent
_env_files = (
    str(_project_root / ".env"),
    str(_backend_dir / ".env"),
)


class Settings(BaseSettings):
    """Runtime configuration for DevProof backend."""

    model_config = SettingsConfigDict(
        env_file=_env_files,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # LLM (OpenAI-compatible)
    LLM_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta/openai/"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gemini-1.5-flash"
    LLM_FALLBACK_MODEL: str = ""
    LLM_TIMEOUT_S: int = 45
    LLM_ENABLED: bool = True

    # GitHub
    GITHUB_TOKEN: str = ""
    GITHUB_WEBHOOK_SECRET: str = "change-me"
    PUBLIC_BASE_URL: str = ""

    # App
    DATABASE_URL: str = "sqlite:///./devproof.db"
    POLL_INTERVAL_S: int = 20
    MAX_FILES_ANALYZED: int = 150
    MAX_FILE_BYTES: int = 100000
    MAX_RESUME_BYTES: int = 5000000
    MAX_REPOS_PER_JOB: int = 3
    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list of strings."""
        return [
            origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()
        ]

    @property
    def resolved_database_url(self) -> str:
        """Resolve database URL ensuring SQLite relative paths resolve to project root."""
        if self.DATABASE_URL.startswith("sqlite"):
            if ":memory:" in self.DATABASE_URL:
                return self.DATABASE_URL
            prefix = "sqlite:///"
            if self.DATABASE_URL.startswith(prefix):
                raw = self.DATABASE_URL[len(prefix) :]
                p = Path(raw)
                if not p.is_absolute():
                    abs_p = (_project_root / raw).resolve()
                    return f"sqlite:///{abs_p.as_posix()}"
                return f"sqlite:///{p.resolve().as_posix()}"
        return self.DATABASE_URL

    @property
    def db_file_path(self) -> str:
        """Return the absolute path of the SQLite database file if applicable."""
        if self.resolved_database_url.startswith("sqlite:///"):
            raw = self.resolved_database_url.replace("sqlite:///", "")
            if ":memory:" not in raw:
                return str(Path(raw).resolve())
        return self.DATABASE_URL


settings = Settings()
