/**
 * What the planner draws, derived from whatever the console currently knows.
 *
 * Before a run, that is the operator's own control settings (read locally, so
 * the board reacts as they set the disruption up). After a run, the response's
 * scenario_state wins — the backend is the authority once it has spoken.
 */

import type { RecoveryResponse } from '../types/contract';
import { deriveState, type DisruptionInput } from '../mock/engine';
import { BASE_SCENARIO, BOARD_END_MIN, BOARD_START_MIN } from '../mock/airport_state';
import { isoToSgtMinutes } from '../lib/time';
import type { PlanRow } from './opsStore';

export interface BoardModel {
  /** minutes since midnight SGT */
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

export function buildBoardModel(
  disruption: DisruptionInput,
  response: RecoveryResponse | null,
  committed?: PlanRow | null,
): BoardModel {
  const d = deriveState(disruption);
  const requiredOffBlock = d.earliest_ready_min + d.baggage_remaining_min;

  const scenario = response?.scenario_state;

  const scheduled = scenario
    ? isoToSgtMinutes(scenario.flight.scheduled_departure)
    : d.scheduled_departure_min;

  const offBlock = scenario
    ? isoToSgtMinutes(scenario.ground_operations.estimated_ready_time)
    : requiredOffBlock;

  const deadline = scenario
    ? scenario.gate.conflict && scenario.gate.conflict_time
      ? isoToSgtMinutes(scenario.gate.conflict_time)
      : null
    : d.stand_deadline_min;

  const overrun = deadline === null ? 0 : Math.max(0, offBlock + STAND_CLEAR_MIN - deadline);

  return {
    scheduled_departure_min: scheduled,
    required_off_block_min: offBlock,
    stand_deadline_min: deadline,
    weather_window: d.weather_window,
    weather_condition: scenario?.weather.condition ?? disruption.weather_condition,
    current_gate: scenario?.gate.current_gate ?? BASE_SCENARIO.flight.current_gate,
    overrun_min: overrun,
    committed_off_block_min: committed?.off_block_min ?? null,
    committed_stand_id: committed?.stand_id ?? null,
  };
}

/** Position on the board, 0–100, clamped to the visible window. */
export function pct(min: number): number {
  const span = BOARD_END_MIN - BOARD_START_MIN;
  return Math.max(0, Math.min(100, ((min - BOARD_START_MIN) / span) * 100));
}

export function widthPct(fromMin: number, toMin: number): number {
  return Math.max(0, pct(toMin) - pct(fromMin));
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
    from_min: Math.min(board.scheduled_departure_min, plan.off_block_min - 20),
    to_min: plan.off_block_min,
    label: plan.label,
    committed: plan.plan_id === committedPlanId,
  };
}
