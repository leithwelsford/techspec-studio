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
