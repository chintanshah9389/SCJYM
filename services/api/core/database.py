from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING, TEXT
from core.config import get_settings
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit, quote_plus, unquote

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


def _percent_encode_credentials(uri: str) -> str:
    """Return a URI with the password percent-encoded (safe to retry connections)."""
    try:
        parts = urlsplit(uri)
        netloc = parts.netloc
        if "@" not in netloc:
            return uri
        creds, host = netloc.rsplit("@", 1)
        if ":" not in creds:
            return uri
        user, password = creds.split(":", 1)
        # Normalize by unquoting then re-quoting to avoid double-encoding
        raw_password = unquote(password)
        encoded_password = quote_plus(raw_password, safe="")
        if encoded_password == password:
            return uri
        new_creds = f"{user}:{encoded_password}"
        new_netloc = f"{new_creds}@{host}"
        new_parts = parts._replace(netloc=new_netloc)
        return urlunsplit(new_parts)
    except Exception:
        return uri


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
    logger = logging.getLogger("core.database")

    normalized = _normalize_mongodb_uri(settings.mongodb_uri)
    logger.debug("Checking MongoDB connectivity (masked URI): %s", _mask_uri(normalized))

    # Try initial connection
    try:
        client = AsyncIOMotorClient(normalized)
        await client.admin.command("ping")
        logger.info("MongoDB ping successful")
        # Ensure global client is set to this instance if not already
        global _client
        if _client is None:
            _client = client
    except Exception as e:
        logger.exception("MongoDB ping failed: %s", e)
        # If it's an auth failure, try percent-encoding credentials and retry
        msg = str(e).lower()
        is_auth_error = ("bad auth" in msg) or ("authentication failed" in msg) or (getattr(e, "code", None) == 8000)
        if is_auth_error:
            try:
                alt = _percent_encode_credentials(normalized)
                if alt != normalized:
                    logger.info("Retrying MongoDB connection with percent-encoded credentials (masked %s)", _mask_uri(alt))
                    alt_client = AsyncIOMotorClient(alt)
                    await alt_client.admin.command("ping")
                    logger.info("MongoDB ping successful with percent-encoded credentials")
                    # swap global client
                    global _client
                    if _client:
                        _client.close()
                    _client = alt_client
                else:
                    logger.info("No credential encoding changes detected; aborting retry")
                    raise
            except Exception as e2:
                logger.exception("Retry with encoded credentials failed: %s", e2)
                raise
        else:
            raise

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
