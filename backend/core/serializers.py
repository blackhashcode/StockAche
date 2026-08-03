from rest_framework import serializers

from .models import (
    Account,
    BuyerProfile,
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
            "verification_status",
            "email",
            "full_name",
            "created_at",
        ]
        read_only_fields = ["id", "verification_status", "created_at"]


class SupplierProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="account.email", read_only=True)
    full_name = serializers.CharField(source="account.full_name", read_only=True)
    is_verified = serializers.BooleanField(read_only=True)
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
            "about",
            "verification_status",
            "is_verified",
            "rating",
            "email",
            "full_name",
            "created_at",
        ]
        read_only_fields = ["id", "verification_status", "is_verified", "rating", "created_at"]


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
        moq = attrs.get("moq", getattr(self.instance, "moq", None))
        available = attrs.get(
            "available_quantity", getattr(self.instance, "available_quantity", None)
        )
        if moq and available is not None and moq > available:
            raise serializers.ValidationError(
                {"moq": "MOQ cannot be larger than the available quantity."}
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
            "subtotal",
            "total_price",
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
            "events",
            "created_at",
        ]


class OrderCreateSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()
    ordered_quantity = serializers.IntegerField(min_value=1)
    payment_method = serializers.ChoiceField(choices=PaymentMethod.choices)
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
        attrs["product"] = product
        return attrs


class OrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=OrderStatus.choices)
    note = serializers.CharField(required=False, allow_blank=True, default="")


class OrderReviewSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    review = serializers.CharField(required=False, allow_blank=True, default="")


class RoleSelectSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=[Role.BUYER, Role.SUPPLIER])


class QuoteSerializer(serializers.Serializer):
    """Server-side mirror of the frontend fee calculator."""

    product_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)

    def to_quote(self) -> dict:
        product = Product.objects.get(pk=self.validated_data["product_id"])
        qty = self.validated_data["quantity"]
        subtotal = product.unit_price_bdt * qty
        transport = product.estimated_transport_cost
        return {
            "unit_price_bdt": str(product.unit_price_bdt),
            "quantity": qty,
            "subtotal": str(subtotal),
            "transport_cost": str(transport),
            "total": str(subtotal + transport),
            "meets_moq": qty >= product.moq,
            "moq": product.moq,
            "available_quantity": product.available_quantity,
        }
