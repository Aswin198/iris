# AeroSync Operations Console

Person 4's component: the airport operations dashboard for IRIS.

The console is an **airport CDM stand-allocation chart**, not a card dashboard. Time runs left to
right, stands run top to bottom, and the gate conflict is a bar collision you can see. Every
candidate recovery plan projects onto that chart as a ghost bar before the operator commits it.

## Run it

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The console works **with no backend running**. It posts to `/api/recovery`, and when the service is
unreachable it falls through to a local scenario engine and shows a `MOCK` pill plus a banner saying
why. Nothing is silently faked.

## Connecting the real backend (Person 1)

Nothing in the UI needs to change. `vite.config.ts` proxies `/api` to `http://localhost:8000`, so
start the Python service on 8000 and the pill flips to `LIVE`.

| Variable | Effect |
| --- | --- |
| `VITE_API_TARGET` | Dev proxy target (default `http://localhost:8000`) |
| `VITE_API_BASE` | Absolute API origin, if you are not using the proxy |
| `VITE_USE_MOCK=1` | Force the local engine and never call the network |

The only network call the console makes is `POST /api/recovery` (contract §11).

## What the backend must return

`src/types/contract.ts` mirrors `docs/API_CONTRACT.md` field for field, in `snake_case`. The console
renders from the §10 final recovery response and needs nothing else.

**Required** — `scenario_id`, `status`, `recommended_plan`, `impact`, `reasoning_summary`,
`agent_results`.

**Optional, and worth sending** — these are additive fields the contract permits (§20). Without them
the console renders the recommendation alone; with them it renders the full three-plan comparison:

| Field | What it unlocks |
| --- | --- |
| `candidate_plans` (§5) | All three plans as ledger rows instead of just the winner |
| `optimiser_results` (§7/§8) | Per-plan metrics, scores, feasibility and `constraint_violations` |
| `scenario_state` (§3) | The board draws the real aircraft-ready time, weather window and stand deadline |

A plan with `feasible: false` renders struck out with its violation text and **cannot be approved**,
per §8. `status: "recommendation_ready"` shows the decision bar; anything else shows the no-feasible-plan
state.

Agent lanes key off the six names in §4 (`flight_agent`, `weather_agent`, `gate_agent`,
`ground_agent`, `passenger_agent`, `recovery_agent`). Sending `findings`, `constraints` and
`recommended_actions` on each fills the expandable detail; sending only `summary` still works.

## Synthetic data

`src/mock/airport_state.ts` is an invented Terminal 2 stand board — six stands, ten flights. Exact
Changi gate allocations, turnaround progress and passenger connections are not public, so they are
simulated. The interface says so on the legend and in the footer. It is never presented as real
operational Changi data.

`src/mock/engine.ts` is a deterministic stand-in for the orchestrator and optimiser, sanctioned by
contract §12/§18. Its scoring mirrors §9 with no randomness — the same inputs always produce the same
plans, feasibility verdicts and scores. It is replaced by the real service, not merged with it.

## Layout

```
src/
  types/contract.ts        exact mirror of docs/API_CONTRACT.md — the team boundary
  api/client.ts            the only network call; live/mock fallback lives here
  mock/                    synthetic stand board + deterministic scenario engine
  state/opsStore.tsx       one reducer, one context
  state/boardModel.ts      what the chart draws, derived from response or controls
  components/planner/      the stand-allocation chart (the hero)
  components/disruption/   injection controls
  components/agents/       six agent lanes
  components/plans/        scored plan ledger
  components/decision/     approve / reject, with reasons
  styles/tokens.css        design tokens
```

## Demo path

1. The board opens already showing the collision: SQ318 on B8 runs past the 14:25 claim by SQ871.
2. Adjust the disruption on the left — the board reacts before you ever request recovery.
3. **Run recovery.** Six agent lanes fill in with findings and hard constraints.
4. Three plans score. Plan A is infeasible with its violation stated; Plan B wins.
5. Hover or arrow between plan rows — the ghost bar moves on the chart above.
6. **Approve.** The ghost turns solid green on B10, the overrun clears from B8, the log records it.

Two things worth showing a judge: turn the stand conflict **off** and re-run — Plan A becomes feasible
and the recommendation flips, proving the optimiser is deterministic rather than scripted. Push the
inbound delay past 45 min and watch the feasible set collapse.
