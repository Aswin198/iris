/**
 * The console's entire backend surface: POST /api/recovery (API_CONTRACT.md §11).
 *
 * It knows nothing about OpenSky, weather APIs, LLM prompting, agent internals,
 * the optimiser's maths or how the simulator produces its data. When the backend
 * is unreachable — or VITE_USE_MOCK is set — it falls through to the local
 * scenario engine and reports MOCK so the operator is never misled about which
 * source they are looking at.
 */

import type { RecoveryRequest, RecoveryResponse } from '../types/contract';
import { type DisruptionInput, runRecovery } from '../mock/engine';
import type {
  DispatcherFlight,
} from '../state/dispatcherStore';

export type Source = 'live' | 'mock';

export interface RecoveryOutcome {
  response: RecoveryResponse;
  source: Source;
  /** why we fell back, when we did */
  fallback_reason?: string;
}

const API_BASE = import.meta.env.VITE_API_BASE ?? '';
const FORCE_MOCK = import.meta.env.VITE_USE_MOCK === '1';
const REQUEST_TIMEOUT_MS = 60000;

/** Translate the operator's console settings into a contract §2 request. */
export function buildRequest(
  input: DisruptionInput,
  flight: DispatcherFlight,
): RecoveryRequest {
  const disruptions: RecoveryRequest['disruptions'] = [];

  if (input.late_incoming_minutes > 0) {
    disruptions.push({
      type: 'late_incoming_aircraft',
      delay_minutes: input.late_incoming_minutes,
    });
  }
  if (input.ground_handling_delay_minutes > 0) {
    disruptions.push({
      type: 'ground_handling_delay',
      delay_minutes: input.ground_handling_delay_minutes,
    });
  }
  if (input.weather_condition !== 'clear') {
    disruptions.push({ type: 'weather', condition: input.weather_condition });
  }
  if (input.gate_conflict) {
    disruptions.push({ type: 'gate_conflict', gate: flight.gate});
  }
  if (input.baggage_percent < 100) {
    disruptions.push({ type: 'baggage_delay', baggage_percent: input.baggage_percent });
  }
  disruptions.push({
    type: 'passenger_connection_risk',
    connecting_passengers: input.connecting_passengers,
  });

  return {
    scenario_id:
      `scenario_${flight.flight_id.toLowerCase()}`,

    flight: {
      flight_id:
        flight.flight_id,

      origin:
        flight.origin,

      destination:
        flight.destination,

      scheduled_departure:
        flight.scheduled_departure,

      scheduled_arrival:
        flight.scheduled_arrival,

      gate:
        flight.gate,
    },

    disruptions,
  };
}

export async function postRecovery(
  input: DisruptionInput,
  flight: DispatcherFlight,
): Promise<RecoveryOutcome> {
  if (FORCE_MOCK) {
    return { response: runRecovery(input), source: 'mock' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}/api/recovery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
  buildRequest(input, flight)
),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`recovery endpoint returned ${res.status}`);
    }

    const response = (await res.json()) as RecoveryResponse;
    if (!response?.recommended_plan?.plan_id) {
      throw new Error('recovery response is missing recommended_plan');
    }
    return { response, source: 'live' };
  } catch (err) {
    return {
      response: runRecovery(input),
      source: 'mock',
      fallback_reason:
        err instanceof Error && err.name === 'AbortError'
          ? 'Recovery service did not respond within 8s'
          : err instanceof Error
            ? err.message
            : 'Recovery service unreachable',
    };
  } finally {
    clearTimeout(timer);
  }
}
