"""Compute the four recovery metrics defined in docs/API_CONTRACT.md section 7."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from dateutil import parser as dtparser

from simulation import airport, passengers

from .weights import Weights


def _parse(ts: str | datetime) -> datetime:
    return ts if isinstance(ts, datetime) else dtparser.isoparse(ts)


def departure_delay_minutes(scenario: dict[str, Any], plan: dict[str, Any]) -> int:
    scheduled = _parse(scenario["focus_flight"]["scheduled_departure"])
    dep = _parse(plan["recommended_departure"])
    return max(0, int((dep - scheduled).total_seconds() // 60))


def gate_conflicts(scenario: dict[str, Any], plan: dict[str, Any], weights: Weights) -> int:
    ready = _parse(scenario["focus_flight"]["aircraft_ready_time"])
    dep = _parse(plan["recommended_departure"])
    occupation_end = dep + timedelta(minutes=weights.pushback_buffer_minutes)
    count = 0
    for flight in scenario["surrounding_flights"]:
        if flight["assigned_gate"] != plan["recommended_gate"]:
            continue
        if flight["flight_id"] == scenario["focus_flight"]["flight_id"]:
            continue
        other_start = _parse(flight["gate_occupation_start"])
        other_end = _parse(flight["gate_occupation_end"])
        if ready < other_end and other_start < occupation_end:
            count += 1
    return count


def passengers_at_risk(scenario: dict[str, Any], plan: dict[str, Any]) -> int:
    delay = departure_delay_minutes(scenario, plan)
    return passengers.at_risk_count(scenario["focus_flight"]["connections"], delay)


def downstream_delay_minutes(scenario: dict[str, Any], plan: dict[str, Any]) -> int:
    focus = scenario["focus_flight"]
    delay = departure_delay_minutes(scenario, plan)
    buffer = focus.get("downstream_buffer_minutes", 0)
    return max(0, delay - buffer)


def gate_change_applied(scenario: dict[str, Any], plan: dict[str, Any]) -> bool:
    return plan["recommended_gate"] != scenario["focus_flight"]["assigned_gate"]


def compute_all(scenario: dict[str, Any], plan: dict[str, Any], weights: Weights) -> dict[str, int]:
    return {
        "departure_delay_minutes": departure_delay_minutes(scenario, plan),
        "gate_conflicts": gate_conflicts(scenario, plan, weights),
        "passengers_at_risk": passengers_at_risk(scenario, plan),
        "downstream_delay_minutes": downstream_delay_minutes(scenario, plan),
    }
