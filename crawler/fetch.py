from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0 Safari/537.36 EndfieldSkill/1.0"
)


class FetchError(RuntimeError):
    """Raised when a required response is unavailable."""


@dataclass(frozen=True)
class FetchResult:
    data: bytes
    meta: dict[str, Any]
    from_cache: bool


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def atomic_write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        temporary.write_bytes(data)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def atomic_write_json(path: Path, value: Any) -> None:
    payload = json.dumps(
        value,
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
    ).encode("utf-8")
    atomic_write_bytes(path, payload + b"\n")


class HttpFetcher:
    """Small standard-library HTTP client with raw cache and polite retries."""

    def __init__(
        self,
        cache_dir: Path,
        *,
        offline: bool = False,
        timeout_seconds: float = 25.0,
        retries: int = 3,
        min_interval_seconds: float = 1.2,
        user_agent: str = DEFAULT_USER_AGENT,
    ) -> None:
        self.cache_dir = cache_dir
        self.offline = offline
        self.timeout_seconds = timeout_seconds
        self.retries = max(1, retries)
        self.min_interval_seconds = max(0.0, min_interval_seconds)
        self.user_agent = user_agent
        self._last_request_at = 0.0

    @staticmethod
    def _meta_path(cache_path: Path) -> Path:
        return cache_path.with_name(f"{cache_path.name}.meta.json")

    def _read_cached(self, cache_path: Path) -> FetchResult | None:
        meta_path = self._meta_path(cache_path)
        if not cache_path.is_file() or not meta_path.is_file():
            return None
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return None
        data = cache_path.read_bytes()
        if meta.get("sha256") != sha256_bytes(data):
            return None
        return FetchResult(data=data, meta=meta, from_cache=True)

    def _wait_for_rate_limit(self) -> None:
        remaining = self.min_interval_seconds - (time.monotonic() - self._last_request_at)
        if remaining > 0:
            time.sleep(remaining)

    def _curl_fallback(
        self,
        url: str,
        cache_path: Path,
        *,
        accept: str,
    ) -> FetchResult | None:
        """Retry through curl when urllib is blocked by a site edge policy."""

        curl = shutil.which("curl")
        if not curl:
            return None
        temporary = cache_path.with_name(
            f".{cache_path.name}.{os.getpid()}.curl.tmp"
        )
        temporary.parent.mkdir(parents=True, exist_ok=True)
        write_format = "%{http_code}\n%{content_type}\n%{url_effective}"
        command = [
            curl,
            "--location",
            "--fail",
            "--silent",
            "--show-error",
            "--max-time",
            str(max(1, int(self.timeout_seconds))),
            "--user-agent",
            self.user_agent,
            "--header",
            f"Accept: {accept}",
            "--output",
            str(temporary),
            "--write-out",
            write_format,
            url,
        ]
        try:
            completed = subprocess.run(
                command,
                check=False,
                capture_output=True,
                timeout=self.timeout_seconds + 5,
            )
            if completed.returncode != 0:
                message = completed.stderr.decode("utf-8", errors="replace").strip()
                raise FetchError(f"curl fallback failed for {url}: {message}")
            output = completed.stdout.decode("utf-8", errors="replace").splitlines()
            if len(output) < 3:
                raise FetchError(f"curl fallback returned incomplete metadata for {url}")
            status = int(output[-3])
            content_type = output[-2]
            final_url = output[-1]
            data = temporary.read_bytes()
            if not data:
                raise FetchError(f"Empty response from {url}")
            fetched_at = utc_now()
            meta: dict[str, Any] = {
                "url": url,
                "finalUrl": final_url,
                "status": status,
                "contentType": content_type,
                "fetchedAt": fetched_at,
                "sha256": sha256_bytes(data),
                "bytes": len(data),
                "transport": "curl-fallback",
            }
            atomic_write_bytes(cache_path, data)
            atomic_write_json(self._meta_path(cache_path), meta)
            self._last_request_at = time.monotonic()
            return FetchResult(data=data, meta=meta, from_cache=False)
        except (OSError, ValueError, subprocess.SubprocessError) as exc:
            if isinstance(exc, FetchError):
                raise
            raise FetchError(f"curl fallback failed for {url}: {exc}") from exc
        finally:
            temporary.unlink(missing_ok=True)

    def fetch(
        self,
        url: str,
        cache_path: Path,
        *,
        required: bool = True,
        accept: str = "*/*",
    ) -> FetchResult:
        cache_path = Path(cache_path)
        cached = self._read_cached(cache_path)
        if self.offline:
            if cached is not None:
                return cached
            if required:
                raise FetchError(f"Offline cache miss for {url}: {cache_path}")
            raise FetchError(f"Offline cache miss for optional source {url}")

        last_error: Exception | None = None
        for attempt in range(1, self.retries + 1):
            try:
                self._wait_for_rate_limit()
                request = Request(
                    url,
                    headers={
                        "User-Agent": self.user_agent,
                        "Accept": accept,
                        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.7",
                    },
                )
                with urlopen(request, timeout=self.timeout_seconds) as response:
                    data = response.read()
                    status = int(response.status)
                    content_type = response.headers.get("Content-Type", "")
                    final_url = response.geturl()
                self._last_request_at = time.monotonic()
                if not data:
                    raise FetchError(f"Empty response from {url}")

                fetched_at = utc_now()
                meta: dict[str, Any] = {
                    "url": url,
                    "finalUrl": final_url,
                    "status": status,
                    "contentType": content_type,
                    "fetchedAt": fetched_at,
                    "sha256": sha256_bytes(data),
                    "bytes": len(data),
                }
                atomic_write_bytes(cache_path, data)
                atomic_write_json(self._meta_path(cache_path), meta)
                return FetchResult(data=data, meta=meta, from_cache=False)
            except (HTTPError, URLError, TimeoutError, OSError, FetchError) as exc:
                self._last_request_at = time.monotonic()
                last_error = exc
                if attempt < self.retries:
                    time.sleep(min(2 ** (attempt - 1), 4))

        try:
            self._wait_for_rate_limit()
            curl_result = self._curl_fallback(url, cache_path, accept=accept)
            if curl_result is not None:
                return curl_result
        except (OSError, FetchError) as exc:
            last_error = exc

        if cached is not None:
            fallback_meta = dict(cached.meta)
            fallback_meta["accessStatus"] = "stale-cache-after-error"
            fallback_meta["lastError"] = str(last_error)
            fallback_meta["lastAttemptAt"] = utc_now()
            return FetchResult(data=cached.data, meta=fallback_meta, from_cache=True)
        if required:
            raise FetchError(f"Failed to fetch {url}: {last_error}") from last_error
        raise FetchError(f"Optional source unavailable {url}: {last_error}") from last_error

