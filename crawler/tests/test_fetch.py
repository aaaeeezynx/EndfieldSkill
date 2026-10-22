from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from crawler.fetch import FetchError, HttpFetcher, atomic_write_json, sha256_bytes


class HttpFetcherCacheTests(unittest.TestCase):
    def test_offline_fetch_uses_verified_cache_without_network(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            cache_dir = Path(temporary)
            cache_path = cache_dir / "response.json"
            payload = b'{"cached": true}'
            cache_path.write_bytes(payload)
            atomic_write_json(
                HttpFetcher._meta_path(cache_path),
                {
                    "url": "https://example.invalid/data",
                    "fetchedAt": "2026-01-01T00:00:00Z",
                    "sha256": sha256_bytes(payload),
                },
            )
            fetcher = HttpFetcher(cache_dir, offline=True)

            result = fetcher.fetch(
                "https://example.invalid/data",
                cache_path,
                required=True,
            )

            self.assertTrue(result.from_cache)
            self.assertEqual(payload, result.data)

    def test_offline_fetch_rejects_cache_with_bad_hash(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            cache_dir = Path(temporary)
            cache_path = cache_dir / "response.json"
            cache_path.write_bytes(b"changed")
            atomic_write_json(
                HttpFetcher._meta_path(cache_path),
                {"sha256": sha256_bytes(b"original")},
            )
            fetcher = HttpFetcher(cache_dir, offline=True)

            with self.assertRaises(FetchError):
                fetcher.fetch(
                    "https://example.invalid/data",
                    cache_path,
                    required=True,
                )

    def test_rate_limit_sleeps_for_remaining_interval(self) -> None:
        fetcher = HttpFetcher(Path("unused"), min_interval_seconds=1.2)
        fetcher._last_request_at = 10.0
        with (
            patch("crawler.fetch.time.monotonic", return_value=10.5),
            patch("crawler.fetch.time.sleep") as sleep,
        ):
            fetcher._wait_for_rate_limit()

        sleep.assert_called_once()
        self.assertAlmostEqual(sleep.call_args.args[0], 0.7)


if __name__ == "__main__":
    unittest.main()
