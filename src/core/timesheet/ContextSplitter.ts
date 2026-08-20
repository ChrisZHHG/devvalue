import type { AttributionEngine } from './AttributionEngine.js';
import type { ActivitySignal, TimeBlock } from './types.js';

export interface ContextSplitOptions {
  /**
   * Consecutive signals a new subject must sustain before it counts as a real
   * context switch. At the default of 2, one stray file opened mid-fieldwork is
   * absorbed rather than carving a spurious row out of the day.
   */
  minRunSignals?: number;
  /**
   * Duration above which a run survives regardless of how few signals it has.
   *
   * Signal *count* alone is the wrong test: a single 45-minute call for another
   * client is one signal and the most important context switch of the day, while
   * three files opened in ninety seconds are noise. Anything at or above this
   * length is treated as a real switch.
   */
  minRunSeconds?: number;
}

/** A maximal run of consecutive signals sharing one engagement label. */
interface Run {
  label: string | undefined;
  signals: ActivitySignal[];
}

const DEFAULT_MIN_RUN_SIGNALS = 2;
const DEFAULT_MIN_RUN_SECONDS = 600;

/**
 * Splits time-contiguous blocks where the *subject* of the work changes.
 *
 * Segmentation alone answers "was this person working?". It cannot answer "on
 * what?", and conflating the two is the failure mode that makes automatic
 * timesheets untrustworthy: a four-hour afternoon with one 45-minute call for a
 * different client in the middle gets attributed wholesale to whichever
 * engagement produced the most files. The client who was billed for the other
 * 45 minutes is the one who notices.
 *
 * So this pass re-cuts each block at points where consecutive signals switch
 * engagement and hold the switch. Two properties matter:
 *
 * - **No time is created or destroyed.** A boundary is placed at the midpoint of
 *   the transition, so the sub-blocks tile the parent block exactly.
 * - **Blocks that genuinely have no dominant subject survive intact**, and go on
 *   to be scored as low-confidence — visible to the reviewer rather than
 *   silently resolved.
 */
export class ContextSplitter {
  private readonly minRunSignals: number;
  private readonly minRunMs: number;

  constructor(
    private readonly engine: AttributionEngine,
    options: ContextSplitOptions = {},
  ) {
    this.minRunSignals = options.minRunSignals ?? DEFAULT_MIN_RUN_SIGNALS;
    this.minRunMs = (options.minRunSeconds ?? DEFAULT_MIN_RUN_SECONDS) * 1000;
  }

  /** Split every block, then re-id the result sequentially. */
  split(blocks: TimeBlock[]): TimeBlock[] {
    return blocks
      .flatMap(block => this.splitOne(block))
      .map((block, i) => ({ ...block, id: `blk-${String(i).padStart(4, '0')}` }));
  }

  private splitOne(block: TimeBlock): TimeBlock[] {
    const runs = coalesce(this.absorbShortRuns(this.toRuns(block.signals)));
    if (runs.length <= 1) {
      return [block];
    }

    // Boundaries sit at the midpoint between the last signal of one run and the
    // first of the next, so the sub-blocks tile [startedAt, endedAt) exactly.
    const cuts: number[] = [];
    for (let i = 1; i < runs.length; i++) {
      const previous = runs[i - 1].signals[runs[i - 1].signals.length - 1];
      const next = runs[i].signals[0];
      const previousEnd = Math.max(previous.endedAt, previous.startedAt);
      cuts.push(Math.round((previousEnd + next.startedAt) / 2));
    }

    const bounds = [block.startedAt, ...cuts, block.endedAt];
    return runs.map((run, i) => {
      const startedAt = bounds[i];
      const endedAt = bounds[i + 1];
      return {
        id: block.id,
        startedAt,
        endedAt,
        focusSeconds: (endedAt - startedAt) / 1000,
        signals: run.signals,
        peakSignalsPerWindow: run.signals.length,
        flowExtended: block.flowExtended,
      };
    });
  }

  private toRuns(signals: ActivitySignal[]): Run[] {
    const ordered = [...signals].sort((a, b) => a.startedAt - b.startedAt);
    const runs: Run[] = [];

    for (const signal of ordered) {
      const label = this.engine.labelSignal(signal);
      const current = runs[runs.length - 1];
      if (current && current.label === label) {
        current.signals.push(signal);
      } else {
        runs.push({ label, signals: [signal] });
      }
    }

    return runs;
  }

  /**
   * Fold runs below the minimum length into their neighbour, so brief detours do
   * not fragment the day.
   *
   * A short run is merged into whichever adjacent run is longer — merging into
   * the *previous* run unconditionally would let a single trailing signal
   * decide the label of the run that follows it.
   */
  private absorbShortRuns(runs: Run[]): Run[] {
    if (runs.length <= 1) {
      return runs;
    }

    const out: Run[] = [];
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      const isShort = run.signals.length < this.minRunSignals && runSpan(run) < this.minRunMs;
      const previous = out[out.length - 1];
      const next = runs[i + 1];

      if (!isShort || (!previous && !next)) {
        out.push({ label: run.label, signals: [...run.signals] });
        continue;
      }

      const mergeForward =
        !previous || (next !== undefined && next.signals.length > previous.signals.length);
      if (mergeForward && next) {
        next.signals = [...run.signals, ...next.signals];
      } else if (previous) {
        previous.signals.push(...run.signals);
      } else {
        out.push({ label: run.label, signals: [...run.signals] });
      }
    }

    return out.length > 0 ? out : runs;
  }
}

/**
 * Merge neighbouring runs that ended up with the same label.
 *
 * Absorbing a short detour leaves the runs on either side of it separated by
 * nothing but the seam where the detour used to be. Splitting there would put
 * two rows on the timesheet for one unbroken stretch of the same work.
 */
function coalesce(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const run of runs) {
    const previous = out[out.length - 1];
    if (previous && previous.label === run.label) {
      previous.signals.push(...run.signals);
    } else {
      out.push({ label: run.label, signals: [...run.signals] });
    }
  }
  return out;
}

/** Wall-clock span a run covers, in milliseconds. */
function runSpan(run: Run): number {
  const starts = run.signals.map(s => s.startedAt);
  const ends = run.signals.map(s => Math.max(s.endedAt, s.startedAt));
  return Math.max(...ends) - Math.min(...starts);
}
