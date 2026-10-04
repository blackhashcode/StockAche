# Deploying StockAche — Netlify + Render

The React frontend runs on **Netlify**. The Django API runs on **Render** as an
ordinary always-on web server. Supabase provides the database, sign-in and file
storage, as it does in local development.

```
   https://<site>.netlify.app                 https://<service>.onrender.com
   ┌──────────────────────────┐   HTTPS +     ┌──────────────────────────────┐
   │  React build (static)    │   Bearer JWT  │  Django + DRF under gunicorn │
   │  netlify.toml            │ ────────────▶ │  render.yaml                 │
   └──────────────────────────┘     CORS      └──────────────┬───────────────┘
                                                             │
                                ┌────────────────────────────┼─────────────────┐
                                │                            │                 │
                       Supabase Postgres              Supabase Auth     Supabase Storage
                       (session pooler, 5432)         (Google, email)   (photos, NID scans)
```

Netlify cannot run Python, so the API has to live elsewhere. Render runs Django
the same way `runserver` does locally, just under gunicorn: migrations run on
every deploy and the admin is served at `/admin/`.

## What is already in the repo

| File | Purpose |
| --- | --- |
| `render.yaml` | Render Blueprint: build, start command, Python 3.12, all non-secret settings |
| `netlify.toml` | Netlify build from `frontend/`, Node 20, SPA fallback, asset caching |
| `backend/requirements.txt` | Adds `gunicorn` (server) and `whitenoise` (admin CSS/JS) |
| `settings.py` | Trusts Render's hostname, serves static files via WhiteNoise, reads the CORS allow-list from the environment |

You fill in four secrets in Render and three variables in Netlify. Nothing
else changes.

---

## Order matters

Each service needs the other's URL, so deploy in this order:

1. **Render** first, to get the API URL.
2. **Netlify** next, pointing at that API URL.
3. **Back to Render**: put the Netlify URL into `CORS_ALLOWED_ORIGINS`.
4. **Supabase**: allow the Netlify URL for sign-in redirects.

---

## Step 1 — Render (API)

1. Sign in at [render.com](https://render.com) with GitHub.
2. **New → Blueprint**, pick `blackhashcode/StockAche`. Render reads `render.yaml`.
3. Render asks for the four values marked `sync: false`:

| Key | Value |
| --- | --- |
| `DATABASE_URL` | Supabase **Session pooler** string, port **5432**, with your real password in place of `[YOUR-PASSWORD]` |
| `SUPABASE_ANON_KEY` | your publishable key (`sb_publishable_…`) |
| `SUPABASE_SERVICE_KEY` | your secret key (`sb_secret_…`) — ideally a freshly rotated one |
| `CORS_ALLOWED_ORIGINS` | put `http://localhost:5173` for now; you replace it in step 3 |

4. **Apply**. The first build installs dependencies, collects static files and
   runs migrations (a no-op: the Supabase schema already exists). Takes 3–5 minutes.
5. Copy the service URL from the top of the page, e.g.
   `https://stockache-api.onrender.com`.

Check it:

```
https://stockache-api.onrender.com/api/meta/
```

Expect JSON with `"dev_login_enabled": false`.

> **Use the Session pooler, not Direct connection.** Supabase gives the direct
> host an IPv6 address only, and Render cannot reach it — you'd see
> `could not translate host name`. The pooler is IPv4. Tell them apart by the
> username: the pooler one is `postgres.<project-ref>` and the host ends in
> `pooler.supabase.com`.
>
> **Special characters in the password** (`@`, `#`, `%`, `/`) must be
> percent-encoded inside the URL — `@` becomes `%40`, for example. The app
> decodes it. `scripts/migrate_production.ps1` does the encoding for you if
> you'd rather build the string interactively.

## Step 2 — Netlify (frontend)

1. Sign in at [netlify.com](https://netlify.com) with GitHub.
2. **Add new site → Import an existing project**, pick `blackhashcode/StockAche`.
   Netlify reads `netlify.toml`; leave the build settings it shows alone.
3. Before deploying, open **Environment variables** and add:

| Key | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://uiblezlkmydzndoamvsk.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | your publishable key |
| `VITE_API_BASE_URL` | your Render URL **plus `/api`**, e.g. `https://stockache-api.onrender.com/api` |

4. **Deploy**. Takes about a minute. Note the site URL, e.g.
   `https://stockache.netlify.app` (you can rename it under Site configuration).

`VITE_*` values are compiled into the JavaScript at build time. Changing one
needs **Deploys → Trigger deploy**, not just a save.

## Step 3 — Allow the frontend to call the API

Render → your service → **Environment** → set:

```
CORS_ALLOWED_ORIGINS = https://stockache.netlify.app
```

Use your actual Netlify URL, with no path. Save; Render redeploys
automatically. Until this is set, the browser blocks every API call from the
site, and the marketplace shows a server-unreachable error.

## Step 4 — Allow sign-in redirects

Supabase → **Authentication → URL Configuration**:

- **Site URL** → `https://stockache.netlify.app`
- **Redirect URLs** → add `https://stockache.netlify.app/auth/callback`
  (keep `http://localhost:5173/auth/callback` for local development)

Without this, Google sign-in and email confirmation links fail or land on the
wrong site.

## Step 5 — Verify

1. Marketplace loads and shows the listings.
2. Register with email; the confirmation link brings you back signed in.
3. Sign in with Google.
4. Upload an NID photo during onboarding — proves Storage works from production.
5. Place an order with the bKash sandbox; advance it as the supplier.
6. Sign in to `https://stockache-api.onrender.com/admin/` with your superuser.

---

## Things to know

- **Free tier sleeps.** After 15 minutes without traffic Render stops the
  service; the next request takes roughly 50 seconds. Open the site a minute
  before a demo. The $7/month Starter plan stays awake.
- **Migrations run on every deploy** (`migrate --noinput` in the build), so
  new models go live with the push that adds them.
- **Pushing to `main` redeploys both** Netlify and Render automatically.
- **Disconnect the old Vercel project** (Vercel → Project → Settings →
  Delete), or it keeps attempting a build on every push.

## Rotating exposed keys

The Supabase secret key and legacy `service_role` JWT pasted into chat during
development were still accepted by Supabase as of 2026-10-04. A leaked
service-role credential bypasses Row Level Security entirely.

**Supabase → Project Settings → API Keys**: revoke the secret key and create a
new one, and disable the legacy JWT keys (revoking the new secret alone does
not invalidate them). Then update `SUPABASE_SERVICE_KEY` in Render and in
`backend/.env`.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Render build fails at `pip install` | Check the Python version line in the log; `render.yaml` pins 3.12.7 |
| `could not translate host name` | `DATABASE_URL` is the Direct connection string; use the Session pooler |
| `password authentication failed for user "postgres"` | Wrong database password (not your Supabase login). Reset it under Settings → Database. The message names `postgres` even when your username is right. |
| Site loads, but every API call fails | `CORS_ALLOWED_ORIGINS` on Render doesn't match the Netlify URL exactly, or `VITE_API_BASE_URL` is missing `/api` |
| Refreshing `/marketplace` gives 404 | `netlify.toml` not picked up — check the base directory is unset in the Netlify UI |
| Sign-in returns to a blank page or localhost | Step 4 not done |
| `/admin/` has no styling | `collectstatic` didn't run — check the Render build log |
| First request very slow | Free-tier cold start; expected |
