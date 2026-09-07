import json
from datetime import datetime, timedelta
from math import ceil

from backend.integrations.agent_api_client import (
    AgentAPIClient,
)
from backend.agents.gate_agent import GateAgent
from backend.agents.ground_agent import GroundAgent
from backend.agents.passenger_agent import PassengerAgent
from backend.agents.recovery_agent import RecoveryAgent
from backend.orchestrator.state_builder import (
    build_shared_state,
)


class IRISOrchestrator:

    GATE_CHANGE_SCORE = 6.0
    GATE_DISTANCE_SCORE_PER_UNIT = 1.5
    # Synthetic prototype mapping — not an operational Changi rule.
    WEATHER_DELAY_MINUTES = {
        "low": 0,
        "medium": 5,
        "high": 15,
        "critical": 25,
    }

    @staticmethod
    def _gate_distance(current_gate: str, recommended_gate: str) -> int:
        """Use the stand number as the walking-distance proxy for this demo."""
        if current_gate == recommended_gate:
            return 0
        try:
            return abs(
                int("".join(filter(str.isdigit, recommended_gate)))
                - int("".join(filter(str.isdigit, current_gate)))
            )
        except (TypeError, ValueError):
            return 0

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

        weather_result = None
        try:
            weather_result = (
                self.agent_api.get_weather(
                    "WSSS"
                )
            )

            print("weather_agent: API SUCCESS")

        except Exception as error:
            print(
                f"weather_agent API unavailable: {error}"
            )

        weather_result = self._apply_weather_impact(
            scenario,
            weather_result,
            request.get("weather_override"),
        )
        if weather_result:
            agent_results.append(weather_result)

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

        recovery_result = {
            "agent": "recovery_agent",
            "status": "completed",
            "severity": "low",
            "summary": (
                f"Recovery planning completed with "
                f"{len(plans)} candidate plans."
            ),
            "findings": [
                (
                    f"{plan['plan_id']}: "
                    f"gate {plan['recommended_gate']}, "
                    f"departure {plan['recommended_departure']}"
                )
                for plan in plans
            ],
            "constraints": [],
            "recommended_actions": [],
        }

        agent_results.append(
            recovery_result
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
            plans,
            scored_plans,
        )

    def _apply_weather_impact(
        self,
        scenario: dict,
        weather_result: dict | None,
        weather_override: str | None = None,
    ) -> dict | None:
        """Apply live weather or an explicit synthetic DEMO REPLAY override."""
        override = str(weather_override or "").lower()
        override_severities = {
            "clear": "low",
            "rain": "medium",
            "thunderstorm": "high",
        }

        if override in override_severities:
            severity = override_severities[override]
            if not weather_result or weather_result.get("status") == "failed":
                weather_result = {
                    "agent": "weather_agent",
                    "status": "completed",
                    "summary": "Synthetic scenario weather override applied for DEMO REPLAY.",
                    "findings": [],
                    "constraints": [],
                    "recommended_actions": [],
                }
            weather_result["status"] = "completed"
            weather_result["severity"] = severity
            weather_result["source"] = "scenario_override"
            weather_result["summary"] = (
                f"Scenario override: {override.title()} conditions used for "
                "prototype recovery simulation."
            )
            scenario["weather"]["condition"] = override
        elif not weather_result or weather_result.get("status") == "failed":
            # No adverse weather is inferred when the live specialist is unavailable.
            scenario["weather"]["condition"] = "clear"
            scenario["weather"]["risk_level"] = "low"
            return None
        else:
            severity = str(weather_result.get("severity", "low")).lower()

        if severity not in self.WEATHER_DELAY_MINUTES:
            severity = "low"
        delay_minutes = self.WEATHER_DELAY_MINUTES[severity]

        ready_time = datetime.fromisoformat(
            scenario["flight"]["aircraft_ready_time"]
        )
        adjusted_ready = ready_time + timedelta(minutes=delay_minutes)
        scenario["flight"]["aircraft_ready_time"] = adjusted_ready.isoformat()
        scenario["ground_operations"]["estimated_ready_time"] = adjusted_ready.isoformat()
        scenario["weather"]["risk_level"] = severity

        live_text = json.dumps(weather_result).lower()
        if override not in override_severities:
            if "thunderstorm" in live_text:
                scenario["weather"]["condition"] = "thunderstorm"
            elif "rain" in live_text:
                scenario["weather"]["condition"] = "rain"
            else:
                scenario["weather"]["condition"] = "clear"

        if override == "clear":
            explanation = (
                "Weather conditions are within normal operating limits; "
                "no additional weather delay applied."
            )
        elif override == "rain":
            explanation = (
                "Rain scenario conditions detected; prototype weather-impact "
                "model adds 5 minutes to the earliest feasible departure."
            )
        elif override == "thunderstorm":
            explanation = (
                "Thunderstorm scenario conditions detected; prototype "
                "weather-impact model adds 15 minutes to the earliest feasible departure."
            )
        elif severity == "low":
            explanation = (
                "Weather conditions are within normal operating limits; "
                "no additional weather delay applied."
            )
        elif severity == "high" and "thunderstorm" in live_text:
            explanation = (
                "Thunderstorm conditions detected; prototype weather-impact "
                "model adds 15 minutes to the earliest feasible departure."
            )
        elif severity == "medium":
            explanation = (
                "Adverse weather conditions detected; prototype weather-impact "
                "model adds 5 minutes to the earliest feasible departure."
            )
        elif severity == "critical":
            explanation = (
                "Severe weather conditions detected; prototype weather-impact "
                "model adds 25 minutes to the earliest feasible departure."
            )
        else:
            explanation = (
                "Adverse weather conditions detected; prototype weather-impact "
                "model adds 15 minutes to the earliest feasible departure."
            )

        if not isinstance(weather_result.get("findings"), list):
            weather_result["findings"] = []
        if not isinstance(weather_result.get("constraints"), list):
            weather_result["constraints"] = []
        if override in override_severities:
            weather_result["findings"] = [
                f"Scenario override: {override} weather selected for prototype recovery simulation.",
            ]
        weather_result["findings"].append(explanation)
        weather_result["constraints"].append(
            {
                "type": "prototype_weather_impact",
                "value": f"{delay_minutes} minutes",
            }
        )
        scenario["passengers"]["at_risk_connections"] = min(
            scenario["passengers"]["connecting_passengers"],
            ceil(
                scenario["passengers"]["connecting_passengers"]
                * max(
                    0,
                    int(
                        (
                            adjusted_ready
                            - datetime.fromisoformat(
                                scenario["flight"]["scheduled_departure"]
                            )
                        ).total_seconds()
                        / 60
                    ),
                )
                / 60,
            ),
        )
        return weather_result

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

        results = []

        for plan in plans:

            scheduled_departure = datetime.fromisoformat(
                scenario["flight"]["scheduled_departure"]
            )

            recommended_departure = datetime.fromisoformat(
                plan["recommended_departure"]
            )
            aircraft_ready_time = datetime.fromisoformat(
                scenario["flight"]["aircraft_ready_time"]
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

            allowed_gates = scenario["gate"].get("alternative_gates", [])
            current_gate = scenario["gate"]["current_gate"]
            gate_available = plan["recommended_gate"] in [
                current_gate,
                *allowed_gates,
            ]
            conflict_time = scenario["gate"].get("conflict_time")
            stand_clear_time = recommended_departure + timedelta(minutes=8)
            has_gate_conflict = bool(
                gate_available
                and plan["recommended_gate"] == current_gate
                and scenario["gate"].get("conflict")
                and conflict_time
                and stand_clear_time > datetime.fromisoformat(conflict_time)
            )
            next_occupancy = scenario.get("stand_occupancy", {}).get(
                plan["recommended_gate"]
            )
            has_next_occupancy_overlap = bool(
                next_occupancy
                and datetime.fromisoformat(scenario["flight"]["scheduled_arrival"])
                < datetime.fromisoformat(next_occupancy["end"])
                and stand_clear_time
                > datetime.fromisoformat(next_occupancy["start"])
            )
            gate_conflicts = int(
                not gate_available
                or has_gate_conflict
                or has_next_occupancy_overlap
            )
            connecting_passengers = int(
                scenario.get("passengers", {}).get("connecting_passengers", 42)
            )
            passengers_at_risk = min(
                connecting_passengers,
                ceil(connecting_passengers * departure_delay_minutes / 60),
            )
            downstream_delay = round(departure_delay_minutes * 0.65)
            gate_distance_units = self._gate_distance(
                current_gate,
                plan["recommended_gate"],
            )
            gate_change_score = (
                self.GATE_CHANGE_SCORE
                if plan["recommended_gate"] != current_gate
                else 0
            )

            violations = []
            if recommended_departure < aircraft_ready_time:
                violations.append(
                    f"Aircraft is not ready until {aircraft_ready_time.isoformat()}"
                )
            if not gate_available:
                violations.append(
                    f"Stand {plan['recommended_gate']} is occupied during the aircraft turnaround"
                )
            elif has_gate_conflict:
                violations.append(
                    f"Stand {current_gate} must be clear by {conflict_time}"
                )
            elif has_next_occupancy_overlap:
                violations.append(
                    f"Stand {plan['recommended_gate']} is required by "
                    f"{next_occupancy['flight_id']} from "
                    f"{next_occupancy['start'][11:16]}; weather-adjusted "
                    "stand clearance would overlap the next allocation."
                )

            feasible = gate_conflicts == 0 and not violations
            score = round(
                departure_delay_minutes
                + passengers_at_risk * 2
                + downstream_delay * 0.5
                + gate_change_score
                + gate_distance_units * self.GATE_DISTANCE_SCORE_PER_UNIT,
                1,
            ) if feasible else None

            results.append(
                {
                    "plan_id": plan["plan_id"],

                    "feasible": feasible,

                    "score": score,

                    "metrics": {
                        "departure_delay_minutes":
                            departure_delay_minutes,

                        "gate_conflicts": gate_conflicts,

                        "passengers_at_risk": passengers_at_risk,

                        "downstream_delay_minutes": downstream_delay,

                        "gate_distance_units": gate_distance_units,
                    },

                    "constraint_violations": violations,
                }
            )

        return results

    def _build_response(
        self,
        scenario: dict,
        plan: dict,
        optimizer_result: dict,
        agent_results: list,
        plans: list,
        scored_plans: list,
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

            "candidate_plans":
                plans,

            "optimiser_results":
                scored_plans,
                    }
