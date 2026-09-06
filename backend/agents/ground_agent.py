import json

from backend.agents.base_agent import BaseAgent


class GroundAgent(BaseAgent):

    def __init__(self):
        super().__init__("ground_agent")

    def analyse(self, scenario: dict) -> dict:

        ground_context = {
            "flight": {
                "flight_id":
                    scenario["flight"]["flight_id"],

                "scheduled_departure":
                    scenario["flight"]["scheduled_departure"],
            },

            "ground_operations":
                scenario["ground_operations"],
        }

        system_prompt = """
You are the Ground Operations Agent for IRIS.

Your responsibility is ONLY aircraft turnaround readiness.

Analyse:
- baggage loading
- refuelling
- cleaning
- boarding
- estimated ready time

Do NOT analyse weather, gates,
passengers or make final recovery decisions.

Return ONLY valid JSON:

{
  "agent": "ground_agent",
  "status": "completed",
  "severity": "low | medium | high | critical",
  "summary": "short summary",
  "findings": [],
  "constraints": [],
  "recommended_actions": []
}
"""

        user_prompt = f"""
Analyse ground operations:

{json.dumps(ground_context, indent=2)}
"""

        return self.run_json_prompt(
            system_prompt,
            user_prompt,
            fallback_factory=lambda:
                self._fallback(ground_context),
        )

    def _fallback(
        self,
        context: dict,
    ) -> dict:

        ground = context[
            "ground_operations"
        ]

        incomplete = []

        if ground.get(
            "baggage_percent",
            100,
        ) < 100:
            incomplete.append(
                "baggage loading"
            )

        if not ground.get(
            "refuelling_complete",
            False,
        ):
            incomplete.append(
                "refuelling"
            )

        if not ground.get(
            "cleaning_complete",
            False,
        ):
            incomplete.append(
                "cleaning"
            )

        if ground.get(
            "boarding_percent",
            100,
        ) < 100:
            incomplete.append(
                "boarding"
            )

        severity = (
            "medium"
            if incomplete
            else "low"
        )

        return {
            "agent": "ground_agent",
            "status": "completed",
            "severity": severity,

            "summary":
                "Ground turnaround activities remain incomplete."
                if incomplete
                else "Ground turnaround is complete.",

            "findings": [
                f"Baggage completion: {ground.get('baggage_percent')}%",
                f"Boarding completion: {ground.get('boarding_percent')}%",
                f"Estimated ready time: {ground.get('estimated_ready_time')}",
            ],

            "constraints": [
                {
                    "type":
                        "aircraft_ready_time",

                    "value":
                        ground.get(
                            "estimated_ready_time"
                        ),
                }
            ],

            "recommended_actions": [
                f"Complete outstanding activities: {', '.join(incomplete)}"
            ]
            if incomplete
            else [],
        }