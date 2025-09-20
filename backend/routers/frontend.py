import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..config import FRONTEND_DIR, FRONTEND_ROUTE_MAP
from ..logging_config import get_logger

router = APIRouter(tags=["frontend"])
logger = get_logger(__name__)

def _serve_frontend_file(filename: str):
    """Return FileResponse for frontend file if it exists."""
    file_path = os.path.join(FRONTEND_DIR, filename)
    if not os.path.exists(file_path):
        logger.warning(f"Frontend file not found: {filename}")
        raise HTTPException(
            status_code=404, 
            detail={"error": "Frontend file not found", "file": filename}
        )
    
    logger.debug(f"Serving frontend file: {filename}")
    return FileResponse(file_path)

def _make_handler(filename: str):
    """Create handler function for serving specific frontend file."""
    async def handler():
        return _serve_frontend_file(filename)
    
    # Give each handler a unique name for OpenAPI docs
    handler.__name__ = f"serve_{filename.replace('-', '_').replace('.', '_')}"
    return handler

# Register all frontend routes dynamically
for route, filename in FRONTEND_ROUTE_MAP.items():
    router.get(route)(_make_handler(filename))