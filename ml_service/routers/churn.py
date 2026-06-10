"""Customer churn prediction router.

Stage 1 implementation: heuristic RFM scoring (Recency, Frequency, Monetary).
A trained classifier (LR / RF / XGBoost) will replace `_score_rfm` once the
labelled dataset is available — the request/response contract stays the same.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List

import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(tags=["churn"])


class CustomerRFM(BaseModel):
    customer_id: int
    last_job_at: datetime | None = Field(
        None, description="ISO timestamp of the customer's most recent job"
    )
    job_count: int = Field(0, ge=0)
    total_spend: float = Field(0.0, ge=0.0)


class ChurnRequest(BaseModel):
    as_of: datetime | None = None
    customers: List[CustomerRFM]


class ChurnPrediction(BaseModel):
    customer_id: int
    probability: float
    recency_days: int | None
    rfm_score: int


class ChurnResponse(BaseModel):
    as_of: datetime
    predictions: List[ChurnPrediction]


def _quintile_rank(values: np.ndarray, reverse: bool = False) -> np.ndarray:
    """Rank into 1..5 buckets. `reverse=True` gives higher rank for smaller values."""
    if values.size == 0:
        return values.astype(int)
    order = values.argsort()
    ranks = np.empty_like(order)
    ranks[order] = np.arange(values.size)
    bucketed = np.floor(ranks / max(values.size, 1) * 5).astype(int) + 1
    bucketed = np.clip(bucketed, 1, 5)
    return 6 - bucketed if reverse else bucketed


def _score_rfm(req: ChurnRequest) -> ChurnResponse:
    as_of = req.as_of or datetime.now(timezone.utc)
    n = len(req.customers)
    if n == 0:
        return ChurnResponse(as_of=as_of, predictions=[])

    recency = np.array(
        [
            (as_of - c.last_job_at).days if c.last_job_at else 365
            for c in req.customers
        ],
        dtype=float,
    )
    frequency = np.array([c.job_count for c in req.customers], dtype=float)
    monetary = np.array([c.total_spend for c in req.customers], dtype=float)

    r_rank = _quintile_rank(recency, reverse=True)
    f_rank = _quintile_rank(frequency)
    m_rank = _quintile_rank(monetary)
    rfm = r_rank + f_rank + m_rank  # 3..15

    # Map RFM (higher is better) to churn probability (lower is better).
    prob = 1 - (rfm - 3) / 12
    prob = np.clip(prob, 0.01, 0.99)

    predictions = [
        ChurnPrediction(
            customer_id=c.customer_id,
            probability=float(round(prob[i], 4)),
            recency_days=int(recency[i]) if c.last_job_at else None,
            rfm_score=int(rfm[i]),
        )
        for i, c in enumerate(req.customers)
    ]
    return ChurnResponse(as_of=as_of, predictions=predictions)


@router.post("/churn", response_model=ChurnResponse)
def predict_churn(payload: ChurnRequest) -> ChurnResponse:
    return _score_rfm(payload)
