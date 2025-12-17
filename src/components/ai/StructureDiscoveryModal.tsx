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
import { ReferenceDocumentUpload } from '../documents/ReferenceDocumentUpload';
import { getDefaultMarkdownGuidance } from '../../services/templateAnalyzer';
import type { ProposedStructure, DomainConfig, MarkdownGenerationGuidance } from '../../types';

interface StructureDiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (structure: ProposedStructure) => void;
}

type Step = 'input' | 'analyzing' | 'reviewing' | 'configure' | 'generating';

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
  const updateDocumentMetadata = useProjectStore((state) => state.updateDocumentMetadata);
  const setMarkdownGuidanceInStore = useProjectStore((state) => state.setMarkdownGuidance);

  // Local state
  const [step, setStep] = useState<Step>('input');
  const [userGuidance, setUserGuidance] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  const [showDomainOverride, setShowDomainOverride] = useState(false);
  const [showReferenceUpload, setShowReferenceUpload] = useState(false);
  const [showTechnicalGuidance, setShowTechnicalGuidance] = useState(false);
  const [generationGuidance, setGenerationGuidance] = useState('');
  const [generationProgress, setGenerationProgress] = useState<{
    current: number;
    total: number;
    sectionTitle: string;
  } | null>(null);

  // Document metadata state (for front matter/title page)
  const [docTitle, setDocTitle] = useState('');
  const [docSubtitle, setDocSubtitle] = useState('');
  const [docVersion, setDocVersion] = useState('1.0');
  const [docAuthor, setDocAuthor] = useState('');

  // Formatting options
  const [useDefaultFormatting, setUseDefaultFormatting] = useState(true);
  const [markdownGuidance, setMarkdownGuidance] = useState<MarkdownGenerationGuidance | null>(null);

  // Get BRS content (must be before useEffect that uses it)
  const brsDocument = project?.brsDocument;
  const hasBRS = !!brsDocument?.markdown;
  const brsPreview = brsDocument?.markdown?.slice(0, 500) || '';

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('input');
      setUserGuidance(structurePlanning.userGuidance || '');
      setError(null);
      setAnalysisProgress('');

      // Initialize document metadata from BRS/project
      const projectName = brsDocument?.metadata?.projectName || project?.name || '';
      setDocTitle(projectName ? `${projectName} - Technical Specification` : '');
      setDocSubtitle('');
      setDocVersion(project?.specification?.metadata?.version || '1.0');
      setDocAuthor(project?.specification?.metadata?.author || '');

      // Initialize default markdown guidance
      setUseDefaultFormatting(true);
      setMarkdownGuidance(getDefaultMarkdownGuidance());
    } else {
      endPlanningSession();
    }
  }, [isOpen, structurePlanning.userGuidance, endPlanningSession, brsDocument, project]);

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

      // Get reference documents
      const references = project?.references || [];

      // Update progress message based on what's being analyzed
      const hasRefs = references.length > 0;
      const hasGuidance = userGuidance.trim().length > 0;
      const hasTechContext = generationGuidance.trim().length > 0;
      const contextParts = ['BRS'];
      if (hasRefs) contextParts.push('reference documents');
      if (hasGuidance) contextParts.push('guidance');
      if (hasTechContext) contextParts.push('technical context');
      setAnalysisProgress(`Analyzing ${contextParts.join(', ')}...`);

      // Analyze and propose structure
      const result = await aiService.analyzeAndProposeStructure({
        brsContent: brsDocument.markdown,
        referenceDocuments: references,
        userGuidance,
        technicalGuidance: generationGuidance.trim() || undefined,
      });

      // Update store with results
      setProposedStructure(result.proposedStructure);
      setInferredDomain(result.domainInference);

      // Update usage stats
      updateUsageStats(result.tokensUsed, result.cost);

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
    generationGuidance,
  ]);

  /**
   * Handle structure approval - moves to configure step
   */
  const handleApprove = useCallback(() => {
    approveStructure();
    setStep('configure');
  }, [approveStructure]);

  /**
   * Handle starting generation with guidance
   */
  const handleStartGeneration = useCallback(() => {
    if (structurePlanning.proposedStructure) {
      // Save document metadata to store
      updateDocumentMetadata({
        author: docAuthor.trim() || undefined,
        version: docVersion.trim() || undefined,
        subtitle: docSubtitle.trim() || undefined,
      });

      // Save markdown guidance to store (default or from template)
      if (markdownGuidance) {
        setMarkdownGuidanceInStore(markdownGuidance);
      }

      // Pass the generation guidance along with the structure
      const structureWithGuidance = {
        ...structurePlanning.proposedStructure,
        generationGuidance: generationGuidance.trim() || undefined,
      };

      // Update spec title if provided
      if (docTitle.trim()) {
        // The title will be used by the generation process
        structureWithGuidance.rationale = `Document Title: ${docTitle.trim()}\n\n${structureWithGuidance.rationale}`;
      }

      onGenerate(structureWithGuidance);
    }
  }, [
    structurePlanning.proposedStructure,
    generationGuidance,
    onGenerate,
    docTitle,
    docSubtitle,
    docVersion,
    docAuthor,
    markdownGuidance,
    updateDocumentMetadata,
    setMarkdownGuidanceInStore,
  ]);

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
              {step === 'configure' && 'Configure generation settings before creating the specification'}
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

                {/* Reference Documents - Expandable Upload Section */}
                <div
                  className={`rounded-lg border ${
                    hasReferences
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                      : 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setShowReferenceUpload(!showReferenceUpload)}
                    className="w-full p-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      <svg className={`w-5 h-5 ${hasReferences ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className={hasReferences ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}>
                        {hasReferences
                          ? `${references.length} Reference Document${references.length > 1 ? 's' : ''}`
                          : 'Add Reference Documents (optional)'}
                      </span>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${showReferenceUpload ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Collapsed: Show document badges */}
                  {!showReferenceUpload && hasReferences && (
                    <div className="px-4 pb-4 flex flex-wrap gap-2">
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

                  {/* Expanded: Show upload component */}
                  {showReferenceUpload && (
                    <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Upload PDF or DOCX files that the AI should reference when planning the document structure.
                      </p>
                      <ReferenceDocumentUpload />
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

              {/* Technical Context / Generation Guidance - Collapsible */}
              <div className="mb-6">
                <div
                  className={`rounded-lg border ${
                    generationGuidance.trim()
                      ? 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800'
                      : 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setShowTechnicalGuidance(!showTechnicalGuidance)}
                    className="w-full p-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      <svg className={`w-5 h-5 ${generationGuidance.trim() ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className={generationGuidance.trim() ? 'text-purple-700 dark:text-purple-300' : 'text-gray-500 dark:text-gray-400'}>
                        {generationGuidance.trim() ? 'Technical Context Provided' : 'Add Technical Context (optional)'}
                      </span>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${showTechnicalGuidance ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showTechnicalGuidance && (
                    <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Provide technical constraints, design decisions, or system context. This helps propose better-structured sections and will also be used during content generation.
                      </p>
                      <textarea
                        value={generationGuidance}
                        onChange={(e) => setGenerationGuidance(e.target.value)}
                        placeholder="Examples:
• Constraints: 'Must support 10,000 concurrent users, 99.99% uptime SLA'
• Design decisions: 'Use microservices architecture, prefer async communication'
• Existing systems: 'Integrate with existing Oracle DB and Kafka cluster'
• Standards: 'Follow 3GPP TS 23.501 for 5G architecture references'"
                        rows={5}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </div>
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
                Planning Document Structure
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

          {/* Configure Step - Generation Settings */}
          {step === 'configure' && (
            <div className="h-full p-6 overflow-y-auto">
              <div className="max-w-3xl mx-auto space-y-6">
                {/* Structure Summary */}
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-medium text-green-700 dark:text-green-300">Structure Approved</span>
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {structurePlanning.proposedStructure?.sections.length} sections ready for generation
                  </p>
                </div>

                {/* Document Metadata Section */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Document Metadata (for title page)
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Document Title
                      </label>
                      <input
                        type="text"
                        value={docTitle}
                        onChange={(e) => setDocTitle(e.target.value)}
                        placeholder="e.g., Public Wi-Fi Technical Specification"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Subtitle (optional)
                      </label>
                      <input
                        type="text"
                        value={docSubtitle}
                        onChange={(e) => setDocSubtitle(e.target.value)}
                        placeholder="e.g., Carrier Wi-Fi / Hotspot Service"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Version
                      </label>
                      <input
                        type="text"
                        value={docVersion}
                        onChange={(e) => setDocVersion(e.target.value)}
                        placeholder="1.0"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Author (optional)
                      </label>
                      <input
                        type="text"
                        value={docAuthor}
                        onChange={(e) => setDocAuthor(e.target.value)}
                        placeholder="e.g., Engineering Team"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Content Formatting Section */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                    </svg>
                    Content Formatting
                  </h3>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <input
                        type="radio"
                        name="formatting"
                        checked={useDefaultFormatting}
                        onChange={() => {
                          setUseDefaultFormatting(true);
                          setMarkdownGuidance(getDefaultMarkdownGuidance());
                        }}
                        className="mt-1"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Use default formatting</span>
                        <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 rounded">recommended</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          # for H1, ## for H2, ### for H3 • Decimal numbering (1, 1.1, 1.1.1)
                        </p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 cursor-not-allowed opacity-60">
                      <input
                        type="radio"
                        name="formatting"
                        checked={!useDefaultFormatting}
                        disabled
                        className="mt-1"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Match DOCX reference template</span>
                        <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 rounded">coming soon</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Upload a Word template to extract heading styles and numbering
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Generation Guidance */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Generation Guidance (Optional)
                  </label>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    Provide additional context for the AI when generating the specification content.
                    This guidance will be applied to all sections.
                  </p>
                  <textarea
                    value={generationGuidance}
                    onChange={(e) => setGenerationGuidance(e.target.value)}
                    placeholder="Examples:
• Constraints: 'Must support 10,000 concurrent users, 99.99% uptime SLA'
• Design decisions: 'Use microservices architecture, prefer async communication'
• Existing systems: 'Integrate with existing Oracle DB and Kafka cluster'
• Standards: 'Follow 3GPP TS 23.501 for 5G architecture references'
• Terminology: 'Use carrier-grade language, avoid vendor-specific terms'"
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Quick Guidance Templates */}
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Quick add:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Performance constraints', text: '\n• Performance: [specify throughput, latency, concurrency requirements]' },
                      { label: 'Security requirements', text: '\n• Security: Follow OWASP guidelines, implement defense in depth' },
                      { label: 'Integration points', text: '\n• Integration: [specify existing systems to integrate with]' },
                      { label: 'Compliance', text: '\n• Compliance: [specify regulatory requirements - GDPR, PCI-DSS, etc.]' },
                    ].map((template) => (
                      <button
                        key={template.label}
                        onClick={() => setGenerationGuidance(prev => prev + template.text)}
                        className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        + {template.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Domain Info */}
                {structurePlanning.inferredDomain && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <span className="font-medium">Domain:</span> {structurePlanning.inferredDomain.domain}
                      {structurePlanning.inferredDomain.industry && ` (${structurePlanning.inferredDomain.industry})`}
                    </p>
                    {structurePlanning.inferredDomain.detectedStandards.length > 0 && (
                      <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                        <span className="font-medium">Standards:</span> {structurePlanning.inferredDomain.detectedStandards.join(', ')}
                      </p>
                    )}
                  </div>
                )}
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
                Approve Structure
              </button>
            </div>
          </div>
        )}

        {/* Footer - Configure Step */}
        {step === 'configure' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {generationGuidance.trim() ? (
                <span className="text-green-600 dark:text-green-400">✓ Generation guidance provided</span>
              ) : (
                <span>No additional guidance (using defaults)</span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep('reviewing')}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Back
              </button>
              <button
                onClick={handleStartGeneration}
                className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Specification
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
