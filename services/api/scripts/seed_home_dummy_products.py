 """Seed script: insert 5 approved dummy products for home page.

Run from services/api:
    python -m scripts.seed_home_dummy_products
"""

import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bson import ObjectId

from core.database import close_connection, get_db
from core.security import hash_password


DUMMY_PRODUCTS = [
    {
        "title": "Demo Home Product - Whey Protein Isolate 1kg",
        "description": "High-quality isolate protein for lean muscle recovery and daily performance.",
        "category": "Sports & Fitness",
        "tags": ["protein", "fitness", "supplement"],
        "price": 2399.0,
        "inventory": 120,
        "images": ["https://images.unsplash.com/photo-1579722821273-0f6c0f9a7f8d?w=800"],
    },
    {
        "title": "Demo Home Product - Adjustable Dumbbell Pair",
        "description": "Space-saving adjustable dumbbells for progressive strength training at home.",
        "category": "Sports & Fitness",
        "tags": ["dumbbell", "gym", "strength"],
        "price": 3299.0,
        "inventory": 80,
        "images": ["https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=800"],
    },
    {
        "title": "Demo Home Product - Resistance Band Combo",
        "description": "Set of resistance bands suitable for warm-ups, rehab, and full-body workouts.",
        "category": "Sports & Fitness",
        "tags": ["bands", "workout", "home-gym"],
        "price": 799.0,
        "inventory": 260,
        "images": ["https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=800"],
    },
    {
        "title": "Demo Home Product - Yoga Mat Pro 8mm",
        "description": "Non-slip high-density yoga mat for comfort during yoga and floor exercises.",
        "category": "Sports & Fitness",
        "tags": ["yoga", "mat", "wellness"],
        "price": 999.0,
        "inventory": 210,
        "images": ["https://images.unsplash.com/photo-1591291621164-2c6367723315?w=800"],
    },
    {
        "title": "Demo Home Product - Stainless Steel Shaker Bottle",
        "description": "Leak-proof shaker with mixer ball, ideal for protein shakes and hydration.",
        "category": "Sports & Fitness",
        "tags": ["shaker", "bottle", "gym-accessory"],
        "price": 349.0,
        "inventory": 400,
        "images": ["https://images.unsplash.com/photo-1526401485004-2fda9f24f822?w=800"],
    },
]


async def _get_or_create_owner_id(db) -> str:
    existing_user = await db.users.find_one(
        {"status": "APPROVED"},
        {"_id": 1},
    )
    if existing_user:
        return str(existing_user["_id"])

    now = datetime.now(tz=timezone.utc)
    fallback_user = {
        "fullName": "Home Demo Owner",
        "email": "home.demo.owner@scjygm.local",
        "mobile": "9800000999",
        "address": {
            "line1": "Demo Street",
            "line2": "Unit 1",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400001",
            "country": "IN",
        },
        "passwordHash": hash_password("Password@123"),
        "role": "MEMBER",
        "status": "APPROVED",
        "fcmToken": None,
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db.users.insert_one(fallback_user)
    return str(result.inserted_id)


async def seed_home_dummy_products() -> None:
    db = get_db()
    owner_id = await _get_or_create_owner_id(db)
    now = datetime.now(tz=timezone.utc)

    inserted = 0
    skipped = 0

    for i, product in enumerate(DUMMY_PRODUCTS):
        existing = await db.products.find_one({"title": product["title"]}, {"_id": 1})
        if existing:
            skipped += 1
            print(f"[skip] {product['title']}")
            continue

        created_at = now - timedelta(days=(i + 1) * 2)
        doc = {
            "title": product["title"],
            "description": product["description"],
            "category": product["category"],
            "tags": product["tags"],
            "price": product["price"],
            "inventory": product["inventory"],
            "images": product["images"],
            "productCode": f"dummy-p-{i+1}",
            "ownerId": owner_id,
            "status": "APPROVED",
            "avgRating": 4.4,
            "ratingCount": 20 + (i * 3),
            "bayesianRating": 4.4,
            "viewCount": 120 + (i * 25),
            "purchaseCount": 18 + (i * 5),
            "bestSellerScore": 4.4,
            "weeklySalesCount": 10 + (i * 2),
            "viewsCount": 120 + (i * 25),
            "addToCartCount": 25 + (i * 3),
            "lastActivityAt": now,
            "ratingsLocked": False,
            "commentsLocked": False,
            "createdAt": created_at,
            "updatedAt": now,
            "approvedAt": created_at + timedelta(hours=1),
            "approvedBy": owner_id,
        }

        result = await db.products.insert_one(doc)
        inserted += 1
        print(f"[ok] {product['title']} ({str(result.inserted_id)})")

    total_seeded = await db.products.count_documents({"title": {"$regex": "^Demo Home Product - "}})
    print("\nSeed summary")
    print(f"Inserted: {inserted}")
    print(f"Skipped:  {skipped}")
    print(f"Total demo products in DB: {total_seeded}")


async def _main() -> None:
    try:
        await seed_home_dummy_products()
    finally:
        await close_connection()


if __name__ == "__main__":
    asyncio.run(_main())
