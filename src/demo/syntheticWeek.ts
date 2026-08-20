/**
 * A synthetic week for a fictional advisory firm, used by the public prototype.
 *
 * Everything here is invented: **Northgate Advisory** is the firm, and Northwind
 * Energy / Halcyon Payments / Meridian Health are its clients. No real firm's or
 * client's data appears in this repository, and none is needed — the point of
 * the demo is that the *shape* of the signals is what a Microsoft 365 tenant
 * already emits for any engagement-based business.
 *
 * The week is written to exercise the cases that decide whether a tool like this
 * survives contact with a real reviewer:
 *
 * - a clean, obviously-attributable engagement day (Tue)
 * - a day split across three engagements with a genuinely ambiguous block (Wed)
 * - AI-agent and git activity billed to an engagement (Thu) — the DevValue bridge
 * - non-chargeable work that must not be folded into a client's bill (Mon, Fri)
 * - work with no attributable trace at all, which must stay visible (Mon, Wed)
 */
import type { ActivitySignal, Engagement, SignalSource, TimesheetPolicy } from '../core/timesheet/types.js';
import { DEFAULT_POLICY } from '../core/timesheet/types.js';

/** Monday 2026-08-17, 00:00 UTC. The demo runs in UTC for reproducibility. */
const WEEK_START_UTC = Date.UTC(2026, 7, 17, 0, 0, 0);
const DAY_MS = 86_400_000;

export const FIRM_DOMAINS = ['northgate-advisory.com'];

export const DEMO_POLICY: TimesheetPolicy = {
  ...DEFAULT_POLICY,
  timeZone: 'UTC',
  standardDayHours: 8,
};

export const DEMO_ENGAGEMENTS: Engagement[] = [
  {
    code: '90412-ITGC-FY26',
    name: 'FY26 ITGC audit support',
    clientName: 'Northwind Energy',
    chargeable: true,
    matchers: [
      { kind: 'path', value: '/sites/AUD-90412-Northwind', weight: 1.0 },
      { kind: 'domain', value: 'northwind-energy.com', weight: 0.9 },
      { kind: 'ticketProject', value: 'ITGC-', weight: 0.8 },
      { kind: 'keyword', value: 'ITGC', weight: 0.6 },
    ],
  },
  {
    code: '88107-SOC1-FY26',
    name: 'SOC 1 Type II readiness',
    clientName: 'Halcyon Payments',
    chargeable: true,
    matchers: [
      { kind: 'path', value: '/sites/ASR-88107-Halcyon', weight: 1.0 },
      { kind: 'domain', value: 'halcyonpay.com', weight: 0.9 },
      { kind: 'ticketProject', value: 'SOC1-', weight: 0.8 },
      { kind: 'keyword', value: 'SOC 1', weight: 0.6 },
    ],
  },
  {
    code: '91250-ERP-PREIMP',
    name: 'S/4HANA pre-implementation review',
    clientName: 'Meridian Health',
    chargeable: true,
    matchers: [
      { kind: 'path', value: '/sites/ADV-91250-Meridian', weight: 1.0 },
      { kind: 'domain', value: 'meridianhealth.org', weight: 0.9 },
      { kind: 'repo', value: 'analytics/je-testing', weight: 0.9 },
      { kind: 'keyword', value: 'S/4HANA', weight: 0.6 },
    ],
  },
  {
    // A newly opened engagement. The code exists in the practice-management
    // system, but nothing has taught the engine what its work looks like yet —
    // the cold-start case that `learnFromCorrection` is for.
    code: '93380-ITGC-FY26',
    name: 'FY26 ITGC audit support',
    clientName: 'Cascade Utilities',
    chargeable: true,
    matchers: [],
  },
  {
    code: 'INT-LD-100',
    name: 'Internal — learning & CPE',
    clientName: 'Northgate Advisory',
    chargeable: false,
    matchers: [
      { kind: 'path', value: '/sites/NGA-Learning', weight: 1.0 },
      { kind: 'keyword', value: 'CPE', weight: 0.8 },
      { kind: 'keyword', value: 'training', weight: 0.6 },
    ],
  },
  {
    code: 'INT-BD-200',
    name: 'Internal — proposals & pipeline',
    clientName: 'Northgate Advisory',
    chargeable: false,
    matchers: [
      { kind: 'path', value: '/sites/NGA-Pipeline', weight: 1.0 },
      { kind: 'keyword', value: 'RFP', weight: 0.8 },
      { kind: 'keyword', value: 'proposal', weight: 0.7 },
    ],
  },
];

/** Declarative shorthand for one signal in the week. */
interface Spec {
  /** 0 = Monday. */
  day: number;
  /** Local (UTC) start hour and minute. */
  at: [number, number];
  source: SignalSource;
  subject: string;
  /** Elapsed minutes. Omit for point-in-time signals (mail, commit, ticket). */
  minutes?: number;
  path?: string;
  domains?: string[];
  intensity?: number;
  /** true when the source reports real attendance, not a booked slot. */
  authoritative?: boolean;
}

/** Default effort weights per source — an edit is worth more than a glance. */
const INTENSITY: Record<SignalSource, number> = {
  meeting: 1.0,
  calendar: 0.7,
  document: 1.0,
  mail: 0.6,
  chat: 0.5,
  ticket: 1.0,
  code: 1.2,
  agent: 1.0,
  desktop: 0.8,
};

const NORTHWIND = '/sites/AUD-90412-Northwind/Shared Documents';
const HALCYON = '/sites/ASR-88107-Halcyon/Shared Documents';
const MERIDIAN = '/sites/ADV-91250-Meridian/Shared Documents';
const CASCADE = '/sites/AUD-93380-Cascade/Shared Documents';

/** A run of document touches `everyMin` apart — what focused fieldwork looks like. */
function docs(
  day: number,
  start: [number, number],
  everyMin: number,
  path: string,
  names: string[],
  domains?: string[],
): Spec[] {
  return names.map((subject, i) => {
    const total = start[1] + i * everyMin;
    return {
      day,
      at: [start[0] + Math.floor(total / 60), total % 60] as [number, number],
      source: 'document' as SignalSource,
      subject,
      minutes: Math.max(4, everyMin - 1),
      path,
      domains,
    };
  });
}

const SPECS: Spec[] = [
  // ── Monday: kickoff, then internal CPE, then untraceable time ──────────────
  {
    day: 0, at: [9, 0], minutes: 30, source: 'meeting', authoritative: true,
    subject: 'Northgate weekly practice huddle',
    domains: FIRM_DOMAINS,
  },
  {
    day: 0, at: [9, 45], minutes: 60, source: 'meeting', authoritative: true,
    subject: 'Northwind FY26 ITGC — audit kickoff with client IT',
    path: NORTHWIND, domains: ['northwind-energy.com', ...FIRM_DOMAINS],
  },
  { day: 0, at: [10, 50], source: 'mail', subject: 'RE: FY26 PBC request list — ITGC scope', domains: ['northwind-energy.com'] },
  ...docs(0, [11, 0], 12, NORTHWIND, [
    'ITGC-01 User Access Review FY26.xlsx',
    'PBC Request Tracker FY26.xlsx',
    'Prior Year ITGC Findings Log.xlsx',
    'IT Environment Understanding Memo.docx',
  ], ['northwind-energy.com']),
  { day: 0, at: [12, 5], source: 'ticket', subject: 'ITGC-142 Obtain AD user listing as of 30 Jun', path: 'jira/ITGC' },

  {
    day: 0, at: [14, 0], minutes: 120, source: 'meeting', authoritative: true,
    subject: 'CPE — Auditing AI-enabled control environments (2.0 credits)',
    path: '/sites/NGA-Learning/Courses', domains: FIRM_DOMAINS,
  },
  // Real work with no cloud trace: a phone call and a paper walkthrough. Must
  // remain visible as unattributed rather than being quietly absorbed.
  { day: 0, at: [16, 30], minutes: 45, source: 'desktop', subject: 'Untitled note window' },

  // ── Tuesday: a clean, high-signal ITGC fieldwork day ──────────────────────
  ...docs(1, [8, 45], 9, NORTHWIND, [
    'ITGC-02 Change Management Walkthrough.docx',
    'ITGC-02 Sample Selection — Change Tickets.xlsx',
    'SOD Conflict Matrix v3.xlsx',
    'Privileged Access Listing — SAP ECC.xlsx',
    'ITGC-03 Job Scheduling Test of Design.docx',
    'IPE Completeness & Accuracy Tickmarks.xlsx',
  ], ['northwind-energy.com']),
  { day: 1, at: [10, 5], source: 'ticket', subject: 'ITGC-147 Change management population reconciled', path: 'jira/ITGC' },
  { day: 1, at: [10, 12], source: 'chat', subject: 'Teams — ITGC fieldwork channel', path: '/teams/AUD-90412-Northwind' },
  {
    day: 1, at: [10, 30], minutes: 45, source: 'meeting', authoritative: true,
    subject: 'Northwind — change management control walkthrough',
    path: NORTHWIND, domains: ['northwind-energy.com', ...FIRM_DOMAINS],
  },
  ...docs(1, [11, 30], 11, NORTHWIND, [
    'ITGC-02 Walkthrough Notes (updated).docx',
    'Change Ticket Sample — Evidence Index.xlsx',
    'Deficiency Evaluation Worksheet.xlsx',
  ], ['northwind-energy.com']),
  ...docs(1, [13, 30], 10, NORTHWIND, [
    'ITGC-04 Backup & Recovery Test of Operating Effectiveness.docx',
    'Batch Job Failure Log Extract.xlsx',
    'ITGC Summary Memo — Draft.docx',
    'Access Review Exception Tracker.xlsx',
    'ITGC-05 Physical & Environmental Controls.docx',
  ], ['northwind-energy.com']),
  { day: 1, at: [15, 10], source: 'mail', subject: 'Northwind ITGC — 3 open items for your team', domains: ['northwind-energy.com'] },
  { day: 1, at: [15, 20], minutes: 40, source: 'document', subject: 'ITGC Summary Memo — Draft.docx', path: NORTHWIND, intensity: 1.4 },

  // ── Wednesday: three engagements, one genuinely ambiguous block ────────────
  {
    day: 2, at: [9, 0], minutes: 60, source: 'meeting', authoritative: true,
    subject: 'Halcyon SOC 1 — Section III system description walkthrough',
    path: HALCYON, domains: ['halcyonpay.com', ...FIRM_DOMAINS],
  },
  ...docs(2, [10, 10], 12, HALCYON, [
    'Halcyon SOC 1 Type II — Control Matrix.xlsx',
    'Section IV — Description of Controls.docx',
    'Subservice Organization Carve-out Memo.docx',
    'CUEC Listing — Draft.xlsx',
  ], ['halcyonpay.com']),
  { day: 2, at: [11, 5], source: 'ticket', subject: 'SOC1-88 Sample selection for logical access', path: 'jira/SOC1' },

  // Cross-engagement resourcing call: both clients named, nothing decisive.
  // The engine must return low confidence here rather than guess confidently.
  {
    day: 2, at: [13, 0], minutes: 45, source: 'meeting', authoritative: true,
    subject: 'Cross-engagement resourcing — Northwind & Halcyon staffing',
    domains: ['northwind-energy.com', 'halcyonpay.com', ...FIRM_DOMAINS],
  },
  ...docs(2, [14, 0], 13, MERIDIAN, [
    'S/4HANA Pre-Implementation Risk Assessment.pptx',
    'Authorization Concept Review — Draft.xlsx',
    'Segregation of Duties Ruleset Mapping.xlsx',
  ], ['meridianhealth.org']),
  { day: 2, at: [15, 0], source: 'mail', subject: 'Meridian S/4HANA — risk assessment walkthrough next steps', domains: ['meridianhealth.org'] },
  // A vendor demo booked with no engagement context — genuinely unassigned.
  { day: 2, at: [16, 0], minutes: 40, source: 'calendar', subject: 'Vendor demo — GRC tooling' },

  // ── Thursday: analytics build for Meridian — the AI-agent day ─────────────
  {
    day: 3, at: [9, 0], minutes: 30, source: 'meeting', authoritative: true,
    subject: 'Meridian — journal entry testing scope confirmation',
    path: MERIDIAN, domains: ['meridianhealth.org', ...FIRM_DOMAINS],
  },
  { day: 3, at: [9, 40], source: 'code', subject: 'feat: JE anomaly scan — load GL extract', path: 'analytics/je-testing@feature/je-anomaly-scan' },
  { day: 3, at: [9, 52], minutes: 25, source: 'agent', subject: 'Claude Code — build duplicate-entry heuristic', path: 'analytics/je-testing@feature/je-anomaly-scan' },
  { day: 3, at: [10, 20], source: 'code', subject: 'test: add fixtures for weekend-posting rule', path: 'analytics/je-testing@feature/je-anomaly-scan' },
  { day: 3, at: [10, 35], minutes: 35, source: 'agent', subject: 'Claude Code — refactor rule engine, add coverage', path: 'analytics/je-testing@feature/je-anomaly-scan' },
  { day: 3, at: [11, 15], source: 'code', subject: 'fix: timezone handling in posting-date rule', path: 'analytics/je-testing@feature/je-anomaly-scan' },
  ...docs(3, [11, 30], 14, MERIDIAN, [
    'JE Testing — Population Reconciliation.xlsx',
    'Anomaly Rule Documentation.docx',
  ], ['meridianhealth.org']),
  ...docs(3, [13, 30], 11, MERIDIAN, [
    'S/4HANA Authorization Concept Review — v2.xlsx',
    'Interface Controls Inventory.xlsx',
    'Data Migration Controls — Risk Matrix.xlsx',
    'Pre-Implementation Observations Log.docx',
  ], ['meridianhealth.org']),
  { day: 3, at: [14, 30], minutes: 30, source: 'agent', subject: 'Claude Code — generate observation write-ups from findings log', path: 'analytics/je-testing@feature/je-anomaly-scan' },
  {
    day: 3, at: [15, 30], minutes: 45, source: 'meeting', authoritative: true,
    subject: 'Meridian — preliminary observations debrief',
    path: MERIDIAN, domains: ['meridianhealth.org', ...FIRM_DOMAINS],
  },

  // ── Friday: SOC 1 reporting, a proposal, and admin slivers ────────────────
  ...docs(4, [8, 50], 12, HALCYON, [
    'Halcyon SOC 1 — Draft Report Section I-II.docx',
    'Control Matrix — Reviewer Comments Cleared.xlsx',
    'Exception Summary — Logical Access.xlsx',
  ], ['halcyonpay.com']),
  {
    day: 4, at: [10, 0], minutes: 60, source: 'meeting', authoritative: true,
    subject: 'Halcyon SOC 1 — manager review of draft report',
    path: HALCYON, domains: FIRM_DOMAINS,
  },
  { day: 4, at: [11, 10], minutes: 35, source: 'document', subject: 'Halcyon SOC 1 — Draft Report Section I-II.docx', path: HALCYON, intensity: 1.4 },
  ...docs(4, [13, 0], 15, '/sites/NGA-Pipeline/Opportunities', [
    'RFP Response — Cloud Controls Assessment.docx',
    'Proposal Pricing Model — Draft.xlsx',
  ]),
  { day: 4, at: [14, 0], minutes: 30, source: 'meeting', authoritative: true, subject: 'RFP go/no-go review', path: '/sites/NGA-Pipeline/Opportunities', domains: FIRM_DOMAINS },
  // A 6-minute sliver that must pool into a same-chargeability line, not a client's.
  { day: 4, at: [15, 0], minutes: 6, source: 'document', subject: 'CPE transcript export.pdf', path: '/sites/NGA-Learning/Records' },
  { day: 4, at: [15, 15], source: 'mail', subject: 'RE: Northwind ITGC — evidence received, thank you', domains: ['northwind-energy.com'] },

  // A brand-new engagement kicking off. No matcher exists for it yet, so this
  // block lands in the unassigned bucket — and one correction teaches the rules.
  {
    day: 4, at: [15, 30], minutes: 45, source: 'meeting', authoritative: true,
    subject: 'Cascade Utilities — FY26 ITGC planning call',
    path: CASCADE, domains: ['cascadeutilities.com', ...FIRM_DOMAINS],
  },
  ...docs(4, [16, 20], 10, CASCADE, [
    'Cascade FY26 — Scoping Questionnaire.docx',
    'IT Application Inventory — Cascade.xlsx',
  ], ['cascadeutilities.com']),
];


/**
 * A stretch of routine engagement work — the long tail that makes up most of a
 * real week and most of the value.
 *
 * Hand-authoring it would be dishonest about volume: a consultant's tenant emits
 * hundreds of traces a day (replies, file touches, channel posts), not dozens,
 * and a demo built on dozens would understate both the coverage the approach
 * achieves and the fragmentation it has to survive. So routine activity is
 * generated at a realistic cadence from a seeded PRNG — deterministic, so the
 * committed demo payload is reproducible.
 */
interface Filler {
  day: number;
  from: [number, number];
  to: [number, number];
  /** Document/chat path for this stretch. Mail signals carry the domain only. */
  path?: string;
  clientDomain?: string;
  /** Subject fragments, cycled to keep the evidence list readable. */
  topics: string[];
}

/** Mulberry32 — small, seeded, reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FILLERS: Filler[] = [
  { day: 0, from: [8, 35], to: [8, 58], clientDomain: 'northwind-energy.com', topics: ['FY26 PBC request list', 'ITGC scope confirmation', 'AD extract timing'] },
  { day: 0, from: [11, 5], to: [12, 35], path: NORTHWIND, clientDomain: 'northwind-energy.com', topics: ['ITGC-01 User Access Review FY26.xlsx', 'PBC Request Tracker FY26.xlsx', 'IT Environment Understanding Memo.docx', 'Prior Year ITGC Findings Log.xlsx'] },
  { day: 0, from: [13, 20], to: [13, 55], path: NORTHWIND, clientDomain: 'northwind-energy.com', topics: ['ITGC risk assessment worksheet', 'Scoped applications listing', 'Key report inventory'] },

  { day: 1, from: [8, 50], to: [12, 10], path: NORTHWIND, clientDomain: 'northwind-energy.com', topics: ['ITGC-02 Change Management Walkthrough.docx', 'SOD Conflict Matrix v3.xlsx', 'Privileged Access Listing — SAP ECC.xlsx', 'Change Ticket Sample — Evidence Index.xlsx', 'IPE Completeness & Accuracy Tickmarks.xlsx'] },
  { day: 1, from: [13, 35], to: [16, 55], path: NORTHWIND, clientDomain: 'northwind-energy.com', topics: ['ITGC-04 Backup & Recovery.docx', 'Batch Job Failure Log Extract.xlsx', 'Access Review Exception Tracker.xlsx', 'ITGC Summary Memo — Draft.docx', 'Deficiency Evaluation Worksheet.xlsx'] },

  { day: 2, from: [9, 5], to: [12, 10], path: HALCYON, clientDomain: 'halcyonpay.com', topics: ['Halcyon SOC 1 Type II — Control Matrix.xlsx', 'Section IV — Description of Controls.docx', 'CUEC Listing — Draft.xlsx', 'Subservice Organization Carve-out Memo.docx'] },
  { day: 2, from: [13, 55], to: [16, 55], path: MERIDIAN, clientDomain: 'meridianhealth.org', topics: ['S/4HANA Pre-Implementation Risk Assessment.pptx', 'Authorization Concept Review — Draft.xlsx', 'Segregation of Duties Ruleset Mapping.xlsx', 'Interface Controls Inventory.xlsx'] },

  { day: 3, from: [9, 35], to: [12, 10], path: MERIDIAN, clientDomain: 'meridianhealth.org', topics: ['JE Testing — Population Reconciliation.xlsx', 'Anomaly Rule Documentation.docx', 'GL extract control totals', 'Weekend posting exception listing'] },
  { day: 3, from: [13, 35], to: [16, 25], path: MERIDIAN, clientDomain: 'meridianhealth.org', topics: ['Data Migration Controls — Risk Matrix.xlsx', 'Pre-Implementation Observations Log.docx', 'Interface Controls Inventory.xlsx', 'Authorization Concept Review — v2.xlsx'] },

  { day: 4, from: [8, 55], to: [11, 45], path: HALCYON, clientDomain: 'halcyonpay.com', topics: ['Halcyon SOC 1 — Draft Report Section I-II.docx', 'Exception Summary — Logical Access.xlsx', 'Control Matrix — Reviewer Comments Cleared.xlsx'] },
  { day: 4, from: [13, 5], to: [14, 25], path: '/sites/NGA-Pipeline/Opportunities', topics: ['RFP Response — Cloud Controls Assessment.docx', 'Proposal Pricing Model — Draft.xlsx', 'Competitor positioning notes'] },
  { day: 4, from: [15, 35], to: [17, 5], path: CASCADE, clientDomain: 'cascadeutilities.com', topics: ['Cascade FY26 — Scoping Questionnaire.docx', 'IT Application Inventory — Cascade.xlsx', 'Planning call follow-ups'] },
];

/**
 * Expand the filler windows into signals at a 6–13 minute cadence, mixing the
 * three sources that dominate a real tenant: mail (domain only, no path), file
 * touches, and channel posts.
 */
function expandFillers(): Spec[] {
  const random = rng(0x5eed);
  const out: Spec[] = [];

  for (const filler of FILLERS) {
    const startMin = filler.from[0] * 60 + filler.from[1];
    const endMin = filler.to[0] * 60 + filler.to[1];

    for (let minute = startMin, i = 0; minute < endMin; i++) {
      const roll = random();
      const topic = filler.topics[i % filler.topics.length];
      const source: SignalSource = roll < 0.45 ? 'mail' : roll < 0.85 ? 'document' : 'chat';

      out.push({
        day: filler.day,
        at: [Math.floor(minute / 60), minute % 60],
        source,
        subject: source === 'mail' ? `RE: ${topic}` : topic,
        minutes: source === 'document' ? 4 + Math.floor(random() * 9) : undefined,
        // Mail carries the counterparty but no folder path; documents and chat
        // carry the path. Both routes must attribute, with different strength.
        path: source === 'mail' ? undefined : filler.path,
        domains: source === 'mail' && filler.clientDomain ? [filler.clientDomain] : undefined,
      });

      minute += 6 + Math.floor(random() * 8);
    }
  }

  return out;
}

/** Materialise the week as normalised signals. */
export function buildSyntheticWeek(): ActivitySignal[] {
  const counters = new Map<SignalSource, number>();

  return [...SPECS, ...expandFillers()].map(spec => {
    const n = (counters.get(spec.source) ?? 0) + 1;
    counters.set(spec.source, n);

    const startedAt =
      WEEK_START_UTC + spec.day * DAY_MS + spec.at[0] * 3_600_000 + spec.at[1] * 60_000;
    const durationMs = (spec.minutes ?? 0) * 60_000;

    return {
      id: `${spec.source}-${String(n).padStart(3, '0')}`,
      source: spec.source,
      startedAt,
      endedAt: startedAt + durationMs,
      authoritativeDuration: spec.authoritative ?? false,
      subject: spec.subject,
      path: spec.path,
      participantDomains: spec.domains,
      evidenceUrl: `https://northgate-advisory.example/evidence/${spec.source}-${String(n).padStart(3, '0')}`,
      intensity: spec.intensity ?? INTENSITY[spec.source],
    } satisfies ActivitySignal;
  }).sort((a, b) => a.startedAt - b.startedAt);
}
