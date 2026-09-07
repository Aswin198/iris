REPLAY_DATE = "2026-09-08"  # Tuesday
REPLAY_START_MINUTE = 13 * 60 + 54 + 50 / 60

ARRIVALS = [
    # Synthetic Tuesday replay schedule — not live Changi operational data.
    ("SQ858", "HKG", "SIN", "T3", "B14", "A350-900", 13 * 60 + 58, "SQ859", "HKG", 15 * 60 + 20, 0),
    ("SQ319", "LHR", "SIN", "T3", "B8", "B777-300ER", 14 * 60, "SQ318", "LHR", 14 * 60 + 20, 20),
    ("TR678", "BKK", "SIN", "T1", "D40", "A320neo", 14 * 60 + 4, "TR679", "BKK", 15 * 60 + 35, 0),
    ("SQ221", "SYD", "SIN", "T2", "F40", "A350-900", 14 * 60 + 8, "SQ222", "SYD", 15 * 60 + 40, 0),
    ("QF001", "SYD", "SIN", "T1", "D40", "A380", 15 * 60 + 15, "QF002", "SYD", 17 * 60, 0),
    ("EK354", "DXB", "SIN", "T3", "B10", "B777-300ER", 17 * 60 + 30, "EK355", "DXB", 19 * 60, 0),
    ("MH601", "KUL", "SIN", "T2", "F40", "A330-300", 18 * 60 + 10, "MH602", "KUL", 19 * 60 + 45, 0),
    ("SQ12", "NRT", "SIN", "T3", "B12", "A380", 19 * 60, "SQ11", "NRT", 20 * 60 + 40, 0),
    ("TK54", "IST", "SIN", "T1", "D40", "B777-300ER", 20 * 60 + 20, "TK55", "IST", 22 * 60, 0),
    ("SQ231", "SYD", "SIN", "T2", "F40", "B787-10", 21 * 60 + 45, "SQ232", "SYD", 23 * 60 + 10, 0),
    ("TR16", "MEL", "SIN", "T1", "D40", "B787-9", 22 * 60 + 30, "TR17", "MEL", 23 * 60 + 55, 0),
    ("SQ286", "AKL", "SIN", "T3", "B10", "B787-10", 23 * 60 + 50, "SQ285", "AKL", 25 * 60 + 20, 0),
]


def _iso(minute: int) -> str:
    normalized = minute % (24 * 60)
    return f"{REPLAY_DATE}T{normalized // 60:02d}:{normalized % 60:02d}:00+08:00"


def list_flights(replay_minute: float = REPLAY_START_MINUTE) -> tuple[list[dict], str]:
    """Return synthetic arrivals in the ETA -5 / ETA +30 minute visibility window."""
    visible = []
    for (
        flight_id, origin, destination, terminal, gate, aircraft_type,
        arrival_minute, outbound_flight_id, outbound_destination,
        outbound_minute, inbound_delay,
    ) in ARRIVALS:
        if replay_minute < arrival_minute - 5 or replay_minute > arrival_minute + 30:
            continue
        visible.append({
            "flight_id": flight_id,
            "origin": origin,
            "destination": destination,
            "scheduled_departure": _iso(outbound_minute),
            "scheduled_arrival": _iso(arrival_minute),
            "terminal": terminal,
            "gate": gate,
            "aircraft_type": aircraft_type,
            "inbound_delay_minutes": inbound_delay,
            "minutes_until_arrival": max(0, arrival_minute - replay_minute),
            "selectable": True,
            "outbound_flight_id": outbound_flight_id,
            "outbound_destination": outbound_destination,
            "outbound_departure": _iso(outbound_minute),
            "data_source": "replay_mock",
        })
    return visible, "replay_mock"
