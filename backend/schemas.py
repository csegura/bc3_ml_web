from pydantic import BaseModel, EmailStr, Field
from typing import List, Dict, Optional, Any
from datetime import datetime

class PredictRequest(BaseModel):
    text: str
    descriptive: Optional[str] = None
    topk: int = Field(default=3, ge=1, le=10)

class PredictionResult(BaseModel):
    predicted_label: Optional[str]
    predicted_proba: Optional[float] 
    topk_labels: List[str]
    topk_probas: List[float]

class SetLabelRequest(BaseModel):
    node_code: str
    user_label: Optional[str] = None
    apply_to_subtree: bool = False

class UploadResponse(BaseModel):
    message: str
    code: str
    record: Dict[str, Any]

class FileListResponse(BaseModel):
    uploaded_files: List[str]
    processed_files: List[str]
    records: List[Dict[str, Any]]

class RecordFilter(BaseModel):
    localization: Optional[str] = None
    year: Optional[int] = None
    q: Optional[str] = None

class MLStatusResponse(BaseModel):
    model_path: str
    loaded: bool
    error: Optional[str] = None

class ClassesResponse(BaseModel):
    classes: List[str]
    count: int
    message: str

class MLProcessResponse(BaseModel):
    message: str
    code: str
    categorized_path: str

class LabelUpdateResponse(BaseModel):
    message: str
    code: str
    node_code: str
    user_label: Optional[str]

class RecordModel(BaseModel):
    code: str
    project_name: str
    localization: str
    email: str
    year: int
    original_filename: str
    uploaded_filename: str
    processed_filename: str
    ml_processed: bool
    uploaded_at: str
    ml_processed_at: Optional[str] = None
    ml_error: Optional[str] = None
    categorized_filename: Optional[str] = None