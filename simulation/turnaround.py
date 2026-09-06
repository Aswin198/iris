"""Turnaround progress helpers.

For MVP the fixtures carry the ground-ops state directly (baggage_percent,
boarding_percent, estimated_ready_time). This module exists so the schedule
generator (future) can derive ready-times from arrival + task offsets.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from .loader import load_aircraft_catalog


def estimate_ready_time(
    aircraft_type: str, arrival_time: datetime, extra_delay_minutes: int = 0
) -> datetime:
    turnaround = load_aircraft_catalog()["aircraft_types"][aircraft_type]["turnaround_minutes"]
    return arrival_time + timedelta(minutes=turnaround + extra_delay_minutes)
