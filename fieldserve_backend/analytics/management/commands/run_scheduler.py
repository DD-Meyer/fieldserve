"""Long-running scheduler that periodically triggers analytics maintenance.

Runs inside its own container (docker-compose `scheduler` service). Two loops:

- `score_churn` every N hours (default 24) to refresh recency-driven scores
  even when there's been no booking activity.
- `label_churn` once a day to close out matured churn windows so the retraining
  pipeline always has fresh labels.

Both invocations are best-effort; failures are logged and the loop continues.
Interval can be tuned via env: SCHEDULER_SCORE_INTERVAL_HOURS (default 24),
SCHEDULER_LABEL_INTERVAL_HOURS (default 24), SCHEDULER_INITIAL_DELAY_SECONDS
(default 60, gives Django/ML time to boot on first up).
"""

from __future__ import annotations

import os
import signal
import time

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.utils import timezone


def _env_int(key: str, default: int) -> int:
    raw = os.environ.get(key)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


class Command(BaseCommand):
    help = "Long-running scheduler for periodic analytics jobs (scoring + labelling)."

    def handle(self, *args, **opts) -> None:
        stop = {"flag": False}

        def _handle(signum, _frame):
            self.stdout.write(f"scheduler: received signal {signum}, stopping…")
            stop["flag"] = True

        signal.signal(signal.SIGTERM, _handle)
        signal.signal(signal.SIGINT, _handle)

        initial_delay = _env_int("SCHEDULER_INITIAL_DELAY_SECONDS", 60)
        score_interval = _env_int("SCHEDULER_SCORE_INTERVAL_HOURS", 24) * 3600
        label_interval = _env_int("SCHEDULER_LABEL_INTERVAL_HOURS", 24) * 3600

        self.stdout.write(
            self.style.NOTICE(
                f"scheduler: starting (score every {score_interval}s, "
                f"label every {label_interval}s, initial delay {initial_delay}s)"
            )
        )

        # Initial delay so the DB and ML service have time to come up.
        self._sleep_or_stop(initial_delay, stop)

        next_score = time.monotonic()
        next_label = time.monotonic()

        while not stop["flag"]:
            now = time.monotonic()
            if now >= next_score:
                self._safe_call("score_churn")
                next_score = now + score_interval
            if now >= next_label:
                self._safe_call("label_churn")
                next_label = now + label_interval

            # Wake up every 60s to check the stop flag and cadence.
            self._sleep_or_stop(60, stop)

        self.stdout.write("scheduler: exited cleanly")

    def _safe_call(self, name: str) -> None:
        stamp = timezone.now().isoformat(timespec="seconds")
        self.stdout.write(f"scheduler [{stamp}] running: {name}")
        try:
            call_command(name)
        except Exception as exc:  # noqa: BLE001
            self.stderr.write(
                self.style.WARNING(f"scheduler: {name} failed: {exc}")
            )

    def _sleep_or_stop(self, seconds: int, stop: dict) -> None:
        end = time.monotonic() + seconds
        while not stop["flag"] and time.monotonic() < end:
            time.sleep(min(1, max(0.1, end - time.monotonic())))
