"""Menu router.

Public:
  GET /menu              Mobile fetches enabled menu items (filtered by user role if auth)

Admin:
  GET    /admin/menu          List all menu items
  POST   /admin/menu          Create menu item
  PUT    /admin/menu/{id}     Update menu item
  DELETE /admin/menu/{id}     Delete menu item
"""
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from core.database import get_db
from core.dependencies import get_current_user, require_admin
from core.utils import err, ok, serialize_doc, serialize_list

router = APIRouter(prefix="/menu", tags=["menu"])
admin_router = APIRouter(prefix="/admin/menu", tags=["admin-menu"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class MenuItemIn(BaseModel):
    label: str
    icon: str = ""
    order: int = 0
    enabled: bool = True
    rolesVisible: list[str] = ["MEMBER", "ADMIN", "SUPER_ADMIN"]
    type: str         # SCREEN_ROUTE | WEB_URL | YOUTUBE_URL | LIVE_URL | CATEGORY
    target: str


# ─── Public menu ──────────────────────────────────────────────────────────────

@router.get("")
async def get_menu(
    db: AsyncIOMotorDatabase = Depends(get_db),
    # Optional auth — filter by role if provided
    current_user: dict | None = None,
):
    flt: dict = {"enabled": True}
    cursor = db.menu_items.find(flt).sort("order", 1)
    items = await cursor.to_list(length=200)
    serialized = serialize_list(items)

    # Filter by rolesVisible if user is authenticated
    if current_user:
        role = current_user.get("role", "MEMBER")
        serialized = [i for i in serialized if role in (i.get("rolesVisible") or [])]

    return ok(serialized)


# ─── Admin menu ───────────────────────────────────────────────────────────────

@admin_router.get("")
async def admin_list_menu(
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    cursor = db.menu_items.find({}).sort("order", 1)
    items = await cursor.to_list(length=200)
    return ok(serialize_list(items))


@admin_router.post("", status_code=status.HTTP_201_CREATED)
async def admin_create_menu_item(
    body: MenuItemIn,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    now = datetime.now(tz=timezone.utc)
    doc = {**body.model_dump(), "createdAt": now, "updatedAt": now}
    result = await db.menu_items.insert_one(doc)
    doc["_id"] = result.inserted_id
    return ok(serialize_doc(doc))


@admin_router.put("/{item_id}")
async def admin_update_menu_item(
    item_id: str,
    body: MenuItemIn,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    updates = {**body.model_dump(), "updatedAt": datetime.now(tz=timezone.utc)}
    result = await db.menu_items.update_one({"_id": ObjectId(item_id)}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Menu item not found"))
    updated = await db.menu_items.find_one({"_id": ObjectId(item_id)})
    return ok(serialize_doc(updated))


@admin_router.delete("/{item_id}")
async def admin_delete_menu_item(
    item_id: str,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    result = await db.menu_items.delete_one({"_id": ObjectId(item_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Menu item not found"))
    return ok({"message": "Menu item deleted"})
