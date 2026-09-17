import os
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration and settings."""

    APP_NAME: str = "Solix AI"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"

    # Ollama AI Configuration
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    OLLAMA_TIMEOUT_SECONDS: float = 60.0

    # Database Configuration (Defaults to SQLite async, easily swapped for PostgreSQL)
    DATABASE_URL: str = "sqlite+aiosqlite:///./solix.db"

    # CORS configuration
    # Comma-separated list of allowed origins (e.g. "http://localhost:3000,https://solix.vercel.app")
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    # Optional dedicated frontend URL
    FRONTEND_URL: Optional[str] = None
    # Allowed origin regex pattern (matches any *.vercel.app deployment preview/production domain)
    CORS_ORIGIN_REGEX: Optional[str] = r"^https:\/\/.*\.vercel\.app$"

    # Server binding
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        """Return CORS origins as a list of strings, including FRONTEND_URL if set."""
        origins: List[str] = []
        if self.CORS_ORIGINS:
            origins.extend([origin.strip().rstrip("/") for origin in self.CORS_ORIGINS.split(",") if origin.strip()])
        if self.FRONTEND_URL:
            clean_fe = self.FRONTEND_URL.strip().rstrip("/")
            if clean_fe and clean_fe not in origins:
                origins.append(clean_fe)
        return origins or ["*"]


settings = Settings()
