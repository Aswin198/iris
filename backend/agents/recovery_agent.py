import json
import re
from datetime import datetime

from backend.llm.bedrock_client import BedrockClient


class RecoveryAgent:

    def __init__(self):
        self.llm = BedrockClient(
            model_id="anthropic.claude-3-5-sonnet-20240620-v1:0"
        )

    def generate_plans(
        self,
        scenario: dict,
        agent_results: list,
    ) -> list:

        system_prompt = """
You are the Recovery Planning Agent for IRIS,
an airport disruption recovery decision-support system.

You receive:
1. The shared airport disruption scenario
2. Assessments from specialised IRIS agents

Your task is to generate EXACTLY THREE distinct
candidate recovery plans.

IMPORTANT RULES:

- Do NOT decide which plan is best.
- A deterministic optimiser will rank the plans later.
- Respect constraints identified by specialist agents.
- Only use information provided in the scenario and agent results.
- Do NOT invent gates, passenger counts, weather data,
  aircraft information or operational facts.
- Return ONLY valid JSON.
- Do NOT use Markdown.
- Do NOT include explanation before or after the JSON.

Return exactly:

{
  "plans": [
    {
      "plan_id": "plan_A",
      "flight_id": "...",
      "recommended_gate": "...",
      "recommended_departure": "...",
      "actions": []
    },
    {
      "plan_id": "plan_B",
      "flight_id": "...",
      "recommended_gate": "...",
      "recommended_departure": "...",
      "actions": []
    },
    {
      "plan_id": "plan_C",
      "flight_id": "...",
      "recommended_gate": "...",
      "recommended_departure": "...",
      "actions": []
    }
  ]
}
"""

        user_prompt = f"""
SCENARIO:

{json.dumps(scenario, indent=2)}

SPECIALIST AGENT RESULTS:

{json.dumps(agent_results, indent=2)}

Generate exactly three candidate recovery plans.
"""

        try:
            response = self.llm.ask(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                max_tokens=2000,
                temperature=0.0,
            )

            cleaned = self._extract_json(response)

            parsed = json.loads(cleaned)

            plans = parsed.get("plans", [])

            if len(plans) != 3:
                raise ValueError(
                    "Recovery Agent must generate exactly 3 plans."
                )

            expected_ids = [
                "plan_A",
                "plan_B",
                "plan_C",
            ]

            for index, plan in enumerate(plans):

                plan["plan_id"] = expected_ids[index]

                required_fields = [
                    "plan_id",
                    "flight_id",
                    "recommended_gate",
                    "recommended_departure",
                    "actions",
                ]

                for field in required_fields:
                    if field not in plan:
                        raise ValueError(
                            f"Recovery plan missing required field: {field}"
                        )

            return self._ensure_strategy_diversity(plans, scenario)

        except Exception as error:

            print(
                f"Recovery Agent unavailable: {error}"
            )

            print(
                "Using deterministic fallback recovery plans."
            )

            return self._fallback_plans(
                scenario
            )

    @staticmethod
    def _ensure_strategy_diversity(plans: list, scenario: dict) -> list:
        """Normalize the replay's three strategy shapes before scoring."""
        flight = scenario["flight"]
        current_gate = flight["current_gate"]
        alternatives = scenario.get("gate", {}).get("alternative_gates", [])
        nearest_gate = alternatives[0] if alternatives else current_gate
        alternate_gate = alternatives[1] if len(alternatives) > 1 else nearest_gate
        ready = datetime.fromisoformat(flight["aircraft_ready_time"])
        strategies = [
            (current_gate, ready, [
                "Retain the current gate",
                "Depart once the aircraft is operationally ready",
            ]),
            (nearest_gate, ready, [
                f"Relocate the aircraft to nearest feasible stand {nearest_gate}",
                "Depart once the aircraft is operationally ready",
            ]),
            (alternate_gate, ready, [
                f"Relocate the aircraft to alternative stand {alternate_gate}",
                "Use the alternate stand at the earliest weather-adjusted ready time",
            ]),
        ]
        for plan, (gate, departure, actions) in zip(plans, strategies):
            plan["flight_id"] = flight["flight_id"]
            plan["recommended_gate"] = gate
            plan["recommended_departure"] = departure.isoformat()
            plan["actions"] = actions
        return plans

    def _extract_json(
        self,
        text: str,
    ) -> str:

        if not text:
            raise ValueError(
                "Recovery Agent returned an empty response."
            )

        text = text.strip()

        # Remove ```json fences if the LLM adds them
        text = re.sub(
            r"^```(?:json)?\s*",
            "",
            text,
            flags=re.IGNORECASE,
        )

        text = re.sub(
            r"\s*```$",
            "",
            text,
        )

        # Extract first JSON object from the response
        start = text.find("{")
        end = text.rfind("}")

        if start == -1 or end == -1:
            raise ValueError(
                "No JSON object found in Recovery Agent response."
            )

        return text[start:end + 1].strip()

    def _fallback_plans(
        self,
        scenario: dict,
    ) -> list:

        flight = scenario["flight"]

        gate_data = scenario.get(
            "gate",
            {}
        )

        alternative_gates = gate_data.get(
            "alternative_gates",
            []
        )

        current_gate = flight[
            "current_gate"
        ]

        ready_time = flight[
            "aircraft_ready_time"
        ]

        gate_a = (
            alternative_gates[0]
            if len(alternative_gates) > 0
            else current_gate
        )

        gate_b = (
            alternative_gates[1]
            if len(alternative_gates) > 1
            else gate_a
        )

        return [
            {
                "plan_id": "plan_A",
                "flight_id": flight[
                    "flight_id"
                ],
                "recommended_gate":
                    current_gate,
                "recommended_departure":
                    ready_time,
                "actions": [
                    "Retain the current gate",
                    "Accept the delay while retaining the current stand"
                ]
            },

            {
                "plan_id": "plan_B",
                "flight_id": flight[
                    "flight_id"
                ],
                "recommended_gate":
                    gate_a,
                "recommended_departure":
                    ready_time,
                "actions": [
                    f"Reassign the aircraft to {gate_a}",
                    "Depart once the aircraft is operationally ready"
                ]
            },

            {
                "plan_id": "plan_C",
                "flight_id": flight[
                    "flight_id"
                ],
                "recommended_gate":
                    gate_b,
                "recommended_departure":
                    ready_time,
                "actions": [
                    f"Relocate the aircraft to alternative stand {gate_b}",
                    "Use the alternate stand at the earliest weather-adjusted ready time"
                ]
            }
        ]
