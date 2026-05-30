# Database Schema Design  
## Advanced Ranking Enhancements  
**Version:** 1.0  
**Date:** 2026-05-27  

Both MongoDB and PostgreSQL schemas are provided. Implement whichever matches your existing stack.

---

## Table of Contents

1. [MongoDB Schemas](#1-mongodb-schemas)  
   1.1 [Product — Additions](#11-product--additions)  
   1.2 [RankingConfig](#12-rankingconfig)  
   1.3 [ProductRegionStats](#13-productregionstats)  
   1.4 [UserPreference](#14-userpreference)  
   1.5 [SchedulerLog](#15-schedulerlog)  
2. [PostgreSQL Schemas](#2-postgresql-schemas)  
   2.1 [Products — Additions](#21-products--additions)  
   2.2 [ranking\_config](#22-ranking_config)  
   2.3 [product\_region\_stats](#23-product_region_stats)  
   2.4 [user\_preferences](#24-user_preferences)  
   2.5 [scheduler\_log](#25-scheduler_log)  
3. [Index Strategy](#3-index-strategy)  
4. [Migration Notes](#4-migration-notes)  
5. [Retention & Archival Policy](#5-retention--archival-policy)  

---

## 1. MongoDB Schemas

### 1.1 Product — Additions

Add the following fields to the existing `products` collection. No new collection is required.

```javascript
// Additional fields merged into existing Product document
{
  // --- Bayesian Rating ---
  avgRating:      Number,   // Raw arithmetic mean (1.0–5.0). Default: 0
  ratingCount:    Number,   // Total number of ratings. Default: 0
  bayesianRating: Number,   // Bayesian-adjusted score used for ranking. Default: 0

  // --- Global Best Seller Score ---
  bestSellerScore:    Number,   // Weighted composite; global scope. Default: 0
  weeklySalesCount:   Number,   // Units sold in trailing 7-day window. Default: 0
  viewsCount:         Number,   // Global product-page views. Default: 0
  addToCartCount:     Number,   // Global add-to-cart events. Default: 0
  lastActivityAt:     Date,     // Timestamp of most recent order/view/cart globally

  updatedAt:          Date      // Set on any field modification
}

// Indexes to add to products collection:
// { bayesianRating: -1 }                        — top-rated queries
// { bestSellerScore: -1 }                        — global best sellers
// { "categories": 1, bestSellerScore: -1 }       — category-scoped best sellers
```

### 1.2 RankingConfig

A **singleton** document. Only one document should exist in this collection (`_id: "ranking_config"`).

```javascript
{
  _id: "ranking_config",

  // --- Bayesian Rating ---
  globalMeanRating:           Number,   // C: recomputed nightly. Default: 4.0
  priorStrength:              Number,   // m: admin-configurable. Default: 10
  minRatingCountForEligibility: Number, // Minimum ratings for Top-Rated eligibility. Default: 5

  // --- Best Seller Weights (must sum to 1.0) ---
  weightSales:      Number,   // Default: 0.50
  weightViews:      Number,   // Default: 0.20
  weightAddToCart:  Number,   // Default: 0.15
  weightRecency:    Number,   // Default: 0.15

  // --- Region Config ---
  regionLevel:             String,   // "CITY" | "STATE" | "PINCODE". Default: "CITY"
  minRegionProductCount:   Number,   // Minimum products in a region to serve it. Default: 5
  regionRatingThreshold:   Number,   // Min regional ratings to use region-specific avg. Default: 50

  // --- Personalization Config ---
  personalizationEnabled:    Boolean,  // Global on/off switch. Default: true
  affinityWeightBase:        Number,   // 0.70 — base coefficient in P-score formula
  affinityWeightPersonal:    Number,   // 0.30 — personalization coefficient
  affinityIncrementView:     Number,   // Default: 1.0
  affinityIncrementAddToCart: Number,  // Default: 3.0
  affinityIncrementPurchase: Number,   // Default: 5.0
  affinityIncrementRate:     Number,   // Default: 2.0
  decayFactor:               Number,   // Default: 0.98 — daily affinity decay multiplier
  explorationPercentage:     Number,   // Default: 0.15 — fraction of slots for exploration
  categoryDiversityLimit:    Number,   // Default: 5 — max same-category products in top-N
  topN:                      Number,   // Default: 20 — size of returned list

  updatedAt: Date,
  updatedBy: String   // adminId for audit trail
}
```

### 1.3 ProductRegionStats

One document per `(productId, regionKey)` pair.

```javascript
{
  _id: ObjectId,

  productId:  ObjectId,   // ref: products._id
  regionKey:  String,     // e.g., "IN_MH_MUMBAI"

  // Trailing 7-day window counters (rolled nightly)
  weeklySalesCount:      Number,   // Default: 0
  viewsCountRegion:      Number,   // Optional. Default: 0
  addToCartCountRegion:  Number,   // Optional. Default: 0

  lastActivityAt:        Date,     // Most recent order/event timestamp in this region
  bestSellerScoreRegion: Number,   // Computed weighted score. Default: 0

  updatedAt: Date
}

// Indexes:
// { regionKey: 1, bestSellerScoreRegion: -1 }   — best sellers per region (primary query)
// { productId: 1, regionKey: 1 } [unique]        — lookup by product+region; enforce uniqueness
```

### 1.4 UserPreference

One document per user. Created on first behavioral event; never for opted-out users until an event arrives.

```javascript
{
  _id: ObjectId,
  userId: ObjectId,   // ref: users._id [unique]

  // Affinity vector by category
  topCategories: [
    {
      categoryId: ObjectId,   // ref: categories._id
      score:      Number      // Accumulated + decayed affinity score
    }
  ],

  // Affinity vector by tag (optional)
  topTags: [
    {
      tag:   String,
      score: Number
    }
  ],

  // Optional: recently viewed product IDs (max 50, FIFO, for exploration logic)
  recentlyViewedProductIds: [ObjectId],   // ref: products._id

  // Privacy controls
  personalizationOptOut: Boolean,   // Default: false

  updatedAt: Date   // Used for lazy decay calculation
}

// Indexes:
// { userId: 1 } [unique]   — lookup by user
// { updatedAt: 1 }         — scheduler: find recently active users for eager decay
```

### 1.5 SchedulerLog

Audit trail for all scheduled jobs.

```javascript
{
  _id: ObjectId,
  jobName:     String,    // e.g., "recompute-global-mean"
  startedAt:   Date,
  completedAt: Date,
  status:      String,    // "SUCCESS" | "FAILED" | "RUNNING"
  recordsProcessed: Number,
  errorMessage: String    // null on success
}
```

---

## 2. PostgreSQL Schemas

### 2.1 Products — Additions

```sql
-- Migration: add ranking columns to existing products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS avg_rating        NUMERIC(3, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count      INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bayesian_rating   NUMERIC(3, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_seller_score NUMERIC(6, 5) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_sales_count INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS views_count        INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS add_to_cart_count  INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_at   TIMESTAMPTZ;

-- Check constraints
ALTER TABLE products
  ADD CONSTRAINT chk_avg_rating_range      CHECK (avg_rating       BETWEEN 0 AND 5),
  ADD CONSTRAINT chk_bayesian_range        CHECK (bayesian_rating  BETWEEN 0 AND 5),
  ADD CONSTRAINT chk_best_seller_range     CHECK (best_seller_score BETWEEN 0 AND 1),
  ADD CONSTRAINT chk_rating_count_nonneg   CHECK (rating_count      >= 0),
  ADD CONSTRAINT chk_weekly_sales_nonneg   CHECK (weekly_sales_count >= 0);

-- New indexes on products
CREATE INDEX IF NOT EXISTS idx_products_bayesian_rating   ON products (bayesian_rating   DESC);
CREATE INDEX IF NOT EXISTS idx_products_best_seller_score ON products (best_seller_score DESC);
```

### 2.2 ranking\_config

```sql
CREATE TABLE IF NOT EXISTS ranking_config (
  id   VARCHAR(50) PRIMARY KEY DEFAULT 'default',

  -- Bayesian Rating
  global_mean_rating              NUMERIC(3, 2) NOT NULL DEFAULT 4.0,
  prior_strength                  INTEGER       NOT NULL DEFAULT 10,
  min_rating_count_for_eligibility INTEGER      NOT NULL DEFAULT 5,

  -- Best Seller Weights (must sum to 1.0 — enforced in application layer)
  weight_sales        NUMERIC(4, 2) NOT NULL DEFAULT 0.50,
  weight_views        NUMERIC(4, 2) NOT NULL DEFAULT 0.20,
  weight_add_to_cart  NUMERIC(4, 2) NOT NULL DEFAULT 0.15,
  weight_recency      NUMERIC(4, 2) NOT NULL DEFAULT 0.15,

  -- Region Config
  region_level               VARCHAR(10)  NOT NULL DEFAULT 'CITY'
                             CHECK (region_level IN ('CITY', 'STATE', 'PINCODE')),
  min_region_product_count   INTEGER      NOT NULL DEFAULT 5,
  region_rating_threshold    INTEGER      NOT NULL DEFAULT 50,

  -- Personalization Config
  personalization_enabled      BOOLEAN       NOT NULL DEFAULT TRUE,
  affinity_weight_base         NUMERIC(4, 2) NOT NULL DEFAULT 0.70,
  affinity_weight_personal     NUMERIC(4, 2) NOT NULL DEFAULT 0.30,
  affinity_increment_view      NUMERIC(4, 2) NOT NULL DEFAULT 1.0,
  affinity_increment_add_to_cart NUMERIC(4, 2) NOT NULL DEFAULT 3.0,
  affinity_increment_purchase  NUMERIC(4, 2) NOT NULL DEFAULT 5.0,
  affinity_increment_rate      NUMERIC(4, 2) NOT NULL DEFAULT 2.0,
  decay_factor                 NUMERIC(5, 4) NOT NULL DEFAULT 0.98,
  exploration_percentage       NUMERIC(4, 2) NOT NULL DEFAULT 0.15,
  category_diversity_limit     INTEGER       NOT NULL DEFAULT 5,
  top_n                        INTEGER       NOT NULL DEFAULT 20,

  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(100),   -- admin user ID for audit

  -- Constraints
  CONSTRAINT chk_global_mean  CHECK (global_mean_rating BETWEEN 1 AND 5),
  CONSTRAINT chk_prior        CHECK (prior_strength BETWEEN 1 AND 100),
  CONSTRAINT chk_decay        CHECK (decay_factor > 0 AND decay_factor <= 1),
  CONSTRAINT chk_exploration  CHECK (exploration_percentage BETWEEN 0 AND 1),
  CONSTRAINT chk_affinity_sum CHECK (ABS(affinity_weight_base + affinity_weight_personal - 1.0) < 0.001)
);

-- Seed with defaults
INSERT INTO ranking_config (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;
```

### 2.3 product\_region\_stats

```sql
CREATE TABLE IF NOT EXISTS product_region_stats (
  id                       BIGSERIAL     PRIMARY KEY,
  product_id               BIGINT        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  region_key               VARCHAR(100)  NOT NULL,

  -- Trailing 7-day window counters
  weekly_sales_count       INTEGER       NOT NULL DEFAULT 0,
  views_count_region       INTEGER       NOT NULL DEFAULT 0,
  add_to_cart_count_region INTEGER       NOT NULL DEFAULT 0,

  last_activity_at         TIMESTAMPTZ,
  best_seller_score_region NUMERIC(6, 5) NOT NULL DEFAULT 0,

  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Uniqueness constraint
  CONSTRAINT uq_product_region UNIQUE (product_id, region_key),

  -- Non-negative counters
  CONSTRAINT chk_sales_nonneg   CHECK (weekly_sales_count       >= 0),
  CONSTRAINT chk_views_nonneg   CHECK (views_count_region       >= 0),
  CONSTRAINT chk_cart_nonneg    CHECK (add_to_cart_count_region >= 0),
  CONSTRAINT chk_rbs_range      CHECK (best_seller_score_region BETWEEN 0 AND 1)
);

-- Primary query: get best sellers for a region, sorted by score
CREATE INDEX IF NOT EXISTS idx_region_score
  ON product_region_stats (region_key, best_seller_score_region DESC);

-- Support product-level lookups (e.g., admin score breakdown)
CREATE INDEX IF NOT EXISTS idx_product_region
  ON product_region_stats (product_id, region_key);

-- Support nightly scheduler (find all records for a product)
CREATE INDEX IF NOT EXISTS idx_region_updated
  ON product_region_stats (updated_at);
```

### 2.4 user\_preferences

```sql
CREATE TABLE IF NOT EXISTS user_preferences (
  id                       BIGSERIAL   PRIMARY KEY,
  user_id                  BIGINT      NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Affinity vectors stored as JSONB
  -- Format: [{"category_id": 123, "score": 22.5}, ...]
  top_categories           JSONB       NOT NULL DEFAULT '[]'::jsonb,

  -- Format: [{"tag": "wireless", "score": 8.1}, ...]
  top_tags                 JSONB       NOT NULL DEFAULT '[]'::jsonb,

  -- Recently viewed product IDs (max 50, FIFO)
  -- Format: [101, 204, 87, ...]
  recently_viewed_product_ids JSONB   NOT NULL DEFAULT '[]'::jsonb,

  personalization_opt_out  BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_pref_updated
  ON user_preferences (updated_at)
  WHERE personalization_opt_out = FALSE;   -- only active personalization users

-- GIN index for JSONB queries on category affinity (used by admin analytics)
CREATE INDEX IF NOT EXISTS idx_user_pref_categories
  ON user_preferences USING GIN (top_categories);
```

### 2.5 scheduler\_log

```sql
CREATE TABLE IF NOT EXISTS scheduler_log (
  id                BIGSERIAL    PRIMARY KEY,
  job_name          VARCHAR(100) NOT NULL,
  started_at        TIMESTAMPTZ  NOT NULL,
  completed_at      TIMESTAMPTZ,
  status            VARCHAR(20)  NOT NULL DEFAULT 'RUNNING'
                    CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED')),
  records_processed INTEGER,
  error_message     TEXT,

  CONSTRAINT chk_completion CHECK (
    (status = 'RUNNING' AND completed_at IS NULL) OR
    (status IN ('SUCCESS', 'FAILED') AND completed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_scheduler_log_job_time
  ON scheduler_log (job_name, started_at DESC);
```

---

## 3. Index Strategy

### 3.1 Query Patterns and Supporting Indexes

| Query Pattern | Collection / Table | Index |
|---------------|-------------------|-------|
| Get top-rated products globally | `products` | `bayesian_rating DESC` |
| Get global best sellers | `products` | `best_seller_score DESC` |
| Get best sellers for a region | `product_region_stats` | `(region_key, best_seller_score_region DESC)` |
| Find stats for one product across regions | `product_region_stats` | `(product_id, region_key)` |
| Fetch user affinity profile | `user_preferences` | `user_id` [unique] |
| Scheduler: find recently active preference profiles | `user_preferences` | `updated_at` |
| Admin: audit job history | `scheduler_log` | `(job_name, started_at DESC)` |

### 3.2 Index Maintenance Notes

- `idx_region_score` is the most write-heavy index (updated on every `bestSellerScoreRegion` change). Monitor for bloat on PostgreSQL — run `REINDEX CONCURRENTLY` quarterly.  
- In MongoDB, the compound index `{ regionKey: 1, bestSellerScoreRegion: -1 }` on `ProductRegionStats` will be scanned frequently. Ensure it fits in working set memory.  
- The GIN index on `top_categories` (PostgreSQL, `user_preferences`) is only needed for admin analytics; omit if analytics is not required at launch.

---

## 4. Migration Notes

### 4.1 MongoDB Migration Steps

1. **Add new product fields** (no schema change required in MongoDB — fields are added on first write).  
   - Run a one-time migration script to set `avgRating = 0`, `ratingCount = 0`, `bayesianRating = 0`, `bestSellerScore = 0` on all existing products.
2. **Create `RankingConfig` singleton** with default values.
3. **Create indexes** on `products` and the new collections.
4. **Seed initial `globalMeanRating`** by running the `recompute-global-mean` job once manually before enabling the feature.

```javascript
// One-time product migration (run in mongo shell or migration script)
db.products.updateMany(
  { bayesianRating: { $exists: false } },
  {
    $set: {
      avgRating: 0, ratingCount: 0, bayesianRating: 0,
      bestSellerScore: 0, weeklySalesCount: 0,
      viewsCount: 0, addToCartCount: 0
    }
  }
);
```

### 4.2 PostgreSQL Migration Steps

1. Apply the `ALTER TABLE products ...` migration (Section 2.1) — safe, adds nullable/defaulted columns.
2. Create `ranking_config`, `product_region_stats`, `user_preferences`, `scheduler_log` tables.
3. Run `INSERT INTO ranking_config ...` seed statement.
4. Backfill `avg_rating` and `rating_count` on the `products` table from your existing ratings table:

```sql
-- Backfill avg_rating and rating_count from an existing ratings/reviews table
UPDATE products p
SET
  avg_rating   = r.avg_val,
  rating_count = r.cnt
FROM (
  SELECT product_id, AVG(score) AS avg_val, COUNT(*) AS cnt
  FROM product_ratings
  GROUP BY product_id
) r
WHERE p.id = r.product_id;

-- Then trigger initial Bayesian computation (run application-level job or in SQL):
-- Requires knowing C = SELECT AVG(avg_rating) FROM products WHERE rating_count > 0
-- bayesian_rating = (rating_count / (rating_count + m)) * avg_rating
--                 + (m / (rating_count + m)) * C
-- m = 10 (default)
WITH config AS (
  SELECT prior_strength AS m, global_mean_rating AS c FROM ranking_config WHERE id = 'default'
)
UPDATE products p
SET bayesian_rating =
  ROUND(
    (p.rating_count::NUMERIC / (p.rating_count + config.m)) * p.avg_rating
    + (config.m::NUMERIC   / (p.rating_count + config.m)) * config.c,
    2
  )
FROM config;
```

5. **Enable search path / schema** if using schemas other than `public`.  
6. **Grant permissions** to application role (SELECT, INSERT, UPDATE — no DELETE on config tables except admin role).

---

## 5. Retention & Archival Policy

| Data | Retention | Policy |
|------|-----------|--------|
| Raw behavioral events | **0 days** | Never persisted; discarded after aggregation in memory |
| `UserAffinityProfile` (active users) | Indefinite | Decayed toward zero; score < 0.01 entries can be pruned monthly |
| `UserAffinityProfile` (opted-out users) | Indefinite | Retained but opt-out flag checked; scores not used |
| `recentlyViewedProductIds` | Capped at 50 items (FIFO) | No time-based deletion needed |
| `ProductRegionStats` | Rolling 7-day window | Records with `lastActivityAt` older than 60 days and `weeklySalesCount = 0` can be archived/deleted |
| `SchedulerLog` | 90 days | Archive and delete records older than 90 days via monthly job |

> **GDPR / Privacy note:** On user account deletion, cascade-delete or anonymize `user_preferences` rows. The `ON DELETE CASCADE` foreign key constraint handles this automatically in PostgreSQL.
