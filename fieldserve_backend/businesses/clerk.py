"""Small Clerk Backend API client for organisation membership management."""

from __future__ import annotations

import requests
from django.conf import settings


class ClerkAPIError(Exception):
    def __init__(self, message: str, *, code: str = ""):
        super().__init__(message)
        self.code = code


def _request(method: str, path: str, payload: dict | None = None) -> dict:
    secret = getattr(settings, "CLERK_SECRET_KEY", "")
    if not secret:
        raise ClerkAPIError("CLERK_SECRET_KEY is not configured.")
    try:
        response = requests.request(
            method,
            f"https://api.clerk.com/v1/{path.lstrip('/')}",
            headers={"Authorization": f"Bearer {secret}"},
            json=payload,
            timeout=10,
        )
        response.raise_for_status()
        return response.json() if response.content else {}
    except requests.HTTPError as exc:
        try:
            error = exc.response.json()["errors"][0]
            raise ClerkAPIError(
                error.get("long_message") or error.get("message") or "Clerk organisation request failed.",
                code=error.get("code", ""),
            ) from exc
        except (KeyError, TypeError, ValueError):
            raise ClerkAPIError("Clerk organisation request failed.") from exc
    except (requests.RequestException, ValueError) as exc:
        raise ClerkAPIError("Clerk organisation request failed.") from exc


def create_organization_invitation(
    organization_id: str, inviter_user_id: str, email: str, role: str
) -> dict:
    clerk_role = "org:admin" if role == "admin" else "org:member"
    payload = {
        "email_address": email,
        "inviter_user_id": inviter_user_id,
        "role": clerk_role,
    }
    return _request(
        "POST",
        f"organizations/{organization_id}/invitations",
        payload,
    )


def get_organization(organization_id: str) -> dict:
    return _request("GET", f"organizations/{organization_id}")


def update_organization_membership(organization_id: str, user_id: str, role: str) -> None:
    clerk_role = "org:admin" if role == "admin" else "org:member"
    _request(
        "PATCH",
        f"organizations/{organization_id}/memberships/{user_id}",
        {"role": clerk_role},
    )


def delete_organization_membership(organization_id: str, user_id: str) -> None:
    _request("DELETE", f"organizations/{organization_id}/memberships/{user_id}")


def revoke_organization_invitation(organization_id: str, invitation_id: str, requester_id: str) -> None:
    _request(
        "POST",
        f"organizations/{organization_id}/invitations/{invitation_id}/revoke",
        {"requesting_user_id": requester_id},
    )