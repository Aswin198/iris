import { useOps } from '../../state/opsStore';
import { hhmm, minutesToHhmm } from '../../lib/time';
import { useScenarioClock } from '../../lib/scenarioClock';
import { useDispatcher } from '../../state/dispatcherStore';

export function TopBar() {
  const { state } = useOps();
  const { selectedFlight } = useDispatcher();
  const { minutes, seconds } = useScenarioClock();
  const live = state.source === 'live';
  const flight = selectedFlight!;

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-rule bg-panel px-4 py-2.5">
      <h1 className="flex items-baseline gap-2.5">
        <span className="font-narrow text-md font-bold uppercase tracking-[0.18em] text-ink">
          IRIS
        </span>
        <span className="label">WSSS · Changi</span>
      </h1>

      <p className="flex items-baseline gap-2">
        <span className="label">flight</span>
        <span className="tnum font-data text-sm font-semibold text-subject">
          {flight.flight_id}
        </span>
        <span className="tnum font-data text-tiny text-ink-dim">
          {flight.origin}–{flight.destination}
        </span>
        <span className="tnum font-data text-tiny text-ink-faint">
          std {hhmm(flight.scheduled_departure)}
        </span>
      </p>

      <div className="ml-auto flex items-center gap-4">
        <p className="flex items-baseline gap-2">
          <span className="label">scenario</span>
          <span className="tnum font-data text-tiny text-ink-dim">{state.response?.scenario_id ?? `scenario_${flight.flight_id.toLowerCase()}`}</span>
        </p>

        <p
          className="flex items-center gap-2 border px-2 py-1"
          style={{
            borderColor: live ? 'var(--committed)' : 'var(--rule-strong)',
            color: live ? 'var(--committed)' : 'var(--ink-dim)',
          }}
          title={
            live
              ? 'Connected to the recovery service'
              : (state.fallbackReason ??
                'Recovery service not connected — showing the local scenario engine')
          }
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: live ? 'var(--committed)' : 'var(--ink-faint)' }}
            aria-hidden
          />
          <span className="label" style={{ color: 'inherit' }}>
            {live ? 'live' : 'mock'}
          </span>
        </p>

        <p
          className="tnum font-data text-md font-semibold tracking-tight text-ink"
          title="Scenario time — the board, plans and log all run on this clock"
        >
          {minutesToHhmm(minutes)}:{String(seconds).padStart(2, '0')}
          <span className="label ml-1.5">sgt scenario</span>
        </p>
      </div>
    </header>
  );
}
