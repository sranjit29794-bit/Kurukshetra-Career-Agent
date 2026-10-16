from functools import lru_cache
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # LLM Configuration
    LLM_BASE_URL: Optional[str] = None
    LLM_API_KEY: Optional[str] = None
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
    CORS_ORIGINS: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        if not self.CORS_ORIGINS:
            return ["http://localhost:5173"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
