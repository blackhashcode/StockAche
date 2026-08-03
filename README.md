# StockAche?

**A stock-lot marketplace and order tracking system for the Bangladeshi RMG trade.**

StockAche connects small online garment stores (SMEs) with stocklot wholesalers. Suppliers
list surplus lots with a real MOQ and honest specs; buyers filter by GSM, fabric category,
MOQ and price, see their landed cost before committing, and track the order from placement
to delivery.

> Hackathon prototype. Payments run in mock mode — no money moves.

---

## Table of contents

- [The problem](#the-problem)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Demo accounts](#demo-accounts)
- [Architecture](#architecture)
- [Feature checklist](#feature-checklist)
- [Data model](#data-model)
- [API reference](#api-reference)
- [Enabling Google sign-in](#enabling-google-sign-in)
- [Wiring up real payments](#wiring-up-real-payments)
- [Moving to Supabase Postgres](#moving-to-supabase-postgres)
- [Security notes](#security-notes)
- [Project layout](#project-layout)

---

## The problem

The stocklot trade currently runs on Facebook groups and WhatsApp threads:

| Today | With StockAche |
| --- | --- |
| Lots buried in group posts; finding the right GSM at the right MOQ takes days | Spec filters on GSM, category, MOQ range, price and district |
| No trade licence or NID checks — advance payments disappear | Verified Supplier badge backed by trade licence submission |
| After paying, buyers chase updates by phone | Five-milestone tracker: Placed → Confirmed → Dispatched → In Transit → Delivered |
| Total cost unclear until the truck arrives | Fee calculator: (qty × unit price) + transport, before checkout |

---

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React 18 + Vite + React Router | Fast dev loop, familiar |
| Styling | Tailwind CSS 3, custom 8-bit theme | Chunky borders, hard offset shadows, Press Start 2P / VT323 |
| Backend | Django 5 + Django REST Framework | Single authoritative API; business rules live server-side |
| Database | SQLite (prototype) → Supabase Postgres | One env var switches it, no code changes |
| Auth | Supabase Auth (Google OAuth) | Django validates the access token, mirrors the user locally |
| Images | Supabase Storage | Uploaded through Django with the service key, served from a public bucket |
| Payments | Mock provider (bKash / Card / COD) | Swappable `PaymentProvider` interface for the real bKash API |

---

## Quick start

You need **Python 3.11+** and **Node 18+**.

### 1. Backend

```bash
cd backend
python -m venv .venv
```

Activate it — `.venv\Scripts\activate` on Windows, `source .venv/bin/activate` elsewhere — then:

```bash
pip install -r requirements.txt
```

Copy `backend/.env.example` to `backend/.env` and fill in your Supabase values, then:

```bash
python manage.py migrate
```

Seed the demo marketplace (3 suppliers, 2 buyers, 10 lots, 6 orders across the milestone track):

```bash
python manage.py seed_demo
```

Create the Supabase Storage bucket for listing photos (idempotent):

```bash
python manage.py setup_supabase
```

Run it:

```bash
python manage.py runserver 8000
```

### 2. Frontend

```bash
cd frontend
npm install
```

Copy `frontend/.env.example` to `frontend/.env` and fill in `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY`, then:

```bash
npm run dev
```

Open <http://localhost:5173>.

### 3. Django admin (optional)

The admin is where you approve verification badges.

```bash
cd backend && python manage.py createsuperuser
```

Then <http://localhost:8000/admin/> → Supplier profiles → select → **Mark selected as Verified**.

---

## Demo accounts

While `ENABLE_DEV_LOGIN=True`, the login page shows a demo account switcher that signs you in
without Google. Useful for judging.

| Email | Role | Business |
| --- | --- | --- |
| `buyer@stockache.dev` | Buyer | Trendy Threads BD (Dhaka) |
| `shopno@stockache.dev` | Buyer | Shopno Fashion House (Sylhet) |
| `supplier@stockache.dev` | Supplier | Hossain Stocklot House — verified |
| `denimking@stockache.dev` | Supplier | Denim King Traders — verified |
| `ctgfabrics@stockache.dev` | Supplier | Chattogram Fabric Depot — pending verification |

**Set `ENABLE_DEV_LOGIN=False` before deploying anywhere public.** The endpoint hands out a
session for any seeded email with no password.

### Suggested demo path

1. Sign in as **Trendy Threads BD** → Marketplace → filter *Denim* + *Heavy (261+)* + *Verified only*.
2. Open a lot → set the fee calculator to 2× MOQ → **Order**.
3. Checkout with **bKash** → the mock wallet modal → land on the live tracker.
4. Sign out, sign in as **Hossain Stocklot House** → **Orders** → **Confirm** → **Mark Dispatched**.
5. Back as the buyer, the tracker has advanced.

---

## Architecture

```
┌──────────────────┐         ┌─────────────────────┐        ┌──────────────────┐
│  React (Vite)    │  JWT    │  Django + DRF       │        │  Supabase        │
│  Tailwind, 8-bit │────────▶│  :8000/api          │───────▶│  Auth  (Google)  │
│  :5173           │ Bearer  │                     │ verify │  Storage (images)│
└──────────────────┘         │  business rules,    │        │  Postgres (opt.) │
        │                    │  order state machine│        └──────────────────┘
        │  supabase-js       └─────────────────────┘
        │  (session only)              │
        └──────────────────────────────┘ SQLite by default
```

**Auth flow.** The browser signs in with Supabase and holds the session. Every API call carries
`Authorization: Bearer <supabase access token>`. Django's `SupabaseAuthentication` verifies it —
locally with `SUPABASE_JWT_SECRET` if you supply one, otherwise by introspecting
`/auth/v1/user` (cached 5 minutes) — then mirrors the user into a local `Account` row. Django
never stores a password.

**Why Django owns the data.** All the rules that matter — MOQ enforcement, stock reservation
under a row lock, the legal order-status transitions, price snapshotting — live in one place
and can't be bypassed by a crafted client request. Supabase is used for what it's genuinely
best at here: identity and file storage.

---

## Feature checklist

### Buyer

- [x] Google sign-in, then role selection and business onboarding (business name, type, address, NID)
- [x] Stocklot discovery feed — product cards with thumbnail, title, unit price, MOQ, GSM, verified badge
- [x] Spec filters: fabric category (multi-select), GSM range + presets, MOQ range, price range, supplier district, verified-only
- [x] Full-text search across title, description, composition and supplier name
- [x] Sorting: newest, price, MOQ, lot size, GSM
- [x] Product detail: image gallery, full spec breakdown, supplier card with verification status
- [x] **Fee calculator widget** — (qty × unit price) + transport, live, with per-piece landed cost and MOQ/stock warnings
- [x] Checkout: quantity, delivery address, contact person, notes, payment method
- [x] bKash / Card / Cash on Delivery (mocked)
- [x] Buyer dashboard: order count, active orders, pieces bought, total spend
- [x] **Milestone progress bar** with full event timeline, auto-refreshing every 15s while in flight
- [x] Cancel before the supplier confirms (stock returns to the lot, payment marked refunded)
- [x] Rate and review a delivered order

### Supplier

- [x] Supplier profile with trade licence + NID submission
- [x] **Verified Supplier badge** — submission moves you to `pending`, admin approves
- [x] Create / edit / pause / delete listings
- [x] Image upload straight into Supabase Storage, with cover-photo selection
- [x] Supplier dashboard: active listings, orders needing action, in transit, revenue, star rating
- [x] Stock-level bars with low-stock warning under 2× MOQ
- [x] Incoming order queues: Needs Action / On The Road / Delivered / All
- [x] **Order dispatch controller** — one click per milestone, with a note that lands on the buyer's timeline
- [x] Cancel an order (restocks the lot, flags refund)
- [x] Public supplier page with rating and live lots

### System

- [x] Order state machine — illegal transitions rejected server-side
- [x] Stock reserved under `select_for_update` so two buyers can't oversell one lot
- [x] Prices snapshotted onto the order, so editing a listing never rewrites history
- [x] Listings with orders are soft-deleted (paused) to preserve order history
- [x] Django admin with bulk verify/reject actions
- [x] Seed command for demo data

---

## Data model

```
Account (mirrors a Supabase Auth user)
├── supabase_uid, email, full_name, phone, avatar_url, role
├── BuyerProfile    1:1 — business_name, business_type, contact_phone, address,
│                         district, nid_number, verification_status
└── SupplierProfile 1:1 — business_name, contact_phone, address, district,
                          trade_license_number, nid_number, about, verification_status

Product (a stocklot listing)  →  SupplierProfile
  title, description, category, gsm, fabric_composition, sizes_available, colors,
  available_quantity, moq, unit_price_bdt, estimated_transport_cost, images[], location, is_active

Order  →  BuyerProfile, Product
  reference, ordered_quantity, unit_price_bdt*, transport_cost*, total_price,
  payment_method, payment_status, payment_reference, order_status,
  delivery_address, delivery_district, contact_person, contact_phone, notes,
  buyer_rating, buyer_review              (* snapshotted at purchase time)

OrderEvent  →  Order
  status, note, created_by, created_at    (append-only tracking timeline)
```

**Order status track** — `placed → confirmed → dispatched → in_transit → delivered`, with
`cancelled` reachable from any pre-delivery state. Transitions are enforced by
`ALLOWED_TRANSITIONS` in `backend/core/models.py`.

**Payment status** — `pending`, `paid`, `due_on_delivery`, `failed`, `refunded`. COD orders flip
to `paid` automatically when marked delivered.

---

## API reference

Base URL `http://127.0.0.1:8000/api`. Authenticated routes need
`Authorization: Bearer <token>`.

### Public

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/meta/` | Categories, districts, statuses, payment methods, feature flags |
| `GET` | `/products/` | Marketplace feed — see filters below |
| `GET` | `/products/{id}/` | Listing detail |
| `POST` | `/products/{id}/quote/` | Server-side fee calculation |
| `GET` | `/suppliers/{id}/` | Public supplier page + live lots |
| `POST` | `/auth/dev-login/` | Demo session (only when `ENABLE_DEV_LOGIN=True`) |

Feed query parameters: `search`, `category` (comma separated), `gsm_min`, `gsm_max`,
`moq_min`, `moq_max`, `price_min`, `price_max`, `district`, `verified_only`, `supplier`,
`ordering`, `page`.

### Authenticated

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/auth/me/` | Account + attached profiles |
| `POST` | `/auth/role/` | Choose buyer or supplier |
| `GET/PUT` | `/profiles/buyer/` | Buyer profile |
| `GET/PUT` | `/profiles/supplier/` | Supplier profile |
| `POST` | `/uploads/` | Multipart image → Supabase Storage, returns public URL |
| `GET` | `/orders/` | Your orders (purchases, or sales if you're a supplier) |
| `GET` | `/orders/{id}/` | Order detail with timeline |
| `POST` | `/orders/` | Place an order (buyer) |
| `POST` | `/orders/{id}/cancel/` | Cancel while still `placed` (buyer) |
| `POST` | `/orders/{id}/review/` | Rate a delivered order (buyer) |
| `GET` | `/dashboard/buyer/` | Buyer stats |

### Supplier only

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/products/mine/` | All your listings including paused ones |
| `POST` | `/products/` | Create a listing |
| `PATCH/DELETE` | `/products/{id}/` | Edit / remove (soft-deletes if it has orders) |
| `GET` | `/orders/incoming/` | Orders on your lots, filterable by `?status=` |
| `POST` | `/orders/{id}/status/` | Dispatch controller — advance the milestone |
| `GET` | `/dashboard/supplier/` | Supplier stats + low stock |

---

## Enabling Google sign-in

1. **Google Cloud Console** → APIs & Services → Credentials → *Create OAuth client ID* → Web
   application.
2. Authorised redirect URI:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. **Supabase Dashboard** → Authentication → Providers → **Google** → enable, paste the client
   ID and secret.
4. **Supabase Dashboard** → Authentication → URL Configuration → add
   `http://localhost:5173/auth/callback` to *Redirect URLs*.

Until that's done, the demo account switcher covers the same ground.

---

## Wiring up real payments

Everything routes through `backend/core/payments.py`:

```python
class BaseProvider:
    def charge(self, *, method, amount, order_reference) -> PaymentResult: ...
```

`MockProvider` is active while `PAYMENT_MODE=mock`. `BkashProvider` is stubbed with the
tokenized checkout sequence documented in its docstring:

1. `POST /tokenized/checkout/token/grant` → `id_token`
2. `POST /tokenized/checkout/create` → `paymentID` + `bkashURL`
3. Redirect the buyer to `bkashURL`
4. `POST /tokenized/checkout/execute` → `trxID`, confirm the order

Fill in the credentials in `.env`, implement `charge`, set `PAYMENT_MODE=live`. No calling code
changes. The frontend's mock wallet modal lives in `frontend/src/pages/Checkout.jsx` and should
be replaced by the redirect at that point.

---

## Moving to Supabase Postgres

Grab the **session pooler** string from Supabase → Project Settings → Database, put it in
`backend/.env`:

```
DATABASE_URL=postgresql://postgres.<ref>:<db-password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Then `python manage.py migrate`. Nothing else changes — `settings.py` parses the URL and swaps
the engine.

---

## Security notes

- `.env` files are gitignored. `.env.example` files document every variable and are safe to commit.
- The **secret / service_role key is server-side only**. It lives in `backend/.env`, never in
  `frontend/.env`, and never reaches the browser — image uploads are proxied through Django
  specifically so the key stays on the server.
- Only `VITE_`-prefixed variables reach the browser bundle. Never put a secret key behind that prefix.
- `ENABLE_DEV_LOGIN` must be `False` anywhere public. It issues a session for any seeded email
  with no credential check.
- **If a key has ever been pasted into a chat, an issue, or a screenshot, rotate it** —
  Supabase Dashboard → Project Settings → API.
- Business rules (MOQ, stock, status transitions, ownership) are enforced server-side; the
  frontend only mirrors them for UX.

---

## Project layout

```
StockAche/
├── .gitignore
├── README.md
├── backend/
│   ├── .env.example          # documented template (commit this)
│   ├── .env                  # your real values (gitignored)
│   ├── requirements.txt
│   ├── manage.py
│   ├── stockache/
│   │   ├── settings.py       # env-driven config, SQLite ↔ Postgres switch
│   │   └── urls.py
│   └── core/
│       ├── models.py         # domain model + order state machine
│       ├── serializers.py    # validation, incl. MOQ and stock checks
│       ├── views.py          # marketplace, orders, dashboards, uploads
│       ├── authentication.py # Supabase token → local Account
│       ├── permissions.py    # IsBuyer / IsSupplier / IsSupplierOrReadOnly
│       ├── filters.py        # spec filters for the feed
│       ├── payments.py       # mock + bKash provider interface
│       ├── storage.py        # Supabase Storage client
│       ├── admin.py          # verification approval queue
│       └── management/commands/
│           ├── seed_demo.py
│           └── setup_supabase.py
└── frontend/
    ├── .env.example
    ├── .env                  # gitignored
    ├── tailwind.config.js    # 8-bit palette, pixel shadows, animations
    └── src/
        ├── main.jsx
        ├── App.jsx           # routes + role guards
        ├── index.css         # .pixel-box / .pixel-btn / .pixel-input primitives
        ├── lib/              # api client, supabase client, formatters
        ├── context/          # AuthContext, ToastContext
        ├── hooks/            # useMeta
        ├── components/       # ui kit, Layout, ProductCard, OrderTracker, ImageUploader
        └── pages/            # Landing, Marketplace, ProductDetail, Checkout,
                              # BuyerOrders, OrderDetail, Supplier*, Profile, Onboarding
```
