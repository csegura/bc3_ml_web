import os
from typing import Set

# Directory paths
UPLOAD_DIR = "data/uploads"
PROCESSED_DIR = "data/processed"
CATEGORIZED_DIR = "data/categorized"
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../frontend'))

# File paths
REGISTRY_PATH = os.path.join(UPLOAD_DIR, "records.json")

# ML model configuration
ML_MODEL_PATH = os.environ.get(
    "ML_JOBLIB_MODEL", 
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/models/linear_ovr_tfidf.joblib"))
)
METRICS_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/models/metrics.json"))

# BC3 converter path
BC3_CONVERTER_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../tools/bc3_converter.py'))

# Business rules
ALLOWED_LOCALIZATIONS: Set[str] = {
    "NAVARRA",
    "PAIS VASCO", 
    "ZARAGOZA",
    "CASTILLA Y LEON",
    "MADRID",
}

# CORS configuration
CORS_ORIGINS = [
    "http://localhost",
    "http://localhost:8005", 
    "http://127.0.0.1",
    "http://127.0.0.1:8005",
]

# Frontend route mapping
FRONTEND_ROUTE_MAP = {
    "/": "index-v2.html",
    # clean URL -> v2 defaults
    "/upload.html": "upload-v2.html", 
    "/calc.html": "calc-v2.html",
    "/classify.html": "classify-v2.html",
    "/categorized.html": "categorized-v2.html", 
    "/grouped.html": "grouped-v2.html",
    # explicit v2 routes
    "/index-v2.html": "index-v2.html",
    "/upload-v2.html": "upload-v2.html",
    "/calc-v2.html": "calc-v2.html", 
    "/classify-v2.html": "classify-v2.html",
    "/categorized-v2.html": "categorized-v2.html",
    "/grouped-v2.html": "grouped-v2.html",
    # misc
    "/debug.html": "debug.html",
    "/calc-test.html": "calc-test.html",
    "/acr_copilot.png": "acr_copilot.png",
}

# Validation constants
MIN_YEAR = 1900
MAX_YEAR = 3000