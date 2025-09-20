import json
import os
from typing import Dict, Optional, Any
import sys

from ..config import PROCESSED_DIR, CATEGORIZED_DIR
from ..exceptions import FileNotFoundError
from ..logging_config import get_logger

# Add tools directory to path to import BC3 calculator
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../tools')))
from bc3_pcalc import BC3PrettyCalculator

logger = get_logger(__name__)

class BC3Service:
    """Service for BC3 file operations and calculations."""
    
    def calculate_tree(self, filename: str, chapter: Optional[str] = None, 
                      level: Optional[int] = None, source: str = "processed", 
                      label: Optional[str] = None) -> Dict[str, Any]:
        """Calculate and return BC3 budget tree with prices."""
        
        # Determine source directory
        base_dir = PROCESSED_DIR if source.lower() != "categorized" else CATEGORIZED_DIR
        file_path = os.path.join(base_dir, filename)
        
        if not os.path.exists(file_path):
            logger.error(f"File not found: {file_path}")
            raise FileNotFoundError(f"File not found: {filename}")
        
        try:
            # Load data
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            budget = data.get('budget')
            if not budget:
                raise ValueError("No budget data in file")
            
            # Initialize calculator
            calc = BC3PrettyCalculator()
            calc.index_concepts(budget)
            
            # Determine root node
            if chapter:
                node = calc.find_concept_by_code(chapter)
                if not node:
                    logger.error(f"Chapter '{chapter}' not found in budget")
                    raise FileNotFoundError(f"Chapter '{chapter}' not found")
            else:
                node = budget
            
            # Build tree
            tree = self._build_tree(node, calc, max_level=level, filter_label=label)
            
            if tree is None:
                raise FileNotFoundError("No nodes match the requested label")
            
            logger.info(f"Successfully calculated tree for {filename}")
            return {"tree": tree}
            
        except Exception as e:
            logger.error(f"Failed to calculate tree for {filename}: {e}")
            raise
    
    def _build_tree(self, node: Dict[str, Any], calc: BC3PrettyCalculator, 
                   max_level: Optional[int] = None, current_level: int = 0, 
                   filter_label: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Build tree structure with calculations."""
        
        code = node.get('code', '')
        summary = node.get('summary', '')
        unit = node.get('unit', '')
        concept_type = node.get('concept_type', 'UNKNOWN')
        descriptive_text = node.get('descriptive_text', '')
        prediction = node.get('_prediction')
        
        # Calculate prices
        unit_price = float(calc.calculate_unit_price(code))
        
        try:
            output = float(node.get('output', 1))
        except Exception:
            output = 1.0
        
        total_amount = unit_price * output
        children = node.get('children', [])
        
        # Process children if within level limits
        child_nodes = []
        if children and (max_level is None or current_level < max_level):
            for child in children:
                if calc.should_show_concept(child.get('code', ''), max_level):
                    built = self._build_tree(
                        child, calc, max_level, current_level + 1, filter_label
                    )
                    if built is not None:
                        child_nodes.append(built)
        
        # Apply label filtering
        if filter_label:
            if concept_type == 'PARTIDA':
                pred = node.get('_prediction') or {}
                label = pred.get('predicted_label')
                if label != filter_label:
                    return None
            else:
                # Non-PARTIDA must have at least one kept child
                if not child_nodes:
                    return None
        
        return {
            "code": code,
            "summary": summary,
            "_prediction": prediction,
            "unit": unit,
            "concept_type": concept_type,
            "descriptive_text": descriptive_text,
            "unit_price": unit_price,
            "output": output,
            "total_amount": total_amount,
            "children": child_nodes
        }