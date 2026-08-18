"""
Clerk JWT authentication for DRF.

Verifies Bearer tokens issued by Clerk against the configured JWKS endpoint,
then get-or-creates a local User row keyed by `clerk_user_id` (= JWT `sub`).
The Clerk webhook handler keeps profile fields fresh; this class is a fallback
so the first authenticated request after a fresh sign-up still works.
"""

from __future__ import annotations

import time
from typing import Any

import jwt
import requests
from django.conf import settings
from jwt import PyJWKClient
from rest_framework import authentication, exceptions

from .models import User

_JWK_CLIENT: PyJWKClient | None = None
_JWK_CACHED_AT: float = 0.0
_JWK_TTL_SECONDS = 60 * 60  # rotate cache hourly


def _get_jwk_client() -> PyJWKClient:
    global _JWK_CLIENT, _JWK_CACHED_AT
    now = time.time()
    if _JWK_CLIENT is None or (now - _JWK_CACHED_AT) > _JWK_TTL_SECONDS:
        jwks_url = settings.CLERK_JWKS_URL
        if not jwks_url:
            raise exceptions.AuthenticationFailed("CLERK_JWKS_URL not configured")
        _JWK_CLIENT = PyJWKClient(jwks_url)
        _JWK_CACHED_AT = now
    return _JWK_CLIENT


def _get_clerk_profile(clerk_id: str) -> dict[str, str]:
    secret_key = getattr(settings, "CLERK_SECRET_KEY", "")
    if not secret_key:
        return {}
    try:
        response = requests.get(
            f"https://api.clerk.com/v1/users/{clerk_id}",
            headers={"Authorization": f"Bearer {secret_key}"},
            timeout=5,
        )
        response.raise_for_status()
        data = response.json()
    except (requests.RequestException, ValueError):
        return {}

    email_addresses = data.get("email_addresses") or []
    primary_email_id = data.get("primary_email_address_id")
    email = next(
        (
            item.get("email_address", "")
            for item in email_addresses
            if item.get("id") == primary_email_id
        ),
        email_addresses[0].get("email_address", "") if email_addresses else "",
    )
    return {
        "email": email,
        "first_name": data.get("first_name") or "",
        "last_name": data.get("last_name") or "",
        "avatar_url": data.get("image_url") or "",
    }


class ClerkJWTAuthentication(authentication.BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode("latin-1")
        if not header:
            return None
        parts = header.split()
        if len(parts) != 2 or parts[0].lower() != self.keyword.lower():
            return None
        token = parts[1]
        payload = self._decode(token)
        user = self._user_from_payload(payload)
        return (user, payload)

    def authenticate_header(self, request):
        return f'{self.keyword} realm="api"'

    def _decode(self, token: str) -> dict[str, Any]:
        try:
            signing_key = _get_jwk_client().get_signing_key_from_jwt(token).key
            options = {"verify_aud": False}
            kwargs: dict[str, Any] = {}
            if getattr(settings, "CLERK_ISSUER", ""):
                kwargs["issuer"] = settings.CLERK_ISSUER
            return jwt.decode(
                token,
                signing_key,
                algorithms=["RS256"],
                options=options,
                **kwargs,
            )
        except jwt.ExpiredSignatureError as exc:
            raise exceptions.AuthenticationFailed("Token expired") from exc
        except (jwt.InvalidTokenError, requests.RequestException) as exc:
            raise exceptions.AuthenticationFailed(f"Invalid token: {exc}") from exc

    def _user_from_payload(self, payload: dict[str, Any]) -> User:
        clerk_id = payload.get("sub")
        if not clerk_id:
            raise exceptions.AuthenticationFailed("Token missing sub claim")

        email = (
            payload.get("email")
            or payload.get("primary_email_address")
            or ""
        )
        defaults = {
            "username": clerk_id,
            "email": email,
            "first_name": payload.get("given_name") or payload.get("first_name") or "",
            "last_name": payload.get("family_name") or payload.get("last_name") or "",
        }
        if not defaults["email"] or not defaults["first_name"] or not defaults["last_name"]:
            clerk_profile = _get_clerk_profile(clerk_id)
            defaults.update({key: value for key, value in clerk_profile.items() if value})
        user, created = User.objects.get_or_create(
            clerk_user_id=clerk_id, defaults=defaults
        )
        if not created:
            updates: dict[str, Any] = {}
            for field in ("email", "first_name", "last_name", "avatar_url"):
                value = defaults.get(field)
                if value and getattr(user, field) != value:
                    updates[field] = value
            if updates:
                User.objects.filter(pk=user.pk).update(**updates)
                for k, v in updates.items():
                    setattr(user, k, v)
        return user
