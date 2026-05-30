"""Advertisements router.

Public:
  GET  /ads/active          Active ads ordered by sortOrder (shown in home carousel)

Admin:
  GET    /admin/ads           List all ads
  POST   /admin/ads           Create ad
  PUT    /admin/ads/{id}      Update ad
  DELETE /admin/ads/{id}      Delete ad
  PATCH  /admin/ads/{id}/toggle   Toggle isActive
"""
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from core.database import get_db
from core.dependencies import require_admin
from core.utils import err, ok, serialize_doc, serialize_list

router = APIRouter(prefix="/ads", tags=["ads"])
admin_router = APIRouter(prefix="/admin/ads", tags=["admin-ads"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class AdIn(BaseModel):
    title: str
    subtitle: str = ""
    mediaUrl: str               # image or video URL
    mediaType: str = "IMAGE"    # IMAGE | VIDEO | YOUTUBE
    linkTarget: str = ""        # deep link / external URL on tap
    linkType: str = "NONE"      # SCREEN_ROUTE | WEB_URL | NONE
    isActive: bool = True
    sortOrder: int = 0
    badge: str = ""             # optional badge text e.g. "SALE", "NEW", "LIVE"
    badgeColor: str = "#ef4444"


class AdUpdateIn(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    mediaUrl: Optional[str] = None
    mediaType: Optional[str] = None
    linkTarget: Optional[str] = None
    linkType: Optional[str] = None
    isActive: Optional[bool] = None
    sortOrder: Optional[int] = None
    badge: Optional[str] = None
    badgeColor: Optional[str] = None


# ─── Public ───────────────────────────────────────────────────────────────────

@router.get("/active")
async def get_active_ads(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    now = datetime.now(tz=timezone.utc)
    cursor = db.advertisements.find({"isActive": True}).sort("sortOrder", 1).limit(limit)
    items = await cursor.to_list(length=limit)
    return ok(serialize_list(items))


# ─── Admin ────────────────────────────────────────────────────────────────────

@admin_router.get("")
async def admin_list_ads(
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: dict = Depends(require_admin),
):
    items = await db.advertisements.find({}).sort("sortOrder", 1).to_list(length=200)
    return ok(serialize_list(items))


@admin_router.post("", status_code=status.HTTP_201_CREATED)
async def admin_create_ad(
    body: AdIn,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: dict = Depends(require_admin),
):
    now = datetime.now(tz=timezone.utc)
    doc = {**body.model_dump(), "createdAt": now, "updatedAt": now}
    result = await db.advertisements.insert_one(doc)
    doc["_id"] = result.inserted_id
    return ok(serialize_doc(doc))


@admin_router.put("/{ad_id}")
async def admin_update_ad(
    ad_id: str,
    body: AdUpdateIn,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: dict = Depends(require_admin),
):
    if not ObjectId.is_valid(ad_id):
        raise HTTPException(status_code=400, detail=err("INVALID_ID", "Invalid ad id"))
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    update["updatedAt"] = datetime.now(tz=timezone.utc)
    result = await db.advertisements.update_one({"_id": ObjectId(ad_id)}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Ad not found"))
    doc = await db.advertisements.find_one({"_id": ObjectId(ad_id)})
    return ok(serialize_doc(doc))


@admin_router.patch("/{ad_id}/toggle")
async def admin_toggle_ad(
    ad_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: dict = Depends(require_admin),
):
    if not ObjectId.is_valid(ad_id):
        raise HTTPException(status_code=400, detail=err("INVALID_ID", "Invalid ad id"))
    ad = await db.advertisements.find_one({"_id": ObjectId(ad_id)})
    if not ad:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Ad not found"))
    new_state = not ad.get("isActive", True)
    await db.advertisements.update_one(
        {"_id": ObjectId(ad_id)},
        {"$set": {"isActive": new_state, "updatedAt": datetime.now(tz=timezone.utc)}},
    )
    return ok({"isActive": new_state})


@admin_router.delete("/{ad_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_ad(
    ad_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: dict = Depends(require_admin),
):
    if not ObjectId.is_valid(ad_id):
        raise HTTPException(status_code=400, detail=err("INVALID_ID", "Invalid ad id"))
    result = await db.advertisements.delete_one({"_id": ObjectId(ad_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Ad not found"))
