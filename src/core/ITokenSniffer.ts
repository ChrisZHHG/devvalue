import type { TokenUsage } from './types.js';

/**
 * Swap-point for the token ingestion backend.
 *
 * The default implementation (JsonlTokenSniffer) stream-parses Claude Code's
 * JSONL session logs. A future implementation could listen to an OpenTelemetry
 * OTLP endpoint instead — without changing any consumer code.
 */
export interface ITokenSniffer {
  /** Begin watching log sources and emitting usage events. */
  start(): void;
  /** Stop watching and release all resources. */
  stop(): void;
  on(event: 'usage', listener: (usage: TokenUsage) => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
}
