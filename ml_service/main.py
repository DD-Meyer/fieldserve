from fastapi import FastAPI

from routers import admin, churn, heatmap, vehicle_damage

app = FastAPI(
    title="FieldServe ML Service",
    description="Churn, heatmap and vehicle-damage vision endpoints for FieldServe.",
    version="0.3.0",
)

app.include_router(churn.router, prefix="/predict")
app.include_router(heatmap.router, prefix="/predict")
app.include_router(vehicle_damage.router)
app.include_router(admin.router)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "FieldServe ML Service. See /docs for the OpenAPI UI."}


@app.head("/")
def root_head() -> None:
    return None


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.head("/health")
def health_head() -> None:
    return None


@app.get("/version")
def version() -> dict[str, str]:
    return {"version": app.version}