from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("products", views.ProductViewSet, basename="product")
router.register("orders", views.OrderViewSet, basename="order")

urlpatterns = [
    path("meta/", views.meta, name="meta"),
    path("auth/me/", views.me, name="me"),
    path("auth/role/", views.select_role, name="select-role"),
    path("auth/dev-login/", views.dev_login, name="dev-login"),
    path("profiles/buyer/", views.BuyerProfileView.as_view(), name="buyer-profile"),
    path("profiles/supplier/", views.SupplierProfileView.as_view(), name="supplier-profile"),
    path("suppliers/<uuid:supplier_id>/", views.supplier_public, name="supplier-public"),
    path("dashboard/supplier/", views.supplier_dashboard, name="supplier-dashboard"),
    path("dashboard/supplier/earnings/", views.supplier_earnings, name="supplier-earnings"),
    path("dashboard/buyer/", views.buyer_dashboard, name="buyer-dashboard"),
    path("uploads/", views.UploadView.as_view(), name="upload"),
    path("", include(router.urls)),
]
