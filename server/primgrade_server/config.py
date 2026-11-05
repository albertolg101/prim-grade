"""Settings from the environment (D6: URLs and keys come from config, not code)."""

import os
from dataclasses import dataclass
from pathlib import Path

MODEL = "gpt-6.1-sol"  # PL-34, GL-03: every AI call; checked on the OpenAI pricing page 2026-11-05


@dataclass(frozen=True)
class Settings:
    database_url: str
    secret_key: str
    storage_dir: Path
    public_base_url: str
    llm: str  # "openai" or "fake" (PRIMGRADE_LLM=fake: deterministic, no key, no tokens)
    concurrency: int
    secure_cookies: bool
    web_dist: Path | None


def load() -> Settings:
    secret = os.environ.get("PRIMGRADE_SECRET_KEY", "")
    if len(secret) < 32:
        raise RuntimeError("PRIMGRADE_SECRET_KEY must be set to at least 32 characters")
    llm = os.environ.get("PRIMGRADE_LLM", "openai")
    if llm not in ("openai", "fake"):
        raise RuntimeError(f"PRIMGRADE_LLM must be 'openai' or 'fake', not {llm!r}")
    dist = os.environ.get("PRIMGRADE_WEB_DIST")
    return Settings(
        database_url=os.environ.get(
            "DATABASE_URL", "postgresql+psycopg://primgrade:primgrade@localhost:5433/primgrade"
        ),
        secret_key=secret,
        storage_dir=Path(os.environ.get("PRIMGRADE_STORAGE", "storage")),
        public_base_url=os.environ.get("PUBLIC_BASE_URL", "http://localhost:5173").rstrip("/"),
        llm=llm,
        concurrency=int(os.environ.get("PRIMGRADE_CONCURRENCY", "4")),
        secure_cookies=os.environ.get("PRIMGRADE_SECURE_COOKIES", "0") == "1",
        web_dist=Path(dist) if dist else None,
    )
