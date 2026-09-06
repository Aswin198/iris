import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { shiftIso } from '../lib/time';
import { replayNowMinutes } from '../lib/scenarioClock';


export type TerminalId =
  | 'T1'
  | 'T2'
  | 'T3'
  | 'T4';


export interface DispatcherFlight {
  flight_id: string;
  origin: string;
  destination: string;
  scheduled_departure: string;
  scheduled_arrival: string;
  terminal: TerminalId;
  gate: string;
  aircraft_type: string;
  inbound_delay_minutes: number;
  data_source?: string;
  minutes_until_arrival?: number;
  selectable?: boolean;
  outbound_flight_id?: string;
  outbound_destination?: string;
  outbound_departure?: string;
}


interface DispatcherContextValue {
  flights: DispatcherFlight[];
  selectedFlight: DispatcherFlight | null;
  selectFlight: (flight: DispatcherFlight) => void;
  clearFlight: () => void;
}


const DispatcherContext =
  createContext<DispatcherContextValue | null>(
    null
  );


function buildDemoFlights(): DispatcherFlight[] {
  const now = new Date().toISOString();

  return [
    {
      flight_id: 'SQ318',
      origin: 'SIN',
      destination: 'LHR',
      scheduled_departure: shiftIso(now, 35),
      scheduled_arrival: shiftIso(now, 13 * 60),
      terminal: 'T3',
      gate: 'B8',
      aircraft_type: '777-300ER',
      inbound_delay_minutes: 20,
    },
    {
      flight_id: 'SQ638',
      origin: 'SIN',
      destination: 'NRT',
      scheduled_departure: shiftIso(now, 50),
      scheduled_arrival: shiftIso(now, 7 * 60),
      terminal: 'T3',
      gate: 'B10',
      aircraft_type: '787-10',
      inbound_delay_minutes: 8,
    },
    {
      flight_id: 'SQ212',
      origin: 'SIN',
      destination: 'SYD',
      scheduled_departure: shiftIso(now, 70),
      scheduled_arrival: shiftIso(now, 8 * 60),
      terminal: 'T2',
      gate: 'F40',
      aircraft_type: 'A350-900',
      inbound_delay_minutes: 15,
    },
    {
      flight_id: 'TR456',
      origin: 'SIN',
      destination: 'BKK',
      scheduled_departure: shiftIso(now, 90),
      scheduled_arrival: shiftIso(now, 3 * 60),
      terminal: 'T1',
      gate: 'D40',
      aircraft_type: 'A320neo',
      inbound_delay_minutes: 5,
    },
  ];
}

async function loadFlights(): Promise<DispatcherFlight[]> {
  const response = await fetch(`/api/flights?at=${replayNowMinutes()}`);
  if (!response.ok) throw new Error(`flight catalog returned ${response.status}`);
  const body = (await response.json()) as { flights?: DispatcherFlight[] };
  if (!Array.isArray(body.flights)) {
    throw new Error('flight catalog returned no flights');
  }
  return body.flights;
}


export function DispatcherProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [flights, setFlights] = useState<DispatcherFlight[]>([]);

  const [
    selectedFlight,
    setSelectedFlight,
  ] = useState<DispatcherFlight | null>(
    null
  );

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void loadFlights()
        .then((loaded) => {
          if (active) setFlights(loaded);
        })
        .catch(() => {
          if (active) setFlights(buildDemoFlights());
        });
    };
    refresh();
    const id = window.setInterval(refresh, 1000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  const value = useMemo(
    () => ({
      flights,
      selectedFlight,

      selectFlight:
        (flight: DispatcherFlight) =>
          setSelectedFlight(flight),

      clearFlight:
        () => setSelectedFlight(null),
    }),
    [flights, selectedFlight]
  );

  return (
    <DispatcherContext.Provider
      value={value}
    >
      {children}
    </DispatcherContext.Provider>
  );
}


export function useDispatcher() {
  const context =
    useContext(DispatcherContext);

  if (!context) {
    throw new Error(
      'useDispatcher must be used inside DispatcherProvider'
    );
  }

  return context;
}
