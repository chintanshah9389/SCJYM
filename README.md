# SCJYGM

Social Community + Products + Approvals + Ratings/Comments + Best Sellers

## Monorepo layout

```
scjygm/
  apps/
    mobile/      # React Native – Expo (Android / iOS)
    admin/       # Next.js admin dashboard
  services/
    api/         # Python FastAPI async backend
  packages/
    shared/      # Shared TS types, constants, validators
  infra/
    docker-compose.yml
  .env.example
```

## Quick start

### 1. Prerequisites
- Node ≥ 18, Yarn ≥ 1.22, Python ≥ 3.11, Docker (optional for local Mongo)

### 2. Environment
```bash
cp .env.example .env
# fill in secrets
```

### 3. Local MongoDB (Docker)
```bash
yarn infra:up
```

### 4. Backend API
```bash
cd services/api
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m scripts.seed_super_admin          # seed SUPER_ADMIN
uvicorn main:app --reload --port 8000
```

### 5. Admin web
```bash
cd apps/admin
yarn install && yarn dev          # http://localhost:3000
```

### 6. Mobile
```bash
cd apps/mobile
yarn install
npx expo start
```

## Core features
- Auth + approval workflow (PENDING → APPROVED/REJECTED)
- RBAC: MEMBER / ADMIN / SUPER_ADMIN
- Products lifecycle (DRAFT → SUBMITTED → APPROVED/REJECTED)
- Ratings + comments with moderation
- Bayesian rating + region-wise + personalized best-sellers
- Dynamic menu, FCM push notifications, YouTube/live player
- Member search + CSV/XLSX export
