from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse

from ..services.file_service import FileService
from ..services.registry_service import RegistryService
from ..schemas import UploadResponse
from ..exceptions import (
    ValidationError, BC3ConversionError, FileProcessingError, 
    RegistryError, InvalidLocalizationError, InvalidEmailError, InvalidYearError
)
from ..logging_config import get_logger

router = APIRouter(tags=["upload"])
logger = get_logger(__name__)

# Service instances
file_service = FileService()
registry_service = RegistryService()

@router.post("/uploadfile/", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    project_name: str = Form(...),
    localization: str = Form(...),
    email: str = Form(...),
    year: int = Form(...),
):
    """
    Upload a .bc3 file, generate sequential code, convert to JSON, and record metadata.
    """
    try:
        # Validate file
        file_service.validate_file(file)
        
        # Validate form data
        registry_service.validate_upload_data(project_name, localization, email, year)
        
        # Load registry and generate next code
        entries = registry_service.load_registry()
        code = registry_service.generate_next_code(entries)
        
        # Save uploaded file
        source_path = await file_service.save_uploaded_file(file, code)
        
        # Convert BC3 to JSON
        try:
            processed_path = file_service.convert_bc3_to_json(source_path, code)
        except BC3ConversionError:
            # Re-raise to be handled by outer exception handler
            raise
        
        # Create and save record
        record = registry_service.create_record(
            code=code,
            project_name=project_name,
            localization=localization,
            email=email,
            year=year,
            original_filename=file.filename,
            uploaded_filename=f"{code}.bc3",
            processed_filename=f"{code}.json"
        )
        
        entries.append(record)
        registry_service.save_registry(entries)
        
        logger.info(f"Successfully processed upload for code {code}")
        
        return UploadResponse(
            message=f"File '{file.filename}' processed and saved as '{code}.json'",
            code=code,
            record=record
        )
        
    except (ValidationError, InvalidLocalizationError, InvalidEmailError, InvalidYearError) as e:
        logger.warning(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail={"error": str(e)})
    
    except BC3ConversionError as e:
        logger.error(f"BC3 conversion error: {e}")
        raise HTTPException(status_code=500, detail={"error": "BC3 conversion failed", "details": str(e)})
    
    except (FileProcessingError, RegistryError) as e:
        logger.error(f"Processing error: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})
    
    except Exception as e:
        logger.error(f"Unexpected error during upload: {e}")
        raise HTTPException(status_code=500, detail={"error": "Internal server error"})