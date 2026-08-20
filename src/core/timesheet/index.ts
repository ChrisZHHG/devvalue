/**
 * Auto-Timesheet core — the shared kernel.
 *
 * Pure TypeScript with no `vscode` and no I/O, so the same pipeline runs in the
 * VS Code extension, a CLI, an Azure Function inside a firm's own tenant, or a
 * static browser demo. Connectors and UI live outside this folder.
 *
 * Pipeline:
 *   signals
 *     → BlockSegmenter      (when was this person working?)
 *     → ContextSplitter     (when did the subject change?)
 *     → AttributionEngine   (whose engagement was it, and what is the evidence?)
 *     → TimesheetSynthesizer (what rows do they submit?)
 */
export * from './types.js';
export { BlockSegmenter } from './BlockSegmenter.js';
export { AttributionEngine, DEFAULT_THRESHOLDS } from './AttributionEngine.js';
export { ContextSplitter } from './ContextSplitter.js';
export type { ContextSplitOptions } from './ContextSplitter.js';
export type { AttributionOptions, ConfidenceThresholds } from './AttributionEngine.js';
export { TimesheetSynthesizer, isoDate, mondayOf } from './TimesheetSynthesizer.js';
