#!/usr/bin/env node
/**
 * Token validation script.
 *
 * Reads ALL Claude Code JSONL files under ~/.claude/projects/, deduplicates
 * streaming frames by message.id (preferring stop_reason != null, then last
 * partial frame), and prints token totals grouped by date + model.
 *
 * Compare the output against the Anthropic usage CSV to validate that
 * JsonlTokenSniffer is counting correctly.
 *
 * Usage:
 *   node scripts/validate-tokens.mjs
 *   node scripts/validate-tokens.mjs --project -Users-chriszhang-Desktop-Devcost-Tracker-devvalue
 */

import { createReadStream } from 'node:fs';
import { readdir, stat, access } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';

// ── Pricing (USD per million tokens) ───────────────────────────────────────
const PRICING = {
  'claude-haiku-4-5':  { inp: 0.80, out: 4.00, cw: 1.00, cr: 0.08 },
  'claude-sonnet-4-6': { inp: 3.00, out: 15.00, cw: 3.75, cr: 0.30 },
  'claude-sonnet-4-5': { inp: 3.00, out: 15.00, cw: 3.75, cr: 0.30 },
  'claude-opus-4-6':   { inp: 15.00, out: 75.00, cw: 18.75, cr: 1.50 },
};

function getPricingKey(model) {
  const m = model.toLowerCase();
  if (m.includes('haiku-4-5'))  return 'claude-haiku-4-5';
  if (m.includes('sonnet-4-6')) return 'claude-sonnet-4-6';
  if (m.includes('sonnet-4-5')) return 'claude-sonnet-4-5';
  if (m.includes('opus-4-6'))   return 'claude-opus-4-6';
  return null;
}

function extractDate(ts) {
  if (!ts) return null;
  try {
    return new Date(ts).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

// ── Glob expansion ─────────────────────────────────────────────────────────
async function expandGlob(pattern) {
  const segs = pattern.split('*');
  if (segs.length === 1) {
    try { await access(pattern); return [pattern]; } catch { return []; }
  }
  return expandSegs(segs, 0, '');
}

async function expandSegs(segs, idx, built) {
  const prefix = built + segs[idx];
  const isLast = idx === segs.length - 2;
  let entries;
  try { entries = await readdir(prefix, { withFileTypes: true }); } catch { return []; }
  const results = [];
  if (isLast) {
    const suffix = segs[segs.length - 1];
    for (const e of entries) {
      if (e.name.endsWith(suffix)) results.push(join(prefix, e.name));
    }
  } else {
    for (const e of entries) {
      results.push(...await expandSegs(segs, idx + 1, join(prefix, e.name)));
    }
  }
  return results;
}

// ── JSONL parsing ─────────────────────────────────────────────────────────
function toInt(v) { return (typeof v === 'number' && v > 0) ? Math.floor(v) : 0; }
function isObj(v) { return typeof v === 'object' && v !== null && !Array.isArray(v); }

function parseAssistantRecord(d) {
  const msg = d.message;
  if (!isObj(msg) || !isObj(msg.usage)) return null;
  const messageId = typeof msg.id === 'string' ? msg.id : null;
  if (!messageId) return null;
  return {
    messageId,
    stopReason: typeof msg.stop_reason === 'string' ? msg.stop_reason : null,
    model: typeof msg.model === 'string' ? msg.model : 'unknown',
    timestamp: typeof d.timestamp === 'string' ? new Date(d.timestamp).getTime() : Date.now(),
    inp: toInt(msg.usage.input_tokens),
    out: toInt(msg.usage.output_tokens),
    cw:  toInt(msg.usage.cache_creation_input_tokens),
    cr:  toInt(msg.usage.cache_read_input_tokens),
    isSidechain: d.isSidechain === true,
  };
}

function parseProgressRecord(d) {
  const data = d.data;
  if (!isObj(data)) return null;
  const outer = data.message;
  if (!isObj(outer)) return null;
  const inner = outer.message;
  if (!isObj(inner) || !isObj(inner.usage)) return null;
  const messageId = typeof inner.id === 'string' ? inner.id : null;
  if (!messageId) return null;
  return {
    messageId,
    stopReason: typeof inner.stop_reason === 'string' ? inner.stop_reason : null,
    model: typeof inner.model === 'string' ? inner.model : 'unknown',
    timestamp: typeof d.timestamp === 'string' ? new Date(d.timestamp).getTime() : Date.now(),
    inp: toInt(inner.usage.input_tokens),
    out: toInt(inner.usage.output_tokens),
    cw:  toInt(inner.usage.cache_creation_input_tokens),
    cr:  toInt(inner.usage.cache_read_input_tokens),
    isSidechain: true,  // progress records are always subagent calls
  };
}

function parseLine(line) {
  let d;
  try { d = JSON.parse(line); } catch { return null; }
  if (!isObj(d)) return null;
  if (d.type === 'assistant') return parseAssistantRecord(d);
  if (d.type === 'progress')  return parseProgressRecord(d);
  return null;
}

async function readFile(filePath, pending) {
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat) return;

  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath, { encoding: 'utf8' });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const rec = parseLine(trimmed);
      if (!rec) return;

      if (rec.stopReason !== null) {
        // Final frame: always prefer over any partial
        pending.set(rec.messageId, rec);
      } else {
        const existing = pending.get(rec.messageId);
        if (!existing) {
          pending.set(rec.messageId, rec);  // first partial
        } else if (existing.stopReason === null) {
          pending.set(rec.messageId, rec);  // overwrite with newer partial (higher out)
        }
        // else: existing is already final — keep it
      }
    });

    rl.on('close', resolve);
    rl.on('error', reject);
    stream.on('error', reject);
  });
}

// ── Main ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const projectFilter = args.includes('--project') ? args[args.indexOf('--project') + 1] : null;

const projectsBase = join(homedir(), '.claude', 'projects');

// Find all JSONL files (main sessions + subagent sessions)
const mainGlob  = join(projectsBase, (projectFilter ?? '*'), '*.jsonl');
const subGlob   = join(projectsBase, (projectFilter ?? '*'), '*', 'subagents', '*.jsonl');

const [mainFiles, subFiles] = await Promise.all([expandGlob(mainGlob), expandGlob(subGlob)]);
const allFiles = [...mainFiles, ...subFiles];

console.log(`Found ${allFiles.length} JSONL files (${mainFiles.length} main, ${subFiles.length} subagent)\n`);

// Global dedup map: messageId → best record
const pending = new Map();

for (const f of allFiles) {
  await readFile(f, pending);
}

console.log(`Unique API calls (after dedup): ${pending.size}\n`);

// Aggregate by date + pricing key
const totals = new Map();

for (const rec of pending.values()) {
  const date = extractDate(new Date(rec.timestamp).toISOString());
  const pkey = getPricingKey(rec.model);
  if (!date || !pkey) continue;

  const key = `${date}|${pkey}`;
  if (!totals.has(key)) {
    totals.set(key, { date, model: pkey, inp: 0, out: 0, cw: 0, cr: 0, count: 0 });
  }
  const t = totals.get(key);
  t.inp += rec.inp;
  t.out += rec.out;
  t.cw  += rec.cw;
  t.cr  += rec.cr;
  t.count++;
}

// CSV ground truth (from claude_api_cost_2026_02_24_to_2026_02_28.csv)
const CSV_GT = {
  '2026-02-25|claude-haiku-4-5':  { inp: 0.06, out: 0.12, cw: 0.17, cr: 0.07 },
  '2026-02-25|claude-sonnet-4-6': { inp: 0.01, out: 2.58, cw: 2.24, cr: 2.38 },
  '2026-02-26|claude-haiku-4-5':  { inp: 0.00, out: 0.00, cw: 0.00, cr: 0.00 },
  '2026-02-26|claude-sonnet-4-6': { inp: 0.00, out: 0.08, cw: 0.07, cr: 0.08 },
  '2026-02-28|claude-haiku-4-5':  { inp: 0.00, out: 0.01, cw: 0.07, cr: 0.00 },
  '2026-02-28|claude-sonnet-4-6': { inp: 0.06, out: 0.46, cw: 0.61, cr: 0.23 },
};

console.log('='.repeat(90));
console.log('Token totals by date + model (all projects)\n');

const sortedEntries = [...totals.entries()].sort();
for (const [key, t] of sortedEntries) {
  const p = PRICING[t.model];
  const inpCost = t.inp * p.inp / 1e6;
  const outCost = t.out * p.out / 1e6;
  const cwCost  = t.cw  * p.cw  / 1e6;
  const crCost  = t.cr  * p.cr  / 1e6;
  const total   = inpCost + outCost + cwCost + crCost;

  const csv = CSV_GT[key] ?? { inp: null, out: null, cw: null, cr: null };
  const csvTotal = csv.inp !== null ? (csv.inp + csv.out + csv.cw + csv.cr) : null;

  console.log(`${t.date}  ${t.model}  (${t.count} calls)`);
  console.log(`  ${'type'          .padEnd(14)} ${'tokens'.padStart(12)}  ${'parsed $'.padStart(10)}  ${'csv $'.padStart(8)}  ${'diff'.padStart(9)}`);

  const rows = [
    ['inp_no_cache', t.inp, inpCost, csv.inp],
    ['output',       t.out, outCost, csv.out],
    ['cache_write',  t.cw,  cwCost,  csv.cw ],
    ['cache_read',   t.cr,  crCost,  csv.cr ],
    ['TOTAL',        null,  total,   csvTotal],
  ];
  for (const [label, tokens, cost, csvCost] of rows) {
    const tokStr = tokens !== null ? tokens.toLocaleString().padStart(12) : ''.padStart(12);
    const costStr = `$${cost.toFixed(4)}`.padStart(10);
    const csvStr  = csvCost !== null ? `$${csvCost.toFixed(4)}`.padStart(8) : '   n/a  ';
    const diffStr = csvCost !== null ? `${(cost - csvCost) >= 0 ? '+' : ''}${(cost - csvCost).toFixed(4)}`.padStart(9) : '       ';
    console.log(`  ${label.padEnd(14)} ${tokStr}  ${costStr}  ${csvStr}  ${diffStr}`);
  }
  console.log();
}
