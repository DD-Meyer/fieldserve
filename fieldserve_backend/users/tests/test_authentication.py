from unittest.mock import Mock, patch

from django.test import override_settings

from users.auth import ClerkJWTAuthentication, _allowed_issuers


@override_settings(
    CLERK_ISSUER="https://clerk.fieldserve.vercel.app",
    CLERK_JWKS_URL="https://fieldserve.vercel.app/__clerk/.well-known/jwks.json",
)
def test_allowed_issuers_include_canonical_and_proxy_urls():
    assert _allowed_issuers() == [
        "https://clerk.fieldserve.vercel.app",
        "https://fieldserve.vercel.app/__clerk",
    ]


@override_settings(
    CLERK_ISSUER="https://clerk.fieldserve.vercel.app",
    CLERK_JWKS_URL="https://fieldserve.vercel.app/__clerk/.well-known/jwks.json",
)
@patch("users.auth.jwt.decode")
@patch("users.auth._get_jwk_client")
def test_decode_accepts_only_configured_clerk_issuers(mock_jwk_client, mock_decode):
    mock_jwk_client.return_value.get_signing_key_from_jwt.return_value = Mock(
        key="public-key"
    )
    mock_decode.return_value = {"sub": "user_123"}

    payload = ClerkJWTAuthentication()._decode("session-token")

    assert payload == {"sub": "user_123"}
    assert mock_decode.call_args.kwargs["issuer"] == [
        "https://clerk.fieldserve.vercel.app",
        "https://fieldserve.vercel.app/__clerk",
    ]