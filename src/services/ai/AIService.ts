/**
 * AI Service
 * Main service layer for AI-powered content generation
 */

import type {
  AIConfig,
  AIMessage,
  AITask,
  AIContext,
  BlockDiagram,
  MermaidDiagram,
  Project
} from '../../types';

import { OpenRouterProvider } from './providers/OpenRouterProvider';
import { buildSystemPrompt, buildRefinementPrompt, buildReviewPrompt } from './prompts/systemPrompts';
import {
  buildDocumentGenerationPrompt,
  buildSectionGenerationPrompt,
  buildSectionRefinementPrompt
} from './prompts/documentPrompts';
import {
  buildBlockDiagramPrompt,
  buildSequenceDiagramPrompt,
  buildFlowDiagramPrompt,
  buildDiagramSuggestionPrompt
} from './prompts/diagramPrompts';
import { parseBlockDiagram } from './parsers/blockDiagramParser';
import { parseMermaidDiagram } from './parsers/mermaidParser';

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
   */
  initialize(config: AIConfig): void {
    this.config = config;

    switch (config.provider) {
      case 'openrouter':
        this.provider = new OpenRouterProvider(config.apiKey);
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
   * Creates block diagrams for architecture and sequence diagrams for procedures
   * Extracts content from spec sections (Architecture, Procedures) for diagram generation
   */
  async generateDiagramsFromSpec(
    specificationMarkdown: string,
    onProgress?: (current: number, total: number, diagramTitle: string) => void,
    userGuidance?: string
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

    // Extract sections from specification
    const {
      extractArchitectureSection,
      extractProcedureSubsections,
      extractAllSections
    } = await import('../../utils/markdownSectionExtractor');

    // Debug: Show all available sections
    console.log('📄 Analyzing specification markdown...');
    console.log('  Total length:', specificationMarkdown.length, 'characters');
    const allSections = extractAllSections(specificationMarkdown);
    console.log('  Total sections found:', allSections.length);
    if (allSections.length > 0) {
      console.log('  All sections:', allSections.map(s => `${s.sectionNumber}. ${s.title}`).join(', '));
    } else {
      console.warn('  ⚠️ NO SECTIONS FOUND! First 500 chars of markdown:', specificationMarkdown.substring(0, 500));
    }

    const architectureSection = extractArchitectureSection(specificationMarkdown);
    const procedureSubsections = extractProcedureSubsections(specificationMarkdown);

    console.log('📄 Specification analysis:');
    console.log('  Architecture section:', architectureSection ? `Found (${architectureSection.content.length} chars)` : 'Not found');
    console.log('  Procedure subsections:', procedureSubsections.length);

    // Generate block diagram from Architecture section
    if (architectureSection && architectureSection.content.trim().length > 0) {
      if (onProgress) {
        onProgress(1, 1 + procedureSubsections.length, `Section ${architectureSection.sectionNumber}: ${architectureSection.title}`);
      }

      console.log(`📐 Generating block diagram from Architecture section ${architectureSection.sectionNumber}...`);

      // Use appropriate token limits for block diagram generation
      const { isReasoningModel } = await import('../../utils/aiModels');
      const isReasoning = isReasoningModel(this.config.model || '');
      const maxTokens = isReasoning ? 64000 : 4000;

      const blockOptions: any = { maxTokens, userGuidance };
      if (isReasoning) {
        blockOptions.reasoning = { effort: 'high' };
      }

      const blockResult = await this.generateBlockDiagram(
        architectureSection.content,
        architectureSection.title,
        `${architectureSection.sectionNumber}-1`,
        blockOptions
      );

      if (blockResult.diagram) {
        blockDiagrams.push(blockResult.diagram);
        console.log(`✅ Block diagram generated: ${architectureSection.title}`);
      }
      errors.push(...blockResult.errors);
      warnings.push(...blockResult.warnings);
    } else {
      warnings.push('No Architecture section found in specification. Block diagram generation skipped.');
      console.warn('⚠️ No Architecture section found in specification');
    }

    // Generate sequence diagrams from Procedure subsections
    if (procedureSubsections.length > 0) {
      console.log(`📊 Generating ${procedureSubsections.length} sequence diagrams from Procedures sections...`);

      for (let i = 0; i < procedureSubsections.length; i++) {
        const procedure = procedureSubsections[i];
        console.log(`\n🔄 Processing procedure ${i + 1}/${procedureSubsections.length}: ${procedure.sectionNumber}. ${procedure.title}`);

        if (onProgress) {
          onProgress(2 + i, 1 + procedureSubsections.length, `Section ${procedure.sectionNumber}: ${procedure.title}`);
        }

        try {
          // Use appropriate token limits for sequence diagram generation
          const { isReasoningModel } = await import('../../utils/aiModels');
          const isReasoning = isReasoningModel(this.config.model || '');
          const maxTokens = isReasoning ? 64000 : 4000;

          const seqOptions: any = { maxTokens, userGuidance };
          if (isReasoning) {
            seqOptions.reasoning = { effort: 'high' };
          }

          const seqResult = await this.generateSequenceDiagram(
            procedure.content,
            procedure.title,
            [], // Let AI extract participants from procedure content
            `${procedure.sectionNumber}-1`,
            seqOptions
          );

          console.log('✅ Sequence diagram result:', {
            hasDiagram: !!seqResult.diagram,
            errors: seqResult.errors,
            warnings: seqResult.warnings
          });

          if (seqResult.diagram) {
            sequenceDiagrams.push(seqResult.diagram);
            console.log(`✅ Added sequence diagram: ${procedure.title}`);
          } else {
            console.error(`❌ No diagram generated for: ${procedure.title}`, seqResult.errors);
          }
          errors.push(...seqResult.errors);
          warnings.push(...seqResult.warnings);
        } catch (err) {
          console.error(`❌ Error generating sequence diagram for ${procedure.title}:`, err);
          errors.push(`Failed to generate diagram for ${procedure.title}: ${err}`);
        }
      }

      console.log(`\n📊 Final results: ${sequenceDiagrams.length} sequence diagrams generated`);
    } else {
      warnings.push('No Procedure subsections found in specification. Sequence diagram generation skipped.');
      console.warn('⚠️ No Procedure subsections found in specification');
    }

    return {
      blockDiagrams,
      sequenceDiagrams,
      errors,
      warnings
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
      build3GPPReferencesPrompt,
      build3GPPDefinitionsPrompt,
      build3GPPArchitecturePrompt,
      build3GPPFunctionalRequirementsPrompt,
      build3GPPProceduresPrompt,
      build3GPPInformationElementsPrompt,
      build3GPPErrorHandlingPrompt
    } = await import('./prompts/documentPrompts');

    // Step 2: Generate each section sequentially with progress reporting
    const sectionGenerators = [
      {
        title: '1 Scope',
        promptBuilder: () => build3GPPScopePrompt(specTitle, brsAnalysis, brsDocument.metadata, userGuidance)
      },
      {
        title: '2 References',
        promptBuilder: () => build3GPPReferencesPrompt(brsAnalysis.standards || [], context, userGuidance)
      },
      {
        title: '3 Definitions, Symbols, and Abbreviations',
        promptBuilder: () => build3GPPDefinitionsPrompt(brsAnalysis.components || [], brsDocument.markdown, userGuidance)
      },
      {
        title: '4 Architecture',
        promptBuilder: () => build3GPPArchitecturePrompt(brsAnalysis, context, userGuidance)
      },
      {
        title: '5 Functional Requirements',
        promptBuilder: () => build3GPPFunctionalRequirementsPrompt(brsAnalysis, userGuidance)
      },
      {
        title: '6 Procedures',
        promptBuilder: () => build3GPPProceduresPrompt(brsAnalysis, userGuidance)
      },
      {
        title: '7 Information Elements',
        promptBuilder: () => build3GPPInformationElementsPrompt(brsAnalysis, userGuidance)
      },
      {
        title: '8 Error Handling',
        promptBuilder: () => build3GPPErrorHandlingPrompt(brsAnalysis, userGuidance)
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
      const sectionMaxTokens = isReasoningModel ? 16000 : (this.config.maxTokens || 4000);

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
    const documentHeader = `# ${specTitle}

**Technical Specification**

---

**Document Information**
- **Customer**: ${brsDocument.metadata.customer || 'Not specified'}
- **Project**: ${brsDocument.metadata.projectName || 'Not specified'}
- **Version**: ${brsDocument.metadata.version || '1.0'}
- **Date**: ${new Date().toISOString().split('T')[0]}

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
          propagatedChanges.push({
            sectionId: affectedSection.sectionId,
            sectionTitle: affectedSection.sectionTitle,
            actionType: 'MODIFY_SECTION',
            originalContent: sectionContent,
            proposedContent: result.content.trim(),
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
}

// Singleton instance
export const aiService = new AIService();
