"""FastAPI router for the deterministic optimiser.

Routes:
- POST /api/optimizer/evaluate  -> {scenario_id, candidate_plan}      -> OptimiserResponse
- POST /api/optimizer/rank      -> {scenario_id, candidate_plans[]}   -> [OptimiserResponse, ...]
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from simulation.contract import CandidatePlan, OptimiserResponse
from simulation.loader import list_scenarios

from . import engine

router = APIRouter(prefix="/api/optimizer", tags=["optimiser"])


class EvaluateRequest(BaseModel):
    scenario_id: str
    candidate_plan: CandidatePlan


class RankRequest(BaseModel):
    scenario_id: str
    candidate_plans: list[CandidatePlan]


def _require_scenario(scenario_id: str) -> None:
    if scenario_id not in list_scenarios():
        raise HTTPException(status_code=404, detail=f"Unknown scenario '{scenario_id}'")


@router.post("/evaluate", response_model=OptimiserResponse)
def evaluate(payload: EvaluateRequest) -> dict[str, Any]:
    _require_scenario(payload.scenario_id)
    plan = payload.candidate_plan.model_dump(mode="json")
    return engine.evaluate(payload.scenario_id, plan)


@router.post("/rank", response_model=list[OptimiserResponse])
def rank(payload: RankRequest) -> list[dict[str, Any]]:
    _require_scenario(payload.scenario_id)
    plans = [p.model_dump(mode="json") for p in payload.candidate_plans]
    return engine.rank(payload.scenario_id, plans)
