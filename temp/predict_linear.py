#!/usr/bin/env python3
"""
Load a trained linear TF-IDF model and run inference.

Examples:
  # Single text
  python scripts/predict_linear.py models/linear_ovr_tfidf.joblib --text "Hormigón HA-25 en zapata..." --topk 5

  # From CSV column, write predictions
  python scripts/predict_linear.py models/linear_ovr_tfidf.joblib \
      --from-csv dataset.csv --text-col text --out predictions.csv --topk 3
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path
from typing import List

import joblib
import numpy as np
import pandas as pd


def topk_from_proba(classes: List[str], proba_row: np.ndarray, k: int):
    idx = np.argsort(proba_row)[::-1][:k]
    labels = [classes[i] for i in idx]
    probs = [float(proba_row[i]) for i in idx]
    return labels, probs


def main() -> int:
    ap = argparse.ArgumentParser(description="Predict with linear TF-IDF model")
    ap.add_argument("model", type=Path, help="Path to joblib model")
    ap.add_argument("--text", default=None, help="Single text to classify")
    ap.add_argument("--from-csv", type=Path, default=None, help="CSV file with texts")
    ap.add_argument("--text-col", default="text", help="Text column name in CSV")
    ap.add_argument("--out", type=Path, default=None, help="Optional output CSV to write predictions")
    ap.add_argument("--topk", type=int, default=3)
    args = ap.parse_args()

    pipe = joblib.load(args.model)
    if args.text:
        proba = pipe.predict_proba([args.text])[0]
        labels, probs = topk_from_proba(list(pipe.classes_), proba, args.topk)
        for l, p in zip(labels, probs):
            print(f"{l}\t{p:.4f}")
        return 0

    if args.from_csv:
        df = pd.read_csv(args.from_csv)
        if args.text_col not in df.columns:
            raise SystemExit(f"Column '{args.text_col}' not found in {args.from_csv}")
        texts = df[args.text_col].astype(str).tolist()
        probas = pipe.predict_proba(texts)
        top1 = []
        top1_p = []
        topk_labels_list = []
        topk_probs_list = []
        for pr in probas:
            labels, probs = topk_from_proba(list(pipe.classes_), pr, args.topk)
            top1.append(labels[0])
            top1_p.append(probs[0])
            topk_labels_list.append("|".join(labels))
            topk_probs_list.append("|".join(f"{p:.4f}" for p in probs))

        out_df = df.copy()
        out_df["pred_label"] = top1
        out_df["pred_proba"] = top1_p
        out_df[f"top{args.topk}_labels"] = topk_labels_list
        out_df[f"top{args.topk}_probas"] = topk_probs_list

        if args.out:
            args.out.parent.mkdir(parents=True, exist_ok=True)
            out_df.to_csv(args.out, index=False)
            print(f"Wrote predictions to {args.out}")
        else:
            print(out_df.head(10).to_string(index=False))
        return 0

    ap.error("Provide either --text or --from-csv")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())

