from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"

    def ready(self):
        # Registers the deployment safety checks with `manage.py check`.
        from . import checks  # noqa: F401
