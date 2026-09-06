"""Composite FastAPI app so the simulator + optimiser can be booted with one command.

Person 1's orchestrator can either import these routers or run this app directly
during development.

    uvicorn app:app --reload --port 8000
"""

from __future__ import annotations

from fastapi import FastAPI

from optimizer.api import router as optimizer_router
from simulation.api import router as simulator_router

app = FastAPI(title="IRIS Simulator + Optimiser", version="0.1.0")
app.include_router(simulator_router)
app.include_router(optimizer_router)


@app.get("/health")
def health():
    return {"status": "ok"}
