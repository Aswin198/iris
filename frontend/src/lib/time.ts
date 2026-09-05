/** Time helpers. The contract carries ISO 8601 with offset; the console renders SGT. */

export const SGT_OFFSET_MIN = 8 * 60;

/** Minutes since midnight SGT for an ISO timestamp. */
export function isoToSgtMinutes(iso: string): number {
  const d = new Date(iso);
  const utcMinutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  return (utcMinutes + SGT_OFFSET_MIN + 1440) % 1440;
}

/** "14:18" — the only place a bare wall-clock string is allowed to exist. */
export function hhmm(iso: string): string {
  return minutesToHhmm(isoToSgtMinutes(iso));
}

export function minutesToHhmm(mins: number): string {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Build an ISO+08:00 timestamp on the scenario's date from minutes-since-midnight. */
export function sgtMinutesToIso(dateYmd: string, mins: number): string {
  return `${dateYmd}T${minutesToHhmm(mins)}:00+08:00`;
}

export function shiftIso(iso: string, deltaMinutes: number): string {
  const d = new Date(new Date(iso).getTime() + deltaMinutes * 60_000);
  const sgt = new Date(d.getTime() + SGT_OFFSET_MIN * 60_000);
  const ymd = sgt.toISOString().slice(0, 10);
  return `${ymd}T${minutesToHhmm(sgt.getUTCHours() * 60 + sgt.getUTCMinutes())}:00+08:00`;
}

export function minutesBetween(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60_000);
}

export function signedMinutes(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
