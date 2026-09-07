/**
 * The operator's injection panel. Before the first run these controls write
 * straight into the board above, so the disruption is visible before recovery is
 * ever requested; once a response exists the board follows its scenario_state and
 * changing a control marks the plans stale instead.
 */

import { useOps } from '../../state/opsStore';
import type { WeatherCondition } from '../../mock/engine';
import { minutesToHhmm } from '../../lib/time';
import { IconAircraft, IconBaggage, IconPassengers, IconStand, IconStorm } from '../ui/Icons';

const WEATHER_OPTIONS: { value: WeatherCondition; label: string }[] = [
  { value: 'clear', label: 'Clear' },
  { value: 'rain', label: 'Rain' },
  { value: 'thunderstorm', label: 'Thunderstorm' },
];

export function DisruptionConsole() {
  const { state, setDisruption, resetDisruption, run } = useOps();
  const d = state.disruption;
  const running = state.phase === 'running';

  return (
    <section
      aria-label="Disruption injection"
      className="flex flex-col border-r border-rule bg-panel"
    >
      <header className="flex items-center justify-between border-b border-rule px-4 py-3">
        <h2 className="font-narrow text-md font-semibold tracking-wide text-ink">Disruption</h2>
        <button
          type="button"
          onClick={resetDisruption}
          className="label border border-rule px-2 py-1 transition-colors hover:border-rule-strong hover:text-ink-dim"
        >
          reset
        </button>
      </header>

      <div className="flex-1">
        <div className="space-y-3 px-4 pb-4 pt-3">
        <Slider
          icon={<IconAircraft size={14} />}
          label="Inbound aircraft late"
          value={d.late_incoming_minutes}
          min={0}
          max={75}
          step={5}
          unit="min"
          onChange={(v) => setDisruption({ late_incoming_minutes: v })}
        />

        <fieldset className="space-y-2">
          <Legend icon={<IconStorm size={14} />}>
            Weather at WSSS
            <span className="ml-1 text-ink-faint">· scenario override</span>
          </Legend>
          <div className="flex" role="radiogroup" aria-label="Weather at WSSS">
            {WEATHER_OPTIONS.map((o, i) => {
              const active = d.weather_condition === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setDisruption({ weather_condition: o.value })}
                  className={`flex-1 border px-2 py-1.5 font-narrow text-tiny font-semibold tracking-wide transition-colors ${
                    i > 0 ? '-ml-px' : ''
                  } ${
                    active
                      ? 'border-weather bg-weather/20 text-ink'
                      : 'border-rule text-ink-faint hover:border-rule-strong hover:text-ink-dim'
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <Legend icon={<IconStand size={14} />}>Stand conflict</Legend>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={d.gate_conflict}
              onChange={(e) => setDisruption({ gate_conflict: e.target.checked })}
              className="h-4 w-4 shrink-0 appearance-none border border-rule-strong bg-field transition-colors checked:border-conflict checked:bg-conflict"
            />
            <span className="text-sm text-ink-dim">
              Another aircraft claims stand {state.response?.scenario_state?.gate.current_gate ?? 'B8'}
            </span>
          </label>
          <div className={d.gate_conflict ? '' : 'pointer-events-none opacity-40'}>
            <Slider
              label="Claimed from"
              value={d.gate_conflict_min}
              min={14 * 60}
              max={15 * 60}
              step={5}
              unit=""
              format={minutesToHhmm}
              onChange={(v) => setDisruption({ gate_conflict_min: v })}
              disabled={!d.gate_conflict}
            />
          </div>
        </fieldset>

        <Slider
          icon={<IconBaggage size={14} />}
          label="Ground handling delay"
          value={d.ground_handling_delay_minutes}
          min={0}
          max={40}
          step={2}
          unit="min"
          onChange={(v) => setDisruption({ ground_handling_delay_minutes: v })}
        />

        <Slider
          icon={<IconBaggage size={14} />}
          label="Hold baggage loaded"
          value={d.baggage_percent}
          min={0}
          max={100}
          step={5}
          unit="%"
          onChange={(v) => setDisruption({ baggage_percent: v })}
        />

        <Slider
          icon={<IconPassengers size={14} />}
          label="Connecting passengers"
          value={d.connecting_passengers}
          min={0}
          max={120}
          step={2}
          unit="pax"
          onChange={(v) => setDisruption({ connecting_passengers: v })}
        />
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-rule bg-panel p-4">
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="flex w-full items-center justify-center gap-2.5 border border-subject bg-subject px-4 py-2.5 font-narrow text-sm font-bold uppercase tracking-[0.14em] text-[#20160a] transition-[background,box-shadow] hover:bg-[#ffb340] disabled:cursor-progress disabled:border-rule-strong disabled:bg-transparent disabled:text-ink-faint"
          style={{ boxShadow: running ? 'none' : '0 1px 2px rgb(0 0 0 / 0.5)' }}
        >
          {running ? (
            <>
              <Spinner />
              Agents working
            </>
          ) : (
            'Run recovery'
          )}
        </button>
        <p className="mt-1.5 text-tiny leading-snug text-ink-faint">
          Falls back to the local engine when the service is unreachable.
        </p>
      </div>
    </section>
  );
}

function Legend({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <legend className="label flex items-center gap-1.5">
      <span className="text-ink-faint">{icon}</span>
      {children}
    </legend>
  );
}

function Slider({
  icon,
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  note,
  format,
  disabled,
}: {
  icon?: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  note?: string;
  format?: (v: number) => string;
  disabled?: boolean;
}) {
  const id = `ctl-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="label flex items-center gap-1.5">
          {icon ? <span className="text-ink-faint">{icon}</span> : null}
          {label}
        </label>
        <output htmlFor={id} className="tnum font-data text-sm font-semibold text-ink">
          {format ? format(value) : value}
          {unit ? <span className="ml-1 text-tiny font-normal text-ink-faint">{unit}</span> : null}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="ops-range mt-1 w-full"
      />
      {note ? <p className="mt-0.5 text-tiny leading-snug text-ink-faint">{note}</p> : null}
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="h-3 w-3 shrink-0 animate-spin border border-current border-t-transparent"
      aria-hidden
    />
  );
}
