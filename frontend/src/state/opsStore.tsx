/**
 * Single source of truth for the console. One reducer, one context.
 *
 * The store never talks to the engine directly — it consumes whatever
 * postRecovery returns, so live and mock responses drive identical UI.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type {
  AgentName,
  AgentResponse,
  AgentStatus,
  CandidatePlan,
  OptimiserResult,
  RecoveryResponse,
} from '../types/contract';
import { AGENT_NAMES } from '../types/contract';
import { postRecovery, type Source } from '../api/client';
import { DEFAULT_DISRUPTION, type DisruptionInput } from '../mock/engine';
import { BASE_SCENARIO } from '../mock/airport_state';
import { isoToSgtMinutes, minutesToHhmm } from '../lib/time';
import { scenarioNowMinutes } from '../lib/scenarioClock';

/* ---- view models ------------------------------------------------------- */

/** A ledger row: candidate plan joined to its optimiser verdict. */
export interface PlanRow {
  plan_id: string;
  label: string;
  strategy: string;
  stand_id: string;
  off_block_min: number;
  departure_iso: string;
  actions: string[];
  metrics: OptimiserResult['metrics'];
  feasible: boolean;
  score: number | null;
  constraint_violations: string[];
  recommended: boolean;
}

export type Phase = 'idle' | 'running' | 'ready' | 'no_plan';

export interface DecisionEntry {
  id: number;
  plan_id: string;
  action: 'approved' | 'rejected';
  /** scenario time, HH:MM SGT — the same clock the board and plans run on */
  at: string;
  reason?: string;
  detail: string;
}

export interface AgentLane extends Partial<AgentResponse> {
  agent: AgentName;
  status: AgentStatus;
}

interface State {
  disruption: DisruptionInput;
  phase: Phase;
  source: Source;
  fallbackReason?: string;
  agents: AgentLane[];
  response: RecoveryResponse | null;
  plans: PlanRow[];
  /** row the operator has locked; this is what the decision bar acts on */
  selectedPlanId: string | null;
  /** row being previewed under the pointer or arrow keys; never decides anything */
  previewPlanId: string | null;
  /** row the operator has authorised */
  committedPlanId: string | null;
  /** the disruption inputs changed after this run, so the plans no longer describe them */
  stale: boolean;
  decisions: DecisionEntry[];
  nextDecisionId: number;
  /** set while a run is in flight so the console can show progress honestly */
  runToken: number;
}

type Action =
  | { type: 'set_disruption'; patch: Partial<DisruptionInput> }
  | { type: 'reset_disruption' }
  | { type: 'run_started'; token: number }
  | { type: 'agent_update'; token: number; lane: AgentLane }
  | {
      type: 'run_finished';
      token: number;
      response: RecoveryResponse;
      source: Source;
      fallbackReason?: string;
      plans: PlanRow[];
    }
  | { type: 'preview'; plan_id: string | null }
  | { type: 'select'; plan_id: string }
  | { type: 'decide'; action: 'approved' | 'rejected'; plan_id: string; reason?: string };

const emptyLanes = (): AgentLane[] =>
  AGENT_NAMES.map((agent) => ({ agent, status: 'pending' as AgentStatus }));

const initialState: State = {
  disruption: DEFAULT_DISRUPTION,
  phase: 'idle',
  source: 'mock',
  agents: emptyLanes(),
  response: null,
  plans: [],
  selectedPlanId: null,
  previewPlanId: null,
  committedPlanId: null,
  stale: false,
  decisions: [],
  nextDecisionId: 1,
  runToken: 0,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'set_disruption':
      return {
        ...state,
        disruption: { ...state.disruption, ...action.patch },
        // Plans already on screen were scored against the old inputs. Say so
        // rather than letting them sit there looking current.
        stale: state.phase === 'ready' || state.phase === 'no_plan',
      };

    case 'reset_disruption':
      return {
        ...state,
        disruption: DEFAULT_DISRUPTION,
        stale: state.phase === 'ready' || state.phase === 'no_plan',
      };

    case 'run_started':
      return {
        ...state,
        phase: 'running',
        runToken: action.token,
        agents: emptyLanes(),
        response: null,
        plans: [],
        selectedPlanId: null,
        previewPlanId: null,
        committedPlanId: null,
        stale: false,
        fallbackReason: undefined,
      };

    case 'agent_update': {
      if (action.token !== state.runToken) return state;
      return {
        ...state,
        agents: state.agents.map((l) => (l.agent === action.lane.agent ? action.lane : l)),
      };
    }

    case 'run_finished': {
      if (action.token !== state.runToken) return state;
      const recommended = action.plans.find((p) => p.recommended) ?? null;
      return {
        ...state,
        phase: action.response.status === 'recommendation_ready' ? 'ready' : 'no_plan',
        response: action.response,
        source: action.source,
        fallbackReason: action.fallbackReason,
        plans: action.plans,
        selectedPlanId: recommended?.plan_id ?? action.plans[0]?.plan_id ?? null,
        previewPlanId: null,
        stale: false,
        agents: state.agents.map((lane) => {
          const found = action.response.agent_results.find((r) => r.agent === lane.agent);
          return found ? { ...found } : lane;
        }),
      };
    }

    case 'preview':
      // Previewing never changes what Approve would authorise, and a committed
      // plan is not repainted by a passing pointer.
      if (state.committedPlanId) return state;
      return { ...state, previewPlanId: action.plan_id };

    case 'select':
      return { ...state, selectedPlanId: action.plan_id, previewPlanId: null };

    case 'decide': {
      const plan = state.plans.find((p) => p.plan_id === action.plan_id);
      if (!plan) return state;
      const entry: DecisionEntry = {
        id: state.nextDecisionId,
        plan_id: action.plan_id,
        action: action.action,
        at: minutesToHhmm(scenarioNowMinutes()),
        reason: action.reason,
        detail:
          action.action === 'approved'
            ? `${plan.label} authorised — ${BASE_SCENARIO.flight.flight_id} to stand ${plan.stand_id}, off-block re-timed`
            : `${plan.label} rejected${action.reason ? ` — ${action.reason}` : ''}`,
      };
      return {
        ...state,
        decisions: [entry, ...state.decisions],
        nextDecisionId: state.nextDecisionId + 1,
        committedPlanId: action.action === 'approved' ? action.plan_id : state.committedPlanId,
        previewPlanId: null,
        selectedPlanId:
          action.action === 'rejected'
            ? (state.plans.find((p) => p.feasible && p.plan_id !== action.plan_id)?.plan_id ??
              state.selectedPlanId)
            : action.plan_id,
      };
    }

    default:
      return state;
  }
}

/* ---- response → ledger rows -------------------------------------------- */

const STRATEGY_FALLBACK = (standId: string, currentGate: string) =>
  standId === currentGate ? `Hold ${currentGate}` : `${currentGate} → ${standId}`;

export function toPlanRows(response: RecoveryResponse): PlanRow[] {
  const currentGate = response.recommended_plan.original_gate;
  const candidates: CandidatePlan[] = response.candidate_plans?.length
    ? response.candidate_plans
    : [
        {
          plan_id: response.recommended_plan.plan_id,
          flight_id: response.recommended_plan.flight_id,
          recommended_gate: response.recommended_plan.recommended_gate,
          recommended_departure: response.recommended_plan.recommended_departure,
          actions: [],
        },
      ];

  const rows = candidates.map((c) => {
    const opt = response.optimiser_results?.find((o) => o.plan_id === c.plan_id);
    const isRecommended = c.plan_id === response.recommended_plan.plan_id;

    const metrics: OptimiserResult['metrics'] = opt?.metrics ?? {
      departure_delay_minutes: response.recommended_plan.expected_delay_minutes,
      gate_conflicts: response.impact.gate_conflict_avoided ? 0 : 1,
      passengers_at_risk: response.impact.passengers_at_risk,
      downstream_delay_minutes: response.impact.downstream_delay_minutes,
    };

    return {
      plan_id: c.plan_id,
      label: c.plan_id.replace('plan_', 'Plan '),
      strategy: STRATEGY_FALLBACK(c.recommended_gate, currentGate),
      stand_id: c.recommended_gate,
      off_block_min: isoToSgtMinutes(c.recommended_departure),
      departure_iso: c.recommended_departure,
      actions: c.actions ?? [],
      metrics,
      feasible: opt ? opt.feasible : true,
      score: opt ? opt.score : response.recommended_plan.score,
      constraint_violations: opt?.constraint_violations ?? [],
      recommended: isRecommended,
    } satisfies PlanRow;
  });

  // Feasible first, then by score; infeasible sink to the bottom of the ledger.
  return rows.sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    if (a.score === null || b.score === null) return 0;
    return a.score - b.score;
  });
}

/* ---- agent reveal ------------------------------------------------------ */

/** Stagger the agent lanes so the operator can read the reasoning arrive. */
const REVEAL_STEP_MS = 340;
const REVEAL_RUNNING_MS = 180;

/* ---- context ----------------------------------------------------------- */

interface Store {
  state: State;
  setDisruption: (patch: Partial<DisruptionInput>) => void;
  resetDisruption: () => void;
  run: () => void;
  preview: (plan_id: string | null) => void;
  select: (plan_id: string) => void;
  decide: (action: 'approved' | 'rejected', plan_id: string, reason?: string) => void;
  recommended: PlanRow | null;
  /** what the decision bar acts on */
  selected: PlanRow | null;
  /** what the chart draws: the authorised plan, else the previewed one, else the selection */
  projected: PlanRow | null;
  committed: PlanRow | null;
}

const OpsContext = createContext<Store | null>(null);

export function OpsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const tokenRef = useRef(0);
  const timers = useRef<number[]>([]);

  // Keep a ref so `run` can read the latest inputs without re-binding.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const run = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];

    const token = tokenRef.current + 1;
    tokenRef.current = token;
    dispatch({ type: 'run_started', token });

    const input = stateRef.current.disruption;
    const request = postRecovery(input);

    // Reveal the lanes on a fixed cadence while the request is in flight.
    AGENT_NAMES.forEach((agent, i) => {
      timers.current.push(
        window.setTimeout(
          () => dispatch({ type: 'agent_update', token, lane: { agent, status: 'running' } }),
          i * REVEAL_STEP_MS,
        ),
      );
    });

    const settleAt = AGENT_NAMES.length * REVEAL_STEP_MS + REVEAL_RUNNING_MS;

    void Promise.all([request, wait(settleAt)]).then(([outcome]) => {
      dispatch({
        type: 'run_finished',
        token,
        response: outcome.response,
        source: outcome.source,
        fallbackReason: outcome.fallback_reason,
        plans: toPlanRows(outcome.response),
      });
    });
  }, []);

  const setDisruption = useCallback(
    (patch: Partial<DisruptionInput>) => dispatch({ type: 'set_disruption', patch }),
    [],
  );
  const resetDisruption = useCallback(() => dispatch({ type: 'reset_disruption' }), []);
  const preview = useCallback(
    (plan_id: string | null) => dispatch({ type: 'preview', plan_id }),
    [],
  );
  const select = useCallback((plan_id: string) => dispatch({ type: 'select', plan_id }), []);
  const decide = useCallback(
    (action: 'approved' | 'rejected', plan_id: string, reason?: string) =>
      dispatch({ type: 'decide', action, plan_id, reason }),
    [],
  );

  const value = useMemo<Store>(() => {
    const byId = (id: string | null) => state.plans.find((p) => p.plan_id === id) ?? null;
    const recommended = state.plans.find((p) => p.recommended) ?? null;
    const selected = byId(state.selectedPlanId);
    const committed = byId(state.committedPlanId);
    const projected = committed ?? byId(state.previewPlanId) ?? selected;
    return {
      state,
      setDisruption,
      resetDisruption,
      run,
      preview,
      select,
      decide,
      recommended,
      selected,
      projected,
      committed,
    };
  }, [state, setDisruption, resetDisruption, run, preview, select, decide]);

  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function useOps(): Store {
  const ctx = useContext(OpsContext);
  if (!ctx) throw new Error('useOps must be used inside OpsProvider');
  return ctx;
}
