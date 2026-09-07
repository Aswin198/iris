/**
 * SYNTHETIC DATA — NOT REAL CHANGI AIRPORT INFORMATION.
 *
 * Exact stand allocations, turnaround progress and passenger connection figures
 * are not public. This board is a realistic invention for demonstration only and
 * is labelled as such in the interface. It is never presented as operational
 * Changi data. Real flight and weather data arrive through the backend agents.
 */

import type { ScenarioState } from '../types/contract';

export const SCENARIO_DATE = '2026-09-08';

export interface StandBlock {
  block_id: string;
  flight_id: string;
  origin: string;
  destination: string;
  aircraft_type: string;
  /** minutes since midnight SGT */
  start_min: number;
  end_min: number;
  /** the flight this console is recovering */
  subject?: boolean;
  /** the aircraft that creates the B8 conflict */
  claimant?: boolean;
}

export interface Stand {
  stand_id: string;
  /** widebody-capable stands can take the 777 */
  category: 'code_e' | 'code_c';
  blocks: StandBlock[];
}

/** Board window shown on the planner, minutes since midnight SGT. */
export const BOARD_START_MIN = 13 * 60 + 20; // 13:20
export const BOARD_END_MIN = 15 * 60 + 20; // 15:20

export const SUBJECT_FLIGHT_ID = 'SQ318';
export const SUBJECT_BLOCK_ID = 'blk_sq318';

export const STAND_BOARD: Stand[] = [
  {
    stand_id: 'B6',
    category: 'code_e',
    blocks: [
      {
        block_id: 'blk_sq026',
        flight_id: 'SQ026',
        origin: 'FRA',
        destination: 'SIN',
        aircraft_type: 'A350-900',
        start_min: 13 * 60 + 5,
        end_min: 14 * 60 + 35,
      },
    ],
  },
  {
    stand_id: 'B8',
    category: 'code_e',
    blocks: [
      {
        block_id: SUBJECT_BLOCK_ID,
        flight_id: SUBJECT_FLIGHT_ID,
        origin: 'SIN',
        destination: 'LHR',
        aircraft_type: '777-300ER',
        start_min: 14 * 60,
        end_min: 14 * 60 + 20,
        subject: true,
      },
      {
        block_id: 'blk_sq871',
        flight_id: 'SQ871',
        origin: 'HKG',
        destination: 'SIN',
        aircraft_type: '787-10',
        start_min: 14 * 60 + 25,
        end_min: 15 * 60 + 15,
        claimant: true,
      },
    ],
  },
  {
    stand_id: 'B10',
    category: 'code_e',
    blocks: [
      {
        block_id: 'blk_sq638',
        flight_id: 'SQ638',
        origin: 'SIN',
        destination: 'NRT',
        aircraft_type: '787-10',
        start_min: 12 * 60 + 30,
        end_min: 13 * 60 + 45,
      },
    ],
  },
  {
    stand_id: 'B12',
    category: 'code_e',
    blocks: [
      {
        block_id: 'blk_sq827',
        flight_id: 'SQ827',
        origin: 'HKG',
        destination: 'SIN',
        aircraft_type: 'A350-900',
        start_min: 14 * 60 + 50,
        end_min: 15 * 60 + 40,
      },
    ],
  },
  {
    stand_id: 'B14',
    category: 'code_e',
    blocks: [],
  },
];

/** Stands the 777-300ER could actually be moved to, in board order. */
export const WIDEBODY_STANDS = STAND_BOARD.filter((s) => s.category === 'code_e').map(
  (s) => s.stand_id,
);

export const BASE_SCENARIO: ScenarioState = {
  scenario_id: 'scenario_001',
  flight: {
    flight_id: SUBJECT_FLIGHT_ID,
    origin: 'SIN',
    destination: 'LHR',
    scheduled_departure: `${SCENARIO_DATE}T14:20:00+08:00`,
    scheduled_arrival: `${SCENARIO_DATE}T14:00:00+08:00`,
    current_gate: 'B8',
    aircraft_ready_time: `${SCENARIO_DATE}T14:40:00+08:00`,
  },
  weather: {
    condition: 'thunderstorm',
    risk_level: 'high',
    visibility_m: 5000,
    wind_speed_kt: 16,
    wind_direction_deg: 220,
  },
  gate: {
    current_gate: 'B8',
    conflict: true,
    conflict_time: `${SCENARIO_DATE}T14:25:00+08:00`,
    alternative_gates: ['B10', 'B12'],
  },
  ground_operations: {
    baggage_percent: 75,
    refuelling_complete: true,
    cleaning_complete: true,
    boarding_percent: 60,
    estimated_ready_time: `${SCENARIO_DATE}T14:12:00+08:00`,
  },
  passengers: {
    total_passengers: 280,
    connecting_passengers: 42,
    at_risk_connections: 11,
  },
};
