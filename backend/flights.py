REPLAY_DATE = "2026-09-08"  # Tuesday
REPLAY_START_MINUTE = 12 * 60

ARRIVALS = [
    ("SQ858", "HKG", "SIN", "T3", "B8", "A350-900", 12 * 60 + 15),
    ("TR678", "BKK", "SIN", "T1", "D40", "A320neo", 12 * 60 + 45),
    ("SQ318", "LHR", "SIN", "T3", "B8", "777-300ER", 14 * 60),
    ("QF001", "SYD", "SIN", "T1", "D40", "A380", 15 * 60 + 15),
    ("SQ221", "SYD", "SIN", "T2", "F40", "A350-900", 16 * 60),
    ("EK354", "DXB", "SIN", "T3", "B10", "777-300ER", 17 * 60 + 30),
    ("MH601", "KUL", "SIN", "T2", "F40", "A330-300", 18 * 60 + 10),
    ("SQ12", "NRT", "SIN", "T3", "B12", "A380", 19 * 60),
    ("TK54", "IST", "SIN", "T1", "D40", "777-300ER", 20 * 60 + 20),
    ("SQ231", "SYD", "SIN", "T2", "F40", "787-10", 21 * 60 + 45),
    ("TR16", "MEL", "SIN", "T1", "D40", "787-9", 22 * 60 + 30),
    ("SQ286", "AKL", "SIN", "T3", "B10", "787-10", 23 * 60 + 50),
]


def _iso(minute: int) -> str:
    normalized = minute % (24 * 60)
    return f"{REPLAY_DATE}T{normalized // 60:02d}:{normalized % 60:02d}:00+08:00"


def list_flights(replay_minute: float = REPLAY_START_MINUTE) -> tuple[list[dict], str]:
    """Return upcoming arrivals and mark flights inside the five-minute window."""
    visible = []
    for flight_id, origin, destination, terminal, gate, aircraft_type, arrival_minute in ARRIVALS:
        if arrival_minute < replay_minute:
            continue
        outbound_minute = arrival_minute + 95
        visible.append({
            "flight_id": flight_id,
            "origin": origin,
            "destination": destination,
            "scheduled_departure": _iso(outbound_minute),
            "scheduled_arrival": _iso(arrival_minute),
            "terminal": terminal,
            "gate": gate,
            "aircraft_type": aircraft_type,
            "inbound_delay_minutes": 0,
            "minutes_until_arrival": max(0, arrival_minute - replay_minute),
            "selectable": replay_minute >= arrival_minute - 15,
            "outbound_flight_id": f"{flight_id}O",
            "outbound_destination": "LHR" if flight_id.startswith("SQ") else "SYD",
            "outbound_departure": _iso(outbound_minute),
            "data_source": "replay_mock",
        })
    return visible, "replay_mock"
