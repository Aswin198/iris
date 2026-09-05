/**
 * Where the human stays in charge. Nothing here acts on the airport: it records
 * an operator's authorisation of a plan the optimiser scored.
 */

import { useEffect, useRef, useState } from 'react';
import { useOps } from '../../state/opsStore';
import { IconCheck, IconCross } from '../ui/Icons';
import { minutesToHhmm } from '../../lib/time';

const REJECT_REASONS = [
  'Stand not actually available',
  'Crew duty limit',
  'Passenger impact unacceptable',
  'Local knowledge overrides',
];

export function DecisionBar() {
  const { state, selected, decide } = useOps();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const rejectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rejecting) rejectRef.current?.querySelector('button')?.focus();
  }, [rejecting]);

  if (state.phase !== 'ready' && state.phase !== 'no_plan') return null;

  const plan = selected;
  const committed = state.committedPlanId !== null;
  const canApprove = Boolean(plan?.feasible) && !committed && !state.stale;

  if (state.phase === 'no_plan') {
    return (
      <div className="border-t border-conflict bg-conflict/10 px-4 py-3">
        <p className="font-narrow text-sm font-semibold text-conflict">No feasible recovery plan</p>
        <p className="mt-1 text-tiny leading-relaxed text-ink-dim">
          Every candidate violates a hard constraint. Relax the stand claim, recover ground handling
          time, or escalate to the duty manager.
        </p>
      </div>
    );
  }

  return (
    <div className="sticky bottom-0 border-t border-rule bg-panel-raised">
      {committed ? (
        <div className="flex items-start gap-3 px-4 py-3">
          <span className="mt-0.5 shrink-0 text-committed">
            <IconCheck size={16} />
          </span>
          <div className="min-w-0">
            <p className="font-narrow text-sm font-semibold text-committed">
              {state.decisions[0]?.plan_id.replace('plan_', 'Plan ')} authorised
            </p>
            <p className="tnum mt-0.5 font-data text-tiny text-ink-dim">{state.decisions[0]?.detail}</p>
          </div>
        </div>
      ) : rejecting ? (
        <div ref={rejectRef} className="px-4 py-3">
          <p className="label mb-2">reason for rejecting {plan?.label}</p>
          <div className="flex flex-wrap gap-2">
            {REJECT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`border px-2 py-1 text-tiny transition-colors ${
                  reason === r
                    ? 'border-conflict bg-conflict/15 text-ink'
                    : 'border-rule text-ink-faint hover:border-rule-strong hover:text-ink-dim'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={!reason || !plan}
              onClick={() => {
                if (plan) decide('rejected', plan.plan_id, reason);
                setRejecting(false);
                setReason('');
              }}
              className="border border-conflict bg-conflict px-3 py-1.5 font-narrow text-tiny font-bold uppercase tracking-widest text-[#2a0a08] transition-colors hover:bg-[#f4574a] disabled:cursor-not-allowed disabled:border-rule-strong disabled:bg-transparent disabled:text-ink-faint"
            >
              Confirm rejection
            </button>
            <button
              type="button"
              onClick={() => {
                setRejecting(false);
                setReason('');
              }}
              className="border border-rule px-3 py-1.5 font-narrow text-tiny font-semibold uppercase tracking-widest text-ink-dim transition-colors hover:border-rule-strong hover:text-ink"
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
          <p className="w-full min-w-0 lg:w-auto lg:flex-1">
            <span className="label">selected</span>{' '}
            {plan ? (
              <span className="tnum font-data text-tiny text-ink-dim">
                {plan.label} · stand {plan.stand_id} · off-block{' '}
                {minutesToHhmm(plan.off_block_min)}
              </span>
            ) : (
              <span className="text-tiny text-ink-faint">no plan selected</span>
            )}
          </p>

          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setRejecting(true)}
              disabled={!plan}
              className="flex items-center gap-1.5 border border-rule-strong px-3 py-2 font-narrow text-tiny font-semibold uppercase tracking-widest text-ink-dim transition-colors hover:border-conflict hover:text-conflict disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconCross size={13} />
              Reject
            </button>
            <button
              type="button"
              onClick={() => plan && decide('approved', plan.plan_id)}
              disabled={!canApprove}
              className="flex items-center gap-1.5 border border-committed bg-committed px-4 py-2 font-narrow text-tiny font-bold uppercase tracking-widest text-[#04220f] transition-colors hover:bg-[#3ed683] disabled:cursor-not-allowed disabled:border-rule-strong disabled:bg-transparent disabled:text-ink-faint"
              title={
                canApprove
                  ? undefined
                  : state.stale
                    ? 'The disruption changed — re-run recovery before authorising'
                    : 'Infeasible plans cannot be authorised'
              }
            >
              <IconCheck size={13} />
              Approve {plan?.label ?? ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
