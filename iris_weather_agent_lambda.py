import json
import boto3
import urllib.request
import urllib.error

S3_BUCKET = "iris-hackathon-data" 
S3_FALLBACK_KEY = "weather/latest.json"
DEFAULT_ICAO = "WSSS"

s3 = boto3.client("s3")


def fetch_metar(icao: str = DEFAULT_ICAO) -> dict:
    url = f"https://aviationweather.gov/api/data/metar?ids={icao}&format=json"
    req = urllib.request.Request(url, headers={"User-Agent": "iris-hackathon/1.0"})
    with urllib.request.urlopen(req, timeout=5) as resp:
        data = json.loads(resp.read().decode())
    if not data:
        raise ValueError(f"No METAR data returned for {icao}")
    return data[0]


def to_standard_weather_object(raw_metar: dict, icao: str = DEFAULT_ICAO) -> dict:
    visibility_m = int(raw_metar.get("visib", 10) * 1609.34) if raw_metar.get("visib") else 9999
    wind_speed_kt = raw_metar.get("wspd", 0)
    condition = _classify_condition(raw_metar)
    risk_level = _classify_risk(condition, visibility_m, wind_speed_kt)

    return {
        "airport": icao,
        "condition": condition,
        "risk_level": risk_level,
        "visibility_m": visibility_m,
        "wind_speed_kt": wind_speed_kt,
        "wind_direction_deg": raw_metar.get("wdir", 0),
        "source": "aviation_weather"
    }


def _classify_condition(raw_metar: dict) -> str:
    wx = (raw_metar.get("wxString") or "").upper()
    if "TS" in wx:
        return "thunderstorm"
    if "RA" in wx:
        return "rain"
    return "clear"


def _classify_risk(condition: str, visibility_m: int, wind_speed_kt: float) -> str:
    if condition == "thunderstorm" or visibility_m < 1600 or wind_speed_kt > 30:
        return "high"
    if condition == "rain" or wind_speed_kt > 20:
        return "medium"
    return "low"


def save_snapshot(weather_obj: dict):
    try:
        s3.put_object(Bucket=S3_BUCKET, Key=S3_FALLBACK_KEY, Body=json.dumps(weather_obj))
    except Exception as e:
        # Don't let a snapshot-save failure break the main response
        print(f"WARNING: failed to save S3 snapshot: {e}")


def load_snapshot() -> dict:
    obj = s3.get_object(Bucket=S3_BUCKET, Key=S3_FALLBACK_KEY)
    return json.loads(obj["Body"].read())


def get_weather_snapshot(icao: str = DEFAULT_ICAO) -> dict:
    """Entry point: live fetch with S3 fallback on failure."""
    try:
        raw = fetch_metar(icao)
        weather_obj = to_standard_weather_object(raw, icao)
        save_snapshot(weather_obj)
        return weather_obj
    except Exception as e:
        print(f"WARNING: live weather fetch failed ({e}); falling back to S3 snapshot")
        return load_snapshot()


def build_weather_agent_response(weather_obj: dict) -> dict:
    findings = []
    if weather_obj["condition"] == "thunderstorm":
        findings.append(f"Thunderstorm conditions detected at {weather_obj['airport']}")
    findings.append(f"Visibility {weather_obj['visibility_m']}m, wind {weather_obj['wind_speed_kt']}kt")

    if weather_obj["condition"] == "thunderstorm":
        summary = "Thunderstorm conditions may affect departure operations."
    elif weather_obj["condition"] == "rain":
        summary = "Rain conditions present; minor operational impact possible."
    else:
        summary = f"Weather conditions ({weather_obj['condition']}) are within normal operating limits."

    return {
        "agent": "weather_agent",
        "status": "completed",
        "severity": weather_obj["risk_level"],
        "summary": summary,
        "findings": findings,
        "constraints": [
            {"type": "weather_risk", "value": weather_obj["risk_level"]}
        ],
        "recommended_actions": (
            ["Monitor conditions before departure clearance"]
            if weather_obj["risk_level"] in ("high", "critical") else []
        )
    }


def lambda_handler(event, context):
    try:
        # Accept either a direct invoke payload or an API Gateway proxy event
        if isinstance(event.get("body"), str):
            body = json.loads(event["body"])
        else:
            body = event

        scenario = body.get("scenario", {})
        icao = scenario.get("flight", {}).get("origin_icao", DEFAULT_ICAO)

        weather_obj = get_weather_snapshot(icao)
        response_body = build_weather_agent_response(weather_obj)

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(response_body)
        }

    except Exception as e:
        error_body = {
            "agent": "weather_agent",
            "status": "failed",
            "severity": "medium",
            "summary": f"Weather agent encountered an error: {str(e)}",
            "findings": [],
            "constraints": [],
            "recommended_actions": ["Retry weather agent or use manual override"]
        }
        return {
            "statusCode": 200,   # keep 200 so orchestrator gets a parseable agent response, not a raw Lambda error
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(error_body)
        }
