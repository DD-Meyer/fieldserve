from datetime import datetime

import pytest
from django.utils import timezone


pytestmark = pytest.mark.django_db


def scheduled_at(year: int, month: int, day: int):
    return timezone.make_aware(datetime(year, month, day, 9, 0))


def result_ids(response):
    return {job["id"] for job in response.data["results"]}


def test_list_jobs_filters_inclusive_date_range(api_client_auth, make_job):
    before = make_job(scheduled_at=scheduled_at(2026, 9, 1))
    first = make_job(scheduled_at=scheduled_at(2026, 9, 2))
    last = make_job(scheduled_at=scheduled_at(2026, 9, 30))
    after = make_job(scheduled_at=scheduled_at(2026, 10, 1))

    response = api_client_auth.get(
        "/api/jobs/",
        {"date_from": "2026-09-02", "date_to": "2026-09-30"},
    )

    assert response.status_code == 200
    assert result_ids(response) == {first.id, last.id}
    assert before.id not in result_ids(response)
    assert after.id not in result_ids(response)


def test_list_jobs_keeps_single_date_filter(api_client_auth, make_job):
    matching = make_job(scheduled_at=scheduled_at(2026, 9, 21))
    make_job(scheduled_at=scheduled_at(2026, 9, 22))

    response = api_client_auth.get("/api/jobs/", {"date": "2026-09-21"})

    assert response.status_code == 200
    assert result_ids(response) == {matching.id}


@pytest.mark.parametrize(
    "params",
    [
        {"date_from": "2026-09-01"},
        {"date_from": "2026-09-xx", "date_to": "2026-09-30"},
        {"date_from": "2026-09-30", "date_to": "2026-09-01"},
    ],
)
def test_list_jobs_rejects_invalid_date_range(api_client_auth, params):
    response = api_client_auth.get("/api/jobs/", params)

    assert response.status_code == 400
    assert "date_range" in response.data