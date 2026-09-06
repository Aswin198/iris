"""Optimiser must reproduce the canonical SQ318 ranking exactly.

The score 23.5 for Plan B is not arbitrary — it is the example value in
docs/API_CONTRACT.md section 7. Changing weights that break this test also
breaks the shared contract example.
"""

from __future__ import annotations

from optimizer.engine import evaluate, rank
from simulation.loader import load_scenario


def _plans():
    return load_scenario("sq318_canonical")["canonical_plans"]


def test_plan_b_matches_contract_example():
    scenario = load_scenario("sq318_canonical")
    plan_b = next(p for p in _plans() if p["plan_id"] == "plan_B")

    result = evaluate(scenario, plan_b)

    assert result["feasible"] is True
    assert result["score"] == 23.5
    assert result["metrics"] == {
        "departure_delay_minutes": 18,
        "gate_conflicts": 0,
        "passengers_at_risk": 4,
        "downstream_delay_minutes": 12,
    }


def test_plan_a_infeasible_due_to_gate_conflict():
    scenario = load_scenario("sq318_canonical")
    plan_a = next(p for p in _plans() if p["plan_id"] == "plan_A")

    result = evaluate(scenario, plan_a)

    assert result["feasible"] is False
    assert result["score"] is None
    assert any("B8" in v and "SQ26" in v for v in result["constraint_violations"])


def test_ranking_puts_plan_b_first():
    scenario = load_scenario("sq318_canonical")
    ranked = rank(scenario, _plans())

    assert ranked[0]["plan_id"] == "plan_B"
    assert ranked[1]["plan_id"] == "plan_C"
    assert ranked[2]["plan_id"] == "plan_A"
    assert ranked[0]["score"] < ranked[1]["score"]
    assert ranked[2]["feasible"] is False
