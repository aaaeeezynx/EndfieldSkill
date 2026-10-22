from __future__ import annotations

import json
import os
import shutil
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .fetch import FetchError, HttpFetcher, atomic_write_json, utc_now
from .parsers import parse_all
from .sources import COMMUNITY_PAGE_FETCHES, SOURCE_IDS
from .validation import ValidationResult, require_valid_dataset


PACKAGE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PACKAGE_DIR.parent
DEFAULT_DATA_DIR = PROJECT_ROOT / "data" / "v1"
DEFAULT_SCHEMA_DIR = PROJECT_ROOT / "data" / "schemas"
DEFAULT_CACHE_DIR = PACKAGE_DIR / ".cache"

MANIFEST_URL = "https://data.akedata.wiki/manifest.json"
TABLE_BASE_URL = "https://data.akedata.wiki"
REQUIRED_TABLES = (
    "CharacterTable",
    "CharProfessionTable",
    "SkillPatchTable",
    "I18nTextTable_CN",
    "EquipTable",
    "ItemTable",
    "EquipSuitTable",
    "EquipFormulaTable",
    "EquipFormulaReverseTable",
    "EquipFormulaChainTable",
    "DomainDataTable",
)


@dataclass(frozen=True)
class UpdateResult:
    data_dir: Path
    generated_at: str
    manifest_id: str
    game_version: str
    validation: ValidationResult
    table_sources: dict[str, str]
    optional_source_errors: dict[str, str]

    def format(self) -> str:
        return "\n".join(
            [
                f"Updated {self.data_dir}",
                f"Manifest: {self.manifest_id}",
                f"Game version: {self.game_version}",
                f"Generated at: {self.generated_at}",
                self.validation.format(),
                *(
                    [f"Optional source warning: {key}: {value}" for key, value in self.optional_source_errors.items()]
                ),
            ]
        )


def _json_from_response(data: bytes, url: str) -> Any:
    try:
        return json.loads(data.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise FetchError(f"Invalid JSON from {url}: {exc}") from exc


def _select_manifest_version(manifest: dict[str, Any]) -> dict[str, Any]:
    required = ("id", "gameVersion", "tableCfgPath")
    if all(manifest.get(key) for key in required):
        return manifest

    versions = manifest.get("versions")
    if not isinstance(versions, list):
        versions = []
    latest = manifest.get("latest")
    selected = next(
        (
            item
            for item in versions
            if isinstance(item, dict) and item.get("id") == latest
        ),
        versions[0] if versions and isinstance(versions[0], dict) else None,
    )
    if selected is None:
        raise FetchError("AKEDatabase manifest has no usable version entry")

    missing = [key for key in required if not selected.get(key)]
    if missing:
        raise FetchError(f"AKEDatabase manifest is missing: {', '.join(missing)}")
    return selected


def _fetch_core_tables(
    fetcher: HttpFetcher,
    cache_dir: Path,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, dict[str, Any]]]:
    cache_root = cache_dir / "akedatabase"
    manifest_result = fetcher.fetch(
        MANIFEST_URL,
        cache_root / "manifest.json",
        required=True,
        accept="application/json",
    )
    manifest = _json_from_response(manifest_result.data, MANIFEST_URL)
    if not isinstance(manifest, dict):
        raise FetchError("AKEDatabase manifest root must be an object")
    manifest = _select_manifest_version(manifest)

    table_meta: dict[str, dict[str, Any]] = {}
    tables: dict[str, Any] = {}
    table_cfg_path = str(manifest["tableCfgPath"]).strip("/")
    for table_name in REQUIRED_TABLES:
        url = f"{TABLE_BASE_URL}/{table_cfg_path}/{table_name}.json"
        result = fetcher.fetch(
            url,
            cache_root / "tables" / f"{table_name}.json",
            required=True,
            accept="application/json",
        )
        table = _json_from_response(result.data, url)
        if not isinstance(table, dict):
            raise FetchError(f"AKE table {table_name} root must be an object")
        tables[table_name] = table
        table_meta[table_name] = {
            "fetchedAt": result.meta.get("fetchedAt"),
            "status": result.meta.get("status"),
            "sha256": result.meta.get("sha256"),
            "bytes": result.meta.get("bytes"),
            "fromCache": result.from_cache,
            "url": url,
        }

    fetch_meta = {
        SOURCE_IDS["akedatabase"]: {
            **manifest_result.meta,
            "fetchedAt": manifest_result.meta.get("fetchedAt"),
            "fetchStatus": (
                "cache"
                if manifest_result.from_cache
                and all(item["fromCache"] for item in table_meta.values())
                else "fetched"
            ),
            "fromCache": manifest_result.from_cache,
            "tableFetch": table_meta,
        }
    }
    return tables, manifest, fetch_meta


def _fetch_optional_sources(
    fetcher: HttpFetcher,
    cache_dir: Path,
    fetch_meta: dict[str, dict[str, Any]],
) -> dict[str, str]:
    optional_errors: dict[str, str] = {}
    sources_cache = cache_dir / "akedatabase" / "sources"
    for key, (url, relative_path) in COMMUNITY_PAGE_FETCHES.items():
        source_id = SOURCE_IDS[key]
        cache_path = sources_cache / Path(relative_path).name
        try:
            result = fetcher.fetch(
                url,
                cache_path,
                required=False,
                accept="text/html,application/xhtml+xml",
            )
            fetch_meta[source_id] = {
                **result.meta,
                "fetchStatus": (
                    result.meta.get("accessStatus", "cached")
                    if result.from_cache
                    else "fetched"
                ),
                "fromCache": result.from_cache,
            }
        except FetchError as exc:
            optional_errors[key] = str(exc)
            fetch_meta[source_id] = {
                "fetchedAt": None,
                "fetchStatus": "unavailable",
                "fromCache": None,
                "fetchError": str(exc),
            }
    return optional_errors


def _write_stage(dataset: dict[str, Any], data_dir: Path) -> Path:
    stage = data_dir / f".v1-stage-{os.getpid()}-{int(time.time() * 1000)}"
    stage.mkdir(parents=True, exist_ok=False)
    for filename, value in dataset.items():
        atomic_write_json(stage / f"{filename}.json", value)
    return stage


def _safe_remove_tree(path: Path, allowed_root: Path) -> None:
    resolved_path = path.resolve()
    resolved_root = allowed_root.resolve()
    if resolved_path == resolved_root or not resolved_path.is_relative_to(resolved_root):
        raise RuntimeError(f"Refusing to remove path outside data directory: {path}")
    if path.exists():
        shutil.rmtree(path)


def _replace_dataset(stage: Path, target: Path, data_root: Path) -> None:
    backup = data_root / f".v1-backup-{os.getpid()}-{int(time.time() * 1000)}"
    moved_old = False
    try:
        if target.exists():
            target.replace(backup)
            moved_old = True
        stage.replace(target)
    except Exception:
        if not target.exists() and moved_old and backup.exists():
            backup.replace(target)
        raise
    finally:
        if backup.exists():
            _safe_remove_tree(backup, data_root)


def update_dataset(
    *,
    offline: bool = False,
    source: str = "all",
    data_dir: Path | str = DEFAULT_DATA_DIR,
    schema_dir: Path | str = DEFAULT_SCHEMA_DIR,
    cache_dir: Path | str = DEFAULT_CACHE_DIR,
    fetcher: HttpFetcher | None = None,
) -> UpdateResult:
    """Fetch/cache game tables and atomically replace the canonical dataset.

    The target data directory is never modified unless all required data has
    been fetched, parsed, written to a staging directory, and schema-validated.
    """

    if source not in {"all", "akedatabase"}:
        raise ValueError("source must be 'all' or 'akedatabase'")
    data_dir = Path(data_dir)
    schema_dir = Path(schema_dir)
    cache_dir = Path(cache_dir)
    data_root = data_dir.parent
    data_root.mkdir(parents=True, exist_ok=True)

    http = fetcher or HttpFetcher(cache_dir, offline=offline)
    stage: Path | None = None
    try:
        tables, manifest, fetch_meta = _fetch_core_tables(http, cache_dir)
        optional_errors: dict[str, str] = {}
        if source == "all":
            optional_errors = _fetch_optional_sources(http, cache_dir, fetch_meta)
        dataset = parse_all(tables, manifest=manifest, fetch_meta=fetch_meta)
        stage = _write_stage(dataset, data_root)
        validation = require_valid_dataset(stage, schema_dir)
        _replace_dataset(stage, data_dir, data_root)
        stage = None
        return UpdateResult(
            data_dir=data_dir,
            generated_at=str(dataset["meta"]["generatedAt"]),
            manifest_id=str(manifest["id"]),
            game_version=str(manifest["gameVersion"]),
            validation=validation,
            table_sources={
                name: str(meta.get("url"))
                for name, meta in fetch_meta[SOURCE_IDS["akedatabase"]][
                    "tableFetch"
                ].items()
            },
            optional_source_errors=optional_errors,
        )
    finally:
        if stage is not None and stage.exists():
            _safe_remove_tree(stage, data_root)
