/**
 * Environment Configuration Utilities
 *
 * Provides access to environment variables for configuration.
 * Vite exposes environment variables prefixed with VITE_ via import.meta.env
 */

/**
 * Get OpenRouter API key from environment variable
 * @returns API key from VITE_OPENROUTER_API_KEY or null if not set
 */
export function getEnvApiKey(): string | null {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

  if (apiKey && typeof apiKey === 'string' && apiKey.length > 0) {
    // Validate that it looks like an OpenRouter key (starts with sk-or-)
    if (apiKey.startsWith('sk-or-')) {
      return apiKey;
    } else {
      console.warn('⚠️ VITE_OPENROUTER_API_KEY is set but does not start with "sk-or-". Ignoring.');
      return null;
    }
  }

  return null;
}

/**
 * Check if an API key is configured in environment variables
 * @returns true if VITE_OPENROUTER_API_KEY is set
 */
export function hasEnvApiKey(): boolean {
  return getEnvApiKey() !== null;
}

/**
 * Get a masked version of the env API key for display
 * @returns Masked API key (e.g., "sk-or-****-****-1234") or null
 */
export function getMaskedEnvApiKey(): string | null {
  const apiKey = getEnvApiKey();
  if (!apiKey) return null;

  // Show first 6 chars (sk-or-) and last 4 chars
  if (apiKey.length > 10) {
    return `${apiKey.substring(0, 6)}****-****${apiKey.substring(apiKey.length - 4)}`;
  }

  return 'sk-or-****';
}

/**
 * Get default AI model from environment variable
 * @returns Model ID or null if not set
 */
export function getEnvModel(): string | null {
  const model = import.meta.env.VITE_OPENROUTER_MODEL;
  return model && typeof model === 'string' && model.length > 0 ? model : null;
}

/**
 * Get default temperature from environment variable
 * @returns Temperature value (0-2) or null if not set
 */
export function getEnvTemperature(): number | null {
  const temp = import.meta.env.VITE_AI_TEMPERATURE;
  if (temp) {
    const parsed = parseFloat(temp);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 2) {
      return parsed;
    }
  }
  return null;
}

/**
 * Get default max tokens from environment variable
 * @returns Max tokens value or null if not set
 */
export function getEnvMaxTokens(): number | null {
  const maxTokens = import.meta.env.VITE_AI_MAX_TOKENS;
  if (maxTokens) {
    const parsed = parseInt(maxTokens, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

/**
 * Get default streaming setting from environment variable
 * @returns Boolean or null if not set
 */
export function getEnvEnableStreaming(): boolean | null {
  const streaming = import.meta.env.VITE_AI_ENABLE_STREAMING;
  if (streaming === 'true') return true;
  if (streaming === 'false') return false;
  return null;
}

/**
 * Get Brave Search API key from environment variable
 * @returns API key from VITE_BRAVE_API_KEY or null if not set
 */
export function getBraveApiKey(): string | null {
  const apiKey = import.meta.env.VITE_BRAVE_API_KEY;
  return apiKey && typeof apiKey === 'string' && apiKey.length > 0 ? apiKey : null;
}

/**
 * Check if Brave Search API key is configured
 * @returns true if VITE_BRAVE_API_KEY is set
 */
export function hasBraveApiKey(): boolean {
  return getBraveApiKey() !== null;
}

/**
 * Get a masked version of the Brave API key for display
 * @returns Masked API key or null
 */
export function getMaskedBraveApiKey(): string | null {
  const apiKey = getBraveApiKey();
  if (!apiKey) return null;

  // Show first 4 chars and last 4 chars
  if (apiKey.length > 12) {
    return `${apiKey.substring(0, 4)}****${apiKey.substring(apiKey.length - 4)}`;
  }

  return '****';
}

/**
 * Check if web search is enabled via environment variable
 * @returns true if VITE_ENABLE_WEB_SEARCH is 'true'
 */
export function isWebSearchEnabled(): boolean {
  const enabled = import.meta.env.VITE_ENABLE_WEB_SEARCH;
  return enabled === 'true';
}
