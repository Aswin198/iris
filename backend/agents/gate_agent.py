import json

from backend.agents.base_agent import BaseAgent


class GateAgent(BaseAgent):

    def __init__(self):
        super().__init__("gate_agent")

    def analyse(self, scenario: dict) -> dict:

        gate_context = {
            "flight": {
                "flight_id":
                    scenario["flight"]["flight_id"],
                "current_gate":
                    scenario["flight"]["current_gate"],
            },

            "gate":
                scenario["gate"],
        }

        system_prompt = """
You are the Gate Operations Agent for IRIS.

Your responsibility is ONLY airport gate operations.

Analyse:
- current gate
- gate conflicts
- gate occupancy deadline
- alternative available gates

Do NOT analyse weather, passenger impact,
ground operations or make the final recovery decision.

Do not invent gates.

Return ONLY valid JSON:

{
  "agent": "gate_agent",
  "status": "completed",
  "severity": "low | medium | high | critical",
  "summary": "short summary",
  "findings": [],
  "constraints": [],
  "recommended_actions": []
}
"""

        user_prompt = f"""
Analyse this gate situation:

{json.dumps(gate_context, indent=2)}
"""

        return self.run_json_prompt(
            system_prompt,
            user_prompt,
            fallback_factory=lambda:
                self._fallback(gate_context),
        )

    def _fallback(
        self,
        context: dict,
    ) -> dict:

        gate = context["gate"]

        current_gate = gate[
            "current_gate"
        ]

        alternatives = gate.get(
            "alternative_gates",
            [],
        )

        conflict = gate.get(
            "conflict",
            False,
        )

        conflict_time = gate.get(
            "conflict_time"
        )

        if conflict:

            return {
                "agent": "gate_agent",
                "status": "completed",
                "severity": "high",

                "summary":
                    f"Gate {current_gate} has an upcoming conflict.",

                "findings": [
                    f"Gate {current_gate} is currently assigned.",
                    f"Gate conflict detected at {conflict_time}.",
                    f"Alternative gates available: {', '.join(alternatives)}",
                ],

                "constraints": [
                    {
                        "type":
                            "gate_clearance",

                        "value":
                            conflict_time,
                    }
                ],

                "recommended_actions": [
                    "Evaluate reassignment to an available alternative gate."
                ],
            }

        return {
            "agent": "gate_agent",
            "status": "completed",
            "severity": "low",

            "summary":
                f"No conflict detected for Gate {current_gate}.",

            "findings": [
                f"Gate {current_gate} remains available."
            ],

            "constraints": [],

            "recommended_actions": [
                "Retain the current gate."
            ],
        }