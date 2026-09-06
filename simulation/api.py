"""FastAPI router exposing the airport simulator to the orchestrator and frontend.

Routes:
- GET  /api/scenarios                 -> list of preset scenario ids + descriptions
- GET  /api/scenarios/{id}            -> shared scenario state (contract §3)
- GET  /api/scenarios/{id}/replay     -> pre-baked replay timeline (frontend animation)
- GET  /api/scenarios/{id}/plans      -> the canonical candidate plans for that scenario
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from . import disruptions, replay, snapshot
from .loader import list_scenarios, load_scenario

router = APIRouter(prefix="/api/scenarios", tags=["simulator"])


@router.get("")
def list_all():
    return disruptions.preset_scenarios()


@router.get("/{scenario_id}")
def get_scenario(scenario_id: str):
    if scenario_id not in list_scenarios():
        raise HTTPException(status_code=404, detail=f"Unknown scenario '{scenario_id}'")
    return snapshot.build_shared_state(scenario_id)


@router.get("/{scenario_id}/replay")
def get_replay(scenario_id: str):
    if scenario_id not in list_scenarios():
        raise HTTPException(status_code=404, detail=f"Unknown scenario '{scenario_id}'")
    return replay.build_replay_timeline(scenario_id)


@router.get("/{scenario_id}/plans")
def get_canonical_plans(scenario_id: str):
    if scenario_id not in list_scenarios():
        raise HTTPException(status_code=404, detail=f"Unknown scenario '{scenario_id}'")
    return load_scenario(scenario_id)["canonical_plans"]
