"""Filesystem loaders for gate catalog, aircraft catalog and scenario fixtures."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).parent / "data"
SCENARIOS_DIR = DATA_DIR / "scenarios"


@lru_cache(maxsize=1)
def load_gate_catalog() -> dict[str, Any]:
    with (DATA_DIR / "gates_wsss.json").open() as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_aircraft_catalog() -> dict[str, Any]:
    with (DATA_DIR / "aircraft_types.json").open() as f:
        return json.load(f)


@lru_cache(maxsize=None)
def load_scenario(scenario_id: str) -> dict[str, Any]:
    path = SCENARIOS_DIR / f"{scenario_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"Unknown scenario: {scenario_id}")
    with path.open() as f:
        return json.load(f)


def list_scenarios() -> list[str]:
    return sorted(p.stem for p in SCENARIOS_DIR.glob("*.json"))
