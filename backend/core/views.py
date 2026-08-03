from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
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
    Account,
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
    """Prototype-only: hand back a token for a seeded demo account.

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
        if self.action in ("list", "retrieve"):
            # Public feed shows live listings only; a supplier still sees their
            # own drafts through /products/mine/.
            return qs.filter(is_active=True)
        supplier = getattr(self.request.user, "supplier_profile", None)
        return qs.filter(supplier=supplier) if supplier else qs.none()

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
        serializer = QuoteSerializer(
            data={"product_id": pk, "quantity": request.data.get("quantity", 1)}
        )
        serializer.is_valid(raise_exception=True)
        if not Product.objects.filter(pk=pk).exists():
            return Response({"detail": "Listing not found."}, status=404)
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

        serializer = OrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        product = data["product"]
        buyer = request.user.buyer_profile

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

            subtotal = locked.unit_price_bdt * qty
            transport = locked.estimated_transport_cost
            order = Order.objects.create(
                buyer=buyer,
                product=locked,
                ordered_quantity=qty,
                unit_price_bdt=locked.unit_price_bdt,
                transport_cost=transport,
                total_price=subtotal + transport,
                payment_method=data["payment_method"],
                delivery_address=data["delivery_address"],
                delivery_district=data.get("delivery_district", ""),
                contact_person=data["contact_person"],
                contact_phone=data["contact_phone"],
                notes=data.get("notes", ""),
            )

            locked.available_quantity -= qty
            if locked.available_quantity < locked.moq:
                locked.is_active = False
            locked.save(update_fields=["available_quantity", "is_active", "updated_at"])

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
                # Return the reserved quantity to the lot.
                product = Product.objects.select_for_update().get(pk=order.product_id)
                product.available_quantity += order.ordered_quantity
                if product.available_quantity >= product.moq:
                    product.is_active = True
                product.save(
                    update_fields=["available_quantity", "is_active", "updated_at"]
                )
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
        """Buyer may back out only before the supplier confirms."""
        order = Order.objects.filter(pk=pk, buyer=request.user.buyer_profile).first()
        if not order:
            return Response({"detail": "Order not found."}, status=404)
        if order.order_status != OrderStatus.PLACED:
            raise ValidationError(
                {"detail": "This order is already being processed. Contact the supplier."}
            )

        with transaction.atomic():
            product = Product.objects.select_for_update().get(pk=order.product_id)
            product.available_quantity += order.ordered_quantity
            if product.available_quantity >= product.moq:
                product.is_active = True
            product.save(update_fields=["available_quantity", "is_active", "updated_at"])

            order.order_status = OrderStatus.CANCELLED
            if order.payment_status == PaymentStatus.PAID:
                order.payment_status = PaymentStatus.REFUNDED
            order.save(update_fields=["order_status", "payment_status", "updated_at"])
            OrderEvent.objects.create(
                order=order,
                status=OrderStatus.CANCELLED,
                note="Cancelled by buyer.",
                created_by=request.user.buyer_profile.business_name,
            )

        return Response(OrderSerializer(order).data)

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

    revenue = orders.filter(
        payment_status__in=[PaymentStatus.PAID]
    ).aggregate(total=Sum("total_price"))["total"] or Decimal("0")

    return Response(
        {
            "active_listings": products.filter(is_active=True).count(),
            "total_listings": products.count(),
            "units_in_stock": products.aggregate(n=Sum("available_quantity"))["n"] or 0,
            "total_orders": orders.count(),
            "pending_action": orders.filter(
                order_status__in=[OrderStatus.PLACED, OrderStatus.CONFIRMED]
            ).count(),
            "in_transit": orders.filter(
                order_status__in=[OrderStatus.DISPATCHED, OrderStatus.IN_TRANSIT]
            ).count(),
            "delivered": orders.filter(order_status=OrderStatus.DELIVERED).count(),
            "revenue_bdt": str(revenue),
            "rating": supplier.rating,
            "verification_status": supplier.verification_status,
            "low_stock": ProductSerializer(
                products.filter(is_active=True).order_by("available_quantity")[:5],
                many=True,
            ).data,
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
            "verification_status": buyer.verification_status,
        }
    )


# -------------------------------------------------------------------- uploads


class UploadView(APIView):
    """Proxy an image upload into Supabase Storage.

    Going through the server means the demo does not depend on Storage RLS
    policies being set up correctly in the dashboard.
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

        folder = request.data.get("folder", "listings")
        url = upload_to_supabase(file_obj, folder=str(folder))
        return Response({"url": url}, status=status.HTTP_201_CREATED)
