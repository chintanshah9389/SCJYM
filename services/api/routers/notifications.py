"""Notifications router + FCM sender.

Admin:
  POST   /admin/notifications/push    Send broadcast push
  GET    /admin/notifications         List all notifications sent

User:
  GET    /notifications          List my notifications
  PATCH  /notifications/{id}/read Mark as read
  PATCH  /notifications/read-all  Mark all as read
"""
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
    """Send FCM push to a list of device tokens via Legacy HTTP API."""
    if not settings.fcm_server_key or settings.app_env == "development":
        logger.info("DEV FCM to %d tokens: title=%s body=%s", len(tokens), title, body)
        return

    payload: dict = {
        "registration_ids": tokens,
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

    if body.targetUserId:
        # Targeted push
        user = await db.users.find_one({"_id": ObjectId(body.targetUserId)})
        if not user:
            raise HTTPException(status_code=404, detail=err("NOT_FOUND", "User not found"))
        tokens = [user["fcmToken"]] if user.get("fcmToken") else []

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
        # Broadcast: collect all FCM tokens, store per-user notifications
        cursor = db.users.find(
            {"status": "APPROVED", "fcmToken": {"$ne": None}},
            {"_id": 1, "fcmToken": 1},
        )
        users = await cursor.to_list(length=10000)
        tokens = [u["fcmToken"] for u in users if u.get("fcmToken")]

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

    return ok({"message": f"Notification sent to {len(tokens)} device(s)"})


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


# ─── User routes ─────────────────────────────────────────────────────────────

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
