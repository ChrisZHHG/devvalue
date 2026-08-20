/**
 * Core engine tests.
 *
 * Run with `pnpm run test:core` — plain `node:test`, no VS Code harness, because
 * none of this depends on an editor.
 *
 * The tests are weighted towards the invariants a reviewer or a regulator would
 * actually challenge: that rounding does not invent hours, that non-chargeable
 * minutes never cross onto a client's bill, and that a keyword alone can never
 * produce a confident attribution.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AttributionEngine } from './AttributionEngine.js';
import { BlockSegmenter } from './BlockSegmenter.js';
import { ContextSplitter } from './ContextSplitter.js';
import { TimesheetSynthesizer, mondayOf } from './TimesheetSynthesizer.js';
import { DEFAULT_POLICY } from './types.js';
import type { ActivitySignal, Engagement, TimesheetPolicy } from './types.js';

const T0 = Date.UTC(2026, 7, 17, 9, 0, 0);
const MIN = 60_000;

const POLICY: TimesheetPolicy = { ...DEFAULT_POLICY, timeZone: 'UTC' };

function signal(partial: Partial<ActivitySignal> & { id: string; startedAt: number }): ActivitySignal {
  return {
    source: 'document',
    endedAt: partial.startedAt,
    authoritativeDuration: false,
    subject: partial.id,
    intensity: 1,
    ...partial,
  };
}

const ALPHA: Engagement = {
  code: 'A-100',
  name: 'Alpha engagement',
  clientName: 'Alpha Corp',
  chargeable: true,
  matchers: [
    { kind: 'path', value: '/sites/alpha', weight: 1 },
    { kind: 'domain', value: 'alpha.com', weight: 0.9 },
    { kind: 'keyword', value: 'ITGC', weight: 0.6 },
  ],
};

const BETA: Engagement = {
  code: 'B-200',
  name: 'Beta engagement',
  clientName: 'Beta Ltd',
  chargeable: true,
  matchers: [
    { kind: 'path', value: '/sites/beta', weight: 1 },
    { kind: 'domain', value: 'beta.com', weight: 0.9 },
  ],
};

const INTERNAL: Engagement = {
  code: 'INT-1',
  name: 'Internal admin',
  clientName: 'Own firm',
  chargeable: false,
  matchers: [{ kind: 'path', value: '/sites/internal', weight: 1 }],
};

// ── BlockSegmenter ─────────────────────────────────────────────────────────────

test('a gap inside the idle budget is credited as working time', () => {
  const blocks = new BlockSegmenter(POLICY).segment([
    signal({ id: 's1', startedAt: T0 }),
    signal({ id: 's2', startedAt: T0 + 8 * MIN }),
  ]);

  assert.equal(blocks.length, 1);
  // 8 min gap + the 2 min point credit on the trailing signal.
  assert.equal(blocks[0].focusSeconds, 10 * 60);
});

test('a gap beyond the idle budget splits the block and is not billed', () => {
  const blocks = new BlockSegmenter(POLICY).segment([
    signal({ id: 's1', startedAt: T0 }),
    signal({ id: 's2', startedAt: T0 + 90 * MIN }),
  ]);

  assert.equal(blocks.length, 2);
  const billed = blocks.reduce((s, b) => s + b.focusSeconds, 0);
  assert.equal(billed, 4 * 60, 'only the two point credits, never the 90-minute gap');
});

test('sustained density extends the idle budget instead of stopping the clock', () => {
  const dense = [0, 2, 4, 6].map(m => signal({ id: `d${m}`, startedAt: T0 + m * MIN }));
  // 15 minutes: past the 10-minute base budget, inside the 20-minute flow budget.
  const after = signal({ id: 'late', startedAt: T0 + 21 * MIN });

  const blocks = new BlockSegmenter(POLICY).segment([...dense, after]);

  assert.equal(blocks.length, 1, 'the flow-extended budget holds the block open');
  assert.equal(blocks[0].flowExtended, true);
});

test('an authoritative duration is trusted verbatim, never padded', () => {
  const blocks = new BlockSegmenter(POLICY).segment([
    signal({
      id: 'call',
      startedAt: T0,
      endedAt: T0 + 45 * MIN,
      authoritativeDuration: true,
      source: 'meeting',
    }),
  ]);

  assert.equal(blocks[0].focusSeconds, 45 * 60);
});

test('replaying the same signals is idempotent', () => {
  const input = [signal({ id: 's1', startedAt: T0 }), signal({ id: 's2', startedAt: T0 + 5 * MIN })];
  const once = new BlockSegmenter(POLICY).segment(input);
  const twice = new BlockSegmenter(POLICY).segment([...input, ...input]);

  assert.deepEqual(twice, once);
});

// ── ContextSplitter ───────────────────────────────────────────────────────────

test('sub-blocks tile the parent block exactly — no time created or destroyed', () => {
  const engine = new AttributionEngine([ALPHA, BETA], POLICY);
  const signals = [
    signal({ id: 'a1', startedAt: T0, path: '/sites/alpha/docs' }),
    signal({ id: 'a2', startedAt: T0 + 5 * MIN, path: '/sites/alpha/docs' }),
    signal({ id: 'b1', startedAt: T0 + 12 * MIN, path: '/sites/beta/docs' }),
    signal({ id: 'b2', startedAt: T0 + 18 * MIN, path: '/sites/beta/docs' }),
  ];

  const parents = new BlockSegmenter(POLICY).segment(signals);
  const children = new ContextSplitter(engine).split(parents);

  assert.equal(parents.length, 1);
  assert.equal(children.length, 2);
  assert.equal(
    children.reduce((s, b) => s + b.focusSeconds, 0),
    parents[0].focusSeconds,
  );
  assert.equal(children[0].endedAt, children[1].startedAt, 'the boundary is shared');
});

test('a long single-signal detour survives as its own block', () => {
  const engine = new AttributionEngine([ALPHA, BETA], POLICY);
  const signals = [
    signal({ id: 'a1', startedAt: T0, path: '/sites/alpha/docs' }),
    signal({ id: 'a2', startedAt: T0 + 5 * MIN, path: '/sites/alpha/docs' }),
    signal({
      id: 'call',
      startedAt: T0 + 10 * MIN,
      endedAt: T0 + 55 * MIN,
      authoritativeDuration: true,
      source: 'meeting',
      subject: 'Beta status call',
      participantDomains: ['beta.com'],
    }),
    signal({ id: 'a3', startedAt: T0 + 60 * MIN, path: '/sites/alpha/docs' }),
    signal({ id: 'a4', startedAt: T0 + 65 * MIN, path: '/sites/alpha/docs' }),
  ];

  const blocks = new ContextSplitter(engine).split(new BlockSegmenter(POLICY).segment(signals));
  const codes = engine.attributeAll(blocks).map(b => b.engagementCode);

  assert.deepEqual(codes, ['A-100', 'B-200', 'A-100']);
});

test('a brief detour is absorbed rather than carving out a spurious row', () => {
  const engine = new AttributionEngine([ALPHA, BETA], POLICY);
  const signals = [
    signal({ id: 'a1', startedAt: T0, path: '/sites/alpha/docs' }),
    signal({ id: 'a2', startedAt: T0 + 4 * MIN, path: '/sites/alpha/docs' }),
    signal({ id: 'b1', startedAt: T0 + 8 * MIN, path: '/sites/beta/docs' }),
    signal({ id: 'a3', startedAt: T0 + 12 * MIN, path: '/sites/alpha/docs' }),
    signal({ id: 'a4', startedAt: T0 + 16 * MIN, path: '/sites/alpha/docs' }),
  ];

  const blocks = new ContextSplitter(engine).split(new BlockSegmenter(POLICY).segment(signals));

  assert.equal(blocks.length, 1);
});

// ── AttributionEngine ─────────────────────────────────────────────────────────

test('a folder match produces a confident attribution with traceable evidence', () => {
  const engine = new AttributionEngine([ALPHA, BETA], POLICY);
  const block = new BlockSegmenter(POLICY).segment([
    signal({ id: 'a1', startedAt: T0, path: '/sites/alpha/docs', evidenceUrl: 'https://x/1' }),
    signal({ id: 'a2', startedAt: T0 + 5 * MIN, path: '/sites/alpha/docs' }),
  ])[0];

  const attributed = engine.attribute(block);

  assert.equal(attributed.engagementCode, 'A-100');
  assert.equal(attributed.confidence, 'high');
  assert.equal(attributed.hasAuthoritativeEvidence, true);
  assert.equal(attributed.best?.evidence[0].evidenceUrl, 'https://x/1');
});

test('a keyword alone is never authority to bill', () => {
  const engine = new AttributionEngine([ALPHA, BETA], POLICY);
  const block = new BlockSegmenter(POLICY).segment([
    signal({ id: 'k1', startedAt: T0, subject: 'Gamma Ltd — FY26 ITGC planning call' }),
    signal({ id: 'k2', startedAt: T0 + 5 * MIN, subject: 'ITGC scoping notes' }),
  ])[0];

  const attributed = engine.attribute(block);

  assert.equal(attributed.confidence, 'unattributed');
  assert.equal(attributed.engagementCode, POLICY.unattributedCode);
  assert.equal(attributed.best?.engagementCode, 'A-100', 'still surfaced as a suggestion');
});

test('two clients on one call yields low confidence, not a confident guess', () => {
  const engine = new AttributionEngine([ALPHA, BETA], POLICY);
  const block = new BlockSegmenter(POLICY).segment([
    signal({
      id: 'joint',
      startedAt: T0,
      endedAt: T0 + 45 * MIN,
      authoritativeDuration: true,
      source: 'meeting',
      subject: 'Cross-engagement resourcing',
      participantDomains: ['alpha.com', 'beta.com'],
    }),
  ])[0];

  const attributed = engine.attribute(block);

  assert.equal(attributed.confidence, 'low');
  assert.equal(attributed.margin, 0);
  assert.ok(attributed.runnerUp, 'the alternative is named for the reviewer');
});

test('a correction teaches the folder and counterparty behind it', () => {
  const cold: Engagement = { ...BETA, code: 'NEW-1', matchers: [] };
  const engine = new AttributionEngine([ALPHA, cold], POLICY, { internalDomains: ['ownfirm.com'] });
  const block = new BlockSegmenter(POLICY).segment([
    signal({ id: 'n1', startedAt: T0, path: '/sites/newclient/docs', participantDomains: ['newclient.com'] }),
    signal({ id: 'n2', startedAt: T0 + 5 * MIN, path: '/sites/newclient/plan', participantDomains: ['newclient.com', 'ownfirm.com'] }),
  ])[0];

  const learned = engine.learnFromCorrection(block, 'NEW-1');

  assert.deepEqual(
    learned.map(m => [m.kind, m.value]),
    [
      ['path', '/sites/newclient'],
      ['domain', 'newclient.com'],
    ],
  );
  assert.ok(learned.every(m => m.learned));
});

test('nothing is learned from a block with two outside parties', () => {
  const engine = new AttributionEngine([ALPHA, BETA], POLICY);
  const block = new BlockSegmenter(POLICY).segment([
    signal({ id: 'j1', startedAt: T0, participantDomains: ['alpha.com', 'beta.com'] }),
    signal({ id: 'j2', startedAt: T0 + 5 * MIN, participantDomains: ['alpha.com', 'beta.com'] }),
  ])[0];

  assert.deepEqual(engine.learnFromCorrection(block, 'A-100'), []);
});

// ── TimesheetSynthesizer ──────────────────────────────────────────────────────

/** Build a day of blocks from (path, minutes) pairs laid end to end. */
function dayOf(specs: [path: string, minutes: number][]) {
  const engagements = [ALPHA, BETA, INTERNAL];
  const engine = new AttributionEngine(engagements, POLICY);
  let cursor = T0;
  const signals: ActivitySignal[] = [];

  for (const [path, minutes] of specs) {
    signals.push(
      signal({
        id: `${path}-${cursor}`,
        startedAt: cursor,
        endedAt: cursor + minutes * MIN,
        authoritativeDuration: true,
        path,
      }),
    );
    cursor += minutes * MIN;
  }

  const blocks = new ContextSplitter(engine).split(new BlockSegmenter(POLICY).segment(signals));
  return new TimesheetSynthesizer(engagements, POLICY).synthesize(engine.attributeAll(blocks));
}

test('rounding redistributes hours without changing the day total', () => {
  // 47 + 53 + 65 = 165 min = 2.75 h, none of which is a clean quarter alone.
  const draft = dayOf([
    ['/sites/alpha/a', 47],
    ['/sites/beta/b', 53],
    ['/sites/alpha/c', 65],
  ]);

  assert.equal(draft.totalHours, 2.75);
  assert.ok(draft.lines.every(l => Math.round(l.hours / 0.25) * 0.25 === l.hours));
});

test('a sliver pools within its own chargeability, never onto a client', () => {
  const draft = dayOf([
    ['/sites/alpha/a', 120],
    ['/sites/internal/x', 90],
    ['/sites/internal/y', 6],
  ]);

  const client = draft.lines.find(l => l.engagementCode === 'A-100');
  const internal = draft.lines.find(l => l.engagementCode === 'INT-1');

  assert.equal(client?.hours, 2);
  assert.equal(internal?.hours, 1.5);
  assert.equal(draft.chargeableHours, 2);
});

test('unattributed time stays its own row and is reconciled against the day', () => {
  const draft = dayOf([
    ['/sites/alpha/a', 180],
    ['/nowhere/at/all', 60],
  ]);

  const unassigned = draft.lines.find(l => l.engagementCode === POLICY.unattributedCode);
  assert.equal(unassigned?.hours, 1);
  assert.equal(unassigned?.confidence, 'unattributed');
  assert.equal(draft.coverage[0].unattributedHours, 1);
  assert.equal(draft.coverage[0].unaccountedHours, 8 - 3 - 1);
});

test('a high-confidence row cannot contain a block the engine flagged', () => {
  const engine = new AttributionEngine([ALPHA, BETA], POLICY);
  const signals = [
    signal({ id: 'a1', startedAt: T0, endedAt: T0 + 180 * MIN, authoritativeDuration: true, path: '/sites/alpha/a' }),
    signal({
      id: 'joint',
      startedAt: T0 + 185 * MIN,
      endedAt: T0 + 230 * MIN,
      authoritativeDuration: true,
      source: 'meeting',
      subject: 'Cross-engagement resourcing',
      participantDomains: ['alpha.com', 'beta.com'],
    }),
  ];

  const blocks = new ContextSplitter(engine).split(new BlockSegmenter(POLICY).segment(signals));
  const draft = new TimesheetSynthesizer([ALPHA, BETA], POLICY).synthesize(engine.attributeAll(blocks));
  const alpha = draft.lines.find(l => l.engagementCode === 'A-100');

  assert.ok(alpha);
  assert.notEqual(alpha.confidence, 'high');
});

test('mondayOf snaps any weekday to the start of its week', () => {
  assert.equal(mondayOf('2026-08-21'), '2026-08-17');
  assert.equal(mondayOf('2026-08-17'), '2026-08-17');
  assert.equal(mondayOf('2026-08-23'), '2026-08-17');
});
