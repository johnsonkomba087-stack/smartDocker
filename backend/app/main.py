from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import analyze, batch, auth, admission
from .core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="SmartResumeRanker API",
    description="AI-powered Resume Analyzer, Batch Ranker & Admission Filter",
    version="2.0.0",
    lifespan=lifespan,
)

cors_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,*")
allow_origins = [origin.strip() for origin in cors_origins_raw.split(",") if origin.strip()]
allow_credentials = "*" not in allow_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router)
app.include_router(batch.router)
app.include_router(auth.router)
app.include_router(admission.router)


@app.get("/")
def root():
    return {
        "message": "SmartResumeRanker API v2 is running",
        "docs": "/docs",
        "features": [
            "Single Resume Analysis",
            "Batch Ranking + Excel Export",
            "Admission Filter",
            "User Authentication",
            "Optional LLM Feedback",
            "Optional Semantic Embeddings",
        ],
        "endpoints": {
            "single_analyze": "POST /api/analyze",
            "batch_rank": "POST /api/batch",
            "batch_export": "POST /api/batch/export",
            "admission_filter": "POST /api/admission/filter",
            "register": "POST /api/auth/register",
            "login": "POST /api/auth/login",
            "me": "GET /api/auth/me",
        },
    }


@app.get("/health")
def health_check():
    return {"status": "healthy", "version": "2.0.0"}
