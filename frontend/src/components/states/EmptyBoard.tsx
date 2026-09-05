import { IconRecovery } from '../ui/Icons';

/** Teaches the loop rather than announcing that a list is empty. */
export function EmptyBoard() {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center px-4 py-6">
      <span className="text-ink-faint">
        <IconRecovery size={22} />
      </span>
      <p className="mt-3 font-narrow text-md font-semibold text-ink">No recovery requested yet</p>
      <p className="mt-1.5 max-w-[46ch] text-tiny leading-relaxed text-ink-dim">
        Set the disruption on the left and run recovery. Six agents will report what is true and
        what is hard-constrained, then the optimiser scores every candidate plan. You decide which
        one is authorised.
      </p>
      <ol className="mt-4 space-y-1.5">
        {['Inject the disruption', 'Agents establish constraints', 'Optimiser scores the plans', 'You approve or reject'].map(
          (step) => (
            <li key={step} className="flex items-baseline gap-2.5 text-tiny text-ink-faint">
              <span className="h-px w-4 shrink-0 bg-rule-strong" aria-hidden />
              {step}
            </li>
          ),
        )}
      </ol>
    </div>
  );
}
