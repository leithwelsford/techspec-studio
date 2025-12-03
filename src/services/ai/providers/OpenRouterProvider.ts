/**
 * OpenRouter AI Provider
 * Provides access to multiple LLM models through OpenRouter API
 * https://openrouter.ai/docs
 */

import type { AIConfig, AIMessageMultimodal, PDFEngine, MultimodalContentPart } from '../../../types';

export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
      reasoning_details?: Array<{
        type: string;
        data: string;
      }>;
    };
    finish_reason: string;
    native_finish_reason?: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    // Reasoning models may have additional token counts
    completion_tokens_details?: {
      reasoning_tokens?: number;
      accepted_prediction_tokens?: number;
      rejected_prediction_tokens?: number;
    };
  };
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

// Cache for model data from OpenRouter API
interface ModelCache {
  data: Map<string, { name: string; context_length: number; modality?: string }>;
  timestamp: number;
}

// Module-level cache (persists across provider instances)
let modelCache: ModelCache | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export class OpenRouterProvider {
  private apiKey: string;
  private baseURL = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Generate completion (non-streaming)
   */
  async generate(
    messages: Array<{ role: string; content: string }>,
    config: Partial<AIConfig> = {}
  ): Promise<{
    content: string;
    tokens: { prompt: number; completion: number; total: number };
    cost: number;
  }> {
    // Build request body with optional reasoning parameter
    const requestBody: any = {
      model: config.model || 'anthropic/claude-3.5-sonnet',
      messages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens || 4096,
      stream: false,
    };

    // Add reasoning parameter if provided
    if ((config as any).reasoning) {
      requestBody.reasoning = (config as any).reasoning;
    }

    console.log('🔧 OpenRouter request:', {
      url: `${this.baseURL}/chat/completions`,
      model: requestBody.model,
      hasApiKey: !!this.apiKey,
      apiKeyPrefix: this.apiKey?.substring(0, 10) + '...',
    });

    let response;
    try {
      response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'TechSpec AI Authoring',
        },
        body: JSON.stringify(requestBody),
      });
    } catch (fetchError: any) {
      console.error('🔥 Fetch failed:', fetchError);
      throw new Error(`Network error: ${fetchError.message}. This could be a CORS issue, network connectivity problem, or invalid URL.`);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('🔥 OpenRouter API error:', error);
      throw new Error(`OpenRouter API error (${response.status}): ${JSON.stringify(error)}`);
    }

    const data: OpenRouterResponse = await response.json();

    console.log('🔧 OpenRouter raw response:', {
      model: data.model,
      finish_reason: data.choices[0]?.finish_reason,
      native_finish_reason: data.choices[0]?.native_finish_reason,
      has_content: !!data.choices[0]?.message?.content,
      content_length: (data.choices[0]?.message?.content || '').length,
      tokens: data.usage
    });

    const content = data.choices[0]?.message?.content || '';
    const tokens = {
      prompt: data.usage.prompt_tokens,
      completion: data.usage.completion_tokens,
      total: data.usage.total_tokens,
    };

    // Estimate cost based on model (OpenRouter provides this in headers but we'll estimate)
    const cost = this.estimateCost(config.model || 'anthropic/claude-3.5-sonnet', tokens);

    // Include finish_reason for debugging truncated output
    const finishReason = data.choices[0]?.finish_reason || data.choices[0]?.native_finish_reason || 'unknown';

    return { content, tokens, cost, finishReason } as any;
  }

  /**
   * Generate completion with streaming
   */
  async *generateStream(
    messages: Array<{ role: string; content: string }>,
    config: Partial<AIConfig> = {}
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'TechSpec AI Authoring',
      },
      body: JSON.stringify({
        model: config.model || 'anthropic/claude-3.5-sonnet',
        messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens || 4096,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`OpenRouter API error: ${JSON.stringify(error)}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || line.trim() === 'data: [DONE]') continue;
          if (!line.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(line.slice(6));
            const content = json.choices[0]?.delta?.content || '';
            if (content) {
              yield { content, done: false };
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }

      yield { content: '', done: true };
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Estimate cost based on model and tokens
   * Prices from OpenRouter as of 2024
   */
  private estimateCost(model: string, tokens: { prompt: number; completion: number }): number {
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'anthropic/claude-3.5-sonnet': { prompt: 3, completion: 15 }, // per 1M tokens
      'anthropic/claude-3-opus': { prompt: 15, completion: 75 },
      'anthropic/claude-3-haiku': { prompt: 0.25, completion: 1.25 },
      'openai/gpt-4-turbo': { prompt: 10, completion: 30 },
      'openai/gpt-4': { prompt: 30, completion: 60 },
      'openai/gpt-3.5-turbo': { prompt: 0.5, completion: 1.5 },
      'google/gemini-pro': { prompt: 0.5, completion: 1.5 },
      'meta-llama/llama-3-70b-instruct': { prompt: 0.9, completion: 0.9 },
    };

    const prices = pricing[model] || { prompt: 1, completion: 2 }; // Default fallback

    const promptCost = (tokens.prompt / 1_000_000) * prices.prompt;
    const completionCost = (tokens.completion / 1_000_000) * prices.completion;

    return promptCost + completionCost;
  }

  /**
   * List available models and populate cache
   */
  async listModels(): Promise<Array<{ id: string; name: string; context_length: number }>> {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) return this.getDefaultModels();

      const data = await response.json();
      const models = data.data || [];

      // Populate cache with fresh data
      if (models.length > 0) {
        const cacheMap = new Map<string, { name: string; context_length: number; modality?: string }>();
        for (const model of models) {
          cacheMap.set(model.id, {
            name: model.name,
            context_length: model.context_length,
            modality: model.architecture?.modality,
          });
        }
        modelCache = {
          data: cacheMap,
          timestamp: Date.now(),
        };
        console.log(`📊 Cached ${cacheMap.size} models from OpenRouter API`);
      }

      return models.length > 0 ? models : this.getDefaultModels();
    } catch (error) {
      console.warn('Failed to fetch models from OpenRouter:', error);
      return this.getDefaultModels();
    }
  }

  /**
   * Get context length for a specific model from OpenRouter API
   * Uses cached data if available, otherwise fetches fresh data
   *
   * @param modelId - The model identifier (e.g., "openai/gpt-5.1")
   * @returns Context length in tokens, or null if model not found
   */
  async getModelContextLength(modelId: string): Promise<number | null> {
    // Check if cache is valid
    const cacheValid = modelCache && (Date.now() - modelCache.timestamp < CACHE_TTL_MS);

    if (cacheValid && modelCache) {
      const cached = modelCache.data.get(modelId);
      if (cached) {
        return cached.context_length;
      }
    }

    // Refresh cache by listing models
    await this.listModels();

    // Check again after refresh
    if (modelCache) {
      const cached = modelCache.data.get(modelId);
      if (cached) {
        return cached.context_length;
      }
    }

    return null; // Model not found in OpenRouter
  }

  /**
   * Get context length synchronously from cache (no API call)
   * Returns null if not in cache - use getModelContextLength for async fetch
   */
  static getModelContextLengthFromCache(modelId: string): number | null {
    if (!modelCache) return null;
    const cached = modelCache.data.get(modelId);
    return cached?.context_length ?? null;
  }

  /**
   * Check if model cache has been populated
   */
  static isCachePopulated(): boolean {
    return modelCache !== null && modelCache.data.size > 0;
  }

  /**
   * Get default model list (fallback)
   */
  private getDefaultModels() {
    return [
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', context_length: 200000 },
      { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', context_length: 200000 },
      { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', context_length: 200000 },
      { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', context_length: 128000 },
      { id: 'openai/gpt-4o', name: 'GPT-4o', context_length: 128000 },
      { id: 'openai/gpt-4', name: 'GPT-4', context_length: 8192 },
      { id: 'openai/gpt-5.1', name: 'GPT-5.1', context_length: 400000 },
      { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', context_length: 16385 },
      { id: 'google/gemini-pro', name: 'Gemini Pro', context_length: 32760 },
      { id: 'google/gemini-1.5-pro', name: 'Gemini 1.5 Pro', context_length: 1000000 },
      { id: 'meta-llama/llama-3-70b-instruct', name: 'Llama 3 70B', context_length: 8192 },
    ];
  }

  /**
   * Test API key validity
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.generate(
        [{ role: 'user', content: 'Hello' }],
        { maxTokens: 10 }
      );
      return result.content.length > 0;
    } catch (error) {
      return false;
    }
  }

  // ========== Multimodal Support (Phase 1) ==========

  /**
   * List of models that support vision/multimodal input
   * These models can directly process PDFs and images
   */
  private static readonly VISION_MODELS = [
    // Google Gemini (excellent PDF support)
    'google/gemini-2.0-flash',
    'google/gemini-2.0-flash-exp',
    'google/gemini-1.5-pro',
    'google/gemini-1.5-flash',
    'google/gemini-pro-vision',
    // Anthropic Claude 3+ (native PDF support)
    'anthropic/claude-3.5-sonnet',
    'anthropic/claude-3.5-sonnet-20241022',
    'anthropic/claude-3-opus',
    'anthropic/claude-3-sonnet',
    'anthropic/claude-3-haiku',
    // OpenAI GPT-4 Vision
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'openai/gpt-4-turbo',
    'openai/gpt-4-vision-preview',
  ];

  /**
   * Check if a model supports vision/multimodal input
   * @param modelId The model identifier (e.g., "anthropic/claude-3.5-sonnet")
   * @returns true if the model can process PDFs and images natively
   */
  isVisionModel(modelId: string): boolean {
    // Check for exact match or prefix match (handles version suffixes)
    return OpenRouterProvider.VISION_MODELS.some(
      visionModel => modelId === visionModel || modelId.startsWith(visionModel)
    );
  }

  /**
   * Generate completion with multimodal content (images/PDFs)
   * Uses OpenRouter's universal file support for vision-capable models
   *
   * @param messages Messages with potential multimodal content
   * @param config AI configuration
   * @param options Multimodal-specific options
   * @returns Generated content with token usage and cost
   */
  async generateMultimodal(
    messages: AIMessageMultimodal[],
    config: Partial<AIConfig> = {},
    options: { pdfEngine?: PDFEngine } = {}
  ): Promise<{
    content: string;
    tokens: { prompt: number; completion: number; total: number };
    cost: number;
  }> {
    const model = config.model || 'anthropic/claude-3.5-sonnet';

    // Validate that model supports multimodal if we have file content
    const hasFileContent = messages.some(msg =>
      Array.isArray(msg.content) &&
      msg.content.some(part => part.type === 'file' || part.type === 'image_url')
    );

    if (hasFileContent && !this.isVisionModel(model)) {
      console.warn(`⚠️ Model ${model} may not support multimodal content. Consider using a vision model.`);
    }

    // Build request body
    const requestBody: any = {
      model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens || 4096,
      stream: false,
    };

    // Add PDF processing plugin if we have PDF files
    const hasPdfContent = messages.some(msg =>
      Array.isArray(msg.content) &&
      msg.content.some(part =>
        part.type === 'file' &&
        (part as any).file?.filename?.toLowerCase().endsWith('.pdf')
      )
    );

    if (hasPdfContent) {
      requestBody.plugins = [
        {
          id: 'file-parser',
          pdf: {
            engine: options.pdfEngine || 'auto',
          },
        },
      ];
    }

    console.log('🔧 OpenRouter multimodal request:', {
      url: `${this.baseURL}/chat/completions`,
      model: requestBody.model,
      hasFileContent,
      hasPdfContent,
      pdfEngine: options.pdfEngine || 'auto',
      messageCount: messages.length,
    });

    let response;
    try {
      response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'TechSpec AI Authoring',
        },
        body: JSON.stringify(requestBody),
      });
    } catch (fetchError: any) {
      console.error('🔥 Multimodal fetch failed:', fetchError);
      throw new Error(`Network error: ${fetchError.message}`);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('🔥 OpenRouter multimodal API error:', error);
      throw new Error(`OpenRouter API error (${response.status}): ${JSON.stringify(error)}`);
    }

    const data: OpenRouterResponse = await response.json();

    console.log('🔧 OpenRouter multimodal response:', {
      model: data.model,
      finish_reason: data.choices[0]?.finish_reason,
      content_length: (data.choices[0]?.message?.content || '').length,
      tokens: data.usage,
    });

    const content = data.choices[0]?.message?.content || '';
    const tokens = {
      prompt: data.usage.prompt_tokens,
      completion: data.usage.completion_tokens,
      total: data.usage.total_tokens,
    };

    const cost = this.estimateCost(model, tokens);

    return { content, tokens, cost };
  }

  /**
   * Generate streaming completion with multimodal content
   * Note: Streaming with files may have limitations depending on the model
   */
  async *generateMultimodalStream(
    messages: AIMessageMultimodal[],
    config: Partial<AIConfig> = {},
    options: { pdfEngine?: PDFEngine } = {}
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const model = config.model || 'anthropic/claude-3.5-sonnet';

    // Build request body
    const requestBody: any = {
      model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens || 4096,
      stream: true,
    };

    // Add PDF processing plugin if we have PDF files
    const hasPdfContent = messages.some(msg =>
      Array.isArray(msg.content) &&
      msg.content.some(part =>
        part.type === 'file' &&
        (part as any).file?.filename?.toLowerCase().endsWith('.pdf')
      )
    );

    if (hasPdfContent) {
      requestBody.plugins = [
        {
          id: 'file-parser',
          pdf: {
            engine: options.pdfEngine || 'auto',
          },
        },
      ];
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'TechSpec AI Authoring',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`OpenRouter API error: ${JSON.stringify(error)}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || line.trim() === 'data: [DONE]') continue;
          if (!line.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(line.slice(6));
            const content = json.choices[0]?.delta?.content || '';
            if (content) {
              yield { content, done: false };
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }

      yield { content: '', done: true };
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Create a multimodal message with PDF file attachment
   * Helper method to format PDF data correctly for OpenRouter
   *
   * @param textContent The text prompt to accompany the PDF
   * @param pdfBase64 Base64-encoded PDF data (without data URI prefix)
   * @param filename The filename for the PDF
   * @returns Formatted content array for multimodal message
   */
  static createPDFContent(
    textContent: string,
    pdfBase64: string,
    filename: string
  ): MultimodalContentPart[] {
    return [
      { type: 'text', text: textContent },
      {
        type: 'file',
        file: {
          filename,
          file_data: `data:application/pdf;base64,${pdfBase64}`,
        },
      },
    ];
  }

  /**
   * Create a multimodal message with multiple PDF file attachments
   *
   * @param textContent The text prompt to accompany the PDFs
   * @param pdfs Array of PDF data with filename and base64 content
   * @returns Formatted content array for multimodal message
   */
  static createMultiplePDFContent(
    textContent: string,
    pdfs: Array<{ filename: string; base64Data: string }>
  ): MultimodalContentPart[] {
    const parts: MultimodalContentPart[] = [
      { type: 'text', text: textContent },
    ];

    for (const pdf of pdfs) {
      parts.push({
        type: 'file',
        file: {
          filename: pdf.filename,
          file_data: `data:application/pdf;base64,${pdf.base64Data}`,
        },
      });
    }

    return parts;
  }
}
