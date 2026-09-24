import pytest

from businesses.models import Membership


pytestmark = pytest.mark.django_db


def test_owner_can_be_assigned_a_service(api_client_auth, business, service, user):
    membership = Membership.objects.get(business=business, user=user)

    response = api_client_auth.patch(
        f"/api/businesses/{business.id}/members/{membership.id}/",
        {"services": [service.id]},
        format="json",
    )

    assert response.status_code == 200, response.data
    assert response.data["services"] == [service.id]
    membership.refresh_from_db()
    assert list(membership.services.values_list("id", flat=True)) == [service.id]