import requests


class AgentAPIClient:

    WEATHER_URL = (
        "https://fx6tfrojlc.execute-api.us-east-1.amazonaws.com"
        "/agents/weather"
    )

    FLIGHT_URL = (
        "https://fx6tfrojlc.execute-api.us-east-1.amazonaws.com"
        "/agents/flight"
    )

    def get_weather(
        self,
        icao: str = "WSSS",
    ) -> dict:

        payload = {
            "scenario": {
                "flight": {
                    "origin_icao": icao
                }
            }
        }

        response = requests.post(
            self.WEATHER_URL,
            json=payload,
            timeout=15,
        )

        response.raise_for_status()

        return response.json()

    def get_flight(
        self,
        request: dict,
    ) -> dict:

        payload = {
            "scenario": {
                "flight": {
                    "flight_id":
                        request.get(
                            "tracking_flight_id",
                            request["flight"]["flight_id"],
                        )
                }
            },
            "disruptions":
                request.get("disruptions", []),
        }

        response = requests.post(
            self.FLIGHT_URL,
            json=payload,
            timeout=15,
        )

        response.raise_for_status()

        return response.json()
