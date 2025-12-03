/**
 * Context Manager Service
 *
 * Manages AI context window budget, including:
 * - Full document inclusion when within limits
 * - Intelligent excerpt extraction when over budget
 * - Keyword-based relevance scoring
 * - Token budget allocation
 *
 * This service ensures the AI receives the most relevant context
 * while staying within model token limits.
 */

import {
  countTokens,
  checkContextFits,
  truncateToTokenLimit,
  formatTokenCount,
} from './tokenCounter';
import type {
  ReferenceDocument,
  ExtractedExcerpt,
  TokenBudgetResult,
  ContextManagerConfig,
} from '../../types';

/**
 * Default configuration for context management
 */
const DEFAULT_CONFIG: ContextManagerConfig = {
  maxTotalTokens: 100000,  // Default context budget
  reserveForOutput: 4000,  // Reserve for AI response
  priorities: {
    brs: 1.0,           // BRS is highest priority
    previousSections: 0.9,  // Previous sections for consistency
    references: 0.7,    // Reference documents
    webSearch: 0.5,     // Web search results
    userGuidance: 1.0,  // User guidance always included
  },
  minReferenceTokens: 500,   // Minimum tokens per reference
  maxReferenceTokens: 5000,  // Maximum tokens per reference
  excerptOverlap: 50,        // Overlap for context continuity
};

/**
 * Context allocation result
 */
export interface ContextAllocation {
  systemPrompt: number;
  brsDocument: number;
  previousSections: number;
  references: number;
  webSearch: number;
  userGuidance: number;
  totalAllocated: number;
  remaining: number;
}

/**
 * Calculate token budget allocation for each context component
 *
 * @param modelId - Model to check limits against
 * @param currentUsage - Current token usage by component
 * @param config - Configuration options
 * @returns Budget allocation for each component
 */
export function calculateTokenBudget(
  modelId: string,
  currentUsage: {
    systemPrompt?: number;
    brsDocument?: number;
    previousSections?: number;
    references?: number;
    webSearch?: number;
    userGuidance?: number;
  },
  config: Partial<ContextManagerConfig> = {}
): TokenBudgetResult {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const contextCheck = checkContextFits(0, modelId, mergedConfig.reserveForOutput);
  const availableTokens = contextCheck.availableForContext;

  // Calculate current total
  const currentTotal =
    (currentUsage.systemPrompt || 0) +
    (currentUsage.brsDocument || 0) +
    (currentUsage.previousSections || 0) +
    (currentUsage.references || 0) +
    (currentUsage.webSearch || 0) +
    (currentUsage.userGuidance || 0);

  const withinBudget = currentTotal <= availableTokens;
  const percentUsed = Math.round((currentTotal / availableTokens) * 100);

  // Calculate recommendations for each component
  const recommendations: Record<string, number> = {};

  if (!withinBudget) {
    // Need to reduce - prioritize based on config
    const excess = currentTotal - availableTokens;
    const priorities = mergedConfig.priorities ?? DEFAULT_CONFIG.priorities!;

    // Map usage keys to priority keys
    const priorityKeyMap: Record<string, keyof typeof priorities> = {
      systemPrompt: 'userGuidance', // System prompt always kept
      brsDocument: 'brs',
      previousSections: 'previousSections',
      references: 'references',
      webSearch: 'webSearch',
      userGuidance: 'userGuidance',
    };

    // Calculate how much to reduce from each component
    // Lower priority items get reduced more
    let totalPriority = 0;
    for (const key of Object.keys(currentUsage) as (keyof typeof currentUsage)[]) {
      const priorityKey = priorityKeyMap[key];
      const priority = priorityKey ? priorities[priorityKey] : 0.5;
      if (currentUsage[key]) {
        totalPriority += (1 - priority) * (currentUsage[key] || 0);
      }
    }

    for (const key of Object.keys(currentUsage) as (keyof typeof currentUsage)[]) {
      const current = currentUsage[key] || 0;
      const priorityKey = priorityKeyMap[key];
      const priority = priorityKey ? priorities[priorityKey] : 0.5;

      if (current > 0 && totalPriority > 0) {
        const reduction = Math.floor(excess * ((1 - priority) * current) / totalPriority);
        recommendations[key] = Math.max(0, current - reduction);
      } else {
        recommendations[key] = current;
      }
    }
  }

  return {
    withinBudget,
    totalTokens: currentTotal,
    availableTokens,
    usageByComponent: currentUsage as Record<string, number>,
    recommendations: withinBudget ? undefined : recommendations,
    percentUsed,
  };
}

/**
 * Extract relevant excerpts from reference documents
 *
 * Uses keyword matching to find the most relevant paragraphs
 * from reference documents based on the query (BRS content or section title).
 *
 * @param references - Array of reference documents
 * @param query - Query text (BRS content or section title)
 * @param maxTokens - Maximum total tokens for all excerpts
 * @returns Array of extracted excerpts with relevance scores
 */
export function extractRelevantExcerpts(
  references: ReferenceDocument[],
  query: string,
  maxTokens: number
): ExtractedExcerpt[] {
  const excerpts: ExtractedExcerpt[] = [];

  // Extract keywords from query
  const keywords = extractKeywords(query);

  if (keywords.length === 0) {
    return excerpts;
  }

  // Score and extract from each reference
  for (const ref of references) {
    if (!ref.content) continue;

    // Split into paragraphs
    const paragraphs = ref.content.split(/\n\n+/).filter(p => p.trim().length > 50);

    // Score each paragraph
    const scoredParagraphs = paragraphs.map((para, index) => ({
      content: para.trim(),
      score: calculateRelevanceScore(para, keywords),
      position: index,
    }));

    // Sort by score and take top paragraphs
    scoredParagraphs.sort((a, b) => b.score - a.score);

    // Take paragraphs until we hit token limit
    let tokensUsed = 0;
    const tokensPerRef = Math.floor(maxTokens / references.length);

    for (const para of scoredParagraphs) {
      if (para.score < 0.1) break; // Ignore low-relevance paragraphs

      const paraTokens = countTokens(para.content);
      if (tokensUsed + paraTokens > tokensPerRef) break;

      excerpts.push({
        referenceId: ref.id,
        referenceTitle: ref.title,
        content: para.content,
        relevanceScore: para.score,
        startPosition: para.position,
      });

      tokensUsed += paraTokens;
    }
  }

  // Sort all excerpts by relevance and trim to total budget
  excerpts.sort((a, b) => b.relevanceScore - a.relevanceScore);

  let totalTokens = 0;
  const result: ExtractedExcerpt[] = [];

  for (const excerpt of excerpts) {
    const tokens = countTokens(excerpt.content);
    if (totalTokens + tokens > maxTokens) {
      // Try to truncate this excerpt to fit remaining budget
      const remaining = maxTokens - totalTokens;
      if (remaining > 100) {
        excerpt.content = truncateToTokenLimit(excerpt.content, remaining);
        result.push(excerpt);
      }
      break;
    }
    result.push(excerpt);
    totalTokens += tokens;
  }

  return result;
}

/**
 * Extract keywords from text for relevance matching
 */
function extractKeywords(text: string): string[] {
  // Remove common stop words and extract meaningful terms
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'this',
    'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
    'we', 'us', 'our', 'you', 'your', 'he', 'she', 'him', 'her',
  ]);

  // Extract words (including technical terms with numbers)
  const words = text.toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(word =>
      word.length > 2 &&
      !stopWords.has(word) &&
      !/^\d+$/.test(word)
    );

  // Get unique words, preserving order of first occurrence
  const uniqueWords: string[] = [];
  const seen = new Set<string>();

  for (const word of words) {
    if (!seen.has(word)) {
      seen.add(word);
      uniqueWords.push(word);
    }
  }

  // Also extract technical patterns (e.g., "TS 23.501", "3GPP", "RFC 2119")
  const technicalPatterns = text.match(/\b[A-Z]{2,}[\s-]?\d+[\.\d]*/g) || [];
  for (const pattern of technicalPatterns) {
    const normalized = pattern.toLowerCase().replace(/\s+/g, '');
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueWords.push(normalized);
    }
  }

  return uniqueWords.slice(0, 50); // Limit to top 50 keywords
}

/**
 * Calculate relevance score for a paragraph based on keywords
 */
function calculateRelevanceScore(paragraph: string, keywords: string[]): number {
  const lowerPara = paragraph.toLowerCase();
  let matchCount = 0;
  let weightedScore = 0;

  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i];
    // Earlier keywords are weighted higher (they're more important)
    const weight = 1 / (i + 1);

    if (lowerPara.includes(keyword)) {
      matchCount++;
      weightedScore += weight;

      // Bonus for exact word match (not just substring)
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const exactMatches = (lowerPara.match(regex) || []).length;
      weightedScore += exactMatches * weight * 0.5;
    }
  }

  // Normalize score based on keyword count
  const normalizedScore = keywords.length > 0
    ? weightedScore / Math.sqrt(keywords.length)
    : 0;

  return Math.min(1, normalizedScore);
}

/**
 * Build optimized context for AI generation
 *
 * Manages the context window budget and returns optimized content
 * that fits within model limits.
 *
 * @param modelId - Target model
 * @param components - Context components with their content
 * @param config - Configuration options
 * @returns Optimized context components
 */
export function buildOptimizedContext(
  modelId: string,
  components: {
    systemPrompt?: string;
    brsContent?: string;
    previousSections?: string;
    references?: ReferenceDocument[];
    webSearchResults?: string;
    userGuidance?: string;
  },
  config: Partial<ContextManagerConfig> = {}
): {
  systemPrompt: string;
  brsContent: string;
  previousSections: string;
  referenceExcerpts: ExtractedExcerpt[];
  webSearchResults: string;
  userGuidance: string;
  budgetInfo: TokenBudgetResult;
} {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Calculate current usage
  const currentUsage = {
    systemPrompt: countTokens(components.systemPrompt || ''),
    brsDocument: countTokens(components.brsContent || ''),
    previousSections: countTokens(components.previousSections || ''),
    references: components.references?.reduce((sum, r) => sum + countTokens(r.content || ''), 0) || 0,
    webSearch: countTokens(components.webSearchResults || ''),
    userGuidance: countTokens(components.userGuidance || ''),
  };

  // Calculate budget
  const budget = calculateTokenBudget(modelId, currentUsage, mergedConfig);

  // If within budget, return everything as-is
  if (budget.withinBudget) {
    return {
      systemPrompt: components.systemPrompt || '',
      brsContent: components.brsContent || '',
      previousSections: components.previousSections || '',
      referenceExcerpts: components.references?.map(r => ({
        referenceId: r.id,
        referenceTitle: r.title,
        content: r.content || '',
        relevanceScore: 1.0,
      })) || [],
      webSearchResults: components.webSearchResults || '',
      userGuidance: components.userGuidance || '',
      budgetInfo: budget,
    };
  }

  // Need to optimize - apply recommendations
  const recommendations = budget.recommendations || {};

  // Truncate components based on recommendations
  const optimized = {
    systemPrompt: components.systemPrompt || '',
    brsContent: recommendations.brsDocument
      ? truncateToTokenLimit(components.brsContent || '', recommendations.brsDocument)
      : components.brsContent || '',
    previousSections: recommendations.previousSections
      ? truncateToTokenLimit(components.previousSections || '', recommendations.previousSections)
      : components.previousSections || '',
    referenceExcerpts: [] as ExtractedExcerpt[],
    webSearchResults: recommendations.webSearch
      ? truncateToTokenLimit(components.webSearchResults || '', recommendations.webSearch)
      : components.webSearchResults || '',
    userGuidance: components.userGuidance || '', // Never truncate user guidance
    budgetInfo: budget,
  };

  // Extract relevant excerpts from references if over budget
  if (components.references && components.references.length > 0) {
    const referenceTokenBudget = recommendations.references || mergedConfig.maxReferenceTokens || 5000;
    const query = [
      components.brsContent || '',
      components.userGuidance || ''
    ].join('\n');

    optimized.referenceExcerpts = extractRelevantExcerpts(
      components.references,
      query,
      referenceTokenBudget
    );
  }

  return optimized;
}

/**
 * Format budget info for display
 */
export function formatBudgetInfo(budget: TokenBudgetResult): string {
  const lines: string[] = [];

  lines.push(`Token Usage: ${formatTokenCount(budget.totalTokens)} / ${formatTokenCount(budget.availableTokens)} (${budget.percentUsed}%)`);

  if (!budget.withinBudget) {
    lines.push('⚠️ Context exceeds budget - content will be truncated');
    if (budget.recommendations) {
      lines.push('Recommended reductions:');
      for (const [key, value] of Object.entries(budget.recommendations)) {
        const original = budget.usageByComponent[key] || 0;
        if (value < original) {
          lines.push(`  - ${key}: ${formatTokenCount(original)} → ${formatTokenCount(value)}`);
        }
      }
    }
  }

  return lines.join('\n');
}
