from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
import logging
from app.core.database import engine, Base, AsyncSessionLocal, check_db_connection
from app.services.seed_data import seed_database
from app.api.v1.tasks import router as tasks_router
from app.api.v1.roadmaps import router as roadmaps_router
from app.api.v1.sessions import router as sessions_router
from app.api.v1.leetcode import router as leetcode_router
from app.api.v1.resources import router as resources_router
from app.api.v1.coach import router as coach_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.users import router as users_router
from app.api.v1.auth import router as auth_router
from app.api.v1.knowledge import router as knowledge_router
from app.api.v1.code import router as code_router

logger = logging.getLogger("studypilot.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Safely verify database connectivity without crashing
    db_ok, msg = await check_db_connection()
    if db_ok:
        logger.info("Database connection verified.")
        try:
            async with AsyncSessionLocal() as session:
                await seed_database(session)
        except Exception as e:
            logger.warning(f"Database seed check skipped: {e}")
    else:
        logger.warning(f"Database connection not available at startup: {msg}")
    
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="StudyPilot AI - Personal study and interview preparation agent",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API v1 Routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(auth_router)  # Direct /auth/... support
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(tasks_router, prefix="/api/v1")
app.include_router(roadmaps_router, prefix="/api/v1")
app.include_router(sessions_router, prefix="/api/v1")
app.include_router(leetcode_router, prefix="/api/v1")
app.include_router(resources_router, prefix="/api/v1")
app.include_router(knowledge_router, prefix="/api/v1")
app.include_router(coach_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(code_router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "online",
        "docs_url": "/docs"
    }


@app.get("/health")
async def health_check():
    db_ok, msg = await check_db_connection()
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else f"disconnected: {msg}",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT
    }
