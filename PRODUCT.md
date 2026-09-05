# IRIS / AeroSync — Product Truth

## What this is

IRIS (presented as **AeroSync** in the operations console) is a multi-agent AI decision-support
system for airport disruption recovery. When a disruption makes a planned departure infeasible,
IRIS determines the best *coordinated recovery action* across flight, weather, gate, ground-operation
and passenger constraints.

It is explicitly **not** a flight-delay predictor. The question it answers is not "will this flight
be late" but "given this disruption, what should the operator actually do."

## Unique mechanism

Six specialised agents (flight, weather, gate, ground, passenger, recovery) each reason over their
own domain and surface findings and hard constraints. The recovery agent composes those findings
into three candidate recovery plans. A **deterministic optimiser** — never the LLM — checks hard
constraints and scores each plan. The lowest-scoring feasible plan is recommended. A human operator
approves or rejects it.

The interesting product truth: the LLM proposes, a deterministic scorer disposes, and a human commits.

## Who uses it

An airport or airline operations controller in an operations control centre. They are mid-task,
under time pressure, watching a status wall in a dim room, and they are category-fluent — they read
stand allocation charts, METARs and flight strips daily. They do not need the interface explained;
they need to see the conflict, weigh the options, and commit. They retain final authority. The
system recommends; it never acts.

## The task the console serves

1. See the current stand/turnaround picture and where it breaks.
2. Inject or receive a disruption.
3. Watch the agents establish what is true and what is constrained.
4. Compare candidate recovery plans on delay, gate conflict, passenger risk and downstream impact.
5. Approve or reject, with the decision recorded.

## Platform

Web, desktop-first (an ops console lives on a wide monitor), degrading structurally to narrow.
Frontend is `frontend/` — Vite + React + TypeScript + Tailwind. Backend is Python, owned by other
team members.

## Constraints and commitments

- **The API contract is law.** `docs/API_CONTRACT.md` is shared across five developers. JSON fields
  are `snake_case` and are never renamed by the frontend. Timestamps are ISO 8601 with timezone.
  If the frontend needs a field that does not exist, it is raised with the team, not invented.
- **The frontend depends only on `POST /api/recovery`.** It must know nothing about OpenSky, weather
  APIs, LLM prompting, agent internals, optimiser math, or how simulated airport data is produced.
- **Mock-first is sanctioned** (contract §12). The console is built complete against a mock that
  mirrors the real response shape exactly, and swaps to live at one call site.
- **Simulated data must never be presented as real Changi data.** Gate allocations, turnaround
  progress, baggage and passenger connection figures are synthetic and are labelled as such in the
  interface itself, not only in documentation.
- Only these agent names exist: `flight_agent`, `weather_agent`, `gate_agent`, `ground_agent`,
  `passenger_agent`, `recovery_agent`. Only these statuses: `pending`, `running`, `completed`,
  `failed`. Only these severities: `low`, `medium`, `high`, `critical`.
- Infeasible plans may never be selected as the recommendation.
- MVP scope is one primary disrupted flight, three candidate plans, one recommendation.

## Reference scenario

SQ318, SIN→LHR, scheduled 14:00 SGT off stand B8 at WSSS (Changi). Incoming aircraft late 20 min;
thunderstorm over the field roughly 14:10–14:30; baggage loading behind; B8 required by another
aircraft at 14:25; eleven passengers on tight connections. Aircraft ready 14:12. B10 and B12
available and compatible.

## Build path

Code-led. No image generation is available in this environment.
