from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from core.config import get_settings
import logging

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt", "pbkdf2_sha256"], deprecated="auto")

ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"


def hash_password(plain: str) -> str:
    try:
        # Prefer bcrypt when backend is available.
        return pwd_context.hash(plain, scheme="bcrypt")
    except Exception as exc:
        logging.getLogger("core.security").warning(
            "bcrypt hash failed; falling back to pbkdf2_sha256: %s", exc
        )
        return pwd_context.hash(plain, scheme="pbkdf2_sha256")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception as exc:
        logging.getLogger("core.security").warning(
            "password verify failed: %s", exc
        )
        return False


def _create_token(data: dict, secret: str, ttl: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(tz=timezone.utc) + ttl
    payload["iat"] = datetime.now(tz=timezone.utc)
    return jwt.encode(payload, secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: str, role: str) -> str:
    return _create_token(
        {"sub": user_id, "role": role, "type": ACCESS_TOKEN_TYPE},
        settings.jwt_secret,
        timedelta(minutes=settings.jwt_access_ttl_minutes),
    )


def create_refresh_token(user_id: str) -> str:
    return _create_token(
        {"sub": user_id, "type": REFRESH_TOKEN_TYPE},
        settings.jwt_refresh_secret,
        timedelta(days=settings.jwt_refresh_ttl_days),
    )


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != ACCESS_TOKEN_TYPE:
            raise JWTError("Wrong token type")
        return payload
    except JWTError as exc:
        raise ValueError("Invalid access token") from exc


def decode_refresh_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token, settings.jwt_refresh_secret, algorithms=[settings.jwt_algorithm]
        )
        if payload.get("type") != REFRESH_TOKEN_TYPE:
            raise JWTError("Wrong token type")
        return payload
    except JWTError as exc:
        raise ValueError("Invalid refresh token") from exc
