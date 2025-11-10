/**
 * AI Model Utilities
 * Helper functions for detecting model capabilities and compatibility
 */

/**
 * Check if a model is a reasoning model (like OpenAI o1, GPT-5)
 * Reasoning models use internal reasoning with encrypted output and are incompatible
 * with structured JSON extraction tasks.
 */
export function isReasoningModel(modelId: string): boolean {
  const reasoningModelPatterns = [
    /^openai\/o1/i,        // OpenAI o1 models (o1-preview, o1-mini)
    /^openai\/gpt-5/i,     // OpenAI GPT-5
    /reasoning/i,          // Any model with "reasoning" in the name
  ];

  return reasoningModelPatterns.some(pattern => pattern.test(modelId));
}

/**
 * Get a recommended fallback model for structured output tasks
 * Returns a model ID that's compatible with JSON extraction
 */
export function getStructuredOutputFallback(currentModel: string): string {
  // If already using a compatible model, keep it
  if (!isReasoningModel(currentModel)) {
    return currentModel;
  }

  // Prefer Claude 3.5 Sonnet for telecom/technical specs
  return 'anthropic/claude-3.5-sonnet';
}

/**
 * Get model capabilities description
 */
export function getModelCapabilities(modelId: string): {
  supportsStructuredOutput: boolean;
  supportsStreaming: boolean;
  recommendedFor: string[];
  warnings: string[];
} {
  if (isReasoningModel(modelId)) {
    return {
      supportsStructuredOutput: false,
      supportsStreaming: false,
      recommendedFor: ['complex problem solving', 'mathematical reasoning', 'code analysis'],
      warnings: [
        'Not compatible with BRS analysis (structured JSON extraction)',
        'Not compatible with diagram generation',
        'High token consumption for reasoning',
        'No streaming support'
      ]
    };
  }

  // Non-reasoning models
  return {
    supportsStructuredOutput: true,
    supportsStreaming: true,
    recommendedFor: ['document generation', 'BRS analysis', 'diagram generation', 'chat'],
    warnings: []
  };
}

/**
 * Format model display name
 */
export function formatModelName(modelId: string): string {
  const parts = modelId.split('/');
  if (parts.length === 2) {
    const [provider, model] = parts;
    return `${provider.charAt(0).toUpperCase() + provider.slice(1)} ${model}`;
  }
  return modelId;
}
