"""Delete dummy products everywhere and seed 5 fresh products with 5 images each.

Run from services/api:
    python -m scripts.reset_dummy_products_and_seed_fresh

This script operates on the MongoDB pointed to by MONGODB_URI/.env.
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import close_connection, get_db
from core.security import hash_password


FRESH_PRODUCTS = [
    {
        "title": "Premium Grass-Fed Whey Protein 2kg",
        "description": "Clean whey protein blend for strength and recovery with low sugar and high digestibility.",
        "category": "Sports Nutrition",
        "tags": ["protein", "whey", "muscle", "recovery"],
        "price": 4899.0,
        "inventory": 140,
        "images": [
            "https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=900",
            "https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=900",
            "https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?w=900",
            "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=900",
            "https://images.unsplash.com/photo-1605296867724-fa87a8ef53fd?w=900",
        ],
    },
    {
        "title": "Smart Adjustable Dumbbell Set 40kg",
        "description": "Compact dumbbell system with quick-lock plates for progressive home and studio workouts.",
        "category": "Strength Equipment",
        "tags": ["dumbbell", "strength", "home gym", "adjustable"],
        "price": 7999.0,
        "inventory": 65,
        "images": [
            "https://images.unsplash.com/photo-1534368786749-b63e46d6f7f2?w=900",
            "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=900",
            "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=900",
            "https://images.unsplash.com/photo-1599058918144-1ffabb6ab9a0?w=900",
            "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=900",
        ],
    },
    {
        "title": "High-Density Yoga Mat Pro 10mm",
        "description": "Anti-slip, joint-friendly yoga mat designed for daily stretching, yoga flow, and floor training.",
        "category": "Yoga & Mobility",
        "tags": ["yoga", "mobility", "wellness", "training"],
        "price": 1599.0,
        "inventory": 220,
        "images": [
            "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=900",
            "https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?w=900",
            "https://images.unsplash.com/photo-1591291621164-2c6367723315?w=900",
            "https://images.unsplash.com/photo-1510894347713-fc3ed6fdf539?w=900",
            "https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=900",
        ],
    },
    {
        "title": "Creatine Monohydrate Ultra Pure 500g",
        "description": "Micronized creatine monohydrate for power output, performance, and consistent training progress.",
        "category": "Sports Nutrition",
        "tags": ["creatine", "performance", "strength", "supplement"],
        "price": 1299.0,
        "inventory": 310,
        "images": [
            "https://images.unsplash.com/photo-1514995669114-6081e934b693?w=900",
            "https://images.unsplash.com/photo-1521804906057-1df8fdb718b7?w=900",
            "https://images.unsplash.com/photo-1486218119243-13883505764c?w=900",
            "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=900",
            "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=900",
        ],
    },
    {
        "title": "Elite Recovery Foam Roller Kit",
        "description": "Deep tissue recovery roller with trigger ball set for post-workout mobility and pain relief.",
        "category": "Recovery & Rehab",
        "tags": ["recovery", "foam roller", "mobility", "rehab"],
        "price": 1899.0,
        "inventory": 175,
        "images": [
            "https://images.unsplash.com/photo-1517344884509-a0c97ec11bcc?w=900",
            "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=900",
            "https://images.unsplash.com/photo-1597347316205-38f3196aa45d?w=900",
            "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=900",
            "https://images.unsplash.com/photo-1576678927484-cc907957088c?w=900",
        ],
    },
]


async def _get_or_create_owner_id(db) -> str:
    existing_user = await db.users.find_one({"status": "APPROVED"}, {"_id": 1})
    if existing_user:
        return str(existing_user["_id"])

    now = datetime.now(tz=timezone.utc)
    fallback_user = {
        "fullName": "Catalog Owner",
        "email": "catalog.owner@scjygm.local",
        "mobile": "9800000111",
        "address": {
            "line1": "Catalog Street",
            "line2": "Unit 5",
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


async def reset_and_seed_products() -> None:
    db = get_db()
    owner_id = await _get_or_create_owner_id(db)
    now = datetime.now(tz=timezone.utc)

    # Remove any previously seeded fresh products to keep run idempotent.
    stale_fresh_cursor = db.products.find(
        {
            "$or": [
                {"productCode": {"$regex": "^fresh-p-", "$options": "i"}},
                {"title": {"$in": [p["title"] for p in FRESH_PRODUCTS]}},
            ]
        },
        {"_id": 1},
    )
    stale_fresh_docs = await stale_fresh_cursor.to_list(length=200)
    stale_fresh_ids = [d["_id"] for d in stale_fresh_docs]
    stale_fresh_id_strs = [str(_id) for _id in stale_fresh_ids]

    if stale_fresh_ids:
        await db.ratings.delete_many({"productId": {"$in": stale_fresh_id_strs}})
        await db.comments.delete_many({"productId": {"$in": stale_fresh_id_strs}})
        await db.product_region_stats.delete_many({"productId": {"$in": stale_fresh_id_strs}})
        await db.carts.update_many(
            {"items.productId": {"$in": stale_fresh_id_strs}},
            {"$pull": {"items": {"productId": {"$in": stale_fresh_id_strs}}}},
        )
        await db.products.delete_many({"_id": {"$in": stale_fresh_ids}})

    # Find dummy products to remove from all related collections.
    dummy_cursor = db.products.find(
        {
            "$or": [
                {"title": {"$regex": "^Demo Home Product - ", "$options": "i"}},
                {"productCode": {"$regex": "^dummy-p-", "$options": "i"}},
                {"tags": {"$in": ["dummy", "demo"]}},
            ]
        },
        {"_id": 1, "title": 1, "productCode": 1},
    )
    dummy_docs = await dummy_cursor.to_list(length=500)
    dummy_ids = [d["_id"] for d in dummy_docs]
    dummy_id_strs = [str(_id) for _id in dummy_ids]

    deleted_products = 0
    deleted_ratings = 0
    deleted_comments = 0
    deleted_region_stats = 0
    carts_updated = 0

    if dummy_ids:
        deleted_ratings = (await db.ratings.delete_many({"productId": {"$in": dummy_id_strs}})).deleted_count
        deleted_comments = (await db.comments.delete_many({"productId": {"$in": dummy_id_strs}})).deleted_count
        deleted_region_stats = (
            await db.product_region_stats.delete_many({"productId": {"$in": dummy_id_strs}})
        ).deleted_count
        carts_updated = (
            await db.carts.update_many(
                {"items.productId": {"$in": dummy_id_strs}},
                {"$pull": {"items": {"productId": {"$in": dummy_id_strs}}}},
            )
        ).modified_count
        deleted_products = (await db.products.delete_many({"_id": {"$in": dummy_ids}})).deleted_count

    inserted = 0
    for i, product in enumerate(FRESH_PRODUCTS, start=1):
        created_at = now - timedelta(minutes=(6 - i) * 3)
        doc = {
            "title": product["title"],
            "description": product["description"],
            "category": product["category"],
            "tags": product["tags"],
            "price": product["price"],
            "inventory": product["inventory"],
            "images": product["images"],
            "productCode": f"fresh-p-{i}",
            "ownerId": owner_id,
            "status": "APPROVED",
            "avgRating": 4.6,
            "ratingCount": 12 + i,
            "bayesianRating": 4.5,
            "bestSellerScore": 4.2 + (i * 0.03),
            "weeklySalesCount": 8 + i,
            "viewsCount": 150 + (i * 20),
            "addToCartCount": 18 + (i * 3),
            "lastActivityAt": now,
            "ratingsLocked": False,
            "commentsLocked": False,
            "createdAt": created_at,
            "updatedAt": now,
            "approvedAt": created_at + timedelta(minutes=5),
            "approvedBy": owner_id,
            "approvalReason": "Fresh catalog reset",
        }
        await db.products.insert_one(doc)
        inserted += 1
        print(f"[ok] inserted fresh-p-{i} -> {product['title']}")

    print("\nReset + Seed summary")
    print(f"Dummy products removed: {deleted_products}")
    print(f"Related ratings removed: {deleted_ratings}")
    print(f"Related comments removed: {deleted_comments}")
    print(f"Related region stats removed: {deleted_region_stats}")
    print(f"Carts updated: {carts_updated}")
    print(f"Fresh products inserted: {inserted}")


async def _main() -> None:
    try:
        await reset_and_seed_products()
    finally:
        await close_connection()


if __name__ == "__main__":
    asyncio.run(_main())
