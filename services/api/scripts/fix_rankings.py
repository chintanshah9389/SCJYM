"""Backfill weeklySalesCount, lastActivityAt, and bestSellerScore on all products."""
import asyncio, random, sys, os
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.database import get_db, get_client
from core.ranking import compute_best_seller_score


async def fix():
    db = get_db()
    products = await db.products.find({"status": "APPROVED"}).to_list(length=1000)
    max_ws = 300
    max_rc = max((p.get("ratingCount", 1) for p in products), default=1) or 1

    for p in products:
        ws = random.randint(5, 300)
        last_activity = datetime.now(tz=timezone.utc) - timedelta(days=random.randint(0, 14))
        score = compute_best_seller_score(
            weekly_sales=ws,
            bayesian_rating=p.get("bayesianRating", 3.5),
            rating_count=p.get("ratingCount", 0),
            last_activity_at=last_activity,
            max_weekly_sales=max_ws,
            max_rating_count=max_rc,
        )
        await db.products.update_one(
            {"_id": p["_id"]},
            {"$set": {
                "weeklySalesCount": ws,
                "bestSellerScore": round(score, 6),
                "lastActivityAt": last_activity,
            }},
        )
    print(f"[fix] Updated {len(products)} products with bestSellerScore")


if __name__ == "__main__":
    asyncio.run(fix())
    get_client().close()
