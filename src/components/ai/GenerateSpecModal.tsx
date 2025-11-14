/**
 * GenerateSpecModal Component
 * Modal dialog for generating full technical specification from BRS
 */

import React, { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { aiService } from '../../services/ai';
import { decrypt } from '../../utils/encryption';

interface GenerateSpecModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GenerateSpecModal: React.FC<GenerateSpecModalProps> = ({ isOpen, onClose }) => {
  const project = useProjectStore(state => state.project);
  const aiConfig = useProjectStore(state => state.aiConfig);
  const brsDocument = useProjectStore(state => state.getBRSDocument());
  const updateSpecification = useProjectStore(state => state.updateSpecification);
  const updateUsageStats = useProjectStore(state => state.updateUsageStats);
  const createApproval = useProjectStore(state => state.createApproval);
  const createSnapshot = useProjectStore(state => state.createSnapshot);

  const [specTitle, setSpecTitle] = useState(() => {
    const projectName = brsDocument?.metadata?.projectName || project?.name || 'Untitled';
    return `${projectName} - Technical Specification`;
  });
  const [userGuidance, setUserGuidance] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 8, section: '' });
  const [error, setError] = useState<string | null>(null);
  const [requireApproval, setRequireApproval] = useState(true); // Default: require approval

  // Validation
  const canGenerate = brsDocument && aiConfig && aiConfig.apiKey;

  const handleGenerate = async () => {
    if (!canGenerate || !brsDocument || !aiConfig) {
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress({ current: 0, total: 8, section: 'Analyzing BRS...' });

    try {
      // Decrypt API key and initialize AI service
      // Check if key is already plain text (starts with sk-or-)
      const isPlainText = aiConfig.apiKey?.startsWith('sk-or-');
      const decryptedKey = isPlainText ? aiConfig.apiKey : decrypt(aiConfig.apiKey);

      console.log('🔑 API Key Debug:', {
        hasEncryptedKey: !!aiConfig.apiKey,
        isPlainText,
        encryptedLength: aiConfig.apiKey?.length,
        hasDecryptedKey: !!decryptedKey,
        decryptedLength: decryptedKey?.length,
        decryptedPrefix: decryptedKey?.substring(0, 10),
      });

      if (!decryptedKey) {
        throw new Error('Failed to decrypt API key. Please reconfigure your AI settings.');
      }

      await aiService.initialize({
        ...aiConfig,
        apiKey: decryptedKey
      });

      // Build context with available references and diagrams
      const context = {
        availableReferences: project?.references || [],
        availableDiagrams: [
          ...(project?.blockDiagrams || []).map(d => ({
            id: d.id,
            title: d.title,
            type: 'block' as const,
            figureNumber: d.figureNumber || ''
          })),
          ...(project?.sequenceDiagrams || []).map(d => ({
            id: d.id,
            title: d.title,
            type: 'sequence' as const,
            figureNumber: d.figureNumber || ''
          })),
          ...(project?.flowDiagrams || []).map(d => ({
            id: d.id,
            title: d.title,
            type: 'flow' as const,
            figureNumber: d.figureNumber || ''
          }))
        ]
      };

      // Generate full specification
      const result = await aiService.generateFullSpecification(
        {
          title: brsDocument.title,
          markdown: brsDocument.markdown,
          metadata: brsDocument.metadata
        },
        specTitle,
        context,
        (current, total, sectionTitle) => {
          setProgress({ current, total, section: sectionTitle });
        },
        userGuidance.trim() || undefined // Pass user guidance if provided
      );

      // Update usage stats
      updateUsageStats(result.totalTokens, result.totalCost);

      if (requireApproval) {
        // Create approval for review
        const originalMarkdown = project?.specification?.markdown || '';
        createApproval({
          taskId: `spec-gen-${Date.now()}`,
          type: 'document',
          status: 'pending',
          originalContent: originalMarkdown,
          generatedContent: result.markdown,
        });

        alert('Specification generated! Please review it in the Review Panel before applying.');
      } else {
        // Directly apply the generated specification
        updateSpecification(result.markdown);

        // Create snapshot
        createSnapshot(
          'specification-generation',
          `AI-generated full specification from BRS`,
          'ai',
          { tokensUsed: result.totalTokens, costIncurred: result.totalCost }
        );
      }

      // Success - close modal
      onClose();
    } catch (err: any) {
      console.error('Failed to generate specification:', err);
      setError(err.message || 'Failed to generate specification. Please check your AI configuration.');
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
            Generate Technical Specification
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            AI-powered generation from Business Requirements Specification
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* BRS Info */}
          {brsDocument && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Source BRS Document</h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p><strong>Title:</strong> {brsDocument.title}</p>
                <p><strong>Customer:</strong> {brsDocument.metadata.customer || 'Not specified'}</p>
                <p><strong>Project:</strong> {brsDocument.metadata.projectName || 'Not specified'}</p>
                <p><strong>File:</strong> {brsDocument.filename}</p>
              </div>
            </div>
          )}

          {/* Specification Title */}
          <div>
            <label htmlFor="spec-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Technical Specification Title
            </label>
            <input
              id="spec-title"
              type="text"
              value={specTitle}
              onChange={(e) => setSpecTitle(e.target.value)}
              disabled={isGenerating}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="Enter specification title..."
            />
          </div>

          {/* User Guidance */}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 resize-none"
              placeholder="Provide context or clarifications for the AI. For example:&#10;• The deployment uses 5G-NSA (Non-Standalone) architecture&#10;• Focus on eMBB (Enhanced Mobile Broadband) use cases&#10;• Customer requires dual-stack IPv4/IPv6 support&#10;• Use vendor-specific terminology from Ericsson"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Use this field to clarify ambiguities in the BRS, specify deployment details, or provide additional context that will help the AI generate a more accurate specification.
            </p>
          </div>

          {/* Approval Option */}
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
                Require approval before applying changes
              </label>
              <p className="text-xs text-yellow-700 mt-1">
                {requireApproval
                  ? 'Generated content will be sent to Review Panel for your approval.'
                  : 'Generated content will be applied immediately without review.'}
              </p>
            </div>
          </div>

          {/* Generation Info */}
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">What will be generated?</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>✓ <strong>Section 1:</strong> Scope</li>
              <li>✓ <strong>Section 2:</strong> References (Normative & Informative)</li>
              <li>✓ <strong>Section 3:</strong> Definitions, Symbols, and Abbreviations</li>
              <li>✓ <strong>Section 4:</strong> Architecture (with diagram placeholders)</li>
              <li>✓ <strong>Section 5:</strong> Functional Requirements</li>
              <li>✓ <strong>Section 6:</strong> Procedures (with sequence diagram placeholders)</li>
              <li>✓ <strong>Section 7:</strong> Information Elements</li>
              <li>✓ <strong>Section 8:</strong> Error Handling</li>
            </ul>
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
              Estimated time: 2-5 minutes depending on AI model and complexity
            </p>
          </div>

          {/* Progress */}
          {isGenerating && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-900">Generating...</span>
                <span className="text-sm text-green-700">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-green-200 rounded-full h-2 mb-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-sm text-green-800">{progress.section}</p>
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
          {!canGenerate && !brsDocument && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <p className="text-sm text-yellow-800">
                <strong>No BRS document loaded.</strong> Please upload a BRS document first from the BRS tab.
              </p>
            </div>
          )}

          {!canGenerate && brsDocument && !aiConfig?.apiKey && (
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
            disabled={isGenerating}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? 'Generating...' : 'Cancel'}
          </button>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating || !specTitle.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? 'Generating...' : 'Generate Specification'}
          </button>
        </div>
      </div>
    </div>
  );
};
