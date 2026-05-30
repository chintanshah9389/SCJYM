from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING, TEXT
from core.config import get_settings
from urllib.parse import parse_qsl, urlencode

import logging

settings = get_settings()

_client: AsyncIOMotorClient | None = None


def _normalize_mongodb_uri(uri: str) -> str:
    cleaned = uri.strip().strip('"').strip("'")
    if cleaned.startswith("mongodb+srv://") and "?" in cleaned:
        base, query = cleaned.split("?", 1)
        params = dict(parse_qsl(query, keep_blank_values=True))
        params.setdefault("authSource", "admin")
        return f"{base}?{urlencode(params)}"
    if cleaned.startswith("mongodb+srv://") and "?" not in cleaned:
        return f"{cleaned}?authSource=admin"
    return cleaned


def _mask_uri(uri: str) -> str:
    """Return a masked version of the URI for safe logging (hide password)."""
    try:
        cleaned = uri.strip().strip('"').strip("'")
        if "@" in cleaned and "://" in cleaned:
            prefix, rest = cleaned.split("://", 1)
            creds, after = rest.split("@", 1)
            if ":" in creds:
                user, _pwd = creds.split(":", 1)
                masked = f"{user}:****"
            else:
                masked = "****"
            return f"{prefix}://{masked}@{after}"
        return cleaned
    except Exception:
        return "****"


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        normalized = _normalize_mongodb_uri(settings.mongodb_uri)
        logging.getLogger("core.database").debug(
            "Connecting to MongoDB (masked URI): %s", _mask_uri(normalized)
        )
        _client = AsyncIOMotorClient(normalized)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    return get_client()["scjygm"]


async def create_indexes() -> None:
    db = get_db()

    # Quick connectivity/auth check to fail fast with clearer logs
    client = get_client()
    try:
        await client.admin.command("ping")
        logging.getLogger("core.database").info("MongoDB ping successful")
    except Exception as e:
        logging.getLogger("core.database").exception("MongoDB ping failed: %s", e)
        raise

    # Users
    await db.users.create_index([("email", ASCENDING)], unique=True)
    await db.users.create_index([("mobile", ASCENDING)], unique=True)
    await db.users.create_index([("status", ASCENDING)])
    await db.users.create_index(
        [("fullName", TEXT), ("email", TEXT), ("mobile", TEXT)]
    )
    await db.users.create_index([("address.city", ASCENDING)])
    await db.users.create_index([("address.state", ASCENDING)])
    await db.users.create_index([("address.pincode", ASCENDING)])

    # Refresh tokens
    await db.refresh_tokens.create_index([("token", ASCENDING)], unique=True)
    await db.refresh_tokens.create_index([("userId", ASCENDING)])
    await db.refresh_tokens.create_index([("expiresAt", ASCENDING)], expireAfterSeconds=0)

    # Password reset tokens
    await db.password_reset_tokens.create_index([("token", ASCENDING)], unique=True)
    await db.password_reset_tokens.create_index(
        [("expiresAt", ASCENDING)], expireAfterSeconds=0
    )

    # Products
    await db.products.create_index([("status", ASCENDING)])
    await db.products.create_index([("ownerId", ASCENDING)])
    await db.products.create_index([("category", ASCENDING)])
    await db.products.create_index([("bayesianRating", DESCENDING)])
    await db.products.create_index([("bestSellerScore", DESCENDING)])
    await db.products.create_index(
        [("title", TEXT), ("description", TEXT), ("tags", TEXT)]
    )

    # Ratings
    await db.ratings.create_index(
        [("productId", ASCENDING), ("userId", ASCENDING)], unique=True
    )
    await db.ratings.create_index([("productId", ASCENDING)])

    # Comments
    await db.comments.create_index([("productId", ASCENDING), ("status", ASCENDING)])
    await db.comments.create_index([("userId", ASCENDING)])

    # Carts
    await db.carts.create_index([("userId", ASCENDING)], unique=True)

    # Menu items
    await db.menu_items.create_index([("order", ASCENDING)])

    # Notifications
    await db.notifications.create_index([("userId", ASCENDING), ("read", ASCENDING)])
    await db.notifications.create_index([("createdAt", DESCENDING)])

    # Product region stats
    await db.product_region_stats.create_index(
        [("productId", ASCENDING), ("regionKey", ASCENDING)], unique=True
    )
    await db.product_region_stats.create_index(
        [("regionKey", ASCENDING), ("bestSellerScoreRegion", DESCENDING)]
    )

    # User preferences
    await db.user_preferences.create_index([("userId", ASCENDING)], unique=True)

    # Ranking config (singleton)
    await db.ranking_config.create_index([("_id", ASCENDING)])


async def close_connection() -> None:
    global _client
    if _client:
        _client.close()
        _client = None
