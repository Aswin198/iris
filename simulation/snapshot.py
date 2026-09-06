"""Build the shared scenario state JSON that agents and the optimiser consume.

Output matches docs/API_CONTRACT.md sections 3 and 14 exactly.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from dateutil import parser as dtparser

from . import airport, passengers
from .contract import SharedScenarioState
from .loader import load_scenario


def _parse(ts: str) -> datetime:
    return dtparser.isoparse(ts)


def _gate_block(scenario: dict[str, Any]) -> dict[str, Any]:
    focus = scenario["focus_flight"]
    current_gate = focus["assigned_gate"]
    aircraft_type = focus["aircraft_type"]
    ready_time = _parse(focus["aircraft_ready_time"])
    baseline_delay = focus.get("expected_baseline_delay_minutes", 25)
    from datetime import timedelta

    expected_departure = _parse(focus["scheduled_departure"]) + timedelta(minutes=baseline_delay)

    conflict = airport.find_gate_conflict(
        current_gate,
        ready_time,
        expected_departure,
        scenario["surrounding_flights"],
        ignore_flight_id=focus["flight_id"],
    )

    alt_from_fixture = scenario.get("alternative_gates") or []
    alt_computed = airport.alternative_gates(
        current_gate,
        aircraft_type,
        ready_time,
        expected_departure,
        scenario["surrounding_flights"],
    )
    alternatives = alt_from_fixture or alt_computed[:3]

    return {
        "current_gate": current_gate,
        "conflict": conflict is not None,
        "conflict_time": conflict["gate_occupation_start"] if conflict else None,
        "alternative_gates": alternatives,
    }


def _passenger_block(scenario: dict[str, Any]) -> dict[str, Any]:
    focus = scenario["focus_flight"]
    connections = focus["connections"]
    baseline_delay = focus.get("expected_baseline_delay_minutes", 25)
    at_risk = passengers.at_risk_count(connections, baseline_delay)
    return {
        "total_passengers": focus["total_passengers"],
        "connecting_passengers": focus["connecting_passengers"],
        "at_risk_connections": at_risk,
    }


def build_shared_state(scenario_id: str) -> dict[str, Any]:
    scenario = load_scenario(scenario_id)
    focus = scenario["focus_flight"]

    state = {
        "scenario_id": scenario["scenario_id"],
        "flight": {
            "flight_id": focus["flight_id"],
            "origin": focus["origin"],
            "destination": focus["destination"],
            "scheduled_departure": focus["scheduled_departure"],
            "scheduled_arrival": focus["scheduled_arrival"],
            "current_gate": focus["assigned_gate"],
            "aircraft_ready_time": focus["aircraft_ready_time"],
        },
        "weather": {
            "condition": scenario["weather"]["condition"],
            "risk_level": scenario["weather"]["risk_level"],
            "visibility_m": scenario["weather"]["visibility_m"],
            "wind_speed_kt": scenario["weather"]["wind_speed_kt"],
        },
        "gate": _gate_block(scenario),
        "ground_operations": scenario["ground_operations"],
        "passengers": _passenger_block(scenario),
    }

    # Validate against the contract before returning; raises on any drift.
    SharedScenarioState.model_validate(state)
    return state
