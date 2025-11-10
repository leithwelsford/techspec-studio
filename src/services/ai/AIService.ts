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
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    const prompt = buildRefinementPrompt(originalContent, feedback);

    const messages = [
      { role: 'user', content: prompt }
    ];

    const result = await this.provider.generate(messages, {
      model: this.config.model,
      temperature: options?.temperature ?? this.config.temperature,
      maxTokens: options?.maxTokens ?? this.config.maxTokens
    });

    // Check for placeholder text - if found, throw error with helpful message
    if (hasPlaceholderText(result.content)) {
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
    options?: GenerationOptions
  ): Promise<{ diagram?: BlockDiagram; errors: string[]; warnings: string[] }> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    const prompt = buildBlockDiagramPrompt(description, title, figureNumber);

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
    options?: GenerationOptions
  ): Promise<{ diagram?: MermaidDiagram; errors: string[]; warnings: string[] }> {
    if (!this.provider || !this.config) {
      throw new Error('AI service not initialized');
    }

    const prompt = buildSequenceDiagramPrompt(description, title, participants, figureNumber);

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
   * Auto-generate diagrams from BRS analysis
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
    onProgress?: (section: number, total: number, sectionTitle: string) => void
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
    const analysisPrompt = buildBRSAnalysisPrompt(brsDocument.markdown);

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
        promptBuilder: () => build3GPPScopePrompt(specTitle, brsAnalysis, brsDocument.metadata)
      },
      {
        title: '2 References',
        promptBuilder: () => build3GPPReferencesPrompt(brsAnalysis.standards || [], context)
      },
      {
        title: '3 Definitions, Symbols, and Abbreviations',
        promptBuilder: () => build3GPPDefinitionsPrompt(brsAnalysis.components || [], brsDocument.markdown)
      },
      {
        title: '4 Architecture',
        promptBuilder: () => build3GPPArchitecturePrompt(brsAnalysis, context)
      },
      {
        title: '5 Functional Requirements',
        promptBuilder: () => build3GPPFunctionalRequirementsPrompt(brsAnalysis)
      },
      {
        title: '6 Procedures',
        promptBuilder: () => build3GPPProceduresPrompt(brsAnalysis)
      },
      {
        title: '7 Information Elements',
        promptBuilder: () => build3GPPInformationElementsPrompt(brsAnalysis)
      },
      {
        title: '8 Error Handling',
        promptBuilder: () => build3GPPErrorHandlingPrompt(brsAnalysis)
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
      const sectionResult = await this.provider.generate(
        [{ role: 'user', content: sectionPrompt }],
        {
          model: this.config.model,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens
        }
      );

      totalTokens += sectionResult.tokens?.total || 0;
      totalCost += sectionResult.cost || 0;

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

    return {
      markdown: combinedMarkdown,
      sections,
      totalTokens,
      totalCost,
      brsAnalysis
    };
  }
}

// Singleton instance
export const aiService = new AIService();
