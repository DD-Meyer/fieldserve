from fastapi import FastAPI
from routers import churn, scheduling, heatmap

app = FastAPI(title="FieldServe ML Service")

app.include_router(churn.router, prefix="/predict")
app.include_router(scheduling.router, prefix="/predict")
app.include_router(heatmap.router, prefix="/predict")

@app.get("/health")
def health_check():
    return {"status": "ok"}