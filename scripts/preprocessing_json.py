#!/usr/bin/env python3
"""
preprocessing_json.py — CLI for the shared .docx → ImportParseResult JSON parser.

The parser itself lives in parse-server/ (preprocessing.py + preprocessing_json.py),
which is deployed as-is to Railway; this script runs the same code locally.

Usage:
    python3 preprocessing_json.py <path-to-docx>
"""

import json
import sys
from pathlib import Path

PARSE_SERVER_DIR = Path(__file__).resolve().parent.parent / 'parse-server'
sys.path.insert(0, str(PARSE_SERVER_DIR))

from preprocessing_json import parse_docx_to_json  # noqa: E402


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: preprocessing_json.py <path-to-docx>'}))
        sys.exit(1)

    docx_path = sys.argv[1]
    if not Path(docx_path).exists():
        print(json.dumps({'error': f'File not found: {docx_path}'}))
        sys.exit(1)

    try:
        result = parse_docx_to_json(docx_path)
        json.dump(result, sys.stdout, ensure_ascii=False)
    except Exception as e:
        print(json.dumps({'error': str(e)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == '__main__':
    main()
