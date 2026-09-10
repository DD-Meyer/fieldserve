import pytest
from django.contrib.gis.geos import Point
from rest_framework.exceptions import ValidationError

from jobs.models import Job
from users.models import Customer
from users.serializers import CustomerSerializer

pytestmark = pytest.mark.django_db


def test_mobile_customer_requires_selected_location(business):
	serializer = CustomerSerializer(
		data={"full_name": "Grace Hopper", "address": "1 King's Cross, London"}
	)

	assert serializer.is_valid()
	with pytest.raises(ValidationError):
		serializer.validate_location_for_business(serializer.validated_data, business)


def test_fixed_customer_allows_missing_location(business):
	business.industry_mode = business.Industry.FIXED
	serializer = CustomerSerializer(data={"full_name": "Grace Hopper"})

	assert serializer.is_valid()
	serializer.validate_location_for_business(serializer.validated_data, business)


def test_customer_location_repair_backfills_unfinished_locationless_jobs(
	business, customer, disable_ml_signals
):
	unfinished = Job.objects.create(
		business=business,
		customer=customer,
		service_type="Wash",
		scheduled_at="2026-09-11T10:00:00Z",
		status=Job.Status.SCHEDULED,
	)
	completed = Job.objects.create(
		business=business,
		customer=customer,
		service_type="Wash",
		scheduled_at="2026-09-10T10:00:00Z",
		status=Job.Status.COMPLETED,
	)
	serializer = CustomerSerializer(
		customer,
		data={
			"address": "1 King's Cross, London, UK",
			"latitude": 51.5308,
			"longitude": -0.1238,
		},
		partial=True,
	)

	assert serializer.is_valid(), serializer.errors
	serializer.save()

	unfinished.refresh_from_db()
	completed.refresh_from_db()
	assert unfinished.location == Point(-0.1238, 51.5308, srid=4326)
	assert unfinished.address == "1 King's Cross, London, UK"
	assert completed.location is None
