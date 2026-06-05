"""Notifications router + FCM sender.

Admin:
  POST   /admin/notifications/push    Send broadcast push
  GET    /admin/notifications         List all notifications sent

User:
  GET    /notifications          List my notifications
  PATCH  /notifications/{id}/read Mark as read
  PATCH  /notifications/read-all  Mark all as read
"""
import json
import logging
from datetime import datetime, timezone

import httpx
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from core.config import get_settings
from core.database import get_db
from core.dependencies import get_current_user, require_admin
from core.utils import err, ok, paginate_response, serialize_doc, serialize_list

settings = get_settings()
logger = logging.getLogger("notifications")

router = APIRouter(prefix="/notifications", tags=["notifications"])
admin_router = APIRouter(prefix="/admin/notifications", tags=["admin-notifications"])


# ─── FCM sender ──────────────────────────────────────────────────────────────

async def send_fcm_push(
    tokens: list[str],
    title: str,
    body: str,
    image_url: str | None = None,
    data: dict | None = None,
) -> None:
    """Send push notifications.

    Supports both Expo push tokens (ExponentPushToken[...]) and regular FCM tokens.
    """
    if not tokens:
        return

    expo_tokens = [t for t in tokens if isinstance(t, str) and t.startswith("ExponentPushToken[")]
    fcm_tokens = [t for t in tokens if t not in expo_tokens]

    if settings.app_env == "development":
        logger.info("DEV mode push enabled: attempting send to %d tokens", len(tokens))

    if expo_tokens:
        expo_messages = [
            {
                "to": token,
                "title": title,
                "body": body,
                "data": data or {},
                "sound": "default",
                **({"image": image_url} if image_url else {}),
            }
            for token in expo_tokens
        ]
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://exp.host/--/api/v2/push/send",
                    json=expo_messages,
                    headers={"Content-Type": "application/json"},
                    timeout=15,
                )
                if resp.status_code != 200:
                    logger.error("Expo push returned %s: %s", resp.status_code, resp.text)
        except Exception:
            logger.exception("Expo push send failed")

    if not fcm_tokens:
        return

    if not settings.fcm_server_key:
        logger.warning("FCM_SERVER_KEY is missing. Skipping %d FCM token(s).", len(fcm_tokens))
        return

    payload: dict = {
        "registration_ids": fcm_tokens,
        "notification": {"title": title, "body": body},
        "data": data or {},
    }
    if image_url:
        payload["notification"]["image"] = image_url

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://fcm.googleapis.com/fcm/send",
                json=payload,
                headers={
                    "Authorization": f"key={settings.fcm_server_key}",
                    "Content-Type": "application/json",
                },
                timeout=10,
            )
            if resp.status_code != 200:
                logger.error("FCM returned %s: %s", resp.status_code, resp.text)
    except Exception:
        logger.exception("FCM send failed")


async def send_web_push(
    subscriptions: list[dict],
    title: str,
    body: str,
    image_url: str | None = None,
    data: dict | None = None,
) -> None:
    """Send web push notifications via Web Push Protocol (RFC 8291).

    Subscriptions are stored as PushSubscription objects from browser Web Push API.
    Each subscription has: endpoint, keys (p256dh, auth)
    """
    if not subscriptions or not settings.vapid_private_key or not settings.vapid_public_key:
        if not subscriptions:
            return
        logger.warning("VAPID keys not configured. Skipping %d web push subscription(s).", len(subscriptions))
        return

    try:
        from pywebpush import webpush
    except ImportError:
        logger.warning("pywebpush not installed. Skipping web push notifications.")
        return

    payload = {
        "title": title,
        "body": body,
        "icon": "/icon.png",
        "badge": "/icon.png",
        "data": data or {},
        **({"image": image_url} if image_url else {}),
    }

    for sub in subscriptions:
        try:
            webpush(
                subscription_info=sub,
                data=json.dumps(payload),
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": "mailto:admin@example.com"},
            )
            logger.debug("Web push sent to %s", sub.get("endpoint", "")[:30])
        except Exception:
            logger.exception("Web push send failed for subscription")


async def create_and_send_notification(
    db: AsyncIOMotorDatabase,
    user_id: str,
    title: str,
    body: str,
    image_url: str | None = None,
    video_url: str | None = None,
    youtube_url: str | None = None,
    deep_link: str | None = None,
    notification_type: str = "GENERAL",
) -> None:
    """
    Create a notification for a user AND send push notifications.
    This is the primary function to use when notifying users about events.
    """
    now = datetime.now(tz=timezone.utc)

    # Get user and their push tokens
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        logger.warning("User %s not found for notification", user_id)
        return

    # Create notification document
    notification_doc = {
        "userId": str(user["_id"]),
        "title": title,
        "body": body,
        "imageUrl": image_url,
        "videoUrl": video_url,
        "youtubeUrl": youtube_url,
        "deepLink": deep_link,
        "type": notification_type,
        "read": False,
        "createdAt": now,
    }
    await db.notifications.insert_one(notification_doc)
    logger.debug("✅ Notification created: %s", title)

    # Send push notifications
    tokens = [user["fcmToken"]] if user.get("fcmToken") else []
    web_subs = [user["webPushSubscription"]] if user.get("webPushSubscription") else []

    if tokens:
        await send_fcm_push(
            tokens,
            title,
            body,
            image_url=image_url,
            data={
                "deepLink": deep_link or "",
                "youtubeUrl": youtube_url or "",
            },
        )
        logger.info("📤 FCM push sent to user %s", user_id)

    if web_subs:
        await send_web_push(
            web_subs,
            title,
            body,
            image_url=image_url,
            data={
                "deepLink": deep_link or "",
                "youtubeUrl": youtube_url or "",
            },
        )
        logger.info("📤 Web push sent to user %s", user_id)



# ─── Schemas ─────────────────────────────────────────────────────────────────

class PushCompositionIn(BaseModel):
    title: str
    body: str
    imageUrl: str | None = None
    videoUrl: str | None = None
    youtubeUrl: str | None = None
    deepLink: str | None = None
    targetUserId: str | None = None   # None = broadcast


# ─── Admin routes ────────────────────────────────────────────────────────────

@admin_router.post("/push", status_code=status.HTTP_200_OK)
async def send_push(
    body: PushCompositionIn,
    admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    now = datetime.now(tz=timezone.utc)
    users_count = 0
    with_token_count = 0
    without_token_count = 0

    if body.targetUserId:
        # Targeted push
        user = await db.users.find_one({"_id": ObjectId(body.targetUserId)})
        if not user:
            raise HTTPException(status_code=404, detail=err("NOT_FOUND", "User not found"))
        tokens = [user["fcmToken"]] if user.get("fcmToken") else []
        web_subs = [user["webPushSubscription"]] if user.get("webPushSubscription") else []
        users_count = 1
        with_token_count = len(tokens) + len(web_subs)
        without_token_count = 0 if (tokens or web_subs) else 1

        notification_doc = {
            "userId": str(user["_id"]),
            "title": body.title,
            "body": body.body,
            "imageUrl": body.imageUrl,
            "videoUrl": body.videoUrl,
            "youtubeUrl": body.youtubeUrl,
            "deepLink": body.deepLink,
            "type": "GENERAL",
            "read": False,
            "createdAt": now,
        }
        await db.notifications.insert_one(notification_doc)
    else:
        # Broadcast: send in-app notifications to all approved users,
        # and push only to users that actually have a token.
        cursor = db.users.find(
            {"status": "APPROVED"},
            {"_id": 1, "fcmToken": 1, "webPushSubscription": 1},
        )
        users = await cursor.to_list(length=10000)
        users_count = len(users)
        tokens = [u["fcmToken"] for u in users if u.get("fcmToken")]
        web_subs = [u["webPushSubscription"] for u in users if u.get("webPushSubscription")]
        with_token_count = len(tokens) + len(web_subs)
        without_token_count = users_count - len([u for u in users if u.get("fcmToken") or u.get("webPushSubscription")])

        # Bulk insert notification docs for each user
        if users:
            notif_docs = [
                {
                    "userId": str(u["_id"]),
                    "title": body.title,
                    "body": body.body,
                    "imageUrl": body.imageUrl,
                    "videoUrl": body.videoUrl,
                    "youtubeUrl": body.youtubeUrl,
                    "deepLink": body.deepLink,
                    "type": "GENERAL",
                    "read": False,
                    "createdAt": now,
                }
                for u in users
            ]
            await db.notifications.insert_many(notif_docs)

    await send_fcm_push(
        tokens,
        body.title,
        body.body,
        image_url=body.imageUrl,
        data={
            "deepLink": body.deepLink or "",
            "youtubeUrl": body.youtubeUrl or "",
        },
    )

    await send_web_push(
        web_subs,
        body.title,
        body.body,
        image_url=body.imageUrl,
        data={
            "deepLink": body.deepLink or "",
            "youtubeUrl": body.youtubeUrl or "",
        },
    )

    return ok({
        "message": f"Notification sent to {with_token_count} device(s) ({len(tokens)} FCM, {len(web_subs)} web)",
        "adminUserId": str(admin.get("_id")) if admin.get("_id") else None,
        "target": "single-user" if body.targetUserId else "broadcast",
        "approvedUsers": users_count,
        "usersWithToken": with_token_count,
        "usersWithoutToken": without_token_count,
    })


@admin_router.get("")
async def admin_list_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    # Return unique broadcast notifications (latest per title/createdAt)
    skip = (page - 1) * limit
    total = await db.notifications.count_documents({})
    cursor = db.notifications.find({}).sort("createdAt", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    return ok(paginate_response(serialize_list(docs), page, limit, total))


@admin_router.delete("/{notification_id}")
async def admin_delete_notification(
    notification_id: str,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status_code=400, detail=err("INVALID_ID", "Invalid notification id"))

    result = await db.notifications.delete_one({"_id": ObjectId(notification_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Notification not found"))

    return ok({"message": "Notification deleted"})


@admin_router.delete("")
async def admin_delete_all_notifications(
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    result = await db.notifications.delete_many({})
    return ok({"message": f"Deleted {result.deleted_count} notification(s)"})


# ─── User routes ─────────────────────────────────────────────────────────────

@router.post("/test")
async def send_test_notification(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Send a test notification to the current user.
    
    Useful for debugging and testing push notification setup.
    """
    await create_and_send_notification(
        db,
        str(current_user["_id"]),
        title="Test Notification",
        body="If you see this, push notifications are working! ✅",
        image_url=None,
        deep_link=None,
        notification_type="TEST",
    )
    return ok({"message": "Test notification sent. Check your device/browser."})


@router.get("")
async def list_my_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user_id = str(current_user["_id"])
    flt = {"userId": user_id}
    skip = (page - 1) * limit
    total = await db.notifications.count_documents(flt)
    cursor = db.notifications.find(flt).sort("createdAt", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    unread_count = await db.notifications.count_documents({"userId": user_id, "read": False})
    return ok({**paginate_response(serialize_list(docs), page, limit, total), "unreadCount": unread_count})


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    result = await db.notifications.update_one(
        {"_id": ObjectId(notification_id), "userId": str(current_user["_id"])},
        {"$set": {"read": True}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Notification not found"))
    return ok({"message": "Marked as read"})


@router.patch("/read-all")
async def mark_all_read(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    await db.notifications.update_many(
        {"userId": str(current_user["_id"]), "read": False},
        {"$set": {"read": True}},
    )
    return ok({"message": "All notifications marked as read"})
