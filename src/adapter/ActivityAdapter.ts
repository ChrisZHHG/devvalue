import * as vscode from 'vscode';
import type { ActivityEventType } from '../core/types.js';
import type { PtaFlowEngine } from '../core/PtaFlowEngine.js';
import type { GitResolver } from '../core/GitResolver.js';

/**
 * Subscribes to VS Code events and forwards them as ActivityEvents to PtaFlowEngine.
 * Debounces noisy events (edit) and polls for branch changes every 30 s.
 */
export class ActivityAdapter implements vscode.Disposable {
  private branchName = 'HEAD';
  private readonly disposables: vscode.Disposable[] = [];
  private editDebounceTimer?: NodeJS.Timeout;
  private pollInterval?: NodeJS.Timeout;

  constructor(
    private readonly engine: PtaFlowEngine,
    private readonly resolver: GitResolver,
  ) {}

  activate(): void {
    void this.refreshBranch();
    this.pollInterval = setInterval(() => void this.refreshBranch(), 30_000);

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        void this.refreshBranch();
        this.fire('file_switch');
      }),
      vscode.workspace.onDidChangeTextDocument(() => {
        if (this.editDebounceTimer) {
          clearTimeout(this.editDebounceTimer);
        }
        this.editDebounceTimer = setTimeout(() => this.fire('edit'), 500);
      }),
      vscode.debug.onDidStartDebugSession(() => this.fire('debug_action')),
      vscode.debug.onDidTerminateDebugSession(() => this.fire('debug_action')),
      vscode.window.onDidOpenTerminal(() => this.fire('terminal_command')),
      vscode.window.onDidChangeActiveTerminal(() => this.fire('terminal_command')),
      vscode.tasks.onDidStartTask(() => this.fire('build_run')),
    );
  }

  dispose(): void {
    clearInterval(this.pollInterval);
    if (this.editDebounceTimer) {
      clearTimeout(this.editDebounceTimer);
    }
    for (const d of this.disposables) {
      d.dispose();
    }
  }

  private async refreshBranch(): Promise<void> {
    this.branchName = await this.resolver.currentBranch();
  }

  private fire(type: ActivityEventType): void {
    this.engine.recordEvent({
      type,
      timestamp: Date.now(),
      branchName: this.branchName,
    });
  }
}
