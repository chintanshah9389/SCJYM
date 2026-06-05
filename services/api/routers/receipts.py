"""Receipts router — Generate and manage receipts for multi-user distribution.

Admin:
  POST   /admin/receipts         Create and store receipt
  GET    /admin/receipts         List all receipts
  GET    /admin/receipts/{id}    Get receipt details
  DELETE /admin/receipts/{id}    Delete receipt
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from core.database import get_db
from core.dependencies import require_admin
from core.utils import err, ok, paginate_response, serialize_doc, serialize_list

logger = logging.getLogger("receipts")

router = APIRouter(prefix="/receipts", tags=["receipts"])
admin_router = APIRouter(prefix="/admin/receipts", tags=["admin-receipts"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class ReceiptRecipient(BaseModel):
    userId: str
    userName: Optional[str] = None
    userEmail: Optional[str] = None
    userPhone: Optional[str] = None
    sentAt: Optional[datetime] = None
    deliveryStatus: str = "pending"  # pending, sent, failed


class ReceiptIn(BaseModel):
    receiptNum: str
    header: str
    body: str
    recipients: list[str]  # User IDs
    notificationTitle: Optional[str] = None
    notificationBody: Optional[str] = None


class Receipt(BaseModel):
    id: str = Field(alias="_id")
    receiptNum: str
    header: str
    body: str
    recipients: list[ReceiptRecipient]
    createdBy: str
    createdAt: datetime
    updatedAt: datetime

    class Config:
        populate_by_name = True


# ─── Admin Endpoints ────────────────────────────────────────────────────────

@admin_router.post("")
async def create_receipt(
    receipt_in: ReceiptIn,
    current_user: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Create and store a receipt for distribution to multiple users."""
    try:
        # Fetch recipient details
        recipients_data = []
        if receipt_in.recipients:
            user_ids = [ObjectId(uid) if ObjectId.is_valid(uid) else uid for uid in receipt_in.recipients]
            users = await db.users.find({"_id": {"$in": user_ids}}).to_list(None)
            user_map = {str(u["_id"]): u for u in users}

            for uid in receipt_in.recipients:
                user = user_map.get(uid)
                recipients_data.append({
                    "userId": uid,
                    "userName": user.get("fullName") if user else None,
                    "userEmail": user.get("email") if user else None,
                    "userPhone": user.get("phone") if user else None,
                    "sentAt": None,
                    "deliveryStatus": "pending",
                })

        receipt_doc = {
            "receiptNum": receipt_in.receiptNum,
            "header": receipt_in.header,
            "body": receipt_in.body,
            "recipients": recipients_data,
            "createdBy": str(current_user["_id"]),
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
        }

        result = await db.receipts.insert_one(receipt_doc)
        receipt_doc["_id"] = result.inserted_id

        logger.info(f"Receipt created: {receipt_in.receiptNum} for {len(recipients_data)} recipients")

        return ok(
            serialize_doc(receipt_doc),
            message=f"Receipt created and stored for {len(recipients_data)} recipients",
        )

    except Exception as e:
        logger.error(f"Error creating receipt: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=err("RECEIPT_CREATE_FAILED", str(e)),
        )


@admin_router.get("")
async def list_receipts(
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """List all receipts created."""
    try:
        total = await db.receipts.count_documents({})
        items = (
            await db.receipts.find({})
            .sort("createdAt", -1)
            .skip(skip)
            .limit(limit)
            .to_list(limit)
        )

        return ok(
            paginate_response(
                items=[serialize_doc(doc) for doc in items],
                total=total,
                skip=skip,
                limit=limit,
            )
        )

    except Exception as e:
        logger.error(f"Error listing receipts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=err("RECEIPT_LIST_FAILED", str(e)),
        )


@admin_router.get("/{receipt_id}")
async def get_receipt(
    receipt_id: str,
    current_user: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get receipt details."""
    try:
        oid = ObjectId(receipt_id)
        receipt = await db.receipts.find_one({"_id": oid})

        if not receipt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=err("NOT_FOUND", "Receipt not found"),
            )

        return ok(serialize_doc(receipt))

    except Exception as e:
        logger.error(f"Error fetching receipt: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=err("RECEIPT_FETCH_FAILED", str(e)),
        )


@admin_router.delete("/{receipt_id}")
async def delete_receipt(
    receipt_id: str,
    current_user: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Delete a receipt."""
    try:
        oid = ObjectId(receipt_id)
        result = await db.receipts.delete_one({"_id": oid})

        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=err("NOT_FOUND", "Receipt not found"),
            )

        logger.info(f"Receipt deleted: {receipt_id}")
        return ok(message="Receipt deleted")

    except Exception as e:
        logger.error(f"Error deleting receipt: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=err("RECEIPT_DELETE_FAILED", str(e)),
        )
