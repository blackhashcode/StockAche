from django.contrib import admin

from .models import (
    Account,
    BuyerProfile,
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


@admin.action(description="Mark selected as Verified")
def mark_verified(modeladmin, request, queryset):
    queryset.update(verification_status=VerificationStatus.VERIFIED)


@admin.action(description="Mark selected as Rejected")
def mark_rejected(modeladmin, request, queryset):
    queryset.update(verification_status=VerificationStatus.REJECTED)


@admin.register(BuyerProfile)
class BuyerProfileAdmin(admin.ModelAdmin):
    list_display = ["business_name", "contact_phone", "district", "verification_status"]
    list_filter = ["verification_status", "district"]
    search_fields = ["business_name", "contact_phone", "nid_number"]
    actions = [mark_verified, mark_rejected]


@admin.register(SupplierProfile)
class SupplierProfileAdmin(admin.ModelAdmin):
    list_display = [
        "business_name",
        "contact_phone",
        "district",
        "trade_license_number",
        "verification_status",
    ]
    list_filter = ["verification_status", "district"]
    search_fields = ["business_name", "trade_license_number", "contact_phone"]
    actions = [mark_verified, mark_rejected]


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
        "is_active",
    ]
    list_filter = ["category", "is_active"]
    search_fields = ["title", "fabric_composition", "supplier__business_name"]


class OrderEventInline(admin.TabularInline):
    model = OrderEvent
    extra = 0
    readonly_fields = ["created_at"]


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = [
        "reference",
        "buyer",
        "product",
        "ordered_quantity",
        "total_price",
        "payment_method",
        "payment_status",
        "order_status",
        "created_at",
    ]
    list_filter = ["order_status", "payment_status", "payment_method"]
    search_fields = ["reference", "buyer__business_name", "product__title"]
    inlines = [OrderEventInline]
