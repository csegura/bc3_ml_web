from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from ..services.bc3_service import BC3Service
from ..exceptions import FileNotFoundError
from ..logging_config import get_logger

router = APIRouter(tags=["calc"])
logger = get_logger(__name__)

# Service instance
bc3_service = BC3Service()

@router.get("/calc_tree/{filename}")
async def calc_tree(
    filename: str,
    chapter: Optional[str] = Query(None),
    level: Optional[int] = Query(None),
    source: str = Query("processed"),
    label: Optional[str] = Query(None),
):
    """Calculate and return BC3 budget tree with prices as JSON."""
    try:
        result = bc3_service.calculate_tree(
            filename=filename,
            chapter=chapter,
            level=level,
            source=source,
            label=label
        )
        
        logger.info(f"Tree calculation completed for {filename}")
        return result
        
    except FileNotFoundError as e:
        logger.warning(f"File not found for tree calculation: {e}")
        raise HTTPException(status_code=404, detail={"error": str(e)})
    
    except ValueError as e:
        logger.warning(f"Invalid data for tree calculation: {e}")
        raise HTTPException(status_code=400, detail={"error": str(e)})
    
    except Exception as e:
        logger.error(f"Failed to calculate tree for {filename}: {e}")
        raise HTTPException(status_code=500, detail={"error": "Failed to calculate tree"})