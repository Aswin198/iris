import json

from backend.agents.base_agent import BaseAgent


class WeatherAgent(BaseAgent):

    def __init__(self):
        super().__init__("weather_agent")

    def analyse(self, scenario: dict) -> dict:

        weather_context = {
            "weather":
                scenario["weather"]
        }

        system_prompt = """
You are the Aviation Weather Agent for IRIS.

Analyse ONLY aviation weather risk.

Consider:
- weather condition
- risk level
- visibility
- wind

Do NOT analyse gates, passengers,
ground operations or flight scheduling.

Return ONLY valid JSON:

{
  "agent": "weather_agent",
  "status": "completed",
  "severity": "low | medium | high | critical",
  "summary": "short summary",
  "findings": [],
  "constraints": [],
  "recommended_actions": []
}
"""

        user_prompt = f"""
Analyse this aviation weather:

{json.dumps(weather_context, indent=2)}
"""

        return self.run_json_prompt(
            system_prompt,
            user_prompt,
            fallback_factory=lambda:
                self._fallback(weather_context),
        )

    def _fallback(
        self,
        context: dict,
    ) -> dict:

        weather = context[
            "weather"
        ]

        risk = weather.get(
            "risk_level",
            "low",
        )

        condition = weather.get(
            "condition",
            "unknown",
        )

        return {
            "agent": "weather_agent",
            "status": "completed",
            "severity": risk,

            "summary":
                f"Weather risk assessed as {risk} due to {condition}.",

            "findings": [
                f"Condition: {condition}",
                f"Visibility: {weather.get('visibility_m')} m",
                f"Wind speed: {weather.get('wind_speed_kt')} kt",
            ],

            "constraints": [
                {
                    "type":
                        "weather_risk",
                    "value":
                        risk,
                }
            ],

            "recommended_actions": [
                "Continue monitoring aviation weather conditions."
            ],
        }