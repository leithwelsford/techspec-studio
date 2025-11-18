import { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { encrypt, decrypt, maskApiKey, isValidApiKey } from '../../utils/encryption';
import { getEnvApiKey, hasEnvApiKey, getMaskedEnvApiKey, getEnvModel, getEnvTemperature, getEnvMaxTokens, getEnvEnableStreaming } from '../../utils/envConfig';
import { aiService } from '../../services/ai';
import type { AIModel } from '../../types';

interface AIConfigPanelProps {
  onClose: () => void;
}

export default function AIConfigPanel({ onClose }: AIConfigPanelProps) {
  const aiConfig = useProjectStore((state) => state.aiConfig);
  const setAIConfig = useProjectStore((state) => state.setAIConfig);

  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState<AIModel>('anthropic/claude-3.5-sonnet');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [enableStreaming, setEnableStreaming] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string; context_length: number }>>([]);
  const [modelSearch, setModelSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'provider' | 'name' | 'context'>('provider');

  // Load available models from OpenRouter when API key is entered
  useEffect(() => {
    const fetchModels = async () => {
      if (!apiKey || apiKey.length < 10) return; // Basic validation

      setLoadingModels(true);
      try {
        await aiService.initialize({
          provider: 'openrouter',
          apiKey: apiKey,
          model: 'anthropic/claude-3.5-sonnet', // Temporary
          temperature: 0.7,
          maxTokens: 4096,
          enableStreaming: true,
        });

        const models = await aiService.listModels();
        setAvailableModels(models);
      } catch (error) {
        console.error('Failed to fetch models:', error);
        // Fall back to default models if fetch fails
        setAvailableModels([]);
      } finally {
        setLoadingModels(false);
      }
    };

    // Debounce the API call
    const timeoutId = setTimeout(fetchModels, 500);
    return () => clearTimeout(timeoutId);
  }, [apiKey]);

  // Load existing config
  useEffect(() => {
    let apiKeyLoaded = false;
    let settingsLoaded = false;

    if (aiConfig) {
      // Try to decrypt API key from stored config
      if (aiConfig.apiKey) {
        try {
          const decrypted = decrypt(aiConfig.apiKey);
          setApiKey(decrypted);
          apiKeyLoaded = true;
        } catch (error) {
          console.error('Failed to decrypt API key from localStorage:', error);
          console.log('ℹ️ This can happen if browser state changed (zoom, updates, etc.)');
        }
      }

      // Load other settings from stored config
      if (aiConfig.model) {
        setModel(aiConfig.model);
        settingsLoaded = true;
      }
      setTemperature(aiConfig.temperature);
      setMaxTokens(aiConfig.maxTokens);
      setEnableStreaming(aiConfig.enableStreaming);
    }

    // Fallback to environment variables if localStorage failed or is empty
    if (!apiKeyLoaded) {
      const envApiKey = getEnvApiKey();
      if (envApiKey) {
        console.log('✅ Loaded API key from environment variable (VITE_OPENROUTER_API_KEY)');
        setApiKey(envApiKey);
      }
    }

    if (!settingsLoaded) {
      // Load other settings from environment variables
      const envModel = getEnvModel();
      const envTemp = getEnvTemperature();
      const envMaxTokens = getEnvMaxTokens();
      const envStreaming = getEnvEnableStreaming();

      if (envModel) {
        console.log(`✅ Loaded model from environment: ${envModel}`);
        setModel(envModel as AIModel);
      }
      if (envTemp !== null) {
        console.log(`✅ Loaded temperature from environment: ${envTemp}`);
        setTemperature(envTemp);
      }
      if (envMaxTokens !== null) {
        console.log(`✅ Loaded maxTokens from environment: ${envMaxTokens}`);
        setMaxTokens(envMaxTokens);
      }
      if (envStreaming !== null) {
        console.log(`✅ Loaded streaming setting from environment: ${envStreaming}`);
        setEnableStreaming(envStreaming);
      }
    }
  }, [aiConfig]);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: 'Please enter an API key' });
      return;
    }

    if (!isValidApiKey(apiKey)) {
      setTestResult({ success: false, message: 'Invalid API key format' });
      return;
    }

    // Encrypt API key before saving
    const encryptedKey = encrypt(apiKey);

    const newConfig = {
      provider: 'openrouter' as const,
      apiKey: encryptedKey,
      model,
      temperature,
      maxTokens,
      enableStreaming,
    };

    setAIConfig(newConfig);

    // Initialize AI service
    try {
      await aiService.initialize({
        provider: 'openrouter',
        apiKey: apiKey, // Use unencrypted key for initialization
        model,
        temperature,
        maxTokens,
        enableStreaming,
      });
      setTestResult({ success: true, message: 'Configuration saved successfully!' });
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      setTestResult({
        success: false,
        message: `Failed to initialize AI service: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: 'Please enter an API key' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      await aiService.initialize({
        provider: 'openrouter',
        apiKey: apiKey,
        model,
        temperature,
        maxTokens,
        enableStreaming,
      });

      const result = await aiService.testConnection();

      if (result) {
        setTestResult({ success: true, message: 'Connection successful! API key is valid.' });
      } else {
        setTestResult({ success: false, message: 'Connection failed. Please check your API key.' });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setTesting(false);
    }
  };

  // Fallback models if API call fails or no key entered yet
  const fallbackModels = [
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', context_length: 200000 },
    { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', context_length: 200000 },
    { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', context_length: 200000 },
    { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', context_length: 128000 },
    { id: 'openai/gpt-4', name: 'GPT-4', context_length: 8192 },
  ];

  const rawModels = availableModels.length > 0 ? availableModels : fallbackModels;

  // Extract unique providers for filter dropdown
  const providers = ['all', ...Array.from(new Set(rawModels.map(m => m.id.split('/')[0])))];

  // Filter and sort models
  const filteredAndSortedModels = rawModels
    .filter(m => {
      // Search filter
      const matchesSearch = modelSearch === '' ||
        m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
        m.id.toLowerCase().includes(modelSearch.toLowerCase());

      // Provider filter
      const provider = m.id.split('/')[0];
      const matchesProvider = providerFilter === 'all' || provider === providerFilter;

      return matchesSearch && matchesProvider;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'provider':
          const providerA = a.id.split('/')[0];
          const providerB = b.id.split('/')[0];
          if (providerA !== providerB) return providerA.localeCompare(providerB);
          return a.name.localeCompare(b.name); // Secondary sort by name
        case 'name':
          return a.name.localeCompare(b.name);
        case 'context':
          return b.context_length - a.context_length; // Descending
        default:
          return 0;
      }
    });

  // Group by provider for optgroup display
  const groupedModels = filteredAndSortedModels.reduce((acc, model) => {
    const provider = model.id.split('/')[0];
    if (!acc[provider]) acc[provider] = [];
    acc[provider].push(model);
    return acc;
  }, {} as Record<string, typeof filteredAndSortedModels>);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">AI Configuration</h2>
            <p className="text-sm text-gray-600 mt-1">
              Configure OpenRouter API for AI-powered content generation
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              OpenRouter API Key
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {apiKey && !showApiKey && (
                  <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
                    <span className="text-gray-400 dark:text-gray-500">{maskApiKey(apiKey)}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
            {hasEnvApiKey() && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Using API key from environment variable ({getMaskedEnvApiKey()})
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Get your API key from{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                openrouter.ai/keys
              </a>
              {!hasEnvApiKey() && (
                <span className="block mt-1">
                  💡 Tip: Set <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">VITE_OPENROUTER_API_KEY</code> in <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.env.local</code> to avoid re-entering
                </span>
              )}
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              AI Model
              {loadingModels && <span className="ml-2 text-xs text-blue-600">(Loading models...)</span>}
            </label>

            {/* Search and Filter Controls */}
            {availableModels.length > 10 && (
              <div className="mb-3 space-y-2">
                {/* Search */}
                <input
                  type="text"
                  placeholder="Search models..."
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {/* Filter and Sort Row */}
                <div className="flex gap-2">
                  {/* Provider Filter */}
                  <select
                    value={providerFilter}
                    onChange={(e) => setProviderFilter(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md"
                  >
                    {providers.map(p => (
                      <option key={p} value={p}>
                        {p === 'all' ? 'All Providers' : p.charAt(0).toUpperCase() + p.slice(1)}
                      </option>
                    ))}
                  </select>

                  {/* Sort By */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'provider' | 'name' | 'context')}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md"
                  >
                    <option value="provider">Sort by Provider</option>
                    <option value="name">Sort by Name</option>
                    <option value="context">Sort by Context Size</option>
                  </select>
                </div>
              </div>
            )}

            {/* Model Dropdown with Grouping */}
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as AIModel)}
              disabled={loadingModels}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              size={availableModels.length > 20 ? 10 : undefined}
            >
              {sortBy === 'provider' ? (
                // Grouped by provider
                Object.entries(groupedModels).map(([provider, models]) => (
                  <optgroup key={provider} label={provider.toUpperCase()}>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({(m.context_length / 1000).toFixed(0)}k)
                      </option>
                    ))}
                  </optgroup>
                ))
              ) : (
                // Flat list for name/context sorting
                filteredAndSortedModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id.split('/')[0]}: {m.name} ({(m.context_length / 1000).toFixed(0)}k)
                  </option>
                ))
              )}
            </select>

            <p className="text-xs text-gray-500 mt-1">
              {availableModels.length > 0
                ? `Showing ${filteredAndSortedModels.length} of ${availableModels.length} models`
                : 'Enter API key to load all available models'}
            </p>
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Temperature: {temperature}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Focused (0)</span>
              <span>Balanced (0.7)</span>
              <span>Creative (1)</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Tokens
            </label>
            <select
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1024}>1,024 (Short responses)</option>
              <option value={2048}>2,048 (Medium responses)</option>
              <option value={4096}>4,096 (Long responses)</option>
              <option value={8192}>8,192 (Very long responses)</option>
            </select>
          </div>

          {/* Streaming */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="streaming"
              checked={enableStreaming}
              onChange={(e) => setEnableStreaming(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <label htmlFor="streaming" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Enable streaming responses (see responses as they generate)
            </label>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`p-3 rounded-md ${
                testResult.success
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              <p className="text-sm">{testResult.message}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={handleTestConnection}
            disabled={testing || !apiKey}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!apiKey}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
