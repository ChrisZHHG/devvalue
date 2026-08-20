/**
 * Auto-Timesheet core — domain types.
 *
 * Pure TypeScript. No `vscode`, no Node, no network. The same engine runs in a
 * VS Code webview, a CLI, an Azure Function, or a browser demo page.
 *
 * The model has exactly one job: turn *observable traces of work* into
 * *defensible timesheet lines*. Every type below exists to keep the chain
 * signal → block → attribution → line auditable end to end.
 */

/**
 * Where a signal came from.
 *
 * Adding a source must never require touching the engine — connectors normalise
 * into {@link ActivitySignal} and the engine stays source-agnostic. This mirrors
 * the ITokenSniffer swap-point used on the DevValue side.
 */
export type SignalSource =
  /** Outlook / Google calendar entry — an *intention* to spend time. */
  | 'calendar'
  /** Teams / Zoom call record — *actual* attendance, with a real duration. */
  | 'meeting'
  /** SharePoint / OneDrive file open, edit or download. */
  | 'document'
  /** Mail sent or read. */
  | 'mail'
  /** Teams / Slack thread participation. */
  | 'chat'
  /** Jira / ServiceNow / Azure DevOps work-item transition. */
  | 'ticket'
  /** Git commit, PR review, IDE focus — the DevValue bridge. */
  | 'code'
  /** AI agent turn (Claude Code, Copilot) — the DevValue bridge. */
  | 'agent'
  /** Optional local focus-window agent. Off by default; see PRIVACY.md. */
  | 'desktop';

/** Confidence in an attribution. Drives the review UI, never hidden from the user. */
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unattributed';

/**
 * One normalised trace of work.
 *
 * Connectors are responsible for producing these and nothing else. A signal
 * carries *metadata only* — never document contents, never message bodies.
 */
export interface ActivitySignal {
  /** Stable id from the source system; used for dedup across re-syncs. */
  id: string;
  source: SignalSource;
  /** Unix milliseconds. */
  startedAt: number;
  /**
   * Unix milliseconds. Equal to {@link startedAt} for point-in-time signals
   * (a mail send, a commit) — the segmenter credits those a policy-defined
   * minimum instead of zero.
   */
  endedAt: number;
  /**
   * true when the source reports a real elapsed duration (an attended Teams
   * call). Authoritative durations are trusted as-is and never inflated.
   */
  authoritativeDuration: boolean;
  /** Meeting title, file name, ticket key — shown verbatim as evidence. */
  subject: string;
  /**
   * Hierarchical locator: SharePoint path, mailbox folder, repo/branch, ticket
   * project. The single most predictive feature for attribution, because
   * engagement work already lives in per-engagement folders.
   */
  path?: string;
  /** External counterparty domains — the strongest client-identity signal. */
  participantDomains?: string[];
  /** Deep link to the source record, so a reviewer can verify any line. */
  evidenceUrl?: string;
  /**
   * Effort weight, 0..n. An edit outweighs a passive open; a 12-person all-hands
   * outweighs a 1:1 for calendar load but not for effort. Default 1.
   */
  intensity: number;
}

/** How an observable feature binds to an engagement. */
export interface EngagementMatcher {
  kind: 'path' | 'domain' | 'keyword' | 'ticketProject' | 'repo' | 'attendee';
  /** Compared case-insensitively as a substring of the corresponding field. */
  value: string;
  /** Score contributed on match, 0..1. Learned matchers carry higher weights. */
  weight: number;
  /** Set when the matcher was derived from a user correction rather than setup. */
  learned?: boolean;
}

/** A billing target: engagement code, project code, WBS element, matter number. */
export interface Engagement {
  /** The code the firm's time system expects, verbatim. */
  code: string;
  name: string;
  clientName: string;
  /** false for internal/non-chargeable buckets (training, admin, business dev). */
  chargeable: boolean;
  matchers: EngagementMatcher[];
}

/** A contiguous stretch of work, gaps beyond the idle budget already removed. */
export interface TimeBlock {
  id: string;
  /** Unix milliseconds. */
  startedAt: number;
  /** Unix milliseconds. */
  endedAt: number;
  /** Seconds credited as focused work. */
  focusSeconds: number;
  signals: ActivitySignal[];
  /** Peak signal count inside one rate window — the flow indicator. */
  peakSignalsPerWindow: number;
  /** true when the block was ever held open by the flow-extended idle budget. */
  flowExtended: boolean;
}

/** One matcher hit, retained so every timesheet line can be traced to a record. */
export interface MatchedEvidence {
  signalId: string;
  source: SignalSource;
  subject: string;
  matcherKind: EngagementMatcher['kind'];
  matcherValue: string;
  evidenceUrl?: string;
}

/** An engagement that could explain a block, with its supporting evidence. */
export interface AttributionCandidate {
  engagementCode: string;
  /** Normalised 0..1 across all candidates for the block. */
  score: number;
  evidence: MatchedEvidence[];
}

/** A block plus the engine's explanation of who should be billed for it. */
export interface AttributedBlock extends TimeBlock {
  engagementCode: string;
  /**
   * The leading candidate, retained even when it was rejected for lacking
   * authoritative evidence — a rejected lead is still the best starting point
   * for the reviewer.
   */
  best?: AttributionCandidate;
  runnerUp?: AttributionCandidate;
  /** best.score − runnerUp.score. The actual reason for the confidence label. */
  margin: number;
  /**
   * true when the leading candidate is supported by at least one authoritative
   * locator (folder, counterparty domain, repository, ticket project) rather
   * than by subject-line keywords alone. False forces `unattributed`.
   */
  hasAuthoritativeEvidence: boolean;
  confidence: ConfidenceLevel;
}

/** One row of the drafted timesheet — the unit the user accepts or edits. */
export interface TimesheetLine {
  engagementCode: string;
  engagementName: string;
  clientName: string;
  chargeable: boolean;
  /** ISO calendar date, 'YYYY-MM-DD', in the policy's time zone. */
  date: string;
  /** Hours after rounding policy. This is what gets submitted. */
  hours: number;
  /** Hours before rounding. Kept so the rounding delta is always inspectable. */
  rawHours: number;
  confidence: ConfidenceLevel;
  /** Auto-drafted description, grounded strictly in {@link evidence}. */
  narrative: string;
  evidence: MatchedEvidence[];
  blockIds: string[];
  /** Set when sub-threshold slivers were pooled into this line. */
  pooledFromCodes?: string[];
}

/** Per-day reconciliation, so unexplained time is surfaced rather than hidden. */
export interface DayCoverage {
  date: string;
  /** Hours the engine could attribute. */
  attributedHours: number;
  /** Hours observed but not attributable to any engagement. */
  unattributedHours: number;
  /** standardDayHours − (attributed + unattributed). Positive = missing time. */
  unaccountedHours: number;
}

/** The complete draft handed to the reviewer. */
export interface TimesheetDraft {
  /** ISO date of the Monday of the week. */
  weekStart: string;
  lines: TimesheetLine[];
  coverage: DayCoverage[];
  totalHours: number;
  chargeableHours: number;
  /** Share of total hours that landed on a high-confidence line, 0..1. */
  autoAcceptRatio: number;
}

/**
 * Firm-level policy. Deliberately *not* per-user: the whole thesis is that this
 * is a top-level integration, configured once per firm, not tuned per employee.
 */
export interface TimesheetPolicy {
  /** Rounding increment in hours. 0.25 = quarter hour, the professional norm. */
  roundingIncrement: number;
  /** Lines below this are pooled into the day's largest line. */
  minLineHours: number;
  /**
   * Base tolerated gap between two signals before the clock stops, seconds.
   *
   * This must be calibrated to the *cadence of the source*, which is the main
   * thing that changes when the same engine is pointed at a different signal
   * mix. IDE telemetry arrives seconds apart, so DevValue uses 300 s. Microsoft
   * 365 signals arrive minutes apart — a file save, then a reply, then a
   * document opened — so a 300 s budget would shred a genuine hour of work into
   * a dozen fragments. The cloud default is 600 s, extended to 1200 s under
   * sustained density, which spans the ordinary 6–13 minute lull between traces
   * without ever reaching across a lunch break.
   */
  idleBudgetSeconds: number;
  /** Length of the window used to measure signal density, seconds. */
  rateWindowSeconds: number;
  /** Signals within one rate window that count as sustained focus. */
  flowThreshold: number;
  /**
   * Idle budget multiplier while in flow. Kept deliberately low for cloud
   * signals (10 min → 20 min): anything larger starts bridging lunch.
   */
  flowMultiplier: number;
  /** Credit given to a point-in-time signal, seconds. */
  pointSignalCreditSeconds: number;
  /** Expected working day, used only for the coverage reconciliation. */
  standardDayHours: number;
  /** Code assigned when nothing matches. Never silently dropped. */
  unattributedCode: string;
  /** IANA zone used to bucket signals into calendar days. */
  timeZone: string;
}

export const DEFAULT_POLICY: TimesheetPolicy = {
  roundingIncrement: 0.25,
  minLineHours: 0.25,
  idleBudgetSeconds: 600,
  rateWindowSeconds: 900,
  flowThreshold: 3,
  flowMultiplier: 2,
  pointSignalCreditSeconds: 120,
  standardDayHours: 8,
  unattributedCode: 'UNASSIGNED',
  timeZone: 'UTC',
};

/**
 * Swap-point for signal ingestion.
 *
 * The prototype ships a synthetic connector. Production implementations wrap
 * Microsoft Graph (calendar, call records, drive activity), the Office 365
 * Management Activity API, Jira, or a local desktop agent — without the engine
 * knowing which.
 */
export interface ISignalConnector {
  readonly source: SignalSource;
  /** Stable identifier for provenance and per-connector consent tracking. */
  readonly id: string;
  /** Fetch normalised signals for a half-open range [from, to) in Unix ms. */
  fetch(range: { from: number; to: number }): Promise<ActivitySignal[]>;
}
