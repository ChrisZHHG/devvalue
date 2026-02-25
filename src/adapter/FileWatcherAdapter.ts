import type * as vscode from 'vscode';
import { JsonlTokenSniffer } from '../core/JsonlTokenSniffer.js';
import type { TokenUsage } from '../core/types.js';

/**
 * Thin lifecycle wrapper around JsonlTokenSniffer that implements vscode.Disposable.
 * Sniffer errors are logged to the output channel and never thrown.
 */
export class FileWatcherAdapter implements vscode.Disposable {
  private readonly sniffer: JsonlTokenSniffer;

  constructor(
    globPattern: string,
    onUsage: (usage: TokenUsage) => void,
    outputChannel: vscode.OutputChannel,
  ) {
    this.sniffer = new JsonlTokenSniffer(globPattern);
    this.sniffer.on('usage', onUsage);
    this.sniffer.on('error', (err) =>
      outputChannel.appendLine(`[DevValue] Token sniffer error: ${err.message}`),
    );
  }

  start(): void {
    this.sniffer.start();
  }

  dispose(): void {
    this.sniffer.stop();
  }
}
