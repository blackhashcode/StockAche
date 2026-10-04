"""Supabase Storage helper.

Uploads go out with the service key, so the bucket does not need permissive
Row Level Security policies on the storage bucket.
"""

import logging
import mimetypes
import uuid
from pathlib import Path

import requests
from django.conf import settings
from rest_framework.exceptions import APIException

logger = logging.getLogger(__name__)


class StorageError(APIException):
    status_code = 502
    default_detail = "Image upload failed."


def _require_config() -> None:
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise StorageError(
            "Supabase Storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY)."
        )


def ensure_bucket() -> None:
    """Create the public bucket if it does not exist yet. Idempotent."""
    _require_config()
    bucket = settings.SUPABASE_STORAGE_BUCKET
    headers = {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    response = requests.post(
        f"{settings.SUPABASE_URL}/storage/v1/bucket",
        json={
            "id": bucket,
            "name": bucket,
            "public": True,
            "file_size_limit": 5 * 1024 * 1024,
            "allowed_mime_types": ["image/png", "image/jpeg", "image/webp", "image/gif"],
        },
        headers=headers,
        timeout=15,
    )
    if response.status_code in (200, 201):
        logger.info("Created Supabase bucket '%s'", bucket)
    elif response.status_code == 409:
        logger.info("Supabase bucket '%s' already exists", bucket)
    else:
        raise StorageError(f"Could not create bucket: {response.status_code} {response.text}")


def upload_to_supabase(file_obj, folder: str = "listings") -> str:
    """Upload a Django UploadedFile and return its public URL."""
    _require_config()

    suffix = Path(getattr(file_obj, "name", "") or "").suffix.lower() or ".jpg"
    key = f"{folder}/{uuid.uuid4().hex}{suffix}"
    content_type = (
        getattr(file_obj, "content_type", None)
        or mimetypes.guess_type(key)[0]
        or "application/octet-stream"
    )
    bucket = settings.SUPABASE_STORAGE_BUCKET

    file_obj.seek(0)
    try:
        response = requests.post(
            f"{settings.SUPABASE_URL}/storage/v1/object/{bucket}/{key}",
            data=file_obj.read(),
            headers={
                "apikey": settings.SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "Content-Type": content_type,
                "x-upsert": "true",
            },
            timeout=30,
        )
    except requests.RequestException as exc:
        raise StorageError(f"Could not reach Supabase Storage: {exc}") from exc

    if response.status_code == 404:
        # Bucket is missing -- create it and retry once.
        ensure_bucket()
        file_obj.seek(0)
        response = requests.post(
            f"{settings.SUPABASE_URL}/storage/v1/object/{bucket}/{key}",
            data=file_obj.read(),
            headers={
                "apikey": settings.SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "Content-Type": content_type,
                "x-upsert": "true",
            },
            timeout=30,
        )

    if response.status_code not in (200, 201):
        raise StorageError(f"Upload rejected: {response.status_code} {response.text}")

    return f"{settings.SUPABASE_URL}/storage/v1/object/public/{bucket}/{key}"
