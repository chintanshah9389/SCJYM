"""Delete dummy products via remote API and seed 5 fresh products.

Usage (PowerShell):
  $env:API_BASE_URL="https://scjym-api.onrender.com/api/v1"
    $env:SUPERADMIN_EMAIL="superadmin@scjym.com"
    $env:SUPERADMIN_PASSWORD="<superadmin_password>"
  python -m scripts.reset_dummy_products_and_seed_fresh_remote
"""

import asyncio
import os
import sys
from typing import Any

import httpx


API_BASE_URL = os.getenv("API_BASE_URL", "https://scjym-api.onrender.com/api/v1").rstrip("/")
SUPERADMIN_EMAIL = os.getenv("SUPERADMIN_EMAIL", "superadmin@scjym.com").strip().lower()
SUPERADMIN_PASSWORD = os.getenv("SUPERADMIN_PASSWORD", "").strip()


FRESH_PRODUCTS: list[dict[str, Any]] = [
    {
        "title": "Premium Grass-Fed Whey Protein 2kg",
        "description": "Clean whey protein blend for strength and recovery with low sugar and high digestibility.",
        "category": "Sports Nutrition",
        "tags": ["protein", "whey", "muscle", "recovery"],
        "price": 4899.0,
        "inventory": 140,
        "productCode": "fresh-p-1",
        "images": [
            "https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=900",
            "https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=900",
            "https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?w=900",
            "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=900",
            "https://images.unsplash.com/photo-1605296867724-fa87a8ef53fd?w=900",
        ],
    },
    {
        "title": "Smart Adjustable Dumbbell Set 40kg",
        "description": "Compact dumbbell system with quick-lock plates for progressive home and studio workouts.",
        "category": "Strength Equipment",
        "tags": ["dumbbell", "strength", "home gym", "adjustable"],
        "price": 7999.0,
        "inventory": 65,
        "productCode": "fresh-p-2",
        "images": [
            "https://images.unsplash.com/photo-1534368786749-b63e46d6f7f2?w=900",
            "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=900",
            "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=900",
            "https://images.unsplash.com/photo-1599058918144-1ffabb6ab9a0?w=900",
            "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=900",
        ],
    },
    {
        "title": "High-Density Yoga Mat Pro 10mm",
        "description": "Anti-slip, joint-friendly yoga mat designed for daily stretching, yoga flow, and floor training.",
        "category": "Yoga & Mobility",
        "tags": ["yoga", "mobility", "wellness", "training"],
        "price": 1599.0,
        "inventory": 220,
        "productCode": "fresh-p-3",
        "images": [
            "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=900",
            "https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?w=900",
            "https://images.unsplash.com/photo-1591291621164-2c6367723315?w=900",
            "https://images.unsplash.com/photo-1510894347713-fc3ed6fdf539?w=900",
            "https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=900",
        ],
    },
    {
        "title": "Creatine Monohydrate Ultra Pure 500g",
        "description": "Micronized creatine monohydrate for power output, performance, and consistent training progress.",
        "category": "Sports Nutrition",
        "tags": ["creatine", "performance", "strength", "supplement"],
        "price": 1299.0,
        "inventory": 310,
        "productCode": "fresh-p-4",
        "images": [
            "https://images.unsplash.com/photo-1514995669114-6081e934b693?w=900",
            "https://images.unsplash.com/photo-1521804906057-1df8fdb718b7?w=900",
            "https://images.unsplash.com/photo-1486218119243-13883505764c?w=900",
            "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=900",
            "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=900",
        ],
    },
    {
        "title": "Elite Recovery Foam Roller Kit",
        "description": "Deep tissue recovery roller with trigger ball set for post-workout mobility and pain relief.",
        "category": "Recovery & Rehab",
        "tags": ["recovery", "foam roller", "mobility", "rehab"],
        "price": 1899.0,
        "inventory": 175,
        "productCode": "fresh-p-5",
        "images": [
            "https://images.unsplash.com/photo-1517344884509-a0c97ec11bcc?w=900",
            "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=900",
            "https://images.unsplash.com/photo-1597347316205-38f3196aa45d?w=900",
            "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=900",
            "https://images.unsplash.com/photo-1576678927484-cc907957088c?w=900",
        ],
    },
]


DUMMY_CODE_SET = {f"dummy-p-{i}" for i in range(1, 50)}


async def _list_products(client: httpx.AsyncClient, headers: dict[str, str]) -> list[dict[str, Any]]:
    page = 1
    all_items: list[dict[str, Any]] = []
    while True:
        resp = await client.get(
            f"{API_BASE_URL}/products",
            headers=headers,
            params={"page": page, "limit": 100, "status": "APPROVED"},
        )
        if resp.status_code != 200:
            print(f"[warn] list products failed on page {page}: {resp.status_code} {resp.text}")
            break
        data = (resp.json() or {}).get("data") or {}
        items = data.get("items") or []
        total_pages = int(data.get("totalPages") or 1)
        all_items.extend(items)
        if page >= total_pages:
            break
        page += 1
    return all_items


def _is_dummy(item: dict[str, Any]) -> bool:
    title = str(item.get("title") or "")
    product_code = str(item.get("productCode") or "")
    return title.startswith("Demo Home Product - ") or product_code in DUMMY_CODE_SET


async def _delete_products(client: httpx.AsyncClient, headers: dict[str, str], ids: list[str]) -> int:
    deleted = 0
    for pid in ids:
        resp = await client.delete(f"{API_BASE_URL}/products/{pid}", headers=headers)
        if resp.status_code in (200, 204):
            deleted += 1
        else:
            print(f"[warn] delete failed for {pid}: {resp.status_code} {resp.text}")
    return deleted


async def _login_and_get_token(client: httpx.AsyncClient) -> str:
    resp = await client.post(
        f"{API_BASE_URL}/auth/login",
        json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD},
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Login failed: {resp.status_code} {resp.text}")

    token = (((resp.json() or {}).get("data") or {}).get("accessToken") or "").strip()
    if not token:
        raise RuntimeError("Login succeeded but access token missing")
    return token


async def _create_submit_approve(client: httpx.AsyncClient, headers: dict[str, str], body: dict[str, Any]) -> bool:
    create_payload = {
        "title": body["title"],
        "description": body["description"],
        "category": body["category"],
        "tags": body["tags"],
        "price": body["price"],
        "inventory": body["inventory"],
        "productCode": body["productCode"],
        "images": body.get("images") or [],
    }
    create_resp = await client.post(f"{API_BASE_URL}/products", headers=headers, json=create_payload)
    if create_resp.status_code not in (200, 201):
        print(f"[fail:create] {body['title']}: {create_resp.status_code} {create_resp.text}")
        return False

    product_id = ((create_resp.json() or {}).get("data") or {}).get("id")
    if not product_id:
        print(f"[fail:create] {body['title']}: missing id")
        return False

    submit_resp = await client.post(f"{API_BASE_URL}/products/{product_id}/submit", headers=headers)
    if submit_resp.status_code not in (200, 201):
        print(f"[fail:submit] {body['title']}: {submit_resp.status_code} {submit_resp.text}")
        return False

    approve_resp = await client.patch(
        f"{API_BASE_URL}/products/{product_id}/approval",
        headers=headers,
        json={"status": "APPROVED", "reason": "Fresh catalog reset"},
    )
    if approve_resp.status_code not in (200, 201):
        print(f"[fail:approve] {body['title']}: {approve_resp.status_code} {approve_resp.text}")
        return False

    print(f"[ok] {body['title']} ({product_id})")
    return True


async def main() -> None:
    if not SUPERADMIN_PASSWORD:
        print("Missing SUPERADMIN_PASSWORD")
        sys.exit(1)

    async with httpx.AsyncClient(timeout=30) as client:
        token = await _login_and_get_token(client)
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        items = await _list_products(client, headers)
        dummy_ids = [str(i.get("id")) for i in items if i.get("id") and _is_dummy(i)]

        deleted = await _delete_products(client, headers, dummy_ids)

        inserted = 0
        for p in FRESH_PRODUCTS:
            ok = await _create_submit_approve(client, headers, p)
            if ok:
                inserted += 1

        final = await _list_products(client, headers)
        fresh_count = len([i for i in final if str(i.get("productCode") or "").startswith("fresh-p-")])

    print("\nRemote reset summary")
    print(f"Dummy deleted: {deleted}")
    print(f"Fresh inserted: {inserted}")
    print(f"Fresh currently visible: {fresh_count}")


if __name__ == "__main__":
    asyncio.run(main())
