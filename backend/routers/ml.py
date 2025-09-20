from fastapi import APIRouter, HTTPException

from ..services.ml_service import MLService
from ..schemas import (
    PredictRequest, PredictionResult, MLStatusResponse, 
    ClassesResponse
)
from ..exceptions import MLModelError, MLModelNotFoundError, FileNotFoundError
from ..logging_config import get_logger

router = APIRouter(tags=["ml"])
logger = get_logger(__name__)

# Service instance
ml_service = MLService()

@router.post("/predict", response_model=PredictionResult)
async def predict(req: PredictRequest):
    """Make ML prediction for text classification."""
    try:
        result = ml_service.predict_topk(
            text=req.text, 
            topk=req.topk, 
            descriptive=req.descriptive
        )
        
        logger.info(f"Prediction completed for text length: {len(req.text)}")
        return PredictionResult(**result)
        
    except (MLModelError, MLModelNotFoundError) as e:
        logger.error(f"ML prediction error: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})
    
    except Exception as e:
        logger.error(f"Unexpected error during prediction: {e}")
        raise HTTPException(status_code=500, detail={"error": "Internal server error"})

@router.get("/ml/status", response_model=MLStatusResponse)
async def get_ml_status():
    """Get ML model availability and status."""
    try:
        status = ml_service.get_model_status()
        return MLStatusResponse(**status)
        
    except Exception as e:
        logger.error(f"Failed to get ML status: {e}")
        return MLStatusResponse(
            model_path="unknown",
            loaded=False,
            error=str(e)
        )

@router.get("/api/classes", response_model=ClassesResponse)
async def get_all_classes():
    """Get all available classification classes from metrics file."""
    try:
        classes_data = ml_service.get_all_classes()
        return ClassesResponse(**classes_data)
        
    except FileNotFoundError as e:
        logger.warning(f"Classes file not found: {e}")
        raise HTTPException(status_code=404, detail={"error": str(e)})
    
    except Exception as e:
        logger.error(f"Failed to load classes: {e}")
        raise HTTPException(status_code=500, detail={"error": "Failed to load classes"})