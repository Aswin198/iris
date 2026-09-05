/**
 * Six lanes, one per agent. Lanes fill as findings arrive so the operator can
 * watch the reasoning assemble rather than being handed a verdict.
 */

import { useState } from 'react';
import type { AgentName, Severity } from '../../types/contract';
import { useOps, type AgentLane } from '../../state/opsStore';
import {
  IconAircraft,
  IconAlert,
  IconBaggage,
  IconChevron,
  IconPassengers,
  IconRecovery,
  IconStand,
  IconStorm,
} from '../ui/Icons';

const AGENT_META: Record<AgentName, { title: string; icon: (p: { size?: number }) => JSX.Element }> =
  {
    flight_agent: { title: 'Flight', icon: IconAircraft },
    weather_agent: { title: 'Weather', icon: IconStorm },
    gate_agent: { title: 'Gate', icon: IconStand },
    ground_agent: { title: 'Ground ops', icon: IconBaggage },
    passenger_agent: { title: 'Passengers', icon: IconPassengers },
    recovery_agent: { title: 'Recovery', icon: IconRecovery },
  };

const SEVERITY_COLOR: Record<Severity, string> = {
  low: 'var(--sev-low)',
  medium: 'var(--sev-medium)',
  high: 'var(--sev-high)',
  critical: 'var(--sev-critical)',
};

export function AgentRail() {
  const { state } = useOps();

  return (
    <section aria-label="Agent findings" className="flex flex-col bg-panel">
      <header className="sticky top-0 z-10 flex items-baseline justify-between border-b border-rule bg-panel px-4 py-3">
        <h2 className="font-narrow text-md font-semibold tracking-wide text-ink">Agent findings</h2>
        <p className="label">
          {state.agents.filter((a) => a.status === 'completed').length} of {state.agents.length}{' '}
          reported
        </p>
      </header>

      <ul className="flex-1" aria-live="polite" aria-busy={state.phase === 'running'}>
        {state.agents.map((lane) => (
          <Lane key={lane.agent} lane={lane} idle={state.phase === 'idle'} />
        ))}
      </ul>
    </section>
  );
}

function Lane({ lane, idle }: { lane: AgentLane; idle: boolean }) {
  const [open, setOpen] = useState(false);
  const meta = AGENT_META[lane.agent];
  const Icon = meta.icon;
  const hasDetail = Boolean(
    lane.findings?.length || lane.constraints?.length || lane.recommended_actions?.length,
  );

  const accent =
    lane.status === 'completed' && lane.severity
      ? SEVERITY_COLOR[lane.severity]
      : lane.status === 'failed'
        ? 'var(--sev-critical)'
        : 'var(--rule-strong)';

  return (
    <li className="border-b border-rule last:border-b-0">
      <div className="flex items-start gap-3 px-4 py-2.5">
        <span
          className="mt-0.5 shrink-0 transition-colors"
          style={{ color: lane.status === 'pending' ? 'var(--ink-faint)' : accent }}
        >
          {lane.status === 'failed' ? <IconAlert size={15} /> : <Icon size={15} />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="font-narrow text-sm font-semibold tracking-wide text-ink">
              {meta.title}
            </h3>
            {lane.status === 'completed' && lane.severity ? (
              <span
                className="label border px-1.5 py-px leading-4"
                style={{ color: accent, borderColor: accent }}
              >
                {lane.severity}
              </span>
            ) : null}
            <StatusMark status={lane.status} idle={idle} />
          </div>

          {lane.summary ? (
            <p className="mt-1 text-tiny leading-relaxed text-ink-dim">{lane.summary}</p>
          ) : (
            <p className="mt-1 text-tiny leading-relaxed text-ink-faint">
              {idle
                ? 'Awaiting a scenario.'
                : lane.status === 'running'
                  ? 'Reasoning over its domain…'
                  : 'Queued.'}
            </p>
          )}

          {hasDetail ? (
            <>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="label mt-1.5 flex items-center gap-1 transition-colors hover:text-ink-dim"
              >
                <span
                  className="inline-flex transition-transform"
                  style={{ transform: open ? 'rotate(90deg)' : 'none' }}
                >
                  <IconChevron size={11} />
                </span>
                {open ? 'hide detail' : 'detail'}
              </button>

              {open ? (
                <div className="mt-2 space-y-2.5 border-l border-rule pl-3">
                  <DetailList title="findings" items={lane.findings} />
                  <DetailList
                    title="hard constraints"
                    items={lane.constraints?.map((c) => `${c.type} — ${c.value}`)}
                    accent
                  />
                  <DetailList title="recommends" items={lane.recommended_actions} />
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function DetailList({
  title,
  items,
  accent,
}: {
  title: string;
  items?: string[];
  accent?: boolean;
}) {
  if (!items?.length) return null;
  return (
    <div>
      <h4 className="label" style={accent ? { color: 'var(--sev-medium)' } : undefined}>
        {title}
      </h4>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li key={item} className="text-tiny leading-relaxed text-ink-faint">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusMark({ status, idle }: { status: AgentLane['status']; idle: boolean }) {
  if (status === 'running') {
    return (
      <span className="label ml-auto flex items-center gap-1.5 text-ghost">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ghost" aria-hidden />
        running
      </span>
    );
  }
  if (status === 'pending') {
    return <span className="label ml-auto">{idle ? 'idle' : 'pending'}</span>;
  }
  if (status === 'failed') {
    return <span className="label ml-auto text-conflict">failed</span>;
  }
  return null;
}
