/**
 * AI Service
 * Main service layer for AI-powered content generation
 */

import type {
  AIConfig,
  AIMessage,
  AIContext,
  BlockDiagram,
  MermaidDiagram,
  ReferenceDocumentContent,
  AIMessageMultimodal,
  ReferenceDocument,
  ProposedStructure,
  StructureProposalResult,
  StructureRefinementResult,
  StructureChange,
} from '../../types';

import { OpenRouterProvider } from './providers/OpenRouterProvider';
import { buildSystemPrompt, buildRefinementPrompt, buildReviewPrompt } from './prompts/systemPrompts';
import {
  buildDocumentGenerationPrompt,
  buildSectionGenerationPrompt,
} from './prompts/documentPrompts';
import {
  buildBlockDiagramPrompt,
  buildSequenceDiagramPrompt,
  buildFlowDiagramPrompt,
  buildUnifiedMermaidPrompt,
  buildDiagramSuggestionPrompt
} from './prompts/diagramPrompts';
import {
  buildStructureProposalSystemPrompt,
  buildStructureProposalPrompt,
  buildStructureRefinementSystemPrompt,
  buildStructureRefinementPrompt,
  parseStructureProposalResponse,
  parseStructureRefinementResponse,
  generateDefaultStructure,
} from './prompts/structurePrompts';
import { parseBlockDiagram } from './parsers/blockDiagramParser';
import { parseMermaidDiagram, detectMermaidType } from './parsers/mermaidParser';

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
}

export interface GenerationResult {
  content: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost?: number;
}

/**
 * Detect if AI-generated content contains placeholder text
 * Returns true if placeholders are detected, false otherwise
 */
function hasPlaceholderText(content: string): boolean {
  const placeholderPatterns = [
    /\[Previous .*? remain.*?unchanged.*?\]/gi,
    /\[Previous .*? identical.*?\]/gi,
    /\[Other .*? unchanged.*?\]/gi,
    /\[Subsequent .*? continue.*?\]/gi,
    /\[Note:.*?\]/gi,
    /\[The rest .*? remains.*?\]/gi,
    /\[Sections? \d+-\d+ remain.*?\]/gi,
    /\[.*? would be similarly updated.*?\]/gi,
    /\[Content .*? unchanged.*?\]/gi,
    /\[Remaining .*?\]/gi,
  ];

  return placeholderPatterns.some(pattern => pattern.test(content));
}

/**
 * Main AI Service for content generation
 */
export class AIService {
  private provider: OpenRouterProvider | null = null;
  private config: AIConfig | null = null;

  /**
   * Initialize AI service with configuration
   * Also pre-fetches model list to populate context length cache
   */
  initialize(config: AIConfig): void {
    this.config = config;

    switch (config.provider) {
      case 'openrouter':
        this.provider = new OpenRouterProvider(config.apiKey);
        // Pre-fetch models to populate context length cache (non-blocking)
        this.provider.listModels().catch(err => {
          console.warn('Failed to pre-fetch OpenRouter models:', err);
        });
        break;
      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }

  /**
   * Test if the AI service is properly configured and connected
   */
  async testConnection(): Promise<boolean> {
    if (!this.provider) {
      throw new Error('AI service not initialized');
    }

    return await this.provider.testConnection();
  }

  /**
   * Check if the currently configured model supports vision/multimodal input
   * Vision models can process PDFs and images natively without text extraction
   */
  isVisionModel(): boolean {
    if (!this.provider || !this.config) {
      return false;
    }
    return this.provider.isVisionModel(this.config.model);
  }

  /**
   * Get the current model ID
   */
  getCurrentModel(): string | null {
    return this.config?.model || null;
  }

  /**
   * Get available models from the provider
   */
  async listModels(): Promise<Array<{ id: string; name: string; context_length: number }>> {
    if (!this.provider) {
      throw new Error('AI service not initialized');
    }

    return await this.provider.listModels();
  }

  /**
   * Generate a complete document
   */
  async generateDocument(
    title: string,
    sections: string[],
    context?: AIContext,
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    const systemPrompt = buildSystemPrompt({
      documentTitle: title,
      availableDiagrams: context?.availableDiagrams,
      availableReferences: context?.availableReferences,
      userInstructions: context?.userInstructions
    });

    const userPrompt = buildDocumentGenerationPrompt({
      title,
      sections,
      context
    });

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const result = await this.provider.generate(messages, {
      model: this.config.model,
      temperature: options?.temperature ?? this.config.temperature,
      maxTokens: options?.maxTokens ?? this.config.maxTokens
    });

    return {
      content: result.content,
      tokens: result.tokens,
      cost: result.cost
    };
  }

  /**
   * Generate a specific section
   */
  async generateSection(
    sectionTitle: string,
    sectionNumber: string,
    requirements: string = '',
    context?: AIContext,
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    const systemPrompt = buildSystemPrompt({
      documentTitle: context?.currentDocument ? 'Current Document' : undefined,
      availableDiagrams: context?.availableDiagrams,
      availableReferences: context?.availableReferences,
      userInstructions: context?.userInstructions
    });

    const userPrompt = buildSectionGenerationPrompt(
      sectionTitle,
      sectionNumber,
      requirements,
      context
    );

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const result = await this.provider.generate(messages, {
      model: this.config.model,
      temperature: options?.temperature ?? this.config.temperature,
      maxTokens: options?.maxTokens ?? this.config.maxTokens
    });

    return {
      content: result.content,
      tokens: result.tokens,
      cost: result.cost
    };
  }

  /**
   * Generate content with PDF reference documents attached
   * Uses vision model multimodal capabilities for native PDF processing
   *
   * @param prompt - The text prompt for generation
   * @param pdfReferences - Array of PDF references with base64 data
   * @param systemPrompt - Optional system prompt
   * @param options - Generation options
   * @returns Generated content with token usage and cost
   */
  async generateWithPDFReferences(
    prompt: string,
    pdfReferences: ReferenceDocumentContent[],
    systemPrompt?: string,
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    // Check if model supports multimodal
    if (!this.isVisionModel()) {
      console.warn(`⚠️ Model ${this.config.model} does not support multimodal. Falling back to text-only generation.`);
      // Fall back to text-only generation with PDF content as text
      const textContext = pdfReferences
        .filter(ref => ref.extractedText)
        .map(ref => `\n\n--- Reference Document: ${ref.title} ---\n${ref.extractedText}`)
        .join('');

      const messages = systemPrompt
        ? [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt + textContext }
          ]
        : [{ role: 'user', content: prompt + textContext }];

      const result = await this.provider.generate(messages, {
        model: this.config.model,
        temperature: options?.temperature ?? this.config.temperature,
        maxTokens: options?.maxTokens ?? this.config.maxTokens
      });

      return {
        content: result.content,
        tokens: result.tokens,
        cost: result.cost
      };
    }

    // Build multimodal messages with PDF attachments
    console.log(`📄 Generating with ${pdfReferences.length} PDF reference(s) using multimodal...`);

    const pdfsWithData = pdfReferences.filter(ref => ref.base64Data);

    if (pdfsWithData.length === 0) {
      console.warn('⚠️ No PDFs have base64 data. Falling back to text-only generation.');
      // Fall back to text context
      const textContext = pdfReferences
        .filter(ref => ref.extractedText)
        .map(ref => `\n\n--- Reference Document: ${ref.title} ---\n${ref.extractedText}`)
        .join('');

      const messages = systemPrompt
        ? [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt + textContext }
          ]
        : [{ role: 'user', content: prompt + textContext }];

      const result = await this.provider.generate(messages, {
        model: this.config.model,
        temperature: options?.temperature ?? this.config.temperature,
        maxTokens: options?.maxTokens ?? this.config.maxTokens
      });

      return {
        content: result.content,
        tokens: result.tokens,
        cost: result.cost
      };
    }

    // Create multimodal content with PDFs
    const { OpenRouterProvider } = await import('./providers/OpenRouterProvider');
    const pdfData = pdfsWithData.map(ref => ({
      filename: ref.filename || `${ref.title}.pdf`,
      base64Data: ref.base64Data!
    }));

    const multimodalContent = OpenRouterProvider.createMultiplePDFContent(prompt, pdfData);

    const multimodalMessages: AIMessageMultimodal[] = [];

    // Add system message if provided
    if (systemPrompt) {
      multimodalMessages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    // Add user message with multimodal content
    multimodalMessages.push({
      role: 'user',
      content: multimodalContent
    });

    const result = await this.provider.generateMultimodal(multimodalMessages, {
      model: this.config.model,
      temperature: options?.temperature ?? this.config.temperature,
      maxTokens: options?.maxTokens ?? this.config.maxTokens
    });

    console.log(`✅ Multimodal generation complete:`, {
      contentLength: result.content.length,
      tokens: result.tokens,
      cost: result.cost
    });

    return {
      content: result.content,
      tokens: result.tokens,
      cost: result.cost
    };
  }

  /**
   * Refine existing content based on feedback
   */
  async refineContent(
    originalContent: string,
    feedback: string,
    options?: GenerationOptions & { isPartialSelection?: boolean }
  ): Promise<GenerationResult> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    const prompt = buildRefinementPrompt(originalContent, feedback, options?.isPartialSelection || false);

    const messages = [
      { role: 'user', content: prompt }
    ];

    // For reasoning models (o1, GPT-5), use much higher output token limit
    // For large document refinements, we need even more tokens
    const isReasoningModel = this.config.model.toLowerCase().includes('o1') ||
                             this.config.model.toLowerCase().includes('gpt-5');

    // Calculate appropriate token limit based on input size
    const inputLines = originalContent.split('\n').length;
    let refinementMaxTokens: number;

    if (isReasoningModel) {
      // For reasoning models: scale with input size
      if (inputLines > 500) {
        refinementMaxTokens = 64000; // Very large documents
      } else if (inputLines > 200) {
        refinementMaxTokens = 32000; // Large documents
      } else {
        refinementMaxTokens = 16000; // Medium documents
      }
    } else {
      // For non-reasoning models
      refinementMaxTokens = options?.maxTokens ?? this.config.maxTokens ?? 8000;
    }

    console.log(`🎯 Refining content with maxTokens: ${refinementMaxTokens}`, {
      isReasoningModel,
      inputLines,
      inputChars: originalContent.length,
    });

    const result = await this.provider.generate(messages, {
      model: this.config.model,
      temperature: options?.temperature ?? this.config.temperature,
      maxTokens: refinementMaxTokens
    });

    // Debug logging for LLM output
    const finishReason = (result as any).finishReason || 'unknown';
    console.log('🤖 AI Refinement Result:', {
      model: this.config.model,
      originalLength: originalContent.length,
      originalLines: originalContent.split('\n').length,
      generatedLength: result.content.length,
      generatedLines: result.content.split('\n').length,
      sizeDelta: result.content.length - originalContent.length,
      tokens: result.tokens,
      cost: result.cost,
      finishReason,
    });

    console.log('📝 Original Content (first 500 chars):', originalContent.substring(0, 500));
    console.log('✨ Generated Content (first 500 chars):', result.content.substring(0, 500));
    console.log('📄 Full Generated Content:', result.content);

    // Warn if output was truncated
    if (finishReason === 'length' || finishReason === 'max_output_tokens') {
      console.error('❌ CRITICAL: Refinement output was TRUNCATED due to token limit!');
      console.error(`   Generated only ${result.content.length} chars (${result.content.split('\n').length} lines)`);
      console.error(`   Original was ${originalContent.length} chars (${originalContent.split('\n').length} lines)`);
      console.error(`   Used maxTokens: ${refinementMaxTokens}`);
      console.error(`   This means content after the truncation point is LOST!`);

      throw new Error(
        `AI refinement was truncated due to token limit! ` +
        `Generated ${result.content.split('\n').length} lines but original had ${originalContent.split('\n').length} lines. ` +
        `Content after line ${result.content.split('\n').length} was lost. ` +
        `Try refining smaller sections at a time, or switch to a model with larger output capacity.`
      );
    }

    // Check for placeholder text - if found, throw error with helpful message
    if (hasPlaceholderText(result.content)) {
      console.error('❌ Placeholder text detected in AI output!');
      throw new Error(
        'AI generated incomplete content with placeholders. ' +
        'This usually means the AI model is being lazy. ' +
        'Try again, or try a different model (Claude Opus is more reliable for complete output).'
      );
    }

    return {
      content: result.content,
      tokens: result.tokens,
      cost: result.cost
    };
  }

  /**
   * Review content and provide suggestions
   */
  async reviewContent(
    content: string,
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    const prompt = buildReviewPrompt(content);

    const messages = [
      { role: 'user', content: prompt }
    ];

    const result = await this.provider.generate(messages, {
      model: this.config.model,
      temperature: options?.temperature ?? this.config.temperature,
      maxTokens: options?.maxTokens ?? this.config.maxTokens
    });

    return {
      content: result.content,
      tokens: result.tokens,
      cost: result.cost
    };
  }

  /**
   * Generate a block diagram from description
   */
  async generateBlockDiagram(
    description: string,
    title: string,
    figureNumber?: string,
    options?: GenerationOptions & { userGuidance?: string }
  ): Promise<{ diagram?: BlockDiagram; errors: string[]; warnings: string[] }> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    const prompt = buildBlockDiagramPrompt(description, title, figureNumber, options?.userGuidance);

    console.log('📋 Block diagram prompt details:');
    console.log(`   Title: ${title}`);
    console.log(`   Description length: ${description.length} chars`);
    console.log(`   Description preview (first 500 chars): ${description.substring(0, 500)}...`);
    console.log(`   User guidance length: ${options?.userGuidance?.length || 0} chars`);
    if (options?.userGuidance) {
      console.log(`   User guidance preview (first 300 chars): ${options.userGuidance.substring(0, 300)}...`);
    }
    console.log(`   Total prompt length: ${prompt.length} chars`);

    const messages = [
      { role: 'user', content: prompt }
    ];

    const generationConfig = {
      model: this.config.model,
      temperature: options?.temperature ?? 0.3, // Lower temperature for structured output
      maxTokens: options?.maxTokens ?? 2000
    };

    console.log('🎨 Block diagram generation config:', {
      model: generationConfig.model,
      maxTokens: generationConfig.maxTokens,
      optionsMaxTokens: options?.maxTokens,
      hasOptions: !!options
    });

    const result = await this.provider.generate(messages, generationConfig);

    // Parse the JSON response
    const parseResult = parseBlockDiagram(result.content);

    if (!parseResult.success) {
      return {
        errors: parseResult.errors,
        warnings: parseResult.warnings
      };
    }

    return {
      diagram: parseResult.data,
      errors: [],
      warnings: parseResult.warnings
    };
  }

  /**
   * Generate a sequence diagram (Mermaid)
   */
  async generateSequenceDiagram(
    description: string,
    title: string,
    participants: string[] = [],
    figureNumber?: string,
    options?: GenerationOptions & { userGuidance?: string }
  ): Promise<{ diagram?: MermaidDiagram; errors: string[]; warnings: string[] }> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    const prompt = buildSequenceDiagramPrompt(description, title, participants, figureNumber, options?.userGuidance);

    console.log('🎨 Sending sequence diagram prompt:', {
      title,
      participantsCount: participants.length,
      descriptionLength: description.length,
      promptLength: prompt.length,
      model: this.config.model,
      maxTokens: options?.maxTokens ?? 2000
    });

    const messages = [
      { role: 'user', content: prompt }
    ];

    const result = await this.provider.generate(messages, {
      model: this.config.model,
      temperature: options?.temperature ?? 0.3,
      maxTokens: options?.maxTokens ?? 2000
    });

    console.log('🎨 AI returned sequence diagram content:', result.content);
    console.log('🎨 Content length:', result.content.length);

    // Parse the Mermaid code
    const parseResult = parseMermaidDiagram(result.content, 'sequence', title, figureNumber);

    console.log('🎨 Parse result:', parseResult);

    if (!parseResult.success) {
      return {
        errors: parseResult.errors,
        warnings: parseResult.warnings
      };
    }

    return {
      diagram: parseResult.data,
      errors: [],
      warnings: parseResult.warnings
    };
  }

  /**
   * Generate a flow diagram (Mermaid)
   */
  async generateFlowDiagram(
    description: string,
    title: string,
    diagramType: 'flowchart' | 'stateDiagram' = 'flowchart',
    figureNumber?: string,
    options?: GenerationOptions
  ): Promise<{ diagram?: MermaidDiagram; errors: string[]; warnings: string[] }> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    const prompt = buildFlowDiagramPrompt(description, title, diagramType, figureNumber);

    const messages = [
      { role: 'user', content: prompt }
    ];

    const result = await this.provider.generate(messages, {
      model: this.config.model,
      temperature: options?.temperature ?? 0.3,
      maxTokens: options?.maxTokens ?? 2000
    });

    // Parse the Mermaid code
    const type = diagramType === 'stateDiagram' ? 'state' : 'flow';
    const parseResult = parseMermaidDiagram(result.content, type, title, figureNumber);

    if (!parseResult.success) {
      return {
        errors: parseResult.errors,
        warnings: parseResult.warnings
      };
    }

    return {
      diagram: parseResult.data,
      errors: [],
      warnings: parseResult.warnings
    };
  }

  /**
   * Generate a Mermaid diagram using unified prompt - AI decides the appropriate type
   * This is the preferred method as it trusts the AI to understand the TODO/description
   * and select the correct diagram type (sequence, flowchart, or state).
   */
  async generateMermaidDiagram(
    description: string,
    title: string,
    figureNumber?: string,
    userGuidance?: string,
    options?: GenerationOptions
  ): Promise<{ diagram?: MermaidDiagram; errors: string[]; warnings: string[]; detectedType?: string }> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    const prompt = buildUnifiedMermaidPrompt(description, title, figureNumber, userGuidance);

    const messages = [
      { role: 'user', content: prompt }
    ];

    const result = await this.provider.generate(messages, {
      model: this.config.model,
      temperature: options?.temperature ?? 0.3,
      maxTokens: options?.maxTokens ?? 4000
    });

    // Debug: Log the raw AI response to help diagnose parsing issues
    console.log(`🔍 AI Mermaid response (first 500 chars): "${result.content.substring(0, 500)}..."`);

    // Auto-detect the diagram type from the AI's output
    const detectedType = detectMermaidType(result.content);
    console.log(`🔍 AI generated Mermaid diagram, detected type: ${detectedType || 'unknown'}`);

    if (!detectedType) {
      // Provide more context in the error message
      const preview = result.content.substring(0, 200).replace(/\n/g, '\\n');
      return {
        errors: [`Could not detect Mermaid diagram type from AI output. Expected sequenceDiagram, flowchart, or stateDiagram-v2. Response preview: "${preview}..."`],
        warnings: [],
        detectedType: undefined
      };
    }

    // Parse with the detected type
    const parseResult = parseMermaidDiagram(result.content, detectedType, title, figureNumber);

    if (!parseResult.success) {
      return {
        errors: parseResult.errors,
        warnings: parseResult.warnings,
        detectedType
      };
    }

    return {
      diagram: parseResult.data,
      errors: [],
      warnings: parseResult.warnings,
      detectedType
    };
  }

  /**
   * Suggest diagrams for a document section
   */
  async suggestDiagrams(
    sectionTitle: string,
    sectionContent: string,
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    const prompt = buildDiagramSuggestionPrompt(sectionTitle, sectionContent);

    const messages = [
      { role: 'user', content: prompt }
    ];

    const result = await this.provider.generate(messages, {
      model: this.config.model,
      temperature: options?.temperature ?? this.config.temperature,
      maxTokens: options?.maxTokens ?? 2000
    });

    return {
      content: result.content,
      tokens: result.tokens,
      cost: result.cost
    };
  }

  /**
   * Chat with AI (general conversation)
   */
  async chat(
    message: string,
    history: AIMessage[] = [],
    context?: AIContext,
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    // Build system prompt with context
    const systemPrompt = buildSystemPrompt({
      currentDocument: context?.currentDocument,
      availableDiagrams: context?.availableDiagrams,
      availableReferences: context?.availableReferences,
      userInstructions: context?.userInstructions
    });

    // Convert history to message format
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    // Build config with optional reasoning parameter
    const generateConfig: any = {
      model: this.config.model,
      temperature: options?.temperature ?? this.config.temperature,
      maxTokens: options?.maxTokens ?? this.config.maxTokens
    };

    // Pass through reasoning parameter if provided in options
    if ((options as any)?.reasoning) {
      generateConfig.reasoning = (options as any).reasoning;
    }

    const result = await this.provider.generate(messages, generateConfig);

    return {
      content: result.content,
      tokens: result.tokens,
      cost: result.cost
    };
  }

  /**
   * Streaming chat (for real-time responses)
   */
  async *chatStream(
    message: string,
    history: AIMessage[] = [],
    context?: AIContext,
    options?: GenerationOptions
  ): AsyncGenerator<string, void, unknown> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    const systemPrompt = buildSystemPrompt({
      currentDocument: context?.currentDocument,
      availableDiagrams: context?.availableDiagrams,
      availableReferences: context?.availableReferences,
      userInstructions: context?.userInstructions
    });

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    const stream = this.provider.generateStream(messages, {
      model: this.config.model,
      temperature: options?.temperature ?? this.config.temperature,
      maxTokens: options?.maxTokens ?? this.config.maxTokens
    });

    for await (const chunk of stream) {
      if (!chunk.done && chunk.content) {
        yield chunk.content;
      }
    }
  }

  /**
   * Auto-generate diagrams from Technical Specification
   * Uses intelligent content-based section analysis to determine which sections need diagrams
   * No longer relies on hardcoded section numbers
   */
  async generateDiagramsFromSpec(
    specificationMarkdown: string,
    onProgress?: (current: number, total: number, diagramTitle: string) => void,
    userGuidance?: string,
    options?: {
      mandatoryOnly?: boolean; // If true, only generate diagrams with {{fig:...}} placeholders
    }
  ): Promise<{
    blockDiagrams: BlockDiagram[];
    sequenceDiagrams: MermaidDiagram[];
    errors: string[];
    warnings: string[];
    suggestedSections?: Array<{
      sectionId: string;
      sectionTitle: string;
      diagramType: string;
      reasoning: string;
    }>;
  }> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    const blockDiagrams: BlockDiagram[] = [];
    const sequenceDiagrams: MermaidDiagram[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const mandatoryOnly = options?.mandatoryOnly ?? false;

    console.log('🔍 Starting intelligent section analysis...');
    console.log(`   Mode: ${mandatoryOnly ? 'MANDATORY ONLY ({{fig:...}} placeholders)' : 'ALL (mandatory + suggested)'}`);

    // Use intelligent section analyzer to find diagram-worthy sections
    const {
      analyzeSectionsForDiagrams,
      getBlockDiagramSections,
      getSuggestedSections,
      getFigureRefsOfType,
      getMermaidDiagramSections,
      getMermaidFigureRefs
    } = await import('./sectionAnalyzer');

    // Analyze all sections to determine which need diagrams
    onProgress?.(0, 1, 'Analyzing specification sections...');
    const analyses = await analyzeSectionsForDiagrams(specificationMarkdown, this);

    // Filter sections: block (JSON) vs Mermaid (text syntax)
    const blockSections = getBlockDiagramSections(analyses, mandatoryOnly);

    // Get all Mermaid sections (sequence, flow, state) - AI will determine exact type
    const mermaidSections = getMermaidDiagramSections(analyses, mandatoryOnly);

    // Get suggested sections (not mandatory) for user review
    const suggestedSections = mandatoryOnly ? getSuggestedSections(analyses).map(s => ({
      sectionId: s.sectionId,
      sectionTitle: s.sectionTitle,
      diagramType: s.diagramType,
      reasoning: s.reasoning
    })) : undefined;

    // Count block diagrams (JSON format)
    const blockDiagramCount = blockSections.reduce((count, s) => {
      const blockRefs = getFigureRefsOfType(s, 'block');
      if (blockRefs.length > 0) {
        return count + blockRefs.length;
      } else if (!s.figureReferences || s.figureReferences.length === 0) {
        return count + 1; // Suggested section
      }
      return count;
    }, 0);

    // Count Mermaid diagrams using the unified approach (avoids triple-counting)
    // mermaidSections already defined above
    const mermaidDiagramCount = mermaidSections.reduce((count, s) => {
      const mermaidRefs = getMermaidFigureRefs(s);
      if (mermaidRefs.length > 0) {
        return count + mermaidRefs.length;
      } else if (!s.figureReferences || s.figureReferences.length === 0) {
        return count + 1; // Suggested section
      }
      return count;
    }, 0);

    const totalDiagrams = blockDiagramCount + mermaidDiagramCount;
    let currentDiagram = 0;

    console.log('📊 Diagram generation plan (v2 - fixed counting):');
    console.log(`  Block diagrams: ${blockDiagramCount} (from ${blockSections.length} sections)`);
    console.log(`  Mermaid diagrams: ${mermaidDiagramCount} (from ${mermaidSections.length} sections)`);
    console.log(`  Total diagrams to generate: ${totalDiagrams}`);
    console.log(`  Section types breakdown:`, analyses.map(a => `${a.sectionId}: ${a.diagramType}`).join(', '));
    if (suggestedSections && suggestedSections.length > 0) {
      console.log(`  📋 Suggested sections (not generated, for user review): ${suggestedSections.length}`);
    }

    // Generate block diagrams from architecture sections
    // IMPORTANT: Generate ONE diagram PER figure reference of matching type
    if (blockSections.length > 0) {
      console.log('\n📐 Generating block diagrams...');

      for (const section of blockSections) {
        // Get ONLY the figure references that are typed as 'block'
        const blockFigureRefs = getFigureRefsOfType(section, 'block');
        // For mandatory sections: one per figure reference of matching type
        // For suggested sections: one per section
        const figureRefs = blockFigureRefs.length > 0
          ? blockFigureRefs
          : (section.figureReferences?.length ? [] : [null]); // null = suggested diagram, use section-based ID

        // Skip if no block-type figures in this section
        if (figureRefs.length === 0) continue;

        for (let figIdx = 0; figIdx < figureRefs.length; figIdx++) {
          const figureRef = figureRefs[figIdx];
          currentDiagram++;

          const diagramId = figureRef || `${section.sectionId}-${figIdx + 1}`;
          const diagramLabel = figureRef ? `{{fig:${figureRef}}}` : `suggested-${figIdx + 1}`;

          onProgress?.(currentDiagram, totalDiagrams, `${section.sectionId} ${diagramLabel}`);

          const mandatoryLabel = section.isMandatory ? '[MANDATORY]' : '[SUGGESTED]';
          console.log(`\n📐 [${currentDiagram}/${totalDiagrams}] ${mandatoryLabel} ${section.sectionId}: ${section.sectionTitle}`);
          console.log(`   Figure: ${diagramLabel}`);
          console.log(`   Reason: ${section.reasoning}`);
          if (section.todoComments && section.todoComments.length > 0) {
            console.log(`   📝 Using TODO instructions (${section.todoComments.length})`);
          }

          try {
            // Use appropriate token limits for block diagram generation
            const { isReasoningModel } = await import('../../utils/aiModels');
            const isReasoning = isReasoningModel(this.config.model || '');
            const maxTokens = isReasoning ? 64000 : 4000;

            // Combine user guidance with TODO comments
            let combinedGuidance = userGuidance || '';
            if (section.todoComments && section.todoComments.length > 0) {
              const todoGuidance = section.todoComments.join('\n\n');
              combinedGuidance = combinedGuidance
                ? `${combinedGuidance}\n\n**IMPORTANT - Diagram Requirements from Specification:**\n${todoGuidance}`
                : `**IMPORTANT - Diagram Requirements from Specification:**\n${todoGuidance}`;
            }

            // Add context about which specific figure we're generating
            if (figureRef && figureRefs.length > 1) {
              combinedGuidance = combinedGuidance
                ? `${combinedGuidance}\n\n**Specific Figure:** Generate diagram for {{fig:${figureRef}}} - this section has ${figureRefs.length} figure placeholders.`
                : `**Specific Figure:** Generate diagram for {{fig:${figureRef}}} - this section has ${figureRefs.length} figure placeholders.`;
            }

            const blockOptions: any = { maxTokens, userGuidance: combinedGuidance };
            if (isReasoning) {
              blockOptions.reasoning = { effort: 'high' };
            }

            // DIAGNOSTIC: Check section.content before passing to generateBlockDiagram
            console.log(`🔍 DIAGNOSTIC - Section content before diagram generation:`);
            console.log(`   Section ID: ${section.sectionId}`);
            console.log(`   Section Title: ${section.sectionTitle}`);
            console.log(`   Diagram ID: ${diagramId}`);
            console.log(`   Content length: ${section.content.length} chars`);
            console.log(`   Content preview (first 300 chars): ${section.content.substring(0, 300)}...`);

            const blockResult = await this.generateBlockDiagram(
              section.content,
              section.sectionTitle,
              diagramId,
              blockOptions
            );

            if (blockResult.diagram) {
              // Add source section reference
              blockResult.diagram.sourceSection = {
                id: section.sectionId,
                title: section.sectionTitle
              };
              blockDiagrams.push(blockResult.diagram);
              console.log(`✅ Block diagram generated (${mandatoryLabel}): ${section.sectionTitle} → ID: ${diagramId}`);
            }
            errors.push(...blockResult.errors);
            warnings.push(...blockResult.warnings);
          } catch (err) {
            console.error(`❌ Error generating block diagram for ${section.sectionTitle} (${diagramId}):`, err);
            errors.push(`Failed to generate block diagram for ${section.sectionTitle} (${diagramId}): ${err}`);
          }
        }
      }
    } else {
      warnings.push('No architecture sections detected. Block diagram generation skipped.');
      console.warn('⚠️ No architecture sections detected in specification');
    }

    // Generate Mermaid diagrams (sequence, flow, state) using unified prompt
    // AI decides the appropriate diagram type based on TODO comments and section content
    // This eliminates the need for complex pattern matching to determine type upfront
    // Note: mermaidSections and getMermaidFigureRefs already imported above for counting

    if (mermaidSections.length > 0) {
      console.log(`\n📊 Generating ${mermaidDiagramCount} Mermaid diagrams (AI determines type)...`);

      for (const section of mermaidSections) {
        // Get all Mermaid figure references (non-block diagrams)
        const mermaidFigureRefs = getMermaidFigureRefs(section);
        const figureRefs = mermaidFigureRefs.length > 0
          ? mermaidFigureRefs
          : (section.figureReferences?.length ? [] : [null]); // null = suggested diagram

        // Skip if no mermaid-type figures in this section
        if (figureRefs.length === 0) continue;

        for (let figIdx = 0; figIdx < figureRefs.length; figIdx++) {
          const figureRef = figureRefs[figIdx];
          currentDiagram++;

          const diagramId = figureRef || `${section.sectionId}-${figIdx + 1}`;
          const diagramLabel = figureRef ? `{{fig:${figureRef}}}` : `suggested-${figIdx + 1}`;

          onProgress?.(currentDiagram, totalDiagrams, `${section.sectionId} ${diagramLabel}`);

          const mandatoryLabel = section.isMandatory ? '[MANDATORY]' : '[SUGGESTED]';
          console.log(`\n📊 [${currentDiagram}/${totalDiagrams}] ${mandatoryLabel} ${section.sectionId}: ${section.sectionTitle}`);
          console.log(`   Figure: ${diagramLabel}`);
          console.log(`   Heuristic type: ${section.diagramType} (AI will verify)`);
          if (section.todoComments && section.todoComments.length > 0) {
            console.log(`   📝 Using TODO instructions (${section.todoComments.length})`);
          }

          try {
            // Use appropriate token limits for diagram generation
            const { isReasoningModel } = await import('../../utils/aiModels');
            const isReasoning = isReasoningModel(this.config.model || '');
            const maxTokens = isReasoning ? 64000 : 4000;

            // Combine user guidance with TODO comments
            let combinedGuidance = userGuidance || '';
            if (section.todoComments && section.todoComments.length > 0) {
              const todoGuidance = section.todoComments.join('\n\n');
              combinedGuidance = combinedGuidance
                ? `${combinedGuidance}\n\n**IMPORTANT - Diagram Requirements from Specification:**\n${todoGuidance}`
                : `**IMPORTANT - Diagram Requirements from Specification:**\n${todoGuidance}`;
            }

            // Add context about which specific figure we're generating
            if (figureRef && figureRefs.length > 1) {
              combinedGuidance = combinedGuidance
                ? `${combinedGuidance}\n\n**Specific Figure:** Generate diagram for {{fig:${figureRef}}} - this section has ${figureRefs.length} figure placeholders.`
                : `**Specific Figure:** Generate diagram for {{fig:${figureRef}}} - this section has ${figureRefs.length} figure placeholders.`;
            }

            const mermaidOptions: GenerationOptions = { maxTokens };

            // Use unified Mermaid prompt - AI decides the type based on content
            const mermaidResult = await this.generateMermaidDiagram(
              section.content,
              section.sectionTitle,
              diagramId,
              combinedGuidance,
              mermaidOptions
            );

            if (mermaidResult.diagram) {
              // Add source section reference
              mermaidResult.diagram.sourceSection = {
                id: section.sectionId,
                title: section.sectionTitle
              };
              sequenceDiagrams.push(mermaidResult.diagram);
              console.log(`✅ ${mermaidResult.detectedType || 'Mermaid'} diagram generated (${mandatoryLabel}): ${section.sectionTitle} → ID: ${diagramId}`);
            } else {
              console.error(`❌ No diagram generated for: ${section.sectionTitle} (${diagramId})`, mermaidResult.errors);
            }
            errors.push(...mermaidResult.errors);
            warnings.push(...mermaidResult.warnings);
          } catch (err) {
            console.error(`❌ Error generating Mermaid diagram for ${section.sectionTitle} (${diagramId}):`, err);
            errors.push(`Failed to generate Mermaid diagram for ${section.sectionTitle} (${diagramId}): ${err}`);
          }
        }
      }
    } else {
      console.log('ℹ️ No Mermaid diagram sections detected');
    }

    console.log('\n✅ Diagram generation complete!');
    console.log(`  Block diagrams: ${blockDiagrams.length}`);
    console.log(`  Sequence diagrams: ${sequenceDiagrams.length}`);
    console.log(`  Errors: ${errors.length}`);
    console.log(`  Warnings: ${warnings.length}`);
    if (suggestedSections && suggestedSections.length > 0) {
      console.log(`  Suggested (not generated): ${suggestedSections.length} sections`);
    }

    return {
      blockDiagrams,
      sequenceDiagrams,
      errors,
      warnings,
      suggestedSections
    };
  }

  /**
   * DEPRECATED: Auto-generate diagrams from BRS analysis
   * @deprecated Use generateDiagramsFromSpec() instead for sequential workflow
   * Creates block diagrams for architecture and sequence diagrams for procedures
   */
  async generateDiagramsFromBRS(
    brsAnalysis: any,
    onProgress?: (current: number, total: number, diagramTitle: string) => void
  ): Promise<{
    blockDiagrams: BlockDiagram[];
    sequenceDiagrams: MermaidDiagram[];
    errors: string[];
    warnings: string[];
  }> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    const blockDiagrams: BlockDiagram[] = [];
    const sequenceDiagrams: MermaidDiagram[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Generate block diagrams from architecture components
    if (brsAnalysis.components && brsAnalysis.interfaces) {
      const architectureDescription = `
        System Components: ${brsAnalysis.components.join(', ')}

        Interfaces:
        ${brsAnalysis.interfaces.map((i: any) =>
          `- ${i.name}: connects ${i.between?.join(' and ') || 'components'} using ${i.standard || 'standard protocol'}`
        ).join('\n')}

        This is a telecommunications system architecture following 3GPP standards.
      `;

      if (onProgress) {
        onProgress(1, 1 + (brsAnalysis.procedures?.length || 0), 'System Architecture');
      }

      // Use appropriate token limits for block diagram generation
      // For reasoning models (o1, GPT-5), max_tokens is OUTPUT tokens only (reasoning tokens separate)
      // Benchmarking showed ~12.6k total, but we need 64k output tokens for complex diagrams
      const { isReasoningModel } = await import('../../utils/aiModels');
      const isReasoning = isReasoningModel(this.config.model || '');
      const maxTokens = isReasoning ? 64000 : 4000;

      const blockOptions: any = { maxTokens };
      if (isReasoning) {
        blockOptions.reasoning = { effort: 'high' };
      }

      const blockResult = await this.generateBlockDiagram(
        architectureDescription,
        'System Architecture Overview',
        '4-1',
        blockOptions
      );

      if (blockResult.diagram) {
        blockDiagrams.push(blockResult.diagram);
      }
      errors.push(...blockResult.errors);
      warnings.push(...blockResult.warnings);
    }

    // Generate sequence diagrams from procedures
    console.log('🔍 BRS Analysis procedures:', brsAnalysis.procedures);
    console.log('🔍 Is array?', Array.isArray(brsAnalysis.procedures));
    console.log('🔍 Length:', brsAnalysis.procedures?.length);

    if (brsAnalysis.procedures && Array.isArray(brsAnalysis.procedures)) {
      console.log(`📊 Generating ${brsAnalysis.procedures.length} sequence diagrams from procedures...`);

      for (let i = 0; i < brsAnalysis.procedures.length; i++) {
        const procedure = brsAnalysis.procedures[i];
        console.log(`\n🔄 Processing procedure ${i + 1}/${brsAnalysis.procedures.length}:`, procedure.name);

        if (onProgress) {
          onProgress(2 + i, 1 + brsAnalysis.procedures.length, procedure.name || 'Procedure');
        }

        const procedureDescription = `
          Procedure: ${procedure.name}

          Steps:
          ${procedure.steps?.join('\n') || 'No steps provided'}

          Participants: ${procedure.participants?.join(', ') || 'Not specified'}
        `;

        console.log('📝 Procedure description:', procedureDescription);

        try {
          // Use appropriate token limits for sequence diagram generation
          // For reasoning models (o1, GPT-5), max_tokens is OUTPUT tokens only
          // Reasoning tokens are separate, so we need high output limits
          const { isReasoningModel } = await import('../../utils/aiModels');
          const isReasoning = isReasoningModel(this.config.model || '');
          const maxTokens = isReasoning ? 64000 : 4000;

          const seqOptions: any = { maxTokens };
          if (isReasoning) {
            seqOptions.reasoning = { effort: 'high' };
          }

          const seqResult = await this.generateSequenceDiagram(
            procedureDescription,
            procedure.name || 'Procedure Flow',
            procedure.participants || [],
            `6-${i + 1}`,
            seqOptions
          );

          console.log('✅ Sequence diagram result:', {
            hasDiagram: !!seqResult.diagram,
            errors: seqResult.errors,
            warnings: seqResult.warnings
          });

          if (seqResult.diagram) {
            sequenceDiagrams.push(seqResult.diagram);
            console.log(`✅ Added sequence diagram: ${procedure.name}`);
          } else {
            console.error(`❌ No diagram generated for: ${procedure.name}`, seqResult.errors);
          }
          errors.push(...seqResult.errors);
          warnings.push(...seqResult.warnings);
        } catch (err) {
          console.error(`❌ Error generating sequence diagram for ${procedure.name}:`, err);
          errors.push(`Failed to generate diagram for ${procedure.name}: ${err}`);
        }
      }

      console.log(`\n📊 Final results: ${sequenceDiagrams.length} sequence diagrams generated`);
    } else {
      console.warn('⚠️ No procedures found in BRS analysis or procedures is not an array');
    }

    return {
      blockDiagrams,
      sequenceDiagrams,
      errors,
      warnings
    };
  }

  /**
   * Generate diagrams from specification section content
   * Analyzes section text to determine what diagrams would be helpful
   */
  async generateDiagramsFromSection(
    sectionTitle: string,
    sectionContent: string,
    sectionNumber: string
  ): Promise<{
    blockDiagrams: BlockDiagram[];
    sequenceDiagrams: MermaidDiagram[];
    flowDiagrams: MermaidDiagram[];
    suggestions: string;
  }> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    const blockDiagrams: BlockDiagram[] = [];
    const sequenceDiagrams: MermaidDiagram[] = [];
    const flowDiagrams: MermaidDiagram[] = [];

    // First, get AI suggestions for what diagrams are needed
    const suggestionResult = await this.suggestDiagrams(sectionTitle, sectionContent);
    const suggestions = suggestionResult.content;

    // Parse suggestions and generate diagrams
    // Look for architecture descriptions (block diagrams)
    if (sectionTitle.toLowerCase().includes('architecture') ||
        sectionContent.toLowerCase().includes('component') ||
        sectionContent.toLowerCase().includes('interface')) {

      const blockResult = await this.generateBlockDiagram(
        sectionContent,
        `${sectionTitle} - Architecture`,
        `${sectionNumber}-1`
      );

      if (blockResult.diagram) {
        blockDiagrams.push(blockResult.diagram);
      }
    }

    // Look for procedure descriptions (sequence diagrams)
    if (sectionTitle.toLowerCase().includes('procedure') ||
        sectionTitle.toLowerCase().includes('flow') ||
        sectionContent.toLowerCase().includes('message') ||
        sectionContent.toLowerCase().includes('step')) {

      const seqResult = await this.generateSequenceDiagram(
        sectionContent,
        `${sectionTitle} - Message Flow`,
        [],
        `${sectionNumber}-1`
      );

      if (seqResult.diagram) {
        sequenceDiagrams.push(seqResult.diagram);
      }
    }

    // Look for state machine or process descriptions (flow diagrams)
    if (sectionTitle.toLowerCase().includes('state') ||
        sectionContent.toLowerCase().includes('state machine') ||
        sectionContent.toLowerCase().includes('process flow')) {

      const flowResult = await this.generateFlowDiagram(
        sectionContent,
        `${sectionTitle} - Flow`,
        'flowchart',
        `${sectionNumber}-1`
      );

      if (flowResult.diagram) {
        flowDiagrams.push(flowResult.diagram);
      }
    }

    return {
      blockDiagrams,
      sequenceDiagrams,
      flowDiagrams,
      suggestions
    };
  }

  /**
   * Generate full technical specification from BRS
   * 3GPP-compliant structure with section-by-section generation
   */
  async generateFullSpecification(
    brsDocument: {
      title: string;
      markdown: string;
      metadata: {
        customer?: string;
        version?: string;
        projectName?: string;
      };
    },
    specTitle: string,
    context?: AIContext,
    onProgress?: (section: number, total: number, sectionTitle: string) => void,
    userGuidance?: string
  ): Promise<{
    markdown: string;
    sections: Array<{ title: string; content: string }>;
    totalTokens: number;
    totalCost: number;
    brsAnalysis: any;
  }> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    let totalTokens = 0;
    let totalCost = 0;
    const sections: Array<{ title: string; content: string }> = [];

    // Step 1: Analyze BRS to extract structured requirements
    const { buildBRSAnalysisPrompt } = await import('./prompts/documentPrompts');
    const analysisPrompt = buildBRSAnalysisPrompt(brsDocument.markdown, userGuidance);

    // Check if current model is a reasoning model - they need much higher token limits
    const { isReasoningModel } = await import('../../utils/aiModels');
    const currentModel = this.config.model || 'anthropic/claude-3.5-sonnet';
    const isReasoning = isReasoningModel(currentModel);

    // Reasoning models use internal reasoning before generating output
    // Benchmarking showed: ~9k reasoning tokens + ~3.6k output = ~12.6k total
    // Set to 32k to provide ~2.5x headroom for complex BRS documents
    const maxTokens = isReasoning ? 32000 : 4000;

    const generateConfig: any = {
      model: currentModel,
      temperature: 0.3, // Lower temperature for structured extraction
      maxTokens
    };

    // For reasoning models, enable high reasoning effort for best extraction quality
    if (isReasoning) {
      generateConfig.reasoning = { effort: 'high' };
    }

    const analysisResult = await this.provider.generate(
      [{ role: 'user', content: analysisPrompt }],
      generateConfig
    );

    totalTokens += analysisResult.tokens?.total || 0;
    totalCost += analysisResult.cost || 0;

    // Parse BRS analysis from JSON
    let brsAnalysis: any = {};
    try {
      console.log('=== RAW BRS ANALYSIS RESPONSE ===');
      console.log(analysisResult.content);
      console.log('=== END RAW RESPONSE ===');

      const jsonMatch = analysisResult.content.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        brsAnalysis = JSON.parse(jsonMatch[1]);
      } else {
        // Try parsing the whole content as JSON
        brsAnalysis = JSON.parse(analysisResult.content);
      }

      console.log('=== PARSED BRS ANALYSIS ===');
      console.log(JSON.stringify(brsAnalysis, null, 2));
      console.log('=== END PARSED ANALYSIS ===');
    } catch (error) {
      console.warn('Failed to parse BRS analysis JSON, using fallback structure:', error);
      console.error('Parse error details:', error);
      brsAnalysis = {
        components: [],
        interfaces: [],
        requirementCategories: {},
        procedures: [],
        standards: []
      };
    }

    // Import all 3GPP section prompt builders
    const {
      build3GPPScopePrompt,
      buildServiceOverviewPrompt,
      build3GPPFunctionalRequirementsPrompt,
      buildNonFunctionalRequirementsPrompt,
      buildOSSBSSPrompt,
      buildSLASummaryPrompt,
      buildOpenItemsPrompt,
      buildAppendicesPrompt
    } = await import('./prompts/documentPrompts');

    // Step 2: Generate each section sequentially with progress reporting
    const sectionGenerators = [
      {
        title: '1 Scope',
        promptBuilder: () => build3GPPScopePrompt(specTitle, brsAnalysis, brsDocument.metadata, userGuidance)
      },
      {
        title: '2 Service Overview',
        promptBuilder: () => buildServiceOverviewPrompt(specTitle, brsAnalysis, brsDocument.metadata, userGuidance)
      },
      {
        title: '3 Functional Specification',
        promptBuilder: () => build3GPPFunctionalRequirementsPrompt(brsAnalysis, userGuidance)
      },
      {
        title: '4 Solution Architecture and Design',
        promptBuilder: () => {
          // Create unified prompt for combined Architecture + Procedures section
          return `Generate Section 4 (Solution Architecture and Design) for a 3GPP-style technical specification.

This section combines both architecture and procedures into a single comprehensive section.

Architecture Requirements from BRS:
${JSON.stringify(brsAnalysis.requirementCategories?.architecture || [], null, 2)}

Components:
${brsAnalysis.components?.join(', ') || 'Not specified'}

Interfaces:
${JSON.stringify(brsAnalysis.interfaces || [], null, 2)}

Procedures from BRS:
${JSON.stringify(brsAnalysis.procedures || [], null, 2)}

${context?.availableDiagrams && context.availableDiagrams.length > 0
  ? `Available Diagrams:\n${context.availableDiagrams.map(d => `- {{fig:${d.id}}} - ${d.title}`).join('\n')}\n`
  : ''}

Section Structure:
## 4 Solution Architecture and Design

### 4.1 Overview
- High-level architecture description
- Key architectural principles and design decisions
- **Suggest block diagram**: {{fig:architecture-overview}} <!-- TODO: High-level system architecture -->

### 4.2 Functional Elements
For each component (PCRF, PCEF, TDF, P-GW, BNG/BRAS, OCS, OFCS, etc.):
- **4.2.X Component Name**
  - Function and responsibilities
  - Interfaces (Gx, Sd, Gy, Gz, RADIUS, etc.)
  - Standards compliance (3GPP TS references)
  - Deployment considerations

### 4.3 Interfaces and Reference Points
For each interface (Gx, Sd, Gy, Gz, RADIUS):
- Protocol specification
- Message flows
- Parameters and AVPs
- Error handling

### 4.4 Procedures
For each procedure (Session Establishment, Policy Update, Handover, Charging, etc.):

#### 4.4.X Procedure Name
- Overview and trigger conditions
- Step-by-step sequence
- **Suggest sequence diagram**: {{fig:procedure-name-flow}} <!-- TODO: Detailed message flow -->
- Success and failure scenarios
- Timing and performance considerations

Guidelines:
- Combine architecture description with operational procedures
- Use block diagrams for architecture, sequence diagrams for procedures
- Maintain 3GPP terminology and reference standards
- Include both structural (architecture) and behavioral (procedures) aspects
- Use normative language (SHALL/MUST) where appropriate

${userGuidance ? `\nAdditional User Guidance:\n${userGuidance}\n` : ''}

Generate the complete Section 4 now in markdown format.`;
        }
      },
      {
        title: '5 Non-Functional Requirements',
        promptBuilder: () => buildNonFunctionalRequirementsPrompt(brsAnalysis, userGuidance)
      },
      {
        title: '6 OSS/BSS and Service Management',
        promptBuilder: () => buildOSSBSSPrompt(brsAnalysis, userGuidance)
      },
      {
        title: '7 SLA Summary',
        promptBuilder: () => buildSLASummaryPrompt(brsAnalysis, userGuidance)
      },
      {
        title: '8 Open Items',
        promptBuilder: () => buildOpenItemsPrompt(brsAnalysis, userGuidance)
      },
      {
        title: '9 Appendices',
        promptBuilder: () => buildAppendicesPrompt(brsAnalysis, brsDocument.markdown, brsAnalysis.standards || [], userGuidance)
      }
    ];

    for (let i = 0; i < sectionGenerators.length; i++) {
      const { title, promptBuilder } = sectionGenerators[i];

      // Report progress
      if (onProgress) {
        onProgress(i + 1, sectionGenerators.length, title);
      }

      // Generate section
      const sectionPrompt = promptBuilder();

      // For reasoning models (o1, GPT-5), use much higher output token limit
      // Reasoning tokens are separate and unlimited; maxTokens only applies to output
      const isReasoningModel = this.config.model.toLowerCase().includes('o1') ||
                               this.config.model.toLowerCase().includes('gpt-5');
      const sectionMaxTokens = isReasoningModel ? 64000 : (this.config.maxTokens || 8000);

      console.log(`🎯 Generating section with maxTokens: ${sectionMaxTokens} (reasoning model: ${isReasoningModel})`);

      const sectionResult = await this.provider.generate(
        [{ role: 'user', content: sectionPrompt }],
        {
          model: this.config.model,
          temperature: this.config.temperature,
          maxTokens: sectionMaxTokens
        }
      );

      totalTokens += sectionResult.tokens?.total || 0;
      totalCost += sectionResult.cost || 0;

      // Debug logging for section generation
      console.log(`📄 Generated Section ${i + 1}/${sectionGenerators.length}: ${title}`, {
        contentLength: sectionResult.content.length,
        contentLines: sectionResult.content.split('\n').length,
        tokens: sectionResult.tokens?.total || 0,
        cost: sectionResult.cost || 0,
        firstLine: sectionResult.content.split('\n')[0],
        lastLine: sectionResult.content.split('\n').slice(-1)[0],
        finishReason: (sectionResult as any).finishReason || 'unknown',
      });

      console.log(`📝 Section ${i + 1} content preview (first 300 chars):`, sectionResult.content.substring(0, 300));

      // Warn if section was truncated due to token limit
      if ((sectionResult as any).finishReason === 'length' || (sectionResult as any).finishReason === 'max_output_tokens') {
        console.warn(`⚠️ WARNING: Section ${i + 1} "${title}" was TRUNCATED due to token limit!`);
        console.warn(`   Content length: ${sectionResult.content.length} chars, Lines: ${sectionResult.content.split('\n').length}`);
        console.warn(`   This section is INCOMPLETE. Consider increasing maxTokens or using a different model.`);
      }

      // Warn if section is suspiciously short or empty
      if (sectionResult.content.length < 200 && title !== '2 References') {
        console.warn(`⚠️ WARNING: Section ${i + 1} "${title}" is very short or empty (${sectionResult.content.length} chars)!`);
        console.warn(`   This may indicate generation failure. Check finish_reason.`);
      }

      sections.push({
        title,
        content: sectionResult.content
      });
    }

    // Step 3: Combine all sections into final document
    const documentHeader = `# **${brsDocument.metadata.customer || 'Organization Name'}**
## **Project Name:** ${specTitle}
### **Technical Specification (TSD)**

**Version:** ${brsDocument.metadata.version || '1.0'} (Draft)
**Status:** Draft
**Date:** ${new Date().toISOString().split('T')[0]}

---

## Table of Contents

1. [Scope](#1-scope)
2. [Service Overview](#2-service-overview)
   * 2.1 Service Description
   * 2.2 Objectives
   * 2.3 Target Customer
   * 2.4 Architecture Context
3. [Functional Specification](#3-functional-specification)
4. [Solution Architecture and Design](#4-solution-architecture-and-design)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [OSS/BSS and Service Management](#6-ossbss-and-service-management)
   * 6.1 Provisioning & Identity Correlation
   * 6.2 Assurance & Reporting
7. [SLA Summary](#7-sla-summary)
   * 7.1 Measurement & Reporting
   * 7.2 In-Scope Determination Profiles
8. [Open Items](#8-open-items)
9. [Appendices](#9-appendices)
   * 9.1 Abbreviations
   * 9.2 References
   * 9.3 Design Rationale
   * 9.4 Other

---

## Document Control

**Author(s):**

| Name | Role | Organization | Date |
|------|------|--------------|------|
| ${brsDocument.metadata.author || 'TBD'} | Technical Specification Author | ${brsDocument.metadata.customer || 'Organization'} | ${new Date().toISOString().split('T')[0]} |

**Reviewer(s):**

| Name | Role | Organization | Date |
|------|------|--------------|------|
| TBD | Technical Reviewer | ${brsDocument.metadata.customer || 'Organization'} | TBD |

**Approver(s):**

| Name | Role | Organization | Date |
|------|------|--------------|------|
| TBD | Project Manager | ${brsDocument.metadata.customer || 'Organization'} | TBD |

**Revision History:**

| Version | Date | Author | Description of Changes |
|---------|------|--------|------------------------|
| ${brsDocument.metadata.version || '1.0'} | ${new Date().toISOString().split('T')[0]} | ${brsDocument.metadata.author || 'TBD'} | Initial draft |

---

`;

    const combinedMarkdown = documentHeader + sections.map(s => s.content).join('\n\n---\n\n');

    // Debug logging for final document
    console.log('📚 Final Document Assembly:', {
      totalSections: sections.length,
      sectionTitles: sections.map(s => s.title),
      documentLength: combinedMarkdown.length,
      documentLines: combinedMarkdown.split('\n').length,
      totalTokens,
      totalCost,
    });

    // Log each section's position in final document
    sections.forEach((section, idx) => {
      const sectionStart = combinedMarkdown.indexOf(section.content);
      console.log(`  Section ${idx + 1} "${section.title}": starts at char ${sectionStart}, length ${section.content.length}`);
    });

    // Check if Section 7 is present in final markdown
    const section7Present = combinedMarkdown.includes('## 7 Information Elements') ||
                           combinedMarkdown.includes('##7 Information Elements') ||
                           combinedMarkdown.includes('# 7 Information Elements');
    console.log('🔍 Section 7 present in final markdown?', section7Present);

    if (!section7Present && sections.length === 8) {
      console.warn('⚠️ WARNING: Section 7 was generated but not found in final markdown!');
      console.log('Section 7 content:', sections[6]?.content?.substring(0, 500));
    }

    return {
      markdown: combinedMarkdown,
      sections,
      totalTokens,
      totalCost,
      brsAnalysis
    };
  }

  /**
   * Generate specification from template configuration
   *
   * New template-based generation method that supports:
   * - Customizable section selection and ordering
   * - Multi-format templates (3GPP, IEEE 830, ISO 29148, etc.)
   * - User guidance per template
   * - Sequential generation with context from previous sections
   * - Multimodal PDF reference documents (for vision-capable models)
   *
   * @param brsDocument - Business requirements specification
   * @param specTitle - Technical specification title
   * @param template - Template definition (sections, format guidance, etc.)
   * @param config - Template configuration (enabled sections, order, custom guidance)
   * @param context - Additional AI context (diagrams, references, etc.)
   * @param onProgress - Progress callback
   * @param pdfReferences - Optional PDF reference documents for multimodal generation
   * @returns Generated specification with sections, tokens, cost, and BRS analysis
   */
  async generateSpecificationFromTemplate(
    brsDocument: {
      title: string;
      markdown: string;
      metadata: {
        customer?: string;
        version?: string;
        projectName?: string;
      };
    },
    specTitle: string,
    template: import('../../types').SpecificationTemplate,
    config: import('../../types').ProjectTemplateConfig,
    context?: AIContext,
    onProgress?: (section: number, total: number, sectionTitle: string) => void,
    pdfReferences?: ReferenceDocumentContent[]
  ): Promise<{
    markdown: string;
    sections: Array<{ title: string; content: string }>;
    totalTokens: number;
    totalCost: number;
    brsAnalysis: any;
  }> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    let totalTokens = 0;
    let totalCost = 0;
    const sections: Array<{ title: string; content: string }> = [];

    // Step 1: Analyze BRS to extract structured requirements
    const { buildBRSAnalysisPrompt } = await import('./prompts/documentPrompts');
    const analysisPrompt = buildBRSAnalysisPrompt(brsDocument.markdown, config.customGuidance);

    const { isReasoningModel } = await import('../../utils/aiModels');
    const currentModel = this.config.model || 'anthropic/claude-3.5-sonnet';
    const isReasoning = isReasoningModel(currentModel);
    const analysisMaxTokens = isReasoning ? 32000 : 4000;

    const analysisConfig: any = {
      model: currentModel,
      temperature: 0.3,
      maxTokens: analysisMaxTokens
    };

    if (isReasoning) {
      analysisConfig.reasoning = { effort: 'high' };
    }

    // Check if we should use multimodal generation (vision model + PDF references)
    const useMultimodal = pdfReferences && pdfReferences.length > 0 && this.isVisionModel();
    const pdfsWithData = pdfReferences?.filter(ref => ref.base64Data) || [];

    console.log(`🔍 Analyzing BRS document (${brsDocument.markdown.length} chars)...`);
    if (useMultimodal && pdfsWithData.length > 0) {
      console.log(`📄 Including ${pdfsWithData.length} PDF reference(s) via multimodal...`);
    }

    let analysisResult;

    if (useMultimodal && pdfsWithData.length > 0) {
      // Use multimodal generation with PDF attachments
      const { OpenRouterProvider } = await import('./providers/OpenRouterProvider');
      const pdfData = pdfsWithData.map(ref => ({
        filename: ref.filename || `${ref.title}.pdf`,
        base64Data: ref.base64Data!
      }));

      const multimodalContent = OpenRouterProvider.createMultiplePDFContent(
        analysisPrompt + '\n\nPlease also consider the attached reference documents when analyzing the requirements.',
        pdfData
      );

      const multimodalMessages: AIMessageMultimodal[] = [
        { role: 'user', content: multimodalContent }
      ];

      analysisResult = await this.provider.generateMultimodal(multimodalMessages, analysisConfig);
    } else {
      // Standard text-only generation
      analysisResult = await this.provider.generate(
        [{ role: 'user', content: analysisPrompt }],
        analysisConfig
      );
    }

    totalTokens += analysisResult.tokens?.total || 0;
    totalCost += analysisResult.cost || 0;

    console.log('✅ BRS Analysis complete:', {
      tokens: analysisResult.tokens?.total || 0,
      cost: analysisResult.cost || 0,
      contentLength: analysisResult.content.length,
      multimodal: useMultimodal && pdfsWithData.length > 0
    });

    let brsAnalysis: any = {};
    try {
      brsAnalysis = JSON.parse(analysisResult.content);
    } catch (e) {
      console.warn('Failed to parse BRS analysis JSON, using raw response');
      brsAnalysis = { rawAnalysis: analysisResult.content };
    }

    // Step 2: Get enabled sections in configured order with dynamic numbering
    const enabledSectionIds = config.enabledSections;
    const orderedSectionIds = config.sectionOrder.filter(id => enabledSectionIds.includes(id));

    // Get template sections (prefer suggestedSections for flexible format)
    const { getFlexibleSections } = await import('../../data/templates');
    const templateFlexibleSections = getFlexibleSections(template);

    // Merge with custom sections from config
    const customSections = config.customSections || [];
    const allFlexibleSections: import('../../types').FlexibleSection[] = [
      ...templateFlexibleSections,
      ...customSections.map((cs, idx) => ({
        id: cs.id,
        title: cs.title,
        description: cs.description,
        isRequired: false,
        order: templateFlexibleSections.length + idx + 1,
        // Custom sections don't have these by default
        suggestedSubsections: undefined,
        contentGuidance: undefined,
      })),
    ];

    // Apply section overrides and calculate dynamic numbering
    const sectionOverrides = config.sectionOverrides || {};
    const enabledSections = orderedSectionIds
      .map((id, index) => {
        const section = allFlexibleSections.find(s => s.id === id);
        if (!section) return null;

        const override = sectionOverrides[id];
        // Dynamic section number based on position in enabled list
        const dynamicNumber = index + 1;

        return {
          // FlexibleSection fields with overrides applied
          id: section.id,
          title: override?.customTitle || section.title,
          description: override?.customDescription || section.description,
          isRequired: section.isRequired,
          suggestedSubsections: section.suggestedSubsections,
          contentGuidance: section.contentGuidance,
          // Dynamic number based on position
          number: String(dynamicNumber),
          order: dynamicNumber,
          // For backward compatibility with legacy prompt builders
          promptKey: template.sections.find(s => s.id === id)?.promptKey || 'buildFlexibleSectionPrompt',
          required: section.isRequired,
          allowSubsections: template.sections.find(s => s.id === id)?.allowSubsections ?? true,
          defaultEnabled: true,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    console.log(`📋 Generating ${enabledSections.length} sections from template: ${template.name} (dynamic numbering enabled)`);

    // Step 3: Import template prompt system
    const { buildSectionPrompt } = await import('./prompts/templatePrompts');

    // Step 4: Generate each section sequentially with progress reporting
    for (let i = 0; i < enabledSections.length; i++) {
      const section = enabledSections[i];
      const sectionTitle = `${section.number} ${section.title}`;

      // Report progress
      if (onProgress) {
        onProgress(i + 1, enabledSections.length, sectionTitle);
      }

      // Build context with all previous sections
      const promptContext: any = {
        specTitle,
        brsDocument,
        brsAnalysis,
        previousSections: sections.map(s => ({ title: s.title, content: s.content })),
        template: {
          name: template.name,
          formatGuidance: template.formatGuidance
        },
        userGuidance: config.customGuidance,
        availableDiagrams: context?.availableDiagrams,
        markdownGuidance: context?.markdownGuidance
      };

      // Generate section prompt
      const sectionPrompt = buildSectionPrompt(section, promptContext);

      // Configure token limits based on model type
      // Reasoning models: 64k for large sections (Architecture, Procedures, etc.)
      // Non-reasoning models: Use configured maxTokens or 8k default
      const sectionMaxTokens = isReasoning ? 64000 : (this.config.maxTokens || 8000);

      console.log(`🎯 Generating section ${i + 1}/${enabledSections.length}: ${sectionTitle} (maxTokens: ${sectionMaxTokens})`);

      const sectionConfig: any = {
        model: currentModel,
        temperature: this.config.temperature,
        maxTokens: sectionMaxTokens
      };

      if (isReasoning) {
        sectionConfig.reasoning = { effort: 'high' };
      }

      let sectionResult;

      // Use multimodal generation for sections if we have PDF references
      // Only attach PDFs for key sections that benefit from reference context
      // (Architecture, Functional Requirements, Procedures, etc.)
      const sectionsBenefitingFromPDFs = ['architecture', 'functional', 'procedures', 'design', 'requirements', 'interface'];
      const shouldIncludePDFs = useMultimodal && pdfsWithData.length > 0 &&
        sectionsBenefitingFromPDFs.some(keyword =>
          section.title.toLowerCase().includes(keyword) ||
          section.id.toLowerCase().includes(keyword)
        );

      if (shouldIncludePDFs) {
        console.log(`📄 Including PDF references for section: ${sectionTitle}`);

        const { OpenRouterProvider } = await import('./providers/OpenRouterProvider');
        const pdfData = pdfsWithData.map(ref => ({
          filename: ref.filename || `${ref.title}.pdf`,
          base64Data: ref.base64Data!
        }));

        const multimodalContent = OpenRouterProvider.createMultiplePDFContent(
          sectionPrompt + '\n\nReference documents are attached for additional context. Use relevant information from these references where appropriate.',
          pdfData
        );

        const multimodalMessages: AIMessageMultimodal[] = [
          { role: 'user', content: multimodalContent }
        ];

        sectionResult = await this.provider.generateMultimodal(multimodalMessages, sectionConfig);
      } else {
        // Standard text-only generation
        sectionResult = await this.provider.generate(
          [{ role: 'user', content: sectionPrompt }],
          sectionConfig
        );
      }

      totalTokens += sectionResult.tokens?.total || 0;
      totalCost += sectionResult.cost || 0;

      console.log(`📄 Generated section ${i + 1}/${enabledSections.length}:`, {
        title: sectionTitle,
        contentLength: sectionResult.content.length,
        tokens: sectionResult.tokens?.total || 0,
        cost: sectionResult.cost || 0,
        multimodal: shouldIncludePDFs
      });

      // Warn if truncated
      if ((sectionResult as any).finishReason === 'length' || (sectionResult as any).finishReason === 'max_output_tokens') {
        console.warn(`⚠️ WARNING: Section "${sectionTitle}" was TRUNCATED due to token limit!`);
      }

      sections.push({
        title: sectionTitle,
        content: sectionResult.content
      });
    }

    // Step 5: Combine all sections into final document
    const documentHeader = `# **${brsDocument.metadata.customer || 'Organization Name'}**
## **Project Name:** ${specTitle}
### **${template.name}**

**Version:** ${brsDocument.metadata.version || '1.0'} (Draft)
**Status:** Draft
**Date:** ${new Date().toISOString().split('T')[0]}

---

## Table of Contents

${enabledSections.map((s, i) => {
  const indent = s.number.includes('.') ? '   * ' : `${i + 1}. `;
  return `${indent}[${s.title}](#${s.number.replace(/\./g, '')}-${s.title.toLowerCase().replace(/\s+/g, '-')})`;
}).join('\n')}

---

`;

    const fullMarkdown = documentHeader + sections.map(s => s.content).join('\n\n---\n\n');

    console.log('✅ Full specification generation complete:', {
      totalSections: sections.length,
      totalTokens,
      totalCost: `$${totalCost.toFixed(4)}`,
      totalLength: fullMarkdown.length
    });

    return {
      markdown: fullMarkdown,
      sections,
      totalTokens,
      totalCost,
      brsAnalysis
    };
  }

  /**
   * ========== CASCADED REFINEMENT METHODS ==========
   */

  /**
   * Analyze the impact of a section refinement on other sections
   * Returns list of affected sections with impact analysis
   */
  async analyzeRefinementImpact(
    originalSection: string,
    refinedSection: string,
    sectionTitle: string,
    fullDocument: string,
    instruction: string
  ): Promise<import('../../types').ImpactAnalysis> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    const { buildImpactAnalysisPrompt } = await import('./prompts/refinementPrompts');

    const prompt = buildImpactAnalysisPrompt(
      originalSection,
      refinedSection,
      sectionTitle,
      fullDocument,
      instruction
    );

    const messages = [
      { role: 'system', content: 'You are an expert technical writer analyzing document changes.' },
      { role: 'user', content: prompt }
    ];

    const result = await this.provider.generate(messages, {
      model: this.config.model,
      temperature: 0.2, // Low temperature for analytical task
      maxTokens: 16000 // High limit for reasoning models (GPT-5, o1) which use tokens for reasoning + output
    });

    try {
      const analysis = JSON.parse(result.content);
      console.log('📊 Impact Analysis Result:', analysis);
      return analysis;
    } catch (error) {
      console.error('Failed to parse impact analysis:', result.content);
      throw new Error('Failed to parse impact analysis JSON');
    }
  }

  /**
   * Generate propagated changes for affected sections
   * Returns array of proposed changes for each affected section
   */
  async generatePropagatedChanges(
    impactAnalysis: import('../../types').ImpactAnalysis,
    fullDocument: string,
    primaryChange: {
      sectionTitle: string;
      originalContent: string;
      refinedContent: string;
      instruction: string;
    },
    onProgress?: (current: number, total: number, sectionTitle: string) => void
  ): Promise<import('../../types').PropagatedChange[]> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    const { buildPropagationPrompt, extractSection } = await import('./prompts/refinementPrompts');

    const propagatedChanges: import('../../types').PropagatedChange[] = [];
    const affectedSections = impactAnalysis.affectedSections.filter(
      s => s.impactType !== 'NONE'
    );

    for (let i = 0; i < affectedSections.length; i++) {
      const affectedSection = affectedSections[i];

      if (onProgress) {
        onProgress(i + 1, affectedSections.length, affectedSection.sectionTitle);
      }

      console.log(`🔄 Generating propagated change ${i + 1}/${affectedSections.length}: ${affectedSection.sectionTitle}`);

      // Extract the section content from full document
      const sectionContent = extractSection(
        fullDocument,
        affectedSection.sectionId,
        affectedSection.sectionTitle
      );

      if (!sectionContent) {
        console.warn(`⚠️ Could not find section: ${affectedSection.sectionId} ${affectedSection.sectionTitle}`);
        continue;
      }

      const primaryChangeContext = `
Original: ${primaryChange.sectionTitle}
Instruction: "${primaryChange.instruction}"
Change: Modified from ${primaryChange.originalContent.length} to ${primaryChange.refinedContent.length} characters
`;

      const prompt = buildPropagationPrompt(
        affectedSection,
        sectionContent,
        primaryChangeContext,
        fullDocument
      );

      const messages = [
        { role: 'system', content: 'You are an expert technical writer generating consistent document updates.' },
        { role: 'user', content: prompt }
      ];

      try {
        const result = await this.provider.generate(messages, {
          model: this.config.model,
          temperature: 0.3,
          maxTokens: 4000
        });

        // Handle REMOVE action (JSON response)
        if (affectedSection.impactType === 'REMOVE') {
          try {
            const removeResult = JSON.parse(result.content);
            propagatedChanges.push({
              sectionId: affectedSection.sectionId,
              sectionTitle: affectedSection.sectionTitle,
              actionType: 'REMOVE_SECTION',
              originalContent: sectionContent,
              proposedContent: '', // Empty for removal
              reasoning: removeResult.reasoning,
              impactLevel: affectedSection.impactLevel,
              confidence: removeResult.confidence || 0.9,
              isSelected: true, // Default to selected
            });
          } catch (error) {
            console.error(`Failed to parse REMOVE response for ${affectedSection.sectionTitle}:`, result.content);
          }
        } else {
          // MODIFY action (markdown response)

          // Validate that AI response includes section heading
          // Extract original heading from section content (first line)
          const originalHeading = sectionContent.split('\n')[0];
          let proposedContent = result.content.trim();

          // Strip markdown code fences if AI wrapped the response
          // This happens because the prompt shows content in code fences and AI mimics the pattern
          const codeFenceMatch = proposedContent.match(/^```(?:markdown)?\s*\n?([\s\S]*?)\n?```\s*$/);
          if (codeFenceMatch) {
            console.log(`🔧 Stripping markdown code fences from AI response for section ${affectedSection.sectionId}`);
            proposedContent = codeFenceMatch[1].trim();
          }

          // Strip trailing horizontal rules that AI might add as separators
          proposedContent = proposedContent.replace(/\n---+\s*$/, '').trim();

          // Check if AI response starts with a heading marker (#, ##, ###, ####)
          const hasHeading = /^#{1,4}\s+\d+/.test(proposedContent);

          if (!hasHeading) {
            // AI omitted the heading - restore it to prevent section lookup failures
            console.warn(
              `⚠️ AI omitted heading for section ${affectedSection.sectionId}: ${affectedSection.sectionTitle}. ` +
              `Restoring original heading: "${originalHeading}"`
            );
            proposedContent = originalHeading + '\n\n' + proposedContent;
          }

          // Validate that AI kept the correct section number
          // Extract the section number from the first line of the response
          const responseHeadingMatch = proposedContent.match(/^#{1,4}\s+(\d+(?:\.\d+)*)/);
          if (responseHeadingMatch) {
            const responseSecNum = responseHeadingMatch[1];
            if (responseSecNum !== affectedSection.sectionId) {
              console.warn(
                `⚠️ AI changed section number from ${affectedSection.sectionId} to ${responseSecNum}. ` +
                `Correcting to original number.`
              );
              // Replace the wrong section number with the correct one
              proposedContent = proposedContent.replace(
                /^(#{1,4}\s+)\d+(?:\.\d+)*/,
                `$1${affectedSection.sectionId}`
              );
            }
          }

          // Warn if AI added additional section headings within the content (excluding first line)
          const contentAfterHeading = proposedContent.split('\n').slice(1).join('\n');
          const additionalHeadings = contentAfterHeading.match(/^#{1,4}\s+\d+(?:\.\d+)*\s+/gm);
          if (additionalHeadings && additionalHeadings.length > 0) {
            console.warn(
              `⚠️ AI added ${additionalHeadings.length} additional section heading(s) within section ${affectedSection.sectionId}. ` +
              `This may cause section ordering issues. Headings found: ${additionalHeadings.map(h => h.trim()).join(', ')}`
            );
          }

          propagatedChanges.push({
            sectionId: affectedSection.sectionId,
            sectionTitle: affectedSection.sectionTitle,
            actionType: 'MODIFY_SECTION',
            originalContent: sectionContent,
            proposedContent: proposedContent,
            reasoning: affectedSection.reasoning,
            impactLevel: affectedSection.impactLevel,
            confidence: 0.85,
            isSelected: true, // Default to selected
          });
        }
      } catch (error) {
        console.error(`Error generating propagated change for ${affectedSection.sectionTitle}:`, error);
      }
    }

    console.log(`✅ Generated ${propagatedChanges.length} propagated changes`);
    return propagatedChanges;
  }

  /**
   * Validate consistency across all cascaded changes
   * Checks for contradictions, orphaned references, and terminology mismatches
   */
  async validateCascadedChanges(
    primaryChange: {
      sectionTitle: string;
      originalContent: string;
      refinedContent: string;
    },
    propagatedChanges: import('../../types').PropagatedChange[],
    fullDocument: string
  ): Promise<import('../../types').ValidationResult> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    const { buildConsistencyValidationPrompt } = await import('./prompts/refinementPrompts');

    const prompt = buildConsistencyValidationPrompt(
      primaryChange,
      propagatedChanges,
      fullDocument
    );

    const messages = [
      { role: 'system', content: 'You are an expert technical editor validating document consistency.' },
      { role: 'user', content: prompt }
    ];

    try {
      const result = await this.provider.generate(messages, {
        model: this.config.model,
        temperature: 0.1, // Very low temperature for validation
        maxTokens: 8000 // Increased for reasoning models and comprehensive validation reports
      });

      const validation = JSON.parse(result.content);
      console.log('🔍 Validation Result:', validation);
      return validation;
    } catch (error) {
      console.error('Failed to parse validation result:', error);
      // Return safe default
      return {
        isConsistent: true,
        issues: [],
        warnings: ['Validation check failed - please review changes manually']
      };
    }
  }

  /**
   * Complete cascaded refinement workflow
   * Performs impact analysis, generates propagated changes, and validates consistency
   */
  async performCascadedRefinement(
    originalSection: string,
    refinedSection: string,
    sectionTitle: string,
    fullDocument: string,
    instruction: string,
    onProgress?: (stage: string, current: number, total: number, detail?: string) => void
  ): Promise<{
    impactAnalysis: import('../../types').ImpactAnalysis;
    propagatedChanges: import('../../types').PropagatedChange[];
    validation: import('../../types').ValidationResult;
    totalTokens: number;
    totalCost: number;
  }> {
    console.log('🔄 Starting cascaded refinement workflow...');
    let totalTokens = 0;
    let totalCost = 0;

    // Step 1: Analyze Impact
    if (onProgress) onProgress('impact-analysis', 1, 4, 'Analyzing document impact...');
    const impactAnalysis = await this.analyzeRefinementImpact(
      originalSection,
      refinedSection,
      sectionTitle,
      fullDocument,
      instruction
    );

    // Step 1.5: Validate and correct section titles
    // Impact analysis sees truncated document (15k chars), so AI may infer wrong section titles
    // We validate against actual document and correct any mismatches to prevent wrong heading restoration
    console.log('🔍 Validating section titles from impact analysis...');
    const { parseMarkdownSections } = await import('./prompts/refinementPrompts');
    const actualSections = parseMarkdownSections(fullDocument);

    let correctionCount = 0;
    impactAnalysis.affectedSections.forEach(affected => {
      const actualSection = actualSections.find(s => s.id === affected.sectionId);
      if (actualSection) {
        if (actualSection.title !== affected.sectionTitle) {
          console.warn(
            `⚠️ Correcting section ${affected.sectionId} title:\n` +
            `   AI inferred: "${affected.sectionTitle}"\n` +
            `   Actual title: "${actualSection.title}"`
          );
          affected.sectionTitle = actualSection.title;
          correctionCount++;
        }
      } else {
        console.warn(`⚠️ Section ${affected.sectionId} not found in document (AI may have inferred from truncated context)`);
      }
    });

    if (correctionCount > 0) {
      console.log(`✅ Corrected ${correctionCount} section title(s) to match actual document`);
    } else {
      console.log('✅ All section titles validated successfully');
    }

    // Step 2: Generate Propagated Changes
    if (onProgress) onProgress('propagation', 2, 4, 'Generating propagated changes...');
    const propagatedChanges = await this.generatePropagatedChanges(
      impactAnalysis,
      fullDocument,
      {
        sectionTitle,
        originalContent: originalSection,
        refinedContent: refinedSection,
        instruction
      },
      (current, total, sectionTitle) => {
        if (onProgress) {
          onProgress('propagation', 2, 4, `${current}/${total}: ${sectionTitle}`);
        }
      }
    );

    // Step 3: Validate Consistency
    if (onProgress) onProgress('validation', 3, 4, 'Validating consistency...');
    const validation = await this.validateCascadedChanges(
      {
        sectionTitle,
        originalContent: originalSection,
        refinedContent: refinedSection
      },
      propagatedChanges,
      fullDocument
    );

    // Step 4: Complete
    if (onProgress) onProgress('complete', 4, 4, 'Cascaded refinement complete');

    console.log('✅ Cascaded refinement workflow complete');
    return {
      impactAnalysis,
      propagatedChanges,
      validation,
      totalTokens,
      totalCost
    };
  }

  // ========== Structure Discovery Methods ==========

  /**
   * Analyze BRS content and propose document structure
   * This is the main entry point for the AI-assisted structure discovery workflow
   */
  async analyzeAndProposeStructure(params: {
    brsContent: string;
    referenceDocuments?: ReferenceDocument[];
    userGuidance: string;
    technicalGuidance?: string;
  }): Promise<StructureProposalResult> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    console.log('🔍 Analyzing BRS and proposing document structure...');

    const systemPrompt = buildStructureProposalSystemPrompt();
    const userPrompt = buildStructureProposalPrompt(params);

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    try {
      // Use higher maxTokens for structure proposal - the JSON response can be large
      // Minimum 8000 tokens to avoid truncation
      const structureMaxTokens = Math.max(8000, this.config.maxTokens);

      const result = await this.provider.generate(messages, {
        model: this.config.model,
        temperature: 0.3, // Lower temperature for more structured output
        maxTokens: structureMaxTokens
      });

      // Check for truncation (response cut off due to max tokens)
      const wasTruncated = result.finishReason === 'length' ||
                           result.finishReason === 'max_tokens' ||
                           (result as { nativeFinishReason?: string }).nativeFinishReason === 'max_output_tokens';

      if (wasTruncated) {
        console.warn('⚠️ Structure proposal response was truncated due to token limit');
      }

      // Log response details for debugging
      console.log('📊 Structure proposal response:', {
        finishReason: result.finishReason,
        nativeFinishReason: (result as { nativeFinishReason?: string }).nativeFinishReason,
        contentLength: result.content?.length,
        contentPreview: result.content?.slice(0, 300),
        wasTruncated
      });

      // Parse the response
      const parsed = parseStructureProposalResponse(result.content);

      if (!parsed) {
        console.error('Failed to parse structure proposal response, using defaults');
        if (wasTruncated) {
          console.error('This is likely due to the response being truncated. Try a model with higher output limits.');
        }
        // Return default structure as fallback
        const defaultSections = generateDefaultStructure('general');
        const now = new Date();

        return {
          proposedStructure: {
            id: `structure-${Date.now()}`,
            sections: defaultSections,
            domainConfig: {
              domain: 'general',
              normativeLanguage: 'RFC2119',
            },
            formatGuidance: 'Use standard markdown formatting.',
            rationale: 'Default structure provided due to parsing error.',
            version: 1,
            createdAt: now,
            lastModifiedAt: now,
          },
          domainInference: {
            domain: 'general',
            industry: 'unspecified',
            confidence: 0.5,
            reasoning: 'Unable to infer domain from BRS content.',
            detectedStandards: [],
            suggestedTerminology: {},
          },
          tokensUsed: result.tokens?.total || 0,
          cost: result.cost || 0,
        };
      }

      const now = new Date();

      console.log('✅ Structure proposal complete:', {
        sectionCount: parsed.proposedStructure.sections.length,
        domain: parsed.domainInference.domain,
        confidence: parsed.domainInference.confidence,
      });

      return {
        proposedStructure: {
          ...parsed.proposedStructure,
          id: `structure-${Date.now()}`,
          version: 1,
          createdAt: now,
          lastModifiedAt: now,
        },
        domainInference: parsed.domainInference,
        tokensUsed: result.tokens?.total || 0,
        cost: result.cost || 0,
      };
    } catch (error) {
      console.error('Structure proposal failed:', error);
      throw error;
    }
  }

  /**
   * Process a chat message to refine the proposed structure
   * Returns updated structure and conversational response
   */
  async processStructureRefinement(params: {
    currentStructure: ProposedStructure;
    chatHistory: AIMessage[];
    userMessage: string;
  }): Promise<StructureRefinementResult> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    console.log('💬 Processing structure refinement request...');

    const systemPrompt = buildStructureRefinementSystemPrompt();
    const userPrompt = buildStructureRefinementPrompt(params);

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    try {
      const result = await this.provider.generate(messages, {
        model: this.config.model,
        temperature: 0.5, // Moderate temperature for conversational + structured output
        maxTokens: this.config.maxTokens
      });

      // Parse the response
      const parsed = parseStructureRefinementResponse(result.content);

      // Apply changes to structure if any
      let updatedStructure: ProposedStructure | null = null;
      const structureChanges: StructureChange[] = [];

      if (parsed.structureChanges.length > 0) {
        // Create a new version of the structure with applied changes
        const newSections = [...params.currentStructure.sections];

        for (const change of parsed.structureChanges) {
          structureChanges.push({
            type: change.type,
            sectionId: change.sectionId,
            previousState: newSections.find(s => s.id === change.sectionId),
            newState: change.updates,
            reason: change.reason,
          });

          switch (change.type) {
            case 'add':
              if (change.updates) {
                newSections.push({
                  id: change.sectionId,
                  title: change.updates.title || 'New Section',
                  description: change.updates.description || '',
                  rationale: change.updates.rationale || change.reason,
                  order: newSections.length + 1,
                  confidence: change.updates.confidence || 0.8,
                  ...change.updates,
                });
              }
              break;

            case 'remove':
              const removeIdx = newSections.findIndex(s => s.id === change.sectionId);
              if (removeIdx >= 0) {
                newSections.splice(removeIdx, 1);
              }
              break;

            case 'modify':
              const modifyIdx = newSections.findIndex(s => s.id === change.sectionId);
              if (modifyIdx >= 0 && change.updates) {
                newSections[modifyIdx] = {
                  ...newSections[modifyIdx],
                  ...change.updates,
                };
              }
              break;

            case 'reorder':
              // Use updatedSections from response if provided for full reorder
              if (parsed.updatedSections) {
                newSections.length = 0;
                newSections.push(...parsed.updatedSections);
              }
              break;
          }
        }

        // Renumber sections after changes
        newSections.forEach((section, idx) => {
          section.order = idx + 1;
        });

        updatedStructure = {
          ...params.currentStructure,
          sections: newSections,
          version: params.currentStructure.version + 1,
          lastModifiedAt: new Date(),
        };

        console.log('✅ Structure updated:', {
          changes: structureChanges.length,
          newSectionCount: newSections.length,
        });
      }

      return {
        updatedStructure,
        response: parsed.conversationalResponse,
        structureChanges,
        tokensUsed: result.tokens?.total || 0,
        cost: result.cost || 0,
      };
    } catch (error) {
      console.error('Structure refinement failed:', error);
      throw error;
    }
  }

  /**
   * Generate specification from an approved structure
   * This converts the ProposedStructure into actual document content
   */
  async generateFromApprovedStructure(params: {
    structure: ProposedStructure;
    brsContent: string;
    referenceDocuments?: ReferenceDocumentContent[];
    generationGuidance?: string;
    onProgress?: (current: number, total: number, sectionTitle: string, status?: 'generating' | 'truncated' | 'retrying' | 'complete' | 'failed') => void;
    autoRetryTruncated?: boolean; // If true, automatically retry truncated sections with continuation
    maxRetries?: number; // Max retries per section (default 1)
  }): Promise<{
    markdown: string;
    sections: Array<{ title: string; content: string; tokensUsed: number; wasTruncated: boolean }>;
    totalTokens: number;
    totalCost: number;
    truncatedSections: string[]; // List of section titles that were truncated
    warnings: string[]; // Warnings to display to user
  }> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    const {
      structure,
      brsContent,
      referenceDocuments: _referenceDocuments,
      generationGuidance,
      onProgress,
      autoRetryTruncated = true,
      maxRetries = 1
    } = params;
    const sections = structure.sections.sort((a, b) => a.order - b.order);

    // Combine format guidance with user's generation guidance
    const combinedGuidance = [
      structure.formatGuidance,
      generationGuidance ? `\n\nAdditional User Guidance:\n${generationGuidance}` : '',
    ].filter(Boolean).join('');

    console.log(`📝 Generating specification from ${sections.length} sections...`);
    if (generationGuidance) {
      console.log(`📋 Using generation guidance: ${generationGuidance.slice(0, 100)}...`);
    }

    // Determine maxTokens based on model type
    const isReasoningModel = this.config.model.toLowerCase().includes('o1') ||
                             this.config.model.toLowerCase().includes('gpt-5');
    const sectionMaxTokens = isReasoningModel ? 64000 : (this.config.maxTokens || 8000);
    console.log(`🎯 Using maxTokens: ${sectionMaxTokens} (reasoning model: ${isReasoningModel})`);

    const generatedSections: Array<{ title: string; content: string; tokensUsed: number; wasTruncated: boolean }> = [];
    const truncatedSections: string[] = [];
    const warnings: string[] = [];
    let totalTokens = 0;
    let totalCost = 0;
    let previousContent = '';

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      onProgress?.(i + 1, sections.length, section.title, 'generating');

      // Import the flexible section prompt builder
      const { buildFlexibleSectionPrompt } = await import('./prompts/sectionPrompts');

      const prompt = buildFlexibleSectionPrompt(
        {
          id: section.id,
          title: section.title,
          description: section.description,
          isRequired: true,
          suggestedSubsections: section.suggestedSubsections,
          contentGuidance: section.contentGuidance,
          includeDiagrams: section.includeDiagrams,
          order: section.order,
        },
        {
          brsContent: brsContent.slice(0, 8000), // Truncate BRS for context
          previousSections: previousContent.slice(-4000), // Last 4k chars for continuity
          domainConfig: structure.domainConfig,
          userGuidance: combinedGuidance,
          sectionNumber: String(section.order),
          includeDiagrams: section.includeDiagrams, // Pass through diagram preference
        }
      );

      try {
        let result = await this.provider.generate(
          [
            { role: 'system', content: 'You are a technical specification writer. Generate only the requested section content in markdown format.' },
            { role: 'user', content: prompt }
          ],
          {
            model: this.config.model,
            temperature: this.config.temperature,
            maxTokens: sectionMaxTokens,
          }
        );

        // Check for truncation
        let wasTruncated = result.finishReason === 'length' ||
                           result.finishReason === 'max_tokens' ||
                           (result as { nativeFinishReason?: string }).nativeFinishReason === 'max_output_tokens';

        let finalContent = result.content;
        let retryCount = 0;

        // Auto-retry truncated sections with continuation
        while (wasTruncated && autoRetryTruncated && retryCount < maxRetries) {
          retryCount++;
          console.warn(`⚠️ Section "${section.title}" was truncated. Attempting continuation (retry ${retryCount}/${maxRetries})...`);
          onProgress?.(i + 1, sections.length, section.title, 'retrying');

          // Request continuation
          const continuationPrompt = `Continue the section from where you left off. The previous content ended with:

---
${finalContent.slice(-1500)}
---

Continue writing from this point. Do NOT repeat any content already written. Start immediately with the next part.`;

          const continuationResult = await this.provider.generate(
            [
              { role: 'system', content: 'You are a technical specification writer. Continue the section exactly from where it was cut off. Do not repeat any content.' },
              { role: 'user', content: continuationPrompt }
            ],
            {
              model: this.config.model,
              temperature: this.config.temperature,
              maxTokens: sectionMaxTokens,
            }
          );

          // Append continuation to original content
          finalContent = finalContent + '\n\n' + continuationResult.content;
          totalTokens += continuationResult.tokens?.total || 0;
          totalCost += continuationResult.cost || 0;

          // Check if continuation was also truncated
          wasTruncated = continuationResult.finishReason === 'length' ||
                         continuationResult.finishReason === 'max_tokens' ||
                         (continuationResult as { nativeFinishReason?: string }).nativeFinishReason === 'max_output_tokens';

          if (!wasTruncated) {
            console.log(`  ✓ Continuation successful for "${section.title}"`);
          }
        }

        // Track truncation even after retries
        if (wasTruncated) {
          truncatedSections.push(section.title);
          warnings.push(`Section "${section.title}" was truncated even after ${retryCount} retry attempt(s). Content may be incomplete.`);
          onProgress?.(i + 1, sections.length, section.title, 'truncated');
          console.warn(`⚠️ WARNING: Section "${section.title}" remains truncated after ${retryCount} retries.`);
        } else {
          onProgress?.(i + 1, sections.length, section.title, 'complete');
        }

        generatedSections.push({
          title: section.title,
          content: finalContent,
          tokensUsed: result.tokens?.total || 0,
          wasTruncated,
        });

        previousContent += '\n\n' + finalContent;
        totalTokens += result.tokens?.total || 0;
        totalCost += result.cost || 0;

        console.log(`  ✓ Generated section ${i + 1}/${sections.length}: ${section.title}${wasTruncated ? ' (TRUNCATED)' : ''}`);
      } catch (error) {
        console.error(`Failed to generate section "${section.title}":`, error);
        onProgress?.(i + 1, sections.length, section.title, 'failed');
        warnings.push(`Section "${section.title}" failed to generate: ${error instanceof Error ? error.message : 'Unknown error'}`);

        // Add placeholder for failed section
        generatedSections.push({
          title: section.title,
          content: `## ${section.order}. ${section.title}\n\n*[Section generation failed. Please regenerate or edit manually.]*\n`,
          tokensUsed: 0,
          wasTruncated: false,
        });
      }
    }

    // Combine all sections into final markdown
    const markdown = generatedSections.map(s => s.content).join('\n\n---\n\n');

    // Summary logging
    console.log('✅ Specification generation complete:', {
      sections: generatedSections.length,
      truncatedSections: truncatedSections.length,
      totalTokens,
      totalCost: `$${totalCost.toFixed(4)}`,
    });

    if (truncatedSections.length > 0) {
      console.warn(`⚠️ ${truncatedSections.length} section(s) were truncated:`, truncatedSections);
    }

    return {
      markdown,
      sections: generatedSections,
      totalTokens,
      totalCost,
      truncatedSections,
      warnings,
    };
  }
}

// Singleton instance
export const aiService = new AIService();
