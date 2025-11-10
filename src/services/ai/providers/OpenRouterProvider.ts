/**
 * OpenRouter AI Provider
 * Provides access to multiple LLM models through OpenRouter API
 * https://openrouter.ai/docs
 */

import type { AIConfig, AIMessage } from '../../../types';

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

    return { content, tokens, cost };
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
   * List available models
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
      return data.data || this.getDefaultModels();
    } catch (error) {
      return this.getDefaultModels();
    }
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
      { id: 'openai/gpt-4', name: 'GPT-4', context_length: 8192 },
      { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', context_length: 16385 },
      { id: 'google/gemini-pro', name: 'Gemini Pro', context_length: 32760 },
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
}
