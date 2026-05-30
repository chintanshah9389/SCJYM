"""Ratings and Comments router.

Endpoints:
  POST   /products/{id}/ratings           Upsert rating (authenticated)
  GET    /products/{id}/ratings/mine      Get my rating for a product
  GET    /products/{id}/comments          List visible comments (paginated)
  POST   /products/{id}/comments          Add comment (authenticated)
  PATCH  /products/{pid}/comments/{cid}   Edit comment (owner only)
  DELETE /products/{pid}/comments/{cid}   Delete comment (owner or admin)

  Admin:
  GET    /admin/comments                  List all comments (with filters)
  PATCH  /admin/comments/{cid}/hide       Hide a comment
  DELETE /admin/comments/{cid}            Hard-delete a comment
"""
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from core.database import get_db
from core.dependencies import get_current_user, require_admin
from core.utils import err, ok, paginate_response, serialize_doc, serialize_list

router = APIRouter(tags=["ratings-comments"])
admin_router = APIRouter(prefix="/admin", tags=["admin-moderation"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class RatingIn(BaseModel):
    score: int = Field(..., ge=1, le=5)


class CommentIn(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)


class CommentUpdateIn(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)


# ─── Aggregate helpers ────────────────────────────────────────────────────────

async def _update_product_rating_aggregates(db, product_id: str) -> None:
    """Recompute avgRating and ratingCount from the ratings collection for a product."""
    pipeline = [
        {"$match": {"productId": product_id}},
        {"$group": {"_id": None, "avg": {"$avg": "$score"}, "count": {"$sum": 1}}},
    ]
    result = await db.ratings.aggregate(pipeline).to_list(length=1)
    if result:
        avg_rating = round(result[0]["avg"], 2)
        rating_count = result[0]["count"]
    else:
        avg_rating = 0.0
        rating_count = 0

    # Load global mean from ranking config for Bayesian calc
    config = await db.ranking_config.find_one({"_id": "ranking_config"})
    global_mean = config.get("globalMeanRating", 4.0) if config else 4.0
    prior_strength = config.get("priorStrength", 10) if config else 10

    v = rating_count
    m = prior_strength
    R = avg_rating
    C = global_mean
    bayesian = (v / (v + m)) * R + (m / (v + m)) * C if (v + m) > 0 else C

    await db.products.update_one(
        {"_id": ObjectId(product_id)},
        {
            "$set": {
                "avgRating": avg_rating,
                "ratingCount": rating_count,
                "bayesianRating": round(bayesian, 4),
                "updatedAt": datetime.now(tz=timezone.utc),
            }
        },
    )


# ─── Ratings ─────────────────────────────────────────────────────────────────

@router.post("/products/{product_id}/ratings", status_code=status.HTTP_200_OK)
async def upsert_rating(
    product_id: str,
    body: RatingIn,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    product = await db.products.find_one({"_id": ObjectId(product_id)})
    if not product or product.get("status") != "APPROVED":
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Product not found"))
    if product.get("ratingsLocked"):
        raise HTTPException(status_code=403, detail=err("LOCKED", "Ratings are locked on this product"))

    user_id = str(current_user["_id"])
    now = datetime.now(tz=timezone.utc)

    existing = await db.ratings.find_one({"productId": product_id, "userId": user_id})
    if existing:
        await db.ratings.update_one(
            {"productId": product_id, "userId": user_id},
            {"$set": {"score": body.score, "updatedAt": now}},
        )
    else:
        await db.ratings.insert_one(
            {
                "productId": product_id,
                "userId": user_id,
                "score": body.score,
                "createdAt": now,
                "updatedAt": now,
            }
        )

    await _update_product_rating_aggregates(db, product_id)
    return ok({"message": "Rating saved", "score": body.score})


@router.get("/products/{product_id}/ratings/mine")
async def get_my_rating(
    product_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    rating = await db.ratings.find_one(
        {"productId": product_id, "userId": str(current_user["_id"])}
    )
    return ok(serialize_doc(rating))


# ─── Comments ─────────────────────────────────────────────────────────────────

@router.get("/products/{product_id}/comments")
async def list_comments(
    product_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    flt = {"productId": product_id, "status": "VISIBLE"}
    skip = (page - 1) * limit
    total = await db.comments.count_documents(flt)
    cursor = db.comments.find(flt).sort("createdAt", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    return ok(paginate_response(serialize_list(docs), page, limit, total))


@router.post("/products/{product_id}/comments", status_code=status.HTTP_201_CREATED)
async def add_comment(
    product_id: str,
    body: CommentIn,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    product = await db.products.find_one({"_id": ObjectId(product_id)})
    if not product or product.get("status") != "APPROVED":
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Product not found"))
    if product.get("commentsLocked"):
        raise HTTPException(status_code=403, detail=err("LOCKED", "Comments are locked"))

    now = datetime.now(tz=timezone.utc)
    doc = {
        "productId": product_id,
        "userId": str(current_user["_id"]),
        "userFullName": current_user.get("fullName", ""),
        "body": body.body,
        "status": "VISIBLE",
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db.comments.insert_one(doc)
    doc["_id"] = result.inserted_id
    return ok(serialize_doc(doc))


@router.patch("/products/{product_id}/comments/{comment_id}")
async def update_comment(
    product_id: str,
    comment_id: str,
    body: CommentUpdateIn,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    comment = await db.comments.find_one({"_id": ObjectId(comment_id), "productId": product_id})
    if not comment:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Comment not found"))

    is_owner = comment["userId"] == str(current_user["_id"])
    is_admin = current_user.get("role") in ("ADMIN", "SUPER_ADMIN")
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail=err("FORBIDDEN", "Not allowed"))
    if comment.get("status") == "DELETED":
        raise HTTPException(status_code=400, detail=err("DELETED", "Comment is deleted"))

    await db.comments.update_one(
        {"_id": ObjectId(comment_id)},
        {"$set": {"body": body.body, "updatedAt": datetime.now(tz=timezone.utc)}},
    )
    updated = await db.comments.find_one({"_id": ObjectId(comment_id)})
    return ok(serialize_doc(updated))


@router.delete("/products/{product_id}/comments/{comment_id}")
async def delete_comment(
    product_id: str,
    comment_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    comment = await db.comments.find_one({"_id": ObjectId(comment_id), "productId": product_id})
    if not comment:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Comment not found"))

    is_owner = comment["userId"] == str(current_user["_id"])
    is_admin = current_user.get("role") in ("ADMIN", "SUPER_ADMIN")
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail=err("FORBIDDEN", "Not allowed"))

    # Soft-delete for owners, hard-delete for admins
    if is_admin:
        await db.comments.update_one(
            {"_id": ObjectId(comment_id)},
            {"$set": {"status": "DELETED", "updatedAt": datetime.now(tz=timezone.utc)}},
        )
    else:
        await db.comments.update_one(
            {"_id": ObjectId(comment_id)},
            {"$set": {"status": "DELETED", "updatedAt": datetime.now(tz=timezone.utc)}},
        )
    return ok({"message": "Comment deleted"})


# ─── Admin moderation ────────────────────────────────────────────────────────

@admin_router.get("/comments")
async def admin_list_comments(
    product_id: str | None = Query(None),
    comment_status: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    flt: dict = {}
    if product_id:
        flt["productId"] = product_id
    if comment_status:
        flt["status"] = comment_status
    skip = (page - 1) * limit
    total = await db.comments.count_documents(flt)
    cursor = db.comments.find(flt).sort("createdAt", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    return ok(paginate_response(serialize_list(docs), page, limit, total))


@admin_router.patch("/comments/{comment_id}/hide")
async def admin_hide_comment(
    comment_id: str,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    result = await db.comments.update_one(
        {"_id": ObjectId(comment_id)},
        {"$set": {"status": "HIDDEN", "updatedAt": datetime.now(tz=timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Comment not found"))
    return ok({"message": "Comment hidden"})


@admin_router.delete("/comments/{comment_id}")
async def admin_delete_comment(
    comment_id: str,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    result = await db.comments.update_one(
        {"_id": ObjectId(comment_id)},
        {"$set": {"status": "DELETED", "updatedAt": datetime.now(tz=timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "Comment not found"))
    return ok({"message": "Comment deleted"})
