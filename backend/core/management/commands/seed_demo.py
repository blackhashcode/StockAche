"""Populate the prototype with believable Bangladeshi stocklot data.

    python manage.py seed_demo          # add demo data, keep what exists
    python manage.py seed_demo --reset  # wipe marketplace data first
"""

import random
import uuid
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import (
    Account,
    BuyerProfile,
    CancellationRequest,
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
    VerificationStatus,
)

SUPPLIERS = [
    {
        "email": "supplier@stockache.dev",
        "name": "Rafiq Hossain",
        "business_name": "Hossain Stocklot House",
        "district": "Narayanganj",
        "address": "Plot 42, BSCIC Industrial Area, Fatullah, Narayanganj",
        "phone": "+8801711000101",
        "license": "TRAD/NGJ/2019/44821",
        "nid": "1985347765521",
        "about": "Export-surplus knitwear from Narayanganj units. 9 years in stocklot.",
        "verified": True,
    },
    {
        "email": "denimking@stockache.dev",
        "name": "Shahin Alam",
        "business_name": "Denim King Traders",
        "district": "Gazipur",
        "address": "House 7, Konabari, Gazipur",
        "phone": "+8801711000102",
        "license": "TRAD/GAZ/2021/11903",
        "nid": "1990558812234",
        "about": "Denim and twill leftovers direct from washing plants.",
        "verified": True,
    },
    {
        "email": "ctgfabrics@stockache.dev",
        "name": "Nusrat Jahan",
        "business_name": "Chattogram Fabric Depot",
        "district": "Chattogram",
        "address": "Road 3, Baizid Bostami, Chattogram",
        "phone": "+8801711000103",
        "license": "",
        "nid": "1993220098876",
        "about": "Port-side depot. Mixed lots, fast dispatch to anywhere in BD.",
        "verified": False,
    },
]

BUYERS = [
    {
        "email": "buyer@stockache.dev",
        "name": "Tanvir Ahmed",
        "business_name": "Trendy Threads BD",
        "business_type": "Online Clothing Store",
        "district": "Dhaka",
        "address": "Flat 4B, House 22, Road 11, Banani, Dhaka 1213",
        "phone": "+8801811000201",
        "nid": "1994778865521",
    },
    {
        "email": "shopno@stockache.dev",
        "name": "Farhana Islam",
        "business_name": "Shopno Fashion House",
        "business_type": "Facebook Page Store",
        "district": "Sylhet",
        "address": "Zindabazar, Sylhet 3100",
        "phone": "+8801811000202",
        "nid": "1998443323310",
    },
]

PRODUCTS = [
    {
        "title": "Export Surplus Cotton T-Shirt Lot (Mixed Colors)",
        "category": FabricCategory.TSHIRT,
        "gsm": 180,
        "composition": "100% Combed Cotton",
        "sizes": "S,M,L,XL,XXL",
        "colors": "Black, White, Navy, Olive",
        "qty": 4200,
        "moq": 120,
        "price": "165.00",
        "transport": "1800.00",
        "supplier": 0,
        "description": (
            "Genuine export-surplus single jersey tees. Buyer-cancelled H&M order, "
            "A-grade with original tags. Ratio packed 1:2:2:1."
        ),
    },
    {
        "title": "Heavy Denim Jeans Stocklot - Slim Fit",
        "category": FabricCategory.DENIM,
        "gsm": 380,
        "composition": "98% Cotton, 2% Elastane",
        "sizes": "30,32,34,36,38",
        "colors": "Dark Blue, Mid Blue, Black",
        "qty": 1600,
        "moq": 60,
        "price": "620.00",
        "transport": "2500.00",
        "supplier": 1,
        "description": (
            "Stone-washed slim fit denim from a Konabari washing plant. "
            "Minor shade variation across the lot, priced accordingly."
        ),
    },
    {
        "title": "Fleece Hoodie Lot - Winter Stock",
        "category": FabricCategory.HOODIE,
        "gsm": 320,
        "composition": "80% Cotton, 20% Polyester",
        "sizes": "M,L,XL",
        "colors": "Charcoal, Maroon, Beige",
        "qty": 900,
        "moq": 50,
        "price": "445.00",
        "transport": "2200.00",
        "supplier": 0,
        "description": "Brushed-back fleece pullover hoodies with kangaroo pocket.",
    },
    {
        "title": "Polo Shirt Stocklot - Pique Knit",
        "category": FabricCategory.POLO,
        "gsm": 210,
        "composition": "60% Cotton, 40% Polyester",
        "sizes": "M,L,XL,XXL",
        "colors": "Sky, White, Grey Melange",
        "qty": 2400,
        "moq": 100,
        "price": "245.00",
        "transport": "1900.00",
        "supplier": 2,
        "description": "Pique knit polos, cancelled shipment. Collar and cuff tipped.",
    },
    {
        "title": "Kids Cotton Frock Lot (2-8 Years)",
        "category": FabricCategory.KIDSWEAR,
        "gsm": 140,
        "composition": "100% Cotton Voile",
        "sizes": "2Y,4Y,6Y,8Y",
        "colors": "Assorted Prints",
        "qty": 1800,
        "moq": 80,
        "price": "185.00",
        "transport": "1500.00",
        "supplier": 2,
        "description": "Printed cotton voile frocks, assorted floral prints.",
    },
    {
        "title": "Knit Trouser / Joggers Lot",
        "category": FabricCategory.TROUSER,
        "gsm": 260,
        "composition": "70% Cotton, 30% Polyester",
        "sizes": "M,L,XL",
        "colors": "Black, Navy, Grey",
        "qty": 1200,
        "moq": 60,
        "price": "295.00",
        "transport": "2000.00",
        "supplier": 1,
        "description": "Terry joggers with elastic cuff and drawcord waist.",
    },
    {
        "title": "Woven Casual Shirt Stocklot - Check",
        "category": FabricCategory.WOVEN,
        "gsm": 130,
        "composition": "100% Cotton Poplin",
        "sizes": "M,L,XL",
        "colors": "Assorted Checks",
        "qty": 2000,
        "moq": 100,
        "price": "310.00",
        "transport": "1750.00",
        "supplier": 0,
        "description": "Yarn-dyed check casual shirts, full sleeve, single pocket.",
    },
    {
        "title": "Activewear Dry-Fit Tee Lot",
        "category": FabricCategory.ACTIVEWEAR,
        "gsm": 150,
        "composition": "100% Polyester Micro Mesh",
        "sizes": "S,M,L,XL",
        "colors": "Neon Green, Royal Blue, Black",
        "qty": 3000,
        "moq": 150,
        "price": "135.00",
        "transport": "1600.00",
        "supplier": 1,
        "description": "Moisture-wicking dry-fit tees, gym and sports resale ready.",
    },
    {
        "title": "Ladies Knitwear Cardigan Lot",
        "category": FabricCategory.KNITWEAR,
        "gsm": 290,
        "composition": "55% Acrylic, 45% Cotton",
        "sizes": "S,M,L",
        "colors": "Cream, Rust, Sage",
        "qty": 700,
        "moq": 40,
        "price": "520.00",
        "transport": "2100.00",
        "supplier": 0,
        "description": "Soft-knit open front cardigans, winter season leftover.",
    },
    {
        "title": "Sweatshirt Stocklot - Crew Neck",
        "category": FabricCategory.FLEECE,
        "gsm": 300,
        "composition": "65% Cotton, 35% Polyester",
        "sizes": "M,L,XL,XXL",
        "colors": "Off White, Bottle Green, Navy",
        "qty": 1100,
        "moq": 50,
        "price": "385.00",
        "transport": "2000.00",
        "supplier": 2,
        "description": "Crew neck sweatshirts, ribbed hem and cuff, unbranded.",
    },
]


def images_for(index: int) -> list[str]:
    """Deterministic placeholder photos so the grid never looks empty."""
    return [
        f"https://picsum.photos/seed/stockache-{index}-{n}/800/600" for n in range(1, 4)
    ]


def document_for(slug: str) -> str:
    """Stand-in scan of an identity document for demo accounts."""
    return f"https://picsum.photos/seed/stockache-doc-{slug}/900/560"


# Per-listing delivery options, indexed to PRODUCTS below.
#   (free_delivery, express_available, express_fee, express_hours)
DELIVERY_OPTIONS = [
    (False, True, "850.00", 24),
    (False, True, "1200.00", 24),
    (True, False, "0.00", 24),
    (False, False, "0.00", 24),
    (True, True, "700.00", 18),
    (False, True, "950.00", 24),
    (False, False, "0.00", 24),
    (True, True, "600.00", 12),
    (False, True, "1100.00", 24),
    (False, False, "0.00", 24),
]


class Command(BaseCommand):
    help = "Seed the StockAche prototype with demo suppliers, buyers, lots and orders."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing marketplace data before seeding.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        random.seed(42)

        if options["reset"]:
            CancellationRequest.objects.all().delete()
            OrderEvent.objects.all().delete()
            Order.objects.all().delete()
            Product.objects.all().delete()
            BuyerProfile.objects.all().delete()
            SupplierProfile.objects.all().delete()
            Account.objects.all().delete()
            self.stdout.write(self.style.WARNING("Cleared existing marketplace data."))

        supplier_profiles = []
        for spec in SUPPLIERS:
            account, _ = Account.objects.get_or_create(
                email=spec["email"],
                defaults={
                    "supabase_uid": uuid.uuid4(),
                    "full_name": spec["name"],
                    "phone": spec["phone"],
                    "role": Role.SUPPLIER,
                },
            )
            account.role = Role.SUPPLIER
            account.save(update_fields=["role", "updated_at"])

            profile, _ = SupplierProfile.objects.get_or_create(
                account=account,
                defaults={
                    "business_name": spec["business_name"],
                    "contact_phone": spec["phone"],
                    "address": spec["address"],
                    "district": spec["district"],
                    "trade_license_number": spec["license"],
                    "trade_license_document_url": (
                        document_for(f"tl-{spec['email']}") if spec["license"] else ""
                    ),
                    "nid_number": spec["nid"],
                    "nid_document_url": document_for(f"nid-f-{spec['email']}"),
                    "nid_back_url": document_for(f"nid-b-{spec['email']}"),
                    "about": spec["about"],
                    "verification_status": (
                        VerificationStatus.VERIFIED
                        if spec["verified"]
                        else VerificationStatus.PENDING
                    ),
                },
            )
            supplier_profiles.append(profile)

        buyer_profiles = []
        for spec in BUYERS:
            account, _ = Account.objects.get_or_create(
                email=spec["email"],
                defaults={
                    "supabase_uid": uuid.uuid4(),
                    "full_name": spec["name"],
                    "phone": spec["phone"],
                    "role": Role.BUYER,
                },
            )
            account.role = Role.BUYER
            account.save(update_fields=["role", "updated_at"])

            profile, _ = BuyerProfile.objects.get_or_create(
                account=account,
                defaults={
                    "business_name": spec["business_name"],
                    "business_type": spec["business_type"],
                    "contact_phone": spec["phone"],
                    "address": spec["address"],
                    "district": spec["district"],
                    "nid_number": spec["nid"],
                    "nid_document_url": document_for(f"nid-f-{spec['email']}"),
                    "nid_back_url": document_for(f"nid-b-{spec['email']}"),
                    "verification_status": VerificationStatus.VERIFIED,
                },
            )
            buyer_profiles.append(profile)

        products = []
        for index, spec in enumerate(PRODUCTS):
            free, express, express_fee, express_hours = DELIVERY_OPTIONS[index]
            product, created = Product.objects.get_or_create(
                title=spec["title"],
                supplier=supplier_profiles[spec["supplier"]],
                defaults={
                    "description": spec["description"],
                    "category": spec["category"],
                    "gsm": spec["gsm"],
                    "fabric_composition": spec["composition"],
                    "sizes_available": spec["sizes"],
                    "colors": spec["colors"],
                    "available_quantity": spec["qty"],
                    "moq": spec["moq"],
                    "unit_price_bdt": Decimal(spec["price"]),
                    # `free_delivery` zeroes this out in Product.save().
                    "estimated_transport_cost": Decimal(spec["transport"]),
                    "free_delivery": free,
                    "express_delivery_available": express,
                    "express_delivery_fee": Decimal(express_fee),
                    "express_delivery_hours": express_hours,
                    "images": images_for(index),
                    "location": supplier_profiles[spec["supplier"]].district,
                },
            )
            products.append(product)

        # A few orders spread across the milestone track so the tracker and the
        # supplier dispatch controller both have something to show.
        # (buyer, product, qty, payment method, final status, rating, express)
        order_specs = [
            (0, 0, 200, PaymentMethod.BKASH, OrderStatus.DELIVERED, 5, True),
            (0, 1, 80, PaymentMethod.COD, OrderStatus.IN_TRANSIT, None, False),
            (0, 3, 150, PaymentMethod.CARD, OrderStatus.DISPATCHED, None, False),
            (1, 2, 60, PaymentMethod.BKASH, OrderStatus.CONFIRMED, None, False),
            (1, 5, 100, PaymentMethod.COD, OrderStatus.PLACED, None, False),
            (0, 7, 300, PaymentMethod.BKASH, OrderStatus.DELIVERED, 4, True),
        ]

        rate = Decimal(settings.PLATFORM_COMMISSION_RATE)
        created_orders = 0
        for buyer_i, product_i, qty, method, final_status, rating, want_express in order_specs:
            buyer = buyer_profiles[buyer_i]
            product = products[product_i]
            if Order.objects.filter(buyer=buyer, product=product).exists():
                continue

            express = want_express and product.express_delivery_available
            subtotal = (product.unit_price_bdt * qty).quantize(Decimal("0.01"))
            transport = product.estimated_transport_cost
            express_fee = product.express_delivery_fee if express else Decimal("0.00")
            commission = (subtotal * rate).quantize(Decimal("0.01"))

            order = Order.objects.create(
                buyer=buyer,
                product=product,
                ordered_quantity=qty,
                unit_price_bdt=product.unit_price_bdt,
                transport_cost=transport,
                delivery_speed=(
                    DeliverySpeed.EXPRESS if express else DeliverySpeed.STANDARD
                ),
                express_fee=express_fee,
                promised_delivery_at=(
                    timezone.now() + timedelta(hours=product.express_delivery_hours)
                    if express
                    else None
                ),
                total_price=subtotal + transport + express_fee,
                commission_rate=rate,
                platform_commission=commission,
                supplier_payout=(subtotal - commission + transport + express_fee),
                payment_method=method,
                payment_status=(
                    PaymentStatus.PAID
                    if method != PaymentMethod.COD
                    else (
                        PaymentStatus.PAID
                        if final_status == OrderStatus.DELIVERED
                        else PaymentStatus.DUE_ON_DELIVERY
                    )
                ),
                payment_reference=(
                    "" if method == PaymentMethod.COD
                    else f"{'BKS' if method == PaymentMethod.BKASH else 'CRD'}-"
                         f"{uuid.uuid4().hex[:10].upper()}"
                ),
                order_status=final_status,
                delivery_address=buyer.address,
                delivery_district=buyer.district,
                contact_person=buyer.account.full_name,
                contact_phone=buyer.contact_phone,
                buyer_rating=rating,
                buyer_review="Good quality, matched the description." if rating else "",
            )

            product.available_quantity = max(0, product.available_quantity - qty)
            product.save(update_fields=["available_quantity", "updated_at"])

            # Walk the timeline up to the order's current status.
            track = [
                OrderStatus.PLACED,
                OrderStatus.CONFIRMED,
                OrderStatus.DISPATCHED,
                OrderStatus.IN_TRANSIT,
                OrderStatus.DELIVERED,
            ]
            notes = {
                OrderStatus.PLACED: "Order placed and payment recorded.",
                OrderStatus.CONFIRMED: "Stock reserved, packing started.",
                OrderStatus.DISPATCHED: "Dispatched via truck from the warehouse.",
                OrderStatus.IN_TRANSIT: "On the highway, expected within 24 hours.",
                OrderStatus.DELIVERED: "Handed over to the buyer.",
            }
            base = timezone.now() - timedelta(days=len(track) + 2)
            for step, milestone in enumerate(track):
                OrderEvent.objects.create(
                    order=order,
                    status=milestone,
                    note=notes[milestone],
                    created_by=(
                        buyer.business_name
                        if milestone == OrderStatus.PLACED
                        else product.supplier.business_name
                    ),
                    created_at=base + timedelta(days=step),
                )
                if milestone == final_status:
                    break
            created_orders += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(supplier_profiles)} suppliers, {len(buyer_profiles)} buyers, "
                f"{len(products)} listings, {created_orders} orders."
            )
        )
        self.stdout.write("")
        self.stdout.write("Demo accounts for the dev-login switcher:")
        for spec in BUYERS:
            self.stdout.write(f"  buyer    {spec['email']:<28} {spec['business_name']}")
        for spec in SUPPLIERS:
            self.stdout.write(f"  supplier {spec['email']:<28} {spec['business_name']}")
