"""Seed 5 dummy home products into a remote API via authenticated endpoints.

Usage (PowerShell):
  $env:API_BASE_URL="https://scjym-api.onrender.com/api/v1"
  $env:ADMIN_BEARER_TOKEN="<your_admin_access_token>"
  python -m scripts.seed_home_dummy_products_remote
"""

import os
import sys
import asyncio

import httpx


API_BASE_URL = os.getenv("API_BASE_URL", "https://scjym-api.onrender.com/api/v1").rstrip("/")
ADMIN_BEARER_TOKEN = os.getenv("ADMIN_BEARER_TOKEN", "").strip()


DUMMY_PRODUCTS = [
    {
        "title": "Demo Home Product - Whey Protein Isolate 1kg",
        "description": "High-quality isolate protein for lean muscle recovery and daily performance.",
        "category": "Sports & Fitness",
        "tags": ["protein", "fitness", "supplement"],
        "price": 2399.0,
        "inventory": 120,
        "productCode": "dummy-p-1",
        "images": [{"url": "https://images.unsplash.com/photo-1590080876614-bc8a2f703e57?w=400&h=400&fit=crop"}],
    },
    {
        "title": "Demo Home Product - Adjustable Dumbbell Pair",
        "description": "Space-saving adjustable dumbbells for progressive strength training at home.",
        "category": "Sports & Fitness",
        "tags": ["dumbbell", "gym", "strength"],
        "price": 3299.0,
        "inventory": 80,
        "productCode": "dummy-p-2",
        "images": [{"url": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=400&fit=crop"}],
    },
    {
        "title": "Demo Home Product - Resistance Band Combo",
        "description": "Set of resistance bands suitable for warm-ups, rehab, and full-body workouts.",
        "category": "Sports & Fitness",
        "tags": ["bands", "workout", "home-gym"],
        "price": 799.0,
        "inventory": 260,
        "productCode": "dummy-p-3",
        "images": [{"url": "https://images.unsplash.com/photo-1609899753513-1f8b2f3c7a08?w=400&h=400&fit=crop"}],
    },
    {
        "title": "Demo Home Product - Yoga Mat Pro 8mm",
        "description": "Non-slip high-density yoga mat for comfort during yoga and floor exercises.",
        "category": "Sports & Fitness",
        "tags": ["yoga", "mat", "wellness"],
        "price": 999.0,
        "inventory": 210,
        "productCode": "dummy-p-4",
        "images": [{"url": "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=400&h=400&fit=crop"}],
    },
    {
        "title": "Demo Home Product - Stainless Steel Shaker Bottle",
        "description": "Leak-proof shaker with mixer ball, ideal for protein shakes and hydration.",
        "category": "Sports & Fitness",
        "tags": ["shaker", "bottle", "gym-accessory"],
        "price": 349.0,
        "inventory": 400,
        "productCode": "dummy-p-5",
        "images": [{"url": "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&h=400&fit=crop"}],
    },
]


async def _approved_title_exists(client: httpx.AsyncClient, headers: dict, title: str) -> bool:
    resp = await client.get(
        f"{API_BASE_URL}/products",
        headers=headers,
        params={"q": title, "limit": 50, "status": "APPROVED"},
    )
    if resp.status_code != 200:
        return False
    items = (((resp.json() or {}).get("data") or {}).get("items") or [])
    return any((item or {}).get("title") == title for item in items)


async def seed_remote_products() -> None:
    if not ADMIN_BEARER_TOKEN:
        print("Missing ADMIN_BEARER_TOKEN environment variable")
        sys.exit(1)

    headers = {
        "Authorization": f"Bearer {ADMIN_BEARER_TOKEN}",
        "Content-Type": "application/json",
    }

    inserted = 0
    skipped = 0

    async with httpx.AsyncClient(timeout=30) as client:
        for product in DUMMY_PRODUCTS:
            title = product["title"]

            if await _approved_title_exists(client, headers, title):
                skipped += 1
                print(f"[skip] {title}")
                continue

            create_resp = await client.post(f"{API_BASE_URL}/products", headers=headers, json=product)
            if create_resp.status_code not in (200, 201):
                print(f"[fail:create] {title}: {create_resp.status_code} {create_resp.text}")
                continue

            created = (create_resp.json().get("data") or {})
            product_id = created.get("id")
            if not product_id:
                print(f"[fail:create] {title}: missing product id")
                continue

            submit_resp = await client.post(f"{API_BASE_URL}/products/{product_id}/submit", headers=headers)
            if submit_resp.status_code not in (200, 201):
                print(f"[fail:submit] {title}: {submit_resp.status_code} {submit_resp.text}")
                continue

            approval_body = {"status": "APPROVED", "reason": "Seeded demo product"}
            approve_resp = await client.patch(
                f"{API_BASE_URL}/products/{product_id}/approval",
                headers=headers,
                json=approval_body,
            )
            if approve_resp.status_code not in (200, 201):
                print(f"[fail:approve] {title}: {approve_resp.status_code} {approve_resp.text}")
                continue

            inserted += 1
            print(f"[ok] {title} ({product_id})")

        final_resp = await client.get(
            f"{API_BASE_URL}/products",
            headers=headers,
            params={"q": "Demo Home Product - ", "limit": 100, "status": "APPROVED"},
        )
        total = 0
        if final_resp.status_code == 200:
            total = len((((final_resp.json() or {}).get("data") or {}).get("items") or []))

    print("\nSeed summary")
    print(f"Inserted: {inserted}")
    print(f"Skipped:  {skipped}")
    print(f"Total approved demo products found: {total}")


if __name__ == "__main__":
    asyncio.run(seed_remote_products())
