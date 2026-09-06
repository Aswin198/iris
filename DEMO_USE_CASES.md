# IRIS demo use cases

The dispatcher replay starts at Tuesday 12:00 SGT and runs in real time. The
first aircraft, SQ858, arrives at 12:15 and can be opened from 12:00. Its
turnaround block runs from 12:15 to 13:50.

## 1. Clean turnaround

Use SQ858 when it is available at 12:00.

- Inbound aircraft late: `0 min`
- Weather: `Clear`
- Stand conflict: `Off`
- Ground handling delay: `0 min`
- Hold baggage loaded: `100%`
- Connecting passengers: `20`

Run recovery. The SQ858 block stays green and Plan A should be the simple
hold-current-stand option.

## 2. Recoverable stand conflict

Use SQ858 or SQ318 and turn the conflict on.

- Inbound aircraft late: `45 min`
- Weather: `Clear`
- Stand conflict: `On`
- Claimed from: `14:25`
- Ground handling delay: `12 min`
- Hold baggage loaded: `75%`
- Connecting passengers: `42`

Run recovery. Plan A should show a red overrun at B8. Preview Plan B or Plan C
to show a dashed green candidate on another compatible stand, then approve it.
The full turnaround block moves to the chosen stand and becomes green.

## 3. Weather and passenger pressure

Use SQ318 when it becomes available at 13:45.

- Inbound aircraft late: `20 min`
- Weather: `Thunderstorm`
- Stand conflict: `Off`
- Ground handling delay: `30 min`
- Hold baggage loaded: `50%`
- Connecting passengers: `100`

Run recovery and expand the agent lanes. This demonstrates weather, ground,
passenger-risk and downstream-delay tradeoffs without requiring a gate move.

## 4. No feasible recovery

Use any available widebody flight.

- Inbound aircraft late: `75 min`
- Weather: `Thunderstorm`
- Stand conflict: `On`
- Claimed from: `14:25`
- Ground handling delay: `40 min`
- Hold baggage loaded: `0%`
- Connecting passengers: `120`

Run recovery. The feasible set should collapse and the console should show the
no-feasible-plan state, with the recovery agent escalating to the duty manager.

The flight list is a replay dataset, so future aircraft remain visible but
locked until 15 minutes before arrival. The selected arriving flight ID is sent
to the recovery service and then to the flight agent for OpenSky tracking.
