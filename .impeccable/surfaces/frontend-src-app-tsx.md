---
version: 1
slug: "frontend-src-app-tsx"
primary_target: "frontend/src/App.tsx"
related_targets: []
---

Scope: the AeroSync airport operations console (frontend/src/App.tsx and its component tree).
Visitor mode: Operate.

Audience: an airport/airline operations controller in a dim operations control centre, mid-task,
category-fluent in stand charts and METARs. Job: see the break in the plan, weigh recovery options,
commit one. Action: approve or reject a recovery plan. Content: the /api/recovery response
(docs/API_CONTRACT.md §10) plus a synthetic Changi T2 stand board, labelled synthetic in the UI.
Constraints: snake_case contract fields are never renamed; frontend depends only on POST /api/recovery;
infeasible plans are never recommended; simulated data is never presented as real Changi data.

## Direction contract

THESIS: The stand-allocation chart IS the interface — a gate conflict is a bar collision you can see,
and every candidate recovery plan is a ghost bar projected onto that chart before it is committed.
Refuses the category default: the dark admin dashboard of KPI stat cards, a map panel and a chat log.

OWN-WORLD: Planning-board ground #0E141B, panels #151E27, hairline rules #24313D. Four named status
roles carrying whole regions, not accents: other traffic steel #3E5266, subject flight signal amber
#F0A02A, conflict alert red #E2483C on 45-degree hatch, projected ghost cyan #46B6D9 dashed,
committed green #2FBF71, weather wash violet #7C6CE0. Archivo / Archivo Narrow for UI and dense row
labels, Azeret Mono for every time, flight code and score. Fixed rem scale ~1.15. Components are
ruled rows and bars on a shared minute grid; nothing is a rounded card floating in space.

STORY: The controller sees the board and the collision, watches six agents establish what is true and
what is hard-constrained, compares three scored plans against the same time axis, and commits one —
understanding that an LLM proposed it, a deterministic optimiser scored it, and they authorised it.

FIRST VIEWPORT: Top strip: WSSS · CHANGI, scenario SGT clock, scenario id, MOCK/LIVE pill. Below it
the stand planner owns roughly half the height, full width (revised down from two thirds at the
finish review: the three task panels beneath cannot do their job in what two thirds would leave, and
starving them would fail Operate mode to satisfy a number): labelled stand rows down the left in
Archivo Narrow, minute axis across the top, occupancy bars on the grid, the SQ318 bar in amber running
into a hatched red conflict, a violet weather band spanning the risk window, a bright NOW line. Left
column beneath: the disruption console with RUN RECOVERY as the primary action. Right beneath: the
six-lane agent rail. Full-width bottom: the plan ledger, three ruled rows with metrics and score bars,
and the approve/reject bar anchored at its right.

FORM: The Stand Planner (airport CDM stand-allocation chart), user-pinned, ahead of the roll.
Candidate 1 of my grounded list. Seed key 0b2a41eb (assigned index 6, overridden by the user's pin).

RAISE — from the split-flap concourse challenger (declined on identity, kept for discipline): a row is
a live entity. Changing values cascade character by character in place rather than fading, and delayed,
infeasible or committed states restyle the row inside the grid instead of breaking it.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict,
DESIGN.md, and every shipping raster carrying its provenance.
