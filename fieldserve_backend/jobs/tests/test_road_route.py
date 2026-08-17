from unittest.mock import Mock, patch

import pytest

pytestmark = pytest.mark.django_db


@patch("jobs.views.requests.get")
def test_road_route_returns_road_geometry(mock_get, api_client_auth):
    response = Mock()
    response.json.return_value = {
        "routes": [
            {
                "distance": 3250.0,
                "duration": 480.0,
                "geometry": {
                    "coordinates": [
                        [-0.1278, 51.5074],
                        [-0.1210, 51.5100],
                        [-0.1000, 51.5200],
                    ]
                },
                "legs": [
                    {"distance": 3250.0, "duration": 480.0},
                ],
            }
        ]
    }
    mock_get.return_value = response

    result = api_client_auth.post(
        "/api/jobs/road-route/",
        {
            "points": [
                {"latitude": 51.5074, "longitude": -0.1278},
                {"latitude": 51.5200, "longitude": -0.1000},
            ]
        },
        format="json",
    )

    assert result.status_code == 200
    assert result.data["path"][1] == {"latitude": 51.51, "longitude": -0.121}
    assert result.data["distance_km"] == 3.25
    assert result.data["duration_minutes"] == 8
    assert result.data["legs"] == [{"distance_km": 3.25, "duration_minutes": 8}]


def test_road_route_requires_at_least_two_points(api_client_auth):
    result = api_client_auth.post(
        "/api/jobs/road-route/",
        {"points": [{"latitude": 51.5, "longitude": -0.1}]},
        format="json",
    )

    assert result.status_code == 400