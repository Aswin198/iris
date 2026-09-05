/**
 * The candidate plans, scored. Focusing a row projects it onto the stand chart
 * above — that projection is how the operator sees what they are choosing.
 */

import { useRef } from 'react';
import { useOps, type PlanRow } from '../../state/opsStore';
import { minutesToHhmm, signedMinutes } from '../../lib/time';
import { IconAlert } from '../ui/Icons';
import { DecisionBar } from '../decision/DecisionBar';
import { PlanSkeleton } from '../states/PlanSkeleton';
import { EmptyBoard } from '../states/EmptyBoard';

export function PlanLedger() {
  const { state, preview, select } = useOps();
  const listRef = useRef<HTMLDivElement>(null);

  const worstScore = Math.max(
    1,
    ...state.plans.map((p) => p.score ?? 0),
  );

  if (state.phase === 'idle') {
    return (
      <section aria-label="Recovery plans" className="flex flex-1 flex-col bg-panel">
        <LedgerHeader />
        <EmptyBoard />
      </section>
    );
  }

  if (state.phase === 'running') {
    return (
      <section aria-label="Recovery plans" className="flex flex-1 flex-col bg-panel">
        <LedgerHeader />
        <PlanSkeleton />
      </section>
    );
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = state.plans.findIndex((p) => p.plan_id === state.selectedPlanId);
    const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
    const target = state.plans[Math.max(0, Math.min(state.plans.length - 1, next))];
    if (target) {
      select(target.plan_id);
      listRef.current?.querySelector<HTMLElement>(`[data-plan="${target.plan_id}"]`)?.focus();
    }
  };

  return (
    <section aria-label="Recovery plans" className="flex flex-1 flex-col bg-panel">
      <LedgerHeader />

      {state.stale ? <StaleNotice /> : null}

      <div className="flex-1">
        <div
          ref={listRef}
          role="radiogroup"
          aria-label="Candidate recovery plans"
          onKeyDown={onKeyDown}
          onMouseLeave={() => preview(null)}
        >
          {state.plans.map((plan) => (
            <Row
              key={plan.plan_id}
              plan={plan}
              selected={plan.plan_id === state.selectedPlanId}
              previewed={plan.plan_id === state.previewPlanId}
              committed={plan.plan_id === state.committedPlanId}
              stale={state.stale}
              worstScore={worstScore}
              onPreview={() => preview(plan.plan_id)}
              onSelect={() => select(plan.plan_id)}
            />
          ))}
        </div>
      </div>

      {state.response ? (
        <p
          className="clamp-lg shrink-0 border-t border-rule px-4 py-2 text-tiny leading-snug text-ink-dim"
          title={state.response.reasoning_summary}
        >
          {state.response.reasoning_summary}
        </p>
      ) : null}

      <DecisionBar />
    </section>
  );
}

function StaleNotice() {
  const { run } = useOps();
  return (
    <p
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-subject/40 bg-subject/10 px-4 py-2 text-tiny text-ink-dim"
    >
      <span className="label text-subject">inputs changed</span>
      <span>These plans were scored against the previous disruption.</span>
      <button
        type="button"
        onClick={run}
        className="label ml-auto border border-subject px-2 py-0.5 text-subject transition-colors hover:bg-subject/20"
      >
        re-run
      </button>
    </p>
  );
}

function LedgerHeader() {
  const { state } = useOps();
  const feasible = state.plans.filter((p) => p.feasible).length;
  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-baseline justify-between gap-2 border-b border-rule bg-panel px-4 py-3">
      <h2 className="font-narrow text-md font-semibold tracking-wide text-ink">Recovery plans</h2>
      <p className="label">
        {state.plans.length
          ? `${feasible} of ${state.plans.length} feasible · lower score is better`
          : 'scored by the optimiser, not the model'}
      </p>
    </header>
  );
}

function Row({
  plan,
  selected,
  previewed,
  committed,
  stale,
  worstScore,
  onPreview,
  onSelect,
}: {
  plan: PlanRow;
  selected: boolean;
  previewed: boolean;
  committed: boolean;
  stale: boolean;
  worstScore: number;
  onPreview: () => void;
  onSelect: () => void;
}) {
  const edge = committed
    ? 'var(--committed)'
    : selected
      ? 'var(--ghost)'
      : previewed
        ? 'var(--rule-strong)'
        : 'transparent';

  return (
    <div
      data-plan={plan.plan_id}
      role="radio"
      aria-checked={selected}
      aria-disabled={!plan.feasible}
      tabIndex={selected ? 0 : -1}
      onFocus={onPreview}
      onMouseEnter={onPreview}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`relative cursor-pointer border-b border-rule px-4 py-2.5 outline-none transition-colors ${
        selected ? 'bg-panel-raised' : previewed ? 'bg-panel-raised/60' : 'hover:bg-panel-raised/40'
      } ${plan.feasible ? '' : 'opacity-70'} ${stale ? 'opacity-50' : ''}`}
      style={{ boxShadow: `inset 1px 0 0 ${edge}` }}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-narrow text-sm font-bold tracking-wide text-ink">{plan.label}</span>
        <span className="tnum font-data text-tiny text-ink-dim">{plan.strategy}</span>

        <span className="tnum ml-auto font-data text-md font-semibold text-ink">
          {minutesToHhmm(plan.off_block_min)}
        </span>
        <span
          className="tnum font-data text-tiny font-medium"
          style={{
            color:
              plan.metrics.departure_delay_minutes > 30
                ? 'var(--sev-high)'
                : plan.metrics.departure_delay_minutes > 15
                  ? 'var(--subject)'
                  : 'var(--ink-dim)',
          }}
        >
          {signedMinutes(plan.metrics.departure_delay_minutes)} min
        </span>
      </div>

      <dl className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <Metric label="stand" value={plan.stand_id} />
        <Metric label="pax at risk" value={String(plan.metrics.passengers_at_risk)} />
        <Metric label="downstream" value={`${plan.metrics.downstream_delay_minutes} min`} />
        {plan.metrics.gate_conflicts > 0 ? (
          <Metric label="gate conflicts" value={String(plan.metrics.gate_conflicts)} alarm />
        ) : null}

        {plan.feasible ? (
          <div className="ml-auto flex items-baseline gap-2">
            <dt className="label">score</dt>
            <dd className="tnum font-data text-sm font-semibold text-ink">{plan.score}</dd>
            {plan.recommended ? (
              <dd className="label border border-committed px-1.5 py-px leading-4 text-committed">
                best feasible
              </dd>
            ) : null}
          </div>
        ) : null}
      </dl>

      {plan.feasible ? (
        <span
          className="absolute bottom-0 left-0 h-0.5 transition-[width]"
          style={{
            width: `${Math.max(2, ((plan.score ?? 0) / worstScore) * 100)}%`,
            background: plan.recommended ? 'var(--committed)' : 'var(--rule-strong)',
            transitionDuration: 'var(--dur)',
          }}
          aria-hidden
        />
      ) : (
        <p className="mt-1.5 flex items-start gap-2 text-tiny leading-snug text-conflict">
          <span className="mt-px shrink-0">
            <IconAlert size={13} />
          </span>
          <span>
            <span className="font-semibold">Infeasible.</span>{' '}
            {plan.constraint_violations[0] ?? 'Violates a hard operational constraint.'}
          </span>
        </p>
      )}
    </div>
  );
}

function Metric({ label, value, alarm }: { label: string; value: string; alarm?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="label">{label}</dt>
      <dd
        className="tnum font-data text-tiny font-medium"
        style={{ color: alarm ? 'var(--conflict)' : 'var(--ink)' }}
      >
        {value}
      </dd>
    </div>
  );
}
