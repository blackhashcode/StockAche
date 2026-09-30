"""Vercel serverless entrypoint for the Django API.

Vercel turns every file under `api/` into a function and, for Python, looks for
a WSGI callable named `app`. Requests reach here through the `/api/(.*)` rewrite
in vercel.json; everything else is served as the static React build.

The Django project lives in `backend/`, so that directory is put on the import
path before the settings module is loaded.
"""

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "stockache.settings")

from stockache.wsgi import application  # noqa: E402

# Vercel's Python runtime invokes this name.
app = application
