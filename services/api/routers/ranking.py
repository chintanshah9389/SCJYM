"""Best-sellers, personalized ranking, event tracking, and admin ranking config.

Endpoints:
  GET  /products/best-sellers                             Global or region best sellers
  GET  /products/best-sellers/personalized                Personalized (auth required)
  POST /events/track                                      Track behavioral event (auth)

Admin:
  GET  /admin/ranking-config                              Read config
  PUT  /admin/ranking-config                              Update config
  GET  /admin/regions                                     List active regions
  GET  /admin/products/{id}/region-score-breakdown        Debug breakdown
"""
import math
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from core.database import get_db
from core.dependencies import get_current_user, require_admin
from core.ranking import (
    apply_decay,
    compute_affinity_match,
    compute_best_seller_score,
    compute_personalized_score,
    compute_recency_score,
    derive_region_key,
    normalize,
)
from core.utils import err, ok, paginate_response, serialize_doc

ranking_router = APIRouter(tags=["best-sellers"])
events_router = APIRouter(prefix="/events", tags=["events"])
admin_ranking_router = APIRouter(prefix="/admin", tags=["admin-ranking"])

# ─── Default ranking config ───────────────────────────────────────────────────

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


async def _get_config(db) -> dict:
    config = await db.ranking_config.find_one({"_id": "ranking_config"})
    if not config:
        config = DEFAULT_CONFIG.copy()
        await db.ranking_config.insert_one(config)
    return config


# ─── Schemas ─────────────────────────────────────────────────────────────────

class RankingConfigUpdateIn(BaseModel):
    priorStrength: Optional[int] = Field(None, ge=1, le=100)
    minRatingCountForEligibility: Optional[int] = Field(None, ge=0)
    minAvgRatingForEligibility: Optional[float] = Field(None, ge=0, le=5)
    weightSales: Optional[float] = Field(None, ge=0, le=1)
    weightRating: Optional[float] = Field(None, ge=0, le=1)
    weightRatingVolume: Optional[float] = Field(None, ge=0, le=1)
    weightRecency: Optional[float] = Field(None, ge=0, le=1)
    regionLevel: Optional[str] = None
    minRegionProductCount: Optional[int] = Field(None, ge=0)
    personalizationEnabled: Optional[bool] = None
    affinityWeightBase: Optional[float] = Field(None, ge=0, le=1)
    affinityWeightPersonal: Optional[float] = Field(None, ge=0, le=1)
    affinityIncrementView: Optional[float] = Field(None, ge=0)
    affinityIncrementAddToCart: Optional[float] = Field(None, ge=0)
    affinityIncrementPurchase: Optional[float] = Field(None, ge=0)
    affinityIncrementRate: Optional[float] = Field(None, ge=0)
    decayFactor: Optional[float] = Field(None, gt=0, le=1)
    explorationPercentage: Optional[float] = Field(None, ge=0, le=1)
    categoryDiversityLimit: Optional[int] = Field(None, ge=1)
    topN: Optional[int] = Field(None, ge=1, le=100)


class TrackEventIn(BaseModel):
    eventType: str   # VIEW_PRODUCT | ADD_TO_CART | RATE | COMMENT | PURCHASE
    productId: str
    categoryId: str
    ts: Optional[str] = None


# ─── Best Sellers ─────────────────────────────────────────────────────────────

async def _load_best_sellers_global(db, config: dict, limit: int) -> list[dict]:
    """Fetch approved products sorted by bestSellerScore."""
    min_rc = config.get("minRatingCountForEligibility", 3)
    min_avg = config.get("minAvgRatingForEligibility", 3.0)
    flt = {
        "status": "APPROVED",
        "ratingCount": {"$gte": min_rc},
        "avgRating": {"$gte": min_avg},
    }
    cursor = db.products.find(flt).sort("bestSellerScore", -1).limit(limit * 3)
    return await cursor.to_list(length=limit * 3)


async def _recompute_and_store_global_scores(db, config: dict) -> None:
    """Batch-recompute bestSellerScore for all eligible products (run on config change)."""
    products = await db.products.find({"status": "APPROVED"}).to_list(length=10000)
    if not products:
        return

    max_weekly = max((p.get("weeklySalesCount", 0) for p in products), default=1) or 1
    max_rc = max((p.get("ratingCount", 0) for p in products), default=1) or 1

    for p in products:
        score = compute_best_seller_score(
            weekly_sales=p.get("weeklySalesCount", 0),
            bayesian_rating=p.get("bayesianRating", 0),
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
            {"$set": {"bestSellerScore": round(score, 6)}},
        )


@ranking_router.get("/products/best-sellers")
async def get_best_sellers(
    region: str = Query("GLOBAL"),
    window: str = Query("weekly"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    config = await _get_config(db)
    skip = (page - 1) * limit

    if region == "GLOBAL":
        products = await _load_best_sellers_global(db, config, limit * 5)
        total = len(products)
        paged = products[skip: skip + limit]
        items = [
            {
                "rank": skip + idx + 1,
                "product": serialize_doc(p),
                "bestSellerScore": p.get("bestSellerScore", 0),
                "weeklySalesCount": p.get("weeklySalesCount", 0),
            }
            for idx, p in enumerate(paged)
        ]
        return ok({
            **paginate_response(items, page, limit, total),
            "region": "GLOBAL",
            "resolvedRegion": "GLOBAL",
            "fallbackApplied": False,
            "window": window,
        })

    # Region best sellers
    resolved_region = region
    fallback = False
    flt = {"regionKey": region}
    count = await db.product_region_stats.count_documents(
        {**flt, "bestSellerScoreRegion": {"$gt": 0}}
    )
    min_count = config.get("minRegionProductCount", 5)

    if count < min_count:
        # Fallback: try parent region
        parts = region.split("_")
        if len(parts) > 2:
            parent = "_".join(parts[:-1])
            parent_count = await db.product_region_stats.count_documents(
                {"regionKey": parent, "bestSellerScoreRegion": {"$gt": 0}}
            )
            if parent_count >= min_count:
                resolved_region = parent
                fallback = True
            else:
                resolved_region = "GLOBAL"
                fallback = True
        else:
            resolved_region = "GLOBAL"
            fallback = True

    if resolved_region == "GLOBAL":
        products = await _load_best_sellers_global(db, config, limit * 5)
        total = len(products)
        paged = products[skip: skip + limit]
        items = [
            {
                "rank": skip + idx + 1,
                "product": serialize_doc(p),
                "bestSellerScoreRegion": p.get("bestSellerScore", 0),
                "weeklySalesCountRegion": p.get("weeklySalesCount", 0),
            }
            for idx, p in enumerate(paged)
        ]
    else:
        total = await db.product_region_stats.count_documents(
            {"regionKey": resolved_region, "bestSellerScoreRegion": {"$gt": 0}}
        )
        cursor = (
            db.product_region_stats.find({"regionKey": resolved_region})
            .sort("bestSellerScoreRegion", -1)
            .skip(skip)
            .limit(limit)
        )
        region_stats = await cursor.to_list(length=limit)
        items = []
        for idx, rs in enumerate(region_stats):
            product = await db.products.find_one(
                {"_id": ObjectId(rs["productId"]), "status": "APPROVED"}
            )
            if product:
                items.append({
                    "rank": skip + idx + 1,
                    "product": serialize_doc(product),
                    "bestSellerScoreRegion": rs.get("bestSellerScoreRegion", 0),
                    "weeklySalesCountRegion": rs.get("weeklySalesCount", 0),
                })

    return ok({
        **paginate_response(items, page, limit, total),
        "region": region,
        "resolvedRegion": resolved_region,
        "fallbackApplied": fallback,
        "window": window,
    })


@ranking_router.get("/products/best-sellers/personalized")
async def get_personalized_best_sellers(
    region: str = Query("GLOBAL"),
    window: str = Query("weekly"),
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    config = await _get_config(db)
    user_id = str(current_user["_id"])

    # Check opt-out / global disable
    pref = await db.user_preferences.find_one({"userId": user_id})
    opt_out = pref and pref.get("personalizationOptOut", False)
    enabled = config.get("personalizationEnabled", True)

    if not enabled:
        fallback_reason = "FEATURE_DISABLED"
    elif opt_out:
        fallback_reason = "USER_OPT_OUT"
    elif not pref or not pref.get("topCategories"):
        fallback_reason = "NO_AFFINITY_DATA"
    else:
        fallback_reason = None

    if fallback_reason:
        # Return global best sellers non-personalized as fallback
        products = await _load_best_sellers_global(db, config, limit)
        items = [
            {
                "rank": idx + 1,
                "product": serialize_doc(p),
                "isExploration": False,
            }
            for idx, p in enumerate(products[:limit])
        ]
        return ok({
            "region": region,
            "personalized": False,
            "fallbackReason": fallback_reason,
            **paginate_response(items, 1, limit, len(items)),
        })

    # Apply lazy decay to affinity
    top_cats = pref.get("topCategories", [])
    top_tags = pref.get("topTags", [])
    last_upd = pref.get("updatedAt", datetime.now(tz=timezone.utc))
    if isinstance(last_upd, str):
        last_upd = datetime.fromisoformat(last_upd)
    decay_factor = config.get("decayFactor", 0.98)
    top_cats, top_tags = apply_decay(top_cats, top_tags, last_upd, decay_factor)

    # Load candidates (3x limit)
    candidate_limit = limit * 3
    min_rc = config.get("minRatingCountForEligibility", 3)
    min_avg = config.get("minAvgRatingForEligibility", 3.0)
    cursor = db.products.find(
        {"status": "APPROVED", "ratingCount": {"$gte": min_rc}, "avgRating": {"$gte": min_avg}}
    ).sort("bestSellerScore", -1).limit(candidate_limit)
    candidates = await cursor.to_list(length=candidate_limit)

    # Score each candidate
    scored = []
    for p in candidates:
        am = compute_affinity_match(
            p.get("category", ""),
            p.get("tags", []),
            top_cats,
            top_tags,
        )
        ps = compute_personalized_score(
            p.get("bestSellerScore", 0),
            am,
            config.get("affinityWeightBase", 0.70),
            config.get("affinityWeightPersonal", 0.30),
        )
        scored.append((ps, am, p))

    scored.sort(key=lambda x: x[0], reverse=True)

    # Apply diversity rule
    cat_limit = config.get("categoryDiversityLimit", 5)
    exploration_pct = config.get("explorationPercentage", 0.15)
    main_slots = limit - math.ceil(limit * exploration_pct)

    result = []
    cat_counts: dict[str, int] = {}
    for ps, am, p in scored:
        if len(result) >= main_slots:
            break
        cat = p.get("category", "UNKNOWN")
        if cat_counts.get(cat, 0) >= cat_limit:
            continue
        result.append((ps, am, p, False))
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

    # Exploration slots from categories not already dominant
    dominant_cats = {k for k, v in cat_counts.items() if v >= 2}
    explored_ids = {str(p["_id"]) for _, _, p, _ in result}
    exploration_candidates = [
        (ps, am, p) for ps, am, p in scored
        if p.get("category") not in dominant_cats and str(p["_id"]) not in explored_ids
    ]
    for ps, am, p in exploration_candidates[: limit - len(result)]:
        result.append((ps, am, p, True))

    items = [
        {
            "rank": idx + 1,
            "product": serialize_doc(p),
            "isExploration": is_exp,
        }
        for idx, (ps, am, p, is_exp) in enumerate(result)
    ]

    return ok({
        "region": region,
        "personalized": True,
        "fallbackReason": None,
        **paginate_response(items, 1, limit, len(items)),
    })


# ─── Event Tracking ───────────────────────────────────────────────────────────

VALID_EVENT_TYPES = {"VIEW_PRODUCT", "ADD_TO_CART", "RATE", "COMMENT", "PURCHASE"}


@events_router.post("/track")
async def track_event(
    body: TrackEventIn,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if body.eventType not in VALID_EVENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=err("VALIDATION_ERROR", f"Invalid eventType. Must be one of {VALID_EVENT_TYPES}"),
        )

    # Validate product exists and resolve category
    try:
        product = await db.products.find_one({"_id": ObjectId(body.productId)})
    except Exception:
        raise HTTPException(status_code=400, detail=err("INVALID_ID", "Invalid productId"))

    if not product:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Product not found"))

    # Use server-resolved category to prevent client spoofing
    authoritative_category = product.get("category", body.categoryId)

    config = await _get_config(db)
    increment_map = {
        "VIEW_PRODUCT": config.get("affinityIncrementView", 1.0),
        "ADD_TO_CART": config.get("affinityIncrementAddToCart", 3.0),
        "RATE": config.get("affinityIncrementRate", 2.0),
        "COMMENT": config.get("affinityIncrementRate", 2.0),
        "PURCHASE": config.get("affinityIncrementPurchase", 5.0),
    }
    increment = increment_map.get(body.eventType, 1.0)
    user_id = str(current_user["_id"])
    now = datetime.now(tz=timezone.utc)

    # Upsert user preference – increment category score atomically
    existing = await db.user_preferences.find_one({"userId": user_id})
    if existing:
        # Update or insert category entry
        cats = existing.get("topCategories", [])
        found = False
        for c in cats:
            if c["categoryId"] == authoritative_category:
                c["score"] += increment
                found = True
                break
        if not found:
            cats.append({"categoryId": authoritative_category, "score": increment})

        # Keep top 20 categories by score
        cats.sort(key=lambda x: x["score"], reverse=True)
        cats = cats[:20]

        # Track recently viewed (cap at 50)
        if body.eventType == "VIEW_PRODUCT":
            recent = existing.get("recentlyViewedProductIds", [])
            if body.productId not in recent:
                recent.insert(0, body.productId)
            recent = recent[:50]
        else:
            recent = existing.get("recentlyViewedProductIds", [])

        await db.user_preferences.update_one(
            {"userId": user_id},
            {"$set": {"topCategories": cats, "recentlyViewedProductIds": recent, "updatedAt": now}},
        )
    else:
        await db.user_preferences.insert_one({
            "userId": user_id,
            "topCategories": [{"categoryId": authoritative_category, "score": increment}],
            "topTags": [],
            "recentlyViewedProductIds": [body.productId] if body.eventType == "VIEW_PRODUCT" else [],
            "personalizationOptOut": False,
            "updatedAt": now,
        })

    # Increment product-level counters
    count_field = {
        "VIEW_PRODUCT": "viewsCount",
        "ADD_TO_CART": "addToCartCount",
    }.get(body.eventType)
    if count_field:
        await db.products.update_one(
            {"_id": ObjectId(body.productId)},
            {"$inc": {count_field: 1}, "$set": {"lastActivityAt": now}},
        )

    # Update region stats
    address = current_user.get("address", {})
    region_key = derive_region_key(address, config.get("regionLevel", "CITY"))
    if region_key != "GLOBAL" and body.eventType in ("VIEW_PRODUCT", "ADD_TO_CART"):
        region_field_map = {
            "VIEW_PRODUCT": "viewsCountRegion",
            "ADD_TO_CART": "addToCartCountRegion",
        }
        await db.product_region_stats.update_one(
            {"productId": body.productId, "regionKey": region_key},
            {
                "$inc": {region_field_map[body.eventType]: 1},
                "$set": {"lastActivityAt": now, "updatedAt": now},
                "$setOnInsert": {
                    "weeklySalesCount": 0,
                    "bestSellerScoreRegion": 0.0,
                },
            },
            upsert=True,
        )

    return ok({"processed": True})


# ─── Admin Ranking Config ─────────────────────────────────────────────────────

@admin_ranking_router.get("/ranking-config")
async def get_ranking_config(
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    config = await _get_config(db)
    config_out = {k: v for k, v in config.items() if k != "_id"}
    return ok(config_out)


@admin_ranking_router.put("/ranking-config")
async def update_ranking_config(
    body: RankingConfigUpdateIn,
    admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}

    # Validate weights sum to 1.0
    config = await _get_config(db)
    weight_keys = ["weightSales", "weightRating", "weightRatingVolume", "weightRecency"]
    merged = {k: config.get(k, DEFAULT_CONFIG[k]) for k in weight_keys}
    merged.update({k: v for k, v in updates.items() if k in weight_keys})
    total = sum(merged.values())
    if abs(total - 1.0) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=err(
                "VALIDATION_ERROR",
                f"Best seller weights must sum to 1.0 (current sum: {total:.3f})",
            ),
        )

    if "regionLevel" in updates and updates["regionLevel"] not in ("CITY", "STATE", "PINCODE"):
        raise HTTPException(
            status_code=400,
            detail=err("VALIDATION_ERROR", "regionLevel must be CITY, STATE, or PINCODE"),
        )

    updates["updatedAt"] = datetime.now(tz=timezone.utc)
    updates["updatedBy"] = str(admin["_id"])

    await db.ranking_config.update_one(
        {"_id": "ranking_config"},
        {"$set": updates},
        upsert=True,
    )
    return ok({"message": "Ranking config updated", "changedFields": list(updates.keys())})


@admin_ranking_router.get("/regions")
async def list_regions(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    pipeline = [
        {
            "$group": {
                "_id": "$regionKey",
                "productCount": {"$sum": 1},
                "totalWeeklySales": {"$sum": "$weeklySalesCount"},
                "lastActivityAt": {"$max": "$lastActivityAt"},
            }
        },
        {"$sort": {"productCount": -1}},
        {"$skip": (page - 1) * limit},
        {"$limit": limit},
    ]
    regions = await db.product_region_stats.aggregate(pipeline).to_list(length=limit)
    formatted = [
        {
            "regionKey": r["_id"],
            "productCount": r["productCount"],
            "totalWeeklySales": r["totalWeeklySales"],
            "lastActivityAt": str(r["lastActivityAt"]) if r.get("lastActivityAt") else None,
        }
        for r in regions
    ]
    total = len(await db.product_region_stats.distinct("regionKey"))
    import math as _math
    return ok({
        "regions": formatted,
        "page": page,
        "limit": limit,
        "total": total,
        "totalPages": _math.ceil(total / limit) if limit else 0,
    })


@admin_ranking_router.get("/products/{product_id}/region-score-breakdown")
async def region_score_breakdown(
    product_id: str,
    region: str | None = Query(None),
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    product = await db.products.find_one({"_id": ObjectId(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Product not found"))

    config = await _get_config(db)
    C = config.get("globalMeanRating", 4.0)
    m = config.get("priorStrength", 10)
    R = product.get("avgRating", 0)
    v = product.get("ratingCount", 0)

    flt: dict = {"productId": product_id}
    if region:
        flt["regionKey"] = region
    region_stats = await db.product_region_stats.find(flt).to_list(length=100)

    breakdowns = []
    for rs in region_stats:
        last_act = rs.get("lastActivityAt")
        days_since = 0
        if last_act:
            if isinstance(last_act, str):
                last_act = datetime.fromisoformat(last_act)
            days_since = max(0, int((datetime.now(tz=timezone.utc) - last_act.replace(tzinfo=timezone.utc) if last_act.tzinfo is None else datetime.now(tz=timezone.utc) - last_act).total_seconds() / 86400))

        breakdowns.append({
            "regionKey": rs["regionKey"],
            "weeklySalesCount": rs.get("weeklySalesCount", 0),
            "viewsCountRegion": rs.get("viewsCountRegion", 0),
            "addToCartCountRegion": rs.get("addToCartCountRegion", 0),
            "daysSinceLastActivity": days_since,
            "bestSellerScoreRegion": rs.get("bestSellerScoreRegion", 0),
        })

    return ok({
        "product": serialize_doc(product),
        "bayesianBreakdown": {
            "formula": "BayesianRating = (v/(v+m)) * R + (m/(v+m)) * C",
            "v": v, "m": m, "R": R, "C": C,
            "result": product.get("bayesianRating", 0),
        },
        "regionBreakdowns": breakdowns,
    })
