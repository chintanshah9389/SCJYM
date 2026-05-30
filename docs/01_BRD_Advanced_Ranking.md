# Business Requirements Document  
## Advanced Ranking Enhancements  
**Version:** 1.0  
**Date:** 2026-05-27  
**Status:** Draft — Awaiting Stakeholder Review  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)  
2. [Problem Statements](#2-problem-statements)  
3. [Goals & Non-Goals](#3-goals--non-goals)  
4. [Feature 1 — Bayesian Rating](#4-feature-1--bayesian-rating)  
5. [Feature 2 — Region-wise Best Sellers](#5-feature-2--region-wise-best-sellers)  
6. [Feature 3 — Personalized Best Sellers](#6-feature-3--personalized-best-sellers)  
7. [Admin Controls Summary](#7-admin-controls-summary)  
8. [Sample Scoring Walkthrough](#8-sample-scoring-walkthrough)  
9. [Glossary](#9-glossary)  

---

## 1. Executive Summary

The platform currently surfaces best sellers and top-rated products using raw averages and global aggregations. Three compounding weaknesses undermine product discovery quality:

1. **Ratings bias** — products with 1–2 reviews can dominate "top-rated" lists, distorting buyer trust.  
2. **Regional blindness** — a product that dominates sales in Mumbai is invisible to buyers in Mumbai who see only the national list.  
3. **Uniformity** — every user sees the same best-sellers feed regardless of their demonstrated interests.

This document specifies the requirements to address all three weaknesses in a single, cohesive ranking layer.

---

## 2. Problem Statements

| # | Problem | Impact |
|---|---------|--------|
| P-1 | A product launched yesterday with 2 ratings at 5.0 ranks above an established product with 300 ratings at 4.3. | Buyer trust erodes; conversion drops. |
| P-2 | Best Sellers lists are global; regional purchasing trends are hidden. | Regional sellers lose visibility; buyers miss locally popular products. |
| P-3 | All users see the same best-sellers feed regardless of their history or interests. | Engagement and click-through rates are sub-optimal; users leave without discovering relevant products. |

---

## 3. Goals & Non-Goals

### Goals
- **G-1** Implement Bayesian average rating to produce fair, volume-aware rankings.  
- **G-2** Implement region-wise best sellers with admin-configurable geographic granularity.  
- **G-3** Implement personalized best sellers using lightweight, privacy-safe behavioral signals.  
- **G-4** Expose all configuration to admin so that weights, thresholds, and feature flags can be tuned without a deployment.  

### Non-Goals
- **NG-1** Full collaborative-filtering or matrix-factorization ML (not in scope; keep it explainable).  
- **NG-2** Real-time stream processing infrastructure (batch + trigger model is sufficient).  
- **NG-3** Use of sensitive demographic attributes (age, gender, religion, etc.) for personalization.  
- **NG-4** Storing raw event history indefinitely (only aggregated counters are retained beyond 30 days).  
- **NG-5** Cross-user collaborative signals ("users like you also bought…").  

---

## 4. Feature 1 — Bayesian Rating

### 4.1 Background

A raw arithmetic mean gives every rating equal weight regardless of sample size. With small samples this produces misleading results:

| Product | Avg Rating | Rating Count | Shown as "Top Rated"? |
|---------|-----------|--------------|----------------------|
| A (new) | 4.90 | 2 | YES (incorrectly) |
| B (established) | 4.30 | 300 | NO (incorrectly excluded) |

### 4.2 Bayesian Average Formula

$$\text{BayesianRating} = \frac{v}{v + m} \cdot R + \frac{m}{v + m} \cdot C$$

| Symbol | Definition | Source |
|--------|-----------|--------|
| R | Raw average rating of the product (1–5 scale) | Computed from all ratings |
| v | Number of ratings for the product | Count of rating records |
| C | Global mean rating across **all** rated products | Recomputed daily; stored in `RankingConfig` |
| m | Prior strength / minimum-ratings threshold | Admin-configurable; default = 10 |

**Intuition:** When `v` is very small, the formula pulls `BayesianRating` toward the global mean `C`. As `v` grows, the product's own average dominates.

**Effect on the example above** (C = 4.0, m = 10):

| Product | R | v | BayesianRating | Correct Rank |
|---------|-----|-----|----------------|-------------|
| A | 4.90 | 2 | (2/12)·4.90 + (10/12)·4.0 = **4.15** | 2nd ✓ |
| B | 4.30 | 300 | (300/310)·4.30 + (10/310)·4.0 = **4.29** | 1st ✓ |

Product B now correctly ranks above Product A.

### 4.3 Display Rules

- **Always display both** `avgRating` (raw, human-readable) and `bayesianRating` (used for sorting).  
- Ranking queries **must** sort by `bayesianRating DESC`, never by raw `avgRating`.  
- The UI label for `avgRating` should be "★ 4.3 (300 reviews)" — never expose `bayesianRating` to shoppers as it would be confusing.

### 4.4 Admin-Configurable Parameters

| Parameter | Description | Default | Valid Range |
|-----------|-------------|---------|------------|
| `priorStrength` (m) | How many "phantom" ratings at C are injected. Higher → slower rank rise for new products. | 10 | 1–100 |
| `minRatingCountForEligibility` | Products below this count are excluded from Top-Rated lists entirely (still shown individually). | 5 | 0–50 |
| `globalMeanRating` (C) | Read-only in most UIs; recomputed nightly by the scheduler. Admin may manually override once for seeding. | Computed | 1.0–5.0 |

### 4.5 Data Stored on Product

```
avgRating         (Float, 1–5)   — raw arithmetic mean
ratingCount       (Integer ≥ 0)  — total number of ratings
bayesianRating    (Float, 1–5)   — Bayesian-adjusted value; used for sort
```

### 4.6 Recalculation Triggers

| Event | Action |
|-------|--------|
| Rating **created** | Increment `ratingCount`, recalculate `avgRating`, recompute `bayesianRating` for this product using current `C`. |
| Rating **updated** | Recalculate `avgRating` (remove old value, add new value), recompute `bayesianRating`. |
| Rating **deleted** | Decrement `ratingCount`, recalculate `avgRating`, recompute `bayesianRating`. |
| **Daily scheduled job** | (1) Recompute `C` from all products' `avgRating` weighted by `ratingCount`. (2) Batch-recompute `bayesianRating` for every product using updated `C`. |

> **Note:** The on-event recomputation uses the previous day's `C` for immediate consistency. The nightly job corrects any drift.

---

## 5. Feature 2 — Region-wise Best Sellers

### 5.1 Goal

Surface a best-seller list that is **filtered and scored** by the buyer's geographic region, so that locally popular products receive appropriate visibility.

### 5.2 Region Definition

Regions are derived from the user's stored **address fields**, not from IP geolocation (to avoid accuracy and privacy issues).

| Strategy | `regionKey` Format | Example |
|----------|-------------------|---------|
| City | `{COUNTRY}_{STATE}_{CITY}` | `IN_MH_MUMBAI` |
| State | `{COUNTRY}_{STATE}` | `IN_MH` |
| Pincode | `{COUNTRY}_{PINCODE}` | `IN_400001` |
| Global fallback | `GLOBAL` | `GLOBAL` |

**Canonicalization rules:**
- All characters uppercased.  
- Spaces replaced with underscores.  
- Country code = ISO 3166-1 alpha-2.  
- State code = ISO 3166-2 subdivision code (where applicable).  
- If any component is missing or blank, truncate to the next coarser level (e.g., no city → use State; no state → use Country; no country → `GLOBAL`).  

**Admin-configurable:** `REGION_LEVEL` ∈ {`"CITY"`, `"STATE"`, `"PINCODE"`}. Determines which key format is used platform-wide.

### 5.3 Region Best Seller Score

Uses the same weighted formula as the global best-seller score, but with **region-specific** sales / engagement counters:

$$\text{BestSellerScoreRegion} = w_s \cdot \hat{s} + w_v \cdot \hat{v} + w_c \cdot \hat{c} + w_r \cdot \text{RecencyScore}$$

| Variable | Meaning | Default Weight |
|----------|---------|---------------|
| $\hat{s}$ | `weeklySalesCountRegion` normalized by max in region | $w_s = 0.50$ |
| $\hat{v}$ | `viewsCountRegion` normalized by max in region | $w_v = 0.20$ |
| $\hat{c}$ | `addToCartCountRegion` normalized by max in region | $w_c = 0.15$ |
| RecencyScore | $e^{-d/7}$ where $d$ = days since last activity in region | $w_r = 0.15$ |

All weights sum to 1.0. All configurable via admin panel.

**Normalization:** Per-region, per-window. Every night the scheduler computes the max of each metric across all products for each region and stores it, enabling efficient percentile normalization.

**Rating component:** By default, `bayesianRating` is **global** (more data volume → more stable signal). Optionally, when `viewsCountRegion ≥ regionRatingThreshold`, a region-specific rating average may be substituted.

### 5.4 Required Per-Product-Per-Region Aggregations

| Field | Description |
|-------|-------------|
| `weeklySalesCountRegion` | Orders placed from the region in the trailing 7-day window |
| `viewsCountRegion` | Product detail page views from users in the region (optional, improves accuracy) |
| `addToCartCountRegion` | Add-to-cart events from users in the region (optional) |
| `lastActivityAtRegion` | Timestamp of the most recent order/view/cart event in region |
| `bestSellerScoreRegion` | Computed score; used for sorted queries |

### 5.5 Fallback Behavior

| Scenario | Fallback |
|----------|---------|
| User has no address / region | Fall back to `GLOBAL` best sellers |
| Region has < `minRegionProductCount` products with sales | Fall back to parent region (city → state → global) |
| User manually selects "Global" in toggle | Use `GLOBAL` |

### 5.6 Update Triggers

| Event | Action |
|-------|--------|
| Order placed | Increment `weeklySalesCountRegion` for the buyer's `regionKey`; update `lastActivityAtRegion`; enqueue score recomputation. |
| Product view event (from mobile) | Increment `viewsCountRegion` if views tracking is enabled. |
| Add-to-cart event (from mobile) | Increment `addToCartCountRegion` if cart tracking is enabled. |
| **Nightly scheduler** | Roll the 7-day window (remove sales older than 7 days), recompute `bestSellerScoreRegion` for all products in all active regions. |

---

## 6. Feature 3 — Personalized Best Sellers

### 6.1 Goal

Reorder the best-sellers list for each authenticated user using lightweight behavioral signals, without building a heavyweight ML pipeline and without compromising user privacy.

### 6.2 Behavioral Signals & Affinity Scoring

The backend maintains a **UserAffinityProfile** — a per-user vector of category (and optionally tag) affinity scores.

#### 6.2.1 Affinity Increment Weights

| Event | Affinity Increment | Notes |
|-------|------------------|-------|
| Product view | **+1.0** | For each category of the viewed product |
| Add to cart | **+3.0** | Higher intent signal |
| Purchase | **+5.0** | Strongest intent |
| Rating / review | **+2.0** | Engaged user |

Admin can adjust these weights via `RankingConfig`.

#### 6.2.2 Time Decay

Every day, all affinity scores are multiplied by a configurable `decayFactor` (default = 0.98):

$$\text{score}_{\text{today}} = \text{score}_{\text{yesterday}} \times 0.98$$

This means:
- A score from 7 days ago retains ~87% of its value.  
- A score from 30 days ago retains ~55% of its value.  
- A score from 6 months ago retains ~1% of its value.

Decay can be applied lazily (on-read, computing days-since-update) to avoid unnecessary daily jobs on inactive users.

#### 6.2.3 UserAffinityMatch Computation (per product)

```
maxAffinityScore = max(score) across all user's topCategories

For a product with categories [C1, C2, ...]:
  rawMatch = sum(userAffinityScore[Ci] for each Ci in product.categories, 0 if not present)
  UserAffinityMatch = min(1.0, rawMatch / maxAffinityScore)
```

If `topCategories` is empty (new user or opted-out), `UserAffinityMatch = 0`.

### 6.3 Personalized Ranking Formula

$$\text{PersonalizedScore} = \text{BestSellerScore}_{\text{region|global}} \times (0.70 + 0.30 \times \text{UserAffinityMatch})$$

| Term | Meaning |
|------|---------|
| `BestSellerScore` | Regional score if available; otherwise global score |
| `0.70` | Base weight — ensures strong global/regional signals always matter |
| `0.30` | Maximum personalization boost — bounded to prevent filter bubbles |
| `UserAffinityMatch` | Value in [0, 1]; from Section 6.2.3 |

**Range:** PersonalizedScore ∈ [0.70 × BestSellerScore, 1.00 × BestSellerScore].  
No product can be boosted to a score it could not achieve even with full affinity.

### 6.4 Diversity Rules (Top-N = 20)

| Rule | Configuration | Default |
|------|---------------|---------|
| Max products per category | `categoryDiversityLimit` | 5 |
| Exploration injection | `explorationPercentage` | 15% → 3 slots in N=20 |
| Exploration source | Trending outside top user affinity categories | — |

**Algorithm sketch (server-side):**
1. Compute `PersonalizedScore` for candidate products.  
2. Sort descending.  
3. Consume candidates in order into the result list, skipping any that would breach `categoryDiversityLimit`.  
4. Fill the last `ceil(N × explorationPercentage)` slots with trending products from categories *not* already in the result list.

### 6.5 Privacy & Safety Rules

| Rule | Detail |
|------|--------|
| **No sensitive attributes** | Affinity is category/tag-only. No demographic inference. |
| **No explanation disclosure** | The API must not expose *why* a product was ranked (no "because you viewed X"). |
| **Opt-out** | User can set `personalizationOptOut = true` in profile settings. When opted out, fall back to region or global best sellers. |
| **Short event retention** | Raw events are never stored permanently. Only aggregated counters (`topCategories`, `topTags`) are persisted. Optional: retain last 50 viewed product IDs maximum. |
| **Admin kill switch** | A global `personalizationEnabled` flag in `RankingConfig` disables personalization for all users instantly without a deployment. |

### 6.6 New-User / Cold-Start Behavior

| Condition | Behavior |
|-----------|---------|
| No affinity profile (new user) | Serve region best sellers (equivalent to affinity=0 everywhere) |
| Opted-out user | Serve region best sellers |
| Region has no scored products | Serve global best sellers |

### 6.7 Event Tracking (Mobile → Backend)

Mobile clients send **lightweight**, non-PII event objects:

```json
POST /events/track

{
  "eventType": "VIEW_PRODUCT",   // VIEW_PRODUCT | ADD_TO_CART | RATE | COMMENT | PURCHASE
  "productId": "prod_abc123",
  "categoryId": "cat_electronics",
  "ts": "2026-05-27T09:30:00Z"
}
```

**Backend handling:**
- Validate authenticated user from JWT.  
- Validate `eventType`, `productId`, `categoryId`.  
- **Do not** persist the raw event row.  
- Immediately increment the appropriate affinity counter for the category.  
- Rate-limit: max 100 events/minute per user to prevent affinity gaming.  
- Idempotency key (optional): deduplicate rapid duplicate view events within a 10-second window.

---

## 7. Admin Controls Summary

All parameters live in a single `RankingConfig` document / row (singleton).

### 7.1 Bayesian Rating Controls

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `priorStrength` | Integer | 10 | m in Bayesian formula |
| `minRatingCountForEligibility` | Integer | 5 | Min ratings to appear in Top-Rated lists |
| `globalMeanRating` | Float (read-only) | Computed | C; set by nightly job |

### 7.2 Best Seller Weight Controls

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `weightSales` | Float | 0.50 | Weight for sales count |
| `weightViews` | Float | 0.20 | Weight for views count |
| `weightAddToCart` | Float | 0.15 | Weight for cart count |
| `weightRecency` | Float | 0.15 | Weight for recency score |

Constraint: `weightSales + weightViews + weightAddToCart + weightRecency = 1.0`. Validate on save.

### 7.3 Region Controls

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `regionLevel` | Enum | `"CITY"` | Granularity: `CITY`, `STATE`, `PINCODE` |
| `minRegionProductCount` | Integer | 5 | Min products with sales for a region to be active |
| `regionRatingThreshold` | Integer | 50 | Min regional ratings to use regional vs global avgRating |

### 7.4 Personalization Controls

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `personalizationEnabled` | Boolean | true | Global on/off switch |
| `affinityWeightBase` | Float | 0.70 | Base weight in PersonalizedScore formula |
| `affinityWeightPersonal` | Float | 0.30 | Personalization weight (must + base = 1.0) |
| `affinityIncrementView` | Float | 1.0 | Affinity increment for view events |
| `affinityIncrementAddToCart` | Float | 3.0 | Affinity increment for cart events |
| `affinityIncrementPurchase` | Float | 5.0 | Affinity increment for purchase events |
| `affinityIncrementRate` | Float | 2.0 | Affinity increment for rating events |
| `decayFactor` | Float | 0.98 | Daily affinity decay multiplier |
| `explorationPercentage` | Float | 0.15 | Fraction of list slots for exploration |
| `categoryDiversityLimit` | Integer | 5 | Max products from same category in top-N list |
| `topN` | Integer | 20 | Size of personalized list |

---

## 8. Sample Scoring Walkthrough

This section provides end-to-end numeric examples illustrating all three features working together.

---

### 8.1 Bayesian Rating Example

**Setup:** Global mean rating C = 4.0, prior strength m = 10.

| Product | Raw Avg (R) | Rating Count (v) | Bayesian Calculation | BayesianRating |
|---------|------------|------------------|----------------------|---------------|
| A — new viral item | 4.90 | 2 | (2/12)·4.90 + (10/12)·4.00 = 0.817 + 3.333 | **4.15** |
| B — established item | 4.30 | 300 | (300/310)·4.30 + (10/310)·4.00 = 4.161 + 0.129 | **4.29** |
| C — average item | 4.10 | 45 | (45/55)·4.10 + (10/55)·4.00 = 3.355 + 0.727 | **4.08** |

**Outcome:** Without Bayesian, A (4.90) ranks 1st. With Bayesian, B (4.29) correctly ranks 1st.  
**Buyer trust is maintained** because established quality is rewarded over statistical noise.

---

### 8.2 Region-wise Best Seller Score Example

**Setup:** Region = `IN_MH_MUMBAI`, weights: sales=0.50, views=0.20, cart=0.15, recency=0.15.  
**Region maxima (computed nightly):** maxSales = 100, maxViews = 2,000, maxCart = 80.

| Product | weeklySalesCountRegion | viewsCountRegion | addToCartCountRegion | daysSinceLast | Calculation | BestSellerScoreRegion |
|---------|------------------------|------------------|----------------------|---------------|-------------|----------------------|
| Earphone X | 45 | 800 | 30 | 2 | 0.50·(45/100) + 0.20·(800/2000) + 0.15·(30/80) + 0.15·e^(−2/7) | 0.225+0.080+0.056+0.113 = **0.474** |
| Kurta Blue | 80 | 1,600 | 65 | 1 | 0.50·(80/100) + 0.20·(800/1000 ... wait, 1600/2000) + 0.15·(65/80) + 0.15·e^(−1/7) | 0.400+0.160+0.122+0.131 = **0.813** |
| Toy Car A | 12 | 200 | 8 | 5 | 0.50·(12/100) + 0.20·(200/2000) + 0.15·(8/80) + 0.15·e^(−5/7) | 0.060+0.020+0.015+0.064 = **0.159** |

`e^(-1/7) = 0.867`, `e^(-2/7) = 0.752`, `e^(-5/7) = 0.493`.  
Regional rank: **Kurta Blue (0.813) > Earphone X (0.474) > Toy Car A (0.159)**. Mumbai-specific buying patterns boost the Kurta above the earphone.

---

### 8.3 Personalized Score Example

**Setup:** Authenticated user in `IN_MH_MUMBAI`. User affinity profile (after decay applied):

| Category | Raw Affinity Score |
|----------|--------------------|
| Electronics | 22.5 |
| Books | 5.0 |
| Clothing | 1.2 |
| Furniture | 0.0 (never interacted) |

`maxAffinityScore = 22.5`

**UserAffinityMatch per product:**

| Product | Category | rawMatch | UserAffinityMatch |
|---------|----------|----------|-------------------|
| Earphone X | Electronics | 22.5 | 22.5/22.5 = **1.00** |
| Kurta Blue | Clothing | 1.2 | 1.2/22.5 = **0.053** |
| Novel Set | Books | 5.0 | 5.0/22.5 = **0.222** |
| Toy Car A | Toys (absent) | 0 | 0/22.5 = **0.000** |

**BestSellerScoreRegion (from 8.2):**

| Product | BestSellerScoreRegion |
|---------|----------------------|
| Earphone X | 0.474 |
| Kurta Blue | 0.813 |
| Novel Set | (hypothetical) 0.720 |
| Toy Car A | 0.159 |

**PersonalizedScore calculation:**

$$\text{P-Score} = \text{BSScore} \times (0.70 + 0.30 \times \text{AffinityMatch})$$

| Product | BSScore | AffinityMatch | Formula | PersonalizedScore |
|---------|---------|--------------|---------|------------------|
| Earphone X | 0.474 | 1.000 | 0.474 × (0.70 + 0.30) | **0.474** |
| Kurta Blue | 0.813 | 0.053 | 0.813 × (0.70 + 0.016) | **0.582** |
| Novel Set | 0.720 | 0.222 | 0.720 × (0.70 + 0.067) | **0.552** |
| Toy Car A | 0.159 | 0.000 | 0.159 × (0.70 + 0.000) | **0.111** |

**Rankings:**

| Rank | Without Personalization | With Personalization |
|------|------------------------|---------------------|
| 1st | Kurta Blue (0.813) | Kurta Blue (0.582) — still 1st |
| 2nd | Novel Set (0.720) | **Novel Set (0.552)** — drops one |
| 3rd | Earphone X (0.474) | **Earphone X (0.474)** — rises from 3rd to 3rd (close) |
| 4th | Toy Car A (0.159) | Toy Car A (0.111) |

Now let's add another Electronics product to see a dramatic jump:

| Extra Product | BSScore | AffinityMatch | PersonalizedScore | Raw Rank | P-Rank |
|---------------|---------|--------------|-------------------|----------|--------|
| Wireless Speaker | 0.600 | 1.000 | 0.600 × 1.00 = **0.600** | 2nd→just below Novel Set | **1st** |

**Wireless Speaker** (Electronics, BSScore=0.60) with full affinity match scores **0.600** — overtaking **Kurta Blue** (0.582) and **Novel Set** (0.552), jumping to **1st** in the personalized list even though it ranked 2nd–3rd in the raw regional list.

**Takeaway:** The 30% personalization window can reorder products meaningfully for highly engaged users without ignoring the fundamental quality signal of the other 70%.

---

### 8.4 Diversity Rule in Action (Top-N = 20)

Situation after scoring: 12 of the top 20 personalized slots would be Electronics products (user loves electronics).

| Rule Applied | Result |
|-------------|--------|
| `categoryDiversityLimit = 5` | Electronics capped at 5 slots. Remaining 7 Electronics products dropped to backfill. |
| Next best products from Clothing, Books, etc. fill positions 6–17. | Variety maintained. |
| `explorationPercentage = 0.15` → 3 exploration slots | Slots 18–20 filled with top trending products outside user's top-3 categories (e.g., Sports, Home). |

---

## 9. Glossary

| Term | Definition |
|------|-----------|
| `avgRating` | Raw arithmetic mean rating (1–5) for a product. |
| `bayesianRating` | Bayesian-adjusted rating; used for ranking; dampens low-volume noise. |
| `ratingCount` | Total number of ratings a product has received. |
| `globalMeanRating` (C) | Average of `avgRating` across all products with ≥ 1 rating; recomputed nightly. |
| `priorStrength` (m) | Phantom rating count used to anchor `bayesianRating` toward C. |
| `regionKey` | Canonical string identifying a geographic region, e.g., `IN_MH_MUMBAI`. |
| `REGION_LEVEL` | Admin setting controlling the granularity of regionKey: `CITY`, `STATE`, or `PINCODE`. |
| `BestSellerScoreRegion` | Weighted composite score for a product within a specific region. |
| `UserAffinityProfile` | Per-user aggregated category/tag affinity scores with time decay. |
| `UserAffinityMatch` | Normalized overlap score [0,1] between a product's categories and the user's affinity profile. |
| `PersonalizedScore` | Final ranking score combining regional best-seller score with user affinity. |
| `explorationPercentage` | Fraction of list slots reserved for products outside the user's core affinity categories. |
| `categoryDiversityLimit` | Maximum number of products from the same category permitted in the top-N list. |
| `decayFactor` | Daily multiplier (< 1) applied to affinity scores to age out stale behavioral signals. |
| `personalizationOptOut` | User flag to disable personalization and receive region/global best sellers instead. |
