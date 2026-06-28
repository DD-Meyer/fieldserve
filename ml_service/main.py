from fastapi import FastAPI

from routers import admin, churn, heatmap, scheduling

app = FastAPI(
    title="FieldServe ML Service",
    description="Churn, scheduling and heatmap predictions for the FieldServe CRM.",
    version="0.1.0",
)

app.include_router(churn.router, prefix="/predict")
app.include_router(scheduling.router, prefix="/predict")
app.include_router(heatmap.router, prefix="/predict")
app.include_router(admin.router)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "FieldServe ML Service. See /docs for the OpenAPI UI."}


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/version")
def version() -> dict[str, str]:
    return {"version": app.version}