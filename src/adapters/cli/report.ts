import * as os from 'node:os';
import * as path from 'node:path';

import { CostCalculator } from '../../core/CostCalculator.js';
import { GitResolver } from '../../core/GitResolver.js';
import { HistoricalTokenReader } from '../../core/HistoricalTokenReader.js';
import type { TokenUsage } from '../../core/types.js';

export interface ReportOptions {
  workspaceRoot: string;
  hourlyRate: number;
  jsonOutput: boolean;
  branch?: string;
  includeBackground: boolean;
}

/** Same encoding as extension.ts — kept in sync manually. */
function workspaceToClaudeProjectDir(workspaceRoot: string): string {
  const encoded = workspaceRoot.replace(/[/ ]/g, '-');
  return path.join(os.homedir(), '.claude', 'projects', encoded);
}

export async function runReport(opts: ReportOptions): Promise<void> {
  const resolver = new GitResolver(opts.workspaceRoot);
  const currentBranch = await resolver.currentBranch();
  const calc = new CostCalculator(opts.hourlyRate);

  const claudeProjectDir = workspaceToClaudeProjectDir(opts.workspaceRoot);
  const snifferGlob = path.join(claudeProjectDir, '*.jsonl');

  const reader = new HistoricalTokenReader(snifferGlob);
  let allUsages: TokenUsage[];
  try {
    allUsages = await reader.readAll();
  } catch (err) {
    console.error(`Error reading Claude logs: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // Deduplicate by uuid (handles multiple reads of the same records).
  const seen = new Set<string>();
  const usages = allUsages.filter(u => {
    if (!u.uuid) { return true; }
    if (seen.has(u.uuid)) { return false; }
    seen.add(u.uuid);
    return true;
  });

  // Group by branch name.
  const byBranch = new Map<string, TokenUsage[]>();
  for (const u of usages) {
    const branch = u.branchName || '(unknown)';
    if (!byBranch.has(branch)) { byBranch.set(branch, []); }
    byBranch.get(branch)!.push(u);
  }

  // Determine branches to show, sorted by AI cost descending.
  const allBranches = [...byBranch.keys()].sort((a, b) => {
    const costA = calc.breakdown(0, byBranch.get(a)!, opts.includeBackground).aiCostUsd;
    const costB = calc.breakdown(0, byBranch.get(b)!, opts.includeBackground).aiCostUsd;
    return costB - costA;
  });

  const branches = opts.branch
    ? allBranches.filter(b => b === opts.branch)
    : allBranches;

  if (opts.jsonOutput) {
    const output = branches.map(branch => {
      const bu = byBranch.get(branch) ?? [];
      const breakdown = calc.breakdown(0, bu, opts.includeBackground);
      return {
        branch,
        isCurrent: branch === currentBranch,
        aiCostUsd: breakdown.aiCostUsd,
        inputTokens: bu.reduce((s, u) => s + u.inputTokens, 0),
        outputTokens: bu.reduce((s, u) => s + u.outputTokens, 0),
        models: [...new Set(bu.map(u => u.model))],
      };
    });
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  renderTable({ branches, byBranch, currentBranch, calc, opts });
}

// ── Table renderer ────────────────────────────────────────────────────────────

interface RenderArgs {
  branches: string[];
  byBranch: Map<string, TokenUsage[]>;
  currentBranch: string;
  calc: CostCalculator;
  opts: ReportOptions;
}

const COL_BRANCH  = 36;
const COL_COST    = 12;
const COL_TOKENS  = 18;
const COL_MODELS  = 26;

function hr(w: number): string { return '─'.repeat(w); }
function cell(s: string, w: number): string {
  if (s.length > w) { return s.slice(0, w - 1) + '…'; }
  return s.padEnd(w);
}

function renderTable({ branches, byBranch, currentBranch, calc, opts }: RenderArgs): void {
  console.log(`\nDevValue Report — ${opts.workspaceRoot}`);
  console.log(`Current branch : ${currentBranch}`);
  console.log(`Hourly rate    : $${opts.hourlyRate}/hr\n`);

  if (branches.length === 0) {
    console.log('No Claude Code usage found for this workspace.');
    console.log(`Looked in: ${workspaceToClaudeProjectDir(opts.workspaceRoot)}/*.jsonl`);
    return;
  }

  const top    = '┌' + hr(COL_BRANCH) + '┬' + hr(COL_COST) + '┬' + hr(COL_TOKENS) + '┬' + hr(COL_MODELS) + '┐';
  const mid    = '├' + hr(COL_BRANCH) + '┼' + hr(COL_COST) + '┼' + hr(COL_TOKENS) + '┼' + hr(COL_MODELS) + '┤';
  const bottom = '└' + hr(COL_BRANCH) + '┴' + hr(COL_COST) + '┴' + hr(COL_TOKENS) + '┴' + hr(COL_MODELS) + '┘';

  console.log(top);
  console.log(
    '│' + cell(' Branch', COL_BRANCH) +
    '│' + cell(' AI Cost', COL_COST) +
    '│' + cell(' Tokens (in / out)', COL_TOKENS) +
    '│' + cell(' Models', COL_MODELS) + '│',
  );
  console.log(mid);

  for (const branch of branches) {
    const bu = byBranch.get(branch) ?? [];
    const breakdown = calc.breakdown(0, bu, opts.includeBackground);
    const inputTokens  = bu.reduce((s, u) => s + u.inputTokens, 0);
    const outputTokens = bu.reduce((s, u) => s + u.outputTokens, 0);
    const models = [...new Set(bu.map(u => u.model))];

    const marker = branch === currentBranch ? '*' : ' ';
    console.log(
      '│' + cell(` ${marker} ${branch}`, COL_BRANCH) +
      '│' + cell(` $${breakdown.aiCostUsd.toFixed(4)}`, COL_COST) +
      '│' + cell(` ${fmtN(inputTokens)} / ${fmtN(outputTokens)}`, COL_TOKENS) +
      '│' + cell(` ${models.join(', ')}`, COL_MODELS) + '│',
    );
  }

  console.log(bottom);

  const totalUsages = branches.flatMap(b => byBranch.get(b) ?? []);
  const total = calc.breakdown(0, totalUsages, opts.includeBackground);
  console.log(`\nTotal AI cost: $${total.aiCostUsd.toFixed(4)}`);

  if (!opts.includeBackground) {
    console.log('(Sidechain/background usage excluded — run with --include-background to include.)');
  }
}

function fmtN(n: number): string {
  if (n >= 1_000_000) { return `${(n / 1_000_000).toFixed(1)}M`; }
  if (n >= 1_000)     { return `${(n / 1_000).toFixed(1)}K`; }
  return String(n);
}
