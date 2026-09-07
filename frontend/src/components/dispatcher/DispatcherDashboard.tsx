import { useState } from 'react';

import {
  useDispatcher,
} from '../../state/dispatcherStore';

import { hhmm, minutesToHhmm } from '../../lib/time';
import { useScenarioClock } from '../../lib/scenarioClock';


export function DispatcherDashboard() {
  const {
    flights,
    selectFlight,
  } = useDispatcher();

  const [search, setSearch] =
    useState('');
  const { minutes, seconds } = useScenarioClock();

  const query =
    search.trim().toUpperCase();

  const filtered = flights.filter(
    (flight) =>
      flight.flight_id.includes(query) ||
      flight.destination.includes(query) ||
      flight.origin.includes(query)
  );

  return (
    <main className="min-h-dvh bg-field text-ink">
      <header className="border-b border-rule bg-panel px-6 py-5">
        <div className="flex items-baseline gap-4">
          <h1 className="font-narrow text-xl font-bold uppercase tracking-[0.18em]">
            IRIS
          </h1>

          <span className="label">
            WSSS · Changi
          </span>
        </div>

        <p className="mt-2 text-sm text-ink-dim">
          Intelligent Recovery & Irregular Operations System
        </p>
      </header>

      <section className="mx-auto max-w-6xl p-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border border-rule bg-panel px-5 py-4">
          <div>
            <p className="label text-subject">DEMO REPLAY · SYNTHETIC SCHEDULE</p>
            <p className="mt-1 tnum font-data text-2xl font-semibold text-ink">
              {minutesToHhmm(minutes)}:{String(seconds).padStart(2, '0')}
            </p>
            <p className="label mt-1">SGT · DEMO REPLAY</p>
          </div>
          <p className="max-w-sm text-right text-xs text-ink-faint">
            Replay clock runs at 1×. Arrival rows enter the dispatcher view five minutes before ETA.
          </p>
        </div>

        <div className="mb-6">
          <h2 className="font-narrow text-xl font-semibold">
            Active flights
          </h2>

          <p className="mt-1 text-sm text-ink-dim">
            Select an aircraft to open its
            recovery workspace.
          </p>
        </div>

        <input
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Search flight or destination..."
          className="mb-5 w-full border border-rule bg-panel px-4 py-3 font-data text-sm outline-none"
        />

        <div className="overflow-hidden border border-rule">
          {filtered.map((flight) => (
            <button
              key={flight.flight_id}
              disabled={flight.selectable === false}
              onClick={() =>
                selectFlight(flight)
              }
              className="grid w-full grid-cols-[1fr_1fr_1fr_1fr_auto] items-center gap-4 border-b border-rule bg-panel px-5 py-4 text-left last:border-b-0 enabled:hover:bg-field disabled:cursor-not-allowed disabled:opacity-55"
            >
              <div>
                <p className="font-data font-semibold text-subject">
                  ARR {flight.flight_id}
                </p>

                <p className="text-xs text-ink-dim">
                  {flight.aircraft_type.replace(/^B(?=777|787)/, '')}
                </p>
              </div>

              <div className="font-data text-sm">
                {flight.origin}
                {' → '}
                {flight.destination}
                <p className="mt-1 text-xs text-ink-dim">
                  ETA {hhmm(flight.scheduled_arrival)}
                </p>
              </div>

              <div>
                <p className="label">
                  {flight.terminal}
                </p>

                <p className="font-data text-sm">
                  Gate {flight.gate}
                </p>
              </div>

              <div>
                <p className="font-data text-sm">
                  TURNAROUND · OUT {flight.outbound_flight_id ?? 'TBD'} → {flight.outbound_destination ?? 'TBD'}
                </p>

                <p className="mt-1 font-data text-xs text-ink-dim">
                  STD{' '}
                  {hhmm(
                    flight.outbound_departure ?? flight.scheduled_departure
                  )}
                </p>

                <p className={flight.inbound_delay_minutes > 0 ? 'text-xs text-conflict' : 'text-xs text-ink-faint'}>
                  {flight.inbound_delay_minutes > 0
                    ? `+${flight.inbound_delay_minutes} MIN LATE`
                    : 'ON TIME'}
                </p>
              </div>

              <span className="label border border-rule-strong px-3 py-2">
                OPEN RECOVERY
              </span>
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs text-ink-faint">
          Terminal, gate and stand allocation
          values are synthetic demonstration data.
          Flight tracking and weather services may
          use live external data.
        </p>
      </section>
    </main>
  );
}
