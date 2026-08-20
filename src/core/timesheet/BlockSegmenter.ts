import type { ActivitySignal, TimeBlock, TimesheetPolicy } from './types.js';

/** A signal paired with the interval the segmenter actually credits for it. */
interface EffectiveSignal {
  signal: ActivitySignal;
  start: number;
  end: number;
}

/**
 * Turns a scattered stream of activity signals into contiguous work blocks.
 *
 * This is the generalisation of DevValue's PTA flow detection. The insight
 * transfers unchanged: a knowledge worker who is reading a client file, then
 * checking a control matrix, then flipping back to an email is *working*, even
 * though nothing is being typed. So the tolerated gap between two signals is
 * not fixed — once signal density crosses `flowThreshold`, the idle budget is
 * multiplied (15 min → 30 min for cloud signals) instead of the clock stopping.
 *
 * What does *not* transfer is the calibration. Both the idle budget and the
 * density window scale with the cadence of the source, so they live in the
 * policy rather than in constants here — see `TimesheetPolicy`.
 *
 * Two properties are deliberate:
 *
 * 1. **Every gap inside a block was explicitly credited.** A block's focus time
 *    is therefore exactly `endedAt − startedAt`, with no separate accumulator
 *    that could drift from the block's own span.
 * 2. **Point-in-time signals get a bounded credit, not zero and not a guess.**
 *    A sent mail is real work; `pointSignalCreditSeconds` says how much, once,
 *    at firm level.
 *
 * All timestamps are Unix milliseconds.
 */
export class BlockSegmenter {
  private readonly idleBudgetMs: number;
  private readonly flowBudgetMs: number;
  private readonly pointCreditMs: number;
  private readonly rateWindowMs: number;

  constructor(private readonly policy: TimesheetPolicy) {
    this.idleBudgetMs = policy.idleBudgetSeconds * 1000;
    this.flowBudgetMs = policy.idleBudgetSeconds * 1000 * policy.flowMultiplier;
    this.pointCreditMs = policy.pointSignalCreditSeconds * 1000;
    this.rateWindowMs = policy.rateWindowSeconds * 1000;
  }

  /**
   * Segment signals into blocks. Input order does not matter; signals are sorted
   * internally and de-duplicated by id (re-syncs are safe to replay).
   */
  segment(signals: ActivitySignal[]): TimeBlock[] {
    const effective = this.toEffective(signals);
    if (effective.length === 0) {
      return [];
    }

    const blocks: TimeBlock[] = [];
    let current = this.openBlock(effective[0], blocks.length);

    for (let i = 1; i < effective.length; i++) {
      const next = effective[i];
      const gap = Math.max(0, next.start - current.endedAt);
      const rate = this.rateAt(current, current.endedAt);
      const inFlow = rate >= this.policy.flowThreshold;
      const budget = inFlow ? this.flowBudgetMs : this.idleBudgetMs;

      if (gap > budget) {
        blocks.push(this.closeBlock(current));
        current = this.openBlock(next, blocks.length);
        continue;
      }

      // The gap is credited: the block simply keeps running through it.
      if (gap > this.idleBudgetMs) {
        current.flowExtended = true;
      }
      current.signals.push(next.signal);
      current.endedAt = Math.max(current.endedAt, next.end);
      current.peakSignalsPerWindow = Math.max(
        current.peakSignalsPerWindow,
        this.rateAt(current, next.start),
      );
    }

    blocks.push(this.closeBlock(current));
    return blocks;
  }

  /**
   * Resolve each signal to the interval the engine credits for it.
   *
   * Authoritative durations (an attended call) are trusted verbatim — never
   * padded. Point-in-time signals are widened to the policy credit. Anything
   * reporting an end before its start is treated as a point signal.
   */
  private toEffective(signals: ActivitySignal[]): EffectiveSignal[] {
    const seen = new Set<string>();
    const out: EffectiveSignal[] = [];

    for (const signal of signals) {
      if (seen.has(signal.id)) {
        continue;
      }
      seen.add(signal.id);

      const reported = signal.endedAt - signal.startedAt;
      const duration =
        reported > 0
          ? signal.authoritativeDuration
            ? reported
            : Math.max(reported, this.pointCreditMs)
          : this.pointCreditMs;

      out.push({
        signal,
        start: signal.startedAt,
        end: signal.startedAt + duration,
      });
    }

    return out.sort((a, b) => a.start - b.start || a.end - b.end);
  }

  private openBlock(first: EffectiveSignal, index: number): TimeBlock {
    return {
      id: `blk-${String(index).padStart(4, '0')}`,
      startedAt: first.start,
      endedAt: first.end,
      focusSeconds: 0,
      signals: [first.signal],
      peakSignalsPerWindow: 1,
      flowExtended: false,
    };
  }

  /** Finalise focus time. Every internal gap was credited, so the span is exact. */
  private closeBlock(block: TimeBlock): TimeBlock {
    block.focusSeconds = (block.endedAt - block.startedAt) / 1000;
    return block;
  }

  /** Signals in the block whose start falls in the rate window ending at `at`. */
  private rateAt(block: TimeBlock, at: number): number {
    const cutoff = at - this.rateWindowMs;
    let count = 0;
    for (const signal of block.signals) {
      if (signal.startedAt > cutoff && signal.startedAt <= at) {
        count++;
      }
    }
    return count;
  }
}
