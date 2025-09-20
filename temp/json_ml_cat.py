import json
import argparse
from typing import Any, Dict
from rich import print

import requests

PREDICT_URL = "http://localhost:8001/predict"  


# #### Text Classification
# **POST** `/predict`
# - Classify Spanish text using the loaded ML model
# - **Request Body**:
# ```json
# {
#   "text": "Main text to classify",
#   "descriptive": "Optional additional descriptive text"
# }


def process_node(node: Dict[str, Any]) -> None:
    """
    User-editable function to process (and possibly modify) each node in the tree.
    call to predict API to classify text.
    """
    
    # get node concept_type
    concept_type = node.get("concept_type", "")

    # Skip non-PARTIDA nodes
    if concept_type != "PARTIDA":
        return
     
    
    # call to predict API to classify text
    text = node.get("summary", "")
    descriptive = node.get("descriptive_text")
    if text:
        payload = {"text": text}
        if descriptive:
            payload["descriptive"] = descriptive
        try:
            response = requests.post(PREDICT_URL, json=payload, timeout=5)
            node["_prediction"] = ""
            if response.ok:
                prediction = response.json()
                node["_prediction"] = prediction
            else:
                node["_prediction_error"] = f"HTTP {response.status_code}"
                print(f" - Error: {node['_prediction_error']}", end='')
        except Exception as e:
            node["_prediction_error"] = str(e)
            print(f" - Ex: {node['_prediction_error']}", end='')

        # Print node details for debugging
        print(f"[bold]{node.get('code', 'unknown')}[/bold] - [blue]{node.get('summary', '')}[/blue]", end=' ')
        print(f"-> [yellow]{node['_prediction']['predicted_label']}[/yellow]")
        print(f"[magenta]{node.get('descriptive_text', '')[:128]}[/magenta]")
    
    
    

def traverse_tree(node: Any):
    """
    Recursively traverse the tree, calling process_node on each dict node.
    """
    if isinstance(node, dict):
        process_node(node)
        for value in node.values():
            traverse_tree(value)
    elif isinstance(node, list):
        for item in node:
            traverse_tree(item)

def main():
    parser = argparse.ArgumentParser(description="Assign concept codes to JSON nodes based on text classification.")
    parser.add_argument("input_file", help="Input JSON file")
    parser.add_argument("-o", "--output", help="Output JSON file (if omitted, prints to stdout)")
    args = parser.parse_args()

    # Load JSON
    with open(args.input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Traverse and process
    traverse_tree(data)

    # Output result
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Modified JSON saved to {args.output}")
    else:
        print(json.dumps(data, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
