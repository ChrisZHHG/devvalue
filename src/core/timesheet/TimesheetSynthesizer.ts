import type {
  AttributedBlock,
  ConfidenceLevel,
  DayCoverage,
  Engagement,
  MatchedEvidence,
  SignalSource,
  TimesheetDraft,
  TimesheetLine,
  TimesheetPolicy,
} from './types.js';

/** Weighted share of at-least-medium hours required for a `medium` line. */
const LINE_MEDIUM_SHARE = 0.4;

/** One (date, engagement) bucket before rounding. */
interface Bucket {
  date: string;
  engagementCode: string;
  rawHours: number;
  blocks: AttributedBlock[];
}

/**
 * Turns attributed blocks into the rows a reviewer accepts.
 *
 * Three rules here exist because of how timesheets are actually policed, not
 * because of how the data arrives:
 *
 * - **Rounding must not create or destroy hours.** Rounding each row
 *   independently to the quarter hour makes a day of 7.9h submit as 8.25h. So
 *   rounding is done per day by largest remainder: rows move, the day's total
 *   does not.
 * - **Slivers pool sideways, never across the chargeable line.** A 6-minute
 *   fragment is folded into the day's largest row *of the same chargeability*.
 *   Folding non-chargeable minutes into a client's bill is exactly the
 *   defect an engagement-economics reviewer is looking for.
 * - **Unattributed time is a first-class row.** It is never absorbed into a
 *   confident row to make the week look clean; an unexplained hour is
 *   information the reviewer needs.
 */
export class TimesheetSynthesizer {
  private readonly byCode: Map<string, Engagement>;

  constructor(
    engagements: Engagement[],
    private readonly policy: TimesheetPolicy,
  ) {
    this.byCode = new Map(engagements.map(e => [e.code, e]));
  }

  synthesize(blocks: AttributedBlock[]): TimesheetDraft {
    const buckets = this.bucket(blocks);
    const byDate = groupBy(buckets, b => b.date);

    let lines: TimesheetLine[] = [];
    for (const [, dayBuckets] of byDate) {
      lines = lines.concat(this.buildDay(dayBuckets));
    }
    lines.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        b.hours - a.hours ||
        a.engagementCode.localeCompare(b.engagementCode),
    );

    const totalHours = round2(lines.reduce((s, l) => s + l.hours, 0));
    const chargeableHours = round2(
      lines.filter(l => l.chargeable).reduce((s, l) => s + l.hours, 0),
    );
    const highHours = lines
      .filter(l => l.confidence === 'high')
      .reduce((s, l) => s + l.hours, 0);

    return {
      weekStart: mondayOf(lines[0]?.date ?? isoDate(Date.now(), this.policy.timeZone)),
      lines,
      coverage: this.coverage(lines),
      totalHours,
      chargeableHours,
      autoAcceptRatio: totalHours > 0 ? round2(highHours / totalHours) : 0,
    };
  }

  /** Collapse blocks into (date, engagement) buckets. Blocks bucket by start. */
  private bucket(blocks: AttributedBlock[]): Bucket[] {
    const map = new Map<string, Bucket>();
    for (const block of blocks) {
      const date = isoDate(block.startedAt, this.policy.timeZone);
      const key = `${date}|${block.engagementCode}`;
      const bucket =
        map.get(key) ?? { date, engagementCode: block.engagementCode, rawHours: 0, blocks: [] };
      bucket.rawHours += block.focusSeconds / 3600;
      bucket.blocks.push(block);
      map.set(key, bucket);
    }
    return [...map.values()];
  }

  /** Round one day's buckets by largest remainder, then pool the slivers. */
  private buildDay(buckets: Bucket[]): TimesheetLine[] {
    const increment = this.policy.roundingIncrement;
    const dayRaw = buckets.reduce((s, b) => s + b.rawHours, 0);
    const targetUnits = Math.round(dayRaw / increment);

    const allocations = buckets.map(bucket => ({
      bucket,
      units: Math.floor(bucket.rawHours / increment),
      remainder: (bucket.rawHours / increment) % 1,
    }));

    let leftover = targetUnits - allocations.reduce((s, a) => s + a.units, 0);
    const byRemainder = [...allocations].sort(
      (a, b) =>
        b.remainder - a.remainder ||
        b.bucket.rawHours - a.bucket.rawHours ||
        a.bucket.engagementCode.localeCompare(b.bucket.engagementCode),
    );
    for (let i = 0; leftover > 0 && byRemainder.length > 0; i++, leftover--) {
      byRemainder[i % byRemainder.length].units += 1;
    }

    const lines = allocations
      .filter(a => a.units > 0)
      .map(a => this.toLine(a.bucket, a.units * increment));
    return this.pool(lines);
  }

  /**
   * Fold sub-threshold rows into the day's largest row of the same
   * chargeability. Unattributed rows never participate in either direction.
   */
  private pool(lines: TimesheetLine[]): TimesheetLine[] {
    const eligible = (l: TimesheetLine) => l.engagementCode !== this.policy.unattributedCode;
    const slivers = lines.filter(l => eligible(l) && l.hours < this.policy.minLineHours);
    if (slivers.length === 0) {
      return lines;
    }

    const kept = lines.filter(l => !slivers.includes(l));
    for (const sliver of slivers) {
      const target = kept
        .filter(l => eligible(l) && l.chargeable === sliver.chargeable)
        .sort((a, b) => b.hours - a.hours)[0];
      if (!target) {
        kept.push(sliver);
        continue;
      }
      target.hours = round2(target.hours + sliver.hours);
      target.rawHours = round2(target.rawHours + sliver.rawHours);
      target.evidence = target.evidence.concat(sliver.evidence);
      target.blockIds = target.blockIds.concat(sliver.blockIds);
      target.pooledFromCodes = (target.pooledFromCodes ?? []).concat(sliver.engagementCode);
    }
    return kept;
  }

  private toLine(bucket: Bucket, hours: number): TimesheetLine {
    const engagement = this.byCode.get(bucket.engagementCode);
    const evidence = bucket.blocks.flatMap(b => b.best?.evidence ?? []);
    return {
      engagementCode: bucket.engagementCode,
      engagementName: engagement?.name ?? 'Unassigned time',
      clientName: engagement?.clientName ?? '—',
      chargeable: engagement?.chargeable ?? false,
      date: bucket.date,
      hours: round2(hours),
      rawHours: round2(bucket.rawHours),
      confidence: this.lineConfidence(bucket),
      narrative: narrate(bucket.blocks, evidence),
      evidence: dedupeEvidence(evidence),
      blockIds: bucket.blocks.map(b => b.id),
    };
  }

  /**
   * A line is only as trustworthy as its weakest hour.
   *
   * `high` requires *every* block behind the row to be high — a share-based
   * threshold would let three confident hours vouch for a fourth the engine
   * itself flagged, which is precisely the hour a reviewer needed to look at.
   * Below that, the mix decides.
   */
  private lineConfidence(bucket: Bucket): ConfidenceLevel {
    if (bucket.engagementCode === this.policy.unattributedCode) {
      return 'unattributed';
    }
    if (bucket.blocks.every(b => b.confidence === 'high')) {
      return 'high';
    }
    const total = bucket.blocks.reduce((s, b) => s + b.focusSeconds, 0);
    if (total === 0) {
      return 'low';
    }
    const mediumOrBetter =
      bucket.blocks
        .filter(b => b.confidence === 'high' || b.confidence === 'medium')
        .reduce((s, b) => s + b.focusSeconds, 0) / total;

    return mediumOrBetter >= LINE_MEDIUM_SHARE ? 'medium' : 'low';
  }

  /** Per-day reconciliation against the standard working day. */
  private coverage(lines: TimesheetLine[]): DayCoverage[] {
    const byDate = groupBy(lines, l => l.date);
    return [...byDate.entries()]
      .map(([date, dayLines]) => {
        const unattributedHours = round2(
          dayLines
            .filter(l => l.engagementCode === this.policy.unattributedCode)
            .reduce((s, l) => s + l.hours, 0),
        );
        const attributedHours = round2(
          dayLines
            .filter(l => l.engagementCode !== this.policy.unattributedCode)
            .reduce((s, l) => s + l.hours, 0),
        );
        return {
          date,
          attributedHours,
          unattributedHours,
          // Signed on purpose: negative means the day ran long, which the
          // reviewer also needs to see.
          unaccountedHours: round2(
            this.policy.standardDayHours - attributedHours - unattributedHours,
          ),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

/**
 * Draft a description from evidence alone.
 *
 * Deliberately templated rather than generated: in the prototype every word is
 * traceable to a counted record. A production build swaps this for an LLM that
 * is handed the same evidence array and forbidden from adding facts — the
 * grounding contract stays identical.
 */
function narrate(blocks: AttributedBlock[], evidence: MatchedEvidence[]): string {
  const counts = new Map<SignalSource, number>();
  for (const block of blocks) {
    for (const signal of block.signals) {
      counts.set(signal.source, (counts.get(signal.source) ?? 0) + 1);
    }
  }

  const label: Record<SignalSource, [string, string]> = {
    meeting: ['meeting', 'meetings'],
    calendar: ['scheduled block', 'scheduled blocks'],
    document: ['document', 'documents'],
    mail: ['email', 'emails'],
    chat: ['chat thread', 'chat threads'],
    ticket: ['ticket update', 'ticket updates'],
    code: ['code change', 'code changes'],
    agent: ['AI agent session', 'AI agent sessions'],
    desktop: ['application window', 'application windows'],
  };

  const order: SignalSource[] = [
    'meeting',
    'document',
    'ticket',
    'code',
    'agent',
    'mail',
    'chat',
    'calendar',
    'desktop',
  ];
  const parts = order
    .filter(source => (counts.get(source) ?? 0) > 0)
    .map(source => {
      const n = counts.get(source) as number;
      return `${n} ${label[source][n === 1 ? 0 : 1]}`;
    });

  const topic = evidence.find(e => e.matcherKind === 'keyword')?.subject ?? evidence[0]?.subject;
  const head = topic ? `${topic} — ` : '';
  return `${head}${parts.join(', ')}`;
}

/** One row per (signal, matcher kind); the same file matched twice is not proof twice. */
function dedupeEvidence(evidence: MatchedEvidence[]): MatchedEvidence[] {
  const seen = new Set<string>();
  return evidence.filter(e => {
    const key = `${e.signalId}|${e.matcherKind}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) {
      list.push(item);
    } else {
      map.set(k, [item]);
    }
  }
  return map;
}

/** 'YYYY-MM-DD' for a Unix-ms instant in the given IANA zone. */
export function isoDate(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

/** The Monday on or before an ISO date. */
export function mondayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const shift = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - shift);
  return utc.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
