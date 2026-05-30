"""FastAPI application entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.config import get_settings
from core.database import create_indexes, close_connection, get_db
from core.scheduler import start_scheduler, stop_scheduler
from routers import auth, users, products, cart, ratings_comments, menu, notifications, ranking, ads

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_indexes()
    db = get_db()
    start_scheduler(db)
    yield
    stop_scheduler()
    await close_connection()


app = FastAPI(
    title="SCJYGM API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Global error handler to normalise HTTPException responses ────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import logging
    logging.exception("Unhandled error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "data": None,
            "error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred."},
        },
    )


# ─── Routers ─────────────────────────────────────────────────────────────────
PREFIX = "/api/v1"

app.include_router(auth.router, prefix=PREFIX)
app.include_router(users.router, prefix=PREFIX)

# Ranking must come BEFORE products so /products/best-sellers doesn't match /products/{id}
app.include_router(ranking.ranking_router, prefix=PREFIX)
app.include_router(ranking.events_router, prefix=PREFIX)
app.include_router(ranking.admin_ranking_router, prefix=PREFIX)

app.include_router(products.router, prefix=PREFIX)
app.include_router(cart.router, prefix=PREFIX)

# Ratings + Comments (has nested product paths)
app.include_router(ratings_comments.router, prefix=PREFIX)
app.include_router(ratings_comments.admin_router, prefix=PREFIX)

# Menu
app.include_router(menu.router, prefix=PREFIX)
app.include_router(menu.admin_router, prefix=PREFIX)

# Notifications
app.include_router(notifications.router, prefix=PREFIX)
app.include_router(notifications.admin_router, prefix=PREFIX)

# Advertisements
app.include_router(ads.router, prefix=PREFIX)
app.include_router(ads.admin_router, prefix=PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
