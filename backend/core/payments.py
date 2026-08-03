"""Payment providers.

The prototype runs entirely on `MockProvider`. When real credentials arrive,
implement `BkashProvider.create_payment` / `execute_payment` against the
tokenized checkout API and flip PAYMENT_MODE=live in `.env` -- no caller
changes needed.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from decimal import Decimal

from django.conf import settings

from .models import PaymentMethod, PaymentStatus


@dataclass
class PaymentResult:
    status: str
    reference: str
    message: str
    # Real gateways return a URL to redirect the buyer to; the mock returns "".
    redirect_url: str = ""


class BaseProvider:
    def charge(self, *, method: str, amount: Decimal, order_reference: str) -> PaymentResult:
        raise NotImplementedError


class MockProvider(BaseProvider):
    """Deterministic fake gateway.

    Cash on delivery is marked due-on-delivery; everything else instantly
    succeeds so the demo can walk the full order lifecycle.
    """

    def charge(self, *, method: str, amount: Decimal, order_reference: str) -> PaymentResult:
        if method == PaymentMethod.COD:
            return PaymentResult(
                status=PaymentStatus.DUE_ON_DELIVERY,
                reference="",
                message=f"BDT {amount} collectable on delivery.",
            )

        prefix = "BKS" if method == PaymentMethod.BKASH else "CRD"
        return PaymentResult(
            status=PaymentStatus.PAID,
            reference=f"{prefix}-{uuid.uuid4().hex[:10].upper()}",
            message=f"Mock {method} payment of BDT {amount} accepted for {order_reference}.",
        )


class BkashProvider(BaseProvider):  # pragma: no cover - awaiting credentials
    """Placeholder for the tokenized bKash checkout integration.

    Flow once credentials exist:
      1. POST /tokenized/checkout/token/grant  -> id_token
      2. POST /tokenized/checkout/create       -> paymentID + bkashURL
      3. redirect buyer to bkashURL
      4. POST /tokenized/checkout/execute      -> trxID, confirm order
    """

    def charge(self, *, method: str, amount: Decimal, order_reference: str) -> PaymentResult:
        raise NotImplementedError(
            "bKash credentials are not configured yet. Keep PAYMENT_MODE=mock."
        )


def get_provider() -> BaseProvider:
    if settings.PAYMENT_MODE == "live":
        return BkashProvider()
    return MockProvider()
