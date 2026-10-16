from functools import lru_cache
from pathlib import Path
from typing import List, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
_ENV_PATH = ROOT_DIR / ".env"


class Settings(BaseSettings):
    # LLM Configuration
    LLM_BASE_URL: Optional[str] = None
    LLM_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    LLM_MODEL: Optional[str] = None
    LLM_TIMEOUT_S: int = 45
    LLM_ENABLED: bool = True

    # GitHub Integration
    GITHUB_TOKEN: Optional[str] = None
    GITHUB_WEBHOOK_SECRET: str = "change-me"
    PUBLIC_BASE_URL: Optional[str] = None

    # Application & Database
    DATABASE_URL: str = "sqlite:///./devproof.db"
    POLL_INTERVAL_S: int = 20
    MAX_FILES_ANALYZED: int = 150
    MAX_FILE_BYTES: int = 100000
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(
        env_file=[str(_ENV_PATH), ".env"],
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("GITHUB_TOKEN", mode="before")
    @classmethod
    def clean_github_token(cls, v: Optional[str]) -> Optional[str]:
        if isinstance(v, str):
            v_stripped = v.strip()
            return v_stripped if v_stripped else None
        return v

    @field_validator("LLM_API_KEY", mode="before")
    @classmethod
    def clean_llm_api_key(cls, v: Optional[str]) -> Optional[str]:
        if isinstance(v, str):
            v_stripped = v.strip()
            return v_stripped if v_stripped else None
        return v

    @property
    def effective_llm_api_key(self) -> Optional[str]:
        return self.LLM_API_KEY or self.GEMINI_API_KEY

    @property
    def cors_origins_list(self) -> List[str]:
        if not self.CORS_ORIGINS:
            return ["http://localhost:5173"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()


def clear_settings_cache() -> None:
    get_settings.cache_clear()
