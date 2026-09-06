"""Simulator snapshot must match the shared scenario state shape and content."""

from __future__ import annotations

from simulation.contract import SharedScenarioState
from simulation.snapshot import build_shared_state


def test_sq318_snapshot_matches_contract_shape():
    state = build_shared_state("sq318_canonical")
    SharedScenarioState.model_validate(state)


def test_sq318_snapshot_canonical_values():
    state = build_shared_state("sq318_canonical")

    assert state["flight"]["flight_id"] == "SQ318"
    assert state["flight"]["current_gate"] == "B8"
    assert state["gate"]["current_gate"] == "B8"
    assert "B10" in state["gate"]["alternative_gates"]
    assert state["ground_operations"]["baggage_percent"] == 75
    assert state["ground_operations"]["boarding_percent"] == 60
    assert state["passengers"]["total_passengers"] == 280
    assert state["passengers"]["connecting_passengers"] == 42
    # 11 at risk under the baseline expected delay (25 min) — matches contract §3 example.
    assert state["passengers"]["at_risk_connections"] == 11
