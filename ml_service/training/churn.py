"""Churn-model training pipeline.

Single source of truth for *training* a churn model. Used by:

- the FastAPI ``/admin/train`` endpoint (programmatic retrain),
- a cron / Django management command (scheduled retrain),
- the dissertation notebook (interactive exploration + figures),
- the CLI: ``python -m training.churn --csv path/to/online_retail.csv``.

The function ``train_from_bookings`` is the entry point for the
"data → trained bundle" path; ``train_from_features`` is the entry point
when the caller already has pre-engineered rows + labels.

Saves a bundle dict matching what ``utils.model_registry.load_churn_bundle``
expects, at ``ml_service/models/churn/churn_model.joblib``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from imblearn.over_sampling import SMOTE
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    f1_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from features.churn import EXT_FEATURES, RFM_FEATURES

log = logging.getLogger(__name__)

# Paths
ML_SERVICE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_BUNDLE_PATH = ML_SERVICE_DIR / "models" / "churn" / "churn_model.joblib"

# Defaults — match the notebook's protocol so models trained here are directly
# comparable to ones trained in the dissertation notebook.
DEFAULT_CHURN_DAYS = 180
DEFAULT_OBS_DAYS = 365
DEFAULT_MIN_BOOKINGS = 2
DEFAULT_RISK_THRESHOLDS = {"high": 0.65, "medium": 0.35}
RANDOM_STATE = 42


# ---------------------------------------------------------------------------
# Data loading + cleaning
# ---------------------------------------------------------------------------


def load_online_retail(data_dir: Path) -> pd.DataFrame:
    """Read the Online Retail II distribution from ``data_dir``.

    Supports both the canonical two-sheet Excel file and the two-CSV mirror.
    """
    excel = next(iter(data_dir.glob("*.xlsx")), None)
    csvs = sorted(data_dir.glob("*.csv"))

    frames: list[pd.DataFrame] = []
    if excel is not None:
        log.info("Loading Excel distribution: %s", excel.name)
        xls = pd.ExcelFile(excel)
        for sheet in xls.sheet_names:
            frames.append(pd.read_excel(xls, sheet_name=sheet))
    elif csvs:
        log.info("Loading CSV distribution: %s", [p.name for p in csvs])
        for p in csvs:
            frames.append(pd.read_csv(p, encoding="ISO-8859-1"))
    else:
        raise FileNotFoundError(
            f"No .xlsx or .csv files found in {data_dir}. Download Online Retail "
            "II from Kaggle/UCI and place the files there."
        )

    df = pd.concat(frames, ignore_index=True)
    df = df.rename(
        columns={
            "InvoiceNo": "Invoice",
            "UnitPrice": "Price",
            "CustomerID": "Customer ID",
        }
    )

    required = ["Invoice", "StockCode", "Quantity", "InvoiceDate", "Price", "Customer ID", "Country"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise KeyError(
            f"Missing expected columns after normalisation: {missing}. Got {list(df.columns)}"
        )
    return df


def clean_to_bookings(raw: pd.DataFrame) -> pd.DataFrame:
    """Clean line-level rows and aggregate to one booking (invoice) per row."""
    df = raw.copy()
    df["Invoice"] = df["Invoice"].astype(str)
    df = df.dropna(subset=["Customer ID"]).copy()
    df["Customer ID"] = pd.to_numeric(df["Customer ID"], errors="coerce").astype(int).astype(str)
    df["InvoiceDate"] = pd.to_datetime(df["InvoiceDate"], errors="coerce")
    df["cancelled"] = df["Invoice"].str.upper().str.startswith("C").astype(int)

    bad_lines = (df["cancelled"] == 0) & ((df["Price"] <= 0) | (df["Quantity"] <= 0))
    df = df[~bad_lines].copy()
    df["line_amount"] = df["Quantity"] * df["Price"]

    bookings = (
        df.groupby(["Invoice", "Customer ID"])
        .agg(
            booking_date=("InvoiceDate", "first"),
            invoice_amount=("line_amount", "sum"),
            item_count=("StockCode", "nunique"),
            unit_count=("Quantity", "sum"),
            cancelled=("cancelled", "max"),
            country=("Country", "first"),
        )
        .reset_index()
        .rename(columns={"Invoice": "booking_id", "Customer ID": "customer_id"})
    )
    return bookings


# ---------------------------------------------------------------------------
# Labels + features (mirrors the notebook, deterministic for retraining)
# ---------------------------------------------------------------------------


@dataclass
class LabelledFeatures:
    feat: pd.DataFrame  # one row per customer; columns = EXT_FEATURES + ['churned']
    cutoff: pd.Timestamp
    churn_rate: float
    n_customers: int


def build_labels_and_features(
    bookings: pd.DataFrame,
    *,
    cutoff: pd.Timestamp | None = None,
    churn_days: int = DEFAULT_CHURN_DAYS,
    obs_days: int = DEFAULT_OBS_DAYS,
    min_bookings: int = DEFAULT_MIN_BOOKINGS,
) -> LabelledFeatures:
    """Compute the leakage-safe churn label + the 17-feature matrix."""
    if cutoff is None:
        # Choose latest valid cutoff so the prediction window fits inside the data.
        cutoff = (bookings["booking_date"].max() - pd.DateOffset(days=churn_days)).normalize()
    cutoff_ts: pd.Timestamp = pd.Timestamp(cutoff)

    obs_start = cutoff_ts - pd.DateOffset(days=obs_days)
    pred_end = cutoff_ts + pd.DateOffset(days=churn_days)

    obs_all = bookings[(bookings["booking_date"] >= obs_start) & (bookings["booking_date"] < cutoff_ts)].copy()

    counts = obs_all.groupby("customer_id")["booking_id"].count()
    repeat = counts[counts >= min_bookings].index
    obs = obs_all[obs_all["customer_id"].isin(repeat)].copy()
    active = obs["customer_id"].unique()

    pred = bookings[(bookings["booking_date"] >= cutoff_ts) & (bookings["booking_date"] < pred_end)]
    returned = set(pred["customer_id"].unique())

    labels = pd.DataFrame({"customer_id": active})
    labels["churned"] = (~labels["customer_id"].isin(returned)).astype(int)

    feat = _engineer_features(obs, labels, cutoff_ts)

    return LabelledFeatures(
        feat=feat,
        cutoff=cutoff_ts,
        churn_rate=float(labels["churned"].mean()),
        n_customers=len(labels),
    )


def _engineer_features(obs: pd.DataFrame, labels: pd.DataFrame, cutoff: pd.Timestamp) -> pd.DataFrame:
    """Compute all 17 features. Output index = customer_id; columns include 'churned'."""
    grp = obs.groupby("customer_id")
    feat = pd.DataFrame(index=labels.set_index("customer_id").index)

    # Recency / tenure
    last_b = grp["booking_date"].max()
    first_b = grp["booking_date"].min()
    feat["recency_days"] = (cutoff - last_b).dt.days
    feat["tenure_days"] = (cutoff - first_b).dt.days

    # Frequency
    feat["freq_12m"] = grp["booking_id"].count()
    obs_3m = obs[obs["booking_date"] >= (cutoff - pd.DateOffset(days=90))]
    feat["freq_3m"] = obs_3m.groupby("customer_id")["booking_id"].count().reindex(feat.index).fillna(0)

    # Inter-booking gaps
    def _gaps(dates: pd.Series) -> pd.Series:
        if len(dates) < 2:
            return pd.Series({"gap_mean": np.nan, "gap_std": np.nan})
        g = dates.sort_values().diff().dt.days.dropna()
        return pd.Series({"gap_mean": g.mean(), "gap_std": g.std()})

    gap_stats = grp["booking_date"].apply(_gaps).unstack()
    feat["avg_inter_booking_gap"] = gap_stats["gap_mean"]
    feat["inter_booking_gap_std"] = gap_stats["gap_std"]

    # Monetary
    feat["total_spend_12m"] = grp["invoice_amount"].sum()
    feat["avg_ticket"] = grp["invoice_amount"].mean()

    def _trend(amounts: pd.Series) -> float:
        if len(amounts) < 2:
            return 0.0
        y = amounts.sort_index().values[-6:]
        x = np.arange(len(y))
        return float(np.polyfit(x, y, 1)[0]) if len(x) > 1 else 0.0

    feat["monetary_trend"] = grp["invoice_amount"].apply(_trend)
    feat["spend_per_visit_std"] = grp["invoice_amount"].std()
    feat["spend_per_visit_cv"] = feat["spend_per_visit_std"] / feat["avg_ticket"]

    # Engagement / diversity / calendar
    feat["cancellation_rate"] = grp["cancelled"].mean()
    feat["unique_item_types"] = grp["item_count"].mean()
    feat["total_units"] = grp["unit_count"].sum()
    feat["weekend_share"] = grp["booking_date"].apply(lambda d: (d.dt.dayofweek >= 5).mean())
    feat["evening_share"] = grp["booking_date"].apply(lambda d: (d.dt.hour >= 17).mean())

    # Geo proxy
    feat["is_uk"] = (grp["country"].first() == "United Kingdom").astype(int)

    feat = feat.replace([np.inf, -np.inf], np.nan)
    feat = feat.merge(labels.set_index("customer_id")[["churned"]], left_index=True, right_index=True)
    return feat


# ---------------------------------------------------------------------------
# Model bake-off
# ---------------------------------------------------------------------------


def _make_models() -> dict[str, Any]:
    return {
        "Logistic Regression (RFM)": (
            RFM_FEATURES,
            Pipeline([
                ("scaler", StandardScaler()),
                ("clf", LogisticRegression(max_iter=1000, random_state=RANDOM_STATE)),
            ]),
        ),
        "Logistic Regression (Extended)": (
            EXT_FEATURES,
            Pipeline([
                ("scaler", StandardScaler()),
                ("clf", LogisticRegression(max_iter=1000, random_state=RANDOM_STATE)),
            ]),
        ),
        "Random Forest": (
            EXT_FEATURES,
            RandomForestClassifier(
                n_estimators=300,
                max_depth=None,
                min_samples_leaf=5,
                random_state=RANDOM_STATE,
                n_jobs=-1,
            ),
        ),
        "XGBoost": (
            EXT_FEATURES,
            XGBClassifier(
                n_estimators=500,
                learning_rate=0.05,
                max_depth=6,
                subsample=0.8,
                colsample_bytree=0.8,
                eval_metric="aucpr",
                random_state=RANDOM_STATE,
                n_jobs=-1,
                verbosity=0,
            ),
        ),
    }


def _score(model: Any, X_test: np.ndarray, y_test: np.ndarray) -> dict[str, float]:
    y_prob = model.predict_proba(X_test)[:, 1]
    y_pred = (y_prob >= 0.5).astype(int)
    return {
        "pr_auc": float(round(average_precision_score(y_test, y_prob), 4)),
        "roc_auc": float(round(roc_auc_score(y_test, y_prob), 4)),
        "f1": float(round(f1_score(y_test, y_pred), 4)),
        "brier_score": float(round(brier_score_loss(y_test, y_prob), 4)),
    }


def bake_off(feat: pd.DataFrame) -> dict[str, Any]:
    """Train all four candidate models on `feat` (must include 'churned').

    Returns a dict with all model results and a `best` key pointing to the
    bake-off winner by PR-AUC.
    """
    y = feat["churned"].values
    idx_train, idx_test = train_test_split(
        np.arange(len(y)), test_size=0.2, stratify=y, random_state=RANDOM_STATE
    )
    y_train, y_test = y[idx_train], y[idx_test]

    fitted: dict[str, dict[str, Any]] = {}
    for name, (features, estimator) in _make_models().items():
        X = feat[features].values
        X_train_raw, X_test_raw = X[idx_train], X[idx_test]

        imputer = SimpleImputer(strategy="median")
        X_train = imputer.fit_transform(X_train_raw)
        X_test = imputer.transform(X_test_raw)

        X_train_res, y_train_res = SMOTE(random_state=RANDOM_STATE).fit_resample(X_train, y_train)
        estimator.fit(X_train_res, y_train_res)

        metrics = _score(estimator, X_test, y_test)
        log.info("Trained %-30s PR-AUC=%.4f ROC-AUC=%.4f F1=%.4f Brier=%.4f",
                 name, metrics["pr_auc"], metrics["roc_auc"], metrics["f1"], metrics["brier_score"])

        fitted[name] = {
            "model": estimator,
            "imputer": imputer,
            "features": features,
            "metrics": metrics,
        }

    best_name = max(fitted, key=lambda n: fitted[n]["metrics"]["pr_auc"])
    return {"results": fitted, "best_name": best_name}


# ---------------------------------------------------------------------------
# Bundle + save
# ---------------------------------------------------------------------------


def _feature_set_label(best_name: str) -> str:
    return "RFM only (baseline)" if "RFM" in best_name else "Extended features"


def _build_bundle(
    *,
    best_name: str,
    best_entry: dict[str, Any],
    churn_rate: float,
    cutoff: pd.Timestamp | None,
    data_source: str,
) -> dict[str, Any]:
    bare_model_name = best_name.split(" (")[0]
    return {
        "model": best_entry["model"],
        "imputer": best_entry["imputer"],
        "feature_names": list(best_entry["features"]),
        "model_name": bare_model_name,
        "feature_set_label": _feature_set_label(best_name),
        "data_source": data_source,
        "metrics": best_entry["metrics"],
        "risk_bucket_thresholds": dict(DEFAULT_RISK_THRESHOLDS),
        "churn_definition": {
            "window_days": DEFAULT_CHURN_DAYS,
            "observation_window_days": DEFAULT_OBS_DAYS,
            "cutoff_date_used_in_training": str(cutoff.date()) if cutoff is not None else "unknown",
            "training_churn_rate": float(round(churn_rate, 4)),
        },
        "trained_at": datetime.now().isoformat(timespec="seconds"),
    }


def save_bundle(bundle: dict[str, Any], path: Path | None = None) -> Path:
    """Atomically write the bundle to disk (default: ``models/churn/churn_model.joblib``)."""
    path = path or DEFAULT_BUNDLE_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    joblib.dump(bundle, tmp)
    tmp.replace(path)
    log.info("Saved churn bundle → %s (%.1f KB)", path, path.stat().st_size / 1024)
    return path


# ---------------------------------------------------------------------------
# High-level entry points
# ---------------------------------------------------------------------------


def train_from_bookings(
    bookings: pd.DataFrame,
    *,
    cutoff: pd.Timestamp | None = None,
    data_source: str = "UCI Online Retail II",
    save_path: Path | None = None,
) -> tuple[Path, dict[str, Any]]:
    """End-to-end: bookings → labels + features → bake-off → save bundle.

    Returns ``(path_written, bundle)``.
    """
    lf = build_labels_and_features(bookings, cutoff=cutoff)
    log.info(
        "Built labels + features: n=%d, churn_rate=%.1f%%, cutoff=%s",
        lf.n_customers,
        lf.churn_rate * 100,
        lf.cutoff.date(),
    )
    bo = bake_off(lf.feat)
    bundle = _build_bundle(
        best_name=bo["best_name"],
        best_entry=bo["results"][bo["best_name"]],
        churn_rate=lf.churn_rate,
        cutoff=lf.cutoff,
        data_source=data_source,
    )
    path = save_bundle(bundle, save_path)
    return path, bundle


def train_from_features(
    feat: pd.DataFrame,
    *,
    data_source: str = "in-memory feature matrix",
    save_path: Path | None = None,
) -> tuple[Path, dict[str, Any]]:
    """Train when the caller already has a feature DataFrame with a 'churned' column.

    This is the entry point used by the FastAPI ``/admin/train`` endpoint when
    Django sends pre-engineered features.
    """
    missing = [c for c in EXT_FEATURES + ["churned"] if c not in feat.columns]
    if missing:
        raise ValueError(f"Feature frame is missing columns: {missing}")

    bo = bake_off(feat)
    churn_rate = float(feat["churned"].mean())
    bundle = _build_bundle(
        best_name=bo["best_name"],
        best_entry=bo["results"][bo["best_name"]],
        churn_rate=churn_rate,
        cutoff=None,
        data_source=data_source,
    )
    path = save_bundle(bundle, save_path)
    return path, bundle


def train_from_csv(
    data_dir: Path,
    *,
    save_path: Path | None = None,
) -> tuple[Path, dict[str, Any]]:
    """Top-level convenience: load → clean → train → save. CLI entry point."""
    raw = load_online_retail(Path(data_dir))
    bookings = clean_to_bookings(raw)
    return train_from_bookings(bookings, save_path=save_path)


# ---------------------------------------------------------------------------
# CLI: ``python -m training.churn --data-dir data/online_retail``
# ---------------------------------------------------------------------------


def _cli() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Train the churn model bundle.")
    parser.add_argument(
        "--data-dir",
        default="data/online_retail",
        help="Directory containing the Online Retail II files (.xlsx or .csv).",
    )
    parser.add_argument(
        "--out",
        default=str(DEFAULT_BUNDLE_PATH),
        help="Where to write the bundle (default: models/churn/churn_model.joblib).",
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable info-level logging.")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(levelname)s %(name)s: %(message)s",
    )
    path, bundle = train_from_csv(Path(args.data_dir), save_path=Path(args.out))
    print(f"Wrote bundle → {path}")
    print(f"  best model     : {bundle['model_name']} ({bundle['feature_set_label']})")
    print(f"  metrics        : {bundle['metrics']}")
    print(f"  training cutoff: {bundle['churn_definition']['cutoff_date_used_in_training']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(_cli())
