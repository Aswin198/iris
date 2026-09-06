from fastapi import FastAPI

from backend.orchestrator.orchestrator import (
    IRISOrchestrator,
)
from backend.flights import REPLAY_START_MINUTE, list_flights


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


@app.get("/api/flights")
def flights(at: float = REPLAY_START_MINUTE):
    flight_list, source = list_flights(at)
    return {
        "flights": flight_list,
        "data_source": source,
    }
