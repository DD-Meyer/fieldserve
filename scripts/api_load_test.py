from __future__ import annotations

import argparse
import json
import os
import platform
import statistics
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("--requests", type=int, default=100)
    parser.add_argument("--concurrency", type=int, default=10)
    parser.add_argument("--timeout", type=float, default=10.0)
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round((len(ordered) - 1) * fraction)))
    return ordered[index]


def request_once(url: str, timeout: float, request_number: int) -> dict:
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "FieldServe-report-load-test/1.0",
            "X-Forwarded-For": f"198.51.100.{request_number % 250 + 1}",
        },
    )
    started = time.perf_counter()
    try:
        with urlopen(request, timeout=timeout) as response:
            body = response.read()
            return {
                "status": response.status,
                "latency_ms": (time.perf_counter() - started) * 1000,
                "bytes": len(body),
                "error": None,
            }
    except HTTPError as exc:
        exc.read()
        return {
            "status": exc.code,
            "latency_ms": (time.perf_counter() - started) * 1000,
            "bytes": 0,
            "error": str(exc),
        }
    except (URLError, TimeoutError, OSError) as exc:
        return {
            "status": None,
            "latency_ms": (time.perf_counter() - started) * 1000,
            "bytes": 0,
            "error": str(exc),
        }


def main() -> None:
    args = parse_args()
    started_at = datetime.now(timezone.utc)
    wall_started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = [
            executor.submit(request_once, args.url, args.timeout, request_number)
            for request_number in range(args.requests)
        ]
        results = [future.result() for future in as_completed(futures)]
    duration_seconds = time.perf_counter() - wall_started

    successful = [result for result in results if result["status"] == 200]
    latencies = [result["latency_ms"] for result in successful]
    statuses: dict[str, int] = {}
    for result in results:
        key = str(result["status"] or "connection_error")
        statuses[key] = statuses.get(key, 0) + 1

    summary = {
        "timestamp_utc": started_at.isoformat(),
        "target": args.url,
        "request_mix": "100% GET public business detail",
        "environment": {
            "os": platform.platform(),
            "processor": platform.processor() or os.environ.get("PROCESSOR_IDENTIFIER", "unknown"),
            "python": platform.python_version(),
            "backend": "Django development server in Docker Desktop",
            "database": "PostgreSQL/PostGIS Docker service",
        },
        "requests": args.requests,
        "concurrency": args.concurrency,
        "duration_seconds": round(duration_seconds, 3),
        "throughput_requests_per_second": round(args.requests / duration_seconds, 2),
        "status_counts": statuses,
        "successful_requests": len(successful),
        "error_rate_percent": round((args.requests - len(successful)) / args.requests * 100, 3),
        "response_bytes_total": sum(result["bytes"] for result in results),
        "latency_ms": {
            "mean": round(statistics.fmean(latencies), 2) if latencies else None,
            "p50": round(percentile(latencies, 0.50), 2) if latencies else None,
            "p95": round(percentile(latencies, 0.95), 2) if latencies else None,
            "p99": round(percentile(latencies, 0.99), 2) if latencies else None,
            "max": round(max(latencies), 2) if latencies else None,
        },
        "errors": [result["error"] for result in results if result["error"]][:10],
    }

    output = args.output or Path("runs/load_tests") / (
        f"api_load_test_{started_at.strftime('%Y%m%dT%H%M%SZ')}.json"
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    print(f"Saved {output}")

    if len(successful) != args.requests:
        raise SystemExit(1)


if __name__ == "__main__":
    main()