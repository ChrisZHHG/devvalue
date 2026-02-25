import type { CostBreakdown, Session, TokenUsage } from './types.js';

/**
 * Computes cost breakdowns from developer focus time and AI token usage.
 *
 * Background token usage (context compaction, summarisation) is excluded from
 * cost totals by default — only direct user-initiated turns are counted.
 * Pass `includeBackground: true` to override this behaviour.
 */
export class CostCalculator {
  constructor(private readonly hourlyRate: number) {}

  /**
   * Calculate a cost breakdown from raw focus time and token usage records.
   *
   * @param focusSeconds      Active developer seconds (idle gaps already excluded).
   * @param tokenUsages       Token usage records to sum.
   * @param includeBackground Include compaction/summarisation costs. Default false.
   */
  breakdown(
    focusSeconds: number,
    tokenUsages: TokenUsage[],
    includeBackground = false,
  ): CostBreakdown {
    const filtered = includeBackground
      ? tokenUsages
      : tokenUsages.filter(t => !t.isBackground);

    const focusHours = focusSeconds / 3600;
    const humanCostUsd = focusHours * this.hourlyRate;
    const aiCostUsd = filtered.reduce((sum, t) => sum + t.costUsd, 0);

    return {
      humanCostUsd,
      aiCostUsd,
      totalCostUsd: humanCostUsd + aiCostUsd,
      focusHours,
    };
  }

  /** Convenience wrapper: compute the breakdown for a single session. */
  sessionBreakdown(session: Session, includeBackground = false): CostBreakdown {
    return this.breakdown(session.focusSeconds, session.tokenUsage, includeBackground);
  }

  /**
   * Aggregate all sessions for a branch into a single cost breakdown.
   * Sessions are summed; token usage records are concatenated before filtering.
   */
  branchBreakdown(sessions: Session[], includeBackground = false): CostBreakdown {
    const totalFocusSeconds = sessions.reduce((s, sess) => s + sess.focusSeconds, 0);
    const allTokenUsages = sessions.flatMap(sess => sess.tokenUsage);
    return this.breakdown(totalFocusSeconds, allTokenUsages, includeBackground);
  }
}
