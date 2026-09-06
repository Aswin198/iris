"""Changi gate catalog queries: aircraft-gate compatibility and conflict detection."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Iterable

from dateutil import parser as dtparser

from .loader import load_aircraft_catalog, load_gate_catalog


def _parse(ts: str | datetime) -> datetime:
    return ts if isinstance(ts, datetime) else dtparser.isoparse(ts)


def gate_record(gate_code: str) -> dict[str, Any] | None:
    for g in load_gate_catalog()["gates"]:
        if g["gate_code"] == gate_code:
            return g
    return None


def aircraft_body_type(aircraft_type: str) -> str:
    return load_aircraft_catalog()["aircraft_types"][aircraft_type]["body_type"]


def is_compatible(gate_code: str, aircraft_type: str) -> bool:
    gate = gate_record(gate_code)
    if gate is None:
        return False
    return aircraft_body_type(aircraft_type) in gate["body_type_capacity"]


def terminal_of(gate_code: str) -> str | None:
    gate = gate_record(gate_code)
    return gate["terminal"] if gate else None


def _windows_overlap(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return a_start < b_end and b_start < a_end


def find_gate_conflict(
    gate_code: str,
    occupation_start: datetime,
    occupation_end: datetime,
    surrounding_flights: Iterable[dict[str, Any]],
    ignore_flight_id: str | None = None,
) -> dict[str, Any] | None:
    """Return the first conflicting flight at this gate, or None."""
    for flight in surrounding_flights:
        if flight["assigned_gate"] != gate_code:
            continue
        if ignore_flight_id and flight["flight_id"] == ignore_flight_id:
            continue
        other_start = _parse(flight["gate_occupation_start"])
        other_end = _parse(flight["gate_occupation_end"])
        if _windows_overlap(occupation_start, occupation_end, other_start, other_end):
            return flight
    return None


def alternative_gates(
    current_gate: str,
    aircraft_type: str,
    occupation_start: datetime,
    occupation_end: datetime,
    surrounding_flights: Iterable[dict[str, Any]],
    prefer_terminal: str | None = None,
) -> list[str]:
    """Compatible gates that have no conflict in the requested window."""
    surrounding = list(surrounding_flights)
    candidates: list[tuple[int, str]] = []
    home_terminal = prefer_terminal or terminal_of(current_gate)
    for gate in load_gate_catalog()["gates"]:
        code = gate["gate_code"]
        if code == current_gate:
            continue
        if not is_compatible(code, aircraft_type):
            continue
        if find_gate_conflict(code, occupation_start, occupation_end, surrounding) is not None:
            continue
        # Prefer same terminal to keep passenger walking distance sane.
        rank = 0 if gate["terminal"] == home_terminal else 1
        candidates.append((rank, code))
    candidates.sort()
    return [code for _, code in candidates]
