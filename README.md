# StockAche?

**A stock-lot marketplace and order tracking system for the Bangladeshi RMG trade.**

StockAche connects small online garment stores (SMEs) with stocklot wholesalers. Suppliers
list surplus lots with a real MOQ and honest specs; buyers filter by GSM, fabric category,
MOQ and price, see their landed cost before committing, and track the order from placement
to delivery.

---

## Table of contents

- [The problem](#the-problem)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [How the platform makes money](#how-the-platform-makes-money)
- [Delivery options](#delivery-options)
- [Cancellation policy](#cancellation-policy)
- [Identity verification](#identity-verification)
- [Architecture](#architecture)
- [Feature checklist](#feature-checklist)
- [Data model](#data-model)
- [API reference](#api-reference)
- [Authentication setup](#authentication-setup)
- [Payments](#payments)
- [Moving to Supabase Postgres](#moving-to-supabase-postgres)
- [Security notes](#security-notes)
- [Project layout](#project-layout)
- [Typography](#typography)

---

## The problem

The stocklot trade currently runs on Facebook groups and WhatsApp threads:

| Today | With StockAche |
| --- | --- |
| Lots buried in group posts; finding the right GSM at the right MOQ takes days | Spec filters on GSM, category, MOQ range, price and district |
| No trade licence or NID checks — advance payments disappear | Mandatory identity verification, plus a Verified Supplier badge backed by trade licence |
| After paying, buyers chase updates by phone | Five-milestone tracker: Placed → Confirmed → Dispatched → In Transit → Delivered |
| Total cost unclear until the truck arrives | Fee calculator: (qty × unit price) + delivery, before checkout |
| No way to get out of a bad order | Free cancellation before confirmation; a reviewed request after |

---

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React 18 + Vite + React Router | Fast dev loop, familiar |
| Styling | Tailwind CSS 3, custom 8-bit theme | Chunky borders and hard offset shadows; Press Start 2P for headings, Space Grotesk for everything that has to be read |
| Backend | Django 5 + Django REST Framework | Single authoritative API; business rules live server-side |
| Database | SQLite locally → Supabase Postgres | One env var switches it, no code changes |
| Auth | Supabase Auth — Google OAuth + email/password | Django validates the access token and mirrors the user locally |
| Images | Supabase Storage | Uploaded through Django with the service key, served from a public bucket |
| Payments | bKash / Card / Cash on Delivery | Swappable `PaymentProvider` interface; sandbox provider until live credentials land |

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

Seed sample catalogue data (3 suppliers, 2 buyers, 10 lots, 6 orders across the milestone
track). Optional, but it makes the marketplace look alive on first run:

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

### Suggested walkthrough

1. Register with email and password, or continue with Google.
2. Choose **Buyer**, complete the business profile and upload an NID photo.
3. Marketplace → filter *Denim* + *Heavy (261+)* + *Verified only*.
4. Open a lot → set the fee calculator to 2× MOQ → pick **Express** → **Order**.
5. Check out with **bKash** → wallet number, OTP, PIN → land on the live tracker.
6. Sign in as a supplier account → **Orders** → **Confirm** → **Mark Dispatched**.
7. Back as the buyer, the tracker has advanced.

> `ENABLE_DEV_LOGIN` exposes `POST /api/auth/dev-login/`, a local-only endpoint used by the
> automated tests to obtain a session without a password. No part of the UI references it.
> **It must be `False` anywhere reachable from the internet.**

---

## How the platform makes money

StockAche charges a **2% commission on the goods value** of each order.

| | |
| --- | --- |
| Charged on | The goods subtotal — `unit price × quantity` |
| **Not** charged on | Delivery charges and express fees, which pass through to the supplier in full |
| Rate | `PLATFORM_COMMISSION_RATE` in `backend/.env`, default `0.02` |
| Billing period | Calendar month. Suppliers see a month-by-month statement on their dashboard |
| Cancelled orders | Earn nothing — commission and payout are both zeroed on cancellation |

Commissioning only the goods value matters: taking a cut of transport would penalise
suppliers for delivering further, and taking a cut of the express fee would penalise them
for delivering faster. The rate is snapshotted onto every order at purchase time, so
changing it later never rewrites historical earnings.

Worked example on a ৳20,250 lot with free delivery and a ৳600 express fee:

```
Goods subtotal      ৳20,250
Platform fee (2%)     −৳405
Delivery                  ৳0   (supplier offers free delivery)
Express fee            +৳600   (passes through in full)
─────────────────────────────
Buyer pays          ৳20,850
Supplier receives   ৳20,445
Platform earns         ৳405
```

---

## Delivery options

Set per listing by the supplier:

- **Standard** — flat transport cost, or **free delivery** if the supplier absorbs it.
  Free-delivery lots carry a green badge on the feed, and the transport cost is forced to
  zero at the model layer so it cannot drift out of sync.
- **Express** — a guaranteed window (1–72 hours, default 24) for an additional fee. Buyers
  who choose it get a `promised_delivery_at` deadline shown on the order, and the order is
  badged express in the supplier's queue so it gets picked first.

Express is opt-in per listing. If a supplier cannot meet a deadline, they simply do not
enable it, and the option never appears to buyers.

---

## Cancellation policy

A flat monthly quota alone would punish a buyer whose supplier went silent exactly as much
as a serial time-waster. The policy is tiered instead:

| Situation | What happens |
| --- | --- |
| Supplier has **not** confirmed yet | Free, instant self-cancel. Nothing has been committed, so there is no one to harm. |
| Supplier **has** confirmed | A **cancellation request** with a written reason. The supplier approves or declines; stock stays reserved until they respond, so nobody is left guessing. |
| More than **2** self-cancels in a calendar month | Even pre-confirmation cancels become requests. This is the abuse guard. |
| Supplier cancels, or approves a request | Never counts against the buyer's quota. |
| Order delivered or already cancelled | Closed — no cancellation possible. |

Tune the quota with `SELF_CANCEL_LIMIT_PER_MONTH` in `backend/core/models.py`. Approved
cancellations restock the lot and flag a refund automatically. Admins can resolve stuck
requests from the Django admin.

---

## Identity verification

Every trader must have identity documents on file before they can transact:

- **Buyers** — NID number plus a photo of the card. Enforced in the serializer *and* again
  at order placement, so it cannot be bypassed by a crafted request.
- **Suppliers** — the same, plus an optional trade licence. Submitting a valid trade licence
  puts the account in the review queue for the **Verified Supplier** badge, which buyers can
  filter on.

NID numbers are validated for length (10, 13 or 17 digits). Documents upload to a separate
`documents/` folder in Supabase Storage and are surfaced only in the Django admin review
queue — never through the public API. Other traders see a business name, district and
verification status, and nothing else.

Approve or reject from <http://localhost:8000/admin/> → Buyer/Supplier profiles → select →
**Approve verification**.

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

- [x] Register with **email and password**, or continue with **Google**; password reset by email
- [x] Role selection, then business onboarding with **mandatory NID number and card photo**
- [x] Stocklot discovery feed — cards showing thumbnail, unit price, MOQ, GSM, verified badge, delivery terms
- [x] Spec filters: fabric category (multi-select), GSM range + presets, MOQ range, price range, supplier district, verified-only
- [x] Full-text search across title, description, composition and supplier name
- [x] Sorting: newest, price, MOQ, lot size, GSM
- [x] Product detail: image gallery, full spec breakdown, supplier card with verification status
- [x] **Fee calculator** — (qty × unit price) + delivery + express, live, with per-piece landed cost and MOQ/stock warnings
- [x] **Standard / express delivery** selection with the surcharge shown before committing
- [x] Checkout: quantity, delivery speed, address, contact person, notes, payment method
- [x] **Multi-step bKash** (wallet → OTP → PIN) and **card** (details → 3-D Secure OTP) journeys
- [x] Cash on delivery
- [x] Buyer dashboard: order count, active orders, pieces bought, total spend, cancellation quota
- [x] **Milestone progress bar** with full event timeline, auto-refreshing every 15s while in flight
- [x] **Free cancellation** before the supplier confirms; **cancellation request** after, with withdraw
- [x] Express orders show a `promised_delivery_at` guarantee
- [x] Rate and review a delivered order

### Supplier

- [x] Supplier profile with **mandatory NID** plus optional trade licence upload
- [x] **Verified Supplier badge** — submission moves you to `pending`, admin approves
- [x] Create / edit / pause / delete listings
- [x] **Per-listing delivery options** — free delivery toggle, express availability, fee and window
- [x] Live payout preview while pricing a listing (what you receive after commission)
- [x] Image upload straight into Supabase Storage, with cover-photo selection
- [x] Supplier dashboard: active listings, orders needing action, in transit, net earnings, star rating
- [x] **Monthly earnings statement** — gross, platform fee, net payout, per month
- [x] Stock-level bars with low-stock warning under 2× MOQ
- [x] Incoming order queues: Needs Action / On The Road / Delivered / All
- [x] **Order dispatch controller** — one click per milestone, with a note that lands on the buyer's timeline
- [x] **Cancellation request queue** — approve or decline, with the buyer's reason in context
- [x] Public supplier page with rating and live lots

### System

- [x] Order state machine — illegal transitions rejected server-side
- [x] Stock reserved under `select_for_update` so two buyers can't oversell one lot
- [x] Prices, delivery costs and the commission rate snapshotted onto the order
- [x] **2% platform commission** on goods value, excluded from pass-through costs
- [x] Tiered cancellation policy with a per-buyer monthly quota
- [x] Identity documents enforced at both the serializer and the order-placement layer
- [x] Listings with orders are soft-deleted (paused) to preserve order history
- [x] Django admin with document review and bulk verify/reject actions
- [x] Seed command for sample catalogue data

---

## Data model

```
Account (mirrors a Supabase Auth user)
├── supabase_uid, email, full_name, phone, avatar_url, role
├── BuyerProfile    1:1 — business_name, business_type, contact_phone, address, district,
│                         nid_number, nid_document_url, nid_back_url, verification_status
└── SupplierProfile 1:1 — business_name, contact_phone, address, district, about,
                          trade_license_number, trade_license_document_url,
                          nid_number, nid_document_url, nid_back_url, verification_status

Product (a stocklot listing)  →  SupplierProfile
  title, description, category, gsm, fabric_composition, sizes_available, colors,
  available_quantity, moq, unit_price_bdt, estimated_transport_cost,
  free_delivery, express_delivery_available, express_delivery_fee, express_delivery_hours,
  images[], location, is_active

Order  →  BuyerProfile, Product
  reference, ordered_quantity, unit_price_bdt*, transport_cost*, express_fee*, total_price,
  delivery_speed, promised_delivery_at,
  commission_rate*, platform_commission, supplier_payout,
  payment_method, payment_status, payment_reference, order_status,
  delivery_address, delivery_district, contact_person, contact_phone, notes,
  cancelled_at, cancelled_by_buyer, cancellation_reason,
  buyer_rating, buyer_review              (* snapshotted at purchase time)

OrderEvent  →  Order
  status, note, created_by, created_at    (append-only tracking timeline)

CancellationRequest  →  Order
  reason, status, response_note, resolved_by, resolved_at
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
| `GET` | `/meta/` | Categories, districts, statuses, payment methods, commission rate, cancellation limit |
| `GET` | `/products/` | Marketplace feed — see filters below |
| `GET` | `/products/{id}/` | Listing detail |
| `POST` | `/products/{id}/quote/` | Server-side fee calculation; accepts `delivery_speed` |
| `GET` | `/suppliers/{id}/` | Public supplier page + live lots |
| `POST` | `/auth/dev-login/` | Local test session (only when `ENABLE_DEV_LOGIN=True`) |

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
| `POST` | `/orders/` | Place an order (buyer); accepts `delivery_speed` |
| `POST` | `/orders/{id}/cancel/` | Free self-cancel while still `placed` and within quota |
| `POST` | `/orders/{id}/cancellation-request/` | Ask the supplier to cancel; needs a `reason` |
| `POST` | `/orders/{id}/cancellation-request/withdraw/` | Withdraw an open request |
| `POST` | `/orders/{id}/review/` | Rate a delivered order (buyer) |
| `GET` | `/dashboard/buyer/` | Buyer stats, including remaining cancellation quota |

### Supplier only

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/products/mine/` | All your listings including paused ones |
| `POST` | `/products/` | Create a listing |
| `PATCH/DELETE` | `/products/{id}/` | Edit / remove (soft-deletes if it has orders) |
| `GET` | `/orders/incoming/` | Orders on your lots, filterable by `?status=` |
| `POST` | `/orders/{id}/status/` | Dispatch controller — advance the milestone |
| `GET` | `/orders/cancellation-requests/` | Cancellation queue, filterable by `?status=` |
| `POST` | `/orders/{id}/cancellation-request/resolve/` | Approve or decline a request |
| `GET` | `/dashboard/supplier/` | Stats, commission split, low stock |
| `GET` | `/dashboard/supplier/earnings/` | Month-by-month gross / fee / net statement |

---

## Authentication setup

Supabase Auth handles identity. Two methods are wired up:

### Email and password

Works out of the box once `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. If
**Confirm email** is enabled in Supabase (Authentication → Providers → Email), a new signup
receives a confirmation link and the UI tells them to click it before signing in. Password
reset is wired to `resetPasswordForEmail`.

### Google

1. **Google Cloud Console** → APIs & Services → Credentials → *Create OAuth client ID* → Web
   application.
2. Authorised redirect URI:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. **Supabase Dashboard** → Authentication → Providers → **Google** → enable, paste the client
   ID and secret.
4. **Supabase Dashboard** → Authentication → URL Configuration → add
   `http://localhost:5173/auth/callback` to *Redirect URLs*.

Either way, Django never sees or stores a password — it only validates the resulting access
token.

---

## Payments

All payment traffic routes through `backend/core/payments.py`:

```python
class BaseProvider:
    def charge(self, *, method, amount, order_reference) -> PaymentResult: ...
```

`SandboxProvider` is active while `PAYMENT_MODE=sandbox`. It returns identifiers in the same
shape the live services do — bKash `TrxID`, card auth code and RRN — seeded from the order
reference so retries are idempotent, which is enough to build reconciliation against.

The frontend journeys in `frontend/src/components/PaymentFlow.jsx` reproduce the real step
sequence: bKash goes wallet → OTP → PIN, card goes details → 3-D Secure OTP. **Card fields
never leave the browser** — the server only ever receives a method and an amount, which keeps
the system out of PCI scope. Both modals carry a *Sandbox* chip, exactly as production
gateways badge their test mode.

### Going live with bKash

`BkashProvider` is stubbed with the tokenized checkout sequence:

1. `POST /tokenized/checkout/token/grant` → `id_token`
2. `POST /tokenized/checkout/create` → `paymentID` + `bkashURL`
3. Redirect the buyer to `bkashURL`
4. `POST /tokenized/checkout/execute` → `trxID`, confirm the order

Fill in `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD` and
`BKASH_BASE_URL` in `.env`, implement `charge`, and set `PAYMENT_MODE=live`. No calling code
changes. At that point replace the simulated modals with the gateway's hosted redirect and
delete `PaymentFlow.jsx`.

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
  with no credential check. Nothing in the UI references it — it exists for the test suite.
- **If a key has ever been pasted into a chat, an issue, or a screenshot, rotate it** —
  Supabase Dashboard → Project Settings → API.
- Business rules (MOQ, stock, status transitions, commission, ownership, identity documents)
  are enforced server-side; the frontend only mirrors them for UX.
- **Card details are never transmitted.** The checkout collects them in component state and
  discards them; the server receives only a payment method and an amount. Keep it that way —
  accepting card data server-side pulls the whole system into PCI scope.
- Identity documents upload to a separate `documents/` folder and are exposed only through the
  Django admin, never the public API.

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
│       ├── models.py         # domain model, order state machine, cancellation policy
│       ├── serializers.py    # validation: MOQ, stock, NID, delivery options
│       ├── views.py          # marketplace, orders, cancellations, dashboards, uploads
│       ├── authentication.py # Supabase token → local Account
│       ├── permissions.py    # IsBuyer / IsSupplier / IsSupplierOrReadOnly
│       ├── filters.py        # spec filters for the feed
│       ├── payments.py       # sandbox + bKash provider interface
│       ├── storage.py        # Supabase Storage client
│       ├── admin.py          # verification review + cancellation escalation queue
│       └── management/commands/
│           ├── seed_demo.py
│           └── setup_supabase.py
└── frontend/
    ├── .env.example
    ├── .env                  # gitignored
    ├── tailwind.config.js    # 8-bit palette, type ramp, pixel shadows, animations
    └── src/
        ├── main.jsx
        ├── App.jsx           # routes + role guards
        ├── index.css         # .pixel-box / .pixel-btn / type system (.h-*, .eyebrow, .price)
        ├── lib/              # api client, supabase client, formatters
        ├── context/          # AuthContext, ToastContext
        ├── hooks/            # useMeta
        ├── components/       # ui kit, Layout, ProductCard, OrderTracker,
        │                     # PaymentFlow, ImageUploader, DocumentUpload, ProfileForms
        └── pages/            # Landing, Marketplace, ProductDetail, Checkout,
                              # BuyerOrders, OrderDetail, Supplier*, Profile, Onboarding
```

---

## Typography

The 8-bit look comes from chunky borders, hard offset shadows and a tight palette — not from
setting everything in a pixel font. Press Start 2P is close to unreadable below ~11px, so it
is scoped to headings, buttons and the logo. Everything a user actually has to *read* —
labels, body copy, and every numeral — is Space Grotesk.

| Class | Font | Size | Used for |
| --- | --- | --- | --- |
| `.h-display` | Press Start 2P | 22–30px | Hero headline |
| `.h-page` | Press Start 2P | 16px | Page titles |
| `.h-section` | Press Start 2P | 13px | Section headings |
| `.h-card` | Press Start 2P | 11px | Card headings |
| `.eyebrow` | Space Grotesk 600 | 12px | Small caps labels and metadata |
| `.pixel-label` | Space Grotesk 600 | 12px | Form field labels |
| `.price` / `.stat-value` | Space Grotesk 700 | 16–30px | All currency and figures, tabular |
| body / inputs | Space Grotesk 400 | 16px | Body copy and form controls |

Nothing in the UI renders below 12px except Press Start 2P glyphs at 11px, which is that
face's legibility floor. Currency uses tabular numerals so columns line up and totals do not
reflow as digits change.
