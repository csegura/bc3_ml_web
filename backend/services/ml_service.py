import json
import os
from typing import Dict, Optional, Any

from ..config import ML_MODEL_PATH, METRICS_PATH, CATEGORIZED_DIR
from ..exceptions import MLModelError, MLModelNotFoundError, FileNotFoundError
from ..logging_config import get_logger

logger = get_logger(__name__)

class MLService:
    """Service for ML model operations."""
    
    def __init__(self):
        self._ml_pipe = None
    
    def load_model(self):
        """Load ML model lazily."""
        if self._ml_pipe is None:
            try:
                import joblib
                logger.info(f"Loading ML model from {ML_MODEL_PATH}")
                self._ml_pipe = joblib.load(ML_MODEL_PATH)
                logger.info("ML model loaded successfully")
            except ImportError:
                raise MLModelError("joblib library not available")
            except Exception as e:
                raise MLModelNotFoundError(f"Failed to load ML model from {ML_MODEL_PATH}: {e}")
        return self._ml_pipe
    
    def predict_topk(self, text: str, topk: int = 3, descriptive: Optional[str] = None) -> Dict:
        """Make ML prediction with top-k results."""
        try:
            pipe = self.load_model()
            
            # Prepare input text
            input_text = text
            if descriptive:
                input_text = f"{descriptive} [SEP] {text}"
            
            # Import numpy here to avoid import issues
            import numpy as np
            
            # Make prediction
            proba = pipe.predict_proba([input_text])[0]
            classes = list(getattr(pipe, "classes_", []))
            idx = np.argsort(proba)[::-1][:topk]
            
            labels = [str(classes[i]) if i < len(classes) else str(i) for i in idx]
            probs = [float(proba[i]) for i in idx]
            
            result = {
                "predicted_label": labels[0] if labels else None,
                "predicted_proba": probs[0] if probs else None,
                "topk_labels": labels,
                "topk_probas": probs,
            }
            
            logger.info(f"Prediction completed for text: {text[:50]}...")
            return result
            
        except ImportError:
            raise MLModelError("numpy library not available")
        except Exception as e:
            logger.error(f"Prediction failed: {e}")
            raise MLModelError(f"Prediction failed: {e}")
    
    def get_model_status(self) -> Dict:
        """Get ML model status."""
        try:
            pipe = self.load_model()
            return {
                "model_path": ML_MODEL_PATH,
                "loaded": pipe is not None
            }
        except Exception as e:
            return {
                "model_path": ML_MODEL_PATH,
                "loaded": False,
                "error": str(e)
            }
    
    def categorize_json_tree(self, data: Any) -> Any:
        """Traverse JSON tree and attach ML predictions to PARTIDA nodes."""
        def process_node(node: Dict[str, Any]):
            concept_type = str(node.get("concept_type", ""))
            if concept_type != "PARTIDA":
                return
            
            text = str(node.get("summary", ""))
            descriptive = node.get("descriptive_text")
            
            if text:
                try:
                    pred = self.predict_topk(
                        text, 
                        descriptive=str(descriptive) if descriptive else None
                    )
                    node["_prediction"] = pred
                    logger.debug(f"Added prediction for node {node.get('code', '')}")
                except Exception as e:
                    node["_prediction_error"] = str(e)
                    logger.warning(f"Failed to predict for node {node.get('code', '')}: {e}")
        
        def traverse(obj: Any):
            if isinstance(obj, dict):
                process_node(obj)
                for v in list(obj.values()):
                    traverse(v)
            elif isinstance(obj, list):
                for item in obj:
                    traverse(item)
        
        traverse(data)
        return data
    
    def process_record_ml(self, code: str, processed_data: Dict) -> str:
        """Process a record with ML categorization."""
        try:
            # Apply ML categorization
            categorized_data = self.categorize_json_tree(processed_data)
            
            # Save categorized output
            output_path = os.path.join(CATEGORIZED_DIR, f"{code}.json")
            os.makedirs(CATEGORIZED_DIR, exist_ok=True)
            
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(categorized_data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"ML processing completed for {code}, saved to {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"ML processing failed for {code}: {e}")
            raise MLModelError(f"ML processing failed: {e}")
    
    def get_all_classes(self) -> Dict:
        """Get all available ML classes from metrics file."""
        try:
            if not os.path.exists(METRICS_PATH):
                raise FileNotFoundError("Metrics file not found")
            
            with open(METRICS_PATH, "r", encoding="utf-8") as f:
                metrics_data = json.load(f)
            
            classes = metrics_data.get("classes", [])
            if not classes:
                raise FileNotFoundError("No classes found in metrics file")
            
            return {
                "classes": classes,
                "count": len(classes),
                "message": f"Retrieved {len(classes)} classification classes"
            }
            
        except Exception as e:
            logger.error(f"Failed to load classes: {e}")
            raise FileNotFoundError(f"Failed to load classes: {e}")
    
    def update_user_label(self, code: str, node_code: str, user_label: Optional[str], 
                         apply_to_subtree: bool = False) -> None:
        """Update user label for a node in categorized JSON."""
        categorized_path = os.path.join(CATEGORIZED_DIR, f"{code}.json")
        
        if not os.path.exists(categorized_path):
            raise FileNotFoundError("Categorized file not found")
        
        try:
            # Load categorized data
            with open(categorized_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # Find and update target node
            updated = self._apply_label_to_tree(data, node_code, user_label, apply_to_subtree)
            
            if not updated:
                raise FileNotFoundError("Node code not found")
            
            # Save updated data
            with open(categorized_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"Updated label for node {node_code} in {code}")
            
        except Exception as e:
            logger.error(f"Failed to update label: {e}")
            raise MLModelError(f"Failed to update label: {e}")
    
    def _apply_label_to_tree(self, obj: Any, target_code: str, user_label: Optional[str], 
                           apply_to_subtree: bool) -> bool:
        """Recursively find and update node labels."""
        updated = False
        
        def apply_label(node: dict):
            if str(node.get("concept_type", "")) == "PARTIDA":
                pred = node.get("_prediction")
                if not isinstance(pred, dict):
                    pred = {}
                    node["_prediction"] = pred
                
                # Clear or set user label
                if user_label is None or str(user_label).strip() == "":
                    if "user_label" in pred:
                        del pred["user_label"]
                else:
                    pred["user_label"] = user_label
        
        def find_and_apply(node: Any) -> bool:
            nonlocal updated
            
            if isinstance(node, dict):
                if str(node.get("code", "")) == target_code:
                    if apply_to_subtree:
                        self._walk_and_apply_label(node, apply_label)
                    else:
                        apply_label(node)
                    updated = True
                    return True
                
                for v in node.values():
                    if find_and_apply(v):
                        return True
                        
            elif isinstance(node, list):
                for item in node:
                    if find_and_apply(item):
                        return True
                        
            return False
        
        find_and_apply(obj)
        return updated
    
    def _walk_and_apply_label(self, obj: Any, apply_func):
        """Walk tree and apply function to all nodes."""
        if isinstance(obj, dict):
            apply_func(obj)
            for v in obj.values():
                self._walk_and_apply_label(v, apply_func)
        elif isinstance(obj, list):
            for item in obj:
                self._walk_and_apply_label(item, apply_func)