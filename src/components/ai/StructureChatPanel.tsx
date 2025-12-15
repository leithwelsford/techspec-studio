/**
 * Structure Chat Panel
 *
 * Chat interface for refining the proposed document structure.
 * Users can add, remove, modify sections through natural language.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { aiService } from '../../services/ai/AIService';
import { decrypt } from '../../utils/encryption';
import type { ProposedStructure, AIMessage } from '../../types';

interface StructureChatPanelProps {
  structure: ProposedStructure;
  onStructureUpdate: (structure: ProposedStructure) => void;
}

export default function StructureChatPanel({
  structure,
  onStructureUpdate,
}: StructureChatPanelProps) {
  // Store state
  const aiConfig = useProjectStore((state) => state.aiConfig);
  const planningChatHistory = useProjectStore((state) => state.structurePlanning.planningChatHistory);

  // Store actions
  const addPlanningMessage = useProjectStore((state) => state.addPlanningMessage);
  const updateUsageStats = useProjectStore((state) => state.updateUsageStats);

  // Local state
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [planningChatHistory]);

  // Focus input when panel mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /**
   * Send a message to refine the structure
   */
  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isLoading || !aiConfig) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setError(null);
    setIsLoading(true);

    // Add user message to chat
    addPlanningMessage({
      role: 'user',
      content: userMessage,
    });

    try {
      // Initialize AI service
      const decryptedKey = decrypt(aiConfig.apiKey);
      aiService.initialize({ ...aiConfig, apiKey: decryptedKey });

      // Process the refinement
      const result = await aiService.processStructureRefinement({
        currentStructure: structure,
        chatHistory: planningChatHistory,
        userMessage,
      });

      // Add assistant response
      addPlanningMessage({
        role: 'assistant',
        content: result.response,
        tokens: {
          prompt: 0,
          completion: 0,
          total: result.tokensUsed,
        },
        cost: result.cost,
      });

      // Update usage stats
      updateUsageStats({
        tokens: result.tokensUsed,
        cost: result.cost,
      });

      // Apply structure changes if any
      if (result.updatedStructure) {
        onStructureUpdate(result.updatedStructure);
      }
    } catch (err) {
      console.error('Structure refinement failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to process message');

      // Add error message to chat
      addPlanningMessage({
        role: 'assistant',
        content: `I encountered an error processing your request: ${
          err instanceof Error ? err.message : 'Unknown error'
        }. Please try again.`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    inputMessage,
    isLoading,
    aiConfig,
    structure,
    planningChatHistory,
    addPlanningMessage,
    updateUsageStats,
    onStructureUpdate,
  ]);

  /**
   * Handle key press (Enter to send, Shift+Enter for newline)
   */
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  /**
   * Quick action suggestions
   */
  const quickActions = [
    { label: 'Add security section', message: 'Add a security considerations section' },
    { label: 'Remove a section', message: 'Remove the [section name] section' },
    { label: 'Reorder sections', message: 'Move the architecture section before requirements' },
    { label: 'More detail', message: 'Add more subsections to the architecture section' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Welcome Message */}
        {planningChatHistory.length === 0 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
              Refine Your Structure
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Use natural language to modify the proposed structure. You can:
            </p>
            <ul className="text-sm text-gray-500 dark:text-gray-400 text-left max-w-sm mx-auto space-y-1">
              <li>• Add new sections</li>
              <li>• Remove existing sections</li>
              <li>• Modify section titles or descriptions</li>
              <li>• Reorder sections</li>
              <li>• Ask questions about the structure</li>
            </ul>

            {/* Quick Actions */}
            <div className="mt-6">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Quick actions:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {quickActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInputMessage(action.message)}
                    className="px-3 py-1 text-xs text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Chat Messages */}
        {planningChatHistory.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <span className="text-sm">Thinking...</span>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a message to refine the structure..."
            disabled={isLoading || !aiConfig}
            rows={2}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading || !aiConfig}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed self-end"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

/**
 * Message Bubble Component
 */
function MessageBubble({ message }: { message: AIMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        {message.tokens && message.tokens.total > 0 && !isUser && (
          <p className="text-xs mt-1 opacity-60">
            {message.tokens.total} tokens
            {message.cost && ` • $${message.cost.toFixed(4)}`}
          </p>
        )}
      </div>
    </div>
  );
}
