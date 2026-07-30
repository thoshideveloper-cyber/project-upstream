"""Application settings, loaded from environment / .env via pydantic-settings."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Database — async driver URL (sqlite+aiosqlite dev / postgresql+asyncpg prod)
    database_url: str = "sqlite+aiosqlite:///./upstream.db"

    # Auth (JWT in httpOnly cookies — see plan.md §6.0)
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_days: int = 7

    # Cookie settings. For same-site dev use samesite=lax + secure=false;
    # for the split-origin Vercel↔Railway prod use samesite=none + secure=true.
    cookie_domain: str | None = None
    cookie_secure: bool = False
    cookie_samesite: str = "lax"  # "lax" | "strict" | "none"
    access_cookie_name: str = "up_access"
    refresh_cookie_name: str = "up_refresh"

    # CORS — comma-separated origins (explicit; never "*" with credentials)
    cors_origins: str = "http://localhost:3000"

    # ── AI ranking / Groq (SOURCING_LAYER_PLAN §5.2) ─────────────────────────
    # Off by default, per-firm opt-in (confidentiality gate §5.7). Secrets in .env only;
    # settings previously used extra="ignore", so GROQ_* were silently dropped — declared
    # here so they are actually read.
    sourcing_ai_enabled: bool = False
    groq_api_key: str | None = None
    groq_api_key_2: str | None = None
    groq_api_key_3: str | None = None
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_model: str = "openai/gpt-oss-120b"
    # Comma-separated fallback chain (strict → faster-strict → best-effort + repair).
    groq_fallback_models: str = "openai/gpt-oss-20b,llama-3.3-70b-versatile"
    groq_timeout_s: float = 30.0
    groq_max_candidates_per_call: int = 15
    groq_daily_token_budget: int = 200_000

    # ── Email sending (analyst mailbox connection — Gmail API / Microsoft Graph) ──
    # Emails go out through the analyst's OWN mailbox via OAuth, never a relay:
    # provider-signed SPF/DKIM, lands in their Sent folder, replies thread back.
    # Sandbox provider simulates sends (full pipeline, no network) for demo installs.
    frontend_url: str = "http://localhost:3000"
    backend_public_url: str = "http://localhost:8000"  # OAuth redirect_uri base
    google_client_id: str | None = None
    google_client_secret: str | None = None
    ms_client_id: str | None = None
    ms_client_secret: str | None = None
    ms_tenant: str = "common"
    email_sandbox_enabled: bool = True
    email_daily_limit_default: int = 50  # per-analyst pacing cap (deliverability)

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def groq_api_keys(self) -> list[str]:
        """Non-empty Groq keys for round-robin rotation (3× the per-key rate headroom)."""
        return [k for k in (self.groq_api_key, self.groq_api_key_2, self.groq_api_key_3) if k]

    @property
    def groq_fallback_list(self) -> list[str]:
        return [m.strip() for m in self.groq_fallback_models.split(",") if m.strip()]

    @property
    def sync_database_url(self) -> str:
        """Sync driver URL for Alembic migrations (the app engine stays async)."""
        return self.database_url.replace("+aiosqlite", "").replace("+asyncpg", "+psycopg2")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
