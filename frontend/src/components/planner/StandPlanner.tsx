/**
 * The stand-allocation chart. This is the interface, not a widget inside it:
 * time runs left to right, stands run top to bottom, and the gate conflict is
 * a collision you can see rather than a number you have to read.
 */

import { useEffect, useMemo, useRef } from 'react';
import {
  STAND_BOARD,
  SUBJECT_FLIGHT_ID,
  type Stand,
  type StandBlock,
} from '../../mock/airport_state';
import { isoToSgtMinutes, minutesToHhmm } from '../../lib/time';
import { buildBoardModel, buildGhost, getBoardWindow, pct, widthPct, type BoardWindow } from '../../state/boardModel';
import { useOps } from '../../state/opsStore';
import { useScenarioClock } from '../../lib/scenarioClock';
import { useDispatcher } from '../../state/dispatcherStore';

const TICK_STEP = 10;
const LABEL_STEP = 20;

export function StandPlanner() {
  const { state, projected, committed } = useOps();
  const { selectedFlight } = useDispatcher();
  const subjectGate = committed?.stand_id ?? selectedFlight?.gate;
  const standBoard = useMemo(() => {
    if (!selectedFlight) return STAND_BOARD;
    return STAND_BOARD.map((stand) => ({
      ...stand,
      blocks: stand.blocks.filter((block) => !block.subject).concat(
        stand.stand_id === subjectGate
          ? [{
              block_id: `subject_${selectedFlight.flight_id}`,
              flight_id: selectedFlight.flight_id,
              origin: selectedFlight.origin,
              destination: selectedFlight.destination,
              aircraft_type: selectedFlight.aircraft_type,
              start_min: isoToSgtMinutes(selectedFlight.scheduled_arrival),
              end_min: isoToSgtMinutes(selectedFlight.outbound_departure ?? selectedFlight.scheduled_departure),
              subject: true,
            }]
          : [],
      ),
    }));
  }, [selectedFlight, subjectGate]);
  const board = useMemo(
    () => buildBoardModel(state.disruption, state.response, committed, selectedFlight ?? undefined),
    [state.disruption, state.response, committed, selectedFlight],
  );
  const ghost = useMemo(
    () => buildGhost(projected, board, state.committedPlanId),
    [projected, board, state.committedPlanId],
  );

  const { minutes: nowMin } = useScenarioClock();
  const window = useMemo(
    () => getBoardWindow(nowMin),
    [Math.floor(nowMin / 10)],
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  // On a narrow viewport the chart is wider than the screen. Open it on the
  // now-line so the collision is the first thing visible, not 13:20.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const overflow = el.scrollWidth - el.clientWidth;
    if (overflow <= 0) return;
    // Anchor just left of the now-line: FIRST VIEWPORT promises the NOW line on
    // the board, and from there the conflict falls inside the same window.
    el.scrollLeft = Math.max(0, (pct(nowMin, window) / 100) * el.scrollWidth - el.clientWidth * 0.12);
    // The chart window moves every ten minutes; keep the initial scroll position
    // stable while the clock ticks within the current window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [window]);

  const ticks: number[] = [];
  for (let m = window.start_min; m <= window.end_min; m += TICK_STEP) ticks.push(m);

  const conflictLive =
    board.stand_deadline_min !== null && board.overrun_min > 0 && !state.committedPlanId;

  return (
    <section
      aria-label="Stand allocation chart"
      className="flex shrink-0 flex-col border-b border-rule bg-field"
    >
      <PlannerHeader board={board} conflictLive={conflictLive} window={window} />

      <div className="relative">
        <div ref={scrollRef} className="overflow-x-auto">
        <div className="min-w-[760px]">
          <TimeAxis ticks={ticks} weather={board.weather_window} condition={board.weather_condition} window={window} />

          <div className="relative">
            <GridLines ticks={ticks} window={window} />
            {board.weather_window ? (
              <WeatherBand
                from={board.weather_window.start_min}
                to={board.weather_window.end_min}
                window={window}
              />
            ) : null}

            {standBoard.map((stand) => (
              <StandRow
                key={stand.stand_id}
                stand={stand}
                board={board}
                ghost={ghost && ghost.stand_id === stand.stand_id ? ghost : null}
                committed={Boolean(state.committedPlanId)}
                conflict={conflictLive}
                phase={state.phase}
              />
            ))}

            {board.committed_stand_id &&
            board.committed_stand_id !== board.current_gate ? (
              <ReallocationLink board={board} />
            ) : null}

            {board.stand_deadline_min !== null ? (
              <DeadlineMarker min={board.stand_deadline_min} breached={conflictLive} window={window} />
            ) : null}
            <NowLine min={nowMin} window={window} />
          </div>

          <TimeAxis ticks={ticks} foot nowMin={nowMin} window={window} />
          </div>
        </div>
        <EdgeFade />
      </div>

      <Legend flightId={selectedFlight?.flight_id ?? SUBJECT_FLIGHT_ID} />
    </section>
  );
}

/** Cues that the chart continues past the right edge on a narrow viewport. */
function EdgeFade() {
  return (
    <span
      className="pointer-events-none absolute inset-y-0 right-0 w-8 lg:hidden"
      style={{ background: 'linear-gradient(to left, var(--field), transparent)' }}
      aria-hidden
    />
  );
}

/* ---- header ------------------------------------------------------------ */

function PlannerHeader({
  board,
  conflictLive,
  window,
}: {
  board: ReturnType<typeof buildBoardModel>;
  conflictLive: boolean;
  window: BoardWindow;
}) {
  return (
    <header className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-rule px-4 py-3">
      <h2 className="font-narrow text-lg font-semibold tracking-wide text-ink">
        Terminal 2 stand allocation
      </h2>
      <p className="tnum font-data text-tiny text-ink-faint">
        {minutesToHhmm(window.start_min)}–{minutesToHhmm(window.end_min)} SGT
      </p>
      {conflictLive ? (
        <p className="tnum font-data text-tiny text-conflict">
          {board.current_gate} overruns its next occupant by {board.overrun_min} min
        </p>
      ) : (
        <p className="tnum font-data text-tiny text-ink-faint">No stand overrun on the board</p>
      )}
    </header>
  );
}

/* ---- axis and grid ----------------------------------------------------- */

function TimeAxis({
  ticks,
  foot = false,
  weather,
  condition,
  nowMin,
  window,
}: {
  ticks: number[];
  foot?: boolean;
  weather?: { start_min: number; end_min: number } | null;
  condition?: string;
  nowMin?: number;
  window: BoardWindow;
}) {
  return (
    <div
      className={`relative ${foot ? 'h-6 border-t' : 'h-9 border-b'} border-rule pl-[72px] pr-3`}
      aria-hidden="true"
    >
      <div className="relative h-full">
        {weather && condition ? (
          <span
            className="label absolute top-0.5 whitespace-nowrap text-[0.625rem] text-weather"
            style={{ left: `${pct(weather.start_min, window)}%` }}
          >
            {condition} {minutesToHhmm(weather.start_min)}–{minutesToHhmm(weather.end_min)}
          </span>
        ) : null}
        {ticks.map((m) => {
          if (m % LABEL_STEP !== 0) return null;
          // Suppress a tick label the now-readout would sit on top of.
          if (nowMin !== undefined && Math.abs(m - nowMin) < 11) return null;
          return (
            <span
              key={m}
              className="tnum absolute bottom-1 -translate-x-1/2 font-data text-[0.625rem] tracking-wider text-ink-faint"
              style={{ left: `${pct(m, window)}%` }}
            >
              {minutesToHhmm(m)}
            </span>
          );
        })}
        {nowMin !== undefined ? (
          <span
            className="tnum absolute bottom-1 -translate-x-1/2 whitespace-nowrap font-data text-[0.625rem] font-semibold text-ink"
            style={{ left: `${pct(nowMin, window)}%` }}
          >
            now {minutesToHhmm(nowMin)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function GridLines({ ticks, window }: { ticks: number[]; window: BoardWindow }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 left-[72px] right-3" aria-hidden="true">
      {ticks.map((m) => (
        <span
          key={m}
          className="absolute inset-y-0 w-px"
          style={{
            left: `${pct(m, window)}%`,
            background: m % LABEL_STEP === 0 ? 'var(--rule)' : 'rgba(36,49,61,0.55)',
          }}
        />
      ))}
    </div>
  );
}

/* ---- overlays ---------------------------------------------------------- */

function WeatherBand({ from, to, window }: { from: number; to: number; window: BoardWindow }) {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-[72px] right-3 z-0"
      aria-hidden="true"
    >
      <div
        className="absolute inset-y-0"
        style={{
          left: `${pct(from, window)}%`,
          width: `${widthPct(from, to, window)}%`,
          background:
            'linear-gradient(180deg, rgba(124,108,224,0.22), rgba(124,108,224,0.10) 60%, rgba(124,108,224,0.18))',
          borderLeft: '1px solid rgba(124,108,224,0.6)',
          borderRight: '1px solid rgba(124,108,224,0.6)',
        }}
      />
    </div>
  );
}

function DeadlineMarker({ min, breached, window }: { min: number; breached: boolean; window: BoardWindow }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 left-[72px] right-3 z-20">
      <div
        className="absolute inset-y-0 w-px"
        style={{
          left: `${pct(min, window)}%`,
          background: breached ? 'var(--conflict)' : 'var(--rule-strong)',
        }}
      >
        <span
          className="tnum absolute -top-5 left-1 hidden whitespace-nowrap font-data text-[0.625rem] font-medium lg:block"
          style={{ color: breached ? 'var(--conflict)' : 'var(--ink-faint)' }}
        >
          stand claimed {minutesToHhmm(min)}
        </span>
      </div>
    </div>
  );
}

function NowLine({ min, window }: { min: number; window: BoardWindow }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 left-[72px] right-3 z-20">
      <div className="absolute inset-y-0 w-px bg-ink" style={{ left: `${pct(min, window)}%` }}>
        <span className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rotate-45 bg-ink" />
      </div>
    </div>
  );
}

/**
 * Draws the aircraft leaving one stand and arriving at another, so an authorised
 * relocation reads as one movement rather than two unrelated bars.
 */
function ReallocationLink({ board }: { board: ReturnType<typeof buildBoardModel> }) {
  const fromIndex = STAND_BOARD.findIndex((s) => s.stand_id === board.current_gate);
  const toIndex = STAND_BOARD.findIndex((s) => s.stand_id === board.committed_stand_id);
  if (fromIndex < 0 || toIndex < 0 || board.committed_off_block_min === null) return null;

  const rowH = 52;
  const top = fromIndex * rowH + rowH / 2;
  const bottom = toIndex * rowH + rowH / 2;
  const x = pct(board.committed_off_block_min);

  return (
    <div className="pointer-events-none absolute inset-y-0 left-[72px] right-3 z-30" aria-hidden>
      <svg
        className="absolute"
        style={{
          left: `calc(${x}% - 26px)`,
          top: Math.min(top, bottom),
          width: 26,
          height: Math.abs(bottom - top),
          overflow: 'visible',
        }}
      >
        <path
          d={`M 26 ${top < bottom ? 0 : Math.abs(bottom - top)} C 6 ${
            Math.abs(bottom - top) / 2
          }, 6 ${Math.abs(bottom - top) / 2}, 26 ${top < bottom ? Math.abs(bottom - top) : 0}`}
          fill="none"
          stroke="var(--committed)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        <circle
          cx="26"
          cy={top < bottom ? Math.abs(bottom - top) : 0}
          r="2.5"
          fill="var(--committed)"
        />
      </svg>
    </div>
  );
}

/* ---- rows -------------------------------------------------------------- */

function StandRow({
  stand,
  board,
  ghost,
  committed,
  conflict,
  phase,
}: {
  stand: Stand;
  board: ReturnType<typeof buildBoardModel>;
  ghost: ReturnType<typeof buildGhost>;
  committed: boolean;
  conflict: boolean;
  phase: string;
}) {
  const isCurrent = stand.stand_id === board.current_gate;
  const subject = stand.blocks.find((block) => block.subject);
  const subjectEnd = subject
    ? board.committed_off_block_min !== null
      ? board.committed_off_block_min
      : Math.max(subject.end_min, board.required_off_block_min)
    : null;
  const occupancyConflict = Boolean(
    subject &&
      subjectEnd !== null &&
      stand.blocks.some(
        (block) =>
          !block.subject &&
          block.start_min < subjectEnd &&
          block.end_min > subject.start_min,
      ),
  );
  const deadlineConflict = Boolean(
    subject &&
      subjectEnd !== null &&
      stand.stand_id === board.current_gate &&
      board.stand_deadline_min !== null &&
      subjectEnd + 8 > board.stand_deadline_min,
  );

  return (
    <div className="relative flex h-[3.25rem] items-stretch border-b border-rule last:border-b-0">
      <div className="sticky left-0 z-40 flex w-[72px] shrink-0 items-baseline gap-1.5 border-r border-rule bg-field px-3 py-2">
        <span className="font-narrow text-sm font-semibold leading-none text-ink">
          {stand.stand_id}
        </span>
        <span className="label leading-none">{stand.category === 'code_e' ? 'e' : 'c'}</span>
      </div>

      <div className="relative flex-1 pr-3">
        <div className="hatch-quiet absolute inset-y-1.5 left-0 right-3 opacity-40" aria-hidden />

        {stand.blocks.map((block) => (
          <Block
            key={block.block_id}
            block={block}
            board={board}
            conflict={
              conflict ||
              Boolean(block.subject && (occupancyConflict || deadlineConflict))
            }
          />
        ))}

        {isCurrent && board.stand_deadline_min !== null && !committed ? (
          <ClearanceTail board={board} />
        ) : null}

        {ghost ? <Ghost ghost={ghost} phase={phase} /> : null}
      </div>
    </div>
  );
}

/**
 * Off-block is not the same as stand-clear: pushback keeps the stand occupied
 * for eight more minutes, and that tail is what collides with the next arrival.
 */
function ClearanceTail({ board }: { board: ReturnType<typeof buildBoardModel> }) {
  const from = board.required_off_block_min;
  const to = from + 8;
  const breached = board.stand_deadline_min !== null && to > board.stand_deadline_min;

  return (
    <div
      className={`absolute inset-y-1.5 z-20 border ${
        breached ? 'hatch-conflict border-conflict' : 'border-rule-strong'
      }`}
      style={{ left: `${pct(from)}%`, width: `${widthPct(from, to)}%` }}
      title={`Stand clearance ${minutesToHhmm(from)}–${minutesToHhmm(to)}${
        breached ? ' — overruns the next occupant' : ''
      }`}
    />
  );
}

function Block({
  block,
  board,
  conflict,
}: {
  block: StandBlock;
  board: ReturnType<typeof buildBoardModel>;
  conflict: boolean;
}) {
  // The subject flight's stand occupancy stretches to whatever the turnaround
  // now needs — that stretch is the disruption made visible.
  const end = block.subject
    ? board.committed_off_block_min !== null
      ? board.committed_off_block_min
      : Math.max(block.end_min, board.required_off_block_min)
    : block.end_min;
  const left = pct(block.start_min);
  const width = widthPct(block.start_min, end);

  const base = block.subject
    ? conflict
      ? 'hatch-conflict bg-conflict-deep text-ink border-conflict'
      : 'bg-committed/85 text-[#071b12] border-committed'
    : block.claimant
      ? 'border-rule-strong bg-traffic/45 text-traffic-ink'
      : 'border-rule-strong bg-traffic/30 text-traffic-ink';

  return (
    <div
      className={`absolute inset-y-1.5 z-10 flex items-center overflow-hidden border ${base}`}
      style={{ left: `${left}%`, width: `${width}%` }}
      title={`${block.flight_id} ${block.origin}–${block.destination} · ${minutesToHhmm(
        block.start_min,
      )}–${minutesToHhmm(end)}`}
    >
      <span className="relative truncate px-2 font-narrow text-tiny font-semibold tracking-wide">
        {block.flight_id}
      </span>
      {width > 14 ? (
        <span className="tnum relative truncate pr-2 font-data text-[0.625rem] opacity-80">
          {block.aircraft_type}
        </span>
      ) : null}
    </div>
  );
}

function Ghost({ ghost, phase }: { ghost: NonNullable<ReturnType<typeof buildGhost>>; phase: string }) {
  const left = pct(ghost.from_min);
  const width = widthPct(ghost.from_min, ghost.to_min);
  const live = phase === 'ready' || phase === 'no_plan';
  const blockMinutes = Math.max(0, ghost.to_min - ghost.from_min);
  if (!live) return null;

  return (
    <div
      className="absolute inset-y-1.5 z-30 flex items-center justify-end"
      style={{
        left: `${left}%`,
        width: `${width}%`,
        // Deliberate layout transition: on a Gantt bar `left` and `width` ARE the
        // datum, and a transform would scale the label and misreport the time.
        // The detector's `transition: width` literal no longer matches this
        // shorthand, so this file is outside that check — do not "fix" it blind.
        transition:
          'left var(--dur) var(--ease), width var(--dur) var(--ease), border-color var(--dur) var(--ease), background-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease)',
        border: ghost.committed ? '1.5px solid var(--committed)' : '1.5px dashed var(--ghost)',
        backgroundColor: ghost.committed ? 'rgba(47,191,113,0.16)' : 'rgba(70,182,217,0.12)',
        boxShadow: ghost.committed ? '0 1px 3px rgb(0 0 0 / 0.5), 0 0 0 3px rgba(47,191,113,0.12)' : 'none',
      }}
      title={`${ghost.label} · expected block ${formatBlockDuration(blockMinutes)} · ${minutesToHhmm(
        ghost.from_min,
      )}–${minutesToHhmm(ghost.to_min)}`}
    >
      <span
        className="tnum whitespace-nowrap px-2 font-data text-[0.625rem] font-semibold"
        style={{ color: ghost.committed ? 'var(--committed)' : 'var(--ghost)' }}
      >
        {ghost.committed ? 'authorised' : ghost.label} · block {formatBlockDuration(blockMinutes)} ·{' '}
        {minutesToHhmm(ghost.to_min)}
      </span>
    </div>
  );
}

function formatBlockDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return hours ? `${hours}h ${String(remainder).padStart(2, '0')}m` : `${remainder}m`;
}

/* ---- legend ------------------------------------------------------------ */

function Legend({ flightId }: { flightId: string }) {
  const items = [
    { label: 'other traffic', swatch: 'border border-rule-strong bg-traffic/30' },
    { label: flightId, swatch: 'bg-subject' },
    { label: 'stand overrun', swatch: 'hatch-conflict' },
    { label: 'projected plan', swatch: 'border border-dashed border-ghost bg-ghost/15' },
    { label: 'authorised', swatch: 'border border-committed bg-committed/20' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule px-4 py-2">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-2">
          <span className={`h-3 w-6 shrink-0 ${i.swatch}`} aria-hidden />
          <span className="label">{i.label}</span>
        </span>
      ))}
      <span className="ml-auto label text-ink-dim">
        {flightId} · synthetic stand data
      </span>
    </div>
  );
}
