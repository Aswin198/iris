"""Guard rail: every JSON produced by simulator or optimiser must validate
against the Pydantic contract models. Failing this test means we have drifted
from docs/API_CONTRACT.md."""

from __future__ import annotations

from optimizer.engine import evaluate
from simulation.contract import (
    CandidatePlan,
    OptimiserResponse,
    SharedScenarioState,
)
from simulation.loader import list_scenarios, load_scenario
from simulation.snapshot import build_shared_state


def test_all_scenarios_produce_valid_shared_state():
    scenarios = list_scenarios()
    assert scenarios, "expected at least one scenario fixture"
    for scenario_id in scenarios:
        state = build_shared_state(scenario_id)
        SharedScenarioState.model_validate(state)


def test_all_canonical_plans_validate():
    for scenario_id in list_scenarios():
        for plan in load_scenario(scenario_id)["canonical_plans"]:
            CandidatePlan.model_validate(plan)


def test_all_optimiser_responses_validate():
    for scenario_id in list_scenarios():
        scenario = load_scenario(scenario_id)
        for plan in scenario["canonical_plans"]:
            response = evaluate(scenario, plan)
            OptimiserResponse.model_validate(response)
