"""Users router: profile, approval management (admin), search, export."""
import csv
import io
import secrets
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from openpyxl import Workbook
from pydantic import BaseModel, EmailStr, Field
from core.security import hash_password

from core.database import get_db
from core.dependencies import get_current_user, require_admin
from core.utils import err, ok, paginate_response, serialize_doc, serialize_list

router = APIRouter(prefix="/users", tags=["users"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class UserApprovalIn(BaseModel):
    status: str  # APPROVED | REJECTED
    reason: str = ""


class FcmTokenIn(BaseModel):
    fcmToken: str



# Admin create/update schemas
class AddressIn(BaseModel):
    line1: str
    line2: str = ""
    city: str
    state: str
    pincode: str
    country: str = "IN"


class UserAdminCreateIn(BaseModel):
    fullName: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    mobile: str = Field(..., pattern=r"^[6-9]\d{9}$")
    address: AddressIn
    role: str = "MEMBER"
    status: str = "APPROVED"
    password: Optional[str] = None


class UserAdminUpdateIn(BaseModel):
    fullName: Optional[str] = None
    email: Optional[EmailStr] = None
    mobile: Optional[str] = None
    address: Optional[AddressIn] = None
    role: Optional[str] = None
    status: Optional[str] = None


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _build_search_filter(
    q: str | None,
    city: str | None,
    state: str | None,
    pincode: str | None,
    role: str | None,
    user_status: str | None,
) -> dict:
    flt: dict = {}
    if q:
        flt["$or"] = [
            {"fullName": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"mobile": {"$regex": q, "$options": "i"}},
        ]
    if city:
        flt["address.city"] = {"$regex": city, "$options": "i"}
    if state:
        flt["address.state"] = {"$regex": state, "$options": "i"}
    if pincode:
        flt["address.pincode"] = pincode
    if role:
        flt["role"] = role
    if user_status:
        flt["status"] = user_status
    return flt


def _user_export_row(u: dict) -> list:
    addr = u.get("address", {})
    return [
        u.get("id", ""),
        u.get("fullName", ""),
        u.get("email", ""),
        u.get("mobile", ""),
        addr.get("city", ""),
        addr.get("state", ""),
        addr.get("pincode", ""),
        u.get("role", ""),
        u.get("status", ""),
        str(u.get("createdAt", "")),
    ]


def _password_plan_row(u: dict) -> dict:
    return {
        "id": str(u.get("_id")),
        "fullName": u.get("fullName", ""),
        "email": u.get("email", ""),
        "mobile": u.get("mobile", ""),
        "role": u.get("role", ""),
        "status": u.get("status", ""),
        "password": u.get("passwordPlain", ""),
    }


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return ok(serialize_doc(current_user))


@router.patch("/me/fcm-token")
async def update_fcm_token(
    body: FcmTokenIn,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"fcmToken": body.fcmToken, "updatedAt": datetime.now(tz=timezone.utc)}},
    )
    return ok({"message": "FCM token updated"})


@router.get("")
async def list_users(
    q: str | None = Query(None),
    city: str | None = Query(None),
    state: str | None = Query(None),
    pincode: str | None = Query(None),
    role: str | None = Query(None),
    user_status: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort_by: str = Query("createdAt"),
    sort_dir: int = Query(-1),
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    flt = _build_search_filter(q, city, state, pincode, role, user_status)
    skip = (page - 1) * limit
    total = await db.users.count_documents(flt)
    cursor = db.users.find(flt, {"passwordHash": 0, "passwordPlain": 0}).sort(sort_by, sort_dir).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    return ok(paginate_response(serialize_list(docs), page, limit, total))


@router.get("/export")
async def export_users(
    q: str | None = Query(None),
    city: str | None = Query(None),
    state: str | None = Query(None),
    pincode: str | None = Query(None),
    role: str | None = Query(None),
    user_status: str | None = Query(None, alias="status"),
    fmt: str = Query("csv", pattern="^(csv|xlsx)$"),
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    flt = _build_search_filter(q, city, state, pincode, role, user_status)
    cursor = db.users.find(flt, {"passwordHash": 0, "passwordPlain": 0}).sort("createdAt", -1)
    docs = serialize_list(await cursor.to_list(length=10000))

    headers = ["ID", "Full Name", "Email", "Mobile", "City", "State", "Pincode", "Role", "Status", "Created At"]

    if fmt == "xlsx":
        wb = Workbook()
        ws = wb.active
        ws.title = "Members"
        ws.append(headers)
        for u in docs:
            ws.append(_user_export_row(u))
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=members.xlsx"},
        )

    # CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    for u in docs:
        writer.writerow(_user_export_row(u))
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=members.csv"},
    )


@router.get("/password-plan")
async def password_plan(
    q: str | None = Query(None),
    role: str | None = Query(None),
    user_status: str | None = Query(None, alias="status"),
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    flt = _build_search_filter(q, None, None, None, role, user_status)
    docs = await db.users.find(flt).sort("createdAt", -1).to_list(length=10000)
    rows = [_password_plan_row(u) for u in docs]
    return ok({"items": rows, "total": len(rows)})


@router.get("/{user_id}")
async def get_user(
    user_id: str,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "User not found"))
    payload = serialize_doc(user)
    payload["hasPassword"] = bool(user.get("passwordHash"))
    payload["password"] = user.get("passwordPlain") or ""
    payload.pop("passwordHash", None)
    payload.pop("passwordPlain", None)
    return ok(payload)


@router.patch("/{user_id}/approval")
async def approve_user(
    user_id: str,
    body: UserApprovalIn,
    admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if body.status not in ("APPROVED", "REJECTED"):
        raise HTTPException(
            status_code=400, detail=err("VALIDATION_ERROR", "status must be APPROVED or REJECTED")
        )
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "status": body.status,
                "approvalReason": body.reason,
                "updatedAt": datetime.now(tz=timezone.utc),
                "approvedBy": str(admin["_id"]),
            }
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "User not found"))
    return ok({"message": f"User {body.status.lower()} successfully."})


class PasswordUpdateIn(BaseModel):
    newPassword: str


@router.patch("/{user_id}/password")
async def admin_update_password(
    user_id: str,
    body: PasswordUpdateIn,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    now = datetime.now(tz=timezone.utc)
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"passwordHash": hash_password(body.newPassword), "passwordPlain": body.newPassword, "updatedAt": now}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "User not found"))

    # Revoke all refresh tokens for this user
    await db.refresh_tokens.delete_many({"userId": user_id})

    return ok({"message": "Password updated successfully."})


@router.post("", status_code=status.HTTP_201_CREATED)
async def admin_create_user(
    body: UserAdminCreateIn,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    # uniqueness
    existing = await db.users.find_one({"$or": [{"email": body.email.lower()}, {"mobile": body.mobile}]})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=err("CONFLICT", "Email or mobile already registered"))

    now = datetime.now(tz=timezone.utc)
    plain_pw = body.password or secrets.token_urlsafe(8)
    pw_hash = hash_password(plain_pw)
    doc = {
        "fullName": body.fullName,
        "email": body.email.lower(),
        "mobile": body.mobile,
        "address": body.address.model_dump(),
        "passwordHash": pw_hash,
        "passwordPlain": plain_pw,
        "role": body.role,
        "status": body.status,
        "fcmToken": None,
        "createdAt": now,
        "updatedAt": now,
        "approvedBy": str(_admin["_id"]) if body.status == "APPROVED" else None,
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return ok({"user": serialize_doc(doc), "password": plain_pw})


@router.patch("/{user_id}")
async def admin_update_user(
    user_id: str,
    body: UserAdminUpdateIn,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    updates: dict = {}
    if body.fullName is not None:
        updates["fullName"] = body.fullName
    if body.email is not None:
        # uniqueness check
        existing = await db.users.find_one({"email": body.email.lower(), "_id": {"$ne": ObjectId(user_id)}})
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=err("CONFLICT", "Email already registered"))
        updates["email"] = body.email.lower()
    if body.mobile is not None:
        existing = await db.users.find_one({"mobile": body.mobile, "_id": {"$ne": ObjectId(user_id)}})
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=err("CONFLICT", "Mobile already registered"))
        updates["mobile"] = body.mobile
    if body.address is not None:
        updates["address"] = body.address.model_dump()
    if body.role is not None:
        updates["role"] = body.role
    if body.status is not None:
        updates["status"] = body.status
        if body.status == "APPROVED":
            updates["approvedBy"] = str(_admin["_id"])

    if not updates:
        return ok({"message": "No changes"})

    updates["updatedAt"] = datetime.now(tz=timezone.utc)
    result = await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "User not found"))
    user = await db.users.find_one({"_id": ObjectId(user_id)}, {"passwordHash": 0})
    return ok(serialize_doc(user))


@router.delete("/{user_id}")
async def admin_delete_user(
    user_id: str,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail=err("NOT_FOUND", "User not found"))
    # prevent deleting SUPER_ADMIN or self
    if user.get("role") == "SUPER_ADMIN":
        raise HTTPException(status_code=400, detail=err("FORBIDDEN", "Cannot delete SUPER_ADMIN"))
    if str(_admin.get("_id")) == str(user.get("_id")):
        raise HTTPException(status_code=400, detail=err("FORBIDDEN", "Cannot delete yourself"))

    await db.users.delete_one({"_id": ObjectId(user_id)})
    await db.refresh_tokens.delete_many({"userId": user_id})
    return ok({"message": "User deleted"})
