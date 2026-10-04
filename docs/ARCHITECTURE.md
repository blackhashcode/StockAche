# Architecture

- [System overview](#system-overview)
- [Authentication flow](#authentication-flow)
- [Data model](#data-model)
- [API reference](#api-reference)
- [Project layout](#project-layout)

---

## System overview

```
┌────────────────────┐   Bearer JWT    ┌──────────────────────┐        ┌──────────────────────┐
│  React (Vite)      │ ──────────────▶ │  Django + DRF        │ ─────▶ │  Supabase            │
│  Tailwind, 8-bit   │    /api/*       │  business rules,     │ verify │  Auth (Google, email)│
│                    │                 │  order state machine │ token  │  Storage (images)    │
│  Netlify           │                 │  Render              │        │  Postgres            │
└─────────┬──────────┘                 └──────────────────────┘        └──────────────────────┘
          │  supabase-js (sign-in session only)                                   ▲
          └───────────────────────────────────────────────────────────────────────┘
```

**Django owns the data.** Every rule that matters — MOQ, stock reservation
under a row lock, legal order-status transitions, price and commission
snapshots, identity checks, ownership — lives in one place and cannot be
bypassed by a crafted client request. Supabase provides what it is best at:
identity, file storage and a managed Postgres.

The frontend uses supabase-js **only** for signing in. All data goes through
the Django API.

Locally the database is SQLite; setting `DATABASE_URL` switches Django to
Postgres with no code changes.

## Authentication flow

1. The browser signs in with Supabase (Google or email/password) and holds the
   session.
2. Every API call carries `Authorization: Bearer <supabase access token>`.
3. `core/authentication.py` (`SupabaseAuthentication`) verifies the token —
   locally if `SUPABASE_JWT_SECRET` is set, otherwise by asking Supabase's
   `/auth/v1/user` (cached for five minutes).
4. The user is mirrored into a local `Account` row, keyed by the Supabase user
   ID. Django never stores a password for marketplace users.

The Django admin is separate: it uses Django's own `auth_user` accounts.

Supabase redirects back to `/auth/callback` after Google sign-in, email
confirmation and password reset. `pages/AuthCallback.jsx` waits for the client
to turn the URL fragment into a session before routing, and explains expired
or rejected links rather than bouncing to the login page.

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
  derived: is_sold_out (available_quantity < moq), in_stock (is_active and not sold out)

Order  →  BuyerProfile, Product
  reference, ordered_quantity, unit_price_bdt*, transport_cost*, express_fee*, total_price,
  delivery_speed, promised_delivery_at,
  commission_rate*, platform_commission, supplier_payout,
  payment_method, payment_status, payment_reference, order_status,
  delivery_address, delivery_district, contact_person, contact_phone, notes,
  cancelled_at, cancelled_by_buyer, cancellation_reason,
  buyer_rating, buyer_review                       (* snapshotted at purchase time)

OrderEvent  →  Order
  status, note, created_by, created_at             (append-only tracking timeline)

CancellationRequest  →  Order
  reason, status, response_note, resolved_by, resolved_at
```

**Order status** — `placed → confirmed → dispatched → in_transit → delivered`,
plus `cancelled`.
**Payment status** — `pending`, `paid`, `due_on_delivery`, `failed`, `refunded`.

## API reference

Base path `/api`. Authenticated routes need `Authorization: Bearer <token>`.

### Public

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/meta/` | Categories, districts, statuses, payment methods, commission rate, cancellation limit |
| `GET` | `/products/` | Marketplace feed (published lots, sold-out ones last) |
| `GET` | `/products/{id}/` | Listing detail |
| `POST` | `/products/{id}/quote/` | Server-side fee calculation; accepts `quantity`, `delivery_speed` |
| `GET` | `/suppliers/{id}/` | Public supplier page with live lots |
| `POST` | `/auth/dev-login/` | Local test session — only when `ENABLE_DEV_LOGIN=True` |

Feed query parameters: `search`, `category` (comma-separated), `gsm_min`,
`gsm_max`, `moq_min`, `moq_max`, `price_min`, `price_max`, `district`,
`verified_only`, `in_stock`, `supplier`, `ordering`, `page`.

### Signed in

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/auth/me/` | Account plus attached profiles |
| `POST` | `/auth/role/` | Choose buyer or supplier |
| `GET/PUT` | `/profiles/buyer/` | Buyer profile |
| `GET/PUT` | `/profiles/supplier/` | Supplier profile |
| `POST` | `/uploads/` | Multipart image → Supabase Storage; returns the URL |
| `GET` | `/orders/` | Your orders (purchases, or sales for a supplier) |
| `GET` | `/orders/{id}/` | Order detail with timeline |
| `POST` | `/orders/` | Place an order (buyer) |
| `POST` | `/orders/{id}/cancel/` | Free self-cancel while `placed` and within quota |
| `POST` | `/orders/{id}/cancellation-request/` | Ask the supplier to cancel; needs a `reason` |
| `POST` | `/orders/{id}/cancellation-request/withdraw/` | Withdraw an open request |
| `POST` | `/orders/{id}/review/` | Rate a delivered order |
| `GET` | `/dashboard/buyer/` | Buyer stats, including the remaining cancellation quota |

### Supplier only

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/products/mine/` | All your listings, including paused and sold-out ones |
| `POST` | `/products/` | Create a listing |
| `PATCH/DELETE` | `/products/{id}/` | Edit, or remove (paused instead if it has orders) |
| `GET` | `/orders/incoming/` | Orders on your lots, filterable by `?status=` |
| `POST` | `/orders/{id}/status/` | Advance the order milestone |
| `GET` | `/orders/cancellation-requests/` | Cancellation queue, filterable by `?status=` |
| `POST` | `/orders/{id}/cancellation-request/resolve/` | Approve or decline a request |
| `GET` | `/dashboard/supplier/` | Stats, commission split, stock levels |
| `GET` | `/dashboard/supplier/earnings/` | Month-by-month gross / fee / net statement |

## Project layout

```
StockAche/
├── README.md
├── netlify.toml              # frontend build + SPA fallback (Netlify)
├── render.yaml               # API service blueprint (Render)
├── docs/                     # this documentation
├── scripts/
│   ├── check_secrets.py      # secret scanner + pre-commit hook installer
│   ├── migrate_production.ps1  # run migrations against Supabase, password prompted
│   └── _dbcheck.py           # connection check used by the migration script
├── backend/
│   ├── .env.example          # every backend setting, documented
│   ├── requirements.txt
│   ├── stockache/            # settings (env-driven, SQLite ↔ Postgres), urls, wsgi
│   └── core/
│       ├── models.py         # domain model, order state machine, cancellation policy
│       ├── serializers.py    # validation: MOQ, stock, NID, delivery options
│       ├── views.py          # marketplace, orders, cancellations, dashboards, uploads
│       ├── filters.py        # spec filters for the feed
│       ├── authentication.py # Supabase token → local Account
│       ├── permissions.py    # IsBuyer / IsSupplier / IsSupplierOrReadOnly
│       ├── payments.py       # sandbox provider + bKash interface
│       ├── storage.py        # Supabase Storage client
│       ├── db_security.py    # row-level security on every migrate
│       ├── checks.py         # deployment safety checks (`manage.py check`)
│       ├── admin.py          # verification review, cancellation escalation
│       └── management/commands/  # seed_demo, setup_supabase
└── frontend/
    ├── .env.example
    ├── tailwind.config.js    # 8-bit palette, type ramp, shadows
    └── src/
        ├── App.jsx           # routes + role guards
        ├── index.css         # pixel primitives and type system
        ├── lib/              # API client, Supabase client, formatters
        ├── context/          # AuthContext, ToastContext
        ├── hooks/            # useMeta
        ├── components/       # UI kit, layout, cards, tracker, payment flow, uploaders
        └── pages/            # marketplace, product, checkout, orders, supplier pages, auth
```
