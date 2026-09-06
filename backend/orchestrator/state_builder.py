from datetime import datetime, timedelta


def build_shared_state(
    request: dict,
) -> dict:

    flight = request["flight"]

    scheduled_departure = datetime.fromisoformat(
        flight["scheduled_departure"]
    )

    delays = []

    for disruption in request.get(
        "disruptions",
        [],
    ):
        delay = disruption.get(
            "delay_minutes",
            0,
        )

        delays.append(delay)

    largest_delay = max(
        delays,
        default=0,
    )

    ready_time = (
        scheduled_departure
        + timedelta(
            minutes=largest_delay
        )
    )

    gate_conflict_time = (
        scheduled_departure
        + timedelta(minutes=25)
    )

    return {
        "scenario_id": request["scenario_id"],

        "flight": {
            "flight_id": flight["flight_id"],
            "origin": flight["origin"],
            "destination": flight["destination"],
            "scheduled_departure": flight[
                "scheduled_departure"
            ],
            "scheduled_arrival": flight[
                "scheduled_arrival"
            ],
            "current_gate": flight["gate"],
            "aircraft_ready_time": (
                ready_time.isoformat()
            ),
        },

        "gate": {
            "current_gate": flight["gate"],
            "conflict": True,
            "conflict_time": (
                gate_conflict_time.isoformat()
            ),
            "alternative_gates": [
                "B10",
                "B12",
            ],
        },

        "ground_operations": {
            "baggage_percent": 75,
            "refuelling_complete": True,
            "cleaning_complete": True,
            "boarding_percent": 60,
            "estimated_ready_time": (
                ready_time.isoformat()
            ),
        },

        "passengers": {
            "total_passengers": 280,
            "connecting_passengers": 42,
            "at_risk_connections": 11,
        },
    }