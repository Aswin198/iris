"""Public entrypoints: evaluate one plan, or rank a list of plans."""

from __future__ import annotations

from typing import Any

from simulation.contract import OptimiserResponse
from simulation.loader import load_scenario

from . import constraints, metrics, scoring
from .weights import Weights, default_weights


def evaluate(
    scenario_id_or_dict: str | dict[str, Any],
    plan: dict[str, Any],
    weights: Weights | None = None,
) -> dict[str, Any]:
    scenario = (
        load_scenario(scenario_id_or_dict)
        if isinstance(scenario_id_or_dict, str)
        else scenario_id_or_dict
    )
    weights = weights or default_weights()

    computed_metrics = metrics.compute_all(scenario, plan, weights)
    violations = constraints.evaluate_all(scenario, plan, weights)
    feasible = len(violations) == 0
    plan_score = (
        scoring.score(computed_metrics, metrics.gate_change_applied(scenario, plan), weights)
        if feasible
        else None
    )

    response = {
        "plan_id": plan["plan_id"],
        "feasible": feasible,
        "score": plan_score,
        "metrics": computed_metrics,
        "constraint_violations": violations,
    }
    OptimiserResponse.model_validate(response)
    return response


def rank(
    scenario_id_or_dict: str | dict[str, Any],
    plans: list[dict[str, Any]],
    weights: Weights | None = None,
) -> list[dict[str, Any]]:
    weights = weights or default_weights()
    results = [evaluate(scenario_id_or_dict, p, weights) for p in plans]
    # Feasible plans first (sorted by score asc), infeasible last.
    results.sort(key=lambda r: (not r["feasible"], r["score"] if r["score"] is not None else float("inf")))
    return results
