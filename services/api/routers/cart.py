"""Cart router.

Endpoints:
  GET    /cart                   Get current user's cart
  POST   /cart                   Add or increment item
  PATCH  /cart/{productId}       Update item quantity
  DELETE /cart/{productId}       Remove item from cart
  DELETE /cart                   Clear entire cart
"""
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from core.database import get_db
from core.dependencies import get_current_user
from core.utils import err, ok, serialize_doc

router = APIRouter(prefix="/cart", tags=["cart"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class AddToCartIn(BaseModel):
    productId: str
    quantity: int = Field(1, ge=1)


class UpdateQuantityIn(BaseModel):
    quantity: int = Field(..., ge=1)


# ─── Helper ──────────────────────────────────────────────────────────────────

async def _get_or_create_cart(db, user_id: str) -> dict:
    cart = await db.carts.find_one({"userId": user_id})
    if not cart:
        now = datetime.now(tz=timezone.utc)
        doc = {"userId": user_id, "items": [], "updatedAt": now}
        result = await db.carts.insert_one(doc)
        doc["_id"] = result.inserted_id
        cart = doc
    return cart


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.get("")
async def get_cart(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    cart = await _get_or_create_cart(db, str(current_user["_id"]))
    return ok(serialize_doc(cart))


@router.post("", status_code=status.HTTP_200_OK)
async def add_to_cart(
    body: AddToCartIn,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        product = await db.products.find_one({"_id": ObjectId(body.productId)})
    except Exception:
        raise HTTPException(status_code=400, detail=err("INVALID_ID", "Invalid product id"))

    if not product or product.get("status") != "APPROVED":
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Product not available"))

    if product.get("inventory", 0) < body.quantity:
        raise HTTPException(
            status_code=400, detail=err("INSUFFICIENT_STOCK", "Not enough inventory")
        )

    user_id = str(current_user["_id"])
    now = datetime.now(tz=timezone.utc)

    # Check if item already in cart → increment
    existing = await db.carts.find_one(
        {"userId": user_id, "items.productId": body.productId}
    )
    if existing:
        await db.carts.update_one(
            {"userId": user_id, "items.productId": body.productId},
            {
                "$inc": {"items.$.quantity": body.quantity},
                "$set": {"updatedAt": now},
            },
        )
    else:
        cart_item = {
            "productId": body.productId,
            "title": product["title"],
            "imageUrl": product["images"][0] if product.get("images") else None,
            "price": product["price"],
            "quantity": body.quantity,
        }
        await db.carts.update_one(
            {"userId": user_id},
            {"$push": {"items": cart_item}, "$set": {"updatedAt": now}},
            upsert=True,
        )

    # Track add-to-cart event on product
    await db.products.update_one(
        {"_id": ObjectId(body.productId)},
        {"$inc": {"addToCartCount": 1}, "$set": {"lastActivityAt": now}},
    )

    cart = await db.carts.find_one({"userId": user_id})
    return ok(serialize_doc(cart))


@router.patch("/{product_id}")
async def update_cart_item(
    product_id: str,
    body: UpdateQuantityIn,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user_id = str(current_user["_id"])
    now = datetime.now(tz=timezone.utc)

    result = await db.carts.update_one(
        {"userId": user_id, "items.productId": product_id},
        {
            "$set": {"items.$.quantity": body.quantity, "updatedAt": now},
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Item not in cart"))

    cart = await db.carts.find_one({"userId": user_id})
    return ok(serialize_doc(cart))


@router.delete("/{product_id}")
async def remove_cart_item(
    product_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user_id = str(current_user["_id"])
    now = datetime.now(tz=timezone.utc)

    result = await db.carts.update_one(
        {"userId": user_id},
        {
            "$pull": {"items": {"productId": product_id}},
            "$set": {"updatedAt": now},
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Cart not found"))

    cart = await db.carts.find_one({"userId": user_id})
    return ok(serialize_doc(cart))


@router.delete("")
async def clear_cart(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user_id = str(current_user["_id"])
    await db.carts.update_one(
        {"userId": user_id},
        {"$set": {"items": [], "updatedAt": datetime.now(tz=timezone.utc)}},
        upsert=True,
    )
    return ok({"message": "Cart cleared"})
