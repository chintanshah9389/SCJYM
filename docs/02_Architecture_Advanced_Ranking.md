# Architecture Design Document  
## Advanced Ranking Enhancements  
**Version:** 1.0  
**Date:** 2026-05-27  

---

## Table of Contents

1. [System Overview](#1-system-overview)  
2. [Component Diagram](#2-component-diagram)  
3. [Feature 1 — Bayesian Rating Architecture](#3-feature-1--bayesian-rating-architecture)  
4. [Feature 2 — Region-wise Best Sellers Architecture](#4-feature-2--region-wise-best-sellers-architecture)  
5. [Feature 3 — Personalization Architecture](#5-feature-3--personalization-architecture)  
6. [Caching Strategy](#6-caching-strategy)  
7. [Scheduled Jobs](#7-scheduled-jobs)  
8. [Scalability & Free-Tier Considerations](#8-scalability--free-tier-considerations)  
9. [Security Considerations](#9-security-considerations)  

---

## 1. System Overview

The ranking system is composed of five logical services layered on top of the existing product catalog and order databases. Each service has a narrow responsibility and communicates via an internal event bus or direct service calls.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MOBILE / WEB CLIENT                             │
│  - Fetches best-seller lists (global, regional, personalized)           │
│  - Posts lightweight behavioral events (view, cart, rate, purchase)     │
└──────────────────────┬──────────────────────────────┬───────────────────┘
                       │ HTTPS / REST                 │ HTTPS / REST
               ┌───────▼───────┐               ┌──────▼───────────────┐
               │  Product API  │               │  Event Tracking API  │
               │  (read paths) │               │  POST /events/track  │
               └───────┬───────┘               └──────────────────────┘
                       │                                    │
          ┌────────────▼─────────────────────────────────  │ ───────────┐
          │                    INTERNAL EVENT BUS           │            │
          │  (in-process queue / lightweight message queue) │            │
          └──────┬────────────────────┬────────────────────▼────────────┘
                 │                    │                     │
   ┌─────────────▼──────┐   ┌─────────▼───────────┐  ┌────▼───────────────┐
   │  Rating Service    │   │  Region Score Service│  │ Affinity Service   │
   │  - avgRating       │   │  - per-region stats  │  │ - userAffinityProf │
   │  - bayesianRating  │   │  - bestSellerScore   │  │ - topCategories    │
   │  - ratingCount     │   │    Region            │  │ - time decay       │
   └─────────────┬──────┘   └────────────┬─────────┘  └────────────────────┘
                 │                        │
                 └───────────┬────────────┘
                             │
                   ┌─────────▼──────────┐
                   │  Scoring Engine    │
                   │  - Bayesian formula│
                   │  - Region scoring  │
                   │  - Personalized    │
                   │    ranking         │
                   └─────────┬──────────┘
                             │
                   ┌─────────▼──────────┐   ┌──────────────┐
                   │   Database Layer   │   │  Redis Cache │
                   │  (MongoDB / PgSQL) │   │  (ranking    │
                   └────────────────────┘   │   lists)     │
                                            └──────────────┘
                   ┌────────────────────┐
                   │  Scheduler Service │
                   │  - Nightly C recalc│
                   │  - Window roll     │
                   │  - Affinity decay  │
                   └────────────────────┘
```

---

## 2. Component Diagram

### 2.1 Services and Responsibilities

| Service | Responsibility | Trigger |
|---------|---------------|---------|
| **Rating Service** | Maintains `avgRating`, `ratingCount`, triggers Bayesian recomputation on-demand | Rating create / update / delete events |
| **Region Score Service** | Maintains `ProductRegionStats`; computes `bestSellerScoreRegion` | Order placed, view/cart events, nightly job |
| **Affinity Service** | Maintains `UserAffinityProfile`; increments category scores; applies lazy decay | `POST /events/track` calls |
| **Scoring Engine** | Pure computation: Bayesian formula, region scoring, personalized scoring | Called by above services; also called by Scheduler |
| **Scheduler Service** | Nightly batch jobs for C recomputation, 7-day window roll, affinity global decay | Cron |
| **Product API** | Exposes ranked and unranked product endpoints | HTTP GET from clients |
| **Event Tracking API** | Receives lightweight behavioral events from mobile | HTTP POST from clients |
| **Admin API** | Read/write `RankingConfig`; view region stats | Admin UI HTTP calls |

### 2.2 Data Flow Summary

```
Rating Event ──► Rating Service ──► Scoring Engine ──► Update product.bayesianRating
Order Event  ──► Region Score Service ──► Update ProductRegionStats ──► Scoring Engine ──► Update bestSellerScoreRegion
Track Event  ──► Affinity Service ──► Update UserAffinityProfile
Nightly Cron ──► Scheduler ──► [Rating Service, Region Score Service, Affinity Service] ──► Scoring Engine ──► Batch DB writes
```

---

## 3. Feature 1 — Bayesian Rating Architecture

### 3.1 On-Event Path (Real-time)

```
User submits rating
        │
        ▼
Rating Service validates & persists rating
        │
        ▼
Rating Service recalculates per product:
  newRatingCount = oldCount ± 1
  newAvgRating   = (oldAvg × oldCount ± newValue) / newCount     [incremental formula]
        │
        ▼
Scoring Engine.computeBayesian(R, v, C_current, m):
  returns bayesianRating
        │
        ▼
Write { avgRating, ratingCount, bayesianRating } to Product record
        │
        ▼
Invalidate Redis cache keys:
  - product:{id}
  - bestsellers:global (if product was ranked)
  - bestsellers:region:{regionKey} (relevant regions)
```

**Incremental average formula** (avoids re-scanning all ratings):
- Add: `newAvg = (oldAvg × oldCount + newValue) / (oldCount + 1)`
- Update: `newAvg = (oldAvg × oldCount − oldValue + newValue) / oldCount`
- Delete: `newAvg = (oldAvg × oldCount − deletedValue) / (oldCount − 1)`, guard oldCount > 1

### 3.2 Nightly Batch Path

```
Scheduler triggers at 02:00 UTC
        │
        ├─► Step 1: Compute C (globalMeanRating)
        │     SQL/Mongo: SELECT weighted_avg(avgRating, ratingCount) FROM products WHERE ratingCount > 0
        │     Write new C to RankingConfig
        │
        └─► Step 2: Batch recompute bayesianRating for ALL products
              For each product in cursor:
                bayesianRating = Scoring Engine.computeBayesian(R, v, C_new, m)
              Bulk-write to DB in batches of 500
              Invalidate Redis keys for any product whose score changed
```

### 3.3 RankingConfig Read Path

```
On server startup: load RankingConfig into in-memory singleton.
On PUT /admin/ranking-config: reload singleton + publish in-process config refresh event.
Services read m and C from singleton without a DB round-trip per request.
```

---

## 4. Feature 2 — Region-wise Best Sellers Architecture

### 4.1 RegionKey Derivation

```
function deriveRegionKey(user, regionLevel):
  if user.address is null: return "GLOBAL"

  country = normalize(user.address.country)   // ISO 3166-1 alpha-2, uppercase
  state   = normalize(user.address.state)      // uppercase, spaces → _
  city    = normalize(user.address.city)       // uppercase, spaces → _
  pincode = normalize(user.address.pincode)

  switch regionLevel:
    CITY:    return country + "_" + state + "_" + city   (fallback: STATE if city missing)
    STATE:   return country + "_" + state                (fallback: GLOBAL if state missing)
    PINCODE: return country + "_" + pincode              (fallback: STATE if pincode missing)
```

### 4.2 On-Order-Placed Path

```
Order placed event (contains userId, productId, quantity)
        │
        ▼
Region Score Service:
  regionKey = deriveRegionKey(user, config.regionLevel)
  UPSERT ProductRegionStats:
    weeklySalesCountRegion += quantity
    lastActivityAtRegion    = now()
        │
        ▼
Enqueue async job: recomputeRegionScore(productId, regionKey)
        │             (runs in background within seconds)
        ▼
Scoring Engine.computeRegionScore(stats, regionMaxima, weights):
  returns bestSellerScoreRegion
        │
        ▼
Write bestSellerScoreRegion to ProductRegionStats
Invalidate Redis key: bestsellers:region:{regionKey}
```

### 4.3 On-View / On-Cart Path (Optional: requires mobile event tracking)

```
POST /events/track { eventType: "VIEW_PRODUCT", productId, categoryId }
        │
        ▼
Event Tracking API authenticates user, derives regionKey
        │
        ▼
Region Score Service: increment viewsCountRegion or addToCartCountRegion
(Batch buffer: flush to DB every 60 seconds to avoid hot-row contention)
```

### 4.4 Nightly Region Score Refresh

```
Scheduler: 03:00 UTC
        │
        ├─► Step 1: Roll 7-day window
        │     Delete or zero-out sales/views/cart events older than 7 days from ProductRegionStats
        │     (Strategy A: store daily buckets and drop oldest bucket daily)
        │     (Strategy B: store only the 7-day aggregate; subtract the daily delta from 8 days ago)
        │
        ├─► Step 2: Compute region maxima
        │     For each active regionKey:
        │       maxSales = MAX(weeklySalesCountRegion) across all products in region
        │       maxViews = MAX(viewsCountRegion) across all products in region
        │       maxCart  = MAX(addToCartCountRegion) across all products in region
        │       Store in RegionMaxima (ephemeral, recomputed each night)
        │
        └─► Step 3: Recompute bestSellerScoreRegion for all products in all regions
              Bulk write in batches of 500
              Invalidate Redis: bestsellers:region:* (wildcard or enumerated)
```

### 4.5 Region Fallback Chain

```
Request: GET /products/best-sellers?region=IN_MH_MUMBAI
        │
        ▼
Does Redis key exist for IN_MH_MUMBAI? → serve cached list
        │ (cache miss)
        ▼
Query ProductRegionStats WHERE regionKey = "IN_MH_MUMBAI"
Count of products with bestSellerScoreRegion > 0 >= minRegionProductCount?
        │ YES                          │ NO (region too sparse)
        ▼                             ▼
Build list from region         Fall back to parent: IN_MH
Cache & return                         │ (repeat check)
                                       ▼ still sparse
                                   Fall back to GLOBAL
```

---

## 5. Feature 3 — Personalization Architecture

### 5.1 Event Ingestion Path

```
POST /events/track (authenticated + rate-limited)
        │
        ▼
Event Tracking API:
  - Validate JWT → extract userId
  - Validate eventType, productId, categoryId
  - Check rate limit (100 events/minute/user via Redis counter)
  - Check idempotency window (10s dedup key in Redis)
        │
        ▼
Affinity Service:
  increment = affinityWeights[eventType]  // from RankingConfig singleton
  UPSERT UserAffinityProfile:
    topCategories[categoryId].score += increment
    updatedAt = now()
  (Optionally: push productId to recentlyViewedProductIds, cap at 50 FIFO)
        │
        ▼
No raw event stored. Ephemeral Redis dedup key expires in 10s.
```

### 5.2 Affinity Decay Architecture

**Lazy decay** (preferred for free-tier; no global scheduled write needed for inactive users):

```
On read of UserAffinityProfile:
  daysSinceUpdate = (now() - profile.updatedAt).days
  if daysSinceUpdate > 0:
    decayMultiplier = config.decayFactor ^ daysSinceUpdate
    for each category in topCategories:
      category.score *= decayMultiplier
    (Update is written back lazily in the same transaction)
```

**Eager decay** (nightly batch; simpler queries at read time):

```
Scheduler: 04:00 UTC
  For each UserAffinityProfile updated in last 30 days:
    for each category:
      category.score *= config.decayFactor
  Bulk write in batches of 200
```

Recommendation: use **lazy decay** to minimize database write load.

### 5.3 Personalized List Generation Path

```
GET /products/best-sellers/personalized?region=IN_MH_MUMBAI
(Authenticated request)
        │
        ▼
Check Redis: personalized:{userId}:{regionKey} → serve if hit (TTL 10 min)
        │ (miss)
        ▼
1. Load UserAffinityProfile (with lazy decay applied)
2. If personalizationOptOut OR personalizationEnabled=false:
      serve region best sellers (non-personalized path)
3. Derive regionKey from user address
4. Load top 3× N candidate products by BestSellerScoreRegion from ProductRegionStats
   (e.g., 60 candidates for N=20)
5. For each candidate:
      userAffinityMatch = AffinityService.computeMatch(product.categories, profile)
      personalizedScore = bestSellerScoreRegion * (base + personal * userAffinityMatch)
6. Sort candidates by personalizedScore DESC
7. Apply diversity filter:
      result = []
      categoryCounts = {}
      explorationSlots = ceil(N * explorationPercentage)
      mainSlots = N - explorationSlots
      for product in sorted_candidates:
        if len(result) >= mainSlots: break
        if categoryCounts[product.primaryCategory] >= categoryDiversityLimit: skip
        result.append(product)
        categoryCounts[product.primaryCategory]++
8. Fill exploration slots:
      explorationCandidates = trending products from categories NOT in result's top categories
      result.extend(explorationCandidates[:explorationSlots])
9. Cache result in Redis with TTL 10 minutes
10. Return result with { personalizedScore, bestSellerScoreRegion } (score NOT exposed to client)
```

### 5.4 Opt-Out Flow

```
User toggles "Personalized Recommendations" OFF in settings
        │
        ▼
PATCH /users/me/preferences { personalizationOptOut: true }
        │
        ▼
UserPreference.personalizationOptOut = true written to DB
        │
        ▼
Invalidate Redis: personalized:{userId}:*
        │
        ▼
Subsequent GET /products/best-sellers/personalized? 
  → detects opt-out → returns region best sellers
  → cached under key: bestsellers:region:{regionKey} (shared, not user-specific)
```

---

## 6. Caching Strategy

### 6.1 Cache Keys and TTLs

| Cache Key Pattern | Content | TTL | Invalidation Trigger |
|-------------------|---------|-----|---------------------|
| `product:{id}` | Full product doc with avgRating, bayesianRating | 5 min | Rating event on product |
| `bestsellers:global` | Top-N global list (sorted by bayesianRating + bestSellerScore) | 15 min | Nightly job or significant score change |
| `bestsellers:region:{regionKey}` | Top-N regional list | 15 min | Order/event for that region; nightly job |
| `personalized:{userId}:{regionKey}` | Personalized top-N list | 10 min | Affinity update for user; user opt-out change |
| `rankingconfig` | Singleton RankingConfig | Until PUT admin endpoint invalidates | Admin config update |
| `ratelimit:events:{userId}` | Event rate limit counter | 60 s sliding window | Auto-expiry |
| `dedup:events:{userId}:{hash}` | Idempotency for track events | 10 s | Auto-expiry |

### 6.2 Cache Warming

On application startup or after nightly job:
- Pre-compute and cache `bestsellers:global` and top-20 most active regions.
- Personalized lists are warmed on first request per user (lazy).

---

## 7. Scheduled Jobs

| Job Name | Schedule (UTC) | Duration Estimate | Description |
|----------|---------------|------------------|-------------|
| `recompute-global-mean` | 02:00 daily | < 1 min | Compute C from all product ratings; write to RankingConfig |
| `batch-bayesian-rating` | 02:05 daily | 5–15 min | Recompute bayesianRating for all products using new C |
| `roll-region-window` | 03:00 daily | 5–10 min | Drop events older than 7 days; update running region counters |
| `recompute-region-scores` | 03:15 daily | 10–30 min | Compute regionMaxima + bestSellerScoreRegion for all product-region pairs |
| `decay-affinity-scores` | 04:00 daily | 5–20 min | Apply decayFactor to all active UserAffinityProfiles (or skip if lazy decay) |
| `cache-warm-bestsellers` | 04:45 daily | 2–5 min | Pre-warm Redis cache for global + top-20 active regions |

All jobs are **idempotent** (safe to re-run on failure). Each job records a `lastRunAt` and `lastRunStatus` in a `SchedulerLog` collection/table for monitoring.

---

## 8. Scalability & Free-Tier Considerations

### 8.1 Read Path Optimization

- All ranking queries hit Redis first. DB is accessed only on cache miss.  
- Personalized lists are pre-computed to N=20 and cached; no runtime scoring on reads.  
- Region best-seller queries: single indexed query on `(regionKey, bestSellerScoreRegion DESC)`, `LIMIT N`.

### 8.2 Write Path Optimization

- On-event Bayesian recomputation: incremental formula avoids full rating table scan.  
- Region stats updates: buffer view/cart events in memory for 60 seconds before batch DB write to prevent hot-row contention.  
- Affinity updates: single UPSERT per event, no scan required.

### 8.3 Free-Tier Database Notes

| Concern | Mitigation |
|---------|-----------|
| Large nightly batch writes | Use `BULK_WRITE` / `bulkWrite()` in batches of 500 rows; run at low-traffic hours (02:00–05:00 UTC). |
| ProductRegionStats table growth | Index only active regions; purge regions with 0 sales for 60+ days. |
| UserAffinityProfile growth | Implement lazy decay so only active users are stored; no writes for opted-out users. |
| Redis memory | Short TTLs; LRU eviction policy; personalized keys are user-specific and TTL is 10 min. |

### 8.4 Horizontal Scaling Notes

- `Scoring Engine` is stateless; can run in multiple instances.  
- `Affinity Service` requires atomic increments — use database-level atomic operations (`$inc` in MongoDB, `UPDATE ... SET score = score + ?` in PostgreSQL) rather than read-modify-write.  
- Scheduler jobs: use a distributed lock (Redis `SET NX EX`) to ensure only one instance runs each job.

---

## 9. Security Considerations

### 9.1 Event Tracking Anti-Abuse

| Threat | Mitigation |
|--------|-----------|
| Competitor floods view events to boost own products | Rate limit: 100 events/minute/user (Redis counter). Unauthenticated events rejected. |
| User sends fabricated `categoryId` to game affinity | Server resolves `categoryId` from `productId` lookup, ignores client-supplied `categoryId` if inconsistent. |
| Replay attacks on track events | 10-second dedup window per `(userId, eventType, productId)` hash. |
| Affinity inflation via rapid view loop | Idempotency key prevents same product view from counting twice within 10 seconds. |

### 9.2 Admin API Protection

- All `PUT /admin/*` endpoints require `ROLE_ADMIN` JWT claim.  
- `RankingConfig` changes are audit-logged (`adminId`, `changedFields`, `timestamp`).  
- Weights that would cause division-by-zero (all zero) are rejected at validation layer.

### 9.3 Privacy Compliance

- Affinity profiles contain only category IDs and aggregate scores — no PII.  
- Raw behavioral events are never persisted; only counters survive.  
- Opt-out flag is respected immediately on all read paths.  
- `personalizationOptOut` users are served from the shared regional cache — their request is indistinguishable from any other non-personalized request at the cache layer.

### 9.4 No SSRF Risk

All ranking computation is internal to the application. No external URL fetching is performed as part of ranking.
