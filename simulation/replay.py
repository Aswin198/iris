"""Pre-baked replay timeline for the frontend demo animation.

Not part of the API contract — this feeds Person 4's dashboard when it wants to
visually step through the disruption instead of showing a static state.
"""

from __future__ import annotations

from typing import Any

from .loader import load_scenario


def build_replay_timeline(scenario_id: str) -> list[dict[str, Any]]:
    scenario = load_scenario(scenario_id)
    focus = scenario["focus_flight"]
    events: list[dict[str, Any]] = []

    events.append(
        {
            "t": focus["scheduled_departure"],
            "actor": focus["flight_id"],
            "event_type": "scheduled_departure",
            "description": f"{focus['flight_id']} scheduled to depart {focus['assigned_gate']}",
        }
    )

    for d in scenario.get("disruptions", []):
        if d["type"] == "late_incoming_aircraft":
            events.append(
                {
                    "t": focus["scheduled_departure"],
                    "actor": focus["flight_id"],
                    "event_type": "disruption",
                    "description": f"Incoming aircraft delayed by {d['delay_minutes']} min",
                }
            )
        elif d["type"] == "gate_conflict":
            events.append(
                {
                    "t": d["conflict_time"],
                    "actor": d.get("conflicting_flight", "unknown"),
                    "event_type": "gate_conflict",
                    "description": f"Gate {d['gate']} required by {d.get('conflicting_flight', 'another flight')}",
                }
            )
        elif d["type"] == "thunderstorm":
            events.append(
                {
                    "t": d.get("risk_window_start", focus["scheduled_departure"]),
                    "actor": "weather",
                    "event_type": "weather_risk",
                    "description": f"Thunderstorm risk window {d.get('risk_window_start', '?')} - {d.get('risk_window_end', '?')}",
                }
            )
        elif d["type"] == "ground_handling_delay":
            events.append(
                {
                    "t": focus["scheduled_departure"],
                    "actor": "ground_ops",
                    "event_type": "ground_delay",
                    "description": f"Ground handling delayed by {d['delay_minutes']} min",
                }
            )

    events.append(
        {
            "t": focus["aircraft_ready_time"],
            "actor": focus["flight_id"],
            "event_type": "aircraft_ready",
            "description": f"{focus['flight_id']} aircraft estimated ready",
        }
    )

    events.sort(key=lambda e: e["t"])
    return events
