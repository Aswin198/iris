"""Pydantic models mirroring docs/API_CONTRACT.md.

These are the wire-format shapes agreed with the whole team. Field names are
locked (snake_case) and every timestamp is ISO 8601 with timezone.

Kept in `simulation/` because the simulator is the primary producer, but both
the simulator and optimiser import from here so the contract stays single-source.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


AgentName = Literal[
    "flight_agent",
    "weather_agent",
    "gate_agent",
    "ground_agent",
    "passenger_agent",
    "recovery_agent",
]
AgentStatus = Literal["pending", "running", "completed", "failed"]
Severity = Literal["low", "medium", "high", "critical"]


# --- Shared scenario state (contract section 3 / 14) ---


class FlightState(BaseModel):
    flight_id: str
    origin: str
    destination: str
    scheduled_departure: datetime
    scheduled_arrival: datetime
    current_gate: str
    aircraft_ready_time: datetime


class WeatherState(BaseModel):
    condition: str
    risk_level: Severity
    visibility_m: int
    wind_speed_kt: int


class GateState(BaseModel):
    current_gate: str
    conflict: bool
    conflict_time: Optional[datetime] = None
    alternative_gates: list[str] = Field(default_factory=list)


class GroundOperationsState(BaseModel):
    baggage_percent: int
    refuelling_complete: bool
    cleaning_complete: bool
    boarding_percent: int
    estimated_ready_time: datetime


class PassengerState(BaseModel):
    total_passengers: int
    connecting_passengers: int
    at_risk_connections: int


class SharedScenarioState(BaseModel):
    scenario_id: str
    flight: FlightState
    weather: WeatherState
    gate: GateState
    ground_operations: GroundOperationsState
    passengers: PassengerState


# --- Candidate plan + optimiser I/O (contract sections 5-8) ---


class CandidatePlan(BaseModel):
    plan_id: str
    flight_id: str
    recommended_gate: str
    recommended_departure: datetime
    actions: list[str] = Field(default_factory=list)


class OptimiserMetrics(BaseModel):
    departure_delay_minutes: int
    gate_conflicts: int
    passengers_at_risk: int
    downstream_delay_minutes: int


class OptimiserResponse(BaseModel):
    plan_id: str
    feasible: bool
    score: Optional[float]
    metrics: OptimiserMetrics
    constraint_violations: list[str] = Field(default_factory=list)


# --- Standard agent response (contract section 4) ---


class AgentConstraint(BaseModel):
    type: str
    value: str


class AgentResponse(BaseModel):
    agent: AgentName
    status: AgentStatus
    severity: Severity
    summary: str
    findings: list[str] = Field(default_factory=list)
    constraints: list[AgentConstraint] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)
