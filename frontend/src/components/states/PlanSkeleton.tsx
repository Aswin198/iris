/** Structural placeholders that match the ledger rows they replace. */
export function PlanSkeleton() {
  return (
    <div className="min-h-0 flex-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="border-b border-rule px-4 py-3">
          <div className="flex items-center gap-3">
            <Bar w="3.5rem" />
            <Bar w="6rem" />
            <span className="ml-auto" />
            <Bar w="3rem" />
          </div>
          <div className="mt-3 flex gap-5">
            <Bar w="4.5rem" h="0.5rem" />
            <Bar w="5rem" h="0.5rem" />
            <Bar w="4rem" h="0.5rem" />
          </div>
          <div className="mt-3 h-1 w-full bg-rule">
            <div
              className="h-full animate-pulse bg-rule-strong"
              style={{ width: `${40 + i * 18}%`, animationDelay: `${i * 120}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Bar({ w, h = '0.75rem' }: { w: string; h?: string }) {
  return <span className="block animate-pulse bg-rule" style={{ width: w, height: h }} />;
}
