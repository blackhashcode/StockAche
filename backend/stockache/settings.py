"""Django settings for the StockAche prototype."""

from decimal import Decimal
from pathlib import Path
from urllib.parse import unquote, urlparse

from dotenv import load_dotenv
import os

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


def env(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()


def env_bool(key: str, default: bool = False) -> bool:
    raw = env(key, str(default)).lower()
    return raw in ("1", "true", "yes", "on")


def env_list(key: str, default: str = "") -> list[str]:
    return [item.strip() for item in env(key, default).split(",") if item.strip()]


SECRET_KEY = env("DJANGO_SECRET_KEY", "insecure-prototype-key")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

# Render injects the service's public hostname. Trusting it directly means the
# deploy works even before DJANGO_ALLOWED_HOSTS is filled in.
RENDER_EXTERNAL_HOSTNAME = env("RENDER_EXTERNAL_HOSTNAME")
if RENDER_EXTERNAL_HOSTNAME and RENDER_EXTERNAL_HOSTNAME not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "django_filters",
    "core",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    # Serves the admin's CSS/JS in production; must sit directly after
    # SecurityMiddleware so it short-circuits before the session machinery.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "stockache.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "stockache.wsgi.application"


# --- Database -----------------------------------------------------------
# Default is SQLite so the prototype runs with zero setup. Setting DATABASE_URL
# to a Supabase Postgres connection string switches the whole app over with no
# code changes.
DATABASE_URL = env("DATABASE_URL")

if DATABASE_URL:
    parsed = urlparse(DATABASE_URL)
    # Supabase's transaction pooler (port 6543) is what serverless platforms
    # must use: each invocation is short-lived, so holding connections open
    # would exhaust the pool. Transaction pooling also cannot support
    # server-side cursors, which Django uses for .iterator().
    pooled = parsed.port == 6543 or env_bool("DATABASE_POOLED", False)
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": parsed.path.lstrip("/") or "postgres",
            # urlparse leaves credentials percent-encoded, so a password
            # containing @, # or % would otherwise be sent to Postgres in its
            # escaped form and fail authentication.
            "USER": unquote(parsed.username or ""),
            "PASSWORD": unquote(parsed.password or ""),
            "HOST": parsed.hostname or "",
            "PORT": str(parsed.port or 5432),
            "OPTIONS": {"sslmode": "require"},
            "CONN_MAX_AGE": 0 if pooled else 60,
            "DISABLE_SERVER_SIDE_CURSORS": pooled,
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }


AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Dhaka"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# Hashed, compressed static files in production (served by WhiteNoise). Left
# at Django's default locally so `runserver` works without collectstatic.
if not DEBUG:
    STORAGES = {
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# --- DRF ----------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "core.authentication.SupabaseAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 24,
    "UNAUTHENTICATED_USER": None,
}

if not DEBUG:
    # JSON only in production: the browsable API is a clickable write
    # interface that should not be public.
    REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = [
        "rest_framework.renderers.JSONRenderer",
    ]

    # The host terminates TLS at its proxy, so trust the forwarded scheme for
    # redirects and secure-cookie decisions.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True


# --- CORS ---------------------------------------------------------------
# The frontend is served from a different origin (Netlify) than the API
# (Render), so the browser needs an explicit allow-list. Trailing slashes are
# stripped because django-cors-headers rejects an origin that has a path, and
# "https://site.netlify.app/" is an easy thing to paste.
CORS_ALLOWED_ORIGINS = [
    origin.rstrip("/")
    for origin in env_list(
        "CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    )
]
CSRF_TRUSTED_ORIGINS = [origin.rstrip("/") for origin in env_list("CSRF_TRUSTED_ORIGINS")]
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
]


# --- Supabase -----------------------------------------------------------
SUPABASE_URL = env("SUPABASE_URL").rstrip("/")
SUPABASE_ANON_KEY = env("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = env("SUPABASE_SERVICE_KEY")
SUPABASE_STORAGE_BUCKET = env("SUPABASE_STORAGE_BUCKET", "stocklot-images")
SUPABASE_JWT_SECRET = env("SUPABASE_JWT_SECRET")


# --- Marketplace economics ----------------------------------------------
# Commission the platform takes on the goods subtotal of every order.
# Stored per order at purchase time, so changing this never rewrites history.
PLATFORM_COMMISSION_RATE = Decimal(env("PLATFORM_COMMISSION_RATE", "0.02"))

ENABLE_DEV_LOGIN = env_bool("ENABLE_DEV_LOGIN", False)
PAYMENT_MODE = env("PAYMENT_MODE", "sandbox")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
