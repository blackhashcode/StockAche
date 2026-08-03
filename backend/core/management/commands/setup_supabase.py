"""Create the public Storage bucket StockAche uploads listing photos into.

    python manage.py setup_supabase

Safe to re-run: an existing bucket is left alone.
"""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from core.storage import StorageError, ensure_bucket


class Command(BaseCommand):
    help = "Create the Supabase Storage bucket used for stocklot images."

    def handle(self, *args, **options):
        if not settings.SUPABASE_URL:
            raise CommandError("SUPABASE_URL is not set in backend/.env")
        if not settings.SUPABASE_SERVICE_KEY:
            raise CommandError("SUPABASE_SERVICE_KEY is not set in backend/.env")

        try:
            ensure_bucket()
        except StorageError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(
            self.style.SUCCESS(
                f"Bucket '{settings.SUPABASE_STORAGE_BUCKET}' is ready at "
                f"{settings.SUPABASE_URL}/storage/v1/object/public/"
                f"{settings.SUPABASE_STORAGE_BUCKET}/"
            )
        )
