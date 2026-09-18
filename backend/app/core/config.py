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
    OLLAMA_MODEL: str = "qwen3:1.7b"
    OLLAMA_WEB_MODEL: str = "qwen3:8b"
    OLLAMA_TIMEOUT_SECONDS: float = 120.0

    # Tavily Web Search Configuration
    TAVILY_API_KEY: Optional[str] = None
    TAVILY_MAX_RESULTS: int = 8
    TAVILY_SEARCH_TIMEOUT: float = 15.0

    # Backend Monitoring Dashboard Configuration
    DASHBOARD_ENABLED: bool = True
    DASHBOARD_USERNAME: Optional[str] = None
    DASHBOARD_PASSWORD: Optional[str] = None
    DASHBOARD_MAX_LOGS: int = 500

    # File Intelligence Configuration
    MAX_FILE_SIZE_MB: int = 25
    MAX_FILES_PER_REQUEST: int = 10
    FILE_STORAGE_PATH: str = "./storage/uploads"
    VISION_MODEL: str = "gemma3:4b"
    EMBEDDING_MODEL: Optional[str] = None
    OCR_ENABLED: bool = True
    MAX_CONTEXT_CHUNKS: int = 8

    # Coding Workspace Configuration
    OLLAMA_CODING_MODEL: str = "qwen2.5-coder:7b"
    WORKSPACE_STORAGE_PATH: str = "./storage/workspaces"
    EXECUTION_TIMEOUT_SECONDS: float = 30.0
    EXECUTION_MAX_OUTPUT_CHARS: int = 50000
    SAFE_EXECUTION_DEV_MODE: bool = True

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
