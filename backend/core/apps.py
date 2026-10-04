from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"

    def ready(self):
        # Registers the deployment safety checks with `manage.py check`.
        from . import checks  # noqa: F401

        # Close Supabase's public data API off from our tables after every
        # migrate, including ones future migrations add.
        from django.db.models.signals import post_migrate

        from .db_security import enable_row_level_security

        post_migrate.connect(
            enable_row_level_security,
            sender=self,
            dispatch_uid="core.enable_row_level_security",
        )
