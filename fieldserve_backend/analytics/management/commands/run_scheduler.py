"""Long-running scheduler that periodically triggers analytics maintenance.

Runs inside its own container (docker-compose `scheduler` service). Two loops:

- `score_churn` every N hours (default 24) to refresh recency-driven scores
  even when there's been no booking activity.
- `label_churn` once a day to close out matured churn windows so the retraining
  pipeline always has fresh labels.
- `retrain_churn` every N hours (default 24) after labels are generated, when
    enough unused labels have accumulated.
- `retrain_heatmap` every N hours (default 24) when enough geo-points are
    available to refresh the forecast bundle.
- `retrain_vehicle_damage` every N hours (default 168) when enough approved
    inspection annotations have accumulated.

Both invocations are best-effort; failures are logged and the loop continues.
Interval can be tuned via env: SCHEDULER_SCORE_INTERVAL_HOURS (default 24),
SCHEDULER_LABEL_INTERVAL_HOURS (default 24),
SCHEDULER_RETRAIN_INTERVAL_HOURS (default 24),
SCHEDULER_RETRAIN_MIN_SAMPLES (default 50), and
SCHEDULER_HEATMAP_RETRAIN_INTERVAL_HOURS (default 24),
SCHEDULER_HEATMAP_MIN_SAMPLES (default 20),
SCHEDULER_VISION_RETRAIN_INTERVAL_HOURS (default 168),
SCHEDULER_VISION_MIN_ANNOTATIONS (default 20),
SCHEDULER_INITIAL_DELAY_SECONDS (default 60, gives Django/ML time to boot on
first up).
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
        retrain_interval = _env_int("SCHEDULER_RETRAIN_INTERVAL_HOURS", 24) * 3600
        retrain_min_samples = _env_int("SCHEDULER_RETRAIN_MIN_SAMPLES", 50)
        heatmap_retrain_interval = _env_int("SCHEDULER_HEATMAP_RETRAIN_INTERVAL_HOURS", 24) * 3600
        heatmap_min_samples = _env_int("SCHEDULER_HEATMAP_MIN_SAMPLES", 20)
        vision_retrain_interval = _env_int("SCHEDULER_VISION_RETRAIN_INTERVAL_HOURS", 168) * 3600
        vision_min_annotations = _env_int("SCHEDULER_VISION_MIN_ANNOTATIONS", 20)

        self.stdout.write(
            self.style.NOTICE(
                f"scheduler: starting (score every {score_interval}s, "
                f"label every {label_interval}s, retrain every {retrain_interval}s, "
                f"minimum retrain samples {retrain_min_samples}, "
                f"heatmap retrain every {heatmap_retrain_interval}s, "
                f"minimum heatmap samples {heatmap_min_samples}, "
                f"vision retrain every {vision_retrain_interval}s, "
                f"minimum vision annotations {vision_min_annotations}, "
                f"initial delay {initial_delay}s)"
            )
        )

        # Initial delay so the DB and ML service have time to come up.
        self._sleep_or_stop(initial_delay, stop)

        next_score = time.monotonic()
        next_label = time.monotonic()
        next_retrain = time.monotonic()
        next_heatmap_retrain = time.monotonic()
        next_vision_retrain = time.monotonic()

        while not stop["flag"]:
            now = time.monotonic()
            if now >= next_score:
                self._safe_call("score_churn")
                next_score = now + score_interval
            if now >= next_label:
                self._safe_call("label_churn")
                next_label = now + label_interval
            if now >= next_retrain:
                self._run_retrain(retrain_min_samples)
                next_retrain = now + retrain_interval
            if now >= next_heatmap_retrain:
                self._run_heatmap_retrain(heatmap_min_samples)
                next_heatmap_retrain = now + heatmap_retrain_interval
            if now >= next_vision_retrain:
                self._run_vision_retrain(vision_min_annotations)
                next_vision_retrain = now + vision_retrain_interval

            # Wake up every 60s to check the stop flag and cadence.
            self._sleep_or_stop(60, stop)

        self.stdout.write("scheduler: exited cleanly")

    def _run_retrain(self, min_samples: int) -> None:
        self._safe_call(
            "retrain_churn",
            "--min-samples",
            str(max(1, min_samples)),
            "--triggered-by",
            "scheduler",
        )

    def _run_heatmap_retrain(self, min_samples: int) -> None:
        self._safe_call(
            "retrain_heatmap",
            "--min-samples",
            str(max(2, min_samples)),
        )

    def _run_vision_retrain(self, min_annotations: int) -> None:
        self._safe_call(
            "retrain_vehicle_damage",
            "--min-annotations",
            str(max(1, min_annotations)),
        )

    def _safe_call(self, name: str, *args: str) -> None:
        stamp = timezone.now().isoformat(timespec="seconds")
        self.stdout.write(f"scheduler [{stamp}] running: {name}")
        try:
            call_command(name, *args)
        except Exception as exc:  # noqa: BLE001
            self.stderr.write(
                self.style.WARNING(f"scheduler: {name} failed: {exc}")
            )

    def _sleep_or_stop(self, seconds: int, stop: dict) -> None:
        end = time.monotonic() + seconds
        while not stop["flag"] and time.monotonic() < end:
            time.sleep(min(1, max(0.1, end - time.monotonic())))
