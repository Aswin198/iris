/**
 * What the planner draws, derived from whatever the console currently knows.
 *
 * Before a run, that is the operator's own control settings (read locally, so
 * the board reacts as they set the disruption up). After a run, the response's
 * scenario_state wins — the backend is the authority once it has spoken.
 */

import type { RecoveryResponse } from '../types/contract';
import { deriveState, type DisruptionInput } from '../mock/engine';
import { BASE_SCENARIO } from '../mock/airport_state';
import { isoToSgtMinutes } from '../lib/time';
import { scenarioNowMinutes } from '../lib/scenarioClock';
import type { PlanRow } from './opsStore';
import type { DispatcherFlight } from './dispatcherStore';

export interface BoardModel {
  /** minutes since midnight SGT */
  arrival_min: number;
  /** planned outbound departure / off-block time */
  scheduled_departure_min: number;
  /** earliest the airframe can go, ramp work included */
  required_off_block_min: number;
  /** the claimant needs the current stand from here */
  stand_deadline_min: number | null;
  weather_window: { start_min: number; end_min: number } | null;
  weather_condition: string;
  current_gate: string;
  /** stand clearance overruns the deadline by this many minutes if held */
  overrun_min: number;
  /** off-block actually authorised, once an operator has committed a plan */
  committed_off_block_min: number | null;
  /** stand the authorised plan moves the aircraft to */
  committed_stand_id: string | null;
}

const STAND_CLEAR_MIN = 8;

export interface BoardWindow {
  start_min: number;
  end_min: number;
}

/** A four-hour rolling window starting at the current SGT minute. */
export function getBoardWindow(nowMin = scenarioNowMinutes()): BoardWindow {
  const start = Math.floor(nowMin);
  return { start_min: start, end_min: start + 240 };
}

export function buildBoardModel(
  disruption: DisruptionInput,
  response: RecoveryResponse | null,
  committed?: PlanRow | null,
  selectedFlight?: DispatcherFlight,
): BoardModel {
  const d = deriveState(disruption);
  const selectedScheduled = selectedFlight
    ? isoToSgtMinutes(selectedFlight.scheduled_departure)
    : d.scheduled_departure_min;
  const disruptionOffset = d.earliest_ready_min + d.baggage_remaining_min - d.scheduled_departure_min;
  const requiredOffBlock = selectedScheduled + disruptionOffset;

  const scenario = response?.scenario_state;

  const scheduled = scenario
    ? isoToSgtMinutes(scenario.flight.scheduled_departure)
    : selectedScheduled;

  const arrival = scenario
    ? isoToSgtMinutes(scenario.flight.scheduled_arrival)
    : selectedFlight
      ? isoToSgtMinutes(selectedFlight.scheduled_arrival)
      : isoToSgtMinutes(BASE_SCENARIO.flight.scheduled_arrival);

  const offBlock = scenario
    ? isoToSgtMinutes(scenario.ground_operations.estimated_ready_time)
    : requiredOffBlock;

  const deadline = scenario
    ? scenario.gate.conflict && scenario.gate.conflict_time
      ? isoToSgtMinutes(scenario.gate.conflict_time)
      : null
    : selectedFlight && d.stand_deadline_min !== null
      ? selectedScheduled + (d.stand_deadline_min - d.scheduled_departure_min)
      : d.stand_deadline_min;

  const overrun = deadline === null ? 0 : Math.max(0, offBlock + STAND_CLEAR_MIN - deadline);

  return {
    arrival_min: arrival,
    scheduled_departure_min: scheduled,
    required_off_block_min: offBlock,
    stand_deadline_min: deadline,
    weather_window: response ? null : d.weather_window,
    weather_condition: response ? '' : disruption.weather_condition,
    current_gate: scenario?.gate.current_gate ?? selectedFlight?.gate ?? BASE_SCENARIO.flight.current_gate,
    overrun_min: overrun,
    committed_off_block_min: committed?.off_block_min ?? null,
    committed_stand_id: committed?.stand_id ?? null,
  };
}

/** Position on the board, 0–100, clamped to the visible window. */
export function pct(min: number, window = getBoardWindow()): number {
  const span = window.end_min - window.start_min;
  return Math.max(0, Math.min(100, ((min - window.start_min) / span) * 100));
}

export function widthPct(fromMin: number, toMin: number, window = getBoardWindow()): number {
  return Math.max(0, pct(toMin, window) - pct(fromMin, window));
}

/** Where the projected plan's ghost bar sits, if a plan is focused. */
export interface GhostBar {
  stand_id: string;
  from_min: number;
  to_min: number;
  label: string;
  committed: boolean;
}

export function buildGhost(
  plan: PlanRow | null,
  board: BoardModel,
  committedPlanId: string | null,
): GhostBar | null {
  if (!plan) return null;
  return {
    stand_id: plan.stand_id,
    from_min: board.arrival_min,
    to_min: plan.off_block_min,
    label: plan.label,
    committed: plan.plan_id === committedPlanId,
  };
}
