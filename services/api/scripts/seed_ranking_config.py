"""Seed default RankingConfig document if absent, and recompute bestSellerScore for all products.

Usage:
    cd services/api
    python -m scripts.seed_ranking_config
"""
import asyncio
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient

from core.config import get_settings
from core.ranking import compute_bayesian_rating, compute_best_seller_score

DEFAULT_CONFIG = {
    "_id": "ranking_config",
    "globalMeanRating": 4.0,
    "priorStrength": 10,
    "minRatingCountForEligibility": 3,
    "minAvgRatingForEligibility": 3.0,
    "weightSales": 0.50,
    "weightRating": 0.30,
    "weightRatingVolume": 0.10,
    "weightRecency": 0.10,
    "regionLevel": "CITY",
    "minRegionProductCount": 5,
    "personalizationEnabled": True,
    "affinityWeightBase": 0.70,
    "affinityWeightPersonal": 0.30,
    "affinityIncrementView": 1.0,
    "affinityIncrementAddToCart": 3.0,
    "affinityIncrementPurchase": 5.0,
    "affinityIncrementRate": 2.0,
    "decayFactor": 0.98,
    "explorationPercentage": 0.15,
    "categoryDiversityLimit": 5,
    "topN": 20,
    "updatedAt": None,
}


async def main():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.mongodb_db_name]

    existing = await db.ranking_config.find_one({"_id": "ranking_config"})
    if existing:
        print("✓ RankingConfig already exists — skipping seed.")
    else:
        await db.ranking_config.insert_one(DEFAULT_CONFIG)
        print("✓ Seeded default RankingConfig.")

    # Recompute bayesianRating + bestSellerScore for all approved products
    products = await db.products.find({"status": "APPROVED"}).to_list(length=100000)
    if not products:
        print("No approved products found.")
        client.close()
        return

    config = await db.ranking_config.find_one({"_id": "ranking_config"})
    C = config.get("globalMeanRating", 4.0)
    m = config.get("priorStrength", 10)

    max_weekly = max((p.get("weeklySalesCount", 0) for p in products), default=1) or 1
    max_rc = max((p.get("ratingCount", 0) for p in products), default=1) or 1

    updated = 0
    for p in products:
        avg_r = p.get("avgRating", 0)
        rc = p.get("ratingCount", 0)
        bayesian = compute_bayesian_rating(avg_r, rc, C, m)
        bs_score = compute_best_seller_score(
            weekly_sales=p.get("weeklySalesCount", 0),
            bayesian_rating=bayesian,
            rating_count=rc,
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
            {
                "$set": {
                    "bayesianRating": round(bayesian, 6),
                    "bestSellerScore": round(bs_score, 6),
                }
            },
        )
        updated += 1

    print(f"✓ Recomputed scores for {updated} products.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
