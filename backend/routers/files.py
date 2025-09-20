import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..services.file_service import FileService
from ..services.registry_service import RegistryService
from ..schemas import FileListResponse
from ..config import PROCESSED_DIR
from ..exceptions import FileNotFoundError
from ..logging_config import get_logger

router = APIRouter(tags=["files"])
logger = get_logger(__name__)

# Service instances
file_service = FileService()
registry_service = RegistryService()

@router.get("/files/", response_model=FileListResponse)
async def list_files():
    """List all uploaded and processed files with registry information."""
    try:
        uploaded_files, processed_files = file_service.get_file_lists()
        records = registry_service.load_registry()
        
        return FileListResponse(
            uploaded_files=uploaded_files,
            processed_files=processed_files,
            records=records
        )
        
    except Exception as e:
        logger.error(f"Failed to list files: {e}")
        raise HTTPException(status_code=500, detail={"error": "Failed to retrieve file lists"})

@router.get("/download/{code}")
async def download_processed(code: str):
    """Download the processed JSON file for a given code."""
    try:
        filename = f"{code}.json"
        file_path = os.path.join(PROCESSED_DIR, filename)
        
        if not os.path.exists(file_path):
            logger.warning(f"Processed file not found: {file_path}")
            raise HTTPException(status_code=404, detail={"error": "Processed file not found"})
        
        headers = {"Content-Disposition": f"attachment; filename={filename}"}
        logger.info(f"Serving download for {code}")
        
        return FileResponse(
            file_path, 
            media_type="application/json", 
            headers=headers,
            filename=filename
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Failed to serve download for {code}: {e}")
        raise HTTPException(status_code=500, detail={"error": "Failed to serve file"})