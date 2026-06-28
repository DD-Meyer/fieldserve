"""Source of truth for the churn-model feature contract.

This module defines the feature names and order used everywhere:
    - the training notebook (`ml_service/models/01_churn (1).ipynb`)
    - the FastAPI serving endpoint (`ml_service/routers/churn.py`)
    - the Django feature builder (`fieldserve_backend/analytics/services/feature_builder.py`)

Keeping the lists here (and importing them into the notebook) prevents the
classic "trained on 13 columns, served 3" failure mode.
"""

from __future__ import annotations

# RFM baseline (used by the LR-RFM comparison model, not the production bundle).
RFM_FEATURES: list[str] = [
    "recency_days",
    "freq_12m",
    "total_spend_12m",
]

# Extended feature set — the production model is trained on these, in this order.
# Order matters: the saved sklearn Pipeline was fit on a numpy array, so column
# order is the only thing that lines the coefficients up correctly.
EXT_FEATURES: list[str] = [
    "recency_days",
    "tenure_days",
    "freq_12m",
    "freq_3m",
    "avg_inter_booking_gap",
    "inter_booking_gap_std",
    "total_spend_12m",
    "avg_ticket",
    "monetary_trend",
    "spend_per_visit_std",
    "spend_per_visit_cv",
    "cancellation_rate",
    "unique_item_types",
    "total_units",
    "weekend_share",
    "evening_share",
    "is_uk",
]


# Short human-readable descriptions used for OpenAPI / Swagger field docs.
FEATURE_DESCRIPTIONS: dict[str, str] = {
    "recency_days": "Days since the customer's most recent booking (as of `as_of`).",
    "tenure_days": "Days since the customer's first booking.",
    "freq_12m": "Number of bookings in the last 12 months.",
    "freq_3m": "Number of bookings in the last 3 months.",
    "avg_inter_booking_gap": "Mean gap (days) between consecutive bookings.",
    "inter_booking_gap_std": "Std-dev of gaps (days) between consecutive bookings.",
    "total_spend_12m": "Sum of invoice amounts over the last 12 months.",
    "avg_ticket": "Mean invoice amount per booking.",
    "monetary_trend": "Slope of a linear fit through the last 6 invoice amounts.",
    "spend_per_visit_std": "Std-dev of per-booking invoice amounts.",
    "spend_per_visit_cv": "Coefficient of variation of per-booking invoice amounts.",
    "cancellation_rate": "Fraction of bookings cancelled (0..1).",
    "unique_item_types": "Average number of distinct services per booking.",
    "total_units": "Total units / line items across all bookings.",
    "weekend_share": "Fraction of bookings made on Sat/Sun (0..1).",
    "evening_share": "Fraction of bookings made at hour >= 17 (0..1).",
    "is_uk": "1 if customer is UK-based, else 0.",
}
