import json
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "StudyPilot AI"
    APP_VERSION: str = "0.2.0"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"
    
    # Database - Default PostgreSQL with Neon & SQLite fallback capability
    DATABASE_URL: str = "postgresql+asyncpg://postgres:admin@localhost:5432/studypilot"
    DIRECT_DATABASE_URL: Union[str, None] = None
    
    # Security & Authentication
    SECRET_KEY: str = "studypilot-secure-jwt-secret-key-2026-production-token"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    COOKIE_NAME: str = "studypilot_token"
    CSRF_COOKIE_NAME: str = "studypilot_csrf"
    
    # CORS Origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
    ]
    
    # AI / LLM Configuration
    LLM_PROVIDER: str = "gemini"  # "gemini" | "deterministic" | "openai"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    OPENAI_API_KEY: str = ""
    LLM_TIMEOUT_SECONDS: int = 30
    LLM_MAX_OUTPUT_TOKENS: int = 2048
    LLM_TEMPERATURE: float = 0.7
    LLM_RATE_LIMIT_PER_MINUTE: int = 20

    # RAG & Embedding Configuration
    EMBEDDING_PROVIDER: str = "gemini"  # "gemini" | "mock"
    EMBEDDING_MODEL: str = "models/text-embedding-004"
    EMBEDDING_DIMENSION: int = 768
    DOCUMENT_STORAGE_DIR: str = "storage/documents"
    MAX_DOCUMENT_SIZE_BYTES: int = 15 * 1024 * 1024  # 15 MB
    RAG_CHUNK_SIZE: int = 1000
    RAG_CHUNK_OVERLAP: int = 200
    RAG_DEFAULT_TOP_K: int = 4
    RAG_SIMILARITY_THRESHOLD: float = 0.70  # Max cosine distance to consider relevant

    # CodeLab / Judge0 Remote Execution Engine Configuration
    JUDGE0_API_URL: str = "https://ce.judge0.com"
    JUDGE0_API_KEY: str = ""
    JUDGE0_API_HOST: str = "ce.judge0.com"
    JUDGE0_TIMEOUT_SECONDS: int = 15
    JUDGE0_MAX_SOURCE_SIZE_BYTES: int = 65536  # 64 KB
    JUDGE0_MAX_STDIN_SIZE_BYTES: int = 65536   # 64 KB
    JUDGE0_DEFAULT_CPU_TIME_LIMIT: float = 5.0 # 5.0 seconds
    JUDGE0_DEFAULT_MEMORY_LIMIT: int = 128000  # 128 MB in KB
    
    @classmethod
    def _clean_db_url(cls, v: str) -> str:
        if not v:
            return ""
        from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

        v = v.strip().strip("'\"")
        # Auto-convert synchronous postgres drivers to asyncpg for async SQLAlchemy
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+asyncpg://", 1)
        elif v.startswith("postgresql://") and not v.startswith("postgresql+asyncpg://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif v.startswith("sqlite:///") and not v.startswith("sqlite+aiosqlite:///"):
            v = v.replace("sqlite:///", "sqlite+aiosqlite:///", 1)

        if not v.startswith("postgresql+asyncpg://"):
            return v

        try:
            parsed = urlparse(v)
            query_params = parse_qs(parsed.query)

            # Strip libpq-specific parameters that asyncpg.connect() does not accept
            query_params.pop("channel_binding", None)
            query_params.pop("target_session_attrs", None)

            # Asyncpg uses ?ssl=require rather than ?sslmode=require
            if "sslmode" in query_params:
                ssl_val = query_params.pop("sslmode")
                query_params["ssl"] = ssl_val
            elif "ssl" not in query_params and "neon.tech" in parsed.netloc:
                query_params["ssl"] = ["require"]

            new_query = urlencode(query_params, doseq=True)
            return urlunparse(parsed._replace(query=new_query))
        except Exception:
            if "sslmode=require" in v:
                v = v.replace("sslmode=require", "ssl=require")
            return v

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        cleaned = cls._clean_db_url(v)
        return cleaned if cleaned else "postgresql+asyncpg://postgres:admin@localhost:5432/studypilot"

    @field_validator("DIRECT_DATABASE_URL", mode="before")
    @classmethod
    def normalize_direct_database_url(cls, v: Union[str, None]) -> Union[str, None]:
        if not v:
            return None
        return cls._clean_db_url(v)

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        default_origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            "http://localhost:3002",
            "http://127.0.0.1:3002",
            "http://localhost:8001",
            "http://127.0.0.1:8001",
        ]
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                try:
                    parsed = json.loads(v)
                    return list(set(default_origins + parsed))
                except Exception:
                    pass
            origins = [x.strip() for x in v.split(",") if x.strip()]
            return list(set(default_origins + origins))
        elif isinstance(v, list):
            return list(set(default_origins + v))
        return default_origins

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
