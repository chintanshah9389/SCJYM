from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING, TEXT
from core.config import get_settings

settings = get_settings()

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongodb_uri)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    return get_client()["scjygm"]


async def create_indexes() -> None:
    db = get_db()

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
