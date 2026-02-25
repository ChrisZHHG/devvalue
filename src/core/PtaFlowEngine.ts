import type { ActivityEvent, DevValueConfig, FlowState } from './types.js';

/** Multiplier applied to maxIdleTimeout when the developer is in flow (5 min → 20 min). */
const FLOW_MULTIPLIER = 4;

/** Length of the sliding window used to compute event rate (ms). */
const WINDOW_MS = 60_000;

/**
 * PTA Flow Engine — detects whether a developer is in an active flow state and
 * accumulates focus time by excluding idle gaps.
 *
 * "Active time" is not just typing: rapidly switching files, reading logs, and
 * running builds all count. When the event rate exceeds `flowThreshold`, the
 * effective AFK timeout is extended from `maxIdleTimeout` to `maxIdleTimeout × 4`
 * (default 5 min → 20 min), preventing the clock from stopping mid-flow.
 *
 * All timestamps are Unix milliseconds.
 */
export class PtaFlowEngine {
  private readonly maxIdleTimeoutMs: number;
  private readonly flowThreshold: number;

  /** Timestamps (ms) of events within the current 60 s window. */
  private eventWindow: number[] = [];

  /** Timestamp of the most recent event; 0 before any event is recorded. */
  private lastEventTime = 0;

  /** Accumulated active milliseconds (idle gaps excluded). */
  private activeMs = 0;

  constructor(config: Pick<DevValueConfig, 'maxIdleTimeout' | 'flowThreshold'>) {
    this.maxIdleTimeoutMs = config.maxIdleTimeout * 1000;
    this.flowThreshold = config.flowThreshold;
  }

  /**
   * Record an activity event.
   *
   * The gap since the previous event is credited to active time only if it is
   * shorter than the idle timeout that was in effect *before* this event arrives
   * (i.e., based on the flow state computed from the existing window). This
   * preserves correct behaviour when the developer's pace changes mid-gap.
   */
  recordEvent(event: ActivityEvent): void {
    if (this.lastEventTime > 0) {
      const gap = event.timestamp - this.lastEventTime;
      // Use the timeout in effect for the gap (before adding the new event).
      const { idleTimeout } = this.getFlowState(this.lastEventTime);
      if (gap <= idleTimeout) {
        this.activeMs += gap;
      }
      // Gaps longer than idleTimeout are simply discarded (idle time).
    }

    // Advance the window: prune events outside the 60 s window relative to the
    // new event's timestamp, then append.
    const cutoff = event.timestamp - WINDOW_MS;
    this.eventWindow = this.eventWindow.filter(t => t > cutoff);
    this.eventWindow.push(event.timestamp);

    this.lastEventTime = event.timestamp;
  }

  /**
   * Return the current flow state.
   *
   * @param now  Override for "current time" (Unix ms). Defaults to Date.now().
   *             Useful in tests and for evaluating the state at a past moment.
   */
  getFlowState(now: number = Date.now()): FlowState {
    const cutoff = now - WINDOW_MS;
    const recentEvents = this.eventWindow.filter(t => t > cutoff);
    const eventRate = recentEvents.length; // events in last 60 s = events/min
    const isInFlow = eventRate >= this.flowThreshold;
    const idleTimeout = isInFlow
      ? this.maxIdleTimeoutMs * FLOW_MULTIPLIER
      : this.maxIdleTimeoutMs;
    const isIdle =
      this.lastEventTime > 0 && now - this.lastEventTime > idleTimeout;

    return { isInFlow, eventRate, idleTimeout, isIdle };
  }

  /** Accumulated active time in seconds (idle gaps excluded). */
  getActiveSeconds(): number {
    return this.activeMs / 1000;
  }

  /** Reset all state (e.g. when starting a new tracking session). */
  reset(): void {
    this.eventWindow = [];
    this.lastEventTime = 0;
    this.activeMs = 0;
  }
}
