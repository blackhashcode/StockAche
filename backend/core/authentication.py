"""Supabase-backed authentication for DRF.

The React app owns the Supabase session and sends the access token as
`Authorization: Bearer <token>`. This class turns that token into a local
`Account` row.

Two verification paths:
  1. If SUPABASE_JWT_SECRET is configured, the token is verified locally (no
     network hop).
  2. Otherwise the token is introspected against Supabase `/auth/v1/user`, with
     a short cache so a burst of requests costs one round trip.
"""

import hashlib
import logging

import requests
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from rest_framework import authentication, exceptions

from .models import Account

logger = logging.getLogger(__name__)

INTROSPECT_CACHE_SECONDS = 300
DEV_TOKEN_PREFIX = "dev:"


def _cache_key(token: str) -> str:
    return "supabase_user:" + hashlib.sha256(token.encode()).hexdigest()


def _verify_locally(token: str) -> dict | None:
    """Verify the JWT with the project's shared secret, if we have one."""
    if not settings.SUPABASE_JWT_SECRET:
        return None
    try:
        import jwt
    except ImportError:  # pragma: no cover - PyJWT is in requirements
        logger.warning("SUPABASE_JWT_SECRET set but PyJWT is not installed")
        return None

    try:
        claims = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as exc:
        raise exceptions.AuthenticationFailed(f"Invalid token: {exc}") from exc

    metadata = claims.get("user_metadata") or {}
    return {
        "id": claims.get("sub"),
        "email": claims.get("email", ""),
        "phone": claims.get("phone", ""),
        "user_metadata": metadata,
    }


def _introspect(token: str) -> dict:
    """Ask Supabase who this token belongs to."""
    cached = cache.get(_cache_key(token))
    if cached:
        return cached

    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        raise exceptions.AuthenticationFailed(
            "Supabase is not configured on the server (SUPABASE_URL / SUPABASE_ANON_KEY)."
        )

    try:
        response = requests.get(
            f"{settings.SUPABASE_URL}/auth/v1/user",
            headers={
                "apikey": settings.SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {token}",
            },
            timeout=8,
        )
    except requests.RequestException as exc:
        raise exceptions.AuthenticationFailed(
            f"Could not reach Supabase to verify the session: {exc}"
        ) from exc

    if response.status_code != 200:
        raise exceptions.AuthenticationFailed("Session expired or invalid. Sign in again.")

    payload = response.json()
    cache.set(_cache_key(token), payload, INTROSPECT_CACHE_SECONDS)
    return payload


def sync_account(user_payload: dict) -> Account:
    """Create or refresh the local mirror of a Supabase user."""
    uid = user_payload.get("id")
    if not uid:
        raise exceptions.AuthenticationFailed("Token did not identify a user.")

    metadata = user_payload.get("user_metadata") or {}
    full_name = (
        metadata.get("full_name")
        or metadata.get("name")
        or user_payload.get("email", "").split("@")[0]
    )

    account, _ = Account.objects.get_or_create(
        supabase_uid=uid,
        defaults={
            "email": user_payload.get("email") or "",
            "full_name": full_name,
            "phone": user_payload.get("phone") or "",
            "avatar_url": metadata.get("avatar_url") or metadata.get("picture") or "",
        },
    )

    # Keep the mirror fresh without clobbering values the user edited locally.
    dirty = []
    incoming_email = user_payload.get("email") or ""
    if incoming_email and account.email != incoming_email:
        account.email = incoming_email
        dirty.append("email")
    if not account.full_name and full_name:
        account.full_name = full_name
        dirty.append("full_name")

    account.last_login_at = timezone.now()
    dirty.append("last_login_at")
    account.save(update_fields=dirty + ["updated_at"])
    return account


class SupabaseAuthentication(authentication.BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode("utf-8")
        if not header:
            return None

        parts = header.split()
        if len(parts) != 2 or parts[0].lower() != self.keyword.lower():
            return None
        token = parts[1]

        # Local-development escape hatch used by /api/auth/dev-login/ (ENABLE_DEV_LOGIN).
        if token.startswith(DEV_TOKEN_PREFIX):
            if not settings.ENABLE_DEV_LOGIN:
                raise exceptions.AuthenticationFailed("Dev login is disabled.")
            account = Account.objects.filter(
                supabase_uid=token[len(DEV_TOKEN_PREFIX):]
            ).first()
            if not account:
                raise exceptions.AuthenticationFailed("Unknown dev account.")
            return (account, token)

        payload = _verify_locally(token) or _introspect(token)
        return (sync_account(payload), token)

    def authenticate_header(self, request):
        return self.keyword
