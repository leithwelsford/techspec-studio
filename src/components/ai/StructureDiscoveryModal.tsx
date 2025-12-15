/**
 * Structure Discovery Modal
 *
 * Main modal for the AI-assisted structure discovery workflow.
 * Guides user through: Input -> Analysis -> Review/Refine -> Generate
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { aiService } from '../../services/ai/AIService';
import { decrypt } from '../../utils/encryption';
import StructureProposalView from './StructureProposalView';
import StructureChatPanel from './StructureChatPanel';
import DomainOverridePanel from './DomainOverridePanel';
import type { ProposedStructure, DomainConfig } from '../../types';

interface StructureDiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (structure: ProposedStructure) => void;
}

type Step = 'input' | 'analyzing' | 'reviewing' | 'generating';

export default function StructureDiscoveryModal({
  isOpen,
  onClose,
  onGenerate,
}: StructureDiscoveryModalProps) {
  // Store state
  const project = useProjectStore((state) => state.project);
  const aiConfig = useProjectStore((state) => state.aiConfig);
  const structurePlanning = useProjectStore((state) => state.structurePlanning);

  // Store actions
  const startPlanningSession = useProjectStore((state) => state.startPlanningSession);
  const endPlanningSession = useProjectStore((state) => state.endPlanningSession);
  const setProposedStructure = useProjectStore((state) => state.setProposedStructure);
  const setInferredDomain = useProjectStore((state) => state.setInferredDomain);
  const setDomainOverride = useProjectStore((state) => state.setDomainOverride);
  const approveStructure = useProjectStore((state) => state.approveStructure);
  const updateUsageStats = useProjectStore((state) => state.updateUsageStats);

  // Local state
  const [step, setStep] = useState<Step>('input');
  const [userGuidance, setUserGuidance] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  const [showDomainOverride, setShowDomainOverride] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{
    current: number;
    total: number;
    sectionTitle: string;
  } | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('input');
      setUserGuidance(structurePlanning.userGuidance || '');
      setError(null);
      setAnalysisProgress('');
    } else {
      endPlanningSession();
    }
  }, [isOpen, structurePlanning.userGuidance, endPlanningSession]);

  // Get BRS content
  const brsDocument = project?.brsDocument;
  const hasBRS = !!brsDocument?.markdown;
  const brsPreview = brsDocument?.markdown?.slice(0, 500) || '';

  // Get reference documents
  const references = project?.references || [];
  const hasReferences = references.length > 0;

  // Check if AI is configured
  const isAIConfigured = !!aiConfig?.apiKey;

  /**
   * Start the structure analysis
   */
  const handlePlanStructure = useCallback(async () => {
    if (!aiConfig || !brsDocument?.markdown) return;

    setStep('analyzing');
    setError(null);
    setAnalysisProgress('Initializing AI service...');

    try {
      // Initialize AI service with decrypted key
      const decryptedKey = decrypt(aiConfig.apiKey);
      aiService.initialize({ ...aiConfig, apiKey: decryptedKey });

      // Start planning session in store
      startPlanningSession(userGuidance);

      setAnalysisProgress('Analyzing BRS content...');

      // Get reference documents
      const references = project?.references || [];

      // Analyze and propose structure
      const result = await aiService.analyzeAndProposeStructure({
        brsContent: brsDocument.markdown,
        referenceDocuments: references,
        userGuidance,
      });

      // Update store with results
      setProposedStructure(result.proposedStructure);
      setInferredDomain(result.domainInference);

      // Update usage stats
      updateUsageStats({
        tokens: result.tokensUsed,
        cost: result.cost,
      });

      setStep('reviewing');
    } catch (err) {
      console.error('Structure analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze structure');
      setStep('input');
    }
  }, [
    aiConfig,
    brsDocument,
    userGuidance,
    project?.references,
    startPlanningSession,
    setProposedStructure,
    setInferredDomain,
    updateUsageStats,
  ]);

  /**
   * Handle structure approval
   */
  const handleApprove = useCallback(() => {
    approveStructure();
    if (structurePlanning.proposedStructure) {
      onGenerate(structurePlanning.proposedStructure);
    }
  }, [approveStructure, structurePlanning.proposedStructure, onGenerate]);

  /**
   * Handle domain override
   */
  const handleDomainOverride = useCallback(
    (config: DomainConfig | null) => {
      setDomainOverride(config);
      setShowDomainOverride(false);
    },
    [setDomainOverride]
  );

  /**
   * Handle structure update from chat refinement
   */
  const handleStructureUpdate = useCallback(
    (structure: ProposedStructure) => {
      setProposedStructure(structure);
    },
    [setProposedStructure]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[95vw] max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Plan Document Structure
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {step === 'input' && 'Let AI analyze your BRS and propose an optimal document structure'}
              {step === 'analyzing' && 'Analyzing requirements and proposing structure...'}
              {step === 'reviewing' && 'Review and refine the proposed structure'}
              {step === 'generating' && 'Generating specification content...'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* Input Step */}
          {step === 'input' && (
            <div className="h-full p-6 overflow-y-auto">
              {/* Prerequisites Check */}
              <div className="mb-6 space-y-4">
                {/* BRS Status */}
                <div
                  className={`p-4 rounded-lg border ${
                    hasBRS
                      ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                      : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {hasBRS ? (
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )}
                    <span className={hasBRS ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                      {hasBRS ? `BRS Document: ${brsDocument?.title}` : 'No BRS Document uploaded'}
                    </span>
                  </div>
                  {hasBRS && brsPreview && (
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      <p className="italic line-clamp-3">{brsPreview}...</p>
                    </div>
                  )}
                </div>

                {/* AI Config Status */}
                <div
                  className={`p-4 rounded-lg border ${
                    isAIConfigured
                      ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                      : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isAIConfigured ? (
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )}
                    <span className={isAIConfigured ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                      {isAIConfigured ? `AI Configured: ${aiConfig?.model}` : 'AI not configured - configure in AI Settings'}
                    </span>
                  </div>
                </div>

                {/* Reference Documents Status */}
                <div
                  className={`p-4 rounded-lg border ${
                    hasReferences
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                      : 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className={`w-5 h-5 ${hasReferences ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className={hasReferences ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}>
                      {hasReferences
                        ? `${references.length} Reference Document${references.length > 1 ? 's' : ''}`
                        : 'No reference documents (optional)'}
                    </span>
                  </div>
                  {hasReferences && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {references.slice(0, 5).map((ref) => (
                        <span
                          key={ref.id}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded dark:bg-blue-900/40 dark:text-blue-300"
                          title={ref.source}
                        >
                          {ref.title}
                        </span>
                      ))}
                      {references.length > 5 && (
                        <span className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
                          +{references.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* User Guidance */}
              <div className="mb-6">
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Guidance for Structure Planning (optional)
                </label>
                <textarea
                  value={userGuidance}
                  onChange={(e) => setUserGuidance(e.target.value)}
                  placeholder="E.g., 'Focus on the QoS requirements' or 'Include detailed security sections' or 'Follow 3GPP TS template style'"
                  className="w-full h-32 px-4 py-2 border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Provide any specific guidance for how the document should be structured.
                </p>
              </div>

              {/* Error Display */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
                  <p className="text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePlanStructure}
                  disabled={!hasBRS || !isAIConfigured}
                  className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Plan Structure
                </button>
              </div>
            </div>
          )}

          {/* Analyzing Step */}
          {step === 'analyzing' && (
            <div className="h-full flex flex-col items-center justify-center p-6">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mb-4"></div>
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                Analyzing BRS Content...
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {analysisProgress}
              </p>
            </div>
          )}

          {/* Reviewing Step - Split View */}
          {step === 'reviewing' && structurePlanning.proposedStructure && (
            <div className="h-full flex">
              {/* Left Panel - Structure View */}
              <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <h3 className="font-medium text-gray-700 dark:text-gray-300">
                    Proposed Structure
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowDomainOverride(!showDomainOverride)}
                      className="px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      {showDomainOverride ? 'Hide Domain Settings' : 'Domain Settings'}
                    </button>
                  </div>
                </div>

                {/* Domain Override Panel */}
                {showDomainOverride && structurePlanning.inferredDomain && (
                  <DomainOverridePanel
                    inferredDomain={structurePlanning.inferredDomain}
                    currentOverride={structurePlanning.domainOverride}
                    onOverride={handleDomainOverride}
                  />
                )}

                {/* Structure View */}
                <div className="flex-1 overflow-y-auto">
                  <StructureProposalView
                    structure={structurePlanning.proposedStructure}
                    onStructureChange={handleStructureUpdate}
                  />
                </div>
              </div>

              {/* Right Panel - Chat */}
              <div className="w-1/2 flex flex-col">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <h3 className="font-medium text-gray-700 dark:text-gray-300">
                    Refine Structure
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Chat to add, remove, or modify sections
                  </p>
                </div>
                <div className="flex-1 overflow-hidden">
                  <StructureChatPanel
                    structure={structurePlanning.proposedStructure}
                    onStructureUpdate={handleStructureUpdate}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Generating Step */}
          {step === 'generating' && (
            <div className="h-full flex flex-col items-center justify-center p-6">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-500 border-t-transparent mb-4"></div>
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                Generating Specification...
              </p>
              {generationProgress && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Section {generationProgress.current} of {generationProgress.total}
                  </p>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {generationProgress.sectionTitle}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer - Review Step */}
        {step === 'reviewing' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {structurePlanning.proposedStructure?.sections.length} sections proposed
              {structurePlanning.inferredDomain && (
                <span className="ml-2">
                  | Domain: <strong>{structurePlanning.inferredDomain.domain}</strong>
                  {structurePlanning.inferredDomain.confidence && (
                    <span className="ml-1 text-xs">
                      ({Math.round(structurePlanning.inferredDomain.confidence * 100)}% confidence)
                    </span>
                  )}
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep('input')}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Back
              </button>
              <button
                onClick={handleApprove}
                className="px-6 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Approve & Generate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
