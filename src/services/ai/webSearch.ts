/**
 * Web Search Service
 *
 * Provides web search capabilities for AI context enrichment.
 * Supports multiple search backends:
 * 1. Brave Search API (requires VITE_BRAVE_API_KEY)
 * 2. OpenRouter models with built-in search (e.g., Perplexity)
 *
 * This service is used to fetch relevant web content when generating
 * technical specifications that need up-to-date external information.
 */

import { getBraveApiKey, hasBraveApiKey } from '../../utils/envConfig';

/**
 * Web search result structure
 */
export interface WebSearchResult {
  title: string;
  url: string;
  description: string;
  publishedDate?: string;
  source?: string;
}

/**
 * Search response with metadata
 */
export interface WebSearchResponse {
  results: WebSearchResult[];
  totalResults: number;
  searchTime: number;
  query: string;
  source: 'brave' | 'model-builtin' | 'none';
}

/**
 * Search configuration options
 */
export interface WebSearchConfig {
  maxResults?: number;
  freshness?: 'day' | 'week' | 'month' | 'year' | 'all';
  safesearch?: 'off' | 'moderate' | 'strict';
  country?: string;
  language?: string;
}

/**
 * Models with built-in search capability
 * These models can search the web as part of their generation
 */
export const MODELS_WITH_BUILTIN_SEARCH = [
  'perplexity/llama-3.1-sonar-small-128k-online',
  'perplexity/llama-3.1-sonar-large-128k-online',
  'perplexity/llama-3.1-sonar-huge-128k-online',
  'perplexity/sonar-small-online',
  'perplexity/sonar-medium-online',
  'perplexity/pplx-7b-online',
  'perplexity/pplx-70b-online',
];

/**
 * Check if web search is available (either via Brave API or model capability)
 */
export function isWebSearchAvailable(modelId?: string): boolean {
  // Brave API is available
  if (hasBraveApiKey()) {
    return true;
  }

  // Model has built-in search
  if (modelId && hasBuiltinSearch(modelId)) {
    return true;
  }

  return false;
}

/**
 * Check if a model has built-in web search capability
 */
export function hasBuiltinSearch(modelId: string): boolean {
  const lowerModelId = modelId.toLowerCase();
  return MODELS_WITH_BUILTIN_SEARCH.some(
    m => lowerModelId.includes(m.toLowerCase()) || lowerModelId.includes('online')
  );
}

/**
 * Get the search capability type for the current configuration
 */
export function getSearchCapability(modelId?: string): 'brave' | 'model-builtin' | 'none' {
  if (hasBraveApiKey()) {
    return 'brave';
  }
  if (modelId && hasBuiltinSearch(modelId)) {
    return 'model-builtin';
  }
  return 'none';
}

/**
 * Perform a web search using Brave Search API
 *
 * @param query - Search query
 * @param config - Search configuration
 * @returns Search results
 */
export async function searchBrave(
  query: string,
  config: WebSearchConfig = {}
): Promise<WebSearchResponse> {
  const apiKey = getBraveApiKey();
  if (!apiKey) {
    throw new Error('Brave Search API key not configured');
  }

  const startTime = Date.now();

  // Build query parameters
  const params = new URLSearchParams({
    q: query,
    count: String(config.maxResults || 10),
    safesearch: config.safesearch || 'moderate',
  });

  if (config.freshness && config.freshness !== 'all') {
    params.set('freshness', config.freshness);
  }

  if (config.country) {
    params.set('country', config.country);
  }

  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Brave Search API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const searchTime = Date.now() - startTime;

    // Transform Brave's response format to our format
    const results: WebSearchResult[] = (data.web?.results || []).map((result: {
      title: string;
      url: string;
      description: string;
      page_age?: string;
      meta_url?: { hostname?: string };
    }) => ({
      title: result.title,
      url: result.url,
      description: result.description,
      publishedDate: result.page_age,
      source: result.meta_url?.hostname,
    }));

    return {
      results,
      totalResults: data.web?.count || results.length,
      searchTime,
      query,
      source: 'brave',
    };
  } catch (error) {
    console.error('Brave Search error:', error);
    throw error;
  }
}

/**
 * Format search results for AI context injection
 *
 * @param searchResponse - Search response to format
 * @param maxTokens - Approximate maximum tokens to use
 * @returns Formatted string for AI context
 */
export function formatSearchResultsForContext(
  searchResponse: WebSearchResponse,
  maxTokens: number = 2000
): string {
  if (!searchResponse.results.length) {
    return '';
  }

  const lines: string[] = [
    '## Web Search Results',
    `Query: "${searchResponse.query}"`,
    `Source: ${searchResponse.source === 'brave' ? 'Brave Search' : 'Model Built-in'}`,
    '',
  ];

  // Estimate ~4 chars per token
  const maxChars = maxTokens * 4;
  let currentChars = lines.join('\n').length;

  for (let i = 0; i < searchResponse.results.length; i++) {
    const result = searchResponse.results[i];

    const resultLines = [
      `### ${i + 1}. ${result.title}`,
      `URL: ${result.url}`,
      result.description,
      '',
    ];

    const resultText = resultLines.join('\n');

    if (currentChars + resultText.length > maxChars) {
      break;
    }

    lines.push(...resultLines);
    currentChars += resultText.length;
  }

  return lines.join('\n');
}

/**
 * Generate search queries from BRS content and section context
 *
 * @param sectionTitle - Title of the section being generated
 * @param brsContent - BRS document content
 * @param domainTerms - Domain-specific terms to include
 * @returns Array of search queries
 */
export function generateSearchQueries(
  sectionTitle: string,
  brsContent: string,
  domainTerms: string[] = []
): string[] {
  const queries: string[] = [];

  // Extract key terms from section title
  const titleTerms = sectionTitle
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(term => term.length > 3);

  // Generate queries based on section type
  const lowerTitle = sectionTitle.toLowerCase();

  if (lowerTitle.includes('architecture') || lowerTitle.includes('design')) {
    queries.push(`${titleTerms.join(' ')} technical architecture best practices`);
    if (domainTerms.length > 0) {
      queries.push(`${domainTerms.slice(0, 3).join(' ')} system architecture`);
    }
  } else if (lowerTitle.includes('requirement')) {
    queries.push(`${titleTerms.join(' ')} requirements specification standards`);
  } else if (lowerTitle.includes('procedure') || lowerTitle.includes('flow')) {
    queries.push(`${titleTerms.join(' ')} workflow procedures`);
  } else if (lowerTitle.includes('interface') || lowerTitle.includes('api')) {
    queries.push(`${titleTerms.join(' ')} interface specification`);
  } else {
    // Generic query
    queries.push(`${titleTerms.join(' ')} technical specification`);
  }

  // Add domain-specific query if terms provided
  if (domainTerms.length > 0) {
    const domainQuery = `${domainTerms.slice(0, 2).join(' ')} ${titleTerms[0] || 'specification'} standard`;
    queries.push(domainQuery);
  }

  // Extract technical terms from BRS content (look for capitalized terms, acronyms)
  const technicalTerms = brsContent.match(/\b[A-Z]{2,}(?:[A-Z0-9-]*[A-Z0-9])?\b/g) || [];
  const uniqueTerms = [...new Set(technicalTerms)].slice(0, 3);

  if (uniqueTerms.length > 0) {
    queries.push(`${uniqueTerms.join(' ')} specification standard`);
  }

  return queries.slice(0, 3); // Limit to 3 queries
}

/**
 * Perform web search and return formatted context
 *
 * @param sectionTitle - Section being generated
 * @param brsContent - BRS content for query generation
 * @param config - Search configuration
 * @returns Formatted search results or empty string if search unavailable
 */
export async function searchForSectionContext(
  sectionTitle: string,
  brsContent: string,
  config: WebSearchConfig = {}
): Promise<string> {
  if (!hasBraveApiKey()) {
    return '';
  }

  const queries = generateSearchQueries(sectionTitle, brsContent);

  if (queries.length === 0) {
    return '';
  }

  try {
    // Search with first query
    const response = await searchBrave(queries[0], {
      ...config,
      maxResults: config.maxResults || 5,
    });

    return formatSearchResultsForContext(response, 1500);
  } catch (error) {
    console.error('Web search for section context failed:', error);
    return '';
  }
}

/**
 * Build search hint for AI prompt when using model with built-in search
 *
 * @param sectionTitle - Section being generated
 * @param domainTerms - Domain-specific terms
 * @returns Search hint string for prompt
 */
export function buildSearchHintForPrompt(
  sectionTitle: string,
  domainTerms: string[] = []
): string {
  const hints = [
    `When generating content for "${sectionTitle}", you may search for:`,
  ];

  if (domainTerms.length > 0) {
    hints.push(`- Current ${domainTerms.slice(0, 2).join('/')} standards and best practices`);
  }

  hints.push(`- Industry specifications related to ${sectionTitle}`);
  hints.push('- Recent technical documentation and reference architectures');
  hints.push('');
  hints.push('Incorporate relevant findings into your response while maintaining consistency with the provided BRS and existing specification content.');

  return hints.join('\n');
}
