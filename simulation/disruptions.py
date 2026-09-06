"""Disruption catalog and preset-scenario listing.

For MVP the disruption *instances* live inside each scenario fixture. This
module exposes the type catalog and helpers to query which disruptions apply
to a scenario.
"""

from __future__ import annotations

from typing import Any

from .loader import list_scenarios, load_scenario

DISRUPTION_TYPES = [
    "late_incoming_aircraft",
    "ground_handling_delay",
    "thunderstorm",
    "gate_conflict",
    "baggage_delay",
]


def scenario_disruptions(scenario_id: str) -> list[dict[str, Any]]:
    return load_scenario(scenario_id).get("disruptions", [])


def has_weather_closure(scenario_id: str) -> bool:
    for d in scenario_disruptions(scenario_id):
        if d["type"] == "thunderstorm" and d.get("severity") in {"high", "critical"}:
            return True
    return False


def preset_scenarios() -> list[dict[str, str]]:
    return [
        {"scenario_id": s, "description": load_scenario(s).get("description", "")}
        for s in list_scenarios()
    ]
