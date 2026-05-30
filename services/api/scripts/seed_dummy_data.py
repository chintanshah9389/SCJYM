"""Seed script: inserts 10 users, 20 products (across 10 categories),
ratings, and comments so the app looks populated.

Run from services/api/:
    python -m scripts.seed_dummy_data
"""
import asyncio
import os
import sys
import random
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bson import ObjectId
from core.database import get_db, get_client
from core.security import hash_password

# ─── Categories & products ────────────────────────────────────────────────────

CATEGORIES = [
    "Electronics",
    "Fashion",
    "Home & Kitchen",
    "Books",
    "Sports & Fitness",
    "Beauty & Skincare",
    "Toys & Games",
    "Food & Beverages",
    "Stationery",
    "Automotive",
]

PRODUCTS = [
    # Electronics
    {
        "title": "ProSound Wireless Earbuds",
        "description": "High-fidelity TWS earbuds with 36-hour battery, ANC, and IPX5 water resistance. Crystal-clear calls and deep bass for audiophiles on the go.",
        "category": "Electronics",
        "tags": ["earbuds", "wireless", "anc", "audio"],
        "price": 2999.0,
        "inventory": 150,
        "images": ["https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600"],
    },
    {
        "title": "UltraView 4K Smart Monitor",
        "description": "27-inch IPS 4K monitor with HDR400, 144Hz refresh rate, USB-C PD 90W, and built-in speakers. Perfect for work and gaming setups.",
        "category": "Electronics",
        "tags": ["monitor", "4k", "hdr", "gaming"],
        "price": 28999.0,
        "inventory": 40,
        "images": ["https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600"],
    },
    # Fashion
    {
        "title": "Classic Oxford Dress Shoes",
        "description": "Hand-crafted genuine leather oxfords with Goodyear-welted soles. Available in tan and black. A timeless addition to any formal wardrobe.",
        "category": "Fashion",
        "tags": ["shoes", "leather", "formal", "oxford"],
        "price": 4499.0,
        "inventory": 80,
        "images": ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600"],
    },
    {
        "title": "Everyday Linen Kurta Set",
        "description": "Breathable 100% linen fabric with subtle texture. Comes with matching trousers. Available in 6 earthy shades. Machine washable.",
        "category": "Fashion",
        "tags": ["kurta", "linen", "ethnic", "casual"],
        "price": 1299.0,
        "inventory": 200,
        "images": ["https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=600"],
    },
    # Home & Kitchen
    {
        "title": "CastIron Pro Skillet 12\"",
        "description": "Pre-seasoned cast iron skillet perfect for searing, baking, and outdoor cooking. Even heat distribution and oven-safe up to 500°F.",
        "category": "Home & Kitchen",
        "tags": ["skillet", "cast-iron", "cooking", "oven-safe"],
        "price": 1799.0,
        "inventory": 120,
        "images": ["https://images.unsplash.com/photo-1593759608142-e976b5b6c2c6?w=600"],
    },
    {
        "title": "Bamboo Chopping Board Set",
        "description": "Set of 3 eco-friendly bamboo cutting boards with juice grooves and non-slip feet. Knife-friendly surface. Dishwasher safe.",
        "category": "Home & Kitchen",
        "tags": ["bamboo", "cutting-board", "eco", "kitchen"],
        "price": 799.0,
        "inventory": 300,
        "images": ["https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600"],
    },
    # Books
    {
        "title": "Atomic Habits – Illustrated Edition",
        "description": "James Clear's best-seller now in a full-colour illustrated format. Practical strategies to build good habits and break bad ones.",
        "category": "Books",
        "tags": ["habit", "self-help", "productivity", "bestseller"],
        "price": 599.0,
        "inventory": 500,
        "images": ["https://images.unsplash.com/photo-1532012197267-da84d127e765?w=600"],
    },
    {
        "title": "The Art of Deep Work",
        "description": "Cal Newport's guide to achieving focused success in a distracted world. Includes the Deep Work formula and 4 rules for focused success.",
        "category": "Books",
        "tags": ["focus", "productivity", "career", "cal-newport"],
        "price": 449.0,
        "inventory": 400,
        "images": ["https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600"],
    },
    # Sports & Fitness
    {
        "title": "AeroPro Yoga Mat 6mm",
        "description": "Non-slip natural rubber yoga mat with alignment lines. 6mm thickness for joint support. Includes carrying strap and free online class access.",
        "category": "Sports & Fitness",
        "tags": ["yoga", "mat", "fitness", "non-slip"],
        "price": 1199.0,
        "inventory": 250,
        "images": ["https://images.unsplash.com/photo-1601422407692-ec4eeec1d9b3?w=600"],
    },
    {
        "title": "Resistance Band Kit (11-Pack)",
        "description": "Full-body workout set with 5 loop bands, 2 fabric bands, door anchor, handles, ankle straps, and guide booklet. Great for home gym.",
        "category": "Sports & Fitness",
        "tags": ["resistance-band", "home-gym", "workout", "strength"],
        "price": 899.0,
        "inventory": 600,
        "images": ["https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600"],
    },
    # Beauty & Skincare
    {
        "title": "GlowLab Vitamin C Serum",
        "description": "15% L-Ascorbic Acid + hyaluronic acid + vitamin E. Brightens skin tone, fades dark spots, and boosts collagen. Dermatologist tested.",
        "category": "Beauty & Skincare",
        "tags": ["serum", "vitamin-c", "brightening", "skincare"],
        "price": 999.0,
        "inventory": 350,
        "images": ["https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600"],
    },
    {
        "title": "Hydra-Boost Overnight Cream",
        "description": "Rich moisturising night cream with ceramides, peptides, and niacinamide. Wake up with plump, nourished skin. Fragrance-free.",
        "category": "Beauty & Skincare",
        "tags": ["moisturiser", "night-cream", "hydrating", "fragrance-free"],
        "price": 749.0,
        "inventory": 280,
        "images": ["https://images.unsplash.com/photo-1556228720-da7b5b5e8b8b?w=600"],
    },
    # Toys & Games
    {
        "title": "Wooden STEM Building Blocks (100 pcs)",
        "description": "100-piece solid wood building set for ages 3+. Encourages creative play, spatial awareness, and fine motor skills. Non-toxic paint.",
        "category": "Toys & Games",
        "tags": ["stem", "wooden", "blocks", "kids"],
        "price": 1499.0,
        "inventory": 180,
        "images": ["https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=600"],
    },
    {
        "title": "StratoQuest Board Game",
        "description": "Strategy board game for 2-5 players. Build civilisations, trade resources, and outmanoeuvre opponents. Average playtime: 90 mins.",
        "category": "Toys & Games",
        "tags": ["board-game", "strategy", "family", "2-5-players"],
        "price": 2199.0,
        "inventory": 95,
        "images": ["https://images.unsplash.com/photo-1611996575749-79a3a250f948?w=600"],
    },
    # Food & Beverages
    {
        "title": "Himalayan Pink Salt (1 kg)",
        "description": "Premium hand-mined Himalayan rock salt. Rich in 84+ natural minerals. Ideal for cooking, grilling, and spa treatments.",
        "category": "Food & Beverages",
        "tags": ["salt", "himalayan", "mineral", "organic"],
        "price": 299.0,
        "inventory": 1000,
        "images": ["https://images.unsplash.com/photo-1518110925495-5fe2ffc7aca2?w=600"],
    },
    {
        "title": "Cold Brew Coffee Kit",
        "description": "Everything you need to brew smooth, low-acid cold brew at home. Includes 250g single-origin beans, mason jar, and fine mesh filter.",
        "category": "Food & Beverages",
        "tags": ["coffee", "cold-brew", "specialty", "kit"],
        "price": 849.0,
        "inventory": 220,
        "images": ["https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600"],
    },
    # Stationery
    {
        "title": "Premium Dot-Grid Notebook A5",
        "description": "Lay-flat binding, 200 pages of 100gsm acid-free paper, dotted grid layout. Ink-bleed resistant. Elastic band and ribbon marker.",
        "category": "Stationery",
        "tags": ["notebook", "dot-grid", "bullet-journal", "a5"],
        "price": 499.0,
        "inventory": 450,
        "images": ["https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=600"],
    },
    {
        "title": "Architect's Mechanical Pencil Set",
        "description": "Set of 4 precision mechanical pencils (0.3/0.5/0.7/0.9mm) with metal grip, retractable tip, and 40 spare leads. For drawing and drafting.",
        "category": "Stationery",
        "tags": ["pencil", "mechanical", "drafting", "art"],
        "price": 699.0,
        "inventory": 160,
        "images": ["https://images.unsplash.com/photo-1555421689-491a97ff2040?w=600"],
    },
    # Automotive
    {
        "title": "DashCam Pro 4K WiFi",
        "description": "4K front + 1080p rear dashcam with night vision, GPS, WiFi, and 170° wide angle. Loop recording & emergency lock. G-sensor included.",
        "category": "Automotive",
        "tags": ["dashcam", "4k", "wifi", "gps", "car"],
        "price": 6499.0,
        "inventory": 75,
        "images": ["https://images.unsplash.com/photo-1617788138017-80ad40651399?w=600"],
    },
    {
        "title": "Magnetic Phone Mount (2-Pack)",
        "description": "Strong N52 magnet car phone holder. Universal compatibility. Dashboard & windshield mount included. 360° rotation. No signal interference.",
        "category": "Automotive",
        "tags": ["phone-mount", "magnetic", "car", "universal"],
        "price": 349.0,
        "inventory": 800,
        "images": ["https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600"],
    },
]

# ─── Dummy users ──────────────────────────────────────────────────────────────

USERS = [
    {"fullName": "Aarav Sharma",    "email": "aarav@example.com",   "mobile": "9800000001"},
    {"fullName": "Priya Nair",      "email": "priya@example.com",   "mobile": "9800000002"},
    {"fullName": "Rohan Mehta",     "email": "rohan@example.com",   "mobile": "9800000003"},
    {"fullName": "Sneha Iyer",      "email": "sneha@example.com",   "mobile": "9800000004"},
    {"fullName": "Karan Patel",     "email": "karan@example.com",   "mobile": "9800000005"},
    {"fullName": "Divya Reddy",     "email": "divya@example.com",   "mobile": "9800000006"},
    {"fullName": "Arjun Singh",     "email": "arjun@example.com",   "mobile": "9800000007"},
    {"fullName": "Meera Chopra",    "email": "meera@example.com",   "mobile": "9800000008"},
    {"fullName": "Vikram Das",      "email": "vikram@example.com",  "mobile": "9800000009"},
    {"fullName": "Ananya Bose",     "email": "ananya@example.com",  "mobile": "9800000010"},
]

COMMENTS_POOL = [
    "Absolutely love this product! Exceeded my expectations.",
    "Great quality for the price. Would definitely buy again.",
    "Fast delivery and well packed. Very satisfied.",
    "Works exactly as described. No complaints at all.",
    "My family loves it. Will recommend to friends.",
    "Good product but packaging could be better.",
    "Perfect gift idea. The recipient was thrilled!",
    "Sturdy build and looks premium. Very happy.",
    "Used it daily for a month — still going strong.",
    "Customer support was helpful when I had a query.",
    "Slightly smaller than expected but works great.",
    "Best purchase I've made this year. Highly recommend!",
    "The quality is top-notch. Worth every rupee.",
    "Arrived ahead of schedule. Bonus points for that!",
    "Matches the photos perfectly. No hidden surprises.",
]

CITIES = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Pune", "Kolkata", "Jaipur"]
STATES = ["Maharashtra", "Delhi", "Karnataka", "Tamil Nadu", "Telangana", "Maharashtra", "West Bengal", "Rajasthan"]


async def seed() -> None:
    db = get_db()
    now = datetime.now(tz=timezone.utc)

    # ── 1. Insert users ───────────────────────────────────────────────────────
    print("[seed] Creating users…")
    user_ids: list[ObjectId] = []
    pw_hash = hash_password("Password@123")

    for i, u in enumerate(USERS):
        existing = await db.users.find_one({"email": u["email"]})
        if existing:
            print(f"  ⚠  user {u['email']} already exists, skipping")
            user_ids.append(existing["_id"])
            continue

        city = CITIES[i % len(CITIES)]
        state = STATES[i % len(STATES)]
        doc = {
            "fullName": u["fullName"],
            "email": u["email"],
            "mobile": u["mobile"],
            "address": {
                "line1": f"{10 + i} Sample Road",
                "line2": f"Apt {i + 1}",
                "city": city,
                "state": state,
                "pincode": f"40000{i}",
                "country": "IN",
            },
            "passwordHash": pw_hash,
            "role": "MEMBER",
            "status": "APPROVED",
            "fcmToken": None,
            "createdAt": now - timedelta(days=random.randint(30, 180)),
            "updatedAt": now,
        }
        result = await db.users.insert_one(doc)
        user_ids.append(result.inserted_id)
        print(f"  ✓  {u['fullName']} ({u['email']})")

    # ── 2. Insert products ────────────────────────────────────────────────────
    print("\n[seed] Creating products…")
    product_ids: list[ObjectId] = []

    for i, p in enumerate(PRODUCTS):
        existing = await db.products.find_one({"title": p["title"]})
        if existing:
            print(f"  ⚠  product '{p['title']}' already exists, skipping")
            product_ids.append(existing["_id"])
            continue

        owner_id = str(user_ids[i % len(user_ids)])
        # Stagger creation dates for realistic ranking
        created_at = now - timedelta(days=random.randint(1, 90))
        view_count = random.randint(50, 2000)
        purchase_count = random.randint(5, 300)

        doc = {
            "title": p["title"],
            "description": p["description"],
            "category": p["category"],
            "tags": p["tags"],
            "price": p["price"],
            "inventory": p["inventory"],
            "images": p.get("images", []),
            "ownerId": owner_id,
            "status": "APPROVED",
            "avgRating": 0.0,
            "ratingCount": 0,
            "bayesianRating": 0.0,
            "viewCount": view_count,
            "purchaseCount": purchase_count,
            "createdAt": created_at,
            "updatedAt": created_at,
            "approvedAt": created_at + timedelta(hours=2),
            "approvedBy": None,
        }
        result = await db.products.insert_one(doc)
        product_ids.append(result.inserted_id)
        print(f"  ✓  {p['title']} [{p['category']}]")

    # ── 3. Insert ratings ─────────────────────────────────────────────────────
    print("\n[seed] Adding ratings…")
    for pid in product_ids:
        pid_str = str(pid)
        for uid in user_ids:
            uid_str = str(uid)
            exists = await db.ratings.find_one({"productId": pid_str, "userId": uid_str})
            if exists:
                continue
            # Not every user rates every product
            if random.random() < 0.6:
                score = random.choices([3, 4, 5], weights=[1, 3, 5])[0]
                await db.ratings.insert_one({
                    "productId": pid_str,
                    "userId": uid_str,
                    "score": score,
                    "createdAt": now - timedelta(days=random.randint(0, 60)),
                    "updatedAt": now,
                })

    # Recompute avgRating + ratingCount for each product
    for pid in product_ids:
        pid_str = str(pid)
        pipeline = [
            {"$match": {"productId": pid_str}},
            {"$group": {"_id": None, "avg": {"$avg": "$score"}, "count": {"$sum": 1}}},
        ]
        result = await db.ratings.aggregate(pipeline).to_list(length=1)
        if result:
            avg = round(result[0]["avg"], 2)
            count = result[0]["count"]
            await db.products.update_one(
                {"_id": pid},
                {"$set": {"avgRating": avg, "ratingCount": count, "bayesianRating": avg}},
            )
    print("  ✓  Ratings computed")

    # ── 4. Insert comments ────────────────────────────────────────────────────
    print("\n[seed] Adding comments…")
    total_comments = 0
    for pid in product_ids:
        pid_str = str(pid)
        # 3–6 random comments per product
        num = random.randint(3, 6)
        commenters = random.sample(user_ids, min(num, len(user_ids)))
        for uid in commenters:
            uid_str = str(uid)
            user_doc = next((u for u in USERS if True), None)
            body = random.choice(COMMENTS_POOL)
            await db.comments.insert_one({
                "productId": pid_str,
                "userId": uid_str,
                "body": body,
                "status": "APPROVED",
                "createdAt": now - timedelta(days=random.randint(0, 50)),
                "updatedAt": now,
            })
            total_comments += 1
    print(f"  ✓  {total_comments} comments added")

    # ── 5. Insert menu categories ─────────────────────────────────────────────
    print("\n[seed] Setting up menu categories…")
    for cat in CATEGORIES:
        existing = await db.menu.find_one({"name": cat})
        if existing:
            continue
        await db.menu.insert_one({
            "name": cat,
            "type": "CATEGORY",
            "isActive": True,
            "sortOrder": CATEGORIES.index(cat),
            "createdAt": now,
            "updatedAt": now,
        })
    print(f"  ✓  {len(CATEGORIES)} menu categories created")

    print("\n[seed] ✅ Done!")
    print(f"  Users     : {len(user_ids)}")
    print(f"  Products  : {len(product_ids)}")
    print(f"  Categories: {len(CATEGORIES)}")
    print(f"  All user passwords: Password@123")


if __name__ == "__main__":
    asyncio.run(seed())
    get_client().close()
