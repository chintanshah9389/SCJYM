"""Backfill productCode for existing demo home products.

Run from services/api:
    python -m scripts.backfill_demo_product_codes
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import close_connection, get_db


TITLE_TO_CODE = {
    "Demo Home Product - Whey Protein Isolate 1kg": "dummy-p-1",
    "Demo Home Product - Adjustable Dumbbell Pair": "dummy-p-2",
    "Demo Home Product - Resistance Band Combo": "dummy-p-3",
    "Demo Home Product - Yoga Mat Pro 8mm": "dummy-p-4",
    "Demo Home Product - Stainless Steel Shaker Bottle": "dummy-p-5",
}


async def backfill_demo_product_codes() -> None:
    db = get_db()

    updated = 0
    skipped = 0
    missing = 0

    for title, product_code in TITLE_TO_CODE.items():
        product = await db.products.find_one({"title": title}, {"_id": 1, "productCode": 1})
        if not product:
            missing += 1
            print(f"[missing] {title}")
            continue

        if product.get("productCode"):
            skipped += 1
            print(f"[skip] {title} -> {product.get('productCode')}")
            continue

        await db.products.update_one(
            {"_id": product["_id"]},
            {"$set": {"productCode": product_code}},
        )
        updated += 1
        print(f"[ok] {title} -> {product_code}")

    print("\nBackfill summary")
    print(f"Updated: {updated}")
    print(f"Skipped: {skipped}")
    print(f"Missing: {missing}")


async def _main() -> None:
    try:
        await backfill_demo_product_codes()
    finally:
        await close_connection()


if __name__ == "__main__":
    asyncio.run(_main())
