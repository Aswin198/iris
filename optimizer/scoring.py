"""Deterministic weighted score. The LLM never touches this file (contract section 9)."""

from __future__ import annotations

from typing import Any

from .weights import Weights


def score(metrics: dict[str, int], gate_change: bool, weights: Weights) -> float:
    operational_cost = weights.gate_change_cost if gate_change else 0.0
    return (
        weights.delay * metrics["departure_delay_minutes"]
        + weights.gate * metrics["gate_conflicts"]
        + weights.pax * metrics["passengers_at_risk"]
        + weights.downstream * metrics["downstream_delay_minutes"]
        + weights.cost * operational_cost
    )
