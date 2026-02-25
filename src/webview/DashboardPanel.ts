import * as vscode from 'vscode';

import { CostCalculator } from '../core/CostCalculator.js';
import type { DevValueConfig, Session } from '../core/types.js';
import { getDashboardHtml } from './dashboardHtml.js';

export interface DashboardState {
  sessions: Map<string, Session>;
  currentBranch: string;
  config: DevValueConfig;
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export class DashboardPanel implements vscode.Disposable {
  static currentPanel: DashboardPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _onSetRate: (rate: number) => void;
  private readonly _onResetBranch: (branch: string) => Promise<void>;
  private _lastState: DashboardState | undefined;

  static createOrShow(
    state: DashboardState,
    onSetRate: (rate: number) => void,
    onResetBranch: (branch: string) => Promise<void>,
  ): void {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel._panel.reveal(column);
      DashboardPanel.currentPanel.update(state);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'devvalueDashboard',
      'DevValue Dashboard',
      column,
      { enableScripts: true, retainContextWhenHidden: true },
    );

    DashboardPanel.currentPanel = new DashboardPanel(panel, onSetRate, onResetBranch);
    DashboardPanel.currentPanel.update(state);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    onSetRate: (rate: number) => void,
    onResetBranch: (branch: string) => Promise<void>,
  ) {
    this._panel = panel;
    this._onSetRate = onSetRate;
    this._onResetBranch = onResetBranch;

    this._panel.webview.html = getDashboardHtml(getNonce());

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.onDidChangeViewState(
      ({ webviewPanel }) => {
        if (webviewPanel.visible && this._lastState) {
          this._send(this._lastState);
        }
      },
      null,
      this._disposables,
    );

    this._panel.webview.onDidReceiveMessage(
      (msg: { type: string; hourlyRate?: number; branchName?: string }) => {
        if (msg.type === 'setRate' && typeof msg.hourlyRate === 'number') {
          this._onSetRate(msg.hourlyRate);
        } else if (msg.type === 'resetBranch' && typeof msg.branchName === 'string') {
          void this._onResetBranch(msg.branchName);
        } else if (msg.type === 'requestUpdate' && this._lastState) {
          this._send(this._lastState);
        }
      },
      null,
      this._disposables,
    );
  }

  update(state: DashboardState): void {
    this._lastState = state;
    if (this._panel.visible) {
      this._send(state);
    }
  }

  private _send(state: DashboardState): void {
    const calc = new CostCalculator(state.config.hourlyRate);
    const sessions = Array.from(state.sessions.values()).map((s) => ({
      ...s,
      breakdown: calc.sessionBreakdown(s),
    }));
    void this._panel.webview.postMessage({
      type: 'update',
      sessions,
      currentBranch: state.currentBranch,
      config: { hourlyRate: state.config.hourlyRate },
    });
  }

  dispose(): void {
    DashboardPanel.currentPanel = undefined;
    this._panel.dispose();
    for (const d of this._disposables) {
      d.dispose();
    }
  }
}
