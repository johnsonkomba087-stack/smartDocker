import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Auth
    SECRET_KEY: str = os.getenv("SECRET_KEY", "smart-resume-ranker-secret-change-in-production-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # LLM (optional)
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "none")  # none | groq | ollama
    LLM_MODEL: str = os.getenv("LLM_MODEL", "llama-3.1-8b-instant")

    # Semantic embeddings (optional)
    USE_EMBEDDINGS: bool = os.getenv("USE_EMBEDDINGS", "false").lower() == "true"

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./resume_ranker.db")

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()