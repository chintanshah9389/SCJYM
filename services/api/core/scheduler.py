"""APScheduler integration — run ranking jobs on a schedule inside the FastAPI process.

Usage: imported by main.py and started/stopped in the lifespan context.
"""
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.ranking import compute_bayesian_rating, compute_best_seller_score

logger = logging.getLogger(__name__)
_scheduler: AsyncIOScheduler | None = None


async def _recompute_global_scores(db: AsyncIOMotorDatabase) -> None:
    config = await db.ranking_config.find_one({"_id": "ranking_config"})
    if not config:
        logger.warning("Nightly ranking job: no ranking_config found, skipping.")
        return

    products = await db.products.find({"status": "APPROVED"}).to_list(length=100_000)
    if not products:
        return

    C = config.get("globalMeanRating", 4.0)
    m = config.get("priorStrength", 10)
    max_ws = max((p.get("weeklySalesCount", 0) for p in products), default=1) or 1
    max_rc = max((p.get("ratingCount", 0) for p in products), default=1) or 1

    for p in products:
        bayesian = compute_bayesian_rating(p.get("avgRating", 0), p.get("ratingCount", 0), C, m)
        bs = compute_best_seller_score(
            weekly_sales=p.get("weeklySalesCount", 0),
            bayesian_rating=bayesian,
            rating_count=p.get("ratingCount", 0),
            last_activity_at=p.get("lastActivityAt"),
            max_weekly_sales=max_ws,
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
    logger.info("Nightly ranking: updated scores for %d products", len(products))


async def _recompute_region_scores(db: AsyncIOMotorDatabase) -> None:
    config = await db.ranking_config.find_one({"_id": "ranking_config"})
    if not config:
        return

    regions = await db.product_region_stats.distinct("regionKey")
    total_updated = 0

    for region_key in regions:
        stats = await db.product_region_stats.find({"regionKey": region_key}).to_list(length=10_000)
        max_ws = max((s.get("weeklySalesCount", 0) for s in stats), default=1) or 1
        max_rc = max((s.get("ratingCountRegion", 0) for s in stats), default=1) or 1

        for rs in stats:
            from bson import ObjectId
            try:
                product = await db.products.find_one({"_id": ObjectId(rs["productId"])})
            except Exception:
                continue
            if not product:
                continue

            bayesian = product.get("bayesianRating", 0)
            bs_region = compute_best_seller_score(
                weekly_sales=rs.get("weeklySalesCount", 0),
                bayesian_rating=bayesian,
                rating_count=rs.get("ratingCountRegion", product.get("ratingCount", 0)),
                last_activity_at=rs.get("lastActivityAt"),
                max_weekly_sales=max_ws,
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
            total_updated += 1

    logger.info("Nightly ranking: updated region scores for %d product-region pairs", total_updated)


def start_scheduler(db: AsyncIOMotorDatabase) -> AsyncIOScheduler:
    global _scheduler
    scheduler = AsyncIOScheduler(timezone="UTC")

    # Recompute global best seller scores every night at 00:05 UTC
    scheduler.add_job(
        _recompute_global_scores,
        trigger="cron",
        hour=0,
        minute=5,
        args=[db],
        id="nightly_global_scores",
        replace_existing=True,
    )

    # Recompute region scores every night at 00:30 UTC
    scheduler.add_job(
        _recompute_region_scores,
        trigger="cron",
        hour=0,
        minute=30,
        args=[db],
        id="nightly_region_scores",
        replace_existing=True,
    )

    scheduler.start()
    _scheduler = scheduler
    logger.info("APScheduler started (nightly ranking jobs registered)")
    return scheduler


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")
    _scheduler = None
