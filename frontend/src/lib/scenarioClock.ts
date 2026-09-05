/**
 * One clock for the whole console.
 *
 * The board, the plans and the decision log all live inside a fixed scenario
 * window, so showing the operator's real wall time beside them would put two
 * unrelated "SGT" readings on the same screen. Everything reads this instead:
 * scenario time, ticking forward in real seconds from the scenario's own now.
 */

import { useEffect, useState } from 'react';

/** Scenario now, in minutes since midnight SGT. */
export const SCENARIO_NOW_MIN = 13 * 60 + 47;

const BOOT_MS = Date.now();

/** Scenario time right now, in minutes since midnight SGT. Usable outside React. */
export function scenarioNowMinutes(): number {
  return SCENARIO_NOW_MIN + (Date.now() - BOOT_MS) / 60_000;
}

export function useScenarioClock(): { minutes: number; seconds: number } {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const totalSeconds = scenarioNowMinutes() * 60;
  return { minutes: totalSeconds / 60, seconds: Math.floor(totalSeconds % 60) };
}
