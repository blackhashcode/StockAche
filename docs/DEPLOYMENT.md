# Deployment

StockAche runs as three hosted pieces:

| Piece | Host | Config in repo |
| --- | --- | --- |
| React frontend | **Netlify** | `netlify.toml` |
| Django API + admin | **Render** | `render.yaml` |
| Database, sign-in, file storage | **Supabase** | — (dashboard settings) |

```
   https://<site>.netlify.app                 https://<service>.onrender.com
   ┌──────────────────────────┐   HTTPS +     ┌──────────────────────────────┐
   │  React build (static)    │   Bearer JWT  │  Django + DRF under gunicorn │
   │                          │ ────────────▶ │  /api/*   /admin/            │
   └──────────────────────────┘     CORS      └──────────────┬───────────────┘
                                                             │
                                ┌────────────────────────────┼─────────────────┐
                                │                            │                 │
                       Supabase Postgres              Supabase Auth     Supabase Storage
                       (session pooler, 5432)         (Google, email)   (photos, NID scans)
```

Netlify cannot run Python, so the API lives on Render as an ordinary long-running
server. Migrations run on every Render deploy, and the Django admin is served at
`/admin/` on the Render URL.

Pushing to `main` redeploys both Netlify and Render automatically.

---

## Order of setup

Each service needs the other's URL, so set them up in this order:

1. **Render** — get the API URL.
2. **Netlify** — point it at that API URL.
3. **Render again** — allow the Netlify URL in `CORS_ALLOWED_ORIGINS`.
4. **Supabase** — allow the Netlify URL as a sign-in redirect.

## 1. Render (API)

1. Sign in at [render.com](https://render.com) with GitHub.
2. **New → Blueprint**, select this repository. Render reads `render.yaml`.
3. Fill in the four values `render.yaml` marks `sync: false`:

| Key | Value |
| --- | --- |
| `DATABASE_URL` | Supabase **Session pooler** connection string (port **5432**) with the real database password |
| `SUPABASE_ANON_KEY` | Supabase publishable key (`sb_publishable_…`) |
| `SUPABASE_SERVICE_KEY` | Supabase secret key (`sb_secret_…`) — server only |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` for now; replaced in step 3 |

4. **Apply.** The build installs dependencies, collects static files and runs
   migrations — about 3–5 minutes.
5. Check `https://<service>.onrender.com/api/meta/` returns JSON with
   `"dev_login_enabled": false`.

`render.yaml` also sets `SUPABASE_URL`; change it if you are deploying against
a different Supabase project.

> **Use the Session pooler, not Direct connection.** Supabase gives the direct
> host an IPv6 address only, which Render cannot reach (`could not translate
> host name`). The pooler username looks like `postgres.<project-ref>` and its
> host ends in `pooler.supabase.com`.
>
> **Special characters in the password** (`@`, `#`, `%`, `/`) must be
> percent-encoded inside the URL — `@` becomes `%40`. The app decodes them.

## 2. Netlify (frontend)

1. Sign in at [netlify.com](https://netlify.com) with GitHub.
2. **Add new site → Import an existing project**, select this repository. Leave
   the build settings blank — `netlify.toml` supplies them. In particular, do
   not set a base directory in the UI, or Netlify stops reading `netlify.toml`.
3. Add environment variables **before** the first deploy:

| Key | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable key |
| `VITE_API_BASE_URL` | `https://<service>.onrender.com/api` — note the `/api` |

4. Deploy, and note the site URL.

`VITE_*` values are compiled into the JavaScript at build time; changing one
needs **Deploys → Trigger deploy**.

## 3. Allow the frontend to call the API

Render → service → **Environment** → `CORS_ALLOWED_ORIGINS` =
`https://<site>.netlify.app` (no path). Several origins can be comma-separated.
Until this is set, the browser blocks every API call and the site shows a
server-unreachable error.

## 4. Allow sign-in redirects

Supabase → **Authentication → URL Configuration**:

- **Site URL** → `https://<site>.netlify.app`
- **Redirect URLs** → add `https://<site>.netlify.app/auth/callback`, and keep
  `http://localhost:5173/auth/callback` for local development.

Otherwise Supabase falls back to the Site URL after Google sign-in or an email
confirmation link (by default `http://localhost:3000`).

## Verify

1. Marketplace loads listings.
2. Google sign-in returns to the site, signed in.
3. Onboarding accepts an NID photo upload (proves Storage works).
4. An order goes through the bKash sandbox; the supplier can advance it.
5. `https://<service>.onrender.com/admin/` accepts a superuser login.

---

## Operating notes

- **Free-tier sleep.** Render's free plan stops the service after 15 minutes
  without traffic; the next request takes roughly 50 seconds. The Starter plan
  stays awake.
- **Admin accounts** live in Django's own `auth_user` table, separate from
  Supabase sign-in. Create one against production with
  `scripts/migrate_production.ps1 -CreateSuperuser`, which prompts for the
  database password instead of taking it as an argument.
- **Email confirmation.** Supabase's built-in mailer is rate-limited and
  restricted on the free tier, so confirmation emails may not reach arbitrary
  addresses. Either turn off *Confirm email* (Authentication → Providers →
  Email) or configure custom SMTP.
- **Local and production data are separate.** `runserver` uses
  `backend/db.sqlite3`; the live site uses Supabase Postgres.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Render build fails at `pip install` | Check the Python version in the log; `render.yaml` pins 3.12.7 |
| `could not translate host name` | `DATABASE_URL` is the Direct connection string; use the Session pooler |
| `password authentication failed for user "postgres"` | Wrong database password (not the Supabase account login). Reset it under Settings → Database. The message names `postgres` even when the username is right. |
| Site loads but API calls fail | `CORS_ALLOWED_ORIGINS` doesn't match the Netlify URL exactly, or `VITE_API_BASE_URL` lacks `/api` |
| Refreshing a page gives 404 | `netlify.toml` not read — remove any base directory set in the Netlify UI |
| Sign-in lands on `localhost:3000` | Step 4 not done |
| `/admin/` has no styling | `collectstatic` didn't run — check the Render build log |
| First request very slow | Free-tier cold start |
