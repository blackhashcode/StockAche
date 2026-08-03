from decimal import Decimal

from django.conf import settings
from rest_framework import serializers

from .models import (
    Account,
    BuyerProfile,
    CancellationRequest,
    DeliverySpeed,
    Order,
    OrderEvent,
    OrderStatus,
    PaymentMethod,
    Product,
    Role,
    SupplierProfile,
)


class AccountSerializer(serializers.ModelSerializer):
    has_buyer_profile = serializers.SerializerMethodField()
    has_supplier_profile = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = [
            "id",
            "supabase_uid",
            "email",
            "full_name",
            "phone",
            "avatar_url",
            "role",
            "has_buyer_profile",
            "has_supplier_profile",
            "created_at",
        ]
        read_only_fields = ["id", "supabase_uid", "email", "created_at"]

    def get_has_buyer_profile(self, obj) -> bool:
        return hasattr(obj, "buyer_profile")

    def get_has_supplier_profile(self, obj) -> bool:
        return hasattr(obj, "supplier_profile")


class BuyerProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="account.email", read_only=True)
    full_name = serializers.CharField(source="account.full_name", read_only=True)
    is_verified = serializers.BooleanField(read_only=True)
    has_identity_documents = serializers.BooleanField(read_only=True)
    remaining_self_cancels = serializers.SerializerMethodField()

    class Meta:
        model = BuyerProfile
        fields = [
            "id",
            "business_name",
            "business_type",
            "contact_phone",
            "address",
            "district",
            "nid_number",
            "nid_document_url",
            "nid_back_url",
            "verification_status",
            "rejection_reason",
            "is_verified",
            "has_identity_documents",
            "remaining_self_cancels",
            "email",
            "full_name",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "verification_status",
            "rejection_reason",
            "is_verified",
            "created_at",
        ]

    def get_remaining_self_cancels(self, obj) -> int:
        return obj.remaining_self_cancels()

    def validate_nid_number(self, value):
        digits = "".join(ch for ch in value if ch.isdigit())
        # Bangladeshi NIDs are 10, 13 or 17 digits.
        if len(digits) not in (10, 13, 17):
            raise serializers.ValidationError(
                "A Bangladeshi NID is 10, 13 or 17 digits."
            )
        return value

    def validate(self, attrs):
        """Identity documents are mandatory for buyers."""
        merged = {**({} if not self.instance else self._instance_values()), **attrs}
        if not merged.get("nid_number"):
            raise serializers.ValidationError(
                {"nid_number": "Your NID number is required to trade on StockAche."}
            )
        if not merged.get("nid_document_url"):
            raise serializers.ValidationError(
                {
                    "nid_document_url": (
                        "A photo of the front of your NID card is required."
                    )
                }
            )
        return attrs

    def _instance_values(self) -> dict:
        return {
            "nid_number": self.instance.nid_number,
            "nid_document_url": self.instance.nid_document_url,
        }


class SupplierProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="account.email", read_only=True)
    full_name = serializers.CharField(source="account.full_name", read_only=True)
    is_verified = serializers.BooleanField(read_only=True)
    has_identity_documents = serializers.BooleanField(read_only=True)
    rating = serializers.FloatField(read_only=True)

    class Meta:
        model = SupplierProfile
        fields = [
            "id",
            "business_name",
            "contact_phone",
            "address",
            "district",
            "trade_license_number",
            "trade_license_document_url",
            "nid_number",
            "nid_document_url",
            "nid_back_url",
            "about",
            "verification_status",
            "rejection_reason",
            "is_verified",
            "has_identity_documents",
            "rating",
            "email",
            "full_name",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "verification_status",
            "rejection_reason",
            "is_verified",
            "rating",
            "created_at",
        ]

    def validate_nid_number(self, value):
        digits = "".join(ch for ch in value if ch.isdigit())
        if len(digits) not in (10, 13, 17):
            raise serializers.ValidationError(
                "A Bangladeshi NID is 10, 13 or 17 digits."
            )
        return value

    def validate(self, attrs):
        """A supplier cannot list stock without identity documents on file."""
        current = {
            "nid_number": getattr(self.instance, "nid_number", ""),
            "nid_document_url": getattr(self.instance, "nid_document_url", ""),
        }
        merged = {**current, **attrs}
        if not merged.get("nid_number"):
            raise serializers.ValidationError(
                {"nid_number": "Your NID number is required to sell on StockAche."}
            )
        if not merged.get("nid_document_url"):
            raise serializers.ValidationError(
                {
                    "nid_document_url": (
                        "A photo of the front of your NID card is required."
                    )
                }
            )
        return attrs


class SupplierPublicSerializer(serializers.ModelSerializer):
    """What a buyer is allowed to see about a supplier."""

    is_verified = serializers.BooleanField(read_only=True)
    rating = serializers.FloatField(read_only=True)

    class Meta:
        model = SupplierProfile
        fields = [
            "id",
            "business_name",
            "district",
            "about",
            "is_verified",
            "verification_status",
            "rating",
            "created_at",
        ]


class ProductSerializer(serializers.ModelSerializer):
    supplier = SupplierPublicSerializer(read_only=True)
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    thumbnail = serializers.CharField(read_only=True)
    in_stock = serializers.BooleanField(read_only=True)
    total_at_moq = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "supplier",
            "title",
            "description",
            "category",
            "category_label",
            "gsm",
            "fabric_composition",
            "sizes_available",
            "colors",
            "available_quantity",
            "moq",
            "unit_price_bdt",
            "estimated_transport_cost",
            "free_delivery",
            "express_delivery_available",
            "express_delivery_fee",
            "express_delivery_hours",
            "images",
            "thumbnail",
            "location",
            "is_active",
            "in_stock",
            "total_at_moq",
            "created_at",
        ]
        read_only_fields = ["id", "supplier", "created_at"]

    def get_total_at_moq(self, obj) -> str:
        return str(obj.unit_price_bdt * obj.moq + obj.estimated_transport_cost)

    def validate(self, attrs):
        def merged(key):
            return attrs.get(key, getattr(self.instance, key, None))

        moq = merged("moq")
        available = merged("available_quantity")
        if moq and available is not None and moq > available:
            raise serializers.ValidationError(
                {"moq": "MOQ cannot be larger than the available quantity."}
            )

        if merged("express_delivery_available"):
            fee = merged("express_delivery_fee") or Decimal("0")
            if Decimal(fee) <= 0:
                raise serializers.ValidationError(
                    {
                        "express_delivery_fee": (
                            "Set a fee for express delivery, or turn it off."
                        )
                    }
                )
            hours = merged("express_delivery_hours") or 0
            if not 1 <= int(hours) <= 72:
                raise serializers.ValidationError(
                    {
                        "express_delivery_hours": (
                            "The express window must be between 1 and 72 hours."
                        )
                    }
                )
        return attrs

    def validate_images(self, value):
        if not isinstance(value, list) or any(not isinstance(v, str) for v in value):
            raise serializers.ValidationError("Images must be a list of URLs.")
        if len(value) > 8:
            raise serializers.ValidationError("At most 8 images per listing.")
        return value


class OrderEventSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = OrderEvent
        fields = ["id", "status", "status_label", "note", "created_by", "created_at"]


class ProductBriefSerializer(serializers.ModelSerializer):
    thumbnail = serializers.CharField(read_only=True)
    supplier_name = serializers.CharField(source="supplier.business_name", read_only=True)
    supplier_phone = serializers.CharField(source="supplier.contact_phone", read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "title",
            "category",
            "gsm",
            "fabric_composition",
            "thumbnail",
            "supplier_name",
            "supplier_phone",
        ]


class OrderSerializer(serializers.ModelSerializer):
    product = ProductBriefSerializer(read_only=True)
    events = OrderEventSerializer(many=True, read_only=True)
    buyer_business_name = serializers.CharField(
        source="buyer.business_name", read_only=True
    )
    status_label = serializers.CharField(source="get_order_status_display", read_only=True)
    payment_status_label = serializers.CharField(
        source="get_payment_status_display", read_only=True
    )
    milestone_index = serializers.IntegerField(read_only=True)
    next_statuses = serializers.ListField(read_only=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    delivery_speed_label = serializers.CharField(
        source="get_delivery_speed_display", read_only=True
    )
    is_express = serializers.BooleanField(read_only=True)
    can_self_cancel = serializers.BooleanField(read_only=True)
    needs_cancellation_request = serializers.BooleanField(read_only=True)
    cancellation_request = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "reference",
            "product",
            "buyer_business_name",
            "ordered_quantity",
            "unit_price_bdt",
            "transport_cost",
            "express_fee",
            "subtotal",
            "total_price",
            "delivery_speed",
            "delivery_speed_label",
            "is_express",
            "promised_delivery_at",
            "commission_rate",
            "platform_commission",
            "supplier_payout",
            "payment_method",
            "payment_status",
            "payment_status_label",
            "payment_reference",
            "order_status",
            "status_label",
            "milestone_index",
            "next_statuses",
            "delivery_address",
            "delivery_district",
            "contact_person",
            "contact_phone",
            "notes",
            "buyer_rating",
            "buyer_review",
            "can_self_cancel",
            "needs_cancellation_request",
            "cancellation_request",
            "cancellation_reason",
            "cancelled_at",
            "cancelled_by_buyer",
            "events",
            "created_at",
        ]

    def get_cancellation_request(self, obj):
        latest = obj.cancellation_requests.first()
        return CancellationRequestSerializer(latest).data if latest else None


class CancellationRequestSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    order_reference = serializers.CharField(source="order.reference", read_only=True)
    buyer_business_name = serializers.CharField(
        source="order.buyer.business_name", read_only=True
    )
    product_title = serializers.CharField(source="order.product.title", read_only=True)
    order_total = serializers.DecimalField(
        source="order.total_price", max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = CancellationRequest
        fields = [
            "id",
            "order",
            "order_reference",
            "buyer_business_name",
            "product_title",
            "order_total",
            "reason",
            "status",
            "status_label",
            "response_note",
            "resolved_by",
            "resolved_at",
            "created_at",
        ]
        read_only_fields = fields


class OrderCreateSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()
    ordered_quantity = serializers.IntegerField(min_value=1)
    payment_method = serializers.ChoiceField(choices=PaymentMethod.choices)
    delivery_speed = serializers.ChoiceField(
        choices=DeliverySpeed.choices, default=DeliverySpeed.STANDARD
    )
    delivery_address = serializers.CharField()
    delivery_district = serializers.CharField(required=False, allow_blank=True, default="")
    contact_person = serializers.CharField(max_length=120)
    contact_phone = serializers.CharField(max_length=32)
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        try:
            product = Product.objects.select_related("supplier").get(
                pk=attrs["product_id"], is_active=True
            )
        except Product.DoesNotExist:
            raise serializers.ValidationError({"product_id": "Listing not found."})

        qty = attrs["ordered_quantity"]
        if qty < product.moq:
            raise serializers.ValidationError(
                {"ordered_quantity": f"Minimum order quantity is {product.moq} pcs."}
            )
        if qty > product.available_quantity:
            raise serializers.ValidationError(
                {
                    "ordered_quantity": (
                        f"Only {product.available_quantity} pcs left in this lot."
                    )
                }
            )

        if (
            attrs.get("delivery_speed") == DeliverySpeed.EXPRESS
            and not product.express_delivery_available
        ):
            raise serializers.ValidationError(
                {"delivery_speed": "This supplier does not offer express delivery."}
            )

        attrs["product"] = product
        return attrs


class OrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=OrderStatus.choices)
    note = serializers.CharField(required=False, allow_blank=True, default="")


class OrderReviewSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    review = serializers.CharField(required=False, allow_blank=True, default="")


class CancellationRequestCreateSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=10, max_length=1000)

    def validate_reason(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError(
                "Tell the supplier why in a sentence or two — it speeds up approval."
            )
        return value.strip()


class CancellationResolveSerializer(serializers.Serializer):
    approve = serializers.BooleanField()
    note = serializers.CharField(required=False, allow_blank=True, default="")


class RoleSelectSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=[Role.BUYER, Role.SUPPLIER])


class QuoteSerializer(serializers.Serializer):
    """Server-side mirror of the frontend fee calculator."""

    product_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)
    delivery_speed = serializers.ChoiceField(
        choices=DeliverySpeed.choices, default=DeliverySpeed.STANDARD
    )

    def to_quote(self) -> dict:
        product = Product.objects.get(pk=self.validated_data["product_id"])
        qty = self.validated_data["quantity"]
        express = (
            self.validated_data["delivery_speed"] == DeliverySpeed.EXPRESS
            and product.express_delivery_available
        )

        subtotal = product.unit_price_bdt * qty
        transport = product.estimated_transport_cost
        express_fee = product.express_delivery_fee if express else Decimal("0.00")

        return {
            "unit_price_bdt": str(product.unit_price_bdt),
            "quantity": qty,
            "subtotal": str(subtotal),
            "transport_cost": str(transport),
            "free_delivery": product.free_delivery,
            "express_selected": express,
            "express_fee": str(express_fee),
            "express_hours": product.express_delivery_hours,
            "total": str(subtotal + transport + express_fee),
            "meets_moq": qty >= product.moq,
            "moq": product.moq,
            "available_quantity": product.available_quantity,
        }
