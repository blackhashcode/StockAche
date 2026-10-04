# Business rules

How the marketplace behaves, and why. Every rule here is enforced server-side;
the frontend only mirrors them for a better experience.

- [Platform commission](#platform-commission)
- [Delivery options](#delivery-options)
- [Stock and sold-out lots](#stock-and-sold-out-lots)
- [Cancellation policy](#cancellation-policy)
- [Identity verification](#identity-verification)
- [Payments](#payments)

---

## Platform commission

StockAche takes a **2% commission on the goods value** of each order.

| | |
| --- | --- |
| Charged on | The goods subtotal — `unit price × quantity` |
| **Not** charged on | Delivery and express fees, which pass through to the supplier in full |
| Rate | `PLATFORM_COMMISSION_RATE` environment variable, default `0.02` |
| Billing period | Calendar month; suppliers see a month-by-month statement on their dashboard |
| Cancelled orders | Earn nothing — commission and payout are both zeroed |

Commissioning only the goods value matters: a cut of transport would penalise
suppliers for delivering further, and a cut of the express fee would penalise
them for delivering faster. The rate is snapshotted onto every order at
purchase time, so changing it never rewrites historical earnings.

Worked example — a ৳20,250 lot with free delivery and a ৳600 express fee:

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

## Delivery options

Set per listing by the supplier:

- **Standard** — a flat transport cost, or **free delivery** if the supplier
  absorbs it. Free-delivery lots carry a badge on the feed, and the transport
  cost is forced to zero in the model so it cannot drift out of sync.
- **Express** — a guaranteed window (1–72 hours, default 24) for an extra fee.
  The order records a `promised_delivery_at` deadline and is badged express in
  the supplier's queue.

Express is opt-in per listing: a supplier who cannot meet a deadline simply
leaves it off, and buyers never see the option.

## Stock and sold-out lots

`is_active` means only one thing — whether the supplier has **published** the
lot or **paused** it. Availability is derived from stock: a lot is **sold out**
when `available_quantity < moq`.

- Placing an order reduces stock but never unpublishes the lot.
- Sold-out lots stay on the marketplace, badged *Sold Out*, and sort below
  in-stock lots whatever ordering the buyer picked. *Hide sold-out lots*
  (`?in_stock=true`) removes them from the feed.
- Ordering a sold-out lot is refused with a message that says so.
- A supplier can always open their own listing — paused or sold out — to edit
  it and restock.
- Cancelling an order returns its quantity to the lot without republishing a
  lot the supplier paused.
- Listings that already have orders are paused rather than deleted, so order
  history keeps its references.
- Stock is reserved under a row lock (`select_for_update`), so two buyers
  cannot oversell the same lot.

## Cancellation policy

A flat monthly quota alone would punish a buyer whose supplier went silent
exactly as much as a serial time-waster, so the policy is tiered:

| Situation | What happens |
| --- | --- |
| Supplier has **not** confirmed | Free, instant self-cancel — nothing has been committed yet |
| Supplier **has** confirmed | A **cancellation request** with a written reason; the supplier approves or declines, and stock stays reserved until they do |
| More than **2** self-cancels in a calendar month | Even pre-confirmation cancels become requests — the abuse guard |
| Supplier cancels, or approves a request | Never counts against the buyer's quota |
| Order delivered or already cancelled | Closed |

The quota is `SELF_CANCEL_LIMIT_PER_MONTH` in `backend/core/models.py`.
Approved cancellations restock the lot and flag a refund. Admins can resolve
stuck requests in the Django admin.

The order itself moves through
`placed → confirmed → dispatched → in_transit → delivered`, with `cancelled`
reachable from any pre-delivery state. Illegal transitions are rejected
(`ALLOWED_TRANSITIONS` in `backend/core/models.py`).

## Identity verification

Every trader needs identity documents on file before they can transact:

- **Buyers** — NID number plus a photo of the card. Checked when the profile is
  saved *and* again at order placement, so a crafted request cannot skip it.
- **Suppliers** — the same, plus an optional trade licence. Submitting a trade
  licence puts the account in the review queue for the **Verified Supplier**
  badge, which buyers can filter on.

NID numbers must be 10, 13 or 17 digits. Other traders see a business name,
district and verification status — never documents or NID numbers.

Approve or reject in the Django admin: **Buyer profiles** or **Supplier
profiles** → select → *Approve verification* / *Reject verification*.

## Payments

All payment traffic goes through `backend/core/payments.py`:

```python
class BaseProvider:
    def charge(self, *, method, amount, order_reference) -> PaymentResult: ...
```

`SandboxProvider` is active while `PAYMENT_MODE=sandbox`. It returns
identifiers shaped like the real ones — a bKash `TrxID`, a card authorisation
code and RRN — seeded from the order reference, so retries are idempotent.

The checkout journeys in `frontend/src/components/PaymentFlow.jsx` follow the
real step sequence: bKash goes wallet → OTP → PIN, card goes details → 3-D
Secure OTP. Both carry a *Sandbox* badge. **Card fields never leave the
browser** — the server only ever receives a method and an amount, which keeps
the system out of PCI scope. Cash on delivery is marked paid when the order is
delivered.

### Going live with bKash

`BkashProvider` is stubbed with the tokenized checkout sequence:

1. `POST /tokenized/checkout/token/grant` → `id_token`
2. `POST /tokenized/checkout/create` → `paymentID` + `bkashURL`
3. Redirect the buyer to `bkashURL`
4. `POST /tokenized/checkout/execute` → `trxID`, then confirm the order

Set `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD` and
`BKASH_BASE_URL`, implement `charge`, and set `PAYMENT_MODE=live`. No calling
code changes; replace the simulated checkout modals with the gateway's hosted
redirect at the same time.
