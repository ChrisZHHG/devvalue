import type {
  ActivitySignal,
  AttributedBlock,
  AttributionCandidate,
  ConfidenceLevel,
  Engagement,
  EngagementMatcher,
  MatchedEvidence,
  TimeBlock,
  TimesheetPolicy,
} from './types.js';

/** Score/margin gates that turn a ranking into a confidence label. */
export interface ConfidenceThresholds {
  /** Minimum normalised score for `high`. */
  highScore: number;
  /** Minimum lead over the runner-up for `high`. */
  highMargin: number;
  /** Minimum normalised score for `medium`. */
  mediumScore: number;
  /** Minimum lead over the runner-up for `medium`. */
  mediumMargin: number;
}

export const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
  highScore: 0.6,
  highMargin: 0.3,
  mediumScore: 0.4,
  mediumMargin: 0.12,
};

export interface AttributionOptions {
  thresholds?: ConfidenceThresholds;
  /**
   * The firm's own mail domains plus consumer providers. Excluded when learning
   * domain matchers, since "someone from my own firm was there" identifies
   * nothing.
   */
  internalDomains?: string[];
}

/**
 * Matcher kinds that constitute authority to bill.
 *
 * A folder, a counterparty's mail domain, a repository or a ticket project are
 * *locators*: they place the work inside an engagement. A word in a subject line
 * is a hint, and hints collide — two engagements in the same practice both
 * produce documents with "ITGC" in the title, and a firm that has just opened a
 * third has no matchers configured for it at all. Letting a keyword win on its
 * own is how an automatic timesheet bills the wrong client with high confidence,
 * which is the one failure this system cannot afford.
 */
const AUTHORITATIVE_KINDS: ReadonlySet<EngagementMatcher['kind']> = new Set([
  'path',
  'domain',
  'repo',
  'ticketProject',
  'attendee',
]);

/** How many leading path segments a learned path matcher keeps. */
const LEARNED_PATH_DEPTH = 2;

/** Weights assigned to matchers derived from a user correction. */
const LEARNED_PATH_WEIGHT = 0.9;
const LEARNED_DOMAIN_WEIGHT = 0.7;

/**
 * Decides which engagement a block of work belongs to, and says why.
 *
 * The design constraint that shapes everything here: a professional-services
 * timesheet is a **billing assertion**. A number nobody can trace is worse than
 * no number, because it will be challenged by a client, a reviewer, or a
 * regulator. So the engine never returns a bare code — it returns the winning
 * engagement, the runner-up it beat, the margin between them, and the individual
 * source records behind each. The confidence label is a *derived* fact about
 * that margin, not a vibe.
 *
 * Scoring is intentionally simple and inspectable: matcher weight × signal
 * intensity × the signal's share of the block's duration, summed per engagement
 * and normalised. A learned model can replace the scorer later; it cannot
 * replace the evidence chain, which is the actual product.
 */
export class AttributionEngine {
  private readonly thresholds: ConfidenceThresholds;
  private readonly internalDomains: string[];

  constructor(
    private readonly engagements: Engagement[],
    private readonly policy: TimesheetPolicy,
    options: AttributionOptions = {},
  ) {
    this.thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;
    this.internalDomains = (options.internalDomains ?? []).map(d => d.toLowerCase());
  }

  /** Attribute every block, preserving input order. */
  attributeAll(blocks: TimeBlock[]): AttributedBlock[] {
    return blocks.map(block => this.attribute(block));
  }

  /** Attribute a single block. */
  attribute(block: TimeBlock): AttributedBlock {
    const weights = this.signalWeights(block);
    const raw = new Map<string, { score: number; evidence: MatchedEvidence[] }>();

    for (const signal of block.signals) {
      const share = weights.get(signal.id) ?? 0;
      for (const engagement of this.engagements) {
        for (const matcher of engagement.matchers) {
          if (!matches(signal, matcher)) {
            continue;
          }
          const entry = raw.get(engagement.code) ?? { score: 0, evidence: [] };
          entry.score += matcher.weight * Math.max(signal.intensity, 0) * share;
          entry.evidence.push({
            signalId: signal.id,
            source: signal.source,
            subject: signal.subject,
            matcherKind: matcher.kind,
            matcherValue: matcher.value,
            evidenceUrl: signal.evidenceUrl,
          });
          raw.set(engagement.code, entry);
        }
      }
    }

    const total = [...raw.values()].reduce((sum, e) => sum + e.score, 0);
    const ranked: AttributionCandidate[] = [...raw.entries()]
      .map(([engagementCode, entry]) => ({
        engagementCode,
        score: total > 0 ? entry.score / total : 0,
        evidence: entry.evidence,
      }))
      .sort((a, b) => b.score - a.score || a.engagementCode.localeCompare(b.engagementCode));

    const best = ranked[0];
    const runnerUp = ranked[1];
    const margin = best ? best.score - (runnerUp?.score ?? 0) : 0;
    const hasAuthoritativeEvidence =
      best?.evidence.some(e => AUTHORITATIVE_KINDS.has(e.matcherKind)) ?? false;

    return {
      ...block,
      // A lead without authority is reported as a suggestion, not billed. The
      // reviewer sees the candidate and the reason it was held back.
      engagementCode:
        best && hasAuthoritativeEvidence ? best.engagementCode : this.policy.unattributedCode,
      best,
      runnerUp,
      margin,
      hasAuthoritativeEvidence,
      confidence: hasAuthoritativeEvidence ? this.confidenceOf(best, margin) : 'unattributed',
    };
  }

  /**
   * The one engagement a signal *unambiguously* belongs to, or undefined.
   *
   * Used by {@link ContextSplitter} to detect a change of subject inside an
   * otherwise contiguous stretch of work. A tie returns undefined rather than
   * resolving arbitrarily: an invitation with two clients on it is precisely the
   * signal that must not be quietly folded into a confident neighbour, and a
   * deterministic-but-arbitrary winner would do exactly that. Left unlabelled,
   * it becomes its own block and gets scored — and flagged — on its own merits.
   */
  labelSignal(signal: ActivitySignal): string | undefined {
    let bestCode: string | undefined;
    let bestScore = 0;
    let tied = false;

    for (const engagement of this.engagements) {
      let score = 0;
      let authoritative = false;
      for (const matcher of engagement.matchers) {
        if (matches(signal, matcher)) {
          score += matcher.weight;
          authoritative = authoritative || AUTHORITATIVE_KINDS.has(matcher.kind);
        }
      }
      // Keyword-only hits do not label a signal: see AUTHORITATIVE_KINDS.
      if (!authoritative || score === 0) {
        continue;
      }
      if (score > bestScore) {
        bestScore = score;
        bestCode = engagement.code;
        tied = false;
      } else if (score === bestScore) {
        tied = true;
      }
    }

    return bestScore > 0 && !tied ? bestCode : undefined;
  }

  /**
   * Derive matchers from a user correction — the mechanism by which review
   * effort compounds instead of repeating.
   *
   * When a reviewer moves a block to the right engagement, the block's own
   * features become evidence for next time: the shared path prefix of its
   * documents and any external counterparty domain. Returned matchers are
   * flagged `learned` so a reviewer can always see (and revoke) what the system
   * inferred versus what the firm configured.
   *
   * Matchers already present on the engagement are not re-emitted.
   */
  learnFromCorrection(block: TimeBlock, engagementCode: string): EngagementMatcher[] {
    const existing = new Set(
      (this.engagements.find(e => e.code === engagementCode)?.matchers ?? []).map(
        m => `${m.kind}:${m.value.toLowerCase()}`,
      ),
    );
    const learned: EngagementMatcher[] = [];
    const push = (matcher: EngagementMatcher) => {
      const key = `${matcher.kind}:${matcher.value.toLowerCase()}`;
      if (existing.has(key)) {
        return;
      }
      existing.add(key);
      learned.push(matcher);
    };

    for (const prefix of dominantPathPrefixes(block.signals)) {
      push({ kind: 'path', value: prefix, weight: LEARNED_PATH_WEIGHT, learned: true });
    }

    for (const domain of externalDomains(block.signals, this.internalDomains)) {
      push({ kind: 'domain', value: domain, weight: LEARNED_DOMAIN_WEIGHT, learned: true });
    }

    return learned;
  }

  /**
   * Each signal's share of the block, by credited duration.
   *
   * A 60-minute client call therefore outweighs a 2-minute mail sent during it,
   * which is what a reviewer would expect. Blocks made only of point signals
   * fall back to equal shares.
   */
  private signalWeights(block: TimeBlock): Map<string, number> {
    const credit = this.policy.pointSignalCreditSeconds * 1000;
    const durations = block.signals.map(s => Math.max(s.endedAt - s.startedAt, credit));
    const sum = durations.reduce((a, b) => a + b, 0);
    const weights = new Map<string, number>();
    block.signals.forEach((signal, i) => {
      weights.set(signal.id, sum > 0 ? durations[i] / sum : 1 / block.signals.length);
    });
    return weights;
  }

  private confidenceOf(
    best: AttributionCandidate | undefined,
    margin: number,
  ): ConfidenceLevel {
    if (!best) {
      return 'unattributed';
    }
    const t = this.thresholds;
    if (best.score >= t.highScore && margin >= t.highMargin) {
      return 'high';
    }
    if (best.score >= t.mediumScore && margin >= t.mediumMargin) {
      return 'medium';
    }
    return 'low';
  }
}

/** Case-insensitive substring test against the field the matcher targets. */
function matches(signal: ActivitySignal, matcher: EngagementMatcher): boolean {
  const needle = matcher.value.toLowerCase();
  switch (matcher.kind) {
    case 'path':
    case 'repo':
      return (signal.path ?? '').toLowerCase().includes(needle);
    case 'keyword':
      return signal.subject.toLowerCase().includes(needle);
    case 'ticketProject':
      return (
        signal.subject.toLowerCase().includes(needle) ||
        (signal.path ?? '').toLowerCase().includes(needle)
      );
    case 'domain':
    case 'attendee':
      return (signal.participantDomains ?? []).some(d => d.toLowerCase().includes(needle));
  }
}

/**
 * Path prefixes shared by at least two of the block's signals, truncated to
 * {@link LEARNED_PATH_DEPTH} segments.
 *
 * Requiring two occurrences is what stops a single stray file from teaching the
 * system a rule it will apply for months.
 */
function dominantPathPrefixes(signals: ActivitySignal[]): string[] {
  const counts = new Map<string, number>();
  for (const signal of signals) {
    const prefix = pathPrefix(signal.path);
    if (prefix) {
      counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([prefix]) => prefix);
}

function pathPrefix(path: string | undefined): string | undefined {
  if (!path) {
    return undefined;
  }
  const segments = path.split('/').filter(Boolean).slice(0, LEARNED_PATH_DEPTH);
  return segments.length > 0 ? `/${segments.join('/')}` : undefined;
}

/**
 * The single external counterparty domain in the block, or none.
 *
 * Learning is refused when a block involves more than one outside party. A call
 * with two clients on it gives no basis for teaching that *either* domain means
 * *this* engagement, and a wrong domain rule is far more damaging than a missing
 * one: it silently misbills every future thread with that counterparty.
 */
function externalDomains(signals: ActivitySignal[], internal: string[]): string[] {
  const found = new Set<string>();
  for (const signal of signals) {
    for (const domain of signal.participantDomains ?? []) {
      const lower = domain.toLowerCase();
      if (!internal.some(i => lower === i || lower.endsWith(`.${i}`))) {
        found.add(lower);
      }
    }
  }
  return found.size === 1 ? [...found] : [];
}
