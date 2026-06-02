"""Backfill users.passwordPlain for records where it is missing/empty.

This script assigns a generated temporary password, updates passwordHash to match,
and prints a plan row per updated user.

Usage:
  python -m scripts.backfill_password_plain
    python -m scripts.backfill_password_plain --all
"""

import asyncio
import argparse
import secrets
from datetime import datetime, timezone

from core.database import get_db
from core.security import hash_password


def generate_temp_password() -> str:
    # URL-safe and reasonably strong while still easy to copy.
    return f"Tmp@{secrets.token_urlsafe(8)}"


async def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill users.passwordPlain")
    parser.add_argument("--all", action="store_true", help="Reset passwordPlain/passwordHash for all users")
    args = parser.parse_args()

    db = get_db()
    if args.all:
        flt = {}
    else:
        flt = {
            "$or": [
                {"passwordPlain": {"$exists": False}},
                {"passwordPlain": None},
                {"passwordPlain": ""},
            ]
        }

    users = await db.users.find(flt).to_list(length=100000)
    if not users:
        print("No users require passwordPlain backfill.")
        return

    mode = "all users" if args.all else "users missing passwordPlain"
    print(f"Mode: {mode}")
    print(f"Users to update: {len(users)}")
    print("--- Password Plan (updated users) ---")

    for u in users:
        temp_password = generate_temp_password()
        await db.users.update_one(
            {"_id": u["_id"]},
            {
                "$set": {
                    "passwordPlain": temp_password,
                    "passwordHash": hash_password(temp_password),
                    "updatedAt": datetime.now(tz=timezone.utc),
                }
            },
        )

        print(
            {
                "id": str(u.get("_id")),
                "fullName": u.get("fullName", ""),
                "email": u.get("email", ""),
                "mobile": u.get("mobile", ""),
                "role": u.get("role", ""),
                "status": u.get("status", ""),
                "password": temp_password,
            }
        )

    print("Backfill complete.")


if __name__ == "__main__":
    asyncio.run(main())
