import os
import subprocess
from typing import Tuple
from fastapi import UploadFile

from ..config import UPLOAD_DIR, PROCESSED_DIR, BC3_CONVERTER_PATH
from ..exceptions import BC3ConversionError, ValidationError, FileProcessingError
from ..logging_config import get_logger

logger = get_logger(__name__)

class FileService:
    """Service for handling file operations."""
    
    def __init__(self):
        self._ensure_directories()
    
    def _ensure_directories(self) -> None:
        """Ensure required directories exist."""
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        os.makedirs(PROCESSED_DIR, exist_ok=True)
    
    def validate_file(self, file: UploadFile) -> None:
        """Validate uploaded file."""
        if not file.filename:
            raise ValidationError("No filename provided")
        
        if not file.filename.lower().endswith(".bc3"):
            raise ValidationError("Only .bc3 files are supported")
        
        logger.info(f"File validation passed: {file.filename}")
    
    async def save_uploaded_file(self, file: UploadFile, code: str) -> str:
        """Save uploaded file with code-based name."""
        try:
            upload_filename = f"{code}.bc3"
            source_path = os.path.join(UPLOAD_DIR, upload_filename)
            
            content = await file.read()
            with open(source_path, "wb") as buffer:
                buffer.write(content)
            
            logger.info(f"File saved: {source_path}")
            return source_path
            
        except Exception as e:
            logger.error(f"Failed to save file: {e}")
            raise FileProcessingError(f"Failed to save file: {e}")
    
    def convert_bc3_to_json(self, source_path: str, code: str) -> str:
        """Convert BC3 file to JSON."""
        try:
            processed_filename = f"{code}.json"
            processed_path = os.path.join(PROCESSED_DIR, processed_filename)
            
            result = subprocess.run(
                ["python3", BC3_CONVERTER_PATH, source_path, "-o", processed_path],
                capture_output=True,
                text=True,
                check=True,
            )
            
            logger.info(f"BC3 conversion successful: {processed_path}")
            logger.debug(f"Conversion output: {result.stdout}")
            
            return processed_path
            
        except subprocess.CalledProcessError as e:
            logger.error(f"BC3 conversion failed: {e.stderr}")
            # Clean up the uploaded file if processing failed
            self._cleanup_file(source_path)
            raise BC3ConversionError(f"BC3 conversion failed: {e.stderr}")
        except Exception as e:
            logger.error(f"Unexpected error during BC3 conversion: {e}")
            self._cleanup_file(source_path)
            raise BC3ConversionError(f"Unexpected error during BC3 conversion: {e}")
    
    def _cleanup_file(self, file_path: str) -> None:
        """Clean up a file safely."""
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"Cleaned up file: {file_path}")
        except Exception as e:
            logger.warning(f"Failed to cleanup file {file_path}: {e}")
    
    def get_file_lists(self) -> Tuple[list, list]:
        """Get lists of uploaded and processed files."""
        try:
            uploaded_files = os.listdir(UPLOAD_DIR) if os.path.exists(UPLOAD_DIR) else []
            processed_files = os.listdir(PROCESSED_DIR) if os.path.exists(PROCESSED_DIR) else []
            
            # Filter out non-file items
            uploaded_files = [f for f in uploaded_files if f != "records.json"]
            
            return uploaded_files, processed_files
            
        except Exception as e:
            logger.error(f"Failed to get file lists: {e}")
            return [], []