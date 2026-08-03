"""Deployment safety checks, run automatically by `manage.py check`.

These exist because the failure modes they cover are silent: a secret key that
reaches the browser bundle still *works*, and a dev-login endpoint left enabled
in production still *works*. Nothing breaks until someone notices.
"""

import base64
import json
import re
from pathlib import Path

from django.conf import settings
from django.core.checks import Error, Warning, register

FRONTEND_ENV = Path(settings.BASE_DIR).parent / "frontend" / ".env"

SECRET_PATTERNS = (
    re.compile(r"sb_secret_[A-Za-z0-9_\-]{8,}"),
    re.compile(r"service_role"),
)
JWT_RE = re.compile(r"eyJ[A-Za-z0-9_\-]{8,}\.([A-Za-z0-9_\-]{8,})\.[A-Za-z0-9_\-]{8,}")


def _jwt_role(segment: str):
    try:
        segment += "=" * (-len(segment) % 4)
        return json.loads(base64.urlsafe_b64decode(segment)).get("role")
    except Exception:
        return None


@register()
def check_frontend_env_has_no_secrets(app_configs, **kwargs):
    """The browser bundle must never carry a service-role credential.

    Anything in frontend/.env prefixed VITE_ is inlined into the JavaScript at
    build time and is readable by every visitor.
    """
    if not FRONTEND_ENV.is_file():
        return []

    try:
        content = FRONTEND_ENV.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return []

    problems = []
    for lineno, line in enumerate(content.splitlines(), 1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        hit = any(p.search(stripped) for p in SECRET_PATTERNS)
        for match in JWT_RE.finditer(stripped):
            if _jwt_role(match.group(1)) == "service_role":
                hit = True

        if hit:
            key = stripped.split("=", 1)[0]
            problems.append(
                Error(
                    f"frontend/.env line {lineno} ({key}) looks like a service-role "
                    f"credential.",
                    hint=(
                        "Anything in frontend/.env ships to the browser. Move this to "
                        "backend/.env as SUPABASE_SERVICE_KEY, and rotate the exposed "
                        "key in the Supabase dashboard."
                    ),
                    id="stockache.E001",
                )
            )
    return problems


@register()
def check_dev_login_disabled_in_production(app_configs, **kwargs):
    """ENABLE_DEV_LOGIN issues a session for any seeded email, with no password."""
    if settings.ENABLE_DEV_LOGIN and not settings.DEBUG:
        return [
            Error(
                "ENABLE_DEV_LOGIN is True while DEBUG is False.",
                hint=(
                    "This endpoint hands out a session for any known email address "
                    "without a credential check. Set ENABLE_DEV_LOGIN=False."
                ),
                id="stockache.E002",
            )
        ]
    return []


@register()
def check_secret_key_changed(app_configs, **kwargs):
    weak = settings.SECRET_KEY.startswith(("insecure-", "dev-only-", "change-me"))
    if weak and not settings.DEBUG:
        return [
            Error(
                "DJANGO_SECRET_KEY is still a development placeholder.",
                hint="Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(64))\"",
                id="stockache.E003",
            )
        ]
    return []


@register()
def check_supabase_configured(app_configs, **kwargs):
    problems = []
    if not settings.SUPABASE_URL:
        problems.append(
            Warning(
                "SUPABASE_URL is not set — authentication and image uploads will fail.",
                hint="Copy backend/.env.example to backend/.env and fill it in.",
                id="stockache.W001",
            )
        )
    if not settings.SUPABASE_SERVICE_KEY:
        problems.append(
            Warning(
                "SUPABASE_SERVICE_KEY is not set — image uploads will fail.",
                hint="Supabase Dashboard -> Project Settings -> API -> secret key.",
                id="stockache.W002",
            )
        )
    return problems
