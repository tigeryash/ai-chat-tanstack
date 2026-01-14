import { Id } from "../_generated/dataModel";

/**
 * Calculate cost based on model and tokens
 * Prices are per 1M tokens
 */
export const MODEL_PRICING:  Record<string, { input: number; output: number }> = {
  // OpenAI
  "gpt-4o":  { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  "o1":  { input: 15, output: 60 },
  "o1-mini": { input: 3, output: 12 },
  
  // Anthropic
  "claude-3-5-sonnet-20241022":  { input: 3, output: 15 },
  "claude-3-5-haiku-20241022": { input: 0.8, output: 4 },
  "claude-3-opus-20240229": { input: 15, output: 75 },
  
  // Google
  "gemini-1.5-pro": { input: 1.25, output: 5 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  "gemini-2.0-flash-exp": { input: 0, output: 0 }, // Free during preview
  
  // Default fallback
  "default": { input: 1, output: 3 },
};

export function calculateCost(
  model:  string,
  promptTokens:  number,
  completionTokens: number
): number {
  const pricing = MODEL_PRICING[model] ??  MODEL_PRICING["default"];
  
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  
  return inputCost + outputCost;
}

/**
 * Extract text content from message parts
 */
export function extractTextFromParts(parts: any[]): string {
  return parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

/**
 * Generate a short title from message content
 */
export function generateTitleFromContent(content: string, maxLength: number = 50): string {
  const cleaned = content
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  
  return cleaned.substring(0, maxLength - 3) + "...";
}