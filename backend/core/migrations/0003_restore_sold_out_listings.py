from django.db import migrations
from django.db.models import F


def republish_sold_out_listings(apps, schema_editor):
    """Undo the old auto-unpublish behaviour.

    Placing an order used to set `is_active = False` once a lot fell below its
    MOQ, which made the listing vanish from the marketplace and locked the
    supplier out of the page they needed in order to restock it. Availability
    is now derived from stock, so those rows are in a state the current code
    would never produce.

    The signature of an auto-unpublished lot is `is_active=False` *and* stock
    below MOQ. A listing the supplier paused on purpose almost always still has
    stock, so it is left alone.
    """
    Product = apps.get_model("core", "Product")
    Product.objects.filter(
        is_active=False, available_quantity__lt=F("moq")
    ).update(is_active=True)


def noop(apps, schema_editor):
    """Not reversible: the original pause reason is not recorded anywhere."""


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0002_cancellationrequest_buyerprofile_nid_back_url_and_more"),
    ]

    operations = [
        migrations.RunPython(republish_sold_out_listings, noop),
    ]
