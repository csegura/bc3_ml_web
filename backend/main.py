import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from .config import FRONTEND_DIR, CORS_ORIGINS, UPLOAD_DIR, PROCESSED_DIR, CATEGORIZED_DIR
from .logging_config import setup_logging, get_logger
from .routers import upload, files, ml, records, calc, frontend
from . import calc_api

# Setup logging
setup_logging()
logger = get_logger(__name__)

# Create FastAPI app
app = FastAPI(
    title="BC3 File Processing API",
    description="API for BC3 file upload, conversion, and ML classification",
    version="2.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure required directories exist
os.makedirs("data", exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)
os.makedirs(CATEGORIZED_DIR, exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
app.mount("/processed", StaticFiles(directory=PROCESSED_DIR), name="processed")
app.mount("/categorized", StaticFiles(directory=CATEGORIZED_DIR), name="categorized")

# Include routers
app.include_router(upload.router)
app.include_router(files.router)
app.include_router(ml.router)
app.include_router(records.router)
app.include_router(calc.router)
app.include_router(calc_api.router)
app.include_router(frontend.router)

def main():
    """Main entry point for the backend server."""
    import uvicorn
    logger.info("Starting BC3 backend server...")
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8005, reload=True)

if __name__ == "__main__":
    main()