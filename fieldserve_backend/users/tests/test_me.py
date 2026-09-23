import pytest

from users.models import User


pytestmark = pytest.mark.django_db


def test_me_returns_and_updates_user_preferences(api_client_auth, user):
    response = api_client_auth.get("/api/auth/me/")

    assert response.status_code == 200
    assert response.data["push_notifications_enabled"] is True
    assert response.data["text_size"] == "default"

    update = api_client_auth.patch(
        "/api/auth/me/",
        {
            "push_notifications_enabled": False,
            "email_notifications_enabled": False,
            "dark_mode_enabled": True,
            "background_location_enabled": False,
            "text_size": "large",
            "quiet_hours_start": "22:00:00",
            "quiet_hours_end": "07:00:00",
        },
        format="json",
    )

    assert update.status_code == 200
    user.refresh_from_db()
    assert user.push_notifications_enabled is False
    assert user.email_notifications_enabled is False
    assert user.dark_mode_enabled is True
    assert user.background_location_enabled is False
    assert user.text_size == User.TextSize.LARGE
    assert str(user.quiet_hours_start) == "22:00:00"
    assert str(user.quiet_hours_end) == "07:00:00"


def test_me_rejects_incomplete_quiet_hours(api_client_auth):
    response = api_client_auth.patch(
        "/api/auth/me/",
        {"quiet_hours_start": "22:00:00", "quiet_hours_end": None},
        format="json",
    )

    assert response.status_code == 400