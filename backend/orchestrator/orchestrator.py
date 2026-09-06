from backend.integrations.agent_api_client import (
    AgentAPIClient,
)
from backend.agents.gate_agent import GateAgent
from backend.agents.ground_agent import GroundAgent
from backend.agents.passenger_agent import PassengerAgent
from backend.agents.recovery_agent import RecoveryAgent
from datetime import datetime
from backend.orchestrator.state_builder import (
    build_shared_state,
)


class IRISOrchestrator:

    def __init__(self):

        self.agent_api = AgentAPIClient()

        self.specialist_agents = [
            GateAgent(),
            GroundAgent(),
            PassengerAgent(),
        ]

        self.recovery_agent = RecoveryAgent()

    def run(
        self,
        request: dict,
    ) -> dict:

        scenario = build_shared_state(
            request
        )

        agent_results = []

        print("Calling flight_agent API...")

        try:
            flight_result = (
                self.agent_api.get_flight(
                    request
                )
            )

            print("flight_agent: API SUCCESS")

            agent_results.append(
                flight_result
            )

        except Exception as error:
            print(
                f"flight_agent API unavailable: {error}"
            )


        print("Calling weather_agent API...")

        try:
            weather_result = (
                self.agent_api.get_weather(
                    "WSSS"
                )
            )

            print("weather_agent: API SUCCESS")

            agent_results.append(
                weather_result
            )

        except Exception as error:
            print(
                f"weather_agent API unavailable: {error}"
            )


        local_results = (
            self._run_specialists(
                scenario
            )
        )

        agent_results.extend(
            local_results
        )

        plans = (
            self.recovery_agent
            .generate_plans(
                scenario,
                agent_results,
            )
        )

        scored_plans = (
            self._mock_optimizer(
                scenario,
                plans,
            )
        )

        feasible_plans = [
            result
            for result in scored_plans
            if result["feasible"]
        ]

        if not feasible_plans:
            return {
                "scenario_id": scenario[
                    "scenario_id"
                ],
                "status": "no_feasible_plan",
                "recommended_plan": None,
                "impact": {},
                "reasoning_summary":
                    "No feasible recovery plan was found.",
                "agent_results": agent_results,
            }

        best = min(
            feasible_plans,
            key=lambda item: item["score"],
        )

        selected_plan = next(
            plan
            for plan in plans
            if plan["plan_id"]
            == best["plan_id"]
        )

        return self._build_response(
            scenario,
            selected_plan,
            best,
            agent_results,
        )

    def _run_specialists(
        self,
        scenario: dict,
    ) -> list:

        results = []

        for agent in self.specialist_agents:

            print(
                f"Running {agent.name}..."
            )

            result = agent.analyse(
                scenario
            )

            results.append(
                result
            )

        return results

    def _mock_optimizer(
        self,
        scenario: dict,
        plans: list,
    ) -> list:

        mock_scores = [
            45.0,
            23.5,
            52.0,
        ]

        results = []

        for index, plan in enumerate(plans):

            scheduled_departure = datetime.fromisoformat(
                scenario["flight"]["scheduled_departure"]
            )

            recommended_departure = datetime.fromisoformat(
                plan["recommended_departure"]
            )

            departure_delay_minutes = max(
                0,
                int(
                    (
                        recommended_departure
                        - scheduled_departure
                    ).total_seconds() / 60
                ),
            )

            results.append(
                {
                    "plan_id": plan["plan_id"],

                    "feasible": True,

                    "score": mock_scores[index],

                    "metrics": {
                        "departure_delay_minutes":
                            departure_delay_minutes,

                        "gate_conflicts":
                            0,

                        "passengers_at_risk":
                            4 + index * 2,

                        "downstream_delay_minutes":
                            12 + index * 4,
                    },

                    "constraint_violations":
                        [],
                }
            )

        return results

    def _build_response(
        self,
        scenario: dict,
        plan: dict,
        optimizer_result: dict,
        agent_results: list,
    ) -> dict:

        metrics = optimizer_result[
            "metrics"
        ]

        return {
            "scenario_id":
                scenario["scenario_id"],

            "status":
                "recommendation_ready",

            "recommended_plan": {
                "plan_id":
                    plan["plan_id"],

                "flight_id":
                    plan["flight_id"],

                "original_gate":
                    scenario[
                        "flight"
                    ][
                        "current_gate"
                    ],

                "recommended_gate":
                    plan[
                        "recommended_gate"
                    ],

                "original_departure":
                    scenario[
                        "flight"
                    ][
                        "scheduled_departure"
                    ],

                "recommended_departure":
                    plan[
                        "recommended_departure"
                    ],

                "expected_delay_minutes":
                    metrics[
                        "departure_delay_minutes"
                    ],

                "score":
                    optimizer_result[
                        "score"
                    ],
            },

            "impact": {
                "gate_conflict_avoided":
                    metrics[
                        "gate_conflicts"
                    ] == 0,

                "passengers_at_risk":
                    metrics[
                        "passengers_at_risk"
                    ],

                "downstream_delay_minutes":
                    metrics[
                        "downstream_delay_minutes"
                    ],
            },

            "reasoning_summary":
                (
                    f"{plan['plan_id']} was "
                    f"selected as the lowest-scoring "
                    f"feasible recovery strategy."
                ),

            "agent_results":
                agent_results,
        }