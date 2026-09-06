# IRIS Project Chat Context

This file captures the working context from the IRIS dispatcher dashboard conversation.

## User requests and decisions

1. Read and understand the repository.
2. The dispatcher dashboard timing changed to SGT but still displayed 13:20–15:20. Fix it.
3. Follow SGT time dynamically.
4. Run the npm command.
5. The timing window returned to 13:20–15:20.
6. Clicking different aircraft from the list always selected SQ318. Investigate whether the API returns the correct aircraft and why SQ318, which arrives in the afternoon, appeared in that timing.
7. The backend is running.
8. Fix the aircraft selection issue.
9. Investigate why the dashboard always used four fixed aircraft.
10. Replace the fixed aircraft list with the aircraft sent by the API.
11. Check other free sources for incoming flights into SIN, then load the selected aircraft through OpenSky if possible.
12. Use a free alternative instead of Aviation Edge.
13. Use mocked Tuesday flight arrival data from 12:00–23:59 so the dashboard looks live. Dispatchers should only see an aircraft five minutes before arrival. Use a live replay instead of real flight arrival APIs.
14. Include other flights with outbound flights leaving Singapore, show inbound and outbound timing, and pass the selected aircraft to OpenSky.
15. Slow replay time to 30 fake seconds per one real second.
16. Add outbound movements for all aircraft and add another aircraft at 12:10. Avoid waiting 20 minutes before selecting the first aircraft.
17. If SQ858 moves from B8 to B12, move the whole block. Allow recovery-plan selection 15 minutes ahead so SQ858 can shift to a 12:15 arrival. Keep the replay speed unchanged at that point.
18. Return replay time to normal pace.
19. Move the entire 12:15–13:50 block to whichever gate is chosen.
20. Show four hours of the timeline.
21. Make a block green when there is no conflict. Make it red when a delay creates a conflict. Turn it green again after a conflict-free recovery plan is chosen.
22. Confirm whether SQ858 conflicts with SQ871 when the inbound aircraft is delayed by 20 minutes.
23. Make the projected-plan box follow the actual flight-time box.
24. Add several editable demo use cases and explain how to demonstrate the full product.
25. Fix the case where moving SQ858 to B10 occupied SQ638's block but the block became green. It should be red.
26. Do not suggest B10 when an aircraft is scheduled there.
27. Check whether agents are being used.
28. Investigate why the system always suggests three plans, including duplicate plans A and C.
29. Do not hardcode the outcome; let the agents decide.
30. Execute that agent-driven behavior.
31. Confirm whether agents use newly changed timing and block-time variables when recovery is run.
32. Confirm whether agents can use the extra timing variables.
33. Make gate conflict dynamic by checking for an actual schedule clash with another aircraft.
34. Fix scoring around baggage and prevent clashing plans from being allowed.
35. Remove dependencies on baggage, ground handling, and other factors so the outcome depends on aircraft delay.
36. Show the expected block time because the blue projected box was larger than the original block.
37. Explain why the bar was green when it overran gate availability.
38. Make gate changes increase the score.
39. Remove MI622 and make farther gates score higher because passengers need to walk farther through the airport.
40. Keep B14 empty so the higher score for a farther gate can be demonstrated.
41. Generate the entire chat context into an MD file.

## Implemented behavior

### Dispatcher replay

- Added a Tuesday replay dataset dated `2026-09-08`.
- The replay starts at 12:00 SGT and progresses at normal pace: one fake second per real second.
- The dashboard shows a rolling four-hour window.
- Incoming flights remain visible but become selectable 15 minutes before arrival.
- Each incoming flight includes an outbound movement after its turnaround.
- The dashboard refreshes the replay flight list from `GET /api/flights`.
- The selected flight drives the dashboard, top bar, workspace, and stand plan.

### Flight data

The mock arrival dataset includes SQ858, TR678, SQ318, QF001, SQ221, EK354, MH601, SQ12, TK54, SQ231, TR16, and SQ286. SQ858 is the first selectable flight at 12:00 for its 12:15 arrival.

MI622 was removed from the frontend mock stand board. B14 is retained as an empty compatible stand so it can be used to demonstrate the distance scoring.

### Gate and timeline behavior

- Moving a flight moves its full turnaround block.
- Occupancy clashes are recalculated dynamically against other blocks.
- Stand deadline overruns are shown as conflicts.
- Conflict blocks are red; conflict-free blocks are green.
- Projected plans begin at the actual arrival time and show the expected block duration.
- B14 is empty and available for compatible recovery plans.

### Recovery scoring

- Recovery timing and passenger-risk scoring depend on aircraft delay.
- Baggage and ground-handling delays no longer affect the recovery result.
- Gate changes add a base score cost.
- Gate distance adds an additional score cost using the numerical difference between stand numbers:
  - B8 → B10: 2 gate units, +3 points.
  - B8 → B12: 4 gate units, +6 points.
  - B8 → B14: 6 gate units, +9 points.
- The plan ledger displays the walking-distance component when applicable.
- Plans with timing or stand violations are infeasible and do not receive a valid score.

## Relevant files

- `src/components/dispatcher/` — dispatcher dashboard UI.
- `src/state/dispatcherStore.tsx` — replay flight loading and selection.
- `src/lib/scenarioClock.ts` — SGT replay clock.
- `src/mock/airport_state.ts` — frontend mock stand board and scenario data.
- `src/mock/engine.ts` — frontend fallback recovery scoring.
- `src/components/plans/PlanLedger.tsx` — plan metrics and score display.
- `backend/flights.py` — Tuesday replay flight dataset and API response.
- `backend/main.py` — flights and recovery API endpoints.
- `backend/orchestrator/state_builder.py` — dynamic gate conflicts and alternative gates.
- `backend/orchestrator/orchestrator.py` — agent output scoring and feasibility checks.
- `DEMO_USE_CASES.md` — demo scenarios.

## Validation status

The latest changes passed:

- `npm run typecheck`
- `npm run build`
- Python AST syntax checks for the modified backend files

The Vite development server is available at `http://127.0.0.1:5173/` when running.
