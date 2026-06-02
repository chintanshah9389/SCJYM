"""Auth router: register, login, refresh, logout, forgot/reset password."""
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import secrets
from pymongo.errors import DuplicateKeyError

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, EmailStr, Field

from core.database import get_db
from core.config import get_settings
from core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
)
from core.email import send_password_reset_email
from core.utils import serialize_doc, ok, err

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


# ─── Pydantic Schemas ────────────────────────────────────────────────────────

class AddressIn(BaseModel):
    line1: str
    line2: str = ""
    city: str
    state: str
    pincode: str
    country: str = "IN"


class RegisterIn(BaseModel):
    fullName: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    mobile: str = Field(..., pattern=r"^[6-9]\d{9}$")
    address: AddressIn
    password: str = Field(..., min_length=8)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RefreshIn(BaseModel):
    refreshToken: str


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    newPassword: str = Field(..., min_length=8)


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _store_refresh_token(db, user_id: str, token: str) -> None:
    expires_at = datetime.now(tz=timezone.utc) + timedelta(days=30)
    await db.refresh_tokens.insert_one(
        {"userId": user_id, "token": token, "expiresAt": expires_at}
    )


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterIn, db: AsyncIOMotorDatabase = Depends(get_db)):
    import logging
    logging.basicConfig(level=logging.DEBUG)
    logger = logging.getLogger("auth.register")
    try:
        existing = await db.users.find_one(
            {"$or": [{"email": body.email}, {"mobile": body.mobile}]}
        )
        logger.info("DB lookup for register OK, existing user: %s", existing is not None)
    except Exception as e:
        logger.exception("DB find_one failed during register: %s", e)
        raise HTTPException(
            status_code=500,
            detail=err("DB_ERROR", f"Database error: {type(e).__name__}: {str(e)}"),
        )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=err("CONFLICT", "Email or mobile already registered"),
        )

    now = datetime.now(tz=timezone.utc)
    try:
        password_hash = hash_password(body.password)
    except Exception as e:
        logger.exception("Password hashing failed during register: %s", e)
        raise HTTPException(
            status_code=500,
            detail=err("PASSWORD_HASH_ERROR", "Could not process password"),
        )

    doc = {
        "fullName": body.fullName,
        "email": body.email.lower(),
        "mobile": body.mobile,
        "address": body.address.model_dump(),
        "passwordHash": password_hash,
        "role": "MEMBER",
        "status": "PENDING_APPROVAL",
        "fcmToken": None,
        "createdAt": now,
        "updatedAt": now,
    }
    try:
        result = await db.users.insert_one(doc)
        doc["_id"] = result.inserted_id
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=err("CONFLICT", "Email or mobile already registered"),
        )
    except Exception as e:
        logger.exception("DB insert_one failed during register: %s", e)
        raise HTTPException(
            status_code=500,
            detail=err("DB_ERROR", f"Database error: {type(e).__name__}: {str(e)}"),
        )
    return ok(
        {
            "message": "Registration successful. Awaiting admin approval.",
            "user": serialize_doc(doc),
        }
    )


@router.post("/login")
async def login(body: LoginIn, db: AsyncIOMotorDatabase = Depends(get_db)):
    import logging
    logging.basicConfig(level=logging.DEBUG)
    logger = logging.getLogger("auth.login")
    try:
        user = await db.users.find_one({"email": body.email.lower()})
        logger.info("DB lookup OK, user found: %s", user is not None)
    except Exception as e:
        logger.exception("DB find_one failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail=err("DB_ERROR", f"Database error: {type(e).__name__}: {str(e)}")
        )

    # Development fallback: recover SUPER_ADMIN account if DB password drifted.
    if (
        settings.app_env == "development"
        and body.email.lower() == settings.super_admin_email.lower()
        and body.password == settings.super_admin_password
    ):
        now = datetime.now(tz=timezone.utc)
        if not user:
            doc = {
                "fullName": settings.super_admin_full_name,
                "email": settings.super_admin_email.lower(),
                "mobile": "0000000000",
                "address": {
                    "line1": "System",
                    "line2": "",
                    "city": "System",
                    "state": "System",
                    "pincode": "000000",
                    "country": "IN",
                },
                "passwordHash": hash_password(settings.super_admin_password),
                "role": "SUPER_ADMIN",
                "status": "APPROVED",
                "fcmToken": None,
                "createdAt": now,
                "updatedAt": now,
            }
            inserted = await db.users.insert_one(doc)
            doc["_id"] = inserted.inserted_id
            user = doc
        elif not verify_password(body.password, user.get("passwordHash", "")):
            await db.users.update_one(
                {"_id": user["_id"]},
                {
                    "$set": {
                        "passwordHash": hash_password(settings.super_admin_password),
                        "role": "SUPER_ADMIN",
                        "status": "APPROVED",
                        "updatedAt": now,
                    }
                },
            )
            user = await db.users.find_one({"_id": user["_id"]})

    if not user or not verify_password(body.password, user.get("passwordHash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err("INVALID_CREDENTIALS", "Invalid email or password"),
        )

    if user["status"] == "PENDING_APPROVAL":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=err("PENDING_APPROVAL", "Your account is pending admin approval."),
        )

    if user["status"] == "REJECTED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=err("ACCOUNT_REJECTED", "Your account has been rejected."),
        )

    uid = str(user["_id"])
    access_token = create_access_token(uid, user["role"])
    refresh_token = create_refresh_token(uid)
    await _store_refresh_token(db, uid, refresh_token)

    return ok(
        {
            "accessToken": access_token,
            "refreshToken": refresh_token,
            "user": serialize_doc(user),
        }
    )


@router.post("/refresh")
async def refresh_token(body: RefreshIn, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        payload = decode_refresh_token(body.refreshToken)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err("INVALID_TOKEN", "Invalid or expired refresh token"),
        )

    stored = await db.refresh_tokens.find_one({"token": body.refreshToken})
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err("TOKEN_REVOKED", "Refresh token has been revoked"),
        )

    user_id = payload["sub"]
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user or user["status"] != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=err("FORBIDDEN", "Account not approved"),
        )

    # Rotate: delete old, create new
    await db.refresh_tokens.delete_one({"token": body.refreshToken})
    new_access = create_access_token(user_id, user["role"])
    new_refresh = create_refresh_token(user_id)
    await _store_refresh_token(db, user_id, new_refresh)

    return ok({"accessToken": new_access, "refreshToken": new_refresh})


@router.post("/logout")
async def logout(body: RefreshIn, db: AsyncIOMotorDatabase = Depends(get_db)):
    await db.refresh_tokens.delete_one({"token": body.refreshToken})
    return ok({"message": "Logged out successfully"})


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordIn, db: AsyncIOMotorDatabase = Depends(get_db)):
    user = await db.users.find_one({"email": body.email.lower()})
    # Always return 200 to avoid email enumeration
    if user:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(tz=timezone.utc) + timedelta(hours=1)
        await db.password_reset_tokens.insert_one(
            {"userId": str(user["_id"]), "token": token, "expiresAt": expires_at}
        )
        await send_password_reset_email(user["email"], token)
    return ok({"message": "If that email exists, a reset link has been sent."})


@router.post("/reset-password")
async def reset_password(body: ResetPasswordIn, db: AsyncIOMotorDatabase = Depends(get_db)):
    stored = await db.password_reset_tokens.find_one({"token": body.token})
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err("INVALID_TOKEN", "Token is invalid or has expired"),
        )

    now = datetime.now(tz=timezone.utc)
    await db.users.update_one(
        {"_id": ObjectId(stored["userId"])},
        {
            "$set": {
                "passwordHash": hash_password(body.newPassword),
                "updatedAt": now,
            }
        },
    )
    await db.password_reset_tokens.delete_one({"token": body.token})
    # Revoke all refresh tokens for this user
    await db.refresh_tokens.delete_many({"userId": stored["userId"]})
    return ok({"message": "Password reset successful. Please log in."})
