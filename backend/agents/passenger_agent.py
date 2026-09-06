import json

from backend.agents.base_agent import BaseAgent


class PassengerAgent(BaseAgent):

    def __init__(self):
        super().__init__(
            "passenger_agent"
        )

    def analyse(
        self,
        scenario: dict,
    ) -> dict:

        passenger_context = {
            "flight": {
                "flight_id":
                    scenario["flight"]["flight_id"],

                "scheduled_departure":
                    scenario["flight"]["scheduled_departure"],

                "aircraft_ready_time":
                    scenario["flight"]["aircraft_ready_time"],
            },

            "passengers":
                scenario["passengers"],
        }

        system_prompt = """
You are the Passenger Impact Agent for IRIS.

Analyse ONLY passenger disruption.

Consider:
- total passengers
- connecting passengers
- passengers currently at risk

Do NOT analyse weather, gates or ground operations.

Return ONLY valid JSON:

{
  "agent": "passenger_agent",
  "status": "completed",
  "severity": "low | medium | high | critical",
  "summary": "short summary",
  "findings": [],
  "constraints": [],
  "recommended_actions": []
}
"""

        user_prompt = f"""
Analyse passenger impact:

{json.dumps(passenger_context, indent=2)}
"""

        return self.run_json_prompt(
            system_prompt,
            user_prompt,
            fallback_factory=lambda:
                self._fallback(
                    passenger_context
                ),
        )

    def _fallback(
        self,
        context: dict,
    ) -> dict:

        passengers = context[
            "passengers"
        ]

        at_risk = passengers.get(
            "at_risk_connections",
            0,
        )

        severity = (
            "high"
            if at_risk >= 20
            else "medium"
            if at_risk > 0
            else "low"
        )

        return {
            "agent":
                "passenger_agent",

            "status":
                "completed",

            "severity":
                severity,

            "summary":
                f"{at_risk} passenger connections are currently at risk.",

            "findings": [
                f"Total passengers: {passengers.get('total_passengers')}",
                f"Connecting passengers: {passengers.get('connecting_passengers')}",
                f"At-risk connections: {at_risk}",
            ],

            "constraints": [
                {
                    "type":
                        "at_risk_connections",

                    "value":
                        at_risk,
                }
            ],

            "recommended_actions": [
                "Prioritise recovery actions that minimise additional connection risk."
            ],
        }