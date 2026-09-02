# IRIS

## Intelligent Recovery & Irregular Operations System

IRIS is a multi-agent AI decision-support system for airport disruption recovery.

The system combines real-world aviation and weather data with simulated airport operational constraints to generate coordinated recovery plans when disruptions make the original flight schedule infeasible.

## Problem

Airport operations can be disrupted by factors such as:

- Late incoming aircraft
- Thunderstorms and severe weather
- Gate conflicts
- Ground handling delays
- Baggage delays
- Longer-than-expected turnaround times
- Passenger connection risks

Rather than simply predicting flight delays, IRIS aims to answer:

> Given a disruption, what coordinated recovery actions should airport and airline operators take to minimise the overall impact?

## Multi-Agent Architecture

IRIS consists of several specialised AI agents:

- Flight Agent
- Weather Agent
- Gate Agent
- Ground Operations Agent
- Passenger Impact Agent
- Recovery / Orchestrator Agent

The agents analyse different operational factors and generate possible recovery strategies.

A deterministic optimisation component then validates and ranks the proposed recovery plans.

## Architecture

Frontend Dashboard
→ Recovery API
→ Multi-Agent Orchestrator
→ Specialised Agents
→ Recovery Optimiser
→ Recommended Recovery Plan
→ Human Approval

## Data Sources

IRIS uses a combination of real-world and simulated data.

Potential real-world sources include:

- US DOT / BTS — historical flight delays and operational data
- OpenSky Network — aircraft position and trajectory
- AviationWeather — METAR and TAF aviation weather
- NEA / data.gov.sg — Singapore weather and rainfall
- CAAS / data.gov.sg — Changi Airport traffic statistics

Operational information that is not publicly available, such as exact gate allocations, passenger connections and ground handling progress, will be realistically simulated for the hackathon prototype.

## Team Structure

1. Multi-Agent Backend + Orchestrator
2. Real Aviation Data + Flight/Weather Agents
3. Airport Simulator + Optimisation
4. Frontend + Operations Dashboard
5. Integration + Evaluation + Presentation
