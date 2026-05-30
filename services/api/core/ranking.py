"""Ranking engine: Bayesian rating, best-seller scoring, region scoring, personalized ranking.

All computation functions are pure / sync; DB interactions happen in routers.
"""
import math
from datetime import datetime, timezone


# ─────────────────────────────────────────────────────────────────────────────
# Bayesian Rating
# ─────────────────────────────────────────────────────────────────────────────

def compute_bayesian_rating(
    avg_rating: float,
    rating_count: int,
    global_mean: float,
    prior_strength: int,
) -> float:
    """BayesianRating = (v/(v+m))*R + (m/(v+m))*C"""
    v = rating_count
    m = prior_strength
    R = avg_rating
    C = global_mean
    denom = v + m
    if denom == 0:
        return C
    return (v / denom) * R + (m / denom) * C


# ─────────────────────────────────────────────────────────────────────────────
# Best Seller Score  (global or region)
# BestSellerScore = w_s*SalesScore + w_r*RatingScore + w_rv*RatingVolumeScore + w_rec*RecencyBoost
# ─────────────────────────────────────────────────────────────────────────────

def compute_recency_score(last_activity_at: datetime | None) -> float:
    """e^(-days/7)  where days = days since last activity."""
    if last_activity_at is None:
        return 0.0
    now = datetime.now(tz=timezone.utc)
    if last_activity_at.tzinfo is None:
        last_activity_at = last_activity_at.replace(tzinfo=timezone.utc)
    delta_days = max(0, (now - last_activity_at).total_seconds() / 86400)
    return math.exp(-delta_days / 7)


def normalize(value: float, max_val: float) -> float:
    if max_val <= 0:
        return 0.0
    return min(1.0, value / max_val)


def compute_best_seller_score(
    weekly_sales: int,
    bayesian_rating: float,
    rating_count: int,
    last_activity_at: datetime | None,
    max_weekly_sales: float,
    max_rating_count: float,
    weight_sales: float = 0.50,
    weight_rating: float = 0.30,
    weight_rating_volume: float = 0.10,
    weight_recency: float = 0.10,
) -> float:
    sales_score = normalize(weekly_sales, max_weekly_sales)
    rating_score = normalize(bayesian_rating, 5.0)          # max possible rating = 5
    rating_volume_score = normalize(rating_count, max_rating_count)
    recency_score = compute_recency_score(last_activity_at)

    return (
        weight_sales * sales_score
        + weight_rating * rating_score
        + weight_rating_volume * rating_volume_score
        + weight_recency * recency_score
    )


# ─────────────────────────────────────────────────────────────────────────────
# Region key derivation
# ─────────────────────────────────────────────────────────────────────────────

def derive_region_key(address: dict, region_level: str = "CITY") -> str:
    def norm(s: str) -> str:
        return s.strip().upper().replace(" ", "_") if s else ""

    country = norm(address.get("country") or "IN")
    state = norm(address.get("state") or "")
    city = norm(address.get("city") or "")
    pincode = norm(address.get("pincode") or "")

    if region_level == "PINCODE":
        return f"{country}_{pincode}" if pincode else (f"{country}_{state}" if state else "GLOBAL")
    if region_level == "STATE":
        return f"{country}_{state}" if state else "GLOBAL"
    # CITY (default)
    if city and state:
        return f"{country}_{state}_{city}"
    if state:
        return f"{country}_{state}"
    return "GLOBAL"


# ─────────────────────────────────────────────────────────────────────────────
# UserAffinityMatch
# ─────────────────────────────────────────────────────────────────────────────

def compute_affinity_match(
    product_category: str,
    product_tags: list[str],
    top_categories: list[dict],   # [{categoryId, score}]
    top_tags: list[dict],         # [{tag, score}]
) -> float:
    """Return UserAffinityMatch in [0,1]."""
    if not top_categories:
        return 0.0

    max_score = max((c["score"] for c in top_categories), default=0.0)
    if max_score <= 0:
        return 0.0

    raw_match = 0.0
    cat_map = {c["categoryId"]: c["score"] for c in top_categories}
    tag_map = {t["tag"]: t["score"] for t in (top_tags or [])}

    raw_match += cat_map.get(product_category, 0.0)
    for tag in product_tags or []:
        raw_match += tag_map.get(tag, 0.0) * 0.3   # tags are secondary

    return min(1.0, raw_match / max_score)


# ─────────────────────────────────────────────────────────────────────────────
# Personalized Score
# ─────────────────────────────────────────────────────────────────────────────

def compute_personalized_score(
    base_score: float,
    affinity_match: float,
    affinity_weight_base: float = 0.70,
    affinity_weight_personal: float = 0.30,
) -> float:
    return base_score * (affinity_weight_base + affinity_weight_personal * affinity_match)


# ─────────────────────────────────────────────────────────────────────────────
# Affinity decay  (lazy – applied on read)
# ─────────────────────────────────────────────────────────────────────────────

def apply_decay(
    categories: list[dict],
    tags: list[dict],
    last_updated: datetime,
    decay_factor: float = 0.98,
) -> tuple[list[dict], list[dict]]:
    now = datetime.now(tz=timezone.utc)
    if last_updated.tzinfo is None:
        last_updated = last_updated.replace(tzinfo=timezone.utc)
    days = max(0, int((now - last_updated).total_seconds() / 86400))
    if days == 0:
        return categories, tags
    multiplier = decay_factor ** days
    decayed_cats = [
        {"categoryId": c["categoryId"], "score": round(c["score"] * multiplier, 6)}
        for c in categories
    ]
    decayed_tags = [
        {"tag": t["tag"], "score": round(t["score"] * multiplier, 6)}
        for t in tags
    ]
    return decayed_cats, decayed_tags
