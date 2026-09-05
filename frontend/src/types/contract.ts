/**
 * Mirrors docs/API_CONTRACT.md exactly.
 *
 * These field names are shared across five developers. Do not rename anything
 * here without telling the team — see contract §16 and §20. All timestamps are
 * ISO 8601 with timezone offset (§15); human formatting happens in the UI layer.
 */

/* ---- §4 enums --------------------------------------------------------- */

export const AGENT_NAMES = [
  'flight_agent',
  'weather_agent',
  'gate_agent',
  'ground_agent',
  'passenger_agent',
  'recovery_agent',
] as const;
export type AgentName = (typeof AGENT_NAMES)[number];

export const AGENT_STATUSES = ['pending', 'running', 'completed', 'failed'] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

/* ---- §2 recovery request ---------------------------------------------- */

export interface RequestFlight {
  flight_id: string;
  origin: string;
  destination: string;
  scheduled_departure: string;
  scheduled_arrival: string;
  gate: string;
}

export interface Disruption {
  type: string;
  delay_minutes?: number;
  [key: string]: unknown;
}

export interface RecoveryRequest {
  scenario_id: string;
  flight: RequestFlight;
  disruptions: Disruption[];
}

/* ---- §3 shared scenario state ----------------------------------------- */

export interface ScenarioFlight {
  flight_id: string;
  origin: string;
  destination: string;
  scheduled_departure: string;
  scheduled_arrival: string;
  current_gate: string;
  aircraft_ready_time: string;
}

export interface ScenarioWeather {
  condition: string;
  risk_level: string;
  visibility_m: number;
  wind_speed_kt: number;
  wind_direction_deg?: number;
}

export interface ScenarioGate {
  current_gate: string;
  conflict: boolean;
  conflict_time: string | null;
  alternative_gates: string[];
}

export interface ScenarioGroundOperations {
  baggage_percent: number;
  refuelling_complete: boolean;
  cleaning_complete: boolean;
  boarding_percent: number;
  estimated_ready_time: string;
}

export interface ScenarioPassengers {
  total_passengers: number;
  connecting_passengers: number;
  at_risk_connections: number;
}

export interface ScenarioState {
  scenario_id: string;
  flight: ScenarioFlight;
  weather: ScenarioWeather;
  gate: ScenarioGate;
  ground_operations: ScenarioGroundOperations;
  passengers: ScenarioPassengers;
}

/* ---- §4 standard agent response --------------------------------------- */

export interface AgentConstraint {
  type: string;
  value: string;
}

export interface AgentResponse {
  agent: AgentName;
  status: AgentStatus;
  severity: Severity;
  summary: string;
  findings?: string[];
  constraints?: AgentConstraint[];
  recommended_actions?: string[];
}

/* ---- §5 candidate recovery plan --------------------------------------- */

export interface CandidatePlan {
  plan_id: string;
  flight_id: string;
  recommended_gate: string;
  recommended_departure: string;
  actions: string[];
}

/* ---- §7 / §8 optimiser response --------------------------------------- */

export interface OptimiserMetrics {
  departure_delay_minutes: number;
  gate_conflicts: number;
  passengers_at_risk: number;
  downstream_delay_minutes: number;
}

export interface OptimiserResult {
  plan_id: string;
  feasible: boolean;
  /** null when the plan is infeasible (§8). Lower is better (§9). */
  score: number | null;
  metrics: OptimiserMetrics;
  constraint_violations: string[];
}

/* ---- §10 final recovery response -------------------------------------- */

export interface RecommendedPlan {
  plan_id: string;
  flight_id: string;
  original_gate: string;
  recommended_gate: string;
  original_departure: string;
  recommended_departure: string;
  expected_delay_minutes: number;
  score: number;
}

export interface RecoveryImpact {
  gate_conflict_avoided: boolean;
  passengers_at_risk: number;
  downstream_delay_minutes: number;
}

export interface RecoveryResponse {
  scenario_id: string;
  status: string;
  recommended_plan: RecommendedPlan;
  impact: RecoveryImpact;
  reasoning_summary: string;
  agent_results: AgentResponse[];

  /**
   * Optional extensions. The contract permits adding optional fields (§20);
   * the console renders richer comparison when the backend supplies them and
   * degrades to the recommendation alone when it does not.
   */
  scenario_state?: ScenarioState;
  candidate_plans?: CandidatePlan[];
  optimiser_results?: OptimiserResult[];
}
