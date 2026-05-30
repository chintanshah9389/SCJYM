"""Seed script: creates the SUPER_ADMIN user if it does not exist."""
import asyncio
import sys
import os

# Allow running as `python -m scripts.seed_super_admin` from services/api/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone
from core.config import get_settings
from core.database import get_db, get_client
from core.security import hash_password


async def seed() -> None:
    settings = get_settings()
    db = get_db()

    existing = await db.users.find_one({"email": settings.super_admin_email.lower()})
    if existing:
        print(f"[seed] SUPER_ADMIN already exists: {settings.super_admin_email}")
        return

    now = datetime.now(tz=timezone.utc)
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
    result = await db.users.insert_one(doc)
    print(f"[seed] SUPER_ADMIN created with id={result.inserted_id}")


if __name__ == "__main__":
    asyncio.run(seed())
    get_client().close()
