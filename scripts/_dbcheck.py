"""Quick connectivity and credential check against DATABASE_URL.

Used by migrate_production.ps1 to fail with one readable line instead of a
Django traceback. Exit codes: 0 ok, 2 bad password, 3 other connection error.
"""

import os
import sys
from urllib.parse import unquote, urlparse

import psycopg2

url = os.environ.get("DATABASE_URL", "")
if not url:
    print("FAIL DATABASE_URL is not set")
    sys.exit(3)

parsed = urlparse(url)

try:
    conn = psycopg2.connect(
        dbname=parsed.path.lstrip("/") or "postgres",
        user=unquote(parsed.username or ""),
        password=unquote(parsed.password or ""),
        host=parsed.hostname,
        port=parsed.port or 5432,
        sslmode="require",
        connect_timeout=15,
    )
except psycopg2.OperationalError as exc:
    message = str(exc).strip().splitlines()[0]
    print(f"FAIL {message}")
    sys.exit(2 if "password authentication failed" in message else 3)

with conn, conn.cursor() as cur:
    cur.execute("SELECT current_user, current_database(), version()")
    user, database, version = cur.fetchone()
    cur.execute(
        "SELECT count(*) FROM information_schema.tables "
        "WHERE table_schema = 'public'"
    )
    (tables,) = cur.fetchone()

conn.close()

print(f"OK   connected as {user} to {database}")
print(f"     {version.split(' on ')[0]}")
print(f"     {tables} table(s) currently in the public schema")
