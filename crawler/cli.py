from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .fetch import FetchError
from .pipeline import (
    DEFAULT_CACHE_DIR,
    DEFAULT_DATA_DIR,
    DEFAULT_SCHEMA_DIR,
    update_dataset,
)
from .validation import validate_dataset


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m crawler",
        description="Deterministic data pipeline for EndfieldSkill.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    update = subparsers.add_parser(
        "update",
        help="Fetch/cache sources and atomically rebuild data/v1.",
    )
    update.add_argument(
        "--source",
        choices=("all", "akedatabase"),
        default="all",
        help="Fetch all sources or only required AKEDatabase tables.",
    )
    update.add_argument(
        "--offline",
        action="store_true",
        help="Use only the verified local response cache; make no network requests.",
    )
    update.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    update.add_argument("--schema-dir", type=Path, default=DEFAULT_SCHEMA_DIR)
    update.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE_DIR)

    validate = subparsers.add_parser(
        "validate",
        help="Validate canonical JSON against schemas and cross-file references.",
    )
    validate.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    validate.add_argument("--schema-dir", type=Path, default=DEFAULT_SCHEMA_DIR)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    try:
        if args.command == "update":
            result = update_dataset(
                offline=args.offline,
                source=args.source,
                data_dir=args.data_dir,
                schema_dir=args.schema_dir,
                cache_dir=args.cache_dir,
            )
            print(result.format())
            return 0 if result.validation.ok else 1
        if args.command == "validate":
            result = validate_dataset(args.data_dir, args.schema_dir)
            print(result.format())
            return 0 if result.ok else 1
    except (FetchError, OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 2
