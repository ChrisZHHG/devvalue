import * as vscode from 'vscode';
import type { CostBreakdown } from '../core/types.js';

/**
 * Renders cost and focus time in the VS Code status bar.
 * Format: $(clock) 2h 15m | $(git-branch) main | $148.50
 * Tooltip:  Human: $X.XX  AI: $X.XX
 */
export class StatusBarAdapter implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor(private enabled: boolean) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100,
    );
    this.item.command = 'devvalue.openDashboard';
    this.item.text = '$(clock) DevValue';
    if (enabled) {
      this.item.show();
    }
  }

  update(branch: string, breakdown: CostBreakdown): void {
    if (!this.enabled) {
      return;
    }

    const totalMinutes = Math.floor(breakdown.focusHours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const timeStr = h === 0 ? `${m}m` : `${h}h ${m}m`;

    this.item.text = `$(clock) ${timeStr} | $(git-branch) ${branch} | $${breakdown.totalCostUsd.toFixed(2)}`;
    this.item.tooltip = `Human: $${breakdown.humanCostUsd.toFixed(2)}  AI: $${breakdown.aiCostUsd.toFixed(2)}`;
    this.item.show();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.item.hide();
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
