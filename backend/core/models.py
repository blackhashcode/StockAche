"""Core domain models for the StockAche marketplace.

Identity lives in Supabase Auth; `Account` is the local mirror keyed by the
Supabase user UUID. Everything else hangs off that.
"""

import uuid
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class Role(models.TextChoices):
    BUYER = "buyer", "Buyer"
    SUPPLIER = "supplier", "Supplier"
    ADMIN = "admin", "Admin"


class VerificationStatus(models.TextChoices):
    UNSUBMITTED = "unsubmitted", "Not submitted"
    PENDING = "pending", "Pending review"
    VERIFIED = "verified", "Verified"
    REJECTED = "rejected", "Rejected"


class FabricCategory(models.TextChoices):
    TSHIRT = "tshirt", "T-Shirts"
    POLO = "polo", "Polo"
    DENIM = "denim", "Denim"
    KNITWEAR = "knitwear", "Knitwear"
    WOVEN = "woven", "Woven"
    FLEECE = "fleece", "Fleece"
    HOODIE = "hoodie", "Hoodie / Sweatshirt"
    TROUSER = "trouser", "Trousers"
    KIDSWEAR = "kidswear", "Kidswear"
    ACTIVEWEAR = "activewear", "Activewear"
    OTHER = "other", "Other"


class OrderStatus(models.TextChoices):
    """The buyer-facing milestone track."""

    PLACED = "placed", "Order Placed"
    CONFIRMED = "confirmed", "Confirmed by Supplier"
    DISPATCHED = "dispatched", "Dispatched"
    IN_TRANSIT = "in_transit", "In Transit"
    DELIVERED = "delivered", "Delivered"
    CANCELLED = "cancelled", "Cancelled"


# Ordered milestones used to draw the progress bar. `cancelled` is terminal and
# deliberately excluded.
ORDER_MILESTONES = [
    OrderStatus.PLACED,
    OrderStatus.CONFIRMED,
    OrderStatus.DISPATCHED,
    OrderStatus.IN_TRANSIT,
    OrderStatus.DELIVERED,
]

# Which transitions a supplier is allowed to make from a given status.
ALLOWED_TRANSITIONS: dict[str, list[str]] = {
    OrderStatus.PLACED: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    OrderStatus.CONFIRMED: [OrderStatus.DISPATCHED, OrderStatus.CANCELLED],
    OrderStatus.DISPATCHED: [OrderStatus.IN_TRANSIT, OrderStatus.CANCELLED],
    OrderStatus.IN_TRANSIT: [OrderStatus.DELIVERED],
    OrderStatus.DELIVERED: [],
    OrderStatus.CANCELLED: [],
}


class PaymentMethod(models.TextChoices):
    BKASH = "bkash", "bKash"
    CARD = "card", "Card"
    COD = "cod", "Cash on Delivery"


class PaymentStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PAID = "paid", "Paid"
    FAILED = "failed", "Failed"
    DUE_ON_DELIVERY = "due_on_delivery", "Due on Delivery"
    REFUNDED = "refunded", "Refunded"


class DeliverySpeed(models.TextChoices):
    STANDARD = "standard", "Standard Delivery"
    EXPRESS = "express", "Express Delivery"


class CancellationStatus(models.TextChoices):
    PENDING = "pending", "Awaiting supplier review"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    WITHDRAWN = "withdrawn", "Withdrawn by buyer"


# --- Cancellation policy -------------------------------------------------
# A buyer may self-cancel while the supplier has not yet confirmed, because
# nothing has been committed on the supplier's side at that point. To stop that
# being abused, only this many self-cancellations are free per calendar month;
# beyond it, even a pre-confirmation cancel becomes a request the supplier
# reviews. Orders cancelled *by the supplier* never count against the buyer.
SELF_CANCEL_LIMIT_PER_MONTH = 2

# Once an order is confirmed the supplier has reserved stock and started
# packing, so cancelling needs their agreement.
SELF_CANCELLABLE_STATUSES = ["placed"]


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Account(TimestampedModel):
    """Local mirror of a Supabase Auth user."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supabase_uid = models.UUIDField(unique=True, db_index=True)
    email = models.EmailField(blank=True)
    full_name = models.CharField(max_length=160, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    avatar_url = models.URLField(blank=True, max_length=500)
    role = models.CharField(max_length=16, choices=Role.choices, blank=True)
    last_login_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.full_name or self.email or self.supabase_uid} ({self.role or 'no role'})"

    # DRF's IsAuthenticated checks this attribute rather than the object itself.
    @property
    def is_authenticated(self) -> bool:
        return True

    @property
    def is_anonymous(self) -> bool:
        return False


class BuyerProfile(TimestampedModel):
    """SME garment shop owner purchasing stocklots."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = models.OneToOneField(
        Account, on_delete=models.CASCADE, related_name="buyer_profile"
    )
    business_name = models.CharField(max_length=160)
    business_type = models.CharField(max_length=120, blank=True)
    contact_phone = models.CharField(max_length=32)
    address = models.TextField()
    district = models.CharField(max_length=80, blank=True)
    # Identity documents are mandatory: a buyer cannot place an order without
    # an NID number and a photo of the card on file.
    nid_number = models.CharField(max_length=40, blank=True)
    nid_document_url = models.URLField(blank=True, max_length=500)
    nid_back_url = models.URLField(blank=True, max_length=500)
    verification_status = models.CharField(
        max_length=16,
        choices=VerificationStatus.choices,
        default=VerificationStatus.UNSUBMITTED,
    )
    rejection_reason = models.CharField(max_length=300, blank=True)

    def __str__(self) -> str:
        return self.business_name

    @property
    def is_verified(self) -> bool:
        return self.verification_status == VerificationStatus.VERIFIED

    @property
    def has_identity_documents(self) -> bool:
        return bool(self.nid_number and self.nid_document_url)

    def self_cancels_this_month(self) -> int:
        """Buyer-initiated cancellations since the 1st of the current month."""
        now = timezone.now()
        return self.orders.filter(
            order_status=OrderStatus.CANCELLED,
            cancelled_by_buyer=True,
            cancelled_at__year=now.year,
            cancelled_at__month=now.month,
        ).count()

    def remaining_self_cancels(self) -> int:
        return max(0, SELF_CANCEL_LIMIT_PER_MONTH - self.self_cancels_this_month())


class SupplierProfile(TimestampedModel):
    """Stocklot wholesaler listing inventory."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = models.OneToOneField(
        Account, on_delete=models.CASCADE, related_name="supplier_profile"
    )
    business_name = models.CharField(max_length=160)
    contact_phone = models.CharField(max_length=32)
    address = models.TextField()
    district = models.CharField(max_length=80, blank=True)
    trade_license_number = models.CharField(max_length=60, blank=True)
    trade_license_document_url = models.URLField(blank=True, max_length=500)
    nid_number = models.CharField(max_length=40, blank=True)
    nid_document_url = models.URLField(blank=True, max_length=500)
    nid_back_url = models.URLField(blank=True, max_length=500)
    about = models.TextField(blank=True)
    verification_status = models.CharField(
        max_length=16,
        choices=VerificationStatus.choices,
        default=VerificationStatus.UNSUBMITTED,
    )
    rejection_reason = models.CharField(max_length=300, blank=True)

    def __str__(self) -> str:
        return self.business_name

    @property
    def is_verified(self) -> bool:
        return self.verification_status == VerificationStatus.VERIFIED

    @property
    def has_identity_documents(self) -> bool:
        return bool(self.nid_number and self.nid_document_url)

    @property
    def rating(self) -> float:
        """Average of delivered-order ratings, 0.0 when never rated."""
        agg = Order.objects.filter(
            product__supplier=self, buyer_rating__isnull=False
        ).aggregate(avg=models.Avg("buyer_rating"))
        return round(agg["avg"] or 0.0, 1)


class Product(TimestampedModel):
    """A stocklot listing."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supplier = models.ForeignKey(
        SupplierProfile, on_delete=models.CASCADE, related_name="products"
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(
        max_length=24, choices=FabricCategory.choices, default=FabricCategory.OTHER
    )
    gsm = models.PositiveIntegerField(
        help_text="Grams per square metre", validators=[MinValueValidator(1)]
    )
    fabric_composition = models.CharField(
        max_length=160, help_text="e.g. 95% Cotton, 5% Elastane"
    )
    sizes_available = models.CharField(
        max_length=160, blank=True, help_text="Comma separated, e.g. S,M,L,XL"
    )
    colors = models.CharField(max_length=160, blank=True)
    available_quantity = models.PositiveIntegerField()
    moq = models.PositiveIntegerField(
        verbose_name="Minimum order quantity", validators=[MinValueValidator(1)]
    )
    unit_price_bdt = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    estimated_transport_cost = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00")
    )

    # --- Delivery options, set per listing by the supplier ---
    free_delivery = models.BooleanField(
        default=False,
        help_text="Supplier absorbs transport. Forces the transport cost to zero.",
    )
    express_delivery_available = models.BooleanField(default=False)
    express_delivery_fee = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00")
    )
    express_delivery_hours = models.PositiveIntegerField(
        default=24, help_text="Guaranteed delivery window when express is chosen."
    )

    images = models.JSONField(
        default=list, blank=True, help_text="List of Supabase Storage public URLs"
    )
    location = models.CharField(max_length=120, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["category"]),
            models.Index(fields=["gsm"]),
            models.Index(fields=["unit_price_bdt"]),
            models.Index(fields=["is_active", "-created_at"]),
        ]

    def __str__(self) -> str:
        return self.title

    def save(self, *args, **kwargs):
        # "Free delivery" is the single source of truth for transport cost.
        if self.free_delivery:
            self.estimated_transport_cost = Decimal("0.00")
        if not self.express_delivery_available:
            self.express_delivery_fee = Decimal("0.00")
        super().save(*args, **kwargs)

    @property
    def thumbnail(self) -> str:
        return self.images[0] if self.images else ""

    @property
    def in_stock(self) -> bool:
        return self.is_active and self.available_quantity >= self.moq


class Order(TimestampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=20, unique=True, db_index=True, blank=True)
    buyer = models.ForeignKey(
        BuyerProfile, on_delete=models.PROTECT, related_name="orders"
    )
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="orders"
    )

    ordered_quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    # Prices are snapshotted so later listing edits never rewrite order history.
    unit_price_bdt = models.DecimalField(max_digits=10, decimal_places=2)
    transport_cost = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00")
    )

    # --- Delivery ---
    delivery_speed = models.CharField(
        max_length=12, choices=DeliverySpeed.choices, default=DeliverySpeed.STANDARD
    )
    express_fee = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00")
    )
    promised_delivery_at = models.DateTimeField(
        null=True, blank=True, help_text="Express orders carry a delivery guarantee."
    )

    total_price = models.DecimalField(max_digits=12, decimal_places=2)

    # --- Platform economics ---
    # Commission is charged on the goods subtotal only, never on transport or
    # the express fee, which are pass-through costs. The rate is stored per
    # order so changing it later never rewrites historical earnings.
    commission_rate = models.DecimalField(
        max_digits=5, decimal_places=4, default=Decimal("0.0200")
    )
    platform_commission = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    supplier_payout = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )

    payment_method = models.CharField(
        max_length=12, choices=PaymentMethod.choices, default=PaymentMethod.COD
    )
    payment_status = models.CharField(
        max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING
    )
    payment_reference = models.CharField(max_length=80, blank=True)

    order_status = models.CharField(
        max_length=16, choices=OrderStatus.choices, default=OrderStatus.PLACED
    )

    delivery_address = models.TextField()
    delivery_district = models.CharField(max_length=80, blank=True)
    contact_person = models.CharField(max_length=120)
    contact_phone = models.CharField(max_length=32)
    notes = models.TextField(blank=True)

    buyer_rating = models.PositiveSmallIntegerField(null=True, blank=True)
    buyer_review = models.TextField(blank=True)

    # --- Cancellation bookkeeping ---
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by_buyer = models.BooleanField(
        default=False,
        help_text="Only buyer-initiated cancellations count against the monthly quota.",
    )
    cancellation_reason = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["order_status", "-created_at"]),
            models.Index(fields=["cancelled_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.reference} - {self.product.title}"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = f"SA-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    @property
    def subtotal(self) -> Decimal:
        return self.unit_price_bdt * self.ordered_quantity

    @property
    def is_express(self) -> bool:
        return self.delivery_speed == DeliverySpeed.EXPRESS

    @property
    def can_self_cancel(self) -> bool:
        """Free cancel: pre-confirmation, and within the monthly quota."""
        return (
            self.order_status in SELF_CANCELLABLE_STATUSES
            and self.buyer.remaining_self_cancels() > 0
        )

    @property
    def needs_cancellation_request(self) -> bool:
        """Past confirmation, or quota exhausted -- the supplier must agree."""
        if self.order_status in (OrderStatus.DELIVERED, OrderStatus.CANCELLED):
            return False
        return not self.can_self_cancel

    @property
    def open_cancellation_request(self):
        return self.cancellation_requests.filter(
            status=CancellationStatus.PENDING
        ).first()

    @property
    def milestone_index(self) -> int:
        """Position on the progress bar; -1 for cancelled orders."""
        if self.order_status == OrderStatus.CANCELLED:
            return -1
        try:
            return ORDER_MILESTONES.index(self.order_status)
        except ValueError:
            return 0

    @property
    def next_statuses(self) -> list[str]:
        return list(ALLOWED_TRANSITIONS.get(self.order_status, []))


class CancellationRequest(TimestampedModel):
    """A buyer asking to cancel an order the supplier has already committed to.

    Raised when the order is past `placed`, or when the buyer has used up their
    free self-cancellations for the month. The supplier (or an admin) resolves
    it; stock stays reserved until they do, so nobody is left guessing.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name="cancellation_requests"
    )
    reason = models.TextField()
    status = models.CharField(
        max_length=12,
        choices=CancellationStatus.choices,
        default=CancellationStatus.PENDING,
    )
    response_note = models.CharField(max_length=300, blank=True)
    resolved_by = models.CharField(max_length=120, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Cancel {self.order.reference} ({self.status})"


class OrderEvent(models.Model):
    """Append-only tracking timeline entry."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="events")
    status = models.CharField(max_length=16, choices=OrderStatus.choices)
    note = models.CharField(max_length=300, blank=True)
    created_by = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.order.reference}: {self.status}"
