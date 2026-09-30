# Deploying StockAche to Vercel

Frontend and backend run as **one Vercel project on one domain**. The React build
is served statically; `/api/*` is rewritten to a Python serverless function
running Django. Because both share an origin, there is no CORS to configure.

```
                  https://<your-app>.vercel.app
                              │
              ┌───────────────┴────────────────┐
              │                                │
      static React build              /api/*  →  api/index.py
      (frontend/dist)                          (Django + DRF)
                                                    │
                                    ┌───────────────┼───────────────┐
                                    │               │               │
                            Supabase Postgres  Supabase Auth  Supabase Storage
                            (transaction pooler)  (Google +      (listing photos,
                                                  email/password)  NID documents)
```

## Already prepared in the repo

| File | Purpose |
| --- | --- |
| `vercel.json` | Build command, output directory, `/api/*` rewrite, SPA fallback |
| `api/index.py` | WSGI entrypoint Vercel invokes; puts `backend/` on the import path |
| `requirements.txt` (root) | Points Vercel's Python build at `backend/requirements.txt` |
| `.vercelignore` | Keeps the virtualenv, SQLite file and report assets out of the upload |
| `settings.py` | Detects the pooler and sets `CONN_MAX_AGE=0` + disables server-side cursors; JSON-only renderers and proxy SSL header when `DEBUG=False` |

Nothing below requires code changes.

---

## Step 1 — Rotate the Supabase keys (do this first)

The `service_role` key and secret key were exposed earlier in development and are
still live. Once deployed they sit in a public-facing service, so rotate before
going further.

**Supabase → Project Settings → API Keys**

1. Revoke the current secret key, create a new one — this becomes `SUPABASE_SERVICE_KEY`.
2. Under **Legacy keys**, disable the legacy JWT keys. Revoking the new-format
   secret alone does not invalidate them; they run to 2036 otherwise.

See the *Rotating exposed keys* section of `README.md` for the verification curl.

## Step 2 — Get two connection strings

**Supabase → Project Settings → Database → Connection string**

| Use | Mode | Port |
| --- | --- | --- |
| Running migrations from your laptop | **Session pooler** | `5432` |
| Vercel runtime (`DATABASE_URL` env var) | **Transaction pooler** | `6543` |

> **Do not use "Direct connection".** Supabase publishes only an IPv6 address
> for it unless the paid IPv4 add-on is enabled, so on most networks it fails
> with `could not translate host name ... No such host is known`. Both pooler
> modes are reachable over IPv4. Tell them apart by shape:
>
> | | Username | Host |
> | --- | --- | --- |
> | Direct (avoid) | `postgres` | `db.<ref>.supabase.co` |
> | Pooler (use) | `postgres.<ref>` | `aws-0-<region>.pooler.supabase.com` |

Both look like:

```
postgresql://postgres.uiblezlkmydzndoamvsk:YOUR_DB_PASSWORD@aws-0-<region>.pooler.supabase.com:<port>/postgres
```

Serverless needs the transaction pooler because each request is a fresh, short
invocation — session-mode connections would pile up and exhaust the pool.
Migrations want session mode because DDL is happier there.

## Step 3 — Create the schema in Postgres

Run this on your machine with the **5432** string. The password never needs to
leave your terminal.

```powershell
$env:DATABASE_URL='postgresql://postgres.uiblezlkmydzndoamvsk:YOUR_DB_PASSWORD@aws-0-<region>.pooler.supabase.com:5432/postgres'
D:\StockAche\backend\.venv\Scripts\python.exe D:\StockAche\backend\manage.py migrate
```

Create the admin account you will use to approve supplier verification:

```powershell
D:\StockAche\backend\.venv\Scripts\python.exe D:\StockAche\backend\manage.py createsuperuser
```

Optionally seed sample listings so the marketplace is not empty for judges:

```powershell
D:\StockAche\backend\.venv\Scripts\python.exe D:\StockAche\backend\manage.py seed_demo
```

Then clear the variable so local development returns to SQLite:

```powershell
Remove-Item Env:\DATABASE_URL
```

## Step 4 — Environment variables in Vercel

**Project → Settings → Environment Variables.** Add every row to *Production*
(and *Preview*, if you want preview deployments to work).

| Name | Value | Notes |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | *generate one* | See command below. Never reuse the dev value. |
| `DJANGO_DEBUG` | `False` | Non-negotiable in production. |
| `DJANGO_ALLOWED_HOSTS` | `.vercel.app` | Leading dot matches every subdomain, including preview URLs. Add your custom domain here too. |
| `DATABASE_URL` | transaction pooler string, port **6543** | From step 2. |
| `SUPABASE_URL` | `https://uiblezlkmydzndoamvsk.supabase.co` | |
| `SUPABASE_ANON_KEY` | your publishable key | Safe in the browser by design. |
| `SUPABASE_SERVICE_KEY` | the **new** secret key | Server-side only. |
| `SUPABASE_STORAGE_BUCKET` | `stocklot-images` | |
| `PLATFORM_COMMISSION_RATE` | `0.02` | |
| `PAYMENT_MODE` | `sandbox` | Until real bKash credentials exist. |
| `ENABLE_DEV_LOGIN` | `False` | A deploy check fails the build if this is on with `DEBUG=False`. |
| `VITE_SUPABASE_URL` | same as `SUPABASE_URL` | Needed at **build** time. |
| `VITE_SUPABASE_ANON_KEY` | same as `SUPABASE_ANON_KEY` | Needed at **build** time. |
| `VITE_API_BASE_URL` | `/api` | Same-origin, so no CORS. |

Generate the secret key:

```powershell
D:\StockAche\backend\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(64))"
```

> `VITE_*` variables are compiled into the JavaScript bundle at build time, so
> changing one requires a redeploy, not just a restart. Never put a secret
> behind the `VITE_` prefix — it ships to every visitor.

## Step 5 — Deploy

Connect the GitHub repo at [vercel.com/new](https://vercel.com/new), pick
`blackhashcode/StockAche`, and leave **Root Directory** as the repository root —
`vercel.json` handles the rest. Do not set a framework preset; the explicit
build command takes precedence.

Or from the CLI:

```bash
npx vercel --prod
```

## Step 6 — Point Supabase Auth at the deployed domain

Sign-in will fail until this is done: Supabase refuses to redirect to an
unlisted URL and falls back to the Site URL instead.

**Supabase → Authentication → URL Configuration**

- **Site URL** → `https://<your-app>.vercel.app`
- **Redirect URLs** → add `https://<your-app>.vercel.app/auth/callback`
  (keep `http://localhost:5173/auth/callback` so local development still works)

Google needs no change — its authorised redirect stays
`https://uiblezlkmydzndoamvsk.supabase.co/auth/v1/callback`.

## Step 7 — Verify the deployment

```bash
curl -s https://<your-app>.vercel.app/api/meta/
```

Expect JSON with `"commission_rate":"0.02"` and **`"dev_login_enabled":false`**.
If that key is `true`, `ENABLE_DEV_LOGIN` was not set correctly.

Then in the browser:

1. Marketplace loads and shows listings.
2. Register with email → confirmation mail arrives → the link returns you to the
   app signed in.
3. Sign in with Google.
4. Complete onboarding including the NID upload — this proves Supabase Storage
   works from production.
5. Place an order through the bKash sandbox flow.
6. Sign in as a supplier and advance the order status.

---

## Administering the live site

The Django admin is deliberately **not** exposed on Vercel. Serverless has no
good way to serve its static files, and a public admin login on a prototype is
an unnecessary attack surface. Run it locally against the production database
instead:

```powershell
$env:DATABASE_URL='postgresql://postgres.uiblezlkmydzndoamvsk:YOUR_DB_PASSWORD@aws-0-<region>.pooler.supabase.com:5432/postgres'
$env:DJANGO_DEBUG='True'
D:\StockAche\backend\.venv\Scripts\python.exe D:\StockAche\backend\manage.py runserver 8000
```

Open <http://localhost:8000/admin/> to approve supplier verification badges or
resolve stuck cancellation requests. Close it and clear `DATABASE_URL` when done.

## Known limitations of this setup

- **Cold starts.** An idle function takes roughly one to three seconds on the
  first request. Clicking through the site once before a demo warms it.
- **Migrations are manual.** Each schema change needs the step 3 command run
  against Postgres before or right after the deploy.
- **10-second function timeout** on the Hobby plan. Every current endpoint
  responds well inside that; a real payment gateway callback may not.
- **No background jobs.** Nothing in the app needs them today.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `DisallowedHost` error | `DJANGO_ALLOWED_HOSTS` missing `.vercel.app` |
| API returns 500, frontend loads | Check the function logs in Vercel → Deployments → Functions |
| `FATAL: too many connections` | `DATABASE_URL` is using port 5432 instead of the 6543 pooler |
| `could not translate host name ... No such host is known` | Using the Direct connection string, which is IPv6-only. Switch to a pooler string. |
| Sign-in redirects to a blank page or `localhost` | Step 6 not done |
| Refreshing `/marketplace` gives 404 | `vercel.json` SPA rewrite missing or Root Directory set wrong |
| Images fail to upload | `SUPABASE_SERVICE_KEY` wrong, or the old key was revoked without updating Vercel |
| Build fails on `pip install` | Root `requirements.txt` missing or Root Directory not the repo root |
