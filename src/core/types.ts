export type ActivityEventType =
  | 'file_switch'
  | 'log_read'
  | 'build_run'
  | 'test_run'
  | 'debug_action'
  | 'terminal_command'
  | 'edit';

export interface ActivityEvent {
  type: ActivityEventType;
  /** Unix milliseconds */
  timestamp: number;
  branchName: string;
}

export interface FlowState {
  /** true when eventRate >= flowThreshold */
  isInFlow: boolean;
  /** Events counted in the last 60 s window (= events/min) */
  eventRate: number;
  /** Effective idle timeout in milliseconds */
  idleTimeout: number;
  /** true when (now - lastEventTime) > idleTimeout */
  isIdle: boolean;
}

export interface TokenUsage {
  /** JSONL record UUID — used for deduplication across restarts. */
  uuid?: string;
  /** Unix milliseconds */
  timestamp: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  /** true = context compaction / summarisation — not a direct user turn */
  isBackground: boolean;
  sessionId: string;
  branchName: string;
}

export interface Session {
  id: string;
  branchName: string;
  /** Unix milliseconds */
  startTime: number;
  /** Unix milliseconds; undefined while the session is still active */
  endTime?: number;
  /** Cumulative active seconds, idle gaps excluded */
  focusSeconds: number;
  tokenUsage: TokenUsage[];
}

export interface CostBreakdown {
  humanCostUsd: number;
  /** Sum of token costs; background usage excluded by default */
  aiCostUsd: number;
  totalCostUsd: number;
  focusHours: number;
}

export interface DevValueConfig {
  /** Hourly rate in USD. Extension setting: devvalue.hourlyRate. Default 75. */
  hourlyRate: number;
  /** Base idle timeout in seconds. Extension setting: devvalue.maxIdleTimeout. Default 300. */
  maxIdleTimeout: number;
  /** Events/min threshold to enter flow state. Extension setting: devvalue.flowThreshold. Default 3. */
  flowThreshold: number;
  /** Glob for Claude Code JSONL logs. Extension setting: devvalue.claudeLogGlob. */
  claudeLogGlob: string;
  /** Extension setting: devvalue.enableStatusBar. Default true. */
  enableStatusBar: boolean;
}
