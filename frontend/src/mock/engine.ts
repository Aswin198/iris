/**
 * Local scenario engine — stands in for the backend orchestrator + optimiser
 * while they are being built (sanctioned by API_CONTRACT.md §12 / §18).
 *
 * It emits exactly the shapes in src/types/contract.ts. When Person 1's
 * POST /api/recovery is live, src/api/client.ts stops calling this and nothing
 * else in the console changes.
 *
 * The scoring here is deterministic and mirrors §9. No randomness: the same
 * disruption inputs always produce the same plans, the same feasibility
 * verdicts and the same scores.
 */

import type {
  AgentResponse,
  CandidatePlan,
  OptimiserResult,
  RecoveryResponse,
  ScenarioState,
  Severity,
} from '../types/contract';
import { BASE_SCENARIO, SCENARIO_DATE, STAND_BOARD, WIDEBODY_STANDS } from './airport_state';
import { isoToSgtMinutes, minutesToHhmm, sgtMinutesToIso } from '../lib/time';

/* ---- operator-facing disruption inputs -------------------------------- */

export type WeatherCondition = 'clear' | 'rain' | 'thunderstorm';

export interface DisruptionInput {
  /** minutes the inbound aircraft is running late */
  late_incoming_minutes: number;
  /** minutes of extra ground-handling time on the turnaround */
  ground_handling_delay_minutes: number;
  weather_condition: WeatherCondition;
  /** another aircraft claims the current stand */
  gate_conflict: boolean;
  /** minutes since midnight SGT the claimant needs the stand */
  gate_conflict_min: number;
  /** how many of the 280 passengers are connecting onward */
  connecting_passengers: number;
  /** ramp progress on hold baggage at the moment of the disruption */
  baggage_percent: number;
}

export const DEFAULT_DISRUPTION: DisruptionInput = {
  late_incoming_minutes: 20,
  ground_handling_delay_minutes: 12,
  weather_condition: 'thunderstorm',
  gate_conflict: true,
  gate_conflict_min: 14 * 60 + 25,
  connecting_passengers: 42,
  baggage_percent: 75,
};

/* ---- operating constants (deterministic, tunable) --------------------- */

const TURN_BUFFER_MIN = 20; // slack already in the published turnaround
const STAND_CLEAR_MIN = 8; // pushback-to-stand-clear
const RELOCATE_MIN = 6; // tow to an adjacent compatible stand
const PRIORITY_BAGGAGE_FACTOR = 0.6; // expediting tight-connection bags

/** §9 weights. Lower total score is a better recovery plan. */
export const SCORE_WEIGHTS = {
  departure_delay: 0.6,
  gate_conflict: 40,
  passenger_impact: 0.9,
  downstream_delay: 0.25,
  operational_cost: 1.0,
} as const;

const OP_COST = {
  hold: 0,
  relocate: 6,
  displace_claimant: 12,
  weather_window: 4,
} as const;
const GATE_DISTANCE_SCORE_PER_UNIT = 1.5;

function gateDistance(currentGate: string, recommendedGate: string): number {
  if (currentGate === recommendedGate) return 0;
  const currentNumber = Number(currentGate.replace(/\D/g, ''));
  const recommendedNumber = Number(recommendedGate.replace(/\D/g, ''));
  return Number.isFinite(currentNumber) && Number.isFinite(recommendedNumber)
    ? Math.abs(recommendedNumber - currentNumber)
    : 0;
}

/* ---- derived scenario state ------------------------------------------- */

export interface DerivedState {
  scheduled_departure_min: number;
  earliest_ready_min: number;
  baggage_remaining_min: number;
  weather_window: { start_min: number; end_min: number } | null;
  weather_risk: 'low' | 'medium' | 'high';
  stand_deadline_min: number | null;
  alternative_stands: string[];
}

export function deriveState(input: DisruptionInput): DerivedState {
  const scheduled = isoToSgtMinutes(BASE_SCENARIO.flight.scheduled_departure);

  const inboundPush = Math.max(0, input.late_incoming_minutes - TURN_BUFFER_MIN);
  const earliestReady = scheduled + inboundPush;

  // Recovery timing is driven only by inbound aircraft delay.
  const baggageRemaining = 0;

  const weatherRisk =
    input.weather_condition === 'thunderstorm'
      ? 'high'
      : input.weather_condition === 'rain'
        ? 'medium'
        : 'low';

  const weatherWindow =
    weatherRisk === 'high'
      ? { start_min: scheduled + 10, end_min: scheduled + 30 }
      : weatherRisk === 'medium'
        ? { start_min: scheduled + 5, end_min: scheduled + 15 }
        : null;

  // Stands the 777-300ER can be towed to: compatible, not the current one, and
  // free across the recovery window on the synthetic board.
  const occupiedLater = new Set(
    STAND_BOARD.filter((s) =>
      s.blocks.some(
        (b) => !b.subject && b.end_min > earliestReady && b.start_min < earliestReady + 90,
      ),
    ).map((s) => s.stand_id),
  );
  const alternatives = WIDEBODY_STANDS.filter(
    (id) => id !== BASE_SCENARIO.flight.current_gate && !occupiedLater.has(id),
  );

  return {
    scheduled_departure_min: scheduled,
    earliest_ready_min: earliestReady,
    baggage_remaining_min: baggageRemaining,
    weather_window: weatherWindow,
    weather_risk: weatherRisk,
    stand_deadline_min: input.gate_conflict ? input.gate_conflict_min : null,
    alternative_stands: alternatives,
  };
}

/** Connection risk climbs once a departure slips past the connection buffer. */
function passengersAtRisk(_input: DisruptionInput, delayMinutes: number): number {
  const exposed = Math.max(0, delayMinutes - 10);
  return Math.round((exposed * 0.7) / 60);
}

export function buildScenarioState(input: DisruptionInput): ScenarioState {
  const d = deriveState(input);
  const doNothingDelay = Math.max(
    0,
    d.earliest_ready_min + d.baggage_remaining_min - d.scheduled_departure_min,
  );

  return {
    scenario_id: BASE_SCENARIO.scenario_id,
    flight: {
      ...BASE_SCENARIO.flight,
      aircraft_ready_time: sgtMinutesToIso(SCENARIO_DATE, d.earliest_ready_min),
    },
    weather: {
      condition: input.weather_condition,
      risk_level: d.weather_risk,
      visibility_m:
        input.weather_condition === 'thunderstorm'
          ? 5000
          : input.weather_condition === 'rain'
            ? 7000
            : 9999,
      wind_speed_kt: input.weather_condition === 'thunderstorm' ? 16 : 8,
      wind_direction_deg: 220,
    },
    gate: {
      current_gate: BASE_SCENARIO.flight.current_gate,
      conflict: input.gate_conflict,
      conflict_time: input.gate_conflict
        ? sgtMinutesToIso(SCENARIO_DATE, input.gate_conflict_min)
        : null,
      alternative_gates: d.alternative_stands,
    },
    ground_operations: {
      baggage_percent: input.baggage_percent,
      refuelling_complete: true,
      cleaning_complete: input.ground_handling_delay_minutes < 20,
      boarding_percent: 60,
      estimated_ready_time: sgtMinutesToIso(
        SCENARIO_DATE,
        d.earliest_ready_min + d.baggage_remaining_min,
      ),
    },
    passengers: {
      total_passengers: BASE_SCENARIO.passengers.total_passengers,
      connecting_passengers: input.connecting_passengers,
      at_risk_connections: passengersAtRisk(input, doNothingDelay),
    },
  };
}

/* ---- candidate plans + optimiser --------------------------------------- */

export interface EvaluatedPlan {
  plan: CandidatePlan;
  result: OptimiserResult;
  /** operator-facing shorthand shown on the ledger row */
  strategy: string;
  off_block_min: number;
  stand_id: string;
  /** flight whose own stand booking this plan disturbs, if any */
  displaces?: string;
}

interface PlanSpec {
  plan_id: string;
  strategy: string;
  stand_id: string;
  off_block_min: number;
  op_cost: number;
  actions: string[];
  displaces?: string;
  /** holding past the stand deadline is only legal if the claimant is moved */
  resolves_conflict_by_displacement?: boolean;
}

export function generatePlans(input: DisruptionInput): EvaluatedPlan[] {
  const d = deriveState(input);
  const currentStand = BASE_SCENARIO.flight.current_gate;
  const alternative = d.alternative_stands[0] ?? null;
  const flightId = BASE_SCENARIO.flight.flight_id;

  const plans: EvaluatedPlan[] = [];

  /* PLAN A — hold the stand, depart as soon as the ramp finishes. */
  const offA = d.earliest_ready_min + d.baggage_remaining_min;
  plans.push(
    evaluate(input, d, {
      plan_id: 'plan_A',
      strategy: `Hold ${currentStand}`,
      stand_id: currentStand,
      off_block_min: offA,
      op_cost: OP_COST.hold,
      actions: [
        `Hold ${flightId} at stand ${currentStand}`,
        'Complete hold baggage loading at normal priority',
      ],
    }),
  );

  /* PLAN B — tow to a compatible free stand and expedite tight-connection bags. */
  if (alternative) {
    const offB =
      d.earliest_ready_min +
      Math.max(RELOCATE_MIN, Math.round(d.baggage_remaining_min * PRIORITY_BAGGAGE_FACTOR));
    plans.push(
      evaluate(input, d, {
        plan_id: 'plan_B',
        strategy: `${currentStand} → ${alternative}`,
        stand_id: alternative,
        off_block_min: offB,
        op_cost: OP_COST.relocate,
        actions: [
          `Reassign aircraft from ${currentStand} to ${alternative}`,
          'Prioritise baggage for passengers with tight connections',
          `Re-brief boarding at stand ${alternative}`,
        ],
      }),
    );
  }

  /* PLAN C — keep the stand, re-sequence the claimant, wait out the cell. */
  const offC = offA;
  const claimant = STAND_BOARD.find((s) => s.stand_id === currentStand)?.blocks.find(
    (b) => b.claimant,
  );
  const displacing = input.gate_conflict && Boolean(claimant);
  plans.push(
    evaluate(input, d, {
      plan_id: 'plan_C',
      strategy: `Hold ${currentStand}, delay`,
      stand_id: currentStand,
      off_block_min: offC,
      op_cost: displacing ? OP_COST.displace_claimant : OP_COST.hold,
      displaces: displacing ? claimant?.flight_id : undefined,
      resolves_conflict_by_displacement: displacing,
      actions: [
        `Hold ${flightId} at stand ${currentStand}`,
        ...(displacing && claimant
          ? [`Re-sequence ${claimant.flight_id} to an alternative stand`]
          : []),
        'Depart after the convective cell clears the field',
      ],
    }),
  );

  return plans;
}

function evaluate(input: DisruptionInput, d: DerivedState, spec: PlanSpec): EvaluatedPlan {
  const delay = Math.max(0, spec.off_block_min - d.scheduled_departure_min);
  const standClearMin = spec.off_block_min + STAND_CLEAR_MIN;

  const violations: string[] = [];
  let gateConflicts = 0;

  // Hard constraint: the stand must be clear before its next occupant arrives.
  if (
    d.stand_deadline_min !== null &&
    spec.stand_id === BASE_SCENARIO.flight.current_gate &&
    standClearMin > d.stand_deadline_min &&
    !spec.resolves_conflict_by_displacement
  ) {
    gateConflicts = 1;
    violations.push(
      `Stand ${spec.stand_id} must be clear by ${minutesToHhmm(
        d.stand_deadline_min,
      )}; this plan clears it at ${minutesToHhmm(standClearMin)}`,
    );
  }

  const downstream = Math.round(delay * 0.65);
  const atRisk = passengersAtRisk(input, delay);
  const distanceUnits = gateDistance(BASE_SCENARIO.flight.current_gate, spec.stand_id);
  const opCost = spec.op_cost + distanceUnits * GATE_DISTANCE_SCORE_PER_UNIT;

  const feasible = violations.length === 0;
  const score = feasible
    ? round1(
        SCORE_WEIGHTS.departure_delay * delay +
          SCORE_WEIGHTS.gate_conflict * gateConflicts +
          SCORE_WEIGHTS.passenger_impact * atRisk +
          SCORE_WEIGHTS.downstream_delay * downstream +
          SCORE_WEIGHTS.operational_cost * opCost,
      )
    : null;

  return {
    plan: {
      plan_id: spec.plan_id,
      flight_id: BASE_SCENARIO.flight.flight_id,
      recommended_gate: spec.stand_id,
      recommended_departure: sgtMinutesToIso(SCENARIO_DATE, spec.off_block_min),
      actions: spec.actions,
    },
    result: {
      plan_id: spec.plan_id,
      feasible,
      score,
      metrics: {
        departure_delay_minutes: delay,
        gate_conflicts: gateConflicts,
        passengers_at_risk: atRisk,
        downstream_delay_minutes: downstream,
        gate_distance_units: distanceUnits,
      },
      constraint_violations: violations,
    },
    strategy: spec.strategy,
    off_block_min: spec.off_block_min,
    stand_id: spec.stand_id,
    displaces: spec.displaces,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Lowest score among feasible plans wins; infeasible plans are never selected (§8). */
export function selectBest(plans: EvaluatedPlan[]): EvaluatedPlan | null {
  const feasible = plans.filter((p) => p.result.feasible && p.result.score !== null);
  if (feasible.length === 0) return null;
  return feasible.reduce((best, p) =>
    (p.result.score as number) < (best.result.score as number) ? p : best,
  );
}

export function planLabel(planId: string): string {
  return planId.replace('plan_', 'Plan ');
}

/* ---- agent findings ---------------------------------------------------- */

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function buildAgentResults(input: DisruptionInput): AgentResponse[] {
  const d = deriveState(input);
  const s = buildScenarioState(input);
  const ready = minutesToHhmm(d.earliest_ready_min);
  const sched = minutesToHhmm(d.scheduled_departure_min);
  const flightId = BASE_SCENARIO.flight.flight_id;

  const flightSeverity: Severity =
    input.late_incoming_minutes >= 40 ? 'high' : input.late_incoming_minutes > 0 ? 'medium' : 'low';

  return [
    {
      agent: 'flight_agent',
      status: 'completed',
      severity: flightSeverity,
      summary:
        input.late_incoming_minutes > TURN_BUFFER_MIN
          ? `Inbound aircraft is ${input.late_incoming_minutes} min late; the published ${sched} departure is no longer achievable.`
          : `Inbound aircraft is ${input.late_incoming_minutes} min late but absorbs into turnaround slack.`,
      findings: [
        `Inbound delay ${input.late_incoming_minutes} min against a ${TURN_BUFFER_MIN} min turnaround buffer`,
        `Earliest airframe availability ${ready}`,
        `Scheduled off-block ${sched}, ${BASE_SCENARIO.flight.origin} to ${BASE_SCENARIO.flight.destination}`,
      ],
      constraints: [
        {
          type: 'aircraft_availability',
          value: sgtMinutesToIso(SCENARIO_DATE, d.earliest_ready_min),
        },
      ],
      recommended_actions: ['Re-time off-block against actual airframe availability'],
    },
    {
      agent: 'weather_agent',
      status: 'completed',
      severity: d.weather_risk === 'high' ? 'high' : d.weather_risk === 'medium' ? 'medium' : 'low',
      summary: d.weather_window
        ? `${titleCase(input.weather_condition)} affecting the field approximately ${minutesToHhmm(
            d.weather_window.start_min,
          )}–${minutesToHhmm(d.weather_window.end_min)}.`
        : 'No significant weather affecting departure operations.',
      findings: [
        `Reported condition ${input.weather_condition} at WSSS`,
        `Visibility ${s.weather.visibility_m} m, wind ${s.weather.wind_speed_kt} kt from ${s.weather.wind_direction_deg}°`,
        d.weather_window
          ? 'Departures inside the cell carry additional taxi and queue delay'
          : 'Departure queue nominal',
      ],
      constraints: d.weather_window
        ? [
            {
              type: 'weather_window',
              value: sgtMinutesToIso(SCENARIO_DATE, d.weather_window.end_min),
            },
          ]
        : [],
      recommended_actions: d.weather_window
        ? ['Prefer an off-block before the cell or after it clears']
        : [],
    },
    {
      agent: 'gate_agent',
      status: 'completed',
      severity: input.gate_conflict ? 'high' : 'low',
      summary: input.gate_conflict
        ? `Stand ${s.gate.current_gate} is claimed by another aircraft at ${minutesToHhmm(
            input.gate_conflict_min,
          )}.`
        : `Stand ${s.gate.current_gate} has no downstream claim in the recovery window.`,
      findings: input.gate_conflict
        ? [
            `${s.gate.current_gate} must be clear by ${minutesToHhmm(input.gate_conflict_min)}`,
            `Stand clearance requires ${STAND_CLEAR_MIN} min after off-block`,
            d.alternative_stands.length
              ? `${d.alternative_stands.join(', ')} available and compatible with the 777-300ER`
              : 'No compatible alternative stand is free in this window',
          ]
        : [`${s.gate.current_gate} available throughout the recovery window`],
      constraints: input.gate_conflict
        ? [
            {
              type: 'gate_clearance',
              value: sgtMinutesToIso(SCENARIO_DATE, input.gate_conflict_min),
            },
          ]
        : [],
      recommended_actions:
        input.gate_conflict && d.alternative_stands.length
          ? [`Consider moving ${flightId} to ${d.alternative_stands[0]}`]
          : [],
    },
    {
      agent: 'ground_agent',
      status: 'completed',
      severity:
        d.baggage_remaining_min > 12 ? 'high' : d.baggage_remaining_min > 6 ? 'medium' : 'low',
      summary: `Turnaround estimated complete at ${minutesToHhmm(
        d.earliest_ready_min + d.baggage_remaining_min,
      )}; hold baggage is the critical path.`,
      findings: [
        `Hold baggage ${input.baggage_percent}% loaded, about ${d.baggage_remaining_min} min remaining`,
        `Refuelling complete, cleaning ${
          s.ground_operations.cleaning_complete ? 'complete' : 'running late'
        }`,
        `Boarding ${s.ground_operations.boarding_percent}%`,
      ],
      constraints: [
        {
          type: 'turnaround_ready',
          value: sgtMinutesToIso(SCENARIO_DATE, d.earliest_ready_min + d.baggage_remaining_min),
        },
      ],
      recommended_actions:
        d.baggage_remaining_min > 6
          ? ['Expedite hold baggage for passengers with tight connections']
          : [],
    },
    {
      agent: 'passenger_agent',
      status: 'completed',
      severity:
        s.passengers.at_risk_connections >= 10
          ? 'high'
          : s.passengers.at_risk_connections >= 4
            ? 'medium'
            : 'low',
      summary: `${s.passengers.at_risk_connections} of ${input.connecting_passengers} connecting passengers are exposed if nothing changes.`,
      findings: [
        `${input.connecting_passengers} connecting passengers of ${s.passengers.total_passengers} on board`,
        'Connection risk begins to climb beyond 10 min of departure delay',
        `Exposure at the do-nothing departure: ${s.passengers.at_risk_connections} passengers`,
      ],
      constraints: [],
      recommended_actions: ['Weight recovery options by connection exposure, not delay alone'],
    },
  ];
}

/* ---- assembled §10 response -------------------------------------------- */

function buildReasoning(
  chosen: EvaluatedPlan,
  plans: EvaluatedPlan[],
  input: DisruptionInput,
): string {
  const others = plans.filter((p) => p.plan.plan_id !== chosen.plan.plan_id);
  const parts: string[] = [];

  parts.push(
    chosen.stand_id === BASE_SCENARIO.flight.current_gate
      ? `Holding ${chosen.stand_id} and departing at ${minutesToHhmm(
          chosen.off_block_min,
        )} carries ${chosen.result.metrics.departure_delay_minutes} min of delay`
      : `Moving to ${chosen.stand_id} clears ${
          BASE_SCENARIO.flight.current_gate
        } before its next occupant and allows an off-block at ${minutesToHhmm(
          chosen.off_block_min,
        )}, ${chosen.result.metrics.departure_delay_minutes} min behind schedule`,
  );

  const infeasible = others.filter((p) => !p.result.feasible);
  if (infeasible.length) {
    parts.push(
      `${infeasible.map((p) => planLabel(p.plan.plan_id)).join(' and ')} ${
        infeasible.length > 1 ? 'were' : 'was'
      } ruled out on hard constraints`,
    );
  }

  const worse = others.filter((p) => p.result.feasible);
  if (worse.length) {
    parts.push(
      `${worse.map((p) => planLabel(p.plan.plan_id)).join(' and ')} scored higher, mainly on ${
        input.connecting_passengers > 20 ? 'connection exposure' : 'downstream delay'
      }`,
    );
  }

  return `${parts.join('; ')}.`;
}

export function runRecovery(input: DisruptionInput): RecoveryResponse {
  const scenario = buildScenarioState(input);
  const plans = generatePlans(input);
  const best = selectBest(plans);
  const agents = buildAgentResults(input);
  const feasibleCount = plans.filter((p) => p.result.feasible).length;

  const recoveryAgent: AgentResponse = {
    agent: 'recovery_agent',
    status: best ? 'completed' : 'failed',
    severity: best ? 'medium' : 'critical',
    summary: best
      ? `${plans.length} candidate plans generated, ${feasibleCount} feasible. ${planLabel(
          best.plan.plan_id,
        )} scores lowest at ${best.result.score}.`
      : 'No candidate plan satisfies the hard operational constraints.',
    findings: plans.map((p) =>
      p.result.feasible
        ? `${planLabel(p.plan.plan_id)} — ${p.strategy}, off-block ${minutesToHhmm(
            p.off_block_min,
          )}, score ${p.result.score}`
        : `${planLabel(p.plan.plan_id)} — ${p.strategy}, infeasible: ${
            p.result.constraint_violations[0]
          }`,
    ),
    constraints: [],
    recommended_actions: best ? best.plan.actions : ['Escalate to the duty manager'],
  };

  const chosen = best ?? plans[0];

  return {
    scenario_id: scenario.scenario_id,
    status: best ? 'recommendation_ready' : 'no_feasible_plan',
    recommended_plan: {
      plan_id: chosen.plan.plan_id,
      flight_id: chosen.plan.flight_id,
      original_gate: BASE_SCENARIO.flight.current_gate,
      recommended_gate: chosen.plan.recommended_gate,
      original_departure: BASE_SCENARIO.flight.scheduled_departure,
      recommended_departure: chosen.plan.recommended_departure,
      expected_delay_minutes: chosen.result.metrics.departure_delay_minutes,
      score: chosen.result.score ?? 0,
    },
    impact: {
      gate_conflict_avoided: input.gate_conflict && chosen.result.metrics.gate_conflicts === 0,
      passengers_at_risk: chosen.result.metrics.passengers_at_risk,
      downstream_delay_minutes: chosen.result.metrics.downstream_delay_minutes,
    },
    reasoning_summary: buildReasoning(chosen, plans, input),
    agent_results: [...agents, recoveryAgent],
    scenario_state: scenario,
    candidate_plans: plans.map((p) => p.plan),
    optimiser_results: plans.map((p) => p.result),
  };
}
