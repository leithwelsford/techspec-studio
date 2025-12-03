/**
 * AI Services - Central Export
 */

// Main AI Service
export { AIService, aiService } from './AIService';
export type { GenerationOptions, GenerationResult } from './AIService';

// Providers
export { OpenRouterProvider } from './providers/OpenRouterProvider';
export type { OpenRouterResponse, StreamChunk } from './providers/OpenRouterProvider';

// Prompts
export {
  buildSystemPrompt,
  build3GPPCompliancePrompt,
  buildConsistencyPrompt,
  buildRefinementPrompt,
  buildReviewPrompt,
  buildReferenceExtractionPrompt
} from './prompts/systemPrompts';

export {
  buildDocumentGenerationPrompt,
  buildSectionGenerationPrompt,
  buildSectionRefinementPrompt,
  buildIntroductionPrompt,
  buildRequirementsPrompt,
  buildArchitecturePrompt
} from './prompts/documentPrompts';

export {
  buildBlockDiagramPrompt,
  buildSequenceDiagramPrompt,
  buildFlowDiagramPrompt,
  buildDiagramSuggestionPrompt,
  buildDiagramRefinementPrompt,
  buildTextToDiagramPrompt
} from './prompts/diagramPrompts';

// Parsers
export {
  parseBlockDiagram,
  validateBlockDiagram,
  autoLayoutBlockDiagram,
  generateDefaultSizes,
  extractDiagramReferences,
  sanitizeDiagramId
} from './parsers/blockDiagramParser';

export {
  parseMermaidDiagram,
  detectMermaidType,
  fixMermaidSyntax,
  validateMermaidDiagram,
  extractSequenceParticipants,
  extractStates,
  generateMermaidPreview
} from './parsers/mermaidParser';

export type { ParseResult } from './parsers/blockDiagramParser';

// Token Counter
export {
  countTokens,
  countChatTokens,
  estimateContextTokens,
  getModelContextLimit,
  checkContextFits,
  truncateToTokenLimit,
  splitIntoChunks,
  formatTokenCount,
  cleanup as cleanupTokenCounter
} from './tokenCounter';

// Flexible Section Prompts
export {
  buildFlexibleSectionPrompt,
  buildIntroductionSectionPrompt,
  buildArchitectureSectionPrompt,
  buildRequirementsSectionPrompt,
  buildProceduresSectionPrompt,
  DIAGRAM_PLACEHOLDER_REQUIREMENTS
} from './prompts/sectionPrompts';

// Context Manager
export {
  calculateTokenBudget,
  extractRelevantExcerpts,
  buildOptimizedContext,
  formatBudgetInfo
} from './contextManager';
export type { ContextAllocation } from './contextManager';

// Web Search
export {
  searchBrave,
  searchForSectionContext,
  formatSearchResultsForContext,
  generateSearchQueries,
  buildSearchHintForPrompt,
  isWebSearchAvailable,
  hasBuiltinSearch,
  getSearchCapability,
  MODELS_WITH_BUILTIN_SEARCH
} from './webSearch';
export type {
  WebSearchResult,
  WebSearchResponse,
  WebSearchConfig
} from './webSearch';
