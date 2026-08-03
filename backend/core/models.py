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
    nid_number = models.CharField(max_length=40, blank=True)
    nid_document_url = models.URLField(blank=True, max_length=500)
    verification_status = models.CharField(
        max_length=16,
        choices=VerificationStatus.choices,
        default=VerificationStatus.UNSUBMITTED,
    )

    def __str__(self) -> str:
        return self.business_name


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
    about = models.TextField(blank=True)
    verification_status = models.CharField(
        max_length=16,
        choices=VerificationStatus.choices,
        default=VerificationStatus.UNSUBMITTED,
    )

    def __str__(self) -> str:
        return self.business_name

    @property
    def is_verified(self) -> bool:
        return self.verification_status == VerificationStatus.VERIFIED

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
    total_price = models.DecimalField(max_digits=12, decimal_places=2)

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

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["order_status", "-created_at"])]

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
