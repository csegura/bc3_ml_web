#!/usr/bin/env python3
"""MongoDB Database Utility CLI

Provides a small command-line tool to upload a JSON file (top-level array of
objects) into a MongoDB collection. Defaults to database ``budgets`` and
collection ``sources`` on host 172.16.10.28:27017.

Example:
  python tools/mdb.py upload data.json --host 172.16.10.28 --port 27017

The script requires `pymongo` to be installed.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from typing import Any, Dict, List, Optional

try:
    from pymongo import MongoClient
    from pymongo.errors import PyMongoError
except Exception:  # pragma: no cover - runtime dependency check
    MongoClient = None  # type: ignore
    PyMongoError = Exception  # type: ignore

# Try to load .env if python-dotenv is available, otherwise rely on environment
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    # No dotenv available; assume environment variables or defaults
    pass

# Read defaults from environment (possibly loaded from .env)
_DEFAULT_URI = os.getenv("MONGODB_URI")
_DEFAULT_USERNAME = os.getenv("MONGODB_USERNAME")
_DEFAULT_PASSWORD = os.getenv("MONGODB_PASSWORD")

def _parse_uri(uri: str) -> tuple[str, int]:
    """Simple parser to extract host and port from a mongodb:// URI.

    Falls back to ('172.16.10.28', 27017) on parse failure.
    """
    try:
        # mongodb://host:port or mongodb://user:pass@host:port
        base = uri.split("//", 1)[1]
        if "@" in base:
            base = base.split("@", 1)[1]
        hostport = base.split("/", 1)[0]
        host, port = hostport.split(":")
        return host, int(port)
    except Exception:
        return "172.16.10.28", 27017


def get_client(host: str, port: int, username: Optional[str] = None, password: Optional[str] = None, timeout_ms: int = 5000, uri: Optional[str] = None):
    """Return a connected MongoClient or raise a RuntimeError if pymongo is missing."""
    if MongoClient is None:
        raise RuntimeError("pymongo is required. Install it with: pip install pymongo")
    if uri:
        return MongoClient(uri, serverSelectionTimeoutMS=timeout_ms)
    if username and password:
        uri2 = f"mongodb://{username}:{password}@{host}:{port}/"
        return MongoClient(uri2, serverSelectionTimeoutMS=timeout_ms)
    return MongoClient(f"mongodb://{host}:{port}/", serverSelectionTimeoutMS=timeout_ms)


def load_json_array(path: str) -> List[Dict[str, Any]]:
    """Load and validate that the JSON file contains a top-level array of objects.

    Raises FileNotFoundError, json.JSONDecodeError, or ValueError.
    """
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, list):
        raise ValueError("JSON must be a top-level array (list) of objects.")
    return data


def upload_file(path: str, host: str, port: int, dbname: str = "budgets", collection: str = "sources", drop: bool = False, username: Optional[str] = None, password: Optional[str] = None) -> int:
    """Upload documents from JSON array file into the specified MongoDB collection.

    Returns the number of inserted documents on success.
    """
    docs = load_json_array(path)
    client = get_client(host, port, username=username, password=password)
    # Trigger server selection/connection early to provide clear errors.
    try:
        client.server_info()
    except Exception as exc:
        raise RuntimeError(f"Could not connect to MongoDB at {host}:{port}: {exc}")

    col = client[dbname][collection]
    if drop:
        logging.info("Dropping existing collection %s.%s", dbname, collection)
        col.drop()

    if not docs:
        logging.warning("No documents found in file '%s' to insert.", path)
        return 0

    result = col.insert_many(docs)
    inserted = len(result.inserted_ids)
    logging.info("Inserted %d documents into %s.%s", inserted, dbname, collection)
    return inserted


def main(argv: Optional[List[str]] = None) -> None:
    parser = argparse.ArgumentParser(description="MongoDB CLI for uploading JSON arrays to a collection.")
    sub = parser.add_subparsers(dest="cmd")

    up = sub.add_parser("upload", help="Upload a JSON array file or directory to a collection.")
    up.add_argument("file", help="Path to JSON file or directory. If directory, all *.json files will be uploaded.")
    up.add_argument("--recursive", action="store_true", help="Recursively search directories for .json files when a directory is provided.")
    up.add_argument("--host", default="172.16.10.28", help="MongoDB host (default 172.16.10.28)")
    up.add_argument("--port", default=27017, type=int, help="MongoDB port (default 27017)")
    up.add_argument("--db", default="budgets", help="Database name (default budgets)")
    up.add_argument("--collection", default="sources", help="Collection name (default sources)")
    up.add_argument("--drop", action="store_true", help="Drop collection before inserting.")
    up.add_argument("--username", help="MongoDB username (optional)")
    up.add_argument("--password", help="MongoDB password (optional)")
    up.add_argument("-v", "--verbose", action="count", default=0, help="Increase verbosity (repeatable)")

    # Allow a shorthand usage: `tools/mdb.py <path>` without writing `upload` first.
    argv_list = list(argv) if argv is not None else list(sys.argv[1:])
    if argv_list:
        first = argv_list[0]
        if first not in ("upload", "-h", "--help") and not first.startswith("-"):
            # If the first argument looks like a path, and it exists, treat this as an implicit upload
            try:
                if os.path.exists(first):
                    argv_list = ["upload"] + argv_list
            except Exception:
                pass

    args = parser.parse_args(argv_list)

    # Configure logging level
    if args.verbose >= 2:
        lvl = logging.DEBUG
    elif args.verbose == 1:
        lvl = logging.INFO
    else:
        lvl = logging.WARNING
    logging.basicConfig(level=lvl, format="%(levelname)s: %(message)s")

    try:
        if args.cmd == "upload":
            target = args.file
            files_to_process: List[str] = []
            if os.path.isdir(target):
                if args.recursive:
                    for root, _, files in os.walk(target):
                        for f in files:
                            if f.lower().endswith(".json"):
                                files_to_process.append(os.path.join(root, f))
                else:
                    for f in os.listdir(target):
                        if f.lower().endswith(".json"):
                            files_to_process.append(os.path.join(target, f))
            else:
                files_to_process = [target]

            if not files_to_process:
                logging.error("No JSON files found at: %s", target)
                sys.exit(7)

            total_inserted = 0
            failures: List[str] = []
            for fpath in files_to_process:
                try:
                    inserted = upload_file(fpath, args.host, args.port, dbname=args.db, collection=args.collection, drop=args.drop, username=args.username, password=args.password, uri=_DEFAULT_URI)
                    print(f"{fpath}: inserted {inserted}")
                    total_inserted += inserted
                except Exception as exc:
                    logging.error("Failed to process %s: %s", fpath, exc)
                    failures.append(fpath)

            print(f"Total inserted: {total_inserted} into {args.db}.{args.collection}")
            if failures:
                logging.error("Failed files: %s", ", ".join(failures))
                sys.exit(8)
    except FileNotFoundError:
        logging.error("File not found: %s", args.file)
        sys.exit(2)
    except json.JSONDecodeError as exc:
        logging.error("Invalid JSON in %s: %s", args.file, exc)
        sys.exit(3)
    except ValueError as exc:
        logging.error(str(exc))
        sys.exit(4)
    except RuntimeError as exc:
        logging.error(str(exc))
        sys.exit(5)
    except PyMongoError as exc:
        logging.error("MongoDB error: %s", exc)
        sys.exit(6)
    except Exception as exc:  # pragma: no cover - unexpected
        logging.error("Unexpected error: %s", exc, exc_info=(lvl == logging.DEBUG))
        sys.exit(10)


if __name__ == "__main__":
    main()
