"""Seed script: insert 4 active dummy ads for home carousel.

Run from services/api:
    python -m scripts.seed_home_dummy_ads
"""

import asyncio
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import close_connection, get_db


DUMMY_ADS = [
    {
        "title": "Demo Home Ad - Weekend Fitness Fest",
        "subtitle": "Flat 25% off on protein combos",
        "mediaUrl": "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80",
        "mediaType": "IMAGE",
        "linkTarget": "https://scjym.in/offers",
        "linkType": "WEB_URL",
        "isActive": True,
        "sortOrder": 1,
        "badge": "HOT DEAL",
        "badgeColor": "#ef4444",
    },
    {
        "title": "Demo Home Ad - Morning Yoga Batch",
        "subtitle": "Book your trial class now",
        "mediaUrl": "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80",
        "mediaType": "IMAGE",
        "linkTarget": "https://scjym.in/classes",
        "linkType": "WEB_URL",
        "isActive": True,
        "sortOrder": 2,
        "badge": "NEW",
        "badgeColor": "#10b981",
    },
    {
        "title": "Demo Home Ad - Top Gym Accessories",
        "subtitle": "Starting at Rs 299 only",
        "mediaUrl": "https://images.unsplash.com/photo-1598289431512-b97b0917affc?auto=format&fit=crop&w=1200&q=80",
        "mediaType": "IMAGE",
        "linkTarget": "https://scjym.in/shop",
        "linkType": "WEB_URL",
        "isActive": True,
        "sortOrder": 3,
        "badge": "LIMITED",
        "badgeColor": "#f59e0b",
    },
    {
        "title": "Demo Home Ad - Coach Connect Live",
        "subtitle": "Join Q&A with pro trainers",
        "mediaUrl": "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=1200&q=80",
        "mediaType": "IMAGE",
        "linkTarget": "https://scjym.in/live",
        "linkType": "WEB_URL",
        "isActive": True,
        "sortOrder": 4,
        "badge": "LIVE",
        "badgeColor": "#8b5cf6",
    },
]


async def seed_home_dummy_ads() -> None:
    db = get_db()
    now = datetime.now(tz=timezone.utc)

    inserted = 0
    skipped = 0

    for ad in DUMMY_ADS:
        existing = await db.advertisements.find_one({"title": ad["title"]}, {"_id": 1})
        if existing:
            skipped += 1
            print(f"[skip] {ad['title']}")
            continue

        doc = {
            **ad,
            "createdAt": now,
            "updatedAt": now,
        }
        result = await db.advertisements.insert_one(doc)
        inserted += 1
        print(f"[ok] {ad['title']} ({str(result.inserted_id)})")

    total_seeded = await db.advertisements.count_documents({"title": {"$regex": "^Demo Home Ad - "}})
    print("\nSeed summary")
    print(f"Inserted: {inserted}")
    print(f"Skipped:  {skipped}")
    print(f"Total demo ads in DB: {total_seeded}")


async def _main() -> None:
    try:
        await seed_home_dummy_ads()
    finally:
        await close_connection()


if __name__ == "__main__":
    asyncio.run(_main())
