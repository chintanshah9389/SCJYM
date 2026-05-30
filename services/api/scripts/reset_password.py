"""Reset a user's password.

Usage:
  cd services/api
  python -m scripts.reset_password --email user@example.com --password 'NewPass123!'
"""
import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone

# Allow running as `python -m scripts.reset_password` from services/api/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import get_db, get_client
from core.security import hash_password


async def reset_password(email: str, new_password: str) -> int:
    db = get_db()
    user = await db.users.find_one({"email": email.lower()})
    if not user:
        print(f"[reset] User not found: {email}")
        return 1

    pw_hash = hash_password(new_password)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"passwordHash": pw_hash, "updatedAt": datetime.now(tz=timezone.utc)}},
    )
    print(f"[reset] Password updated for {email}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Reset a user's password")
    parser.add_argument("--email", "-e", required=True, help="User email")
    parser.add_argument("--password", "-p", required=True, help="New password")
    args = parser.parse_args()

    code = asyncio.run(reset_password(args.email, args.password))
    get_client().close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
