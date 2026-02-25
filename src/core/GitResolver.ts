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
}
