import { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { aiService } from '../../services/ai';
import type { AIContext } from '../../types';

export default function ChatPanel() {
  const chatHistory = useProjectStore((state) => state.chatHistory);
  const addChatMessage = useProjectStore((state) => state.addChatMessage);
  const updateChatMessage = useProjectStore((state) => state.updateChatMessage);
  const clearChatHistory = useProjectStore((state) => state.clearChatHistory);
  const isGenerating = useProjectStore((state) => state.isGenerating);
  const setGenerating = useProjectStore((state) => state.setGenerating);
  const updateUsageStats = useProjectStore((state) => state.updateUsageStats);
  const project = useProjectStore((state) => state.project);
  const aiConfig = useProjectStore((state) => state.aiConfig);

  const [input, setInput] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const buildContext = (): AIContext => {
    if (!project) return {};

    return {
      currentDocument: project.specification.markdown,
      availableDiagrams: project.blockDiagrams.map((d) => ({
        id: d.id,
        type: 'block' as const,
        title: d.title,
        figureNumber: d.figureNumber || '',
      })),
      availableReferences: project.references,
    };
  };

  const handleSend = async () => {
    if (!input.trim() || isGenerating || !aiConfig) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message
    addChatMessage({
      role: 'user',
      content: userMessage,
    });

    setGenerating(true);

    try {
      // Initialize AI service with decrypted config
      const { decrypt } = await import('../../utils/encryption');
      const decryptedKey = decrypt(aiConfig.apiKey);

      await aiService.initialize({
        provider: aiConfig.provider,
        apiKey: decryptedKey,
        model: aiConfig.model,
        temperature: aiConfig.temperature,
        maxTokens: aiConfig.maxTokens,
        enableStreaming: aiConfig.enableStreaming,
      });

      const context = buildContext();

      if (aiConfig.enableStreaming) {
        // Streaming mode
        const assistantMessageId = crypto.randomUUID();
        setStreamingMessageId(assistantMessageId);

        addChatMessage({
          role: 'assistant',
          content: '',
        });

        let fullContent = '';
        let totalTokens = 0;
        let cost = 0;

        // Get history (exclude the message we just added)
        const history = chatHistory.slice(0, -1);

        for await (const chunk of aiService.chatStream(userMessage, history, context)) {
          fullContent += chunk;

          // Update the last message
          const messages = useProjectStore.getState().chatHistory;
          const lastMessage = messages[messages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            updateChatMessage(lastMessage.id, {
              content: fullContent,
            });
          }
        }

        // Estimate tokens and cost (rough estimate)
        totalTokens = Math.ceil((userMessage.length + fullContent.length) / 4);
        cost = (totalTokens / 1000000) * 10; // Rough estimate: $10 per 1M tokens

        // Update final message with token info
        const messages = useProjectStore.getState().chatHistory;
        const lastMessage = messages[messages.length - 1];
        if (lastMessage) {
          updateChatMessage(lastMessage.id, {
            tokens: {
              prompt: Math.ceil(userMessage.length / 4),
              completion: Math.ceil(fullContent.length / 4),
              total: totalTokens,
            },
            cost,
          });
        }

        updateUsageStats(totalTokens, cost);
        setStreamingMessageId(null);
      } else {
        // Non-streaming mode
        const history = chatHistory.slice(0, -1);
        const result = await aiService.chat(userMessage, history, context);

        addChatMessage({
          role: 'assistant',
          content: result.content,
          tokens: result.tokens,
          cost: result.cost,
        });

        // Update usage stats
        if (result.tokens && result.cost) {
          updateUsageStats(result.tokens.total, result.cost);
        }
      }
    } catch (error) {
      addChatMessage({
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatCost = (cost?: number) => {
    if (!cost) return null;
    return cost < 0.01 ? '<$0.01' : `$${cost.toFixed(3)}`;
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">AI Assistant</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {aiConfig?.model.split('/')[1] || 'Not configured'}
          </p>
        </div>
        <button
          onClick={clearChatHistory}
          disabled={chatHistory.length === 0}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50"
        >
          Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p className="text-sm mb-2">Start a conversation</p>
            <p className="text-xs">
              Ask me to generate content, create diagrams, or refine sections
            </p>
          </div>
        ) : (
          chatHistory.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                {message.tokens && (
                  <div className="text-xs opacity-70 mt-2 flex items-center gap-2">
                    <span>{message.tokens.total} tokens</span>
                    {message.cost && <span>• {formatCost(message.cost)}</span>}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isGenerating && streamingMessageId && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <div className="animate-pulse">●</div>
                <span className="text-sm">Generating...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        {!project ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
            Create a project to start chatting
          </div>
        ) : (
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask AI to generate content, create diagrams, or refine sections..."
              disabled={isGenerating}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 disabled:bg-gray-50 dark:bg-gray-900 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              rows={3}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isGenerating}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed self-end"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Sending...</span>
                </span>
              ) : (
                'Send'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {project && !isGenerating && (
        <div className="px-4 pb-4 pt-2">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Quick actions:</div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setInput('Generate an introduction section for this specification')}
              className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
            >
              Generate Intro
            </button>
            <button
              onClick={() => setInput('Create a block diagram showing the system architecture')}
              className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
            >
              Create Diagram
            </button>
            <button
              onClick={() => setInput('Review the current document and suggest improvements')}
              className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
            >
              Review Document
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
