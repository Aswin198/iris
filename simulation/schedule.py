"""Access helpers for the surrounding-flight schedule of a scenario."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from dateutil import parser as dtparser

from .loader import load_scenario


def _parse(ts: str) -> datetime:
    return dtparser.isoparse(ts)


def surrounding_flights(scenario_id: str) -> list[dict[str, Any]]:
    return load_scenario(scenario_id)["surrounding_flights"]


def focus_flight(scenario_id: str) -> dict[str, Any]:
    return load_scenario(scenario_id)["focus_flight"]


def all_flights(scenario_id: str) -> list[dict[str, Any]]:
    scenario = load_scenario(scenario_id)
    return [scenario["focus_flight"], *scenario["surrounding_flights"]]


def gate_occupations(scenario_id: str, gate_code: str) -> list[tuple[str, datetime, datetime]]:
    """Return (flight_id, start, end) for every occupation of `gate_code`."""
    out: list[tuple[str, datetime, datetime]] = []
    for f in surrounding_flights(scenario_id):
        if f["assigned_gate"] == gate_code:
            out.append((f["flight_id"], _parse(f["gate_occupation_start"]), _parse(f["gate_occupation_end"])))
    return out
