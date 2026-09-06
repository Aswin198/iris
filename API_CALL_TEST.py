import requests

def fetch_metar(icao="WSSS"):
    url = f"https://aviationweather.gov/api/data/metar?ids={icao}&format=json"
    r = requests.get(url, timeout=5)
    r.raise_for_status()
    return r.json()[0]

def to_standard_weather_object(raw_metar, icao="WSSS"):
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

def _classify_condition(raw_metar):
    wx = (raw_metar.get("wxString") or "").upper()
    if "TS" in wx:
        return "thunderstorm"
    if "RA" in wx:
        return "rain"
    return "clear"

def _classify_risk(condition, visibility_m, wind_speed_kt):
    if condition == "thunderstorm" or visibility_m < 1600 or wind_speed_kt > 30:
        return "high"
    if condition == "rain" or wind_speed_kt > 20:
        return "medium"
    return "low"

raw = fetch_metar("WSSS")
print(raw)
print(to_standard_weather_object(raw))
