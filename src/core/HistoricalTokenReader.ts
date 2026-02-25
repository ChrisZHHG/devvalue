import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as readline from 'node:readline';

import type { TokenUsage } from './types.js';
import { getPricing } from './modelPricing.js';

/**
 * One-shot historical reader for Claude Code JSONL session logs.
 *
 * Unlike JsonlTokenSniffer (which tails files), this reads all matching
 * files completely in a single pass — suitable for CLI `report` commands.
 *
 * Stream-parses each file line-by-line; never loads entire files into memory.
 */
export class HistoricalTokenReader {
  private readonly expandedGlob: string;

  constructor(globPattern: string) {
    this.expandedGlob = globPattern.replace(/^~/, os.homedir());
  }

  /** Read all matching JSONL files and return every TokenUsage found. */
  async readAll(): Promise<TokenUsage[]> {
    const files = await expandGlob(this.expandedGlob);
    const results: TokenUsage[] = [];

    for (const file of files) {
      const usages = await readFile(file);
      results.push(...usages);
    }

    return results;
  }
}

// ── File reading ─────────────────────────────────────────────────────────────

async function readFile(filePath: string): Promise<TokenUsage[]> {
  const results: TokenUsage[] = [];

  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) { return; }
      const usage = parseLine(trimmed);
      if (usage) { results.push(usage); }
    });

    rl.on('close', resolve);
    rl.on('error', reject);
    stream.on('error', reject);
  });

  return results;
}

function parseLine(line: string): TokenUsage | null {
  let record: unknown;
  try {
    record = JSON.parse(line);
  } catch {
    return null;
  }

  if (!isObj(record)) { return null; }
  if (record['type'] !== 'assistant') { return null; }

  const message = record['message'];
  if (!isObj(message)) { return null; }

  const usage = message['usage'];
  if (!isObj(usage)) { return null; }

  const model =
    typeof message['model'] === 'string' ? message['model'] : 'unknown';

  const rawTs = record['timestamp'];
  const timestamp =
    typeof rawTs === 'string' ? new Date(rawTs).getTime() : Date.now();

  const inputTokens      = toInt(usage['input_tokens']);
  const outputTokens     = toInt(usage['output_tokens']);
  const cacheWriteTokens = toInt(usage['cache_creation_input_tokens']);
  const cacheReadTokens  = toInt(usage['cache_read_input_tokens']);

  const pricing = getPricing(model);
  const costUsd =
    (inputTokens      * pricing.inputPer1M      +
     outputTokens     * pricing.outputPer1M     +
     cacheWriteTokens * pricing.cacheWritePer1M +
     cacheReadTokens  * pricing.cacheReadPer1M) / 1_000_000;

  return {
    uuid:        typeof record['uuid']      === 'string' ? record['uuid']      : undefined,
    timestamp,
    model,
    inputTokens,
    outputTokens,
    costUsd,
    isBackground: record['isSidechain'] === true,
    sessionId:   typeof record['sessionId'] === 'string' ? record['sessionId'] : '',
    branchName:  typeof record['gitBranch'] === 'string' ? record['gitBranch'] : '',
  };
}

// ── Glob expansion ────────────────────────────────────────────────────────────

async function expandGlob(pattern: string): Promise<string[]> {
  const segs = pattern.split('*');
  if (segs.length === 1) {
    try {
      await fsp.access(pattern);
      return [pattern];
    } catch {
      return [];
    }
  }
  return expandSegments(segs, 0, '');
}

async function expandSegments(
  segs: string[],
  idx: number,
  built: string,
): Promise<string[]> {
  const prefix = built + segs[idx];
  const isLastWildcard = idx === segs.length - 2;

  let entries: fs.Dirent[];
  try {
    entries = await fsp.readdir(prefix, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: string[] = [];

  if (isLastWildcard) {
    const suffix = segs[segs.length - 1];
    for (const entry of entries) {
      if (!entry.name.endsWith(suffix)) { continue; }
      results.push(path.join(prefix, entry.name));
    }
  } else {
    for (const entry of entries) {
      const nested = await expandSegments(
        segs,
        idx + 1,
        path.join(prefix, entry.name),
      );
      results.push(...nested);
    }
  }

  return results;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function toInt(v: unknown): number {
  return typeof v === 'number' && v > 0 ? Math.floor(v) : 0;
}
