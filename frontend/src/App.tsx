import { TopBar } from './components/chrome/TopBar';
import { StandPlanner } from './components/planner/StandPlanner';
import { DisruptionConsole } from './components/disruption/DisruptionConsole';
import { AgentRail } from './components/agents/AgentRail';
import { PlanLedger } from './components/plans/PlanLedger';
import { DecisionLog } from './components/DecisionLog';
import { useOps } from './state/opsStore';

export function App() {
  return (
    <div className="flex min-h-dvh flex-col bg-field text-ink lg:h-dvh lg:min-h-0">
      <TopBar />
      <ServiceNotice />

      <main className="flex min-h-0 flex-1 flex-col">
        <StandPlanner />

        <div className="min-h-0 flex-1 lg:overflow-y-auto">
          <div className="grid min-h-full grid-cols-1 lg:grid-cols-[minmax(268px,20fr)_minmax(0,27fr)_minmax(0,33fr)]">
            <DisruptionConsole />

            <div className="flex flex-col border-b border-rule lg:border-b-0 lg:border-r">
              <AgentRail />
            </div>

            <div className="flex flex-col">
              <PlanLedger />
              <DecisionLog />
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-rule bg-panel px-4 py-1.5">
        <p className="label text-ink-dim">
          Decision support only · stand allocation, turnaround and passenger connection figures are
          synthetic and not operational Changi data
        </p>
      </footer>
    </div>
  );
}

/** Says plainly which source the console is reading, and why. */
function ServiceNotice() {
  const { state } = useOps();
  if (state.source !== 'mock' || !state.fallbackReason) return null;

  return (
    <p
      role="status"
      className="flex flex-wrap items-baseline gap-x-2 border-b border-subject/40 bg-subject/10 px-4 py-1.5 text-tiny text-ink-dim"
    >
      <span className="label text-subject">recovery service unreachable</span>
      <span>{state.fallbackReason}. Showing the local scenario engine.</span>
    </p>
  );
}
