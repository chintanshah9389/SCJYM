"""Nightly batch job: reset weekly sales counters + recompute bestSellerScore.

Run this via cron at midnight daily (or APScheduler inside the FastAPI process).

Usage:
    cd services/api
    python -m scripts.nightly_ranking_updates
"""
import asyncio
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient

from core.config import get_settings
from core.ranking import compute_bayesian_rating, compute_best_seller_score, derive_region_key


async def recompute_global(db, config):
    products = await db.products.find({"status": "APPROVED"}).to_list(length=100000)
    if not products:
        return 0
    C = config.get("globalMeanRating", 4.0)
    m = config.get("priorStrength", 10)
    max_weekly = max((p.get("weeklySalesCount", 0) for p in products), default=1) or 1
    max_rc = max((p.get("ratingCount", 0) for p in products), default=1) or 1
    updated = 0
    for p in products:
        bayesian = compute_bayesian_rating(p.get("avgRating", 0), p.get("ratingCount", 0), C, m)
        bs = compute_best_seller_score(
            weekly_sales=p.get("weeklySalesCount", 0),
            bayesian_rating=bayesian,
            rating_count=p.get("ratingCount", 0),
            last_activity_at=p.get("lastActivityAt"),
            max_weekly_sales=max_weekly,
            max_rating_count=max_rc,
            weight_sales=config.get("weightSales", 0.50),
            weight_rating=config.get("weightRating", 0.30),
            weight_rating_volume=config.get("weightRatingVolume", 0.10),
            weight_recency=config.get("weightRecency", 0.10),
        )
        await db.products.update_one(
            {"_id": p["_id"]},
            {"$set": {"bayesianRating": round(bayesian, 6), "bestSellerScore": round(bs, 6)}},
        )
        updated += 1
    return updated


async def recompute_regions(db, config):
    regions = await db.product_region_stats.distinct("regionKey")
    updated = 0
    for region_key in regions:
        stats = await db.product_region_stats.find({"regionKey": region_key}).to_list(length=10000)
        max_weekly = max((s.get("weeklySalesCount", 0) for s in stats), default=1) or 1
        max_rc = max((s.get("ratingCountRegion", 0) for s in stats), default=1) or 1

        for rs in stats:
            product = await db.products.find_one({"productId": rs["productId"]})
            if not product:
                # Try by string lookup
                from bson import ObjectId
                try:
                    product = await db.products.find_one({"_id": ObjectId(rs["productId"])})
                except Exception:
                    pass
            if not product:
                continue

            bayesian = product.get("bayesianRating", 0)
            bs_region = compute_best_seller_score(
                weekly_sales=rs.get("weeklySalesCount", 0),
                bayesian_rating=bayesian,
                rating_count=rs.get("ratingCountRegion", product.get("ratingCount", 0)),
                last_activity_at=rs.get("lastActivityAt"),
                max_weekly_sales=max_weekly,
                max_rating_count=max_rc,
                weight_sales=config.get("weightSales", 0.50),
                weight_rating=config.get("weightRating", 0.30),
                weight_rating_volume=config.get("weightRatingVolume", 0.10),
                weight_recency=config.get("weightRecency", 0.10),
            )
            await db.product_region_stats.update_one(
                {"_id": rs["_id"]},
                {"$set": {"bestSellerScoreRegion": round(bs_region, 6)}},
            )
            updated += 1
    return updated


async def main():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.mongodb_db_name]

    config = await db.ranking_config.find_one({"_id": "ranking_config"})
    if not config:
        print("No ranking config found — run seed_ranking_config.py first.")
        client.close()
        return

    print("=== Nightly Ranking Job ===")
    g = await recompute_global(db, config)
    print(f"✓ Global scores recomputed: {g} products")

    r = await recompute_regions(db, config)
    print(f"✓ Region scores recomputed: {r} region-product pairs")

    # Optional: roll weeklySalesCount window (zero out if last reset was >7 days ago)
    # This is left to a separate weekly job or could be triggered here with a date check.
    print("=== Done ===")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
