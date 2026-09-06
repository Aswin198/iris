"""Scoring weights for the deterministic recovery-plan optimiser.

Weights are load-bearing: the SQ318 canonical scenario is calibrated so Plan B
scores exactly 23.5 against the metrics in docs/API_CONTRACT.md section 7.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Weights:
    delay: float = 1.0
    gate: float = 10.0
    pax: float = 0.5
    downstream: float = 0.25
    cost: float = 1.0

    # Fixed operational-cost inputs.
    gate_change_cost: float = 0.5

    # Hard-constraint tuning.
    pushback_buffer_minutes: int = 5
    hard_mct_violation_ratio: float = 0.30


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    return float(raw) if raw is not None else default


def default_weights() -> Weights:
    return Weights(
        delay=_env_float("IRIS_W_DELAY", 1.0),
        gate=_env_float("IRIS_W_GATE", 10.0),
        pax=_env_float("IRIS_W_PAX", 0.5),
        downstream=_env_float("IRIS_W_DOWNSTREAM", 0.25),
        cost=_env_float("IRIS_W_COST", 1.0),
        gate_change_cost=_env_float("IRIS_GATE_CHANGE_COST", 0.5),
    )
