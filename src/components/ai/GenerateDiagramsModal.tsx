/**
 * GenerateDiagramsModal Component
 * Modal dialog for auto-generating diagrams from Technical Specification
 */

import React, { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { aiService } from '../../services/ai';
import { decrypt } from '../../utils/encryption';

interface GenerateDiagramsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GenerateDiagramsModal: React.FC<GenerateDiagramsModalProps> = ({ isOpen, onClose }) => {
  const aiConfig = useProjectStore(state => state.aiConfig);
  const specification = useProjectStore(state => state.project?.specification);
  const addBlockDiagram = useProjectStore(state => state.addBlockDiagram);
  const addMermaidDiagram = useProjectStore(state => state.addMermaidDiagram);
  const updateUsageStats = useProjectStore(state => state.updateUsageStats);
  const createApproval = useProjectStore(state => state.createApproval);
  const createSnapshot = useProjectStore(state => state.createSnapshot);

  // Debug logging
  console.log('=== MODAL STATE ===');
  console.log('isOpen:', isOpen);
  console.log('specification:', specification ? `Loaded: ${specification.title}` : 'NULL');
  console.log('spec length:', specification?.markdown.length || 0);
  console.log('aiConfig:', aiConfig ? 'Configured' : 'NULL');
  console.log('==================');

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 1, diagram: '' });
  const [error, setError] = useState<string | null>(null);
  const [requireApproval, setRequireApproval] = useState(true); // Default: require approval
  const [userGuidance, setUserGuidance] = useState('');
  const [showSourceText, setShowSourceText] = useState(false);
  const [generationResults, setGenerationResults] = useState<{
    blockDiagrams: number;
    sequenceDiagrams: number;
    errors: string[];
    warnings: string[];
  } | null>(null);
  const [modelWarning, setModelWarning] = useState<string | null>(null);

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setGenerationResults(null);
      setError(null);
      setProgress({ current: 0, total: 1, diagram: '' });
      setUserGuidance('');
      setShowSourceText(false);
    }
  }, [isOpen]);

  // Validation
  const canGenerate = specification && specification.markdown.trim().length > 0 && aiConfig && aiConfig.apiKey;

  const handleGenerate = async () => {
    if (!canGenerate || !specification || !aiConfig) {
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGenerationResults(null);
    setProgress({ current: 0, total: 1, diagram: 'Analyzing specification sections...' });

    try {
      // Decrypt API key and initialize AI service
      // Check if key is already unencrypted (from environment variable)
      const decryptedKey = aiConfig.apiKey.startsWith('sk-or-')
        ? aiConfig.apiKey  // Already unencrypted
        : decrypt(aiConfig.apiKey);  // Decrypt encrypted key

      await aiService.initialize({
        ...aiConfig,
        apiKey: decryptedKey
      });

      // Check if current model is a reasoning model
      const { isReasoningModel, formatModelName } = await import('../../utils/aiModels');
      const currentModel = aiConfig.model || 'anthropic/claude-3.5-sonnet';
      const isReasoning = isReasoningModel(currentModel);

      if (isReasoning) {
        setModelWarning(`${formatModelName(currentModel)} uses reasoning mode for enhanced diagram quality.`);
      } else {
        setModelWarning(null);
      }

      // Generate diagrams from Technical Specification
      console.log('📊 Diagram Generation - Using specification:', {
        title: specification.title,
        length: specification.markdown.length,
        firstLine: specification.markdown.split('\n')[0],
        containsHSS: specification.markdown.includes('HSS'),
        containsIPMPLS: specification.markdown.includes('IP/MPLS') || specification.markdown.includes('IP MPLS'),
        containsSGW: specification.markdown.includes('S-GW') || specification.markdown.includes('SGW'),
        containsAF: specification.markdown.includes('AF (') || specification.markdown.includes('AF)'),
      });

      const result = await aiService.generateDiagramsFromSpec(
        specification.markdown,
        (current, total, diagramTitle) => {
          setProgress({ current, total, diagram: diagramTitle });
        },
        userGuidance.trim() || undefined // Pass user guidance if provided
      );

      if (requireApproval) {
        // Create approvals for each diagram with unique taskIds
        for (const diagram of result.blockDiagrams) {
          const uniqueId = Math.random().toString(36).substring(2, 11);
          createApproval({
            taskId: `diagram-gen-${Date.now()}-${uniqueId}`,
            type: 'diagram',
            status: 'pending',
            generatedContent: diagram,
          });
        }

        for (const diagram of result.sequenceDiagrams) {
          const uniqueId = Math.random().toString(36).substring(2, 11);
          createApproval({
            taskId: `diagram-gen-${Date.now()}-${uniqueId}`,
            type: 'diagram',
            status: 'pending',
            generatedContent: diagram,
          });
        }

        alert(`Generated ${result.blockDiagrams.length + result.sequenceDiagrams.length} diagram(s)! Please review them in the Review Panel before applying.`);
      } else {
        // Directly add generated diagrams to store
        for (const diagram of result.blockDiagrams) {
          addBlockDiagram(diagram);
        }

        for (const diagram of result.sequenceDiagrams) {
          addMermaidDiagram('sequence', diagram);
        }

        // Create snapshot
        createSnapshot(
          'diagram-add',
          `AI-generated ${result.blockDiagrams.length} block diagram(s) and ${result.sequenceDiagrams.length} sequence diagram(s) from Technical Specification`,
          'ai'
        );
      }

      // Set results for display
      setGenerationResults({
        blockDiagrams: result.blockDiagrams.length,
        sequenceDiagrams: result.sequenceDiagrams.length,
        errors: result.errors,
        warnings: result.warnings
      });

      // If successful and no errors, auto-close after 2 seconds
      if (result.errors.length === 0) {
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      console.error('Failed to generate diagrams:', err);
      setError(err.message || 'Failed to generate diagrams. Please check your AI configuration.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Generate Diagrams from Technical Specification
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            AI-powered diagram generation from Architecture and Procedures sections
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Model Warning */}
          {modelWarning && (
            <div className="bg-amber-50 border border-amber-300 rounded-md p-3">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-amber-800">{modelWarning}</p>
              </div>
            </div>
          )}

          {/* Specification Info */}
          {specification && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Source Technical Specification</h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p><strong>Title:</strong> {specification.title}</p>
                <p><strong>Version:</strong> {specification.metadata.version || 'Not specified'}</p>
                <p><strong>Length:</strong> {specification.markdown.length} characters</p>
              </div>
            </div>
          )}

          {/* User Guidance */}
          {!generationResults && (
            <div>
              <label htmlFor="user-guidance" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Additional Guidance for AI <span className="text-gray-500 font-normal">(Optional)</span>
              </label>
              <textarea
                id="user-guidance"
                value={userGuidance}
                onChange={(e) => setUserGuidance(e.target.value)}
                disabled={isGenerating}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 resize-none"
                placeholder="Provide context or clarifications for the AI. For example:&#10;• Focus on the converged service edge architecture&#10;• Show message flows between PCRF and PCEF only&#10;• Highlight the 5G-NSA (Non-Standalone) architecture&#10;• Use vendor-specific component names from the spec"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Use this field to guide diagram generation - specify which components to emphasize, which flows to show, or clarify deployment details.
              </p>
            </div>
          )}

          {/* Workflow Explanation */}
          {!generationResults && (
            <div className="bg-purple-50 border border-purple-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-purple-900 mb-2">How it works</h3>
              <ul className="text-sm text-purple-800 space-y-1 list-disc list-inside">
                <li><strong>Intelligent Analysis:</strong> AI scans all sections to detect diagram-worthy content</li>
                <li><strong>Block Diagrams:</strong> Architecture, components, interfaces, network topology</li>
                <li><strong>Sequence Diagrams:</strong> Call flows, message exchanges, protocol interactions</li>
                <li><strong>Flow Diagrams:</strong> Algorithms, decision trees, conditional logic</li>
                <li><strong>State Diagrams:</strong> State machines, transitions, modes</li>
                <li><strong>Dynamic Detection:</strong> No hardcoded section numbers - works with any specification structure</li>
              </ul>
            </div>
          )}

          {/* Approval Option */}
          {!generationResults && (
            <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <input
                id="require-approval"
                type="checkbox"
                checked={requireApproval}
                onChange={(e) => setRequireApproval(e.target.checked)}
                disabled={isGenerating}
                className="mt-0.5"
              />
              <div>
                <label htmlFor="require-approval" className="text-sm font-medium text-yellow-900 cursor-pointer">
                  Require approval before applying diagrams
                </label>
                <p className="text-xs text-yellow-700 mt-1">
                  {requireApproval
                    ? 'Generated diagrams will be sent to Review Panel for your approval.'
                    : 'Generated diagrams will be added immediately without review.'}
                </p>
              </div>
            </div>
          )}

          {/* Generation Results */}
          {generationResults && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-green-900 mb-2">Generation Complete!</h3>
              <div className="text-sm text-green-800 space-y-1">
                <p>✓ <strong>{generationResults.blockDiagrams}</strong> block diagram(s) created</p>
                <p>✓ <strong>{generationResults.sequenceDiagrams}</strong> sequence diagram(s) created</p>
                {generationResults.warnings.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium">Warnings:</p>
                    <ul className="list-disc list-inside">
                      {generationResults.warnings.map((warning, idx) => (
                        <li key={idx} className="text-xs">{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-green-700">
                Closing automatically in 2 seconds...
              </p>
            </div>
          )}

          {/* Progress */}
          {isGenerating && !generationResults && (
            <div className="bg-purple-50 border border-purple-200 rounded-md p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-purple-900">
                  {progress.current === 0 ? 'Analyzing...' : 'Generating...'}
                </span>
                <span className="text-sm text-purple-700">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-purple-200 rounded-full h-2 mb-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-sm text-purple-800">{progress.diagram}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-red-900 mb-1">Error</h3>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Warnings */}
          {!canGenerate && !specification && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <p className="text-sm text-yellow-800">
                <strong>No Technical Specification found.</strong> Please generate a technical specification first from the Document tab.
              </p>
            </div>
          )}

          {!canGenerate && specification && specification.markdown.trim().length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <p className="text-sm text-yellow-800">
                <strong>Specification is empty.</strong> Please add content to your technical specification before generating diagrams.
              </p>
            </div>
          )}

          {!canGenerate && specification && !aiConfig?.apiKey && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <p className="text-sm text-yellow-800">
                <strong>AI not configured.</strong> Please configure your AI provider and API key in Settings.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isGenerating && !generationResults}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generationResults ? 'Close' : 'Cancel'}
          </button>
          {!generationResults && (
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating...' : 'Generate Diagrams'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
