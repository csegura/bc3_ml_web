
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os
import json
from datetime import datetime
from typing import List, Dict, Optional
import re

from . import calc_api
app = FastAPI()

# Configure CORS so frontend served from localhost/127.0.0.1 can call this API
origins = [
    "http://localhost",
    "http://localhost:8005",
    "http://127.0.0.1",
    "http://127.0.0.1:8005",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files from the frontend directory at /static
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../frontend'))
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
app.include_router(calc_api.router)

from fastapi.responses import FileResponse


def _serve_frontend_file(filename: str):
    """Return a FileResponse for a frontend file if it exists, otherwise raise 404."""
    path = os.path.join(FRONTEND_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail={"error": "Frontend file not found", "file": filename})
    return FileResponse(path)


# Register a small set of frontend routes that historically pointed to specific v2 files.
# This reduces duplication and ensures we return a 404 when the file is missing.
_ROUTE_MAP = {
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


def _make_handler(filename: str):
    async def handler():
        return _serve_frontend_file(filename)

    # give each handler a unique name for nicer OpenAPI docs
    handler.__name__ = f"serve_{filename.replace('-', '_').replace('.', '_')}"
    return handler


for route, fname in _ROUTE_MAP.items():
    app.get(route)(_make_handler(fname))

UPLOAD_DIR = "uploads"
PROCESSED_DIR = "processed"
CATEGORIZED_DIR = "categorized"
REGISTRY_PATH = os.path.join(UPLOAD_DIR, "records.json")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)
os.makedirs(CATEGORIZED_DIR, exist_ok=True)
# Expose processed files for direct download/view
app.mount("/processed", StaticFiles(directory=PROCESSED_DIR), name="processed")
app.mount("/categorized", StaticFiles(directory=CATEGORIZED_DIR), name="categorized")


import subprocess
import logging

ALLOWED_LOCALIZATIONS = {
    "NAVARRA",
    "PAIS VASCO",
    "ZARAGOZA",
    "CASTILLA Y LEON",
    "MADRID",
}


def _load_registry() -> List[Dict]:
    if not os.path.exists(REGISTRY_PATH):
        return []
    try:
        with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            # If somehow not a list, reset
            return []
    except Exception:
        # Corrupt file, start fresh
        return []


def _save_registry(entries: List[Dict]) -> None:
    with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)


def _next_code(entries: List[Dict]) -> str:
    # Codes look like C00001, C00002, ...
    max_num = 0
    pattern = re.compile(r"^C(\d{5})$")
    for e in entries:
        code = e.get("code", "")
        m = pattern.match(code)
        if m:
            try:
                num = int(m.group(1))
                if num > max_num:
                    max_num = num
            except ValueError:
                continue
    return f"C{max_num + 1:05d}"


@app.post("/uploadfile/")
async def create_upload_file(
    file: UploadFile = File(...),
    project_name: str = Form(...),
    localization: str = Form(...),
    email: str = Form(...),
    year: int = Form(...),
):
    """
    Uploads a .bc3 file, generates a sequential code (C00001...), renames the
    uploaded and processed outputs to that code, and records metadata in uploads/records.json.
    """

    # Validate inputs
    if localization not in ALLOWED_LOCALIZATIONS:
        raise HTTPException(status_code=400, detail={
            "error": "Invalid localization",
            "allowed": sorted(list(ALLOWED_LOCALIZATIONS)),
        })
    if not str(email).strip() or "@" not in email:
        raise HTTPException(status_code=400, detail={"error": "Invalid email"})
    try:
        y = int(year)
        if y < 1900 or y > 3000:
            raise ValueError()
    except Exception:
        raise HTTPException(status_code=400, detail={"error": "Invalid year"})

    original_filename = file.filename
    if not original_filename or not original_filename.lower().endswith(".bc3"):
        raise HTTPException(status_code=400, detail={"error": "Only .bc3 files are supported"})

    # Load registry and get next code
    entries = _load_registry()
    code = _next_code(entries)

    # Save uploaded file with code-based name
    upload_code_filename = f"{code}.bc3"
    source_path = os.path.join(UPLOAD_DIR, upload_code_filename)
    with open(source_path, "wb") as buffer:
        buffer.write(await file.read())

    # Convert to JSON using tools/bc3_converter.py -> processed/Cxxxxx.json
    processed_filename = f"{code}.json"
    processed_path = os.path.join(PROCESSED_DIR, processed_filename)
    converter_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../tools/bc3_converter.py'))
    try:
        result = subprocess.run(
            ["python3", converter_path, source_path, "-o", processed_path],
            capture_output=True,
            text=True,
            check=True,
        )
        logging.info(f"Conversion output: {result.stdout}")
    except subprocess.CalledProcessError as e:
        logging.error(f"BC3 conversion failed: {e.stderr}")
        # Clean up the uploaded file if processing failed
        try:
            if os.path.exists(source_path):
                os.remove(source_path)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail={"error": "BC3 conversion failed", "details": e.stderr})

    # Record metadata
    record = {
        "code": code,
        "project_name": project_name,
        "localization": localization,
        "email": email,
        "year": int(year),
        "original_filename": original_filename,
        "uploaded_filename": upload_code_filename,
        "processed_filename": processed_filename,
        "ml_processed": False,
        "uploaded_at": datetime.utcnow().isoformat() + "Z",
    }
    entries.append(record)
    _save_registry(entries)

    return JSONResponse(status_code=200, content={
        "message": f"File '{original_filename}' processed and saved as '{processed_filename}'",
        "code": code,
        "record": record,
    })

@app.get("/files/")
async def list_files():
    uploaded_files = os.listdir(UPLOAD_DIR)
    processed_files = os.listdir(PROCESSED_DIR)
    # Also include registry entries for convenience
    return {
        "uploaded_files": uploaded_files,
        "processed_files": processed_files,
        "records": _load_registry(),
    }


@app.get("/records/")
async def get_records(
    localization: Optional[str] = None,
    year: Optional[int] = None,
    q: Optional[str] = None,
):
    """Return upload records, optionally filtered by localization, year, or query.

    - localization: one of ALLOWED_LOCALIZATIONS
    - year: exact match
    - q: case-insensitive substring against code, project_name, email
    """
    records = _load_registry()
    if localization:
        if localization not in ALLOWED_LOCALIZATIONS:
            raise HTTPException(status_code=400, detail={
                "error": "Invalid localization",
                "allowed": sorted(list(ALLOWED_LOCALIZATIONS)),
            })
        records = [r for r in records if r.get("localization") == localization]
    if year is not None:
        try:
            y = int(year)
            records = [r for r in records if int(r.get("year", 0)) == y]
        except Exception:
            raise HTTPException(status_code=400, detail={"error": "Invalid year"})
    if q:
        ql = q.lower()
        def _match(r: Dict) -> bool:
            return (
                ql in str(r.get("code", "")).lower()
                or ql in str(r.get("project_name", "")).lower()
                or ql in str(r.get("email", "")).lower()
            )
        records = [r for r in records if _match(r)]
    return records

# ===== ML model (joblib) predict endpoint =====
# Configure model path via env var; fallback to ../data/models/linear_ovr_tfidf.joblib
_ML_MODEL_PATH = os.environ.get("ML_JOBLIB_MODEL", os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/models/linear_ovr_tfidf.joblib")))
_ml_pipe = None


def _load_ml_model():
    global _ml_pipe
    if _ml_pipe is None:
        try:
            import joblib  # type: ignore
            _ml_pipe = joblib.load(_ML_MODEL_PATH)
        except Exception as e:
            raise RuntimeError(f"Failed to load ML model from {_ML_MODEL_PATH}: {e}")
    return _ml_pipe


def _predict_topk(text: str, topk: int = 3, descriptive: Optional[str] = None) -> Dict:
    pipe = _load_ml_model()
    if descriptive:
        text = f"{descriptive} [SEP] {text}"
    try:
        import numpy as np  # type: ignore
        proba = pipe.predict_proba([text])[0]
        classes = list(getattr(pipe, "classes_", []))
        idx = np.argsort(proba)[::-1][:topk]
        labels = [str(classes[i]) if i < len(classes) else str(i) for i in idx]
        probs = [float(proba[i]) for i in idx]
        return {
            "predicted_label": labels[0] if labels else None,
            "predicted_proba": probs[0] if probs else None,
            "topk_labels": labels,
            "topk_probas": probs,
        }
    except Exception as e:
        raise RuntimeError(f"Prediction failed: {e}")


from pydantic import BaseModel


class PredictRequest(BaseModel):
    text: str
    descriptive: Optional[str] = None
    topk: int = 3


@app.post("/predict")
async def predict(req: PredictRequest):
    try:
        result = _predict_topk(req.text, topk=req.topk, descriptive=req.descriptive)
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail={"error": str(e)})


@app.get("/ml/status")
async def ml_status():
    """Report ML model availability and path. Attempts a lazy load once."""
    try:
        pipe = _load_ml_model()
        return {"model_path": _ML_MODEL_PATH, "loaded": bool(pipe is not None)}
    except Exception as e:
        return {"model_path": _ML_MODEL_PATH, "loaded": False, "error": str(e)}


def _categorize_json_tree(data: object) -> object:
    """Traverse JSON, attach _prediction for PARTIDA nodes using summary/descriptive_text."""
    def process_node(node: Dict[str, object]):
        concept_type = str(node.get("concept_type", ""))
        if concept_type != "PARTIDA":
            return
        text = str(node.get("summary", ""))
        descriptive = node.get("descriptive_text")
        if text:
            try:
                pred = _predict_topk(text, descriptive=str(descriptive) if descriptive else None)
                node["_prediction"] = pred
            except Exception as e:
                node["_prediction_error"] = str(e)

    def traverse(obj: object):
        if isinstance(obj, dict):
            process_node(obj)  # type: ignore[arg-type]
            for v in list(obj.values()):
                traverse(v)
        elif isinstance(obj, list):
            for it in obj:
                traverse(it)

    traverse(data)
    return data


@app.post("/records/{code}/ml")
async def run_ml_on_record(code: str):
    # Load processed JSON
    input_path = os.path.join(PROCESSED_DIR, f"{code}.json")
    if not os.path.exists(input_path):
        raise HTTPException(status_code=404, detail={"error": "Processed JSON not found"})

    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Categorize
    try:
        data = _categorize_json_tree(data)
    except Exception as e:
        # Update registry with failure info
        entries = _load_registry()
        for e2 in entries:
            if e2.get("code") == code:
                e2["ml_processed"] = False
                e2["ml_error"] = str(e)
                break
        _save_registry(entries)
        raise HTTPException(status_code=500, detail={"error": f"ML processing failed: {e}"})

    # Write categorized output
    out_path = os.path.join(CATEGORIZED_DIR, f"{code}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # Update registry: set ml_processed true and add categorized filename + timestamp
    entries = _load_registry()
    for e in entries:
        if e.get("code") == code:
            e["ml_processed"] = True
            e["ml_processed_at"] = datetime.utcnow().isoformat() + "Z"
            e["ml_error"] = None
            e["categorized_filename"] = f"{code}.json"
            break
    _save_registry(entries)

    return {"message": "ML categorization completed", "code": code, "categorized_path": out_path}


class SetLabelRequest(BaseModel):
    node_code: str
    user_label: str | None = None
    apply_to_subtree: bool = False


@app.post("/records/{code}/label")
async def set_user_label(code: str, req: SetLabelRequest):
    """Set or update user_label for a PARTIDA node identified by node_code in categorized JSON.
    Stores the value under node._prediction.user_label.
    """
    cat_path = os.path.join(CATEGORIZED_DIR, f"{code}.json")
    if not os.path.exists(cat_path):
        raise HTTPException(status_code=404, detail={"error": "Categorized file not found"})

    try:
        with open(cat_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"Failed to read categorized JSON: {e}"})

    target = req.node_code
    updated = False

    def apply_label(node: dict):
        nonlocal updated
        if str(node.get("concept_type", "")) == "PARTIDA":
            pred = node.get("_prediction")
            if not isinstance(pred, dict):
                pred = {}
                node["_prediction"] = pred
            # Empty/None user_label clears override
            if req.user_label is None or str(req.user_label).strip() == "":
                if "user_label" in pred:
                    del pred["user_label"]
            else:
                pred["user_label"] = req.user_label
            updated = True

    # Find target node and apply
    def find_and_apply(obj):
        if isinstance(obj, dict):
            if str(obj.get("code", "")) == target:
                if req.apply_to_subtree:
                    # Apply to this node and all descendants
                    def walk(n):
                        if isinstance(n, dict):
                            apply_label(n)
                            for v in n.values():
                                walk(v)
                        elif isinstance(n, list):
                            for it in n:
                                walk(it)
                    walk(obj)
                else:
                    apply_label(obj)
                return True
            # else continue searching
            for v in obj.values():
                if find_and_apply(v):
                    return True
        elif isinstance(obj, list):
            for it in obj:
                if find_and_apply(it):
                    return True
        return False

    if not find_and_apply(data):
        raise HTTPException(status_code=404, detail={"error": "Node code not found"})

    try:
        with open(cat_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"Failed to write categorized JSON: {e}"})

    return {"message": "Label updated", "code": code, "node_code": target, "user_label": req.user_label}


@app.get("/download/{code}")
async def download_processed(code: str):
    """Download the processed JSON for a given code as an attachment."""
    filename = f"{code}.json"
    path = os.path.join(PROCESSED_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail={"error": "Processed file not found"})
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    return FileResponse(path, media_type="application/json", headers=headers)

@app.get("/api/classes")
async def get_all_classes():
    """Get all available classes from metrics.json for classification selection."""
    metrics_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/models/metrics.json"))
    
    if not os.path.exists(metrics_path):
        raise HTTPException(status_code=404, detail={"error": "Metrics file not found"})
    
    try:
        with open(metrics_path, "r", encoding="utf-8") as f:
            metrics_data = json.load(f)
        
        classes = metrics_data.get("classes", [])
        if not classes:
            raise HTTPException(status_code=404, detail={"error": "No classes found in metrics file"})
        
        return {
            "classes": classes,
            "count": len(classes),
            "message": f"Retrieved {len(classes)} classification classes"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"Failed to load classes: {e}"})

def main():
    """Main entry point for the backend server."""
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8005, reload=True)

if __name__ == "__main__":
    main()
