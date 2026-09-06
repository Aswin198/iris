"""Hard-constraint checks for candidate recovery plans.

Each check returns a violation string when it fails, or None when it passes.
The optimiser rejects any plan with one or more violations.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from dateutil import parser as dtparser

from simulation import airport, passengers

from .weights import Weights


def _parse(ts: str | datetime) -> datetime:
    return ts if isinstance(ts, datetime) else dtparser.isoparse(ts)


def aircraft_ready_before(scenario: dict[str, Any], plan: dict[str, Any]) -> str | None:
    ready = _parse(scenario["focus_flight"]["aircraft_ready_time"])
    dep = _parse(plan["recommended_departure"])
    if dep < ready:
        return f"Plan departs at {plan['recommended_departure']} before aircraft ready at {scenario['focus_flight']['aircraft_ready_time']}"
    return None


def gate_aircraft_compatible(scenario: dict[str, Any], plan: dict[str, Any]) -> str | None:
    if not airport.is_compatible(plan["recommended_gate"], scenario["focus_flight"]["aircraft_type"]):
        return f"Gate {plan['recommended_gate']} is not compatible with {scenario['focus_flight']['aircraft_type']}"
    return None


def no_gate_conflict(scenario: dict[str, Any], plan: dict[str, Any], weights: Weights) -> str | None:
    ready = _parse(scenario["focus_flight"]["aircraft_ready_time"])
    dep = _parse(plan["recommended_departure"])
    occupation_end = dep + timedelta(minutes=weights.pushback_buffer_minutes)

    conflict = airport.find_gate_conflict(
        plan["recommended_gate"],
        ready,
        occupation_end,
        scenario["surrounding_flights"],
        ignore_flight_id=scenario["focus_flight"]["flight_id"],
    )
    if conflict is not None:
        return f"Gate {plan['recommended_gate']} conflicts with {conflict['flight_id']} (occupies {conflict['gate_occupation_start']} - {conflict['gate_occupation_end']})"
    return None


def weather_window_ok(scenario: dict[str, Any], plan: dict[str, Any]) -> str | None:
    dep = _parse(plan["recommended_departure"])
    for window in scenario.get("weather", {}).get("closure_windows", []) or []:
        start = _parse(window["start"])
        end = _parse(window["end"])
        if start <= dep < end:
            return f"Recommended departure {plan['recommended_departure']} lies inside weather closure window {window['start']} - {window['end']}"
    return None


def no_hard_mct_violation(scenario: dict[str, Any], plan: dict[str, Any], weights: Weights) -> str | None:
    focus = scenario["focus_flight"]
    scheduled = _parse(focus["scheduled_departure"])
    dep = _parse(plan["recommended_departure"])
    delay = max(0, int((dep - scheduled).total_seconds() // 60))
    hard_violations = passengers.hard_mct_violations(focus["connections"], delay)
    connecting = focus["connecting_passengers"]
    if connecting == 0:
        return None
    ratio = hard_violations / connecting
    if ratio > weights.hard_mct_violation_ratio:
        return (
            f"{hard_violations} of {connecting} connecting passengers ({ratio:.0%}) cannot make onward "
            f"connections even with intra-terminal sprint (threshold {weights.hard_mct_violation_ratio:.0%})"
        )
    return None


def evaluate_all(scenario: dict[str, Any], plan: dict[str, Any], weights: Weights) -> list[str]:
    violations: list[str] = []
    for check in (
        aircraft_ready_before(scenario, plan),
        gate_aircraft_compatible(scenario, plan),
        no_gate_conflict(scenario, plan, weights),
        weather_window_ok(scenario, plan),
        no_hard_mct_violation(scenario, plan, weights),
    ):
        if check:
            violations.append(check)
    return violations
