"""Seed 4 dummy home ads into a remote API via admin endpoints.

Usage (PowerShell):
  $env:API_BASE_URL="https://scjym-api.onrender.com/api/v1"
  $env:ADMIN_BEARER_TOKEN="<your_admin_access_token>"
  python -m scripts.seed_home_dummy_ads_remote
"""

import os
import sys
import asyncio

import httpx


API_BASE_URL = os.getenv("API_BASE_URL", "https://scjym-api.onrender.com/api/v1").rstrip("/")
ADMIN_BEARER_TOKEN = os.getenv("ADMIN_BEARER_TOKEN", "").strip()


DUMMY_ADS = [
    {
        "title": "Demo Home Ad - Weekend Fitness Fest",
        "subtitle": "Flat 25% off on protein combos",
        "mediaUrl": "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80",
        "mediaType": "IMAGE",
        "linkTarget": "https://scjym.in/offers",
        "linkType": "WEB_URL",
        "isActive": True,
        "sortOrder": 1,
        "badge": "HOT DEAL",
        "badgeColor": "#ef4444",
    },
    {
        "title": "Demo Home Ad - Morning Yoga Batch",
        "subtitle": "Book your trial class now",
        "mediaUrl": "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80",
        "mediaType": "IMAGE",
        "linkTarget": "https://scjym.in/classes",
        "linkType": "WEB_URL",
        "isActive": True,
        "sortOrder": 2,
        "badge": "NEW",
        "badgeColor": "#10b981",
    },
    {
        "title": "Demo Home Ad - Top Gym Accessories",
        "subtitle": "Starting at Rs 299 only",
        "mediaUrl": "https://images.unsplash.com/photo-1598289431512-b97b0917affc?auto=format&fit=crop&w=1200&q=80",
        "mediaType": "IMAGE",
        "linkTarget": "https://scjym.in/shop",
        "linkType": "WEB_URL",
        "isActive": True,
        "sortOrder": 3,
        "badge": "LIMITED",
        "badgeColor": "#f59e0b",
    },
    {
        "title": "Demo Home Ad - Coach Connect Live",
        "subtitle": "Join Q&A with pro trainers",
        "mediaUrl": "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=1200&q=80",
        "mediaType": "IMAGE",
        "linkTarget": "https://scjym.in/live",
        "linkType": "WEB_URL",
        "isActive": True,
        "sortOrder": 4,
        "badge": "LIVE",
        "badgeColor": "#8b5cf6",
    },
]


async def seed_remote_ads() -> None:
    if not ADMIN_BEARER_TOKEN:
        print("Missing ADMIN_BEARER_TOKEN environment variable")
        sys.exit(1)

    headers = {
        "Authorization": f"Bearer {ADMIN_BEARER_TOKEN}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        list_url = f"{API_BASE_URL}/admin/ads"
        list_resp = await client.get(list_url, headers=headers)
        if list_resp.status_code != 200:
            print(f"Failed to list existing ads: {list_resp.status_code} {list_resp.text}")
            sys.exit(1)

        existing_items = list_resp.json().get("data") or []
        existing_titles = {item.get("title") for item in existing_items}

        inserted = 0
        skipped = 0
        for ad in DUMMY_ADS:
            if ad["title"] in existing_titles:
                skipped += 1
                print(f"[skip] {ad['title']}")
                continue

            create_url = f"{API_BASE_URL}/admin/ads"
            create_resp = await client.post(create_url, headers=headers, json=ad)
            if create_resp.status_code not in (200, 201):
                print(f"[fail] {ad['title']}: {create_resp.status_code} {create_resp.text}")
                continue

            inserted += 1
            new_id = (create_resp.json().get("data") or {}).get("id")
            print(f"[ok] {ad['title']} ({new_id})")

        active_url = f"{API_BASE_URL}/ads/active?limit=10"
        active_resp = await client.get(active_url)
        active_count = 0
        if active_resp.status_code == 200:
            active_count = len(active_resp.json().get("data") or [])

        print("\nSeed summary")
        print(f"Inserted: {inserted}")
        print(f"Skipped:  {skipped}")
        print(f"Active ads now: {active_count}")


if __name__ == "__main__":
    asyncio.run(seed_remote_ads())
