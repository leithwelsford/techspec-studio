/**
 * GenerateDiagramFromTextModal Component
 * Modal for generating diagrams from text descriptions or spec sections
 */

import React, { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { aiService } from '../../services/ai';
import { decrypt } from '../../utils/encryption';

interface GenerateDiagramFromTextModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DiagramType = 'block' | 'sequence' | 'flow';

export const GenerateDiagramFromTextModal: React.FC<GenerateDiagramFromTextModalProps> = ({ isOpen, onClose }) => {
  const aiConfig = useProjectStore(state => state.aiConfig);
  const addBlockDiagram = useProjectStore(state => state.addBlockDiagram);
  const addMermaidDiagram = useProjectStore(state => state.addMermaidDiagram);
  const updateUsageStats = useProjectStore(state => state.updateUsageStats);

  const [diagramType, setDiagramType] = useState<DiagramType>('block');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!title.trim() || !description.trim()) {
      setError('Please provide both title and description');
      return;
    }

    if (!aiConfig?.apiKey || !aiConfig.apiKey.trim()) {
      setError('AI not configured. Please set up your API key first.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccess(false);

    try {
      // Decrypt API key and initialize AI service
      const decryptedKey = decrypt(aiConfig.apiKey);
      await aiService.initialize({
        ...aiConfig,
        apiKey: decryptedKey
      });

      let result: any;
      let tokens = 0;
      let cost = 0;

      // Determine token limits based on model type
      // For reasoning models (o1, GPT-5), max_tokens refers to OUTPUT tokens only
      // Reasoning tokens are separate and unlimited, so we need high output limits
      const { isReasoningModel } = await import('../../utils/aiModels');
      const isReasoning = isReasoningModel(aiConfig.model || '');
      const maxTokens = isReasoning ? 64000 : 4000;

      const options: any = { maxTokens };
      if (isReasoning) {
        options.reasoning = { effort: 'high' };
      }

      if (diagramType === 'block') {
        // Generate block diagram
        result = await aiService.generateBlockDiagram(
          description,
          title,
          undefined, // figureNumber
          options
        );

        if (result.diagram) {
          addBlockDiagram(result.diagram);
          tokens = 1500; // Estimate
          cost = 0.03;
        } else {
          throw new Error(result.errors.join(', ') || 'Failed to generate block diagram');
        }
      } else if (diagramType === 'sequence') {
        // Generate sequence diagram
        result = await aiService.generateSequenceDiagram(
          description,
          title,
          [], // Auto-detect participants
          undefined, // figureNumber
          options
        );

        if (result.diagram) {
          console.log('✅ Adding sequence diagram to store:', result.diagram);
          const diagramId = addMermaidDiagram('sequence', result.diagram);
          console.log('✅ Sequence diagram added with ID:', diagramId);
          tokens = 1200;
          cost = 0.02;
        } else {
          throw new Error(result.errors.join(', ') || 'Failed to generate sequence diagram');
        }
      } else if (diagramType === 'flow') {
        // Generate flow diagram
        result = await aiService.generateFlowDiagram(
          description,
          title,
          'flowchart',
          undefined, // figureNumber
          options
        );

        if (result.diagram) {
          addMermaidDiagram('flow', result.diagram);
          tokens = 1200;
          cost = 0.02;
        } else {
          throw new Error(result.errors.join(', ') || 'Failed to generate flow diagram');
        }
      }

      // Update usage stats
      if (tokens > 0) {
        updateUsageStats(tokens, cost);
      }

      setSuccess(true);

      // Auto-close after success
      setTimeout(() => {
        onClose();
        // Reset form
        setTitle('');
        setDescription('');
        setDiagramType('block');
        setSuccess(false);
      }, 1500);

    } catch (err: any) {
      console.error('Failed to generate diagram:', err);
      setError(err.message || 'Failed to generate diagram');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    if (!isGenerating) {
      setTitle('');
      setDescription('');
      setDiagramType('block');
      setError(null);
      setSuccess(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Generate Diagram from Text
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Describe what you want to visualize and AI will generate the diagram for you.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-400">
              ✓ Diagram generated successfully!
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* Diagram Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Diagram Type *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setDiagramType('block')}
                disabled={isGenerating}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  diagramType === 'block'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Block Diagram
              </button>
              <button
                onClick={() => setDiagramType('sequence')}
                disabled={isGenerating}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  diagramType === 'sequence'
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Sequence Diagram
              </button>
              <button
                onClick={() => setDiagramType('flow')}
                disabled={isGenerating}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  diagramType === 'flow'
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Flow Diagram
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {diagramType === 'block' && 'For architecture, components, and system structure'}
              {diagramType === 'sequence' && 'For message flows, interactions, and call sequences'}
              {diagramType === 'flow' && 'For processes, state machines, and workflows'}
            </p>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="diagram-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Diagram Title *
            </label>
            <input
              id="diagram-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isGenerating}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="e.g., 5G Network Architecture"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="diagram-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description / Text to Visualize *
            </label>
            <textarea
              id="diagram-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isGenerating}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder={
                diagramType === 'block'
                  ? 'Describe the components and their relationships...\n\nExample: The system consists of UE connected to gNodeB via N1 interface. gNodeB connects to AMF via N2 and to UPF via N3. AMF connects to SMF via N11.'
                  : diagramType === 'sequence'
                  ? 'Describe the message flow and interactions...\n\nExample: UE sends Attach Request to MME. MME validates with HSS via S6a. HSS responds with auth vectors. MME sends Attach Accept to UE.'
                  : 'Describe the process or workflow...\n\nExample: Start with Idle state. On incoming call, transition to Ringing. If answered, go to Active. If rejected, go to Idle.'
              }
              rows={8}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Paste text from your specification or describe what you want to visualize
            </p>
          </div>

          {/* Estimated Cost */}
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-800 dark:text-blue-400">
              <strong>Estimated cost:</strong> ~$0.02-0.03 • <strong>Time:</strong> 10-20 seconds
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !title.trim() || !description.trim()}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </>
            ) : (
              'Generate Diagram'
            )}
          </button>
          <button
            onClick={handleClose}
            disabled={isGenerating}
            className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
