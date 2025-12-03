/**
 * Token Counter Service
 *
 * Provides token counting estimation for context budget management.
 * Uses a character-based approximation that works well for most LLMs.
 *
 * Note: This uses a heuristic approach (~4 chars per token) which is
 * accurate enough for budget estimation without requiring WASM dependencies.
 */

import type { TokenEstimate, ReferenceDocument } from '../../types';
import { OpenRouterProvider } from './providers/OpenRouterProvider';

/**
 * Count tokens in a text string
 *
 * Uses a heuristic approximation: ~4 characters per token on average.
 * This is reasonably accurate for English text with most modern LLMs.
 *
 * @param text - The text to count tokens for
 * @returns Estimated number of tokens
 */
export function countTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  // Heuristic: ~4 characters per token for English text
  // This is a good approximation for GPT-4, Claude, etc.
  // Adjust slightly for code (more tokens per char) vs prose (fewer)
  const hasCode = /```[\s\S]*?```|`[^`]+`/.test(text);
  const charsPerToken = hasCode ? 3.5 : 4;

  return Math.ceil(text.length / charsPerToken);
}

/**
 * Count tokens for an array of messages (chat format)
 *
 * @param messages - Array of chat messages
 * @returns Total token count including message overhead
 */
export function countChatTokens(messages: Array<{ role: string; content: string }>): number {
  let totalTokens = 0;

  for (const message of messages) {
    // Each message has overhead: role name + separators
    // Approximately: <|im_start|>role\ncontent<|im_end|> = ~4 tokens overhead
    totalTokens += 4;
    totalTokens += countTokens(message.content);
  }

  // Add priming tokens for the assistant's response
  totalTokens += 3;

  return totalTokens;
}

/**
 * Estimate tokens for all context components
 *
 * @param context - AIContext containing all contextual information
 * @returns Detailed token breakdown
 */
export function estimateContextTokens(context: {
  systemPrompt?: string;
  brsContent?: string;
  existingSpec?: string;
  userGuidance?: string;
  references?: ReferenceDocument[];
  webSearchResults?: string;
  previousSections?: string;
}): TokenEstimate {
  const estimate: TokenEstimate = {
    systemPrompt: countTokens(context.systemPrompt || ''),
    brsDocument: countTokens(context.brsContent || ''),
    references: 0,
    existingSpec: countTokens(context.existingSpec || ''),
    userGuidance: countTokens(context.userGuidance || ''),
    webSearchResults: context.webSearchResults ? countTokens(context.webSearchResults) : undefined,
    total: 0,
  };

  // Count reference documents
  if (context.references && context.references.length > 0) {
    for (const ref of context.references) {
      if (ref.content) {
        estimate.references += countTokens(ref.content);
      }
    }
  }

  // Calculate total
  estimate.total =
    estimate.systemPrompt +
    estimate.brsDocument +
    estimate.references +
    estimate.existingSpec +
    estimate.userGuidance +
    (estimate.webSearchResults || 0);

  // Add previous sections if provided
  if (context.previousSections) {
    const prevTokens = countTokens(context.previousSections);
    estimate.total += prevTokens;
  }

  return estimate;
}

/**
 * Get model context window limits
 * First checks OpenRouter API cache, then falls back to static lookup
 */
export function getModelContextLimit(modelId: string): number {
  // Priority 1: Check OpenRouter API cache (most accurate, real-time data)
  const cachedLimit = OpenRouterProvider.getModelContextLengthFromCache(modelId);
  if (cachedLimit !== null) {
    return cachedLimit;
  }

  // Priority 2: Fall back to static lookup table
  const modelLimits: Record<string, number> = {
    // Claude models (Anthropic)
    'anthropic/claude-3.5-sonnet': 200000,
    'anthropic/claude-3-sonnet': 200000,
    'anthropic/claude-3-opus': 200000,
    'anthropic/claude-3-haiku': 200000,
    'anthropic/claude-2': 100000,

    // OpenAI models - GPT-4 series
    'openai/gpt-4-turbo': 128000,
    'openai/gpt-4o': 128000,
    'openai/gpt-4o-mini': 128000,
    'openai/gpt-4': 8192,
    'openai/gpt-4-32k': 32768,
    'openai/gpt-3.5-turbo': 16385,
    'openai/gpt-3.5-turbo-16k': 16385,

    // OpenAI models - GPT-4.1/5 series (newer models with large context)
    'openai/gpt-4.1': 1000000,
    'openai/gpt-4.1-mini': 1000000,
    'openai/gpt-4.1-nano': 1000000,
    'openai/gpt-5': 1000000,
    'openai/gpt-5.1': 1000000,

    // OpenAI reasoning models (o1, o3 series)
    'openai/o1': 200000,
    'openai/o1-preview': 128000,
    'openai/o1-mini': 128000,
    'openai/o3': 200000,
    'openai/o3-mini': 200000,

    // Google models
    'google/gemini-pro': 32000,
    'google/gemini-pro-1.5': 1000000,
    'google/gemini-1.5-pro': 1000000,
    'google/gemini-1.5-flash': 1000000,
    'google/gemini-2.0-flash': 1000000,
    'google/gemini-2.0-flash-exp': 1000000,

    // Perplexity (online models)
    'perplexity/llama-3.1-sonar-large-128k-online': 128000,
    'perplexity/llama-3.1-sonar-small-128k-online': 128000,

    // Meta models
    'meta-llama/llama-3-70b-instruct': 8192,
    'meta-llama/llama-3.1-405b-instruct': 128000,
    'meta-llama/llama-3.1-70b-instruct': 128000,
    'meta-llama/llama-3.2-90b-vision-instruct': 128000,

    // Mistral models
    'mistralai/mistral-large': 128000,
    'mistralai/mistral-medium': 32000,
    'mistralai/mixtral-8x7b-instruct': 32000,

    // DeepSeek models
    'deepseek/deepseek-chat': 128000,
    'deepseek/deepseek-coder': 128000,
  };

  const modelIdLower = modelId.toLowerCase();

  // Try exact match first
  if (modelLimits[modelId]) {
    return modelLimits[modelId];
  }

  // Try prefix/partial match with normalized model ID
  for (const [knownModel, limit] of Object.entries(modelLimits)) {
    const knownModelLower = knownModel.toLowerCase();
    // Check if the model ID starts with a known prefix
    if (modelIdLower.startsWith(knownModelLower)) {
      return limit;
    }
    // Check if a key part matches (e.g., "gpt-4.1" in "openai/gpt-4.1-mini-2025-04-14")
    const modelPart = knownModel.split('/')[1]?.toLowerCase();
    if (modelPart && modelIdLower.includes(modelPart)) {
      return limit;
    }
  }

  // Smart fallback based on model name patterns
  // Newer models generally have larger context windows
  if (modelIdLower.includes('gpt-5') || modelIdLower.includes('gpt-4.1')) {
    return 1000000; // 1M tokens for latest GPT models
  }
  if (modelIdLower.includes('gpt-4') || modelIdLower.includes('o1') || modelIdLower.includes('o3')) {
    return 128000; // 128K for GPT-4 variants
  }
  if (modelIdLower.includes('claude-3') || modelIdLower.includes('claude-4')) {
    return 200000; // 200K for Claude 3+
  }
  if (modelIdLower.includes('gemini')) {
    return 1000000; // 1M for Gemini models
  }
  if (modelIdLower.includes('llama-3.1') || modelIdLower.includes('llama-3.2')) {
    return 128000; // 128K for newer Llama models
  }
  if (modelIdLower.includes('128k') || modelIdLower.includes('200k')) {
    // Extract context size from model name if mentioned
    const match = modelIdLower.match(/(\d+)k/);
    if (match) {
      return parseInt(match[1]) * 1000;
    }
  }

  // Default to a reasonable modern default (not overly conservative)
  // Most modern models support at least 32K
  console.warn(`Unknown model "${modelId}" - defaulting to 32K context limit`);
  return 32000;
}

/**
 * Check if context fits within model limits
 *
 * @param totalTokens - Total tokens in context
 * @param modelId - Model identifier
 * @param reserveForOutput - Tokens to reserve for output (default 4000)
 * @returns Object with fit status and details
 */
export function checkContextFits(
  totalTokens: number,
  modelId: string,
  reserveForOutput: number = 4000
): {
  fits: boolean;
  contextLimit: number;
  availableForContext: number;
  usedTokens: number;
  percentUsed: number;
  warningThreshold: number;
  isWarning: boolean;
} {
  const contextLimit = getModelContextLimit(modelId);
  const availableForContext = contextLimit - reserveForOutput;
  const percentUsed = Math.round((totalTokens / availableForContext) * 100);
  const warningThreshold = 80; // Warn at 80% usage

  return {
    fits: totalTokens <= availableForContext,
    contextLimit,
    availableForContext,
    usedTokens: totalTokens,
    percentUsed,
    warningThreshold,
    isWarning: percentUsed >= warningThreshold,
  };
}

/**
 * Truncate text to fit within a token budget
 *
 * @param text - Text to truncate
 * @param maxTokens - Maximum tokens allowed
 * @param addEllipsis - Whether to add "..." at truncation point
 * @returns Truncated text
 */
export function truncateToTokenLimit(
  text: string,
  maxTokens: number,
  addEllipsis: boolean = true
): string {
  const currentTokens = countTokens(text);

  if (currentTokens <= maxTokens) {
    return text;
  }

  // Binary search to find the right truncation point
  let low = 0;
  let high = text.length;
  let result = '';

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const truncated = text.slice(0, mid);
    const tokens = countTokens(truncated);

    if (tokens <= maxTokens) {
      result = truncated;
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  // Try to truncate at word boundary
  const lastSpace = result.lastIndexOf(' ');
  if (lastSpace > result.length * 0.8) {
    result = result.slice(0, lastSpace);
  }

  if (addEllipsis && result.length < text.length) {
    result = result.trim() + '...';
  }

  return result;
}

/**
 * Split text into chunks that fit within token limits
 *
 * @param text - Text to split
 * @param maxTokensPerChunk - Maximum tokens per chunk
 * @param overlap - Number of tokens to overlap between chunks (for context continuity)
 * @returns Array of text chunks
 */
export function splitIntoChunks(
  text: string,
  maxTokensPerChunk: number,
  overlap: number = 100
): string[] {
  const chunks: string[] = [];
  let remaining = text;
  let overlapText = '';

  while (remaining.length > 0) {
    // Calculate chunk size accounting for overlap
    const availableTokens = maxTokensPerChunk - countTokens(overlapText);
    const chunk = truncateToTokenLimit(remaining, availableTokens, false);

    if (chunk.length === 0) {
      break;
    }

    // Add overlap text from previous chunk
    chunks.push(overlapText + chunk);

    // Move forward
    remaining = remaining.slice(chunk.length).trim();

    // Store overlap for next chunk
    if (overlap > 0 && remaining.length > 0) {
      overlapText = truncateToTokenLimit(chunk, overlap, false);
      // Start from end to get last N tokens
      const words = chunk.split(' ');
      let overlapWords: string[] = [];
      let overlapTokens = 0;
      for (let i = words.length - 1; i >= 0 && overlapTokens < overlap; i--) {
        overlapWords.unshift(words[i]);
        overlapTokens = countTokens(overlapWords.join(' '));
      }
      overlapText = overlapWords.join(' ') + ' ';
    } else {
      overlapText = '';
    }
  }

  return chunks;
}

/**
 * Format token count for display (e.g., "12.5K")
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) {
    return tokens.toString();
  } else if (tokens < 1000000) {
    return (tokens / 1000).toFixed(1) + 'K';
  } else {
    return (tokens / 1000000).toFixed(2) + 'M';
  }
}

/**
 * Clean up resources (no-op since we use heuristic estimation)
 * Kept for API compatibility
 */
export function cleanup(): void {
  // No resources to clean up with heuristic approach
}

// ========== PDF Token Estimation (Multimodal Support) ==========

/**
 * Estimate tokens for a PDF document based on page count
 *
 * OpenRouter charges based on page count for PDFs when using vision models.
 * Approximate token usage per page varies by content density:
 * - Text-heavy: ~1,500-2,000 tokens per page
 * - Mixed content: ~1,000-1,500 tokens per page
 * - Image-heavy: ~500-1,000 tokens per page
 *
 * @param pageCount - Number of pages in the PDF
 * @param density - Content density ('text' | 'mixed' | 'image')
 * @returns Estimated token count
 */
export function estimatePDFTokens(
  pageCount: number,
  density: 'text' | 'mixed' | 'image' = 'mixed'
): number {
  const tokensPerPage: Record<string, number> = {
    text: 1750,    // Text-heavy documents (specs, reports)
    mixed: 1250,   // Mixed content (documents with diagrams)
    image: 750,    // Image-heavy (presentations, diagrams)
  };

  return pageCount * tokensPerPage[density];
}

/**
 * Estimate tokens for a PDF document based on file size
 *
 * Alternative estimation when page count is unknown.
 * Based on typical PDF compression ratios:
 * - ~50KB per text-heavy page
 * - ~100KB per mixed page
 * - ~200KB per image-heavy page
 *
 * @param fileSizeBytes - File size in bytes
 * @returns Estimated token count with page estimate
 */
export function estimatePDFTokensFromSize(fileSizeBytes: number): {
  estimatedPages: number;
  estimatedTokens: number;
  confidence: 'low' | 'medium' | 'high';
} {
  // Assume mixed content density (~100KB per page)
  const kbPerPage = 100;
  const fileSizeKB = fileSizeBytes / 1024;
  const estimatedPages = Math.max(1, Math.ceil(fileSizeKB / kbPerPage));
  const estimatedTokens = estimatePDFTokens(estimatedPages, 'mixed');

  // Confidence is lower for very small or very large files
  let confidence: 'low' | 'medium' | 'high' = 'medium';
  if (fileSizeBytes < 10000 || fileSizeBytes > 10000000) {
    confidence = 'low';
  } else if (fileSizeBytes >= 50000 && fileSizeBytes <= 5000000) {
    confidence = 'high';
  }

  return { estimatedPages, estimatedTokens, confidence };
}

/**
 * Estimate total context usage including reference documents
 *
 * @param brsContent - BRS document content
 * @param referenceDocuments - Array of reference documents with size/page info
 * @param systemPromptTokens - Tokens used by system prompt
 * @returns Total usage breakdown with warnings
 */
export function estimateTotalContextWithPDFs(
  brsContent: string,
  referenceDocuments: Array<{
    id: string;
    title: string;
    size?: number;
    pageCount?: number;
    extractedText?: string;
    tokenEstimate?: number;
  }>,
  systemPromptTokens: number = 2000
): {
  total: number;
  breakdown: {
    brs: number;
    references: number;
    system: number;
  };
  referenceDetails: Array<{
    id: string;
    title: string;
    tokens: number;
    source: 'pageCount' | 'fileSize' | 'text' | 'stored';
  }>;
  warnings: string[];
} {
  const breakdown = {
    brs: countTokens(brsContent),
    references: 0,
    system: systemPromptTokens,
  };

  const referenceDetails: Array<{
    id: string;
    title: string;
    tokens: number;
    source: 'pageCount' | 'fileSize' | 'text' | 'stored';
  }> = [];

  const warnings: string[] = [];

  for (const ref of referenceDocuments) {
    let tokens = 0;
    let source: 'pageCount' | 'fileSize' | 'text' | 'stored' = 'fileSize';

    // Priority 1: Use stored token estimate
    if (ref.tokenEstimate && ref.tokenEstimate > 0) {
      tokens = ref.tokenEstimate;
      source = 'stored';
    }
    // Priority 2: Use page count
    else if (ref.pageCount && ref.pageCount > 0) {
      tokens = estimatePDFTokens(ref.pageCount, 'mixed');
      source = 'pageCount';
    }
    // Priority 3: Use extracted text
    else if (ref.extractedText) {
      tokens = countTokens(ref.extractedText);
      source = 'text';
    }
    // Priority 4: Estimate from file size
    else if (ref.size && ref.size > 0) {
      const estimate = estimatePDFTokensFromSize(ref.size);
      tokens = estimate.estimatedTokens;
      source = 'fileSize';

      if (estimate.confidence === 'low') {
        warnings.push(`Token estimate for "${ref.title}" may be inaccurate (unusual file size)`);
      }
    }

    breakdown.references += tokens;
    referenceDetails.push({
      id: ref.id,
      title: ref.title,
      tokens,
      source,
    });
  }

  const total = breakdown.brs + breakdown.references + breakdown.system;

  // Add warnings for large documents
  if (breakdown.references > 100000) {
    warnings.push('Reference documents use over 100K tokens. Consider removing some documents.');
  }

  if (breakdown.brs > 50000) {
    warnings.push('BRS document is very large (50K+ tokens). Consider summarizing.');
  }

  return { total, breakdown, referenceDetails, warnings };
}

/**
 * Check if PDF references fit within model context
 *
 * @param pdfTokens - Total tokens from PDF references
 * @param otherTokens - Tokens from other context (BRS, system, etc.)
 * @param modelId - Model identifier
 * @param reserveForOutput - Tokens to reserve for output
 * @returns Fit status with recommendations
 */
export function checkPDFContextFits(
  pdfTokens: number,
  otherTokens: number,
  modelId: string,
  reserveForOutput: number = 4000
): {
  fits: boolean;
  totalTokens: number;
  availableForPDFs: number;
  percentUsedByPDFs: number;
  recommendation: string | null;
} {
  const contextLimit = getModelContextLimit(modelId);
  const availableTotal = contextLimit - reserveForOutput;
  const availableForPDFs = availableTotal - otherTokens;
  const totalTokens = pdfTokens + otherTokens;
  const percentUsedByPDFs = Math.round((pdfTokens / availableTotal) * 100);

  let recommendation: string | null = null;

  if (pdfTokens > availableForPDFs) {
    const excessTokens = pdfTokens - availableForPDFs;
    const pagesToRemove = Math.ceil(excessTokens / 1250); // Assuming mixed density
    recommendation = `Remove approximately ${pagesToRemove} pages of reference documents or use a model with larger context.`;
  } else if (percentUsedByPDFs > 60) {
    recommendation = 'PDF references are using a large portion of context. Consider extracting key sections.';
  }

  return {
    fits: totalTokens <= availableTotal,
    totalTokens,
    availableForPDFs,
    percentUsedByPDFs,
    recommendation,
  };
}
