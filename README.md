# StockAche?

**A stocklot marketplace and order tracker for Bangladesh's ready-made garment trade.**

StockAche connects small online clothing stores with stocklot wholesalers.
Suppliers list surplus lots with an honest minimum order quantity and real
specs; buyers filter by fabric, weight, MOQ and price, see the full landed
cost before they commit, and track every order to their door.

**Live:** [stockache.netlify.app](https://stockache.netlify.app)

---

## Why it exists

The stocklot trade runs on Facebook groups and WhatsApp threads.

| Today | With StockAche |
| --- | --- |
| Lots buried in group posts; finding the right GSM at the right MOQ takes days | Spec filters: category, GSM, MOQ range, price, district, verified sellers |
| No identity checks, so advance payments disappear | Mandatory NID verification, plus a Verified Supplier badge backed by a trade licence |
| After paying, buyers chase updates by phone | Live tracker: Placed → Confirmed → Dispatched → In Transit → Delivered |
| Total cost unclear until the truck arrives | Fee calculator: quantity × price + delivery, before checkout |
| No way out of a bad order | Free cancellation before the supplier confirms; a reviewed request after |

## Features

**For buyers**
- Google or email sign-in, with business onboarding and NID verification
- Marketplace with spec filters, search, sorting and a *hide sold-out* option
- Fee calculator showing the landed cost per piece
- Standard or guaranteed express delivery
- Checkout with bKash, card or cash on delivery (payments currently simulated)
- Order tracker with a full timeline, ratings and reviews
- Fair cancellation: free before confirmation, by request after

**For suppliers**
- Listings with photos, GSM, composition, sizes, MOQ and delivery options
- Free-delivery and express options per lot
- Dashboard with stock levels, incoming orders and a monthly earnings statement
- One-click order progression, with notes that appear on the buyer's tracker
- Cancellation requests to approve or decline
- Public profile with rating and a Verified badge

**Platform**
- 2% commission on goods value; delivery and express fees pass straight to the supplier
- Stock reserved under a database lock, so a lot can never be oversold
- Prices and commission captured at purchase, so later edits never rewrite history
- Django admin for verification reviews and stuck cancellations

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18, Vite, React Router, Tailwind CSS (custom 8-bit theme) |
| Backend | Django 5, Django REST Framework, gunicorn |
| Database | Supabase Postgres in production; SQLite locally |
| Sign-in | Supabase Auth (Google, email and password) |
| File storage | Supabase Storage |
| Hosting | Netlify (frontend), Render (API) |

```
 Browser ──▶ Netlify (React) ──▶ Render (Django API) ──▶ Supabase (Postgres · Auth · Storage)
```

All business rules live in the Django API; the browser only talks to Supabase
to sign in. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Running locally

You need **Python 3.12** and **Node 20**, plus a free [Supabase](https://supabase.com)
project for sign-in and photo storage.

**Backend**

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # then fill in your Supabase values
python manage.py migrate
python manage.py setup_supabase # creates the photo storage bucket
python manage.py runserver
```

Optionally, `python manage.py seed_demo` adds sample suppliers, lots and orders.

**Frontend**, in a second terminal:

```bash
cd frontend
npm install
cp .env.example .env            # then fill in your Supabase values
npm run dev
```

Open <http://localhost:5173>. In Supabase, add
`http://localhost:5173/auth/callback` under **Authentication → URL
Configuration → Redirect URLs** so sign-in can return to your machine.

**Admin**: `python manage.py createsuperuser`, then
<http://localhost:8000/admin/>.

## Deployment

The live site runs on Netlify and Render against Supabase. Both deploy
automatically on every push to `main`. Setup steps, required settings and
troubleshooting are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Documentation

| Document | Covers |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, sign-in flow, data model, API reference, project layout |
| [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md) | Commission, delivery, stock and sold-out lots, cancellations, verification, payments |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Netlify + Render + Supabase setup and troubleshooting |
| [docs/SECURITY_NOTES.md](docs/SECURITY_NOTES.md) | Key handling, database access rules, automated guards, known limitations |
| [docs/DESIGN.md](docs/DESIGN.md) | The 8-bit visual system and type scale |

## Project status

- **Payments are simulated.** bKash, card and cash-on-delivery journeys work
  end to end in sandbox mode; no real money moves. The bKash integration
  point is in place — see [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md#going-live-with-bkash).
- **The Render free tier sleeps** after 15 minutes idle, so the first request
  after a quiet spell takes about 50 seconds.

## License

No licence has been granted. The source is published for reference; all
rights are reserved, and it may not be copied, modified or redistributed
without permission.

© 2026 blackhashcode
