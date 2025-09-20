import json
import os
from typing import List, Dict, Optional
from fastapi import APIRouter, HTTPException, Query

from ..services.registry_service import RegistryService
from ..services.ml_service import MLService
from ..schemas import (
    RecordFilter, SetLabelRequest, MLProcessResponse, 
    LabelUpdateResponse
)
from ..config import PROCESSED_DIR
from ..exceptions import (
    InvalidLocalizationError, InvalidYearError, FileNotFoundError,
    MLModelError, RegistryError
)
from ..logging_config import get_logger

router = APIRouter(tags=["records"])
logger = get_logger(__name__)

# Service instances
registry_service = RegistryService()
ml_service = MLService()

@router.get("/records/", response_model=List[Dict])
async def get_records(
    localization: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    q: Optional[str] = Query(None),
):
    """Get records with optional filtering by localization, year, or query."""
    try:
        # Load all records
        records = registry_service.load_registry()
        
        # Apply filters
        filters = RecordFilter(localization=localization, year=year, q=q)
        filtered_records = registry_service.filter_records(records, filters)
        
        logger.info(f"Retrieved {len(filtered_records)} records")
        return filtered_records
        
    except (InvalidLocalizationError, InvalidYearError) as e:
        logger.warning(f"Filter validation error: {e}")
        raise HTTPException(status_code=400, detail={"error": str(e)})
    
    except Exception as e:
        logger.error(f"Failed to get records: {e}")
        raise HTTPException(status_code=500, detail={"error": "Failed to retrieve records"})

@router.post("/records/{code}/ml", response_model=MLProcessResponse)
async def run_ml_on_record(code: str):
    """Process a record with ML categorization."""
    try:
        # Load processed JSON file
        input_path = os.path.join(PROCESSED_DIR, f"{code}.json")
        if not os.path.exists(input_path):
            logger.warning(f"Processed JSON not found: {input_path}")
            raise HTTPException(status_code=404, detail={"error": "Processed JSON not found"})
        
        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # Process with ML
        try:
            output_path = ml_service.process_record_ml(code, data)
            
            # Update registry with success
            registry_service.update_ml_status(code, success=True)
            
            logger.info(f"ML processing completed for {code}")
            return MLProcessResponse(
                message="ML categorization completed",
                code=code,
                categorized_path=output_path
            )
            
        except MLModelError as e:
            # Update registry with failure
            registry_service.update_ml_status(code, success=False, error=str(e))
            logger.error(f"ML processing failed for {code}: {e}")
            raise HTTPException(status_code=500, detail={"error": f"ML processing failed: {e}"})
    
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error during ML processing for {code}: {e}")
        raise HTTPException(status_code=500, detail={"error": "Internal server error"})

@router.post("/records/{code}/label", response_model=LabelUpdateResponse)
async def set_user_label(code: str, req: SetLabelRequest):
    """Set or update user label for a PARTIDA node in categorized JSON."""
    try:
        ml_service.update_user_label(
            code=code,
            node_code=req.node_code,
            user_label=req.user_label,
            apply_to_subtree=req.apply_to_subtree
        )
        
        logger.info(f"Label updated for node {req.node_code} in {code}")
        return LabelUpdateResponse(
            message="Label updated",
            code=code,
            node_code=req.node_code,
            user_label=req.user_label
        )
        
    except FileNotFoundError as e:
        logger.warning(f"File not found for label update: {e}")
        raise HTTPException(status_code=404, detail={"error": str(e)})
    
    except MLModelError as e:
        logger.error(f"Failed to update label: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})
    
    except Exception as e:
        logger.error(f"Unexpected error during label update: {e}")
        raise HTTPException(status_code=500, detail={"error": "Internal server error"})