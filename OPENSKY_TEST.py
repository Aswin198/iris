import requests

# ---------------------------------------------------------------------------
# 1. Raw API call
# ---------------------------------------------------------------------------

def fetch_opensky_state(icao24=None, bbox=None):
    """
    OpenSky public API - no auth needed for basic/anonymous access (rate-limited).
    icao24: specific aircraft transponder ID (hex string, lowercase)
    bbox: (lamin, lomin, lamax, lomax) to filter by area, e.g. around Singapore
    """
    url = "https://opensky-network.org/api/states/all"
    params = {}
    if bbox:
        lamin, lomin, lamax, lomax = bbox
        params = {"lamin": lamin, "lomin": lomin, "lamax": lamax, "lomax": lomax}
    r = requests.get(url, params=params, timeout=10)
    r.raise_for_status()
    return r.json()


# ---------------------------------------------------------------------------
# 2. Normalize raw state vectors (positional arrays) into named dicts
# ---------------------------------------------------------------------------

OPENSKY_FIELDS = [
    "icao24", "callsign", "origin_country", "time_position", "last_contact",
    "longitude", "latitude", "baro_altitude", "on_ground", "velocity",
    "true_track", "vertical_rate", "sensors", "geo_altitude",
    "squawk", "spi", "position_source"
]


def normalize_states(raw_data):
    """Converts OpenSky's positional arrays into named dicts."""
    return [dict(zip(OPENSKY_FIELDS, state)) for state in raw_data.get("states", [])]


def find_flight_by_callsign(states, callsign_prefix):
    """Matches a flight_id like 'SIA318' against OpenSky's padded callsign field."""
    for s in states:
        if s["callsign"] and s["callsign"].strip().startswith(callsign_prefix):
            return s
    return None


# ---------------------------------------------------------------------------
# 3. IATA -> ICAO airline code mapping (hardcoded for hackathon demo scope)
# ---------------------------------------------------------------------------

IATA_TO_ICAO_AIRLINE = {
    "SQ": "SIA",   # Singapore Airlines
    "TR": "TGW",   # Scoot
    "MI": "SLK",   # SilkAir (if still relevant)
    "TG": "THA",   # Thai Airways
    "QF": "QFA",   # Qantas
    "KL": "KLM",   # KLM
    "LX": "SWR",   # Swiss
    "6E": "IGO",   # IndiGo
    "VJ": "VJC",   # VietJet
    "ET": "ETH",   # Ethiopian
    "TK": "THY",   # Turkish Airlines
}


def flight_id_to_callsign_prefix(flight_id: str) -> str:
    """Converts 'SQ318' -> 'SIA318' for OpenSky callsign matching."""
    for i, ch in enumerate(flight_id):
        if ch.isdigit():
            iata_code, number = flight_id[:i], flight_id[i:]
            break
    else:
        raise ValueError(f"Could not parse airline code from {flight_id}")

    icao_code = IATA_TO_ICAO_AIRLINE.get(iata_code)
    if not icao_code:
        raise ValueError(f"No ICAO mapping for airline code {iata_code}")

    return f"{icao_code}{number}"


# ---------------------------------------------------------------------------
# 4. Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Bounding box roughly around Singapore/Changi
    sg_bbox = (1.1, 103.5, 1.5, 104.2)

    data = fetch_opensky_state(bbox=sg_bbox)
    print(data)

    normalized = normalize_states(data)
    for s in normalized:
        print(s["callsign"].strip(), "-", s["origin_country"], "- on_ground:", s["on_ground"])

    # Test direct callsign match
    match = find_flight_by_callsign(normalized, "SIA135")
    print("\nDirect match (SIA135):", match)

    # Test flight_id -> callsign conversion (contract uses IATA-style flight_id, e.g. 'SQ135')
    prefix = flight_id_to_callsign_prefix("SQ135")
    print("\nLooking for:", prefix)
    match2 = find_flight_by_callsign(normalized, prefix)
    print("Match:", match2)

from datetime import datetime, timezone

def build_flight_agent_response(flight_id: str, scheduled_departure_iso: str, opensky_match: dict, delay_minutes_reported: int = None):
    """
    Builds the §4 Standard Agent Response for flight_agent.
    delay_minutes_reported: optional, if the disruption scenario already tells us
    the reported delay (from the /api/recovery request's `disruptions` list).
    """
    if opensky_match is None:
        return {
            "agent": "flight_agent",
            "status": "failed",
            "severity": "medium",
            "summary": f"No live tracking data found for {flight_id}.",
            "findings": [f"{flight_id} could not be located in current OpenSky data."],
            "constraints": [],
            "recommended_actions": ["Fall back to scheduled data; verify flight status manually."]
        }

    findings = []
    on_ground = opensky_match["on_ground"]
    findings.append(f"Aircraft is currently {'on ground' if on_ground else 'airborne'}.")

    if opensky_match.get("velocity") is not None:
        findings.append(f"Current ground speed: {opensky_match['velocity']:.1f} m/s.")

    severity = "low"
    summary = f"{flight_id} tracking data received; no significant disruption detected."

    if delay_minutes_reported:
        findings.append(f"Incoming aircraft delayed by {delay_minutes_reported} minutes.")
        severity = "high" if delay_minutes_reported > 15 else "medium"
        summary = "Incoming aircraft delay makes the original departure time infeasible." if delay_minutes_reported > 15 else \
                   "Minor incoming delay detected; may still be recoverable."

    return {
        "agent": "flight_agent",
        "status": "completed",
        "severity": severity,
        "summary": summary,
        "findings": findings,
        "constraints": [
            {"type": "aircraft_position_source", "value": "opensky"}
        ],
        "recommended_actions": (
            ["Reassess downstream schedule impact"] if severity in ("high", "critical") else []
        )
    }


# Test it against the SIA135 match you already have, simulating a disruption input
# (this mirrors what would come from the /api/recovery request's `disruptions` field)
import json
response = build_flight_agent_response(
    flight_id="SQ135",
    scheduled_departure_iso="2026-09-05T14:00:00+08:00",
    opensky_match=match2,
    delay_minutes_reported=20
)
print(json.dumps(response, indent=2))
