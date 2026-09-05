import { useOps } from '../state/opsStore';

/** The audit trail. Every authorisation and rejection, with its reason. */
export function DecisionLog() {
  const { state } = useOps();

  if (state.decisions.length === 0) return null;

  return (
    <section aria-label="Decision log" className="flex shrink-0 flex-col border-t border-rule bg-panel">
      <header className="flex shrink-0 items-baseline justify-between border-b border-rule px-4 py-2">
        <h2 className="font-narrow text-sm font-semibold tracking-wide text-ink">Decision log</h2>
        <p className="label">{state.decisions.length} recorded</p>
      </header>

      <ul>
          {state.decisions.map((d) => (
            <li key={d.id} className="flex items-start gap-3 border-b border-rule px-4 py-2.5 last:border-b-0">
              <span
                className="tnum mt-px shrink-0 font-data text-[0.625rem]"
                style={{ color: 'var(--ink-faint)' }}
              >
                {d.at}
              </span>
              <span
                className="label shrink-0 border px-1.5 py-px leading-4"
                style={{
                  color: d.action === 'approved' ? 'var(--committed)' : 'var(--conflict)',
                  borderColor: d.action === 'approved' ? 'var(--committed)' : 'var(--conflict)',
                }}
              >
                {d.action}
              </span>
              <span className="min-w-0 flex-1 text-tiny leading-relaxed text-ink-dim">{d.detail}</span>
            </li>
          ))}
      </ul>
    </section>
  );
}
