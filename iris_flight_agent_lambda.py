import json
import boto3
import urllib.request
import urllib.error
import urllib.parse

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

S3_BUCKET = "iris-hackathon-data-<yourname>"   # <-- replace with your actual bucket name
S3_FALLBACK_KEY = "opensky/fallback_match.json"

# Bounding box roughly around Singapore/Changi (lamin, lomin, lamax, lomax)
DEFAULT_BBOX = (1.1, 103.5, 1.5, 104.2)

s3 = boto3.client("s3")

IATA_TO_ICAO_AIRLINE = {
    "SQ": "SIA",   # Singapore Airlines
    "TR": "TGW",   # Scoot
    "MI": "SLK",   # SilkAir
    "TG": "THA",   # Thai Airways
    "QF": "QFA",   # Qantas
    "KL": "KLM",   # KLM
    "LX": "SWR",   # Swiss
    "6E": "IGO",   # IndiGo
    "VJ": "VJC",   # VietJet
    "ET": "ETH",   # Ethiopian
    "TK": "THY",   # Turkish Airlines
}

OPENSKY_FIELDS = [
    "icao24", "callsign", "origin_country", "time_position", "last_contact",
    "longitude", "latitude", "baro_altitude", "on_ground", "velocity",
    "true_track", "vertical_rate", "sensors", "geo_altitude",
    "squawk", "spi", "position_source"
]


# ---------------------------------------------------------------------------
# 1. Raw API call
# ---------------------------------------------------------------------------

def fetch_opensky_state(bbox=DEFAULT_BBOX) -> dict:
    lamin, lomin, lamax, lomax = bbox
    params = urllib.parse.urlencode({
        "lamin": lamin, "lomin": lomin, "lamax": lamax, "lomax": lomax
    })
    url = f"https://opensky-network.org/api/states/all?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": "iris-hackathon/1.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())


# ---------------------------------------------------------------------------
# 2. Normalize + match
# ---------------------------------------------------------------------------

def normalize_states(raw_data: dict) -> list:
    return [dict(zip(OPENSKY_FIELDS, state)) for state in raw_data.get("states", [])]


def find_flight_by_callsign(states: list, callsign_prefix: str) -> dict:
    for s in states:
        if s["callsign"] and s["callsign"].strip().startswith(callsign_prefix):
            return s
    return None


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
# 3. S3 fallback
# ---------------------------------------------------------------------------

def save_snapshot(match: dict):
    try:
        s3.put_object(Bucket=S3_BUCKET, Key=S3_FALLBACK_KEY, Body=json.dumps(match))
    except Exception as e:
        print(f"WARNING: failed to save S3 snapshot: {e}")


def load_snapshot() -> dict:
    obj = s3.get_object(Bucket=S3_BUCKET, Key=S3_FALLBACK_KEY)
    return json.loads(obj["Body"].read())


def get_opensky_match(flight_id: str) -> dict:
    """
    Entry point: tries live OpenSky lookup for the given flight_id.
    Falls back to the last known-good S3 snapshot if the flight isn't
    found live, or if the OpenSky call itself fails.
    """
    prefix = flight_id_to_callsign_prefix(flight_id)

    try:
        raw = fetch_opensky_state()
        states = normalize_states(raw)
        match = find_flight_by_callsign(states, prefix)
        if match is not None:
            save_snapshot(match)
            return match
        print(f"WARNING: {flight_id} not found in live OpenSky data; falling back to S3 snapshot")
        return load_snapshot()
    except Exception as e:
        print(f"WARNING: OpenSky fetch failed ({e}); falling back to S3 snapshot")
        try:
            return load_snapshot()
        except Exception as e2:
            print(f"WARNING: S3 fallback also failed ({e2})")
            return None


# ---------------------------------------------------------------------------
# 4. Build the §4 Standard Agent Response
# ---------------------------------------------------------------------------

def build_flight_agent_response(flight_id: str, opensky_match: dict, delay_minutes_reported: int = None) -> dict:
    if opensky_match is None:
        return {
            "agent": "flight_agent",
            "status": "failed",
            "severity": "medium",
            "summary": f"No live tracking data found for {flight_id}.",
            "findings": [f"{flight_id} could not be located in current OpenSky data or fallback snapshot."],
            "constraints": [],
            "recommended_actions": ["Fall back to scheduled data; verify flight status manually."]
        }

    findings = []
    on_ground = opensky_match.get("on_ground")
    findings.append(f"Aircraft is currently {'on ground' if on_ground else 'airborne'}.")

    if opensky_match.get("velocity") is not None:
        findings.append(f"Current ground speed: {opensky_match['velocity']:.1f} m/s.")

    severity = "low"
    summary = f"{flight_id} tracking data received; no significant disruption detected."

    if delay_minutes_reported:
        findings.append(f"Incoming aircraft delayed by {delay_minutes_reported} minutes.")
        severity = "high" if delay_minutes_reported > 15 else "medium"
        summary = ("Incoming aircraft delay makes the original departure time infeasible."
                    if delay_minutes_reported > 15 else
                    "Minor incoming delay detected; may still be recoverable.")

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


# ---------------------------------------------------------------------------
# 5. Lambda entry point
# ---------------------------------------------------------------------------

def lambda_handler(event, context):
    try:
        if isinstance(event.get("body"), str):
            body = json.loads(event["body"])
        else:
            body = event

        scenario = body.get("scenario", {})
        flight = scenario.get("flight", {})
        flight_id = flight.get("flight_id", "SQ318")

        # Pull reported delay from the disruptions list, per API_CONTRACT §2
        delay_minutes = None
        for d in body.get("disruptions", []):
            if d.get("type") == "late_incoming_aircraft":
                delay_minutes = d.get("delay_minutes")
                break

        match = get_opensky_match(flight_id)
        response_body = build_flight_agent_response(flight_id, match, delay_minutes)

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(response_body)
        }

    except Exception as e:
        error_body = {
            "agent": "flight_agent",
            "status": "failed",
            "severity": "medium",
            "summary": f"Flight agent encountered an error: {str(e)}",
            "findings": [],
            "constraints": [],
            "recommended_actions": ["Retry flight agent or use manual override"]
        }
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(error_body)
        }
