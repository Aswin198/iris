# IRIS — MVP API Contract

This document defines the shared data structures used between the different IRIS components.

All team members should follow these field names during development.

Do not rename shared fields without informing the team.

---

# 1. Main Recovery Endpoint

## Endpoint

```text
POST /api/recovery
```

This endpoint receives a disruption scenario and returns the recommended recovery plan.

---

# 2. Recovery Request

Example:

```json
{
  "scenario_id": "scenario_001",

  "flight": {
    "flight_id": "SQ318",
    "origin": "SIN",
    "destination": "LHR",
    "scheduled_departure": "2026-09-05T14:00:00+08:00",
    "scheduled_arrival": "2026-09-05T20:30:00+01:00",
    "gate": "B8"
  },

  "disruptions": [
    {
      "type": "late_incoming_aircraft",
      "delay_minutes": 20
    },
    {
      "type": "ground_handling_delay",
      "delay_minutes": 12
    }
  ]
}
```

---

# 3. Shared Scenario State

The backend/orchestrator should convert data from APIs, simulation and user input into one common scenario format.

```json
{
  "scenario_id": "scenario_001",

  "flight": {
    "flight_id": "SQ318",
    "origin": "SIN",
    "destination": "LHR",
    "scheduled_departure": "2026-09-05T14:00:00+08:00",
    "scheduled_arrival": "2026-09-05T20:30:00+01:00",
    "current_gate": "B8",
    "aircraft_ready_time": "2026-09-05T14:12:00+08:00"
  },

  "weather": {
    "condition": "thunderstorm",
    "risk_level": "high",
    "visibility_m": 5000,
    "wind_speed_kt": 16
  },

  "gate": {
    "current_gate": "B8",
    "conflict": true,
    "conflict_time": "2026-09-05T14:25:00+08:00",
    "alternative_gates": [
      "B10",
      "B12"
    ]
  },

  "ground_operations": {
    "baggage_percent": 75,
    "refuelling_complete": true,
    "cleaning_complete": true,
    "boarding_percent": 60,
    "estimated_ready_time": "2026-09-05T14:12:00+08:00"
  },

  "passengers": {
    "total_passengers": 280,
    "connecting_passengers": 42,
    "at_risk_connections": 11
  }
}
```

---

# 4. Standard Agent Response

All specialised agents should return the same basic response structure.

Example:

```json
{
  "agent": "gate_agent",

  "status": "completed",

  "severity": "high",

  "summary": "Current gate B8 will conflict with another scheduled aircraft.",

  "findings": [
    "B8 must be available by 14:25",
    "B10 is currently available",
    "B10 is compatible with the aircraft"
  ],

  "constraints": [
    {
      "type": "gate_clearance",
      "value": "2026-09-05T14:25:00+08:00"
    }
  ],

  "recommended_actions": [
    "Consider moving SQ318 to B10"
  ]
}
```

## Allowed Agent Names

```text
flight_agent
weather_agent
gate_agent
ground_agent
passenger_agent
recovery_agent
```

## Allowed Status Values

```text
pending
running
completed
failed
```

## Allowed Severity Values

```text
low
medium
high
critical
```

---

# 5. Candidate Recovery Plan

The Recovery Agent generates multiple possible recovery plans.

Example:

```json
{
  "plan_id": "plan_B",

  "flight_id": "SQ318",

  "recommended_gate": "B10",

  "recommended_departure": "2026-09-05T14:18:00+08:00",

  "actions": [
    "Reassign aircraft from B8 to B10",
    "Prioritise baggage for passengers with tight connections"
  ]
}
```

The Recovery Agent should normally generate multiple options such as:

```text
plan_A
plan_B
plan_C
```

These plans are passed to the optimiser.

---

# 6. Optimiser Input

The optimiser receives:

* Shared scenario state
* Candidate recovery plan

Example:

```json
{
  "scenario_id": "scenario_001",

  "candidate_plan": {
    "plan_id": "plan_B",
    "flight_id": "SQ318",
    "recommended_gate": "B10",
    "recommended_departure": "2026-09-05T14:18:00+08:00"
  }
}
```

---

# 7. Optimiser Response

The optimiser determines whether the proposed plan is feasible and calculates a recovery score.

Example:

```json
{
  "plan_id": "plan_B",

  "feasible": true,

  "score": 23.5,

  "metrics": {
    "departure_delay_minutes": 18,
    "gate_conflicts": 0,
    "passengers_at_risk": 4,
    "downstream_delay_minutes": 12
  },

  "constraint_violations": []
}
```

Lower score represents a better recovery plan.

---

# 8. Infeasible Plan

If a plan violates a hard constraint:

```json
{
  "plan_id": "plan_A",

  "feasible": false,

  "score": null,

  "metrics": {
    "departure_delay_minutes": 25,
    "gate_conflicts": 1,
    "passengers_at_risk": 6,
    "downstream_delay_minutes": 15
  },

  "constraint_violations": [
    "Gate B8 cannot remain occupied after 14:25"
  ]
}
```

Infeasible plans must not be selected as the recommended plan.

---

# 9. Recovery Scoring

For the MVP, the optimiser may use a weighted scoring function such as:

```text
Recovery Score =
w1 × Departure Delay
+ w2 × Gate Conflict Penalty
+ w3 × Passenger Impact
+ w4 × Downstream Delay
+ w5 × Operational Cost
```

Example weights can initially be configurable.

The optimiser should remain deterministic.

The LLM should NOT directly determine the final score.

---

# 10. Final Recovery Response

The main recovery endpoint should ultimately return something in this format:

```json
{
  "scenario_id": "scenario_001",

  "status": "recommendation_ready",

  "recommended_plan": {
    "plan_id": "plan_B",
    "flight_id": "SQ318",

    "original_gate": "B8",
    "recommended_gate": "B10",

    "original_departure": "2026-09-05T14:00:00+08:00",
    "recommended_departure": "2026-09-05T14:18:00+08:00",

    "expected_delay_minutes": 18,

    "score": 23.5
  },

  "impact": {
    "gate_conflict_avoided": true,
    "passengers_at_risk": 4,
    "downstream_delay_minutes": 12
  },

  "reasoning_summary": "Moving SQ318 to B10 avoids the upcoming B8 gate conflict while allowing the flight to depart before passenger connection risk increases significantly.",

  "agent_results": [
    {
      "agent": "flight_agent",
      "status": "completed",
      "severity": "high",
      "summary": "Incoming aircraft delay makes the original departure time infeasible."
    },

    {
      "agent": "weather_agent",
      "status": "completed",
      "severity": "medium",
      "summary": "Thunderstorm conditions may affect departure operations."
    },

    {
      "agent": "gate_agent",
      "status": "completed",
      "severity": "high",
      "summary": "Gate B8 conflict detected at 14:25."
    },

    {
      "agent": "ground_agent",
      "status": "completed",
      "severity": "medium",
      "summary": "Aircraft estimated ready at 14:12."
    },

    {
      "agent": "passenger_agent",
      "status": "completed",
      "severity": "medium",
      "summary": "11 passengers are currently at risk of missing connections."
    }
  ]
}
```

---

# 11. Frontend Contract

The frontend should primarily depend on:

```text
POST /api/recovery
```

and the final recovery response.

The frontend should NOT need to know:

* how OpenSky is queried
* how weather APIs are queried
* how LLM prompts work
* how individual agents reason
* how the optimiser calculates its score
* how simulated airport data is generated

This separation allows frontend and backend development to happen independently.

---

# 12. Frontend Mocking

If the backend is not ready, the frontend developer should create a mock response that follows the exact same structure.

For example:

```text
frontend/mock/recovery_response.json
```

The frontend can therefore be completely built before the actual backend is connected.

When the backend becomes available, the mock request can simply be replaced with:

```text
POST /api/recovery
```

---

# 13. Data Provider Contract

External data modules should return cleaned data rather than raw API responses.

For example, the Weather Agent should NOT depend directly on the exact response format returned by AviationWeather or NEA.

Instead:

```text
AviationWeather API
        ↓
weather data module
        ↓
standard IRIS weather object
        ↓
Weather Agent
```

Example standard weather object:

```json
{
  "airport": "WSSS",
  "condition": "thunderstorm",
  "risk_level": "high",
  "visibility_m": 5000,
  "wind_speed_kt": 16,
  "wind_direction_deg": 220,
  "source": "aviation_weather"
}
```

This means the external API can later be replaced without changing the Weather Agent.

---

# 14. Simulator Contract

The simulator should expose operational information in the shared scenario state format.

Example:

```json
{
  "gate": {
    "current_gate": "B8",
    "conflict": true,
    "conflict_time": "2026-09-05T14:25:00+08:00",
    "alternative_gates": [
      "B10",
      "B12"
    ]
  },

  "ground_operations": {
    "baggage_percent": 75,
    "refuelling_complete": true,
    "cleaning_complete": true,
    "boarding_percent": 60,
    "estimated_ready_time": "2026-09-05T14:12:00+08:00"
  },

  "passengers": {
    "total_passengers": 280,
    "connecting_passengers": 42,
    "at_risk_connections": 11
  }
}
```

---

# 15. Time Format

All full timestamps should use ISO 8601 format with timezone information.

Example:

```text
2026-09-05T14:18:00+08:00
```

Do NOT mix:

```text
2:18 PM
14:18
September 5 2:18pm
```

inside backend API data.

Human-readable times can be formatted by the frontend.

---

# 16. Naming Rules

Use:

```text
snake_case
```

for JSON fields.

Examples:

```text
recommended_departure
passengers_at_risk
scheduled_arrival
gate_conflicts
```

Do not mix:

```text
recommendedDeparture
RecommendedDeparture
recommended-departure
```

---

# 17. MVP Integration Flow

The intended system flow is:

```text
Frontend
    ↓
POST /api/recovery
    ↓
Orchestrator
    ↓
Shared Scenario State
    ↓
Specialised Agents
    ↓
Agent Findings
    ↓
Recovery Agent
    ↓
Candidate Plans
    ↓
Optimiser
    ↓
Best Feasible Plan
    ↓
Recovery API Response
    ↓
Frontend Dashboard
    ↓
Human Approve / Reject
```

---

# 18. Hackathon Development Rule

If another person's component is not ready, use mock data that follows this contract.

Do not wait for another team member before developing your component.

Examples:

Frontend can mock the recovery response.

Orchestrator can mock the optimiser.

Optimiser can mock candidate recovery plans.

Agents can mock external API data.

Once the real component is complete, replace the mock while keeping the same interface.

---

# 19. MVP Scope

For the first working version, support:

* One primary disrupted flight
* One late incoming aircraft event
* One weather disruption
* One gate conflict
* One ground-operation delay
* Passenger connection risk
* Three candidate recovery plans
* One selected recovery recommendation

Do not expand to a full-airport optimisation problem until this complete end-to-end workflow is functioning.

---

# 20. Most Important Rule

The agreed contract allows five developers to work independently.

Therefore:

**Do not change shared request/response structures without communicating the change to the team.**

Where possible, add optional fields instead of renaming or removing existing fields.

