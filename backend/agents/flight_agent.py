import json
from datetime import datetime

from backend.agents.base_agent import BaseAgent


class FlightAgent(BaseAgent):

    def __init__(self):
        super().__init__("flight_agent")

    def analyse(self, scenario: dict) -> dict:

        flight_context = {
            "flight":
                scenario["flight"]
        }

        system_prompt = """
You are the Flight Operations Agent for IRIS.

Analyse ONLY flight schedule feasibility.

Consider:
- scheduled departure
- scheduled arrival
- aircraft ready time

Determine whether the original departure
remains operationally feasible.

Do NOT analyse weather, gates,
passengers or ground operations.

Return ONLY valid JSON:

{
  "agent": "flight_agent",
  "status": "completed",
  "severity": "low | medium | high | critical",
  "summary": "short summary",
  "findings": [],
  "constraints": [],
  "recommended_actions": []
}
"""

        user_prompt = f"""
Analyse flight schedule feasibility:

{json.dumps(flight_context, indent=2)}
"""

        return self.run_json_prompt(
            system_prompt,
            user_prompt,
            fallback_factory=lambda:
                self._fallback(
                    flight_context
                ),
        )

    def _fallback(
        self,
        context: dict,
    ) -> dict:

        flight = context[
            "flight"
        ]

        scheduled = (
            datetime.fromisoformat(
                flight[
                    "scheduled_departure"
                ]
            )
        )

        ready = (
            datetime.fromisoformat(
                flight[
                    "aircraft_ready_time"
                ]
            )
        )

        delay = max(
            0,
            int(
                (
                    ready - scheduled
                ).total_seconds()
                / 60
            ),
        )

        severity = (
            "high"
            if delay >= 60
            else "medium"
            if delay > 0
            else "low"
        )

        return {
            "agent": "flight_agent",
            "status": "completed",
            "severity": severity,

            "summary":
                (
                    f"Original departure is infeasible; "
                    f"aircraft readiness implies a "
                    f"{delay}-minute delay."
                )
                if delay > 0
                else
                "Aircraft is ready for the scheduled departure.",

            "findings": [
                f"Scheduled departure: {flight['scheduled_departure']}",
                f"Aircraft ready time: {flight['aircraft_ready_time']}",
                f"Minimum expected departure delay: {delay} minutes",
            ],

            "constraints": [
                {
                    "type":
                        "earliest_departure",

                    "value":
                        flight[
                            "aircraft_ready_time"
                        ],
                }
            ],

            "recommended_actions": [
                "Use aircraft ready time as the earliest feasible departure."
            ],
        }