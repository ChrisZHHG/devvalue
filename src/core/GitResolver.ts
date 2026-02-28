import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Resolves the current git branch for a given working directory.
 * Pure TypeScript — no `vscode` imports.
 */
export class GitResolver {
  constructor(readonly cwd: string) {}

  async currentBranch(): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        { cwd: this.cwd },
      );
      return stdout.trim() || 'HEAD';
    } catch {
      return 'HEAD';
    }
  }

  /** Returns all local branch names. */
  async allBranches(): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['branch', '--format=%(refname:short)'],
        { cwd: this.cwd },
      );
      return stdout.split('\n').map(b => b.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Determine which local branch HEAD was pointing to at a given time by
   * walking the git reflog (ordered newest → oldest).
   *
   * Finds the most recent "checkout" reflog entry whose timestamp is ≤
   * `timestampMs` and returns the destination branch of that checkout.
   * If no checkout is found before `timestampMs` (user was on the initial
   * branch the whole time), falls back to the current branch.
   */
  async branchAtTime(timestampMs: number): Promise<string> {
    try {
      // git reflog --date=unix outputs lines like:
      //   abc123 HEAD@{1708840000}: checkout: moving from master to fix/dedup
      const { stdout } = await execFileAsync(
        'git',
        ['reflog', '--date=unix'],
        { cwd: this.cwd },
      );

      // reflog is newest-first; first match with ts ≤ timestampMs is the answer
      for (const line of stdout.split('\n')) {
        const m = line.match(/HEAD@\{(\d+)\}: checkout: moving from .+ to (.+)$/);
        if (!m) { continue; }
        const ts = Number(m[1]) * 1000;
        if (ts <= timestampMs) {
          return m[2].trim();
        }
      }

      // No checkout before this timestamp — user was on the repo's initial branch.
      // Use the current branch as a proxy (works correctly for projects that start
      // on master and only branch out later).
      const current = await this.currentBranch();
      return (current !== 'HEAD') ? current : 'master';
    } catch {
      return 'HEAD';
    }
  }
}
