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
 * Internal type: a fully parsed record before streaming-dedup is applied.
 * `stopReason` is the raw `stop_reason` from the API response.
 */
interface ParsedRecord {
  /** `message.id` from the API response — globally unique per API call. */
  messageId: string;
  /** null  = streaming partial frame (not yet billable)
   *  other = final frame (billable, has correct output_tokens) */
  stopReason: string | null;
  usage: TokenUsage;
}

/**
 * Reads Claude Code's JSONL session logs and emits a `TokenUsage` event for
 * every unique API call.
 *
 * **Streaming dedup**: Claude Code writes multiple JSONL records per API call
 * during response streaming.  Only the record with `stop_reason != null` carries
 * the correct final `output_tokens`.  When no final frame is present (older
 * sessions), the last partial frame is used instead.  All frames are keyed by
 * `message.id`; only the best frame is emitted.
 *
 * **Subagent (Haiku) detection**: Tool-use subagent calls are logged both as
 * `type:"assistant"` records in the subagent's own JSONL file and as
 * `type:"progress"` records nested inside the parent session's JSONL.  Because
 * both carry the same `message.id` they are naturally deduplicated.
 *
 * **Streaming**: files are read incrementally from a byte offset — full file
 * contents are never held in memory.
 *
 * **Tailing**: `fs.watch` detects appends; a background poll finds newly created
 * log files every 10 s.
 */
export class JsonlTokenSniffer extends EventEmitter implements ITokenSniffer {
  private readonly expandedGlob: string;

  /** Last byte offset read per file. */
  private readonly fileOffsets = new Map<string, number>();

  /** Active `fs.FSWatcher` per file. */
  private readonly watchers = new Map<string, fs.FSWatcher>();

  /**
   * Buffer of partial (stop_reason=null) frames, keyed by `message.id`.
   *
   * Invariant: an entry is present iff we have seen ≥1 partial frame for that
   * message.id and no final frame yet.  When a final frame arrives the entry is
   * deleted and the final frame is emitted immediately.  On `stop()` every
   * remaining entry is flushed (old-format sessions that never emit a final frame).
   */
  private readonly pending = new Map<string, ParsedRecord>();

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

    // Flush pending partial frames (old-format sessions with no final frame).
    for (const rec of this.pending.values()) {
      this.emit('usage', rec.usage);
    }
    this.pending.clear();

    for (const watcher of this.watchers.values()) {watcher.close();}
    this.watchers.clear();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

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
   * Stream-read any bytes appended since the last read, applying streaming
   * deduplication via the `pending` buffer.
   */
  private async readNewLines(filePath: string): Promise<void> {
    const offset = this.fileOffsets.get(filePath) ?? 0;

    let stat: fs.Stats;
    try {
      stat = await fsp.stat(filePath);
    } catch {
      return;
    }

    if (stat.size <= offset) {return;}

    await new Promise<void>((resolve, reject) => {
      const stream = fs.createReadStream(filePath, {
        start: offset,
        encoding: 'utf8',
      });

      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

      rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed) {return;}
        const parsed = this.parseLine(trimmed);
        if (!parsed) {return;}
        this.ingestParsed(parsed);
      });

      rl.on('close', () => {
        this.fileOffsets.set(filePath, stat.size);
        resolve();
      });

      rl.on('error', reject);
      stream.on('error', reject);
    });
  }

  /**
   * Apply streaming deduplication logic:
   *
   * - Final frame (`stopReason != null`): emit immediately, discard any
   *   buffered partial for the same message.
   * - Partial frame (`stopReason == null`): store/replace in `pending`.
   *   The last partial written before a final frame has the most complete
   *   `output_tokens` value.
   */
  private ingestParsed(rec: ParsedRecord): void {
    if (rec.stopReason !== null) {
      // Final billable frame — emit and clear any buffered partial.
      this.pending.delete(rec.messageId);
      this.emit('usage', rec.usage);
    } else {
      // Partial frame — replace with newest (accumulates output_tokens).
      this.pending.set(rec.messageId, rec);
    }
  }

  /**
   * Parse one JSONL line.
   *
   * Handles two record types:
   *   1. `type:"assistant"` — direct assistant records (Sonnet main session).
   *   2. `type:"progress"` — subagent API calls mirrored into the parent
   *      session as nested progress events (`data.message.message`).
   *
   * Returns `null` for records that have no token usage.
   */
  private parseLine(line: string): ParsedRecord | null {
    let record: unknown;
    try {
      record = JSON.parse(line);
    } catch {
      return null;
    }

    if (!isObj(record)) {return null;}

    const recordType = record['type'];

    if (recordType === 'assistant') {
      return this.parseAssistantRecord(record);
    }

    if (recordType === 'progress') {
      return this.parseProgressRecord(record);
    }

    return null;
  }

  /** Parse a `type:"assistant"` record. */
  private parseAssistantRecord(record: Record<string, unknown>): ParsedRecord | null {
    const message = record['message'];
    if (!isObj(message)) {return null;}

    const usage = message['usage'];
    if (!isObj(usage)) {return null;}

    const messageId = typeof message['id'] === 'string' ? message['id'] : null;
    if (!messageId) {return null;}

    const stopReason =
      typeof message['stop_reason'] === 'string' ? message['stop_reason'] : null;

    const model =
      typeof message['model'] === 'string' ? message['model'] : 'unknown';

    const rawTs = record['timestamp'];
    const timestamp =
      typeof rawTs === 'string' ? new Date(rawTs).getTime() : Date.now();

    return this.buildRecord({
      record,
      message,
      messageId,
      stopReason,
      model,
      timestamp,
      usage,
    });
  }

  /**
   * Parse a `type:"progress"` record.
   *
   * Structure: `{ data: { message: { type:"assistant", message: { id, model,
   *   usage, stop_reason } } } }`.
   *
   * These are subagent calls (e.g. Haiku) mirrored into the parent session.
   */
  private parseProgressRecord(record: Record<string, unknown>): ParsedRecord | null {
    const data = record['data'];
    if (!isObj(data)) {return null;}

    const outerMsg = data['message'];
    if (!isObj(outerMsg)) {return null;}

    const innerMsg = outerMsg['message'];
    if (!isObj(innerMsg)) {return null;}

    const usage = innerMsg['usage'];
    if (!isObj(usage)) {return null;}

    const messageId = typeof innerMsg['id'] === 'string' ? innerMsg['id'] : null;
    if (!messageId) {return null;}

    const stopReason =
      typeof innerMsg['stop_reason'] === 'string' ? innerMsg['stop_reason'] : null;

    const model =
      typeof innerMsg['model'] === 'string' ? innerMsg['model'] : 'unknown';

    const rawTs = record['timestamp'];
    const timestamp =
      typeof rawTs === 'string' ? new Date(rawTs).getTime() : Date.now();

    return this.buildRecord({
      record,
      message: innerMsg,
      messageId,
      stopReason,
      model,
      timestamp,
      usage,
    });
  }

  private buildRecord(opts: {
    record: Record<string, unknown>;
    message: Record<string, unknown>;
    messageId: string;
    stopReason: string | null;
    model: string;
    timestamp: number;
    usage: Record<string, unknown>;
  }): ParsedRecord {
    const { record, messageId, stopReason, model, timestamp, usage } = opts;

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

    const tokenUsage: TokenUsage = {
      uuid:            typeof record['uuid'] === 'string' ? record['uuid'] : undefined,
      messageId,
      timestamp,
      model,
      inputTokens,
      outputTokens,
      cacheWriteTokens,
      cacheReadTokens,
      costUsd,
      isBackground:    record['isSidechain'] === true,
      sessionId:       typeof record['sessionId'] === 'string' ? record['sessionId'] : '',
      branchName:      typeof record['gitBranch'] === 'string' ? record['gitBranch'] : '',
    };

    return { messageId, stopReason, usage: tokenUsage };
  }
}

// ── Glob expansion ─────────────────────────────────────────────────────────

/**
 * Expand a glob pattern containing `*` wildcards into a list of real file paths.
 */
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
      if (!entry.name.endsWith(suffix)) {continue;}
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
