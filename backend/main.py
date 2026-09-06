from fastapi import FastAPI

from backend.orchestrator.orchestrator import (
    IRISOrchestrator,
)


app = FastAPI(
    title="IRIS API",
    description=(
        "Intelligent Recovery & "
        "Irregular Operations System"
    ),
    version="0.1.0",
)


orchestrator = IRISOrchestrator()


@app.get("/")
def root():

    return {
        "service": "IRIS",
        "status": "running",
    }


@app.post("/api/recovery")
def recover(
    request: dict,
):

    return orchestrator.run(
        request
    )