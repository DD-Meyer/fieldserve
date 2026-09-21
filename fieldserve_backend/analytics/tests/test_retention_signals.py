from __future__ import annotations

from decimal import Decimal

import pytest
from django.utils import timezone

from analytics.models import ChurnScore, CustomerRetentionSignal
from businesses.models import Business
from users.models import Customer

pytestmark = pytest.mark.django_db


def _score(customer: Customer, probability: str = "0.8000") -> ChurnScore:
    return ChurnScore.objects.create(
        customer=customer,
        scored_at=timezone.now(),
        probability=Decimal(probability),
        risk_bucket=ChurnScore.RiskBucket.HIGH,
        model_version="test-version",
        model_name="test-model",
        feature_set="extended",
        feature_snapshot={"total_spend_12m": 1000},
    )


def test_retain_action_records_note_and_adjusts_latest_score(api_client_auth, customer):
    original = _score(customer)

    response = api_client_auth.post(
        f"/api/analytics/churn/scores/retain/{customer.id}/",
        {"status": "retained", "note": "Spoke to Ada; she is happy and booked for next month."},
        format="json",
    )

    assert response.status_code == 200, response.data
    signal = CustomerRetentionSignal.objects.get(customer=customer)
    assert signal.status == CustomerRetentionSignal.Status.RETAINED
    assert signal.source_score == original
    customer.refresh_from_db()
    assert "Spoke to Ada" in customer.notes

    adjusted = ChurnScore.objects.filter(customer=customer).latest("created_at")
    assert adjusted.probability == Decimal("0.2000")
    assert adjusted.risk_bucket == ChurnScore.RiskBucket.LOW
    assert adjusted.feature_snapshot["raw_model_probability"] == 0.8
    assert adjusted.feature_snapshot["manual_adjusted_probability"] == 0.2
    assert adjusted.feature_snapshot["manual_retention_signal_id"] == signal.id
    assert response.data["score"]["id"] == adjusted.id


def test_retain_action_rejects_other_business_customer(api_client_auth, business):
    other = Business.objects.create(owner=business.owner, name="Other", slug="other")
    foreign_customer = Customer.objects.create(business=other, full_name="Other Customer")

    response = api_client_auth.post(
        f"/api/analytics/churn/scores/retain/{foreign_customer.id}/",
        {"status": "retained", "note": "Not accessible"},
        format="json",
    )

    assert response.status_code == 404


def test_retain_action_requires_note(api_client_auth, customer):
    response = api_client_auth.post(
        f"/api/analytics/churn/scores/retain/{customer.id}/",
        {"status": "retained", "note": ""},
        format="json",
    )

    assert response.status_code == 400
    assert "note" in response.data
