from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Case, Count, F, IntegerField, Q, Sum, Value, When
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .filters import ProductFilter
from .models import (
    ALLOWED_TRANSITIONS,
    ORDER_MILESTONES,
    SELF_CANCEL_LIMIT_PER_MONTH,
    Account,
    CancellationRequest,
    CancellationStatus,
    DeliverySpeed,
    FabricCategory,
    Order,
    OrderEvent,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    Product,
    Role,
    SupplierProfile,
)
from .payments import get_provider
from .permissions import IsBuyer, IsSupplier, IsSupplierOrReadOnly
from .serializers import (
    AccountSerializer,
    BuyerProfileSerializer,
    CancellationRequestCreateSerializer,
    CancellationRequestSerializer,
    CancellationResolveSerializer,
    OrderCreateSerializer,
    OrderReviewSerializer,
    OrderSerializer,
    OrderStatusUpdateSerializer,
    ProductSerializer,
    QuoteSerializer,
    RoleSelectSerializer,
    SupplierProfileSerializer,
    SupplierPublicSerializer,
)
from .storage import upload_to_supabase

TWO_PLACES = Decimal("0.01")


def money(value) -> Decimal:
    return Decimal(value).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def _release_stock(order) -> None:
    """Put a cancelled order's quantity back into the lot.

    Deliberately does not touch `is_active`: restoring stock must never
    republish a listing the supplier chose to pause.
    """
    product = Product.objects.select_for_update().get(pk=order.product_id)
    product.available_quantity += order.ordered_quantity
    product.save(update_fields=["available_quantity", "updated_at"])


def _cancel_order(order, *, by_buyer: bool, reason: str, actor: str, note: str = "") -> None:
    """Cancel an order, restock the lot and flag any refund.

    `by_buyer` decides whether this counts against the buyer's monthly free
    cancellation quota. Supplier-initiated cancellations and approved
    cancellation requests both pass False.
    """
    _release_stock(order)

    order.order_status = OrderStatus.CANCELLED
    order.cancelled_at = timezone.now()
    order.cancelled_by_buyer = by_buyer
    order.cancellation_reason = reason
    fields = [
        "order_status",
        "cancelled_at",
        "cancelled_by_buyer",
        "cancellation_reason",
        "updated_at",
    ]

    if order.payment_status == PaymentStatus.PAID:
        order.payment_status = PaymentStatus.REFUNDED
        fields.append("payment_status")

    # A cancelled order earns the platform nothing.
    order.platform_commission = Decimal("0.00")
    order.supplier_payout = Decimal("0.00")
    fields += ["platform_commission", "supplier_payout"]

    order.save(update_fields=fields)
    OrderEvent.objects.create(
        order=order,
        status=OrderStatus.CANCELLED,
        note=note or reason,
        created_by=actor,
    )

DISTRICTS = [
    "Dhaka", "Chattogram", "Narayanganj", "Gazipur", "Savar", "Narsingdi",
    "Cumilla", "Khulna", "Rajshahi", "Sylhet", "Bogura", "Mymensingh",
]


# ---------------------------------------------------------------- meta / auth


@api_view(["GET"])
@permission_classes([AllowAny])
def meta(request):
    """Static choices the frontend needs to render filters and forms."""
    return Response(
        {
            "categories": [
                {"value": v, "label": l} for v, l in FabricCategory.choices
            ],
            "districts": DISTRICTS,
            "order_statuses": [{"value": v, "label": l} for v, l in OrderStatus.choices],
            "order_milestones": [
                {"value": s.value, "label": s.label} for s in ORDER_MILESTONES
            ],
            "payment_methods": [
                {"value": v, "label": l} for v, l in PaymentMethod.choices
            ],
            "delivery_speeds": [
                {"value": v, "label": l} for v, l in DeliverySpeed.choices
            ],
            "commission_rate": str(settings.PLATFORM_COMMISSION_RATE),
            "self_cancel_limit_per_month": SELF_CANCEL_LIMIT_PER_MONTH,
            "payment_mode": settings.PAYMENT_MODE,
            "dev_login_enabled": settings.ENABLE_DEV_LOGIN,
        }
    )


@api_view(["GET"])
def me(request):
    """Everything the frontend needs to bootstrap a session."""
    account = request.user
    data = AccountSerializer(account).data
    buyer = getattr(account, "buyer_profile", None)
    supplier = getattr(account, "supplier_profile", None)
    data["buyer_profile"] = BuyerProfileSerializer(buyer).data if buyer else None
    data["supplier_profile"] = (
        SupplierProfileSerializer(supplier).data if supplier else None
    )
    return Response(data)


@api_view(["POST"])
def select_role(request):
    """First-login step: is this account a buyer or a supplier?"""
    serializer = RoleSelectSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    account = request.user

    new_role = serializer.validated_data["role"]
    if account.role and account.role != new_role:
        raise ValidationError(
            {"role": f"This account is already registered as a {account.role}."}
        )

    account.role = new_role
    account.save(update_fields=["role", "updated_at"])
    return Response(AccountSerializer(account).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def dev_login(request):
    """Local development only: hand back a token for a seeded demo account.

    Gated on ENABLE_DEV_LOGIN so it disappears outside local development. Lets
    the app be demoed even if Google OAuth is misconfigured on the day.
    """
    if not settings.ENABLE_DEV_LOGIN:
        return Response(
            {"detail": "Dev login is disabled."}, status=status.HTTP_403_FORBIDDEN
        )

    email = (request.data.get("email") or "").strip().lower()
    account = Account.objects.filter(email__iexact=email).first()
    if not account:
        return Response(
            {"detail": f"No seeded account for '{email}'. Run `manage.py seed_demo`."},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(
        {
            "access_token": f"dev:{account.supabase_uid}",
            "account": AccountSerializer(account).data,
        }
    )


# ------------------------------------------------------------------- profiles


class BuyerProfileView(APIView):
    """Buyer's own onboarding profile."""

    def get(self, request):
        profile = getattr(request.user, "buyer_profile", None)
        if not profile:
            return Response({"detail": "No buyer profile yet."}, status=404)
        return Response(BuyerProfileSerializer(profile).data)

    def put(self, request):
        account = request.user
        if account.role and account.role != Role.BUYER:
            raise PermissionDenied("This account is registered as a supplier.")

        profile = getattr(account, "buyer_profile", None)
        serializer = BuyerProfileSerializer(profile, data=request.data, partial=bool(profile))
        serializer.is_valid(raise_exception=True)
        profile = serializer.save(account=account)

        if not account.role:
            account.role = Role.BUYER
            account.save(update_fields=["role", "updated_at"])
        return Response(BuyerProfileSerializer(profile).data)


class SupplierProfileView(APIView):
    """Supplier's own business profile and verification submission."""

    def get(self, request):
        profile = getattr(request.user, "supplier_profile", None)
        if not profile:
            return Response({"detail": "No supplier profile yet."}, status=404)
        return Response(SupplierProfileSerializer(profile).data)

    def put(self, request):
        account = request.user
        if account.role and account.role != Role.SUPPLIER:
            raise PermissionDenied("This account is registered as a buyer.")

        profile = getattr(account, "supplier_profile", None)
        serializer = SupplierProfileSerializer(
            profile, data=request.data, partial=bool(profile)
        )
        serializer.is_valid(raise_exception=True)
        profile = serializer.save(account=account)

        # Submitting a trade licence moves the badge into the review queue.
        if profile.trade_license_number and profile.verification_status in (
            "unsubmitted",
            "rejected",
        ):
            profile.verification_status = "pending"
            profile.save(update_fields=["verification_status", "updated_at"])

        if not account.role:
            account.role = Role.SUPPLIER
            account.save(update_fields=["role", "updated_at"])
        return Response(SupplierProfileSerializer(profile).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def supplier_public(request, supplier_id):
    try:
        supplier = SupplierProfile.objects.get(pk=supplier_id)
    except SupplierProfile.DoesNotExist:
        return Response({"detail": "Supplier not found."}, status=404)

    data = SupplierPublicSerializer(supplier).data
    data["listings"] = ProductSerializer(
        supplier.products.filter(is_active=True), many=True
    ).data
    return Response(data)


# ------------------------------------------------------------------- products


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsSupplierOrReadOnly]
    filterset_class = ProductFilter
    search_fields = ["title", "description", "fabric_composition", "supplier__business_name"]
    ordering_fields = ["created_at", "unit_price_bdt", "moq", "gsm", "available_quantity"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = Product.objects.select_related("supplier", "supplier__account")
        # request.user is None for anonymous visitors, so guard the lookup.
        supplier = getattr(self.request.user, "supplier_profile", None)

        if self.action == "list":
            # Published lots, including sold-out ones. They are badged in the
            # UI and sorted last rather than hidden, so buyers can tell the
            # difference between "gone" and "temporarily unavailable".
            return qs.filter(is_active=True).annotate(
                sold_out=Case(
                    When(available_quantity__lt=F("moq"), then=Value(1)),
                    default=Value(0),
                    output_field=IntegerField(),
                )
            )

        if self.action == "retrieve":
            # A supplier can always open their own listing, whether paused or
            # sold out -- otherwise they could never edit it back into stock.
            if supplier:
                return qs.filter(Q(is_active=True) | Q(supplier=supplier))
            return qs.filter(is_active=True)

        return qs.filter(supplier=supplier) if supplier else qs.none()

    def filter_queryset(self, queryset):
        qs = super().filter_queryset(queryset)
        if self.action != "list":
            return qs
        # Whatever sort the buyer picked, sold-out lots sink to the bottom.
        requested = self.request.query_params.get("ordering") or "-created_at"
        if requested.lstrip("-") not in self.ordering_fields:
            requested = "-created_at"
        return qs.order_by("sold_out", requested)

    def get_permissions(self):
        if self.action in ("list", "retrieve", "quote"):
            return [AllowAny()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(supplier=self.request.user.supplier_profile)

    def perform_destroy(self, instance):
        # Listings referenced by orders are protected; soft-delete instead.
        if instance.orders.exists():
            instance.is_active = False
            instance.save(update_fields=["is_active", "updated_at"])
        else:
            instance.delete()

    @action(detail=False, methods=["get"], permission_classes=[IsSupplier])
    def mine(self, request):
        qs = Product.objects.filter(
            supplier=request.user.supplier_profile
        ).select_related("supplier").order_by("-created_at")
        return Response(ProductSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"], permission_classes=[AllowAny])
    def quote(self, request, pk=None):
        """Server-side fee calculation, so the buyer's total is authoritative."""
        if not Product.objects.filter(pk=pk).exists():
            return Response({"detail": "Listing not found."}, status=404)

        serializer = QuoteSerializer(
            data={
                "product_id": pk,
                "quantity": request.data.get("quantity", 1),
                "delivery_speed": request.data.get(
                    "delivery_speed", DeliverySpeed.STANDARD
                ),
            }
        )
        serializer.is_valid(raise_exception=True)
        return Response(serializer.to_quote())


# --------------------------------------------------------------------- orders


class OrderViewSet(viewsets.GenericViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def _visible_orders(self):
        """Orders this account may see: their purchases, or sales on their lots."""
        account = self.request.user
        qs = Order.objects.select_related(
            "product", "product__supplier", "buyer"
        ).prefetch_related("events")

        buyer = getattr(account, "buyer_profile", None)
        supplier = getattr(account, "supplier_profile", None)
        if buyer:
            return qs.filter(buyer=buyer)
        if supplier:
            return qs.filter(product__supplier=supplier)
        return qs.none()

    def list(self, request):
        qs = self._visible_orders()
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(order_status__in=status_filter.split(","))
        return Response(OrderSerializer(qs, many=True).data)

    def retrieve(self, request, pk=None):
        order = self._visible_orders().filter(pk=pk).first()
        if not order:
            return Response({"detail": "Order not found."}, status=404)
        return Response(OrderSerializer(order).data)

    def create(self, request):
        """Place an order and take payment in one step."""
        if not IsBuyer().has_permission(request, self):
            raise PermissionDenied("Complete your buyer profile before ordering.")

        buyer = request.user.buyer_profile
        # Identity documents are mandatory before any money moves.
        if not buyer.has_identity_documents:
            raise PermissionDenied(
                "Add your NID number and a photo of your NID card before ordering."
            )

        serializer = OrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        product = data["product"]

        if product.supplier.account_id == request.user.id:
            raise ValidationError({"detail": "You cannot order your own listing."})

        with transaction.atomic():
            # Re-read under lock so two buyers can't oversell the same lot.
            locked = Product.objects.select_for_update().get(pk=product.pk)
            qty = data["ordered_quantity"]
            if qty > locked.available_quantity:
                raise ValidationError(
                    {"ordered_quantity": f"Only {locked.available_quantity} pcs left."}
                )

            express = (
                data["delivery_speed"] == DeliverySpeed.EXPRESS
                and locked.express_delivery_available
            )

            subtotal = money(locked.unit_price_bdt * qty)
            transport = money(locked.estimated_transport_cost)
            express_fee = money(locked.express_delivery_fee) if express else Decimal("0.00")

            # Commission applies to the goods value only. Transport and the
            # express fee are pass-through costs, so taking a cut of them would
            # penalise suppliers for delivering further or faster.
            rate = Decimal(settings.PLATFORM_COMMISSION_RATE)
            commission = money(subtotal * rate)

            order = Order.objects.create(
                buyer=buyer,
                product=locked,
                ordered_quantity=qty,
                unit_price_bdt=locked.unit_price_bdt,
                transport_cost=transport,
                delivery_speed=(
                    DeliverySpeed.EXPRESS if express else DeliverySpeed.STANDARD
                ),
                express_fee=express_fee,
                promised_delivery_at=(
                    timezone.now() + timedelta(hours=locked.express_delivery_hours)
                    if express
                    else None
                ),
                total_price=subtotal + transport + express_fee,
                commission_rate=rate,
                platform_commission=commission,
                supplier_payout=money(subtotal - commission + transport + express_fee),
                payment_method=data["payment_method"],
                delivery_address=data["delivery_address"],
                delivery_district=data.get("delivery_district", ""),
                contact_person=data["contact_person"],
                contact_phone=data["contact_phone"],
                notes=data.get("notes", ""),
            )

            # Selling out does not unpublish the lot. It stays listed and
            # reports itself as sold out, so buyers can see what happened and
            # the supplier can still open it to restock.
            locked.available_quantity -= qty
            locked.save(update_fields=["available_quantity", "updated_at"])

            result = get_provider().charge(
                method=order.payment_method,
                amount=order.total_price,
                order_reference=order.reference,
            )
            order.payment_status = result.status
            order.payment_reference = result.reference
            order.save(update_fields=["payment_status", "payment_reference", "updated_at"])

            OrderEvent.objects.create(
                order=order,
                status=OrderStatus.PLACED,
                note=result.message,
                created_by=buyer.business_name,
            )

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], permission_classes=[IsSupplier])
    def incoming(self, request):
        qs = (
            Order.objects.filter(product__supplier=request.user.supplier_profile)
            .select_related("product", "buyer")
            .prefetch_related("events")
        )
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(order_status__in=status_filter.split(","))
        return Response(OrderSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"], url_path="status")
    def update_status(self, request, pk=None):
        """Supplier's dispatch controller."""
        supplier = getattr(request.user, "supplier_profile", None)
        if not supplier:
            raise PermissionDenied("Only the supplier can move an order forward.")

        order = Order.objects.filter(pk=pk, product__supplier=supplier).first()
        if not order:
            return Response({"detail": "Order not found."}, status=404)

        serializer = OrderStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data["status"]

        allowed = ALLOWED_TRANSITIONS.get(order.order_status, [])
        if new_status not in allowed:
            raise ValidationError(
                {
                    "status": (
                        f"Cannot go from '{order.get_order_status_display()}' to "
                        f"'{new_status}'. Allowed: {', '.join(allowed) or 'none'}."
                    )
                }
            )

        with transaction.atomic():
            order.order_status = new_status
            fields = ["order_status", "updated_at"]

            if new_status == OrderStatus.DELIVERED and order.payment_method == PaymentMethod.COD:
                order.payment_status = PaymentStatus.PAID
                fields.append("payment_status")

            if new_status == OrderStatus.CANCELLED:
                _release_stock(order)
                order.cancelled_at = timezone.now()
                # Supplier-initiated: never counts against the buyer's quota.
                order.cancelled_by_buyer = False
                order.cancellation_reason = serializer.validated_data.get("note", "")
                fields += ["cancelled_at", "cancelled_by_buyer", "cancellation_reason"]
                if order.payment_status == PaymentStatus.PAID:
                    order.payment_status = PaymentStatus.REFUNDED
                    fields.append("payment_status")

            order.save(update_fields=list(dict.fromkeys(fields)))
            OrderEvent.objects.create(
                order=order,
                status=new_status,
                note=serializer.validated_data.get("note", ""),
                created_by=supplier.business_name,
            )

        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=["post"], permission_classes=[IsBuyer])
    def cancel(self, request, pk=None):
        """Free self-cancel: pre-confirmation, within the monthly quota.

        Anything else has to go through `request_cancellation` so the supplier
        gets a say.
        """
        buyer = request.user.buyer_profile
        order = Order.objects.filter(pk=pk, buyer=buyer).first()
        if not order:
            return Response({"detail": "Order not found."}, status=404)

        if order.order_status != OrderStatus.PLACED:
            raise ValidationError(
                {
                    "detail": (
                        "The supplier has already started on this order. Submit a "
                        "cancellation request and they will review it."
                    )
                }
            )
        if buyer.remaining_self_cancels() <= 0:
            raise ValidationError(
                {
                    "detail": (
                        f"You have used all {SELF_CANCEL_LIMIT_PER_MONTH} free "
                        "cancellations this month. Submit a cancellation request "
                        "instead and the supplier will review it."
                    )
                }
            )

        with transaction.atomic():
            _cancel_order(
                order,
                by_buyer=True,
                reason=request.data.get("reason", "Cancelled by buyer."),
                actor=buyer.business_name,
            )

        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=["post"], url_path="cancellation-request",
            permission_classes=[IsBuyer])
    def request_cancellation(self, request, pk=None):
        """Ask the supplier to cancel an order that is already under way."""
        buyer = request.user.buyer_profile
        order = Order.objects.filter(pk=pk, buyer=buyer).first()
        if not order:
            return Response({"detail": "Order not found."}, status=404)

        if order.order_status in (OrderStatus.DELIVERED, OrderStatus.CANCELLED):
            raise ValidationError(
                {"detail": "This order is already closed and cannot be cancelled."}
            )
        if order.open_cancellation_request:
            raise ValidationError(
                {"detail": "You already have a cancellation request awaiting review."}
            )

        serializer = CancellationRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            cancellation = CancellationRequest.objects.create(
                order=order, reason=serializer.validated_data["reason"]
            )
            OrderEvent.objects.create(
                order=order,
                status=order.order_status,
                note=f"Buyer requested cancellation: {cancellation.reason}",
                created_by=buyer.business_name,
            )

        return Response(
            CancellationRequestSerializer(cancellation).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="cancellation-request/withdraw",
            permission_classes=[IsBuyer])
    def withdraw_cancellation(self, request, pk=None):
        buyer = request.user.buyer_profile
        order = Order.objects.filter(pk=pk, buyer=buyer).first()
        if not order:
            return Response({"detail": "Order not found."}, status=404)

        pending = order.open_cancellation_request
        if not pending:
            raise ValidationError({"detail": "No cancellation request is open."})

        pending.status = CancellationStatus.WITHDRAWN
        pending.resolved_at = timezone.now()
        pending.resolved_by = buyer.business_name
        pending.save(update_fields=["status", "resolved_at", "resolved_by", "updated_at"])

        OrderEvent.objects.create(
            order=order,
            status=order.order_status,
            note="Buyer withdrew the cancellation request.",
            created_by=buyer.business_name,
        )
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=["post"], url_path="cancellation-request/resolve",
            permission_classes=[IsSupplier])
    def resolve_cancellation(self, request, pk=None):
        """Supplier approves or rejects a buyer's cancellation request."""
        supplier = request.user.supplier_profile
        order = Order.objects.filter(pk=pk, product__supplier=supplier).first()
        if not order:
            return Response({"detail": "Order not found."}, status=404)

        pending = order.open_cancellation_request
        if not pending:
            raise ValidationError({"detail": "No cancellation request is open."})

        serializer = CancellationResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        approve = serializer.validated_data["approve"]
        note = serializer.validated_data.get("note", "")

        with transaction.atomic():
            pending.status = (
                CancellationStatus.APPROVED if approve else CancellationStatus.REJECTED
            )
            pending.response_note = note
            pending.resolved_by = supplier.business_name
            pending.resolved_at = timezone.now()
            pending.save(
                update_fields=[
                    "status", "response_note", "resolved_by", "resolved_at", "updated_at",
                ]
            )

            if approve:
                # Approved on the buyer's behalf, so it does not count against
                # their monthly quota -- the supplier agreed it was reasonable.
                _cancel_order(
                    order,
                    by_buyer=False,
                    reason=pending.reason,
                    actor=supplier.business_name,
                    note=note or "Cancellation request approved by supplier.",
                )
            else:
                OrderEvent.objects.create(
                    order=order,
                    status=order.order_status,
                    note=note or "Supplier declined the cancellation request.",
                    created_by=supplier.business_name,
                )

        return Response(OrderSerializer(order).data)

    @action(detail=False, methods=["get"], url_path="cancellation-requests",
            permission_classes=[IsSupplier])
    def cancellation_queue(self, request):
        """Every cancellation request raised against this supplier's orders."""
        qs = CancellationRequest.objects.filter(
            order__product__supplier=request.user.supplier_profile
        ).select_related("order", "order__buyer", "order__product")

        if request.query_params.get("status"):
            qs = qs.filter(status__in=request.query_params["status"].split(","))
        return Response(CancellationRequestSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"], permission_classes=[IsBuyer])
    def review(self, request, pk=None):
        order = Order.objects.filter(pk=pk, buyer=request.user.buyer_profile).first()
        if not order:
            return Response({"detail": "Order not found."}, status=404)
        if order.order_status != OrderStatus.DELIVERED:
            raise ValidationError({"detail": "You can review an order once it is delivered."})

        serializer = OrderReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order.buyer_rating = serializer.validated_data["rating"]
        order.buyer_review = serializer.validated_data.get("review", "")
        order.save(update_fields=["buyer_rating", "buyer_review", "updated_at"])
        return Response(OrderSerializer(order).data)


# ------------------------------------------------------------------ dashboard


@api_view(["GET"])
@permission_classes([IsSupplier])
def supplier_dashboard(request):
    supplier = request.user.supplier_profile
    orders = Order.objects.filter(product__supplier=supplier)
    products = Product.objects.filter(supplier=supplier)

    # Earnings only count orders that actually completed and were paid for.
    earned = orders.filter(
        payment_status=PaymentStatus.PAID
    ).exclude(order_status=OrderStatus.CANCELLED)

    totals = earned.aggregate(
        gross=Sum("total_price"),
        commission=Sum("platform_commission"),
        payout=Sum("supplier_payout"),
    )
    gross = totals["gross"] or Decimal("0")
    commission = totals["commission"] or Decimal("0")
    payout = totals["payout"] or Decimal("0")

    # Current calendar month, which is the billing period for commission.
    now = timezone.now()
    month = earned.filter(created_at__year=now.year, created_at__month=now.month).aggregate(
        gross=Sum("total_price"),
        commission=Sum("platform_commission"),
        payout=Sum("supplier_payout"),
    )

    return Response(
        {
            "active_listings": products.filter(is_active=True).count(),
            "total_listings": products.count(),
            "sold_out_listings": products.filter(
                is_active=True, available_quantity__lt=F("moq")
            ).count(),
            "units_in_stock": products.aggregate(n=Sum("available_quantity"))["n"] or 0,
            "total_orders": orders.count(),
            "pending_action": orders.filter(
                order_status__in=[OrderStatus.PLACED, OrderStatus.CONFIRMED]
            ).count(),
            "in_transit": orders.filter(
                order_status__in=[OrderStatus.DISPATCHED, OrderStatus.IN_TRANSIT]
            ).count(),
            "delivered": orders.filter(order_status=OrderStatus.DELIVERED).count(),
            "open_cancellation_requests": CancellationRequest.objects.filter(
                order__product__supplier=supplier, status=CancellationStatus.PENDING
            ).count(),
            "revenue_bdt": str(gross),
            "commission_bdt": str(commission),
            "net_payout_bdt": str(payout),
            "commission_rate": str(settings.PLATFORM_COMMISSION_RATE),
            "this_month": {
                "gross_bdt": str(month["gross"] or Decimal("0")),
                "commission_bdt": str(month["commission"] or Decimal("0")),
                "net_payout_bdt": str(month["payout"] or Decimal("0")),
                "label": now.strftime("%B %Y"),
            },
            "rating": supplier.rating,
            "verification_status": supplier.verification_status,
            "low_stock": ProductSerializer(
                products.filter(is_active=True).order_by("available_quantity")[:5],
                many=True,
            ).data,
        }
    )


@api_view(["GET"])
@permission_classes([IsSupplier])
def supplier_earnings(request):
    """Month-by-month statement: gross, platform commission, net payout."""
    supplier = request.user.supplier_profile
    rows = (
        Order.objects.filter(
            product__supplier=supplier, payment_status=PaymentStatus.PAID
        )
        .exclude(order_status=OrderStatus.CANCELLED)
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(
            orders=Count("id"),
            gross=Sum("total_price"),
            commission=Sum("platform_commission"),
            payout=Sum("supplier_payout"),
            units=Sum("ordered_quantity"),
        )
        .order_by("-month")
    )

    statement = [
        {
            "month": row["month"].strftime("%Y-%m"),
            "label": row["month"].strftime("%B %Y"),
            "orders": row["orders"],
            "units": row["units"] or 0,
            "gross_bdt": str(row["gross"] or Decimal("0")),
            "commission_bdt": str(row["commission"] or Decimal("0")),
            "net_payout_bdt": str(row["payout"] or Decimal("0")),
        }
        for row in rows
    ]

    return Response(
        {
            "commission_rate": str(settings.PLATFORM_COMMISSION_RATE),
            "months": statement,
        }
    )


@api_view(["GET"])
@permission_classes([IsBuyer])
def buyer_dashboard(request):
    buyer = request.user.buyer_profile
    orders = Order.objects.filter(buyer=buyer)
    spend = orders.exclude(order_status=OrderStatus.CANCELLED).aggregate(
        total=Sum("total_price")
    )["total"] or Decimal("0")

    return Response(
        {
            "total_orders": orders.count(),
            "active_orders": orders.exclude(
                order_status__in=[OrderStatus.DELIVERED, OrderStatus.CANCELLED]
            ).count(),
            "delivered": orders.filter(order_status=OrderStatus.DELIVERED).count(),
            "total_spend_bdt": str(spend),
            "units_bought": orders.exclude(
                order_status=OrderStatus.CANCELLED
            ).aggregate(n=Sum("ordered_quantity"))["n"] or 0,
            "express_orders": orders.filter(
                delivery_speed=DeliverySpeed.EXPRESS
            ).count(),
            "verification_status": buyer.verification_status,
            "has_identity_documents": buyer.has_identity_documents,
            "remaining_self_cancels": buyer.remaining_self_cancels(),
            "self_cancel_limit": SELF_CANCEL_LIMIT_PER_MONTH,
            "open_cancellation_requests": CancellationRequest.objects.filter(
                order__buyer=buyer, status=CancellationStatus.PENDING
            ).count(),
        }
    )


# -------------------------------------------------------------------- uploads


#: Storage folders the frontend writes to. The folder comes from the client,
#: so it is checked against this list rather than used as a path directly.
UPLOAD_FOLDERS = {"listings", "documents"}


class UploadView(APIView):
    """Proxy an image upload into Supabase Storage.

    Going through the server keeps the service key off the browser, and means
    uploads do not depend on Storage RLS policies set up in the dashboard.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        file_obj = request.FILES.get("file")
        if not file_obj:
            raise ValidationError({"file": "No file was uploaded."})
        if file_obj.size > 5 * 1024 * 1024:
            raise ValidationError({"file": "Images must be 5 MB or smaller."})
        if not (file_obj.content_type or "").startswith("image/"):
            raise ValidationError({"file": "Only image files are accepted."})

        folder = str(request.data.get("folder", "listings"))
        if folder not in UPLOAD_FOLDERS:
            raise ValidationError({"folder": "Unknown upload folder."})
        url = upload_to_supabase(file_obj, folder=folder)
        return Response({"url": url}, status=status.HTTP_201_CREATED)
