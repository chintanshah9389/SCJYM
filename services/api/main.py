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
cors_origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    import logging
    import sys
    logging.basicConfig(level=logging.DEBUG, stream=sys.stdout)
    logger = logging.getLogger("main")
    
    try:
        logger.info("Starting up: Creating MongoDB indexes...")
        await create_indexes()
        logger.info("MongoDB indexes created successfully.")
    except Exception as e:
        logger.error("FATAL: Could not create indexes - %s", e, exc_info=True)
        raise
    
    try:
        db = get_db()
        logger.info("Starting scheduler...")
        start_scheduler(db)
        logger.info("Scheduler started successfully")
    except Exception as e:
        logger.error("FATAL: Could not start scheduler - %s", e, exc_info=True)
        raise
    
    yield
    
    try:
        stop_scheduler()
        await close_connection()
        logger.info("Shutdown completed")
    except Exception as e:
        logger.error("Error during shutdown: %s", e)


app = FastAPI(
    title="SCJYGM API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Global error handler to normalise HTTPException responses ────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import logging
    import traceback
    logger = logging.getLogger("error_handler")
    logger.exception("Unhandled error in %s %s: %s", request.method, request.url.path, exc)
    
    origin = request.headers.get("origin")
    headers = {}
    if origin and origin in cors_origins:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Vary"] = "Origin"
    
    # Include error details in development mode
    error_msg = "An unexpected error occurred."
    error_detail = None
    if settings.app_env != "production":
        error_detail = f"{type(exc).__name__}: {str(exc)}"
    
    return JSONResponse(
        status_code=500,
        headers=headers,
        content={
            "success": False,
            "data": None,
            "error": {
                "code": "INTERNAL_ERROR", 
                "message": error_msg,
                "detail": error_detail,
            },
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


@app.get("/health/db")
async def health_db():
    """Check database connectivity."""
    try:
        db = get_db()
        await db.admin.command("ping")
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": "disconnected", "error": str(e)}
