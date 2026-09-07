import { useEffect, useState } from 'react';

const REPLAY_BOOT_MS = Date.now();
export const REPLAY_DATE = '2026-09-08';
export const REPLAY_START_MINUTE = 13 * 60 + 54 + 50 / 60;
export const REPLAY_SECONDS_PER_REAL_SECOND = 1;


export function scenarioNowMinutes(): number {
  return REPLAY_START_MINUTE +
    ((Date.now() - REPLAY_BOOT_MS) / 1000) *
      (REPLAY_SECONDS_PER_REAL_SECOND / 60);
}

export const replayNowMinutes = scenarioNowMinutes;


export function useScenarioClock(): {
  minutes: number;
  seconds: number;
} {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(
      () => tick((n) => n + 1),
      1000
    );

    return () =>
      window.clearInterval(id);
  }, []);

  const totalSeconds =
    scenarioNowMinutes() * 60;

  return {
    minutes:
      totalSeconds / 60,

    seconds:
      Math.floor(
        totalSeconds % 60
      ),
  };
}
