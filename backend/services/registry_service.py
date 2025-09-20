import json
import re
from typing import List, Dict, Optional
from datetime import datetime
import os

from ..config import REGISTRY_PATH, ALLOWED_LOCALIZATIONS
from ..exceptions import RegistryError, ValidationError, InvalidLocalizationError, InvalidEmailError, InvalidYearError
from ..logging_config import get_logger
from ..schemas import RecordModel, RecordFilter

logger = get_logger(__name__)

class RegistryService:
    """Service for managing registry operations."""
    
    def load_registry(self) -> List[Dict]:
        """Load registry from file."""
        try:
            if not os.path.exists(REGISTRY_PATH):
                logger.info("Registry file does not exist, returning empty list")
                return []
            
            with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                
            if isinstance(data, list):
                logger.info(f"Registry loaded successfully with {len(data)} records")
                return data
            else:
                logger.warning("Registry file contains non-list data, resetting")
                return []
                
        except json.JSONDecodeError as e:
            logger.error(f"Registry file is corrupted: {e}")
            return []
        except Exception as e:
            logger.error(f"Failed to load registry: {e}")
            raise RegistryError(f"Failed to load registry: {e}")
    
    def save_registry(self, entries: List[Dict]) -> None:
        """Save registry to file."""
        try:
            with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
                json.dump(entries, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Registry saved successfully with {len(entries)} records")
            
        except Exception as e:
            logger.error(f"Failed to save registry: {e}")
            raise RegistryError(f"Failed to save registry: {e}")
    
    def generate_next_code(self, entries: List[Dict]) -> str:
        """Generate next sequential code (C00001, C00002, ...)."""
        max_num = 0
        pattern = re.compile(r"^C(\d{5})$")
        
        for entry in entries:
            code = entry.get("code", "")
            match = pattern.match(code)
            if match:
                try:
                    num = int(match.group(1))
                    if num > max_num:
                        max_num = num
                except ValueError:
                    continue
        
        next_code = f"C{max_num + 1:05d}"
        logger.info(f"Generated next code: {next_code}")
        return next_code
    
    def validate_upload_data(self, project_name: str, localization: str, email: str, year: int) -> None:
        """Validate upload form data."""
        # Validate localization
        if localization not in ALLOWED_LOCALIZATIONS:
            raise InvalidLocalizationError(
                f"Invalid localization. Allowed: {sorted(list(ALLOWED_LOCALIZATIONS))}"
            )
        
        # Validate email
        email = email.strip()
        if not email or "@" not in email:
            raise InvalidEmailError("Invalid email address")
        
        # Validate year
        try:
            year_int = int(year)
            if year_int < 1900 or year_int > 3000:
                raise ValueError()
        except (ValueError, TypeError):
            raise InvalidYearError("Invalid year")
        
        logger.info(f"Validation passed for project: {project_name}")
    
    def create_record(self, code: str, project_name: str, localization: str, email: str, 
                     year: int, original_filename: str, uploaded_filename: str, 
                     processed_filename: str) -> Dict:
        """Create a new record entry."""
        record = {
            "code": code,
            "project_name": project_name,
            "localization": localization,
            "email": email,
            "year": int(year),
            "original_filename": original_filename,
            "uploaded_filename": uploaded_filename,
            "processed_filename": processed_filename,
            "ml_processed": False,
            "uploaded_at": datetime.utcnow().isoformat() + "Z",
        }
        
        logger.info(f"Created record for code: {code}")
        return record
    
    def filter_records(self, records: List[Dict], filters: RecordFilter) -> List[Dict]:
        """Filter records based on provided criteria."""
        filtered = records.copy()
        
        # Filter by localization
        if filters.localization:
            if filters.localization not in ALLOWED_LOCALIZATIONS:
                raise InvalidLocalizationError(
                    f"Invalid localization. Allowed: {sorted(list(ALLOWED_LOCALIZATIONS))}"
                )
            filtered = [r for r in filtered if r.get("localization") == filters.localization]
        
        # Filter by year
        if filters.year is not None:
            try:
                year_int = int(filters.year)
                filtered = [r for r in filtered if int(r.get("year", 0)) == year_int]
            except (ValueError, TypeError):
                raise InvalidYearError("Invalid year")
        
        # Filter by query (search in code, project_name, email)
        if filters.q:
            query_lower = filters.q.lower()
            def matches_query(record: Dict) -> bool:
                return (
                    query_lower in str(record.get("code", "")).lower()
                    or query_lower in str(record.get("project_name", "")).lower()
                    or query_lower in str(record.get("email", "")).lower()
                )
            filtered = [r for r in filtered if matches_query(r)]
        
        logger.info(f"Filtered {len(records)} records to {len(filtered)} results")
        return filtered
    
    def update_ml_status(self, code: str, success: bool, error: Optional[str] = None) -> None:
        """Update ML processing status for a record."""
        try:
            entries = self.load_registry()
            
            for entry in entries:
                if entry.get("code") == code:
                    entry["ml_processed"] = success
                    entry["ml_processed_at"] = datetime.utcnow().isoformat() + "Z"
                    
                    if success:
                        entry["ml_error"] = None
                        entry["categorized_filename"] = f"{code}.json"
                    else:
                        entry["ml_error"] = error
                    
                    break
            
            self.save_registry(entries)
            logger.info(f"Updated ML status for {code}: success={success}")
            
        except Exception as e:
            logger.error(f"Failed to update ML status for {code}: {e}")
            raise RegistryError(f"Failed to update ML status: {e}")