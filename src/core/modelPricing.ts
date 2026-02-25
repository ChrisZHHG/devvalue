export interface ModelPricing {
  /** USD per million input tokens */
  inputPer1M: number;
  /** USD per million output tokens */
  outputPer1M: number;
  /** USD per million cache-write tokens */
  cacheWritePer1M: number;
  /** USD per million cache-read tokens */
  cacheReadPer1M: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-6':   { inputPer1M: 15,   outputPer1M: 75, cacheWritePer1M: 18.75, cacheReadPer1M: 1.50 },
  'claude-opus-4-5':   { inputPer1M: 15,   outputPer1M: 75, cacheWritePer1M: 18.75, cacheReadPer1M: 1.50 },
  'claude-sonnet-4-6': { inputPer1M: 3,    outputPer1M: 15, cacheWritePer1M:  3.75, cacheReadPer1M: 0.30 },
  'claude-sonnet-4-5': { inputPer1M: 3,    outputPer1M: 15, cacheWritePer1M:  3.75, cacheReadPer1M: 0.30 },
  'claude-haiku-4-5':  { inputPer1M: 0.80, outputPer1M:  4, cacheWritePer1M:  1.00, cacheReadPer1M: 0.08 },
};

/** Fallback pricing used for any model not explicitly listed above. */
export const DEFAULT_PRICING: ModelPricing = MODEL_PRICING['claude-sonnet-4-6'];

/**
 * Look up pricing for a model string.
 *
 * Tries exact match first, then a prefix match to handle minor version variants
 * (e.g. "claude-sonnet-4-6-20251022" still resolves to sonnet-4-6 pricing).
 * Falls back to DEFAULT_PRICING if no match is found.
 */
export function getPricing(model: string): ModelPricing {
  if (MODEL_PRICING[model]) {return MODEL_PRICING[model];}

  const lower = model.toLowerCase();
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (lower.startsWith(key) || key.startsWith(lower)) {return pricing;}
  }

  return DEFAULT_PRICING;
}
