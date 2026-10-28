from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    admin_key: str = field(repr=False)
    provider_key: str = field(default="", repr=False)
    provider_url: str = "https://api.openai.com/v1"
    image_model: str = "gpt-image-1.5"
    chat_model: str = "gpt-4.1-mini"
    data_dir: Path = Path("data")
    history_enabled: bool = True
    retention_days: int = 7
    workers: int = 2
    max_pending: int = 32
    cors_origins: tuple[str, ...] = ()
    web_dir: Path = Path(__file__).resolve().parents[1] / "web/out"

    def __post_init__(self):
        if len(self.admin_key) < 32:
            raise ValueError("ATP_ADMIN_KEY must contain at least 32 characters; generate a random key.")
        url = urlsplit(self.provider_url)
        if url.scheme != "https" or not url.hostname or url.username or url.password or url.query or url.fragment:
            raise ValueError("OPENAI_BASE_URL must be a trusted HTTPS URL without credentials or query parameters.")
        if not 1 <= self.workers <= 8 or not 1 <= self.max_pending <= 128:
            raise ValueError("Workers must be 1..8 and max pending must be 1..128.")
        if not 1 <= self.retention_days <= 365:
            raise ValueError("Retention must be 1..365 days.")
        if "*" in self.cors_origins:
            raise ValueError("Wildcard CORS is not supported.")

    @classmethod
    def from_env(cls):
        load_dotenv(Path(__file__).resolve().parents[1] / ".env")
        return cls(
            admin_key=os.getenv("ATP_ADMIN_KEY", ""),
            provider_key=os.getenv("OPENAI_API_KEY", ""),
            provider_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/"),
            image_model=os.getenv("ATP_IMAGE_MODEL", "gpt-image-1.5"),
            chat_model=os.getenv("ATP_CHAT_MODEL", "gpt-4.1-mini"),
            data_dir=Path(os.getenv("ATP_DATA_DIR", "./data")).resolve(),
            history_enabled=os.getenv("ATP_HISTORY_ENABLED", "true").lower() == "true",
            retention_days=int(os.getenv("ATP_RETENTION_DAYS", "7")),
            workers=int(os.getenv("ATP_WORKERS", "2")),
            max_pending=int(os.getenv("ATP_MAX_PENDING", "32")),
            cors_origins=tuple(x.strip() for x in os.getenv("ATP_CORS_ORIGINS", "").split(",") if x.strip()),
        )
