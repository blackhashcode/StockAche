"""Payment providers.

`SandboxProvider` reproduces the *shape* of a real gateway interaction —
merchant grant, payment create, execute, transaction ID — without contacting
anyone or handling real instrument data. Swapping in the live bKash integration
is a matter of implementing `BkashProvider` and setting PAYMENT_MODE=live; no
calling code changes.

Card details are deliberately never accepted by this module. The checkout UI
collects them client-side only, and the server sees nothing but a method and an
amount. That keeps the system out of PCI scope entirely.
"""

from __future__ import annotations

import hashlib
import random
import uuid
from dataclasses import dataclass, field
from decimal import Decimal

from django.conf import settings

from .models import PaymentMethod, PaymentStatus


@dataclass
class PaymentResult:
    status: str
    reference: str
    message: str
    # Real gateways hand back a URL to send the payer to.
    redirect_url: str = ""
    # Gateway-side identifiers, surfaced on the order for reconciliation.
    details: dict = field(default_factory=dict)


class BaseProvider:
    def charge(self, *, method: str, amount: Decimal, order_reference: str) -> PaymentResult:
        raise NotImplementedError


class SandboxProvider(BaseProvider):
    """Deterministic stand-in for the live gateways.

    Mirrors the identifier formats the real services return so downstream code,
    reconciliation reports and the UI can be built and demonstrated against
    realistic data:

      bKash  TrxID   -> 10 uppercase alphanumerics, e.g. `BKQ7X2M4P1`
      Card   auth    -> 6-digit authorisation code plus an RRN
    """

    def charge(self, *, method: str, amount: Decimal, order_reference: str) -> PaymentResult:
        if method == PaymentMethod.COD:
            return PaymentResult(
                status=PaymentStatus.DUE_ON_DELIVERY,
                reference="",
                message=f"BDT {amount} collectable on delivery.",
                details={"method": "cod"},
            )

        # Seeded from the order reference so a retry of the same order produces
        # the same identifiers, exactly like an idempotent gateway call.
        seed = int(hashlib.sha256(order_reference.encode()).hexdigest()[:12], 16)
        rng = random.Random(seed)
        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789"

        if method == PaymentMethod.BKASH:
            trx_id = "BK" + "".join(rng.choice(alphabet) for _ in range(8))
            return PaymentResult(
                status=PaymentStatus.PAID,
                reference=trx_id,
                message=f"bKash payment of BDT {amount} completed. TrxID {trx_id}.",
                details={
                    "method": "bkash",
                    "trx_id": trx_id,
                    "payment_id": f"TR{rng.randint(10**11, 10**12 - 1)}",
                    "merchant_invoice": order_reference,
                },
            )

        auth_code = f"{rng.randint(0, 999999):06d}"
        rrn = f"{rng.randint(0, 10**12 - 1):012d}"
        return PaymentResult(
            status=PaymentStatus.PAID,
            reference=f"CRD{auth_code}",
            message=f"Card payment of BDT {amount} authorised. Auth code {auth_code}.",
            details={
                "method": "card",
                "auth_code": auth_code,
                "rrn": rrn,
                "scheme": "visa",
            },
        )


class BkashProvider(BaseProvider):  # pragma: no cover - awaiting credentials
    """Live bKash tokenized checkout.

    Sequence once credentials exist:
      1. POST /tokenized/checkout/token/grant    -> id_token
      2. POST /tokenized/checkout/create         -> paymentID + bkashURL
      3. redirect the buyer to bkashURL
      4. POST /tokenized/checkout/execute        -> trxID, confirm the order

    Requires BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USERNAME, BKASH_PASSWORD
    and BKASH_BASE_URL in the environment.
    """

    def charge(self, *, method: str, amount: Decimal, order_reference: str) -> PaymentResult:
        raise NotImplementedError(
            "bKash credentials are not configured. Keep PAYMENT_MODE=sandbox."
        )


def get_provider() -> BaseProvider:
    if settings.PAYMENT_MODE == "live":
        return BkashProvider()
    return SandboxProvider()
