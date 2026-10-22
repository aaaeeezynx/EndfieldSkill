from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from crawler.fetch import FetchError, FetchResult
from crawler.pipeline import MANIFEST_URL, _select_manifest_version, update_dataset


class StaticFetcher:
    def __init__(self) -> None:
        self.calls = 0

    def fetch(self, url: str, cache_path: Path, **kwargs: object) -> FetchResult:
        self.calls += 1
        if url == MANIFEST_URL:
            payload = {
                "latest": "test-version",
                "versions": [
                    {
                        "id": "test-version",
                        "gameVersion": "1.0",
                        "hotfixVersion": "1",
                        "tableCfgPath": "public/test/TableCfg",
                    }
                ],
            }
        else:
            payload = {}
        return FetchResult(
            data=json.dumps(payload).encode("utf-8"),
            meta={"status": 200, "fetchedAt": "2026-01-01T00:00:00Z"},
            from_cache=False,
        )


class PipelineTests(unittest.TestCase):
    def test_selects_current_manifest_version(self) -> None:
        selected = _select_manifest_version(
            {
                "latest": "v2",
                "versions": [
                    {"id": "v1", "gameVersion": "1.0", "tableCfgPath": "a"},
                    {"id": "v2", "gameVersion": "2.0", "tableCfgPath": "b"},
                ],
            }
        )

        self.assertEqual("v2", selected["id"])
        self.assertEqual("b", selected["tableCfgPath"])

    def test_validation_failure_keeps_existing_dataset(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            data_dir = root / "data" / "v1"
            data_dir.mkdir(parents=True)
            sentinel = data_dir / "sentinel.txt"
            sentinel.write_text("keep", encoding="utf-8")

            with patch("crawler.pipeline.parse_all", return_value={}):
                with self.assertRaises(ValueError):
                    update_dataset(
                        source="akedatabase",
                        data_dir=data_dir,
                        schema_dir=root / "schemas",
                        cache_dir=root / "cache",
                        fetcher=StaticFetcher(),
                    )

            self.assertEqual("keep", sentinel.read_text(encoding="utf-8"))
            self.assertFalse(list(data_dir.parent.glob(".v1-stage-*")))

    def test_fetch_failure_keeps_existing_dataset(self) -> None:
        class FailingFetcher:
            def fetch(self, *args: object, **kwargs: object) -> FetchResult:
                raise FetchError("network unavailable")

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            data_dir = root / "data" / "v1"
            data_dir.mkdir(parents=True)
            sentinel = data_dir / "sentinel.txt"
            sentinel.write_text("keep", encoding="utf-8")

            with self.assertRaises(FetchError):
                update_dataset(
                    source="akedatabase",
                    data_dir=data_dir,
                    schema_dir=root / "schemas",
                    cache_dir=root / "cache",
                    fetcher=FailingFetcher(),
                )

            self.assertEqual("keep", sentinel.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
