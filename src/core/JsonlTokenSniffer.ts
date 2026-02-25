import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as readline from 'node:readline';

import type { ITokenSniffer } from './ITokenSniffer.js';
import type { TokenUsage } from './types.js';
import { getPricing } from './modelPricing.js';

/** How often to scan for newly created log files (new sessions). */
const POLL_INTERVAL_MS = 10_000;

/**
 * Reads Claude Code's JSONL session logs and emits a `TokenUsage` event for
 * every `type: "assistant"` API call recorded.
 *
 * **Streaming**: files are read incrementally from a byte offset — full file
 * contents are never held in memory.
 *
 * **Tailing**: `fs.watch` is used to detect appends; a background poll finds
 * newly created log files (new sessions) every 10 s.
 *
 * **Background detection**: records where `isSidechain === true` are marked
 * `isBackground: true` in the emitted `TokenUsage`.
 *
 * Consumers should deduplicate emitted events by the JSONL record's `uuid`
 * field (available via the raw record) if they restart and replay files.
 */
export class JsonlTokenSniffer extends EventEmitter implements ITokenSniffer {
  private readonly expandedGlob: string;

  /** Last byte offset read per file — we only stream new bytes. */
  private readonly fileOffsets = new Map<string, number>();

  /** Active `fs.FSWatcher` per file. */
  private readonly watchers = new Map<string, fs.FSWatcher>();

  private pollTimer?: NodeJS.Timeout;
  private running = false;

  constructor(globPattern: string) {
    super();
    this.expandedGlob = globPattern.replace(/^~/, os.homedir());
  }

  start(): void {
    if (this.running) {return;}
    this.running = true;
    void this.scanAndWatch();
    this.pollTimer = setInterval(() => void this.scanAndWatch(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (!this.running) {return;}
    this.running = false;
    clearInterval(this.pollTimer);
    for (const watcher of this.watchers.values()) {watcher.close();}
    this.watchers.clear();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Expand the glob, then catch up + watch any files not yet tracked. */
  private async scanAndWatch(): Promise<void> {
    let files: string[];
    try {
      files = await expandGlob(this.expandedGlob);
    } catch (err) {
      this.emit('error', toError(err));
      return;
    }

    for (const file of files) {
      if (this.watchers.has(file)) {continue;}
      // Catch up from byte 0 before installing the watcher so we don't miss
      // lines that were written between the readdir and the watch call.
      await this.readNewLines(file);
      this.watchFile(file);
    }
  }

  private watchFile(filePath: string): void {
    try {
      const watcher = fs.watch(filePath, { persistent: false }, () => {
        void this.readNewLines(filePath);
      });
      watcher.on('error', (err) => this.emit('error', err));
      this.watchers.set(filePath, watcher);
    } catch (err) {
      this.emit('error', toError(err));
    }
  }

  /**
   * Stream-read any bytes appended since the last read.
   * Uses readline so we process one line at a time without buffering the file.
   */
  private async readNewLines(filePath: string): Promise<void> {
    const offset = this.fileOffsets.get(filePath) ?? 0;

    let stat: fs.Stats;
    try {
      stat = await fsp.stat(filePath);
    } catch {
      return; // file disappeared
    }

    if (stat.size <= offset) {return;} // nothing new

    await new Promise<void>((resolve, reject) => {
      const stream = fs.createReadStream(filePath, {
        start: offset,
        encoding: 'utf8',
      });

      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

      rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed) {return;}
        const usage = this.parseLine(trimmed);
        if (usage) {this.emit('usage', usage);}
      });

      rl.on('close', () => {
        this.fileOffsets.set(filePath, stat.size);
        resolve();
      });

      rl.on('error', reject);
      stream.on('error', reject);
    });
  }

  /** Parse one JSONL line. Returns `TokenUsage` for assistant records, else null. */
  private parseLine(line: string): TokenUsage | null {
    let record: unknown;
    try {
      record = JSON.parse(line);
    } catch {
      return null;
    }

    if (!isObj(record)) {return null;}
    if (record['type'] !== 'assistant') {return null;}

    const message = record['message'];
    if (!isObj(message)) {return null;}

    const usage = message['usage'];
    if (!isObj(usage)) {return null;}

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
      timestamp,
      model,
      inputTokens,
      outputTokens,
      costUsd,
      isBackground: record['isSidechain'] === true,
      sessionId:
        typeof record['sessionId'] === 'string' ? record['sessionId'] : '',
      branchName:
        typeof record['gitBranch'] === 'string' ? record['gitBranch'] : '',
    };
  }
}

// ── Glob expansion ─────────────────────────────────────────────────────────

/**
 * Expand a glob pattern containing `*` wildcards into a list of real file paths.
 *
 * Algorithm:
 *   Split `pattern` on `*` to get literal segments `segs`.
 *   Recurse: at each wildcard, `readdir` the directory formed by the accumulated
 *   path, iterate over entries, and recurse with the next segment appended.
 *   At the *last* wildcard, filter directory entries whose names end with
 *   `segs[last]` (the file-extension suffix, e.g. `".jsonl"`).
 *
 * Works with any number of `*` wildcards. Missing directories return `[]`.
 */
async function expandGlob(pattern: string): Promise<string[]> {
  const segs = pattern.split('*');
  if (segs.length === 1) {
    // No wildcard — check if the literal path exists.
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
    // segs[last] is the filename suffix (e.g. ".jsonl").
    // Keep only entries whose name ends with that suffix.
    const suffix = segs[segs.length - 1];
    for (const entry of entries) {
      if (!entry.name.endsWith(suffix)) {continue;}
      results.push(path.join(prefix, entry.name));
    }
  } else {
    // More wildcards remain. Each entry expands the current `*`.
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

// ── Utilities ──────────────────────────────────────────────────────────────

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function toInt(v: unknown): number {
  return typeof v === 'number' && v > 0 ? Math.floor(v) : 0;
}

function toError(v: unknown): Error {
  return v instanceof Error ? v : new Error(String(v));
}
