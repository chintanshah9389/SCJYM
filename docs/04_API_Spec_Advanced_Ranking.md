# API Specification  
## Advanced Ranking Enhancements  
**Version:** 1.0  
**Date:** 2026-05-27  
**Format:** REST / JSON  
**Base URL:** `/api/v1`  
**Authentication:** Bearer JWT unless marked `[PUBLIC]`

---

## Table of Contents

1. [Common Conventions](#1-common-conventions)  
2. [Product Endpoints](#2-product-endpoints)  
   2.1 [GET /products/{id}](#21-get-productsid)  
   2.2 [GET /products/best-sellers](#22-get-productsbest-sellers)  
   2.3 [GET /products/best-sellers/personalized](#23-get-productsbest-sellerspersonalized)  
3. [Event Tracking Endpoint](#3-event-tracking-endpoint)  
   3.1 [POST /events/track](#31-post-eventstrack)  
4. [Admin Endpoints](#4-admin-endpoints)  
   4.1 [GET /admin/ranking-config](#41-get-adminranking-config)  
   4.2 [PUT /admin/ranking-config](#42-put-adminranking-config)  
   4.3 [GET /admin/regions](#43-get-adminregions)  
   4.4 [GET /admin/products/{id}/region-score-breakdown](#44-get-adminproductsidregion-score-breakdown)  
5. [Error Reference](#5-error-reference)  

---

## 1. Common Conventions

### 1.1 Authentication

All endpoints except those marked `[PUBLIC]` require:

```
Authorization: Bearer <jwt_token>
```

Admin endpoints additionally require the JWT to contain `"role": "ADMIN"`.

### 1.2 Standard Response Envelope

```json
{
  "success": true,
  "data": { ... },
  "pagination": { ... },   // present on paginated lists only
  "error": null            // present and non-null on error responses
}
```

### 1.3 Standard Error Object

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": [ { "field": "priorStrength", "issue": "must be between 1 and 100" } ]
  }
}
```

### 1.4 Pagination

List endpoints that support pagination accept:

| Query Param | Type | Default | Description |
|-------------|------|---------|-------------|
| `page` | Integer | 1 | 1-based page number |
| `limit` | Integer | 20 | Items per page; max 100 |

Pagination in response:

```json
"pagination": {
  "page": 1,
  "limit": 20,
  "total": 143,
  "totalPages": 8
}
```

### 1.5 Date Format

All timestamps are ISO 8601 / RFC 3339 in UTC: `2026-05-27T09:30:00Z`.

---

## 2. Product Endpoints

### 2.1 GET /products/{id}

Retrieve a single product by ID including all ranking fields.

**Auth:** `[PUBLIC]` (authenticated users may receive personalization signals in future; not required now)

**Path Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | String | Yes | Product identifier |

**Query Parameters:** None

**Response 200 — Success:**

```json
{
  "success": true,
  "data": {
    "id": "prod_abc123",
    "name": "Wireless Bluetooth Earphones",
    "description": "...",
    "price": 1299.00,
    "currency": "INR",
    "categories": ["cat_electronics", "cat_audio"],
    "tags": ["wireless", "bluetooth", "earphones"],
    "imageUrl": "https://...",

    // --- Rating fields ---
    "avgRating": 4.30,
    "ratingCount": 300,
    "bayesianRating": 4.29,

    // --- Best Seller fields ---
    "bestSellerScore": 0.61,
    "weeklySalesCount": 180,
    "lastActivityAt": "2026-05-27T08:00:00Z",

    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2026-05-27T08:00:05Z"
  },
  "error": null
}
```

> **Note:** `bayesianRating` is returned for transparency and debugging. Client UI should **display `avgRating`** to shoppers and use `bayesianRating` only for sorting/ranking. The field name chosen in the UI should be neutral (e.g., "Rating") — do not expose the term "Bayesian" to shoppers.

**Response 404 — Product not found:**

```json
{
  "success": false,
  "data": null,
  "error": { "code": "NOT_FOUND", "message": "Product not found", "details": [] }
}
```

---

### 2.2 GET /products/best-sellers

Returns the best-seller list for a given region and window. Falls back through the region hierarchy if the specified region is too sparse.

**Auth:** `[PUBLIC]` (authenticated requests may also accept this endpoint; region derived server-side from JWT if `region` param is omitted)

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `region` | String | No | Derived from user address (if auth) or `GLOBAL` | A `regionKey` string: `IN_MH_MUMBAI`, `IN_MH`, `IN_400001`, or `GLOBAL` |
| `window` | String | No | `weekly` | Currently only `weekly` is supported; reserved for `monthly` |
| `page` | Integer | No | 1 | Page number |
| `limit` | Integer | No | 20 | Items per page; max 100 |

**Response 200 — Success:**

```json
{
  "success": true,
  "data": {
    "region": "IN_MH_MUMBAI",
    "resolvedRegion": "IN_MH_MUMBAI",
    "fallbackApplied": false,
    "window": "weekly",
    "items": [
      {
        "rank": 1,
        "product": {
          "id": "prod_xyz789",
          "name": "Kurta Blue Cotton",
          "price": 599.00,
          "currency": "INR",
          "avgRating": 4.50,
          "ratingCount": 120,
          "bayesianRating": 4.42,
          "imageUrl": "https://..."
        },
        "bestSellerScoreRegion": 0.813,
        "weeklySalesCountRegion": 80
      },
      {
        "rank": 2,
        "product": {
          "id": "prod_abc123",
          "name": "Wireless Bluetooth Earphones",
          "price": 1299.00,
          "currency": "INR",
          "avgRating": 4.30,
          "ratingCount": 300,
          "bayesianRating": 4.29,
          "imageUrl": "https://..."
        },
        "bestSellerScoreRegion": 0.474,
        "weeklySalesCountRegion": 45
      }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 143,
    "totalPages": 8
  },
  "error": null
}
```

**Field Descriptions:**

| Field | Description |
|-------|-------------|
| `region` | The region requested by the caller |
| `resolvedRegion` | The region actually used (may differ if fallback applied) |
| `fallbackApplied` | `true` if the resolved region differs from the requested region |
| `bestSellerScoreRegion` | Composite weighted score for this product in this region |
| `weeklySalesCountRegion` | Raw unit sales in the trailing 7-day window for this region |

**Notes:**
- `bestSellerScoreRegion` is included for transparency/debugging. Mobile UI should not display it to shoppers.
- If `region=GLOBAL` is passed, `bestSellerScore` (global) is used in place of `bestSellerScoreRegion`.

---

### 2.3 GET /products/best-sellers/personalized

Returns a personalized best-seller list for the authenticated user. Requires authentication. Falls back to region or global best sellers if personalization is disabled or user has opted out.

**Auth:** Required (Bearer JWT)

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `region` | String | No | Derived from user's address | Override region; useful for "see best sellers near a different location" |
| `window` | String | No | `weekly` | Reserved; currently only `weekly` |
| `limit` | Integer | No | 20 | Max items; capped at `topN` config value |

**Response 200 — Success (personalization active):**

```json
{
  "success": true,
  "data": {
    "region": "IN_MH_MUMBAI",
    "personalized": true,
    "fallbackReason": null,
    "items": [
      {
        "rank": 1,
        "product": {
          "id": "prod_spk001",
          "name": "Wireless Speaker Pro",
          "price": 2499.00,
          "currency": "INR",
          "avgRating": 4.60,
          "ratingCount": 85,
          "bayesianRating": 4.49,
          "imageUrl": "https://..."
        },
        "isExploration": false
      },
      {
        "rank": 18,
        "product": {
          "id": "prod_spt009",
          "name": "Yoga Mat Pro",
          "price": 899.00,
          "currency": "INR",
          "avgRating": 4.20,
          "ratingCount": 310,
          "bayesianRating": 4.18,
          "imageUrl": "https://..."
        },
        "isExploration": true
      }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 20,
    "totalPages": 1
  },
  "error": null
}
```

**Response 200 — Personalization opted out / disabled (fallback):**

```json
{
  "success": true,
  "data": {
    "region": "IN_MH_MUMBAI",
    "personalized": false,
    "fallbackReason": "USER_OPT_OUT",
    "items": [ ... ]
  },
  "pagination": { ... },
  "error": null
}
```

**`fallbackReason` values:**

| Value | Meaning |
|-------|---------|
| `null` | Personalization was applied |
| `"USER_OPT_OUT"` | User has `personalizationOptOut = true` |
| `"FEATURE_DISABLED"` | Admin has disabled personalization globally |
| `"NO_AFFINITY_DATA"` | User has no behavioral history yet |

**Privacy note:** `personalizedScore`, `userAffinityMatch`, and the reason a product was ranked are **never** included in the response. Only `isExploration` is exposed to allow the mobile UI to optionally label exploration items.

---

## 3. Event Tracking Endpoint

### 3.1 POST /events/track

Receives a lightweight behavioral event from the mobile client to update the user's affinity profile.  
Raw events are **never stored** — only the aggregated affinity counters are updated.

**Auth:** Required (Bearer JWT)

**Rate Limit:** 100 requests per minute per user. Exceeding this returns HTTP 429.

**Request Body:**

```json
{
  "eventType": "VIEW_PRODUCT",
  "productId": "prod_abc123",
  "categoryId": "cat_electronics",
  "ts": "2026-05-27T09:30:00Z"
}
```

**Field Validation:**

| Field | Type | Required | Constraints |
|-------|------|----------|------------|
| `eventType` | String | Yes | One of: `VIEW_PRODUCT`, `ADD_TO_CART`, `RATE`, `COMMENT`, `PURCHASE` |
| `productId` | String | Yes | Must be a valid, existing product ID |
| `categoryId` | String | Yes | Validated against product's actual categories (client-supplied value is cross-checked) |
| `ts` | ISO 8601 String | No | If present, must be within last 5 minutes; older events are silently ignored |

> **Security note:** The server always resolves the authoritative `categoryId` from `productId` and validates that the client-supplied `categoryId` matches. This prevents a malicious client from assigning events to arbitrary categories to game the affinity system.

**Response 200 — Event accepted:**

```json
{
  "success": true,
  "data": { "processed": true },
  "error": null
}
```

**Response 409 — Duplicate within idempotency window:**

```json
{
  "success": true,
  "data": { "processed": false, "reason": "DUPLICATE_EVENT" },
  "error": null
}
```

(Returns 200-family to prevent client retry loops; `processed: false` communicates the dedup.)

**Response 429 — Rate limit exceeded:**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many tracking events. Limit: 100/minute.",
    "details": [{ "retryAfterSeconds": 12 }]
  }
}
```

---

## 4. Admin Endpoints

All admin endpoints require `"role": "ADMIN"` in the JWT payload.

### 4.1 GET /admin/ranking-config

Returns the current ranking configuration.

**Auth:** Admin

**Response 200:**

```json
{
  "success": true,
  "data": {
    "bayesian": {
      "globalMeanRating": 4.05,
      "priorStrength": 10,
      "minRatingCountForEligibility": 5
    },
    "bestSellerWeights": {
      "weightSales": 0.50,
      "weightViews": 0.20,
      "weightAddToCart": 0.15,
      "weightRecency": 0.15
    },
    "region": {
      "regionLevel": "CITY",
      "minRegionProductCount": 5,
      "regionRatingThreshold": 50
    },
    "personalization": {
      "personalizationEnabled": true,
      "affinityWeightBase": 0.70,
      "affinityWeightPersonal": 0.30,
      "affinityIncrementView": 1.0,
      "affinityIncrementAddToCart": 3.0,
      "affinityIncrementPurchase": 5.0,
      "affinityIncrementRate": 2.0,
      "decayFactor": 0.98,
      "explorationPercentage": 0.15,
      "categoryDiversityLimit": 5,
      "topN": 20
    },
    "updatedAt": "2026-05-26T02:00:00Z",
    "updatedBy": "admin_user_007"
  },
  "error": null
}
```

---

### 4.2 PUT /admin/ranking-config

Updates one or more ranking configuration values. Partial updates are supported (only send the fields you want to change within each section).

**Auth:** Admin

**Request Body (all sections optional; within each section, all fields optional):**

```json
{
  "bayesian": {
    "priorStrength": 15,
    "minRatingCountForEligibility": 3
  },
  "bestSellerWeights": {
    "weightSales": 0.55,
    "weightViews": 0.20,
    "weightAddToCart": 0.15,
    "weightRecency": 0.10
  },
  "region": {
    "regionLevel": "STATE"
  },
  "personalization": {
    "personalizationEnabled": false,
    "decayFactor": 0.97
  }
}
```

**Validation Rules:**

| Rule | Error |
|------|-------|
| `priorStrength` not in [1, 100] | `VALIDATION_ERROR` on field `priorStrength` |
| `bestSellerWeights.*` do not sum to 1.0 (±0.001) | `VALIDATION_ERROR` on field `bestSellerWeights` |
| `decayFactor` not in (0, 1] | `VALIDATION_ERROR` on field `decayFactor` |
| `affinityWeightBase + affinityWeightPersonal ≠ 1.0` | `VALIDATION_ERROR` on field `affinityWeightPersonal` |
| `regionLevel` not one of `["CITY","STATE","PINCODE"]` | `VALIDATION_ERROR` on field `regionLevel` |

**Response 200 — Updated:**

```json
{
  "success": true,
  "data": {
    "updated": true,
    "message": "RankingConfig updated. Changes take effect immediately for new requests. Nightly batch will recompute all scores.",
    "changedFields": ["bayesian.priorStrength", "personalization.personalizationEnabled"]
  },
  "error": null
}
```

**Side Effects:**
- In-memory `RankingConfig` singleton is refreshed immediately across all service instances.
- Redis caches for `bestsellers:*` and `personalized:*` are invalidated.
- Audit log entry is written with `changedFields`, `adminId`, and `timestamp`.

---

### 4.3 GET /admin/regions

Lists all active regions with product count and latest score metadata.

**Auth:** Admin

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `page` | Integer | No | 1 | Page number |
| `limit` | Integer | No | 50 | Items per page |
| `sort` | String | No | `productCount.desc` | Sort key: `regionKey.asc`, `productCount.desc`, `lastActivityAt.desc` |

**Response 200:**

```json
{
  "success": true,
  "data": {
    "regions": [
      {
        "regionKey": "IN_MH_MUMBAI",
        "productCount": 234,
        "totalWeeklySales": 5820,
        "lastActivityAt": "2026-05-27T08:45:00Z"
      },
      {
        "regionKey": "IN_KA_BENGALURU",
        "productCount": 189,
        "totalWeeklySales": 3240,
        "lastActivityAt": "2026-05-27T07:30:00Z"
      },
      {
        "regionKey": "GLOBAL",
        "productCount": 1540,
        "totalWeeklySales": 42000,
        "lastActivityAt": "2026-05-27T09:00:00Z"
      }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 32,
    "totalPages": 1
  },
  "error": null
}
```

---

### 4.4 GET /admin/products/{id}/region-score-breakdown

Returns the scoring breakdown for a product across all regions where it has data. Useful for debugging unexpected ranking positions.

**Auth:** Admin  

**Path Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | String | Yes | Product identifier |

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `region` | String | No | All regions | If provided, filters to a single `regionKey` |

**Response 200:**

```json
{
  "success": true,
  "data": {
    "product": {
      "id": "prod_abc123",
      "name": "Wireless Bluetooth Earphones",
      "avgRating": 4.30,
      "ratingCount": 300,
      "bayesianRating": 4.29,
      "globalMeanRating": 4.05,
      "priorStrength": 10
    },
    "bayesianBreakdown": {
      "formula": "BayesianRating = (v/(v+m)) * R + (m/(v+m)) * C",
      "v": 300,
      "m": 10,
      "R": 4.30,
      "C": 4.05,
      "result": 4.29
    },
    "regionBreakdowns": [
      {
        "regionKey": "IN_MH_MUMBAI",
        "weeklySalesCount": 45,
        "viewsCountRegion": 800,
        "addToCartCountRegion": 30,
        "daysSinceLastActivity": 2,
        "recencyScore": 0.752,
        "regionMaxima": {
          "maxSales": 100,
          "maxViews": 2000,
          "maxCart": 80
        },
        "scoreComponents": {
          "salesComponent":   0.225,
          "viewsComponent":   0.080,
          "cartComponent":    0.056,
          "recencyComponent": 0.113
        },
        "bestSellerScoreRegion": 0.474,
        "rankInRegion": 2
      },
      {
        "regionKey": "IN_KA_BENGALURU",
        "weeklySalesCount": 12,
        "viewsCountRegion": 210,
        "addToCartCountRegion": 9,
        "daysSinceLastActivity": 3,
        "recencyScore": 0.651,
        "regionMaxima": {
          "maxSales": 80,
          "maxViews": 1500,
          "maxCart": 65
        },
        "scoreComponents": {
          "salesComponent":   0.075,
          "viewsComponent":   0.028,
          "cartComponent":    0.021,
          "recencyComponent": 0.098
        },
        "bestSellerScoreRegion": 0.222,
        "rankInRegion": 7
      }
    ]
  },
  "error": null
}
```

---

## 5. Error Reference

| HTTP Status | Error Code | Description |
|-------------|-----------|-------------|
| 400 | `VALIDATION_ERROR` | Request body or query parameter failed validation |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT token |
| 403 | `FORBIDDEN` | Valid JWT but insufficient role (e.g., non-admin accessing admin endpoint) |
| 404 | `NOT_FOUND` | Referenced resource (product, region) does not exist |
| 409 | `CONFLICT` | Duplicate operation within idempotency window (event tracking only) |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests within time window |
| 500 | `INTERNAL_ERROR` | Unexpected server error; should be logged and alerted |
| 503 | `SERVICE_UNAVAILABLE` | Dependency (DB, cache) temporarily unavailable |

### 5.1 Validation Error Detail Format

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "bestSellerWeights",
        "issue": "weights must sum to 1.0 (current sum: 0.95)"
      },
      {
        "field": "decayFactor",
        "issue": "must be greater than 0 and at most 1.0"
      }
    ]
  }
}
```

---

## Appendix: Mobile UI Integration Guide

### Best-Seller Home Section

```
Home Page
├── Section: "Best Sellers Near You"
│     Source: GET /products/best-sellers?region={userRegionKey}&window=weekly
│     Fallback badge: "Showing nationwide results" (when fallbackApplied=true)
│
└── Section: "Recommended For You"  (authenticated users only)
      Source: GET /products/best-sellers/personalized
      Opt-out: Link to Settings → "Personalized Recommendations"
      Exploration badge: optional "Discover Something New" label for isExploration=true items
```

### Event Tracking Integration

Send events **fire-and-forget** (do not block UI on response):

```
User opens product detail    → POST /events/track { eventType: "VIEW_PRODUCT", ... }
User taps "Add to Cart"      → POST /events/track { eventType: "ADD_TO_CART", ... }
User submits a rating        → POST /events/track { eventType: "RATE", ... }
(Purchase handled server-side via order service; no mobile event needed)
```

Batch events if offline: queue locally and flush on reconnection. Discard events older than 5 minutes before sending (server will silently ignore them anyway).

### Rating Display

```
Display:  "★ 4.3  (300 reviews)"   ← use avgRating and ratingCount
Sort by:  bayesianRating            ← received in API response, used client-side
Do NOT:   show bayesianRating to shoppers or mention "Bayesian" in UI
```
