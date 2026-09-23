import pytest

from businesses.models import Membership
from users.models import Notification, User
from users.notifications import notify_business_members

pytestmark = pytest.mark.django_db


def test_notify_business_members_only_reaches_active_members(business, user):
    staff = User.objects.create_user(
        username="staff",
        email="staff@example.com",
        clerk_user_id="clerk_staff",
    )
    Membership.objects.create(
        business=business,
        user=staff,
        role=Membership.Role.STAFF,
        status=Membership.Status.ACTIVE,
    )
    inactive = User.objects.create_user(
        username="inactive",
        email="inactive@example.com",
        clerk_user_id="clerk_inactive",
    )
    Membership.objects.create(
        business=business,
        user=inactive,
        role=Membership.Role.STAFF,
        status=Membership.Status.INACTIVE,
    )

    notify_business_members(
        business,
        title="Booking updated",
        message="A booking changed.",
    )

    assert set(Notification.objects.values_list("user_id", flat=True)) == {
        user.id,
        staff.id,
    }
    assert not Notification.objects.filter(user=inactive).exists()


def test_notification_api_scopes_reads_and_supports_archive_and_read(api_client_auth, user):
    active = Notification.objects.create(user=user, title="Active")
    archived = Notification.objects.create(user=user, title="Archived", archived=True)

    response = api_client_auth.get("/api/notifications/")
    assert response.status_code == 200
    assert [row["id"] for row in response.data["results"]] == [active.id]

    archived_response = api_client_auth.get("/api/notifications/?archived=true")
    assert archived_response.status_code == 200
    assert [row["id"] for row in archived_response.data["results"]] == [archived.id]

    update = api_client_auth.patch(
        f"/api/notifications/{active.id}/",
        {"read": True, "archived": True},
        format="json",
    )
    assert update.status_code == 200
    assert update.data["read"] is True
    assert update.data["archived"] is True
