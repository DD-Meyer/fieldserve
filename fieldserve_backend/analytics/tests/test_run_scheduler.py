"""Focused tests for scheduled analytics maintenance."""

from __future__ import annotations

from analytics.management.commands.run_scheduler import Command, _env_int


def test_env_int_uses_default_for_missing_or_invalid_values(monkeypatch):
    monkeypatch.delenv("SCHEDULER_TEST_VALUE", raising=False)
    assert _env_int("SCHEDULER_TEST_VALUE", 24) == 24

    monkeypatch.setenv("SCHEDULER_TEST_VALUE", "invalid")
    assert _env_int("SCHEDULER_TEST_VALUE", 24) == 24


def test_run_retrain_uses_scheduler_identity_and_minimum_sample_floor(monkeypatch):
    calls: list[tuple[str, tuple[str, ...]]] = []
    command = Command()
    monkeypatch.setattr(
        command,
        "_safe_call",
        lambda name, *args: calls.append((name, args)),
    )

    command._run_retrain(0)

    assert calls == [
        (
            "retrain_churn",
            ("--min-samples", "1", "--triggered-by", "scheduler"),
        )
    ]