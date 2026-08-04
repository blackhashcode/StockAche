import django_filters as filters
from django.db.models import F

from .models import Product


class ProductFilter(filters.FilterSet):
    """Spec filters for the marketplace discovery feed."""

    category = filters.CharFilter(method="filter_category")
    gsm_min = filters.NumberFilter(field_name="gsm", lookup_expr="gte")
    gsm_max = filters.NumberFilter(field_name="gsm", lookup_expr="lte")
    moq_min = filters.NumberFilter(field_name="moq", lookup_expr="gte")
    moq_max = filters.NumberFilter(field_name="moq", lookup_expr="lte")
    price_min = filters.NumberFilter(field_name="unit_price_bdt", lookup_expr="gte")
    price_max = filters.NumberFilter(field_name="unit_price_bdt", lookup_expr="lte")
    district = filters.CharFilter(field_name="supplier__district", lookup_expr="iexact")
    verified_only = filters.BooleanFilter(method="filter_verified")
    in_stock = filters.BooleanFilter(method="filter_in_stock")
    supplier = filters.UUIDFilter(field_name="supplier__id")

    class Meta:
        model = Product
        fields = []

    def filter_in_stock(self, queryset, name, value):
        """Hide lots that cannot currently satisfy their own MOQ."""
        if value:
            return queryset.filter(available_quantity__gte=F("moq"))
        return queryset

    def filter_category(self, queryset, name, value):
        """Accepts a single slug or a comma separated list."""
        slugs = [v.strip() for v in value.split(",") if v.strip()]
        return queryset.filter(category__in=slugs) if slugs else queryset

    def filter_verified(self, queryset, name, value):
        if value:
            return queryset.filter(supplier__verification_status="verified")
        return queryset
