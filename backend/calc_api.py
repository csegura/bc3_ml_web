import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from tools.bc3_pcalc import BC3PrettyCalculator
from fastapi import APIRouter
from fastapi.responses import JSONResponse
import os
import json
from decimal import Decimal
from typing import Any, Dict, Optional

router = APIRouter()

PROCESSED_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/processed'))
CATEGORIZED_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/categorized'))


def build_tree(node: Dict[str, Any], calc: BC3PrettyCalculator, max_level=None, current_level=0, filter_label: Optional[str] = None):
    code = node.get('code', '')
    summary = node.get('summary', '')
    unit = node.get('unit', '')
    concept_type = node.get('concept_type', 'UNKNOWN')
    descriptive_text = node.get('descriptive_text', '')
    prediction = node.get('_prediction')
    unit_price = float(calc.calculate_unit_price(code))
    try:
        output = float(node.get('output', 1))
    except Exception:
        output = 1.0
    total_amount = unit_price * output
    children = node.get('children', [])
    # Only include children if within max_level
    child_nodes = []
    if children and (max_level is None or current_level < max_level):
        for child in children:
            if calc.should_show_concept(child.get('code', ''), max_level):
                built = build_tree(child, calc, max_level, current_level + 1, filter_label)
                if built is not None:
                    child_nodes.append(built)

    # If filtering by label, prune nodes without matching label in subtree
    if filter_label:
        concept_type = node.get('concept_type', 'UNKNOWN')
        if concept_type == 'PARTIDA':
            pred = node.get('_prediction') or {}
            label = pred.get('predicted_label')
            if label != filter_label:
                return None
        else:
            # non-PARTIDA must have at least 1 kept child
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

@router.get("/calc_tree/{filename}")
def calc_tree(filename: str, chapter: str = None, level: int = None, source: str = "processed", label: str = None):
    """Calculate and return the BC3 budget tree and prices as JSON."""
    base_dir = PROCESSED_DIR if (source or "processed").lower() != "categorized" else CATEGORIZED_DIR
    file_path = os.path.join(base_dir, filename)
    if not os.path.exists(file_path):
        return JSONResponse(status_code=404, content={"error": "File not found"})
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    calc = BC3PrettyCalculator()
    budget = data.get('budget')
    if not budget:
        return JSONResponse(status_code=400, content={"error": "No budget data in file"})
    calc.index_concepts(budget)
    if chapter:
        node = calc.find_concept_by_code(chapter)
        if not node:
            return JSONResponse(status_code=404, content={"error": "Chapter not found"})
    else:
        node = budget
    tree = build_tree(node, calc, max_level=level, filter_label=label)
    if tree is None:
        return JSONResponse(status_code=404, content={"error": "No nodes match the requested label"})
    return {"tree": tree}
