"""Lock the Django tables away from Supabase's public data API.

Supabase publishes every table in the `public` schema through PostgREST, and
its `anon` role -- usable with the publishable key that ships in the frontend
bundle -- is granted read and write on them by default. Tables created by
Django migrations carry no row-level security, so without this they are
readable and writable by anyone: account roles, NID numbers, orders, even the
admin password hashes in auth_user.

Enabling RLS with no policies denies `anon` and `authenticated` everything.
Django connects as the role that owns these tables, and owners are exempt from
RLS unless it is forced, so the application itself is unaffected. The service
key bypasses RLS by design.

Runs after every `migrate`, so tables added by future migrations are covered
too. A no-op on SQLite.
"""

from django.db import connections

FIND_UNPROTECTED_TABLES = """
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')          -- ordinary and partitioned tables
      AND NOT c.relrowsecurity
      AND pg_get_userbyid(c.relowner) = current_user
"""


def enable_row_level_security(sender=None, using="default", verbosity=1, **kwargs):
    connection = connections[using]
    if connection.vendor != "postgresql":
        return

    with connection.cursor() as cursor:
        cursor.execute(FIND_UNPROTECTED_TABLES)
        tables = [row[0] for row in cursor.fetchall()]
        for table in tables:
            cursor.execute(
                f"ALTER TABLE public.{connection.ops.quote_name(table)} "
                "ENABLE ROW LEVEL SECURITY"
            )

    if verbosity >= 1 and tables:
        print(f"  Row-level security enabled on {len(tables)} table(s): {', '.join(sorted(tables))}")
