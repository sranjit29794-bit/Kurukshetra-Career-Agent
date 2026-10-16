"""Application configuration loaded from environment variables / .env.

Reference: docs/BRAIN.md (§7.4).
Uses pydantic-settings v2 as verified via Context7.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for DevProof backend."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # LLM (OpenAI-compatible)
    LLM_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta/openai/"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gemini-1.5-flash"
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


settings = Settings()
