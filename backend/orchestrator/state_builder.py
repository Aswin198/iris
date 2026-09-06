from datetime import datetime, timedelta


def build_shared_state(
    request: dict,
) -> dict:

    flight = request["flight"]

    scheduled_departure = datetime.fromisoformat(
        flight["scheduled_departure"]
    )

    disruptions = request.get("disruptions", [])
    late_incoming = sum(
        disruption.get("delay_minutes", 0)
        for disruption in disruptions
        if disruption.get("type") == "late_incoming_aircraft"
    )
    # Recovery timing is intentionally driven only by inbound aircraft delay.
    # Other controls remain available as contextual demo inputs.
    ground_delay = 0
    baggage_percent = 100
    baggage_delay = 0
    weather_condition = next(
        (
            disruption.get("condition", "clear")
            for disruption in disruptions
            if disruption.get("type") == "weather"
        ),
        "clear",
    )
    connecting_passengers = next(
        (
            disruption.get("connecting_passengers", 42)
            for disruption in disruptions
            if disruption.get("type") == "passenger_connection_risk"
        ),
        42,
    )
    total_delay = late_incoming

    ready_time = (
        scheduled_departure + timedelta(minutes=total_delay)
    )

    turnaround_start = datetime.fromisoformat(flight["scheduled_arrival"])

    # Synthetic stand schedule shared with the replay board.
    stand_claims = {
        "B8": (
            scheduled_departure.replace(hour=14, minute=25, second=0, microsecond=0),
            scheduled_departure.replace(hour=15, minute=15, second=0, microsecond=0),
        ),
        "B10": (
            scheduled_departure.replace(hour=12, minute=30, second=0, microsecond=0),
            scheduled_departure.replace(hour=13, minute=45, second=0, microsecond=0),
        ),
    }
    claim_start, claim_end = stand_claims.get(
        flight["gate"],
        (None, None),
    )
    requested_gate_conflict = any(
        disruption.get("type") == "gate_conflict"
        for disruption in disruptions
    )
    schedule_clash = bool(
        requested_gate_conflict
        and claim_start
        and claim_end
        and turnaround_start < claim_end
        and ready_time + timedelta(minutes=8) > claim_start
    )
    gate_conflict_time = claim_start if schedule_clash else None

    # Synthetic stand occupancy used by the replay board. B10 is occupied by
    # SQ638 through 13:45, so it cannot host an aircraft whose turnaround
    # overlaps that interval.
    occupied_until = {
        "B10": scheduled_departure.replace(
            hour=13,
            minute=45,
            second=0,
            microsecond=0,
        ),
    }
    alternative_gates = []
    for gate in ("B10", "B12", "B14"):
        blocked_until = occupied_until.get(gate)
        blocked_from = (
            scheduled_departure.replace(hour=12, minute=30, second=0, microsecond=0)
            if gate == "B10"
            else None
        )
        overlaps = bool(
            blocked_from
            and turnaround_start < blocked_until
            and ready_time > blocked_from
        )
        if blocked_until is None or not overlaps:
            alternative_gates.append(gate)

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

        "weather": {
            "condition": weather_condition,
            "risk_level": (
                "high"
                if weather_condition == "thunderstorm"
                else "medium"
                if weather_condition == "rain"
                else "low"
            ),
            "visibility_m": 5000 if weather_condition == "thunderstorm" else 9999,
            "wind_speed_kt": 16 if weather_condition == "thunderstorm" else 8,
            "wind_direction_deg": 220,
        },

        "gate": {
            "current_gate": flight["gate"],
            "conflict": schedule_clash,
            "conflict_time": (
                gate_conflict_time.isoformat()
                if gate_conflict_time
                else None
            ),
            "alternative_gates": alternative_gates,
        },

        "ground_operations": {
            "baggage_percent": baggage_percent,
            "refuelling_complete": True,
            "cleaning_complete": True,
            "boarding_percent": 60,
            "estimated_ready_time": (
                ready_time.isoformat()
            ),
        },

        "passengers": {
            "total_passengers": 280,
            "connecting_passengers": connecting_passengers,
            "at_risk_connections": max(0, round(connecting_passengers * total_delay / 60)),
        },
    }
