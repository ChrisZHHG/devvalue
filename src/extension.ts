import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

import { CostCalculator } from './core/CostCalculator.js';
import { GitResolver } from './core/GitResolver.js';
import { PtaFlowEngine } from './core/PtaFlowEngine.js';
import type { DevValueConfig, Session, TokenUsage } from './core/types.js';
import { ActivityAdapter } from './adapter/ActivityAdapter.js';
import { FileWatcherAdapter } from './adapter/FileWatcherAdapter.js';
import { StorageAdapter } from './adapter/StorageAdapter.js';
import { StatusBarAdapter } from './adapter/StatusBarAdapter.js';
import { DashboardPanel } from './webview/DashboardPanel.js';

// Module-level refs so deactivate() can flush sessions on shutdown.
let _shutdownStorage: StorageAdapter | undefined;
let _shutdownSessions: Map<string, Session> | undefined;

function readConfig(): DevValueConfig {
  const c = vscode.workspace.getConfiguration('devvalue');
  return {
    hourlyRate:      c.get('hourlyRate',      75),
    maxIdleTimeout:  c.get('maxIdleTimeout',  300),
    flowThreshold:   c.get('flowThreshold',   3),
    claudeLogGlob:   c.get('claudeLogGlob',   '~/.claude/projects/*/*.jsonl'),
    enableStatusBar: c.get('enableStatusBar', true),
  };
}

/**
 * Derive the Claude Code project directory for a workspace root.
 *
 * Claude Code encodes the workspace path as the project dir name by replacing
 * every `/` and space with `-`. For example:
 *   /Users/alice/my project  →  ~/.claude/projects/-Users-alice-my-project
 */
function workspaceToClaudeProjectDir(workspaceRoot: string): string {
  const encoded = workspaceRoot.replace(/[/ ]/g, '-');
  return path.join(os.homedir(), '.claude', 'projects', encoded);
}

function getOrCreate(sessions: Map<string, Session>, branch: string): Session {
  if (!sessions.has(branch)) {
    sessions.set(branch, {
      id: `${branch}-${Date.now()}`,
      branchName: branch,
      startTime: Date.now(),
      focusSeconds: 0,
      tokenUsage: [],
    });
  }
  return sessions.get(branch)!;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('[DevValue] activate() called');
  let config = readConfig();

  const outputChannel = vscode.window.createOutputChannel('DevValue');
  const workspaceRoot =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? os.homedir();

  const resolver = new GitResolver(workspaceRoot);
  let engine = new PtaFlowEngine(config);
  let calc = new CostCalculator(config.hourlyRate);

  // One-time migration: move globalState sessions into workspaceState.
  const MIGRATION_KEY = 'devvalue.globalStateMigrated';
  const SESSION_KEY = 'devvalue.sessions';
  if (!context.workspaceState.get<boolean>(MIGRATION_KEY)) {
    const globalData = context.globalState.get<unknown[]>(SESSION_KEY);
    if (globalData && globalData.length > 0) {
      await context.workspaceState.update(SESSION_KEY, globalData);
    }
    await context.workspaceState.update(MIGRATION_KEY, true);
    await context.globalState.update(SESSION_KEY, undefined);
  }

  const storage = new StorageAdapter(context.workspaceState);
  const sessions = storage.loadSessions();

  // Expose to deactivate() for shutdown flush.
  _shutdownStorage = storage;
  _shutdownSessions = sessions;

  // Build seen-UUID set from persisted sessions so we skip records that were
  // already counted in a previous run (restart deduplication).
  const seenUuids = new Set<string>();
  for (const session of sessions.values()) {
    for (const u of session.tokenUsage) {
      if (u.uuid) { seenUuids.add(u.uuid); }
    }
  }

  let currentBranch = await resolver.currentBranch();

  let baseFocus = sessions.get(currentBranch)?.focusSeconds ?? 0;

  const activityAdapter = new ActivityAdapter(engine, resolver);
  activityAdapter.activate();

  // Scope the sniffer to this workspace's Claude project directory only.
  // Claude Code maps /path/to/workspace → ~/.claude/projects/-path-to-workspace/
  const claudeProjectDir = workspaceToClaudeProjectDir(workspaceRoot);
  const snifferGlob = path.join(claudeProjectDir, '*.jsonl');
  outputChannel.appendLine(`[DevValue] Watching Claude logs: ${snifferGlob}`);

  const fileWatcher = new FileWatcherAdapter(
    snifferGlob,
    onUsage,
    outputChannel,
  );
  fileWatcher.start();

  console.log('[DevValue] Creating StatusBarAdapter, enableStatusBar=', config.enableStatusBar);
  const statusBar = new StatusBarAdapter(config.enableStatusBar);
  console.log('[DevValue] StatusBarAdapter created');

  // Show initial state immediately — don't wait for the first tick.
  statusBar.update(currentBranch, calc.sessionBreakdown(getOrCreate(sessions, currentBranch)));
  console.log('[DevValue] Initial statusBar.update() called, branch=', currentBranch);

  let tickCount = 0;

  async function tick(): Promise<void> {
    console.log('[DevValue] tick fired, currentBranch=', currentBranch);
    const newBranch = await resolver.currentBranch();
    if (newBranch !== currentBranch) {
      // Guardrail: save immediately on branch switch so seenUuids are always
      // persisted before we change context. Without this, a VS Code restart on
      // the new branch would re-read old JSONL entries (byte offset resets)
      // and — when gitBranch is absent in the record — wrongly attribute them
      // to the new branch because those UUIDs weren't in the saved sessions.
      const old = getOrCreate(sessions, currentBranch);
      old.focusSeconds = baseFocus + engine.getActiveSeconds();
      await storage.saveSessions(sessions);

      outputChannel.appendLine(
        `[DevValue] Branch switched: ${currentBranch} → ${newBranch}. Sessions flushed.`,
      );

      currentBranch = newBranch;
      engine.reset();
      baseFocus = sessions.get(newBranch)?.focusSeconds ?? 0;
    }

    const current = getOrCreate(sessions, currentBranch);
    current.focusSeconds = baseFocus + engine.getActiveSeconds();
    const breakdown = calc.sessionBreakdown(current);
    statusBar.update(currentBranch, breakdown);

    DashboardPanel.currentPanel?.update({ sessions, currentBranch, config });

    // Save focusSeconds every 30 s — losing a few seconds of focus time on an
    // unexpected crash is acceptable. UUID dedup is saved immediately in
    // onUsage() where it matters.
    tickCount++;
    if (tickCount % 30 === 0) {
      await storage.saveSessions(sessions);
    }
  }

  function onUsage(usage: TokenUsage): void {
    if (usage.uuid) {
      if (seenUuids.has(usage.uuid)) { return; }
      seenUuids.add(usage.uuid);
    }
    const branch = usage.branchName || currentBranch;
    const session = getOrCreate(sessions, branch);
    session.tokenUsage.push(usage);
    // Save immediately so the new UUID is persisted before any restart.
    // This is the critical guardrail against cross-branch token re-attribution.
    void storage.saveSessions(sessions);
  }

  const tickHandle = setInterval(
    () => tick().catch((err: unknown) =>
      outputChannel.appendLine(`[DevValue] Tick error: ${err instanceof Error ? err.message : String(err)}`),
    ),
    1_000,
  );

  const cmdDashboard = vscode.commands.registerCommand(
    'devvalue.openDashboard',
    () => {
      DashboardPanel.createOrShow(
        { sessions, currentBranch, config },
        (rate) => {
          void vscode.workspace.getConfiguration('devvalue')
            .update('hourlyRate', rate, vscode.ConfigurationTarget.Global);
        },
        async (branch) => {
          sessions.delete(branch);
          if (branch === currentBranch) {
            engine.reset();
            baseFocus = 0;
          }
          await storage.saveSessions(sessions);
          vscode.window.showInformationMessage(
            `DevValue: Reset data for branch "${branch}".`,
          );
        },
      );
    },
  );

  const cmdStart = vscode.commands.registerCommand(
    'devvalue.startTracking',
    () => {
      engine.reset();
      fileWatcher.start();
      vscode.window.showInformationMessage('DevValue: Tracking started.');
    },
  );

  const cmdStop = vscode.commands.registerCommand(
    'devvalue.stopTracking',
    () => {
      fileWatcher.dispose();
      vscode.window.showInformationMessage('DevValue: Tracking stopped.');
    },
  );

  const cmdReset = vscode.commands.registerCommand(
    'devvalue.resetBranch',
    async () => {
      sessions.delete(currentBranch);
      engine.reset();
      baseFocus = 0;
      await storage.saveSessions(sessions);
      vscode.window.showInformationMessage(
        `DevValue: Reset data for branch "${currentBranch}".`,
      );
    },
  );

  const cmdExport = vscode.commands.registerCommand(
    'devvalue.exportData',
    async () => {
      const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!folder) {
        vscode.window.showErrorMessage('DevValue: No workspace folder open.');
        return;
      }
      const exportData = JSON.stringify(
        Array.from(sessions.values()),
        null,
        2,
      );
      const exportPath = path.join(folder, '.devvalue-export.json');
      await fs.writeFile(exportPath, exportData, 'utf8');
      const doc = await vscode.workspace.openTextDocument(exportPath);
      await vscode.window.showTextDocument(doc);
    },
  );

  const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('devvalue')) {
      config = readConfig();
      engine = new PtaFlowEngine(config);
      calc = new CostCalculator(config.hourlyRate);
      statusBar.setEnabled(config.enableStatusBar);
    }
  });

  context.subscriptions.push(
    outputChannel,
    activityAdapter,
    fileWatcher,
    statusBar,
    { dispose: () => clearInterval(tickHandle) },
    cmdDashboard,
    cmdStart,
    cmdStop,
    cmdReset,
    cmdExport,
    configWatcher,
  );
}

export async function deactivate(): Promise<void> {
  // Final flush so seenUuids survive a clean shutdown (window close, reload).
  if (_shutdownStorage && _shutdownSessions) {
    await _shutdownStorage.saveSessions(_shutdownSessions);
  }
}
