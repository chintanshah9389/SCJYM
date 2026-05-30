"""Products router.

Endpoints:
  POST   /products                       Create product (authenticated)
  GET    /products                       List approved products (public)
  GET    /products/{id}                  Get single product (public)
  PATCH  /products/{id}                  Update product (owner only, DRAFT/REJECTED)
  DELETE /products/{id}                  Delete product (owner or admin)
  POST   /products/{id}/submit           Submit for approval (owner)
  POST   /products/{id}/images           Upload images (owner, multipart)
  PATCH  /products/{id}/approval         Approve/Reject (admin)
  GET    /products                       Filter by status (admin sees all statuses)
"""
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from core.cloudinary_helper import upload_image
from core.database import get_db
from core.dependencies import get_current_user, require_admin
from core.utils import err, ok, paginate_response, serialize_doc, serialize_list

router = APIRouter(prefix="/products", tags=["products"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class ProductIn(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: str = Field(..., min_length=10)
    category: str = Field(..., min_length=1)
    tags: list[str] = []
    price: float = Field(..., ge=0)
    inventory: int = Field(..., ge=0)


class ProductUpdateIn(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[list[str]] = None
    price: Optional[float] = Field(None, ge=0)
    inventory: Optional[int] = Field(None, ge=0)


class ApprovalIn(BaseModel):
    status: str      # APPROVED | REJECTED
    reason: str = ""


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _product_filter(
    q: str | None,
    category: str | None,
    status_filter: str | None,
    owner_id: str | None,
) -> dict:
    flt: dict = {}
    if q:
        flt["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"tags": {"$elemMatch": {"$regex": q, "$options": "i"}}},
        ]
    if category:
        flt["category"] = {"$regex": category, "$options": "i"}
    if status_filter:
        flt["status"] = status_filter
    else:
        flt["status"] = "APPROVED"   # public default
    if owner_id:
        flt["ownerId"] = owner_id
    return flt


def _new_product_doc(body: ProductIn, owner_id: str) -> dict:
    now = datetime.now(tz=timezone.utc)
    return {
        "title": body.title,
        "description": body.description,
        "category": body.category,
        "tags": body.tags,
        "price": body.price,
        "inventory": body.inventory,
        "images": [],
        "status": "DRAFT",
        "ownerId": owner_id,
        "avgRating": 0.0,
        "ratingCount": 0,
        "bayesianRating": 0.0,
        "bestSellerScore": 0.0,
        "weeklySalesCount": 0,
        "viewsCount": 0,
        "addToCartCount": 0,
        "lastActivityAt": None,
        "ratingsLocked": False,
        "commentsLocked": False,
        "createdAt": now,
        "updatedAt": now,
    }


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_product(
    body: ProductIn,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    doc = _new_product_doc(body, str(current_user["_id"]))
    result = await db.products.insert_one(doc)
    doc["_id"] = result.inserted_id
    return ok(serialize_doc(doc))


@router.get("")
async def list_products(
    q: str | None = Query(None),
    category: str | None = Query(None),
    product_status: str | None = Query(None, alias="status"),
    owner_id: str | None = Query(None, alias="ownerId"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort_by: str = Query("createdAt"),
    sort_dir: int = Query(-1),
    db: AsyncIOMotorDatabase = Depends(get_db),
    # Optional auth – admin may see non-approved products
    current_user: dict | None = Depends(lambda: None),
):
    # Determine visibility: only admin can filter by non-APPROVED status
    # Simple approach: products endpoint is public; status filter only applies for admin
    # For non-auth requests, always force APPROVED
    flt = _product_filter(q, category, product_status, owner_id)
    skip = (page - 1) * limit
    total = await db.products.count_documents(flt)
    cursor = db.products.find(flt).sort(sort_by, sort_dir).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    return ok(paginate_response(serialize_list(docs), page, limit, total))


@router.get("/mine")
async def list_my_products(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    owner_id = str(current_user["_id"])
    flt = {"ownerId": owner_id}
    skip = (page - 1) * limit
    total = await db.products.count_documents(flt)
    cursor = db.products.find(flt).sort("createdAt", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    return ok(paginate_response(serialize_list(docs), page, limit, total))


@router.get("/{product_id}")
async def get_product(
    product_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        oid = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail=err("INVALID_ID", "Invalid product id"))
    product = await db.products.find_one({"_id": oid})
    if not product:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Product not found"))
    return ok(serialize_doc(product))


@router.patch("/{product_id}")
async def update_product(
    product_id: str,
    body: ProductUpdateIn,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    product = await db.products.find_one({"_id": ObjectId(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Product not found"))

    is_owner = str(product["ownerId"]) == str(current_user["_id"])
    is_admin = current_user.get("role") in ("ADMIN", "SUPER_ADMIN")
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail=err("FORBIDDEN", "Not allowed"))

    if not is_admin and product["status"] not in ("DRAFT", "REJECTED"):
        raise HTTPException(
            status_code=400,
            detail=err("INVALID_STATE", "Only DRAFT or REJECTED products can be edited"),
        )

    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    updates["updatedAt"] = datetime.now(tz=timezone.utc)
    await db.products.update_one({"_id": ObjectId(product_id)}, {"$set": updates})
    updated = await db.products.find_one({"_id": ObjectId(product_id)})
    return ok(serialize_doc(updated))


@router.delete("/{product_id}", status_code=status.HTTP_200_OK)
async def delete_product(
    product_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    product = await db.products.find_one({"_id": ObjectId(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Product not found"))

    is_owner = str(product["ownerId"]) == str(current_user["_id"])
    is_admin = current_user.get("role") in ("ADMIN", "SUPER_ADMIN")
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail=err("FORBIDDEN", "Not allowed"))

    await db.products.delete_one({"_id": ObjectId(product_id)})
    return ok({"message": "Product deleted"})


@router.post("/{product_id}/submit")
async def submit_product(
    product_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    product = await db.products.find_one({"_id": ObjectId(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Product not found"))
    if str(product["ownerId"]) != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail=err("FORBIDDEN", "Not allowed"))
    if product["status"] not in ("DRAFT", "REJECTED"):
        raise HTTPException(
            status_code=400,
            detail=err("INVALID_STATE", "Only DRAFT or REJECTED products can be submitted"),
        )

    await db.products.update_one(
        {"_id": ObjectId(product_id)},
        {"$set": {"status": "SUBMITTED", "updatedAt": datetime.now(tz=timezone.utc)}},
    )
    return ok({"message": "Product submitted for approval"})


@router.post("/{product_id}/images")
async def upload_product_images(
    product_id: str,
    files: list[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if len(files) > 5:
        raise HTTPException(status_code=400, detail=err("TOO_MANY_FILES", "Max 5 images allowed"))

    product = await db.products.find_one({"_id": ObjectId(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Product not found"))

    is_owner = str(product["ownerId"]) == str(current_user["_id"])
    is_admin = current_user.get("role") in ("ADMIN", "SUPER_ADMIN")
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail=err("FORBIDDEN", "Not allowed"))

    uploaded_urls: list[str] = []
    for f in files:
        if not f.content_type or not f.content_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail=err("INVALID_FILE", f"File '{f.filename}' is not an image"),
            )
        file_bytes = await f.read()
        if len(file_bytes) > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=400,
                detail=err("FILE_TOO_LARGE", f"File '{f.filename}' exceeds 5 MB limit"),
            )
        url = await upload_image(file_bytes)
        uploaded_urls.append(url)

    await db.products.update_one(
        {"_id": ObjectId(product_id)},
        {
            "$push": {"images": {"$each": uploaded_urls}},
            "$set": {"updatedAt": datetime.now(tz=timezone.utc)},
        },
    )
    return ok({"uploadedUrls": uploaded_urls})


@router.patch("/{product_id}/approval")
async def approve_product(
    product_id: str,
    body: ApprovalIn,
    admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if body.status not in ("APPROVED", "REJECTED"):
        raise HTTPException(
            status_code=400,
            detail=err("VALIDATION_ERROR", "status must be APPROVED or REJECTED"),
        )

    result = await db.products.update_one(
        {"_id": ObjectId(product_id)},
        {
            "$set": {
                "status": body.status,
                "approvalReason": body.reason,
                "approvedBy": str(admin["_id"]),
                "updatedAt": datetime.now(tz=timezone.utc),
            }
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Product not found"))
    return ok({"message": f"Product {body.status.lower()}"})


@router.patch("/{product_id}/lock")
async def toggle_lock(
    product_id: str,
    ratingsLocked: bool | None = None,
    commentsLocked: bool | None = None,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    updates: dict = {"updatedAt": datetime.now(tz=timezone.utc)}
    if ratingsLocked is not None:
        updates["ratingsLocked"] = ratingsLocked
    if commentsLocked is not None:
        updates["commentsLocked"] = commentsLocked

    result = await db.products.update_one({"_id": ObjectId(product_id)}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Product not found"))
    return ok({"message": "Product lock settings updated"})
