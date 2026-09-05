# DESIGN.md — AeroSync Operations Console

Ground truth for the IRIS frontend (`frontend/`), derived from the shipped code rather than from
intentions. Every token, rule and behaviour below is what the build actually does.

**Audience:** the other four IRIS developers and any AI agent asked to extend, review or integrate
with this frontend. Read §1–3 to orient, §4 to integrate, §5–9 to change the UI, §10 to understand
why things are the way they are.

> **Owner:** Person 4 (frontend). **Status:** complete, reviewed, mock-first, backend-ready.
> Typecheck and production build both pass. No known breakage.

---

## 1. What this is

An airport operations console for IRIS: a decision-support surface where a human operator sees a
disruption, watches six AI agents establish what is true and what is hard-constrained, compares
recovery plans a deterministic optimiser has scored, and authorises one.

**It is not a dashboard of cards.** The interface *is* an airport CDM stand-allocation chart. Time
runs left to right, stands run top to bottom, and a gate conflict is a bar collision you can see
rather than a number you have to read. Every candidate plan projects onto that same chart as a ghost
bar before the operator commits it.

The console never acts on the airport. It recommends; a human authorises; the decision is logged.

### Non-goals

- It does not predict delays.
- It does not know how OpenSky, weather APIs, LLM prompting, agent reasoning, optimiser maths or the
  simulator work, and must not learn. Its entire backend surface is `POST /api/recovery`.
- It does not present simulated data as real Changi data.

---

## 2. Running it

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm run build        # tsc -b && vite build
npm run typecheck
```

**It works with no backend.** It posts to `/api/recovery`; when the service is unreachable it falls
through to a local scenario engine, flips the top-strip pill from `LIVE` to `MOCK`, and shows a
banner naming the reason. Nothing is silently faked.

| Env var | Effect |
| --- | --- |
| `VITE_API_TARGET` | Dev proxy target (default `http://localhost:8000`) |
| `VITE_API_BASE` | Absolute API origin, if bypassing the proxy |
| `VITE_USE_MOCK=1` | Force the local engine; never touch the network |

`vite.config.ts` proxies `/api` → `VITE_API_TARGET`, so live and mock share one code path.

### Stack

Vite 6 · React 18 · TypeScript (strict) · Tailwind 3. No component library, no charting library, no
state library — the chart is CSS/absolute positioning over a minute scale, and state is one reducer.
`playwright` is a devDependency used only for screenshot capture; it is not part of the app.

---

## 3. Architecture

```
src/
  types/contract.ts        exact mirror of docs/API_CONTRACT.md — THE TEAM BOUNDARY
  api/client.ts            the only network call; live/mock fallback lives here
  lib/time.ts              ISO ⇄ minutes-since-midnight-SGT helpers
  lib/scenarioClock.ts     the single time source for the whole console
  mock/airport_state.ts    synthetic Terminal 2 stand board (6 stands, 7 flights)
  mock/engine.ts           deterministic stand-in for orchestrator + optimiser
  mock/recovery_response.json   the literal §10 example, kept for contract diffing
  state/opsStore.tsx       one reducer, one context; the single source of truth
  state/boardModel.ts      what the chart draws, derived from response or controls
  components/
    chrome/TopBar.tsx           airport, flight, scenario id, MOCK/LIVE pill, clock
    planner/StandPlanner.tsx    THE HERO — stand chart, ~660 lines, self-contained
    disruption/DisruptionConsole.tsx   injection controls + RUN RECOVERY
    agents/AgentRail.tsx        six agent lanes with expandable detail
    plans/PlanLedger.tsx        scored plan rows; hover projects onto the chart
    decision/DecisionBar.tsx    approve / reject with reasons
    DecisionLog.tsx             audit trail
    states/EmptyBoard.tsx       first-run state that teaches the loop
    states/PlanSkeleton.tsx     loading placeholders matching the rows they replace
    ui/Icons.tsx                10 authored SVG icons, one 24px/1.5px grid
  styles/tokens.css        design tokens + base layer + component classes
```

### Data flow

```
DisruptionConsole (operator sets inputs)
    → opsStore.run()
    → api/client.postRecovery(DisruptionInput)
        → POST /api/recovery            (live)
        → mock/engine.runRecovery()     (fallback, or VITE_USE_MOCK=1)
    → RecoveryResponse
    → opsStore: toPlanRows() → PlanRow[]      (ledger)
                agent_results → AgentLane[]   (rail, staged reveal)
                scenario_state → BoardModel   (chart)
    → operator previews / selects / approves
    → DecisionLog
```

**One rule governs the whole store:** it never calls the engine directly. It consumes whatever
`postRecovery` returns, so a live response and a mock response drive byte-identical UI. This is what
makes the backend swap a no-op.

---

## 4. Integration contract (read this, Person 1)

### The only endpoint

`POST /api/recovery`. Request shape is `RecoveryRequest` (contract §2), built by
`api/client.ts:buildRequest()`. Response must be `RecoveryResponse` (contract §10).

`src/types/contract.ts` mirrors `docs/API_CONTRACT.md` **field for field, in `snake_case`**. Nothing
was renamed and nothing was invented. If the frontend needs a field that does not exist, it gets
raised with the team, not added locally.

### Required response fields

`scenario_id`, `status`, `recommended_plan`, `impact`, `reasoning_summary`, `agent_results`.

With only these the console renders the recommendation alone and still works end to end.

### Optional fields that unlock the real experience

These are **additive**, permitted by contract §20. Send them and the console becomes what the demo
shows:

| Field | Contract § | What it unlocks |
| --- | --- | --- |
| `candidate_plans` | §5 | All three plans as ledger rows, not just the winner |
| `optimiser_results` | §7/§8 | Per-plan metrics, scores, feasibility, `constraint_violations` |
| `scenario_state` | §3 | The chart draws real aircraft-ready time, weather window, stand deadline |

### Behavioural rules the frontend enforces

- A plan with `feasible: false` renders struck through with its first `constraint_violations` entry
  and **cannot be approved** (contract §8). The Approve button is disabled with an explanatory title.
- `status: "recommendation_ready"` shows the decision bar. Any other status shows the
  "No feasible recovery plan" state.
- Ledger rows sort feasible-first, then by ascending score. Infeasible plans sink.
- Agent lanes key off the six names in contract §4 exactly:
  `flight_agent`, `weather_agent`, `gate_agent`, `ground_agent`, `passenger_agent`, `recovery_agent`.
  Statuses: `pending | running | completed | failed`. Severities: `low | medium | high | critical`.
- Sending `findings`, `constraints` and `recommended_actions` on an agent fills its expandable
  detail. Sending only `summary` still renders correctly.
- All timestamps are ISO 8601 with offset (contract §15). The frontend formats; the backend must not
  send `"14:18"`.

### Failure handling

`postRecovery` aborts after **8 s**, catches any network error, any non-2xx, and any response missing
`recommended_plan.plan_id`. All of those fall through to the local engine with
`source: 'mock'` and a `fallback_reason` string that is shown to the operator. There is no silent
failure mode and no unhandled rejection.

---

## 5. Visual world

### The direction

Recorded in `.impeccable/surfaces/frontend-src-app-tsx.md` (seed key `0b2a41eb`). Summary:

> The stand-allocation chart IS the interface — a gate conflict is a bar collision you can see, and
> every candidate recovery plan is a ghost bar projected onto that chart before it is committed.

Explicitly refused: the category-default dark admin dashboard of KPI stat cards, a map panel and a
chat log.

### Color

**Strategy: full palette — four named status roles carrying whole regions of the board, not accents
scattered on a neutral ground.** They come from stand-allocation chart convention, not from taste.

Dark is not a default here: an airport operations control centre runs dim against a status wall.

All tokens live in `src/styles/tokens.css` on `:root`, in two forms — a hex value for direct CSS use
and an `--x-rgb` space-separated channel form so Tailwind's alpha modifiers (`bg-subject/85`) work.
**If you add a color you must add both forms**, or `bg-newcolor/50` will silently render nothing.
This failure has already happened once in this codebase.

#### Surfaces

| Token | Value | Role |
| --- | --- | --- |
| `--field` | `#0e141b` | Page ground, the chart's field |
| `--panel` | `#151e27` | Panel ground (console, rail, ledger, top strip) |
| `--panel-raised` | `#1b2733` | Selected row, decision bar |
| `--rule` | `#24313d` | Hairline rules, minor grid lines, inactive bars |
| `--rule-strong` | `#33465a` | Bar borders, scrollbar thumb, disabled states |

#### Ink

| Token | Value | Contrast on `--panel` |
| --- | --- | --- |
| `--ink` | `#e6edf3` | ~14:1 |
| `--ink-dim` | `#9db0c2` | 7.6:1 — body copy, agent summaries, disclosures (measured) |
| `--ink-faint` | `#8a9db0` | 6.0:1 — every uppercase `.label` (measured) |

`--ink-faint` was raised from `#6d8298` (3.9:1) at review. **Do not lower it.** It carries every
11px uppercase label on the page, which is not large text and needs 4.5:1.

#### Status roles

| Token | Value | Means |
| --- | --- | --- |
| `--traffic` | `#3e5266` | Other aircraft on the board (with `--traffic-ink` `#b3c6d6` for labels) |
| `--subject` | `#f0a02a` | SQ318, the flight being recovered. Also the primary action. |
| `--conflict` | `#e2483c` | Stand overrun, infeasibility, hard-constraint violation. Rendered as a 45° hatch over `--conflict-deep` `#4a1512`. |
| `--ghost` | `#46b6d9` | A projected, uncommitted plan. Always dashed. Also the focus ring. |
| `--committed` | `#2fbf71` | An authorised plan. Always solid. Also the approve action. |
| `--weather` | `#7c6ce0` | The weather risk window wash |

Severity ramp: `--sev-low` `#6d8298`, `--sev-medium` `#f0a02a`, `--sev-high` `#ef6b3f`,
`--sev-critical` `#e2483c`.

**Semantic rule: dashed is always provisional, solid is always committed.** Do not break this.

### Typography

| Family | Token | Used for |
| --- | --- | --- |
| Archivo | `font-ui` | All UI text, headings, body |
| Archivo Narrow | `font-narrow` | Dense row labels, stand IDs, plan labels, buttons, `.label` |
| Azeret Mono | `font-data` | Every time, flight code, score, and metric — **measurement only** |

Loaded from Google Fonts in `index.html`. Deliberately not Inter, IBM Plex, Space Grotesk or Space
Mono.

**Monospace is for data, never for flavour.** If you find yourself setting prose in `font-data`,
that is wrong.

Fixed rem scale, ratio ~1.15, no fluid clamps — users view a product UI at consistent DPI:
`micro .6875 · tiny .75 · sm .8125 · base .9375 · md 1.0625 · lg 1.1875 · xl 1.375 · 2xl 1.625` rem.

Two utility classes carry most of the type system:

- `.label` — Archivo Narrow, 11px, 600, `0.1em` tracking, uppercase, `--ink-faint`. Every field
  label, unit, status word and legend caption.
- `.tnum` — tabular numerals. **Every number in this console is measurement**; without this, columns
  dance as values change. Apply it to anything numeric.

### Shape and material

- **Nothing is a rounded card floating in space.** Components are ruled rows and bars on a shared
  minute grid. Border radius is zero throughout.
- Rules are 1px `--rule`. Bars carry a 1px `--rule-strong` border.
- Conflict is a `repeating-linear-gradient` hatch at −45°, 2px on / 4px off (`.hatch-conflict`).
  Empty stand time is a quieter version of the same hatch (`.hatch-quiet`).
- Shadows carry both an offset and a blur (`--shadow-panel`, `--shadow-lift`). No zero-offset halos.

### Browser surfaces

These are themed, not left to the platform — text selection (`--subject` on `#12212e`), caret
(`--subject`), scrollbars (`--rule-strong` on `--field`, 10px, 2px inset border), and the focus ring
(2px `--ghost`, 2px offset). Range inputs and the checkbox mark are drawn from scratch in
`tokens.css` (`.ops-range`, the inline-SVG checkmark) so no OS control appears.

### Icons

Ten authored SVGs in `ui/Icons.tsx`, all on one 24px grid at 1.5px stroke, round caps, no fills:
`IconAircraft, IconStorm, IconStand, IconBaggage, IconPassengers, IconRecovery, IconCheck, IconCross,
IconAlert, IconChevron`. **No emoji and no icon library.** Add new icons to this file in the same
grammar.

### Motion

- `--dur-fast` 140ms, `--dur` 200ms, `--ease` `cubic-bezier(0.16, 1, 0.3, 1)`.
- Motion conveys state only. There is no page-load choreography — a product loads into a task.
- `prefers-reduced-motion: reduce` collapses all animation and transition durations to `0.01ms`.

---

## 6. Layout

```
┌ TopBar ─────────────────────────────── airport · flight · scenario · pill · clock ┐
├ ServiceNotice (only when the recovery service is unreachable) ────────────────────┤
│ StandPlanner  — shrink-0, ~49% of a 900px viewport, horizontally scrollable       │
├──────────────────────┬───────────────────┬───────────────────────────────────────┤
│ DisruptionConsole    │ AgentRail         │ PlanLedger                            │
│ (sticky RUN button)  │ (sticky header)   │ + DecisionBar (sticky bottom)         │
│                      │                   │ + DecisionLog (only once non-empty)   │
├──────────────────────┴───────────────────┴───────────────────────────────────────┤
└ footer — synthetic-data disclosure ──────────────────────────────────────────────┘
```

Grid at `lg`: `minmax(268px,20fr) minmax(0,27fr) minmax(0,33fr)`.

**The band below the chart is one scroll region**, not three. Each panel flows at its natural height;
the band scrolls as a unit with a single scrollbar. Panel headers and the primary actions
(`RUN RECOVERY`, the decision bar) are `sticky` so they stay reachable. At 1920×1080 nothing scrolls;
at 1440×900 the band scrolls once.

Responsive behaviour is **structural, not fluid**: below `lg` the three columns stack and the page
scrolls normally (`min-h-dvh` instead of `h-dvh`); type does not shrink.

---

## 7. The stand planner

`components/planner/StandPlanner.tsx` is the hero and is self-contained. Read it before changing it.

### The scale

Board window is `BOARD_START_MIN` 13:20 → `BOARD_END_MIN` 15:20 (`mock/airport_state.ts`).
`boardModel.pct(min)` maps minutes-since-midnight-SGT to 0–100, clamped;
`widthPct(from, to)` gives a span. **All horizontal positioning goes through these two functions.**

Left gutter is a fixed 72px, `sticky left-0`, so stand identity survives a horizontal scroll.
Stand rows are `3.25rem` (52px). `ReallocationLink` hardcodes `rowH = 52` — **if you change row
height, change it there too.**

### Layers, back to front

| z | Element |
| --- | --- |
| 0 | `WeatherBand` — violet wash spanning the weather risk window |
| — | `GridLines` — 10-minute minor, 20-minute major |
| 10 | `Block` — stand occupancy bars (traffic steel, subject amber) |
| 20 | `ClearanceTail` — the 8-minute pushback tail that actually collides |
| 20 | `DeadlineMarker`, `NowLine` |
| 30 | `Ghost` — the projected or authorised plan bar |
| 30 | `ReallocationLink` — curve tying a vacated stand to an authorised one |
| 40 | The sticky stand-label gutter |

### The one subtlety worth knowing

**Off-block is not stand-clear.** An aircraft pushing back keeps the stand for `STAND_CLEAR_MIN` = 8
more minutes. That tail — `ClearanceTail`, not the amber bar — is what collides with the next
arrival, and it is why Plan A is infeasible in the default scenario (off-block 14:22, stand clear
14:30, SQ871 claims it at 14:25). Getting this wrong makes the whole demo incoherent.

### Deliberate detector warning

The ghost bar transitions `left` and `width`. `impeccable detect` flags this as a layout transition.
**It is intentional and must stay**: on a Gantt bar those properties *are* the datum, and a transform
substitute would scale the label and misreport the time. The reason is commented at the call site.
The same transition was correctly removed from the static occupancy bars, where it bought nothing.

---

## 8. State model

`state/opsStore.tsx` — one reducer, one context, consumed via `useOps()`.

```ts
type Phase = 'idle' | 'running' | 'ready' | 'no_plan';
```

### Three separate plan pointers — do not collapse them

| Field | Set by | Meaning |
| --- | --- | --- |
| `previewPlanId` | hover, focus | Draws the ghost. **Decides nothing.** Cleared on list mouse-leave. |
| `selectedPlanId` | click, Enter/Space, arrow keys | What the decision bar acts on |
| `committedPlanId` | approving | The authorised plan |

The chart draws `committed ?? preview ?? selected`.

This split exists because of a real bug found at review: with one pointer, moving the mouse toward
the Approve button re-pointed "Approve Plan X" at whatever row the pointer crossed last. **Never
route hover into selection.** The `preview` reducer case is also a no-op once `committedPlanId` is
set, so a passing pointer cannot erase an authorisation.

### Staleness

Changing any disruption input after a run sets `stale: true`. The ledger shows an "inputs changed"
strip with a re-run button, plan rows drop to 50% opacity, and Approve is disabled. This prevents
the console from showing plans scored against inputs the operator has since changed.

### Run lifecycle

`run()` increments a `runToken`; every dispatch carries it and is discarded if it does not match.
This makes rapid re-runs safe. Agent lanes are revealed on a fixed 340ms cadence
(`REVEAL_STEP_MS`) while the request is in flight, and `Promise.all([request, wait(settleAt)])`
ensures the reveal always completes even if the response returns instantly.

### `toPlanRows()`

Joins `candidate_plans` to `optimiser_results` by `plan_id`, degrading to a single row built from
`recommended_plan` + `impact` when the backend sends neither. Sorts feasible-first, then by score.
**This is the only place response shape is normalised** — add new response handling here.

---

## 9. Component states

Every interactive element ships default / hover / focus / active / disabled. Beyond that:

| State | Where |
| --- | --- |
| Empty (first run) | `states/EmptyBoard.tsx` — teaches the four-step loop, does not say "nothing here" |
| Loading | `states/PlanSkeleton.tsx` — structural placeholders matching the rows they replace, not a spinner |
| Agent pending / running / completed / failed | `AgentRail.tsx`, with `aria-live="polite"` on the list |
| Stale | `PlanLedger.tsx` `StaleNotice` |
| Infeasible plan | `PlanLedger.tsx` — struck through, violation stated, approval blocked |
| No feasible plan at all | `DecisionBar.tsx` — names the recovery paths, not just the failure |
| Service unreachable | `App.tsx` `ServiceNotice` + the `MOCK` pill |

### Accessibility

- Plan rows are a `radiogroup` of `radio`s; arrow keys move selection and focus together, Enter/Space
  selects, focus ring is 2px `--ghost`.
- Agent stream is `aria-live="polite"` with `aria-busy` during a run.
- Icons are `aria-hidden` unless given a `title`.
- All text meets 4.5:1 (see §5).
- `prefers-reduced-motion` honoured globally.

---

## 10. Synthetic data — read before demoing

`src/mock/airport_state.ts` is an **invented** Terminal 2 stand board: 6 stands (B6–B16, four
code-E widebody, two code-C narrowbody), 7 flights. Exact Changi gate allocations, turnaround
progress, baggage state and passenger connections are not public information.

This is disclosed **in the interface**, not only here: the chart legend reads
"SQ318 · synthetic stand data" and the page footer reads "DECISION SUPPORT ONLY · STAND ALLOCATION,
TURNAROUND AND PASSENGER CONNECTION FIGURES ARE SYNTHETIC AND NOT OPERATIONAL CHANGI DATA".
**Do not remove either.** Never present this as real Changi data in a demo, a slide or a README.

Real flight and weather data reach the console only through the backend agents.

### The local engine

`src/mock/engine.ts` is a deterministic stand-in for the orchestrator and optimiser, sanctioned by
contract §12/§18. **There is no randomness** — the same inputs always produce the same plans,
feasibility verdicts and scores.

Operating constants:

```
TURN_BUFFER_MIN         20    slack already in the published turnaround
STAND_CLEAR_MIN          8    pushback → stand actually clear
RELOCATE_MIN             6    tow to an adjacent compatible stand
BAGGAGE_FULL_MIN        40    ramp minutes for a full hold load
PRIORITY_BAGGAGE_FACTOR 0.6   expediting tight-connection bags
WX_TAIL_MIN             10    queue recovery after a convective cell clears
```

Scoring (mirrors contract §9; lower is better):

```
score = 0.6·departure_delay + 40·gate_conflicts + 0.9·passengers_at_risk
      + 0.25·downstream_delay + 1.0·operational_cost
op_cost: hold 0 · relocate 6 · displace_claimant 12 · weather_window +4
```

Hard constraints are checked **before** scoring. A violating plan returns
`feasible: false, score: null` with a `constraint_violations` entry and can never be selected.

The three plans it generates:

- **Plan A — hold the stand.** Depart when the ramp finishes. Infeasible by default: clears B8 at
  14:30 against SQ871's 14:25 claim.
- **Plan B — relocate + expedite bags.** Tow to the first free compatible stand and prioritise
  tight-connection baggage. Wins by default at 14:18, +18 min, score 28.7.
- **Plan C — hold and displace.** Keep B8, re-sequence SQ871, wait out the weather cell. Feasible
  but expensive: 14:40, +40 min, score 56.

**Replace it, do not merge with it.** When the real service is live, `client.ts` stops calling it and
nothing else changes.

### Time

`lib/scenarioClock.ts` is the **single time source**. `SCENARIO_NOW_MIN` = 13:47, ticking forward in
real seconds. The top strip (labelled `SGT SCENARIO`), the chart's now-line and the decision log all
read it. There is deliberately **no wall clock anywhere** — two clocks labelled SGT on one screen,
two hours apart, was a review finding.

`scenarioNowMinutes()` is the non-React accessor for use inside the reducer.

---

## 11. Demo script

1. The board opens already showing the collision: SQ318's amber bar on B8 running into the red
   hatched clearance overrun against SQ871's 14:25 claim.
2. Adjust the disruption on the left. Before the first run the board reacts live.
3. **Run recovery.** Six agent lanes fill in with findings and hard constraints.
4. Three plans score. Plan A is infeasible with the reason stated. Plan B wins.
5. Hover or arrow between plan rows — the dashed cyan ghost moves on the chart above.
6. **Approve.** The ghost snaps to solid green on B10, the overrun clears from B8, the header flips
   to "No stand overrun on the board", a link is drawn from the old stand to the new one, and the
   decision is logged in scenario time.

Two things worth showing a judge:

- **Turn the stand conflict off and re-run.** The recommendation flips from Plan B to Plan A. This
  proves the optimiser is genuinely deterministic and not a scripted demo. (Verified in-session.)
- **Push inbound-late past 45 min.** The feasible set collapses.

---

## 12. Known limitations

Honest list. None of these break the build.

- At 1440×900 the lower band scrolls once to reach all six disruption controls and the third plan
  row. At 1920×1080 everything fits. Judged acceptable; a design review flagged it as partial.
- One `impeccable detect` warning remains, on the ghost bar's layout transition. Deliberate — §7.
- The board's live re-derivation from control changes applies only before the first run; afterwards
  `buildBoardModel` prefers `response.scenario_state` and control changes mark the ledger stale
  instead. This is coherent but is not what an earlier comment claimed.
- Scope is contract §19's MVP: one disrupted flight, three candidate plans, one recommendation.
  Multi-flight recovery is not modelled.
- No unit tests. Verification was typecheck + production build + scripted browser walkthrough of the
  full loop at 390 / 1440 / 1920 px.

---

## 13. Rules for anyone changing this

1. **Never rename a shared JSON field.** `types/contract.ts` mirrors `docs/API_CONTRACT.md`. Add
   optional fields; do not rename or remove. Tell the team about any change.
2. **Keep the frontend's backend surface at exactly one endpoint.** No new API calls.
3. **A new color needs both `--x` and `--x-rgb`**, or Tailwind alpha modifiers silently no-op.
4. **Dashed = provisional, solid = committed.** Do not break the semantic.
5. **Hover previews; click selects.** Never route hover into a decision.
6. **Infeasible plans can never be approved.**
7. **Do not remove the synthetic-data disclosures.**
8. **Numbers get `.tnum`.** Times, flight codes and scores get `font-data`. Prose never does.
9. **No rounded cards, no gradient text, no emoji icons, no display fonts in UI labels.**
10. Positioning on the chart goes through `pct()` / `widthPct()`, never raw percentages.

Design direction and its rationale: `.impeccable/surfaces/frontend-src-app-tsx.md`.
Product truth: `PRODUCT.md`. Integration detail: `frontend/README.md`.
