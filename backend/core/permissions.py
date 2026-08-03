from rest_framework import permissions

from .models import Role


class IsSupplier(permissions.BasePermission):
    message = "You need a supplier profile to do this."

    def has_permission(self, request, view):
        account = request.user
        return bool(
            account
            and account.role == Role.SUPPLIER
            and hasattr(account, "supplier_profile")
        )


class IsBuyer(permissions.BasePermission):
    message = "You need a buyer profile to do this."

    def has_permission(self, request, view):
        account = request.user
        return bool(
            account
            and account.role == Role.BUYER
            and hasattr(account, "buyer_profile")
        )


class IsSupplierOrReadOnly(permissions.BasePermission):
    """Anyone may browse listings; only suppliers may write them."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return IsSupplier().has_permission(request, view)

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        supplier = getattr(request.user, "supplier_profile", None)
        return supplier is not None and obj.supplier_id == supplier.id
