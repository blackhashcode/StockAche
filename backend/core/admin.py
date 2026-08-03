from django.contrib import admin
from django.utils.html import format_html

from .models import (
    Account,
    BuyerProfile,
    CancellationRequest,
    Order,
    OrderEvent,
    Product,
    SupplierProfile,
    VerificationStatus,
)


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ["email", "full_name", "role", "created_at", "last_login_at"]
    list_filter = ["role"]
    search_fields = ["email", "full_name", "supabase_uid"]


@admin.action(description="Approve verification")
def mark_verified(modeladmin, request, queryset):
    updated = queryset.update(
        verification_status=VerificationStatus.VERIFIED, rejection_reason=""
    )
    modeladmin.message_user(request, f"{updated} account(s) verified.")


@admin.action(description="Reject verification")
def mark_rejected(modeladmin, request, queryset):
    updated = queryset.update(verification_status=VerificationStatus.REJECTED)
    modeladmin.message_user(
        request,
        f"{updated} account(s) rejected. Add a reason on each record so they know what to fix.",
    )


def _document_links(obj):
    """Thumbnail links to whatever identity documents are on file."""
    links = []
    for label, url in (
        ("NID front", obj.nid_document_url),
        ("NID back", getattr(obj, "nid_back_url", "")),
        ("Trade licence", getattr(obj, "trade_license_document_url", "")),
    ):
        if url:
            links.append(f'<a href="{url}" target="_blank" rel="noopener">{label}</a>')
    return format_html(" &middot; ".join(links)) if links else "—"


@admin.register(BuyerProfile)
class BuyerProfileAdmin(admin.ModelAdmin):
    list_display = [
        "business_name",
        "contact_phone",
        "district",
        "nid_number",
        "documents",
        "verification_status",
    ]
    list_filter = ["verification_status", "district"]
    search_fields = ["business_name", "contact_phone", "nid_number"]
    actions = [mark_verified, mark_rejected]
    readonly_fields = ["documents"]

    @admin.display(description="Documents")
    def documents(self, obj):
        return _document_links(obj)


@admin.register(SupplierProfile)
class SupplierProfileAdmin(admin.ModelAdmin):
    list_display = [
        "business_name",
        "contact_phone",
        "district",
        "trade_license_number",
        "documents",
        "verification_status",
    ]
    list_filter = ["verification_status", "district"]
    search_fields = ["business_name", "trade_license_number", "contact_phone"]
    actions = [mark_verified, mark_rejected]
    readonly_fields = ["documents"]

    @admin.display(description="Documents")
    def documents(self, obj):
        return _document_links(obj)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "supplier",
        "category",
        "gsm",
        "moq",
        "available_quantity",
        "unit_price_bdt",
        "free_delivery",
        "express_delivery_available",
        "is_active",
    ]
    list_filter = ["category", "is_active", "free_delivery", "express_delivery_available"]
    search_fields = ["title", "fabric_composition", "supplier__business_name"]


class OrderEventInline(admin.TabularInline):
    model = OrderEvent
    extra = 0
    readonly_fields = ["created_at"]


class CancellationRequestInline(admin.TabularInline):
    model = CancellationRequest
    extra = 0
    readonly_fields = ["created_at", "resolved_at"]


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = [
        "reference",
        "buyer",
        "product",
        "ordered_quantity",
        "total_price",
        "platform_commission",
        "supplier_payout",
        "delivery_speed",
        "payment_status",
        "order_status",
        "created_at",
    ]
    list_filter = [
        "order_status",
        "payment_status",
        "payment_method",
        "delivery_speed",
    ]
    search_fields = ["reference", "buyer__business_name", "product__title"]
    inlines = [OrderEventInline, CancellationRequestInline]
    readonly_fields = ["platform_commission", "supplier_payout", "commission_rate"]


@admin.register(CancellationRequest)
class CancellationRequestAdmin(admin.ModelAdmin):
    """Escalation queue: requests a supplier has not resolved."""

    list_display = ["order", "status", "created_at", "resolved_by", "resolved_at"]
    list_filter = ["status"]
    search_fields = ["order__reference", "order__buyer__business_name", "reason"]
