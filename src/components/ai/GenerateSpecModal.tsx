/**
 * GenerateSpecModal Component
 * Multi-step modal for generating technical specifications with template support
 *
 * Flow:
 * 1. Template Selection - Choose spec template (3GPP, IEEE 830, ISO 29148, etc.)
 * 2. Section Customization - Enable/disable/reorder sections
 * 3. Generation - Generate spec with progress tracking
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { aiService } from '../../services/ai';
import { decrypt } from '../../utils/encryption';
import { TemplateSelectionModal } from './TemplateSelectionModal';
import { SectionComposer } from './SectionComposer';
import { ReferenceDocumentUpload } from '../documents/ReferenceDocumentUpload';
import { OpenRouterProvider } from '../../services/ai/providers/OpenRouterProvider';
import {
  estimateContextTokens,
  checkContextFits,
  formatTokenCount,
  estimateTotalContextWithPDFs,
} from '../../services/ai/tokenCounter';

interface GenerateSpecModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'template' | 'customize' | 'generate';

export const GenerateSpecModal: React.FC<GenerateSpecModalProps> = ({ isOpen, onClose }) => {
  const project = useProjectStore(state => state.project);
  const aiConfig = useProjectStore(state => state.aiConfig);
  const brsDocument = useProjectStore(state => state.getBRSDocument());
  const availableTemplates = useProjectStore(state => state.availableTemplates);
  const activeTemplateConfig = useProjectStore(state => state.activeTemplateConfig);
  const setActiveTemplate = useProjectStore(state => state.setActiveTemplate);
  const updateSpecification = useProjectStore(state => state.updateSpecification);
  const updateUsageStats = useProjectStore(state => state.updateUsageStats);
  const createApproval = useProjectStore(state => state.createApproval);
  const createSnapshot = useProjectStore(state => state.createSnapshot);
  const markdownGuidance = useProjectStore(state => state.getMarkdownGuidance());

  const [step, setStep] = useState<Step>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    activeTemplateConfig?.templateId || null
  );
  const [specTitle, setSpecTitle] = useState(() => {
    const projectName = brsDocument?.metadata?.projectName || project?.name || 'Untitled';
    return `${projectName} - Technical Specification`;
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, section: '' });
  const [error, setError] = useState<string | null>(null);
  const [requireApproval, setRequireApproval] = useState(true);

  // Get selected template
  const selectedTemplate = availableTemplates.find(t => t.id === selectedTemplateId);

  // Get PDF reference count for display
  const pdfReferenceCount = useProjectStore(state => state.getPDFReferenceCount());

  // Token estimation - calculate based on BRS, guidance, and references (including PDFs)
  const tokenEstimate = useMemo(() => {
    if (!brsDocument) {
      return null;
    }

    // Get PDF/DOCX references with size info for token estimation
    const pdfReferences = project?.references.filter(
      r => r.dataRef && (r.type === 'PDF' || r.type === 'DOCX')
    ) || [];

    // Check if current model is a vision model (affects how PDFs are processed)
    const isVisionModel = aiConfig?.model
      ? new OpenRouterProvider('').isVisionModel(aiConfig.model)
      : false;

    // Use the enhanced PDF-aware token estimation
    const pdfEstimate = estimateTotalContextWithPDFs(
      brsDocument.markdown,
      pdfReferences.map(r => ({
        id: r.id,
        title: r.title,
        size: r.size,
        pageCount: r.pageCount,
        extractedText: r.extractedText,
        tokenEstimate: r.tokenEstimate,
        fileType: r.type, // Pass file type for accurate estimation
      })),
      2000, // Base system prompt tokens
      { isVisionModel } // Pass vision model status
    );

    // Also calculate text-based references (non-PDF)
    const textReferences = project?.references.filter(
      r => !r.dataRef && r.content
    ) || [];

    const textRefTokens = estimateContextTokens({
      references: textReferences,
    });

    // Combine estimates
    return {
      systemPrompt: pdfEstimate.breakdown.system,
      brsDocument: pdfEstimate.breakdown.brs,
      references: pdfEstimate.breakdown.references + textRefTokens.references,
      existingSpec: 0, // Not including existing spec in new generation
      userGuidance: activeTemplateConfig?.customGuidance
        ? estimateContextTokens({ userGuidance: activeTemplateConfig.customGuidance }).userGuidance
        : 0,
      total: pdfEstimate.total + textRefTokens.references +
        (activeTemplateConfig?.customGuidance
          ? estimateContextTokens({ userGuidance: activeTemplateConfig.customGuidance }).userGuidance
          : 0),
      // Additional PDF-specific info
      pdfWarnings: pdfEstimate.warnings,
      pdfDetails: pdfEstimate.referenceDetails,
    };
  }, [brsDocument, activeTemplateConfig?.customGuidance, project?.references, pdfReferenceCount, aiConfig?.model]);

  // Check if context fits within model limits
  const contextFitInfo = useMemo(() => {
    if (!tokenEstimate || !aiConfig?.model) {
      return null;
    }
    return checkContextFits(tokenEstimate.total, aiConfig.model);
  }, [tokenEstimate, aiConfig?.model]);

  // Validation - also check if context fits within model limits
  const canGenerate = brsDocument && aiConfig && aiConfig.apiKey && selectedTemplate && activeTemplateConfig &&
    (contextFitInfo ? contextFitInfo.fits : true);

  // Reset to template step if modal reopens
  useEffect(() => {
    if (isOpen && !isGenerating) {
      setStep(activeTemplateConfig ? 'customize' : 'template');
      setError(null);
    }
  }, [isOpen, activeTemplateConfig, isGenerating]);

  const handleTemplateSelect = (templateId: string) => {
    const template = availableTemplates.find(t => t.id === templateId);
    if (!template) return;

    setSelectedTemplateId(templateId);

    // Initialize template configuration
    setActiveTemplate({
      templateId: template.id,
      enabledSections: template.sections.filter(s => s.defaultEnabled).map(s => s.id),
      sectionOrder: template.sections.map(s => s.id),
      customGuidance: ''
    });

    // Move to customization step
    setStep('customize');
  };

  // Get the store action for fetching PDF references
  const getPDFReferencesForGeneration = useProjectStore(state => state.getPDFReferencesForGeneration);

  const handleGenerate = async () => {
    // Diagnostic logging
    console.log('🚀 Generate button clicked - checking prerequisites:');
    console.log('  canGenerate:', canGenerate);
    console.log('  brsDocument:', !!brsDocument);
    console.log('  aiConfig:', !!aiConfig);
    console.log('  selectedTemplate:', !!selectedTemplate);
    console.log('  activeTemplateConfig:', !!activeTemplateConfig);
    console.log('  pdfReferenceCount:', pdfReferenceCount);

    if (!canGenerate || !brsDocument || !aiConfig || !selectedTemplate || !activeTemplateConfig) {
      console.error('❌ Generation blocked - missing prerequisite(s)');
      return;
    }

    console.log('✅ All prerequisites met - starting generation...');

    setStep('generate');
    setIsGenerating(true);
    setError(null);

    // Count enabled sections for progress
    const enabledCount = activeTemplateConfig.enabledSections.length;
    setProgress({ current: 0, total: enabledCount + 1, section: 'Analyzing BRS...' });

    try {
      // Decrypt API key
      // Keys starting with 'sk-or-' are plaintext OpenRouter keys
      // Otherwise, they're encrypted and need decryption
      const isPlainText = aiConfig.apiKey?.startsWith('sk-or-');
      let decryptedKey: string;

      if (isPlainText) {
        decryptedKey = aiConfig.apiKey;
      } else {
        decryptedKey = decrypt(aiConfig.apiKey);
        // If decryption returns empty string or the result doesn't look like an API key,
        // it likely failed due to device fingerprint change
        if (!decryptedKey || (!decryptedKey.startsWith('sk-') && decryptedKey.length < 20)) {
          console.error('API key decryption failed. Key may have been encrypted on a different device/browser.');
          throw new Error('Failed to decrypt API key. This can happen if you changed browsers or cleared browser data. Please re-enter your API key in AI Settings.');
        }
      }

      if (!decryptedKey) {
        throw new Error('No API key found. Please configure your AI settings.');
      }

      await aiService.initialize({
        ...aiConfig,
        apiKey: decryptedKey
      });

      // Check if model supports vision for PDF processing
      const isVisionModel = aiService.isVisionModel();
      console.log(`📄 Model vision capability: ${isVisionModel ? 'Yes (native PDF support)' : 'No (will use text extraction)'}`);

      // Fetch PDF references for generation
      // For non-vision models, request text extraction fallback
      let pdfReferences;
      if (pdfReferenceCount > 0) {
        setProgress({ current: 0, total: enabledCount + 1, section: 'Loading reference documents...' });
        pdfReferences = await getPDFReferencesForGeneration({
          extractTextFallback: !isVisionModel
        });
        console.log(`📚 Loaded ${pdfReferences.length} PDF reference(s) for generation:`,
          pdfReferences.map(r => ({
            title: r.title,
            hasBase64: !!r.base64Data,
            hasExtractedText: !!r.extractedText,
            tokenEstimate: r.tokenEstimate
          }))
        );
      }

      // Build context
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
        ],
        markdownGuidance
      };

      setProgress({ current: 0, total: enabledCount + 1, section: 'Analyzing BRS...' });

      // Generate specification using template system with PDF references
      const result = await aiService.generateSpecificationFromTemplate(
        {
          title: brsDocument.title,
          markdown: brsDocument.markdown,
          metadata: {
            customer: brsDocument.metadata.customer,
            version: brsDocument.metadata.version,
            projectName: brsDocument.metadata.projectName
          }
        },
        specTitle,
        selectedTemplate,
        activeTemplateConfig,
        context,
        (current, total, section) => {
          setProgress({ current, total, section });
        },
        pdfReferences // Pass PDF references for multimodal generation
      );

      // Update usage stats
      updateUsageStats(result.totalTokens, result.totalCost);

      console.log('✅ Specification generation complete:', {
        sections: result.sections.length,
        tokens: result.totalTokens,
        cost: `$${result.totalCost.toFixed(4)}`,
        length: result.markdown.length
      });

      if (requireApproval) {
        // Create approval for user review
        const approvalId = createApproval({
          taskId: `generate-spec-${Date.now()}`,
          type: 'document',
          status: 'pending',
          originalContent: project?.specification?.markdown || '',
          generatedContent: result.markdown
        });

        console.log('📋 Created approval for review:', approvalId);

        // Show success message
        setProgress({ current: enabledCount + 1, total: enabledCount + 1, section: 'Complete! Review in Review Panel.' });
      } else {
        // Apply directly without approval
        updateSpecification(result.markdown);

        // Create version snapshot
        createSnapshot(
          'specification-generation',
          `Generated specification from template: ${selectedTemplate.name}`,
          'ai',
          {
            tokensUsed: result.totalTokens,
            costIncurred: result.totalCost
          }
        );

        setProgress({ current: enabledCount + 1, total: enabledCount + 1, section: 'Complete!' });

        // Close modal after brief delay
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      console.error('❌ Specification generation failed:', err);
      setError(err.message || 'Failed to generate specification');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  // Show template selection modal as overlay
  if (step === 'template') {
    return (
      <TemplateSelectionModal
        isOpen={true}
        onClose={onClose}
        onSelect={handleTemplateSelect}
      />
    );
  }

  // Main modal for customization and generation
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {step === 'customize' ? 'Customize Specification' : 'Generating Specification'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {step === 'customize'
                  ? `Template: ${selectedTemplate?.name || 'Unknown'}`
                  : `${progress.current} of ${progress.total} sections`
                }
              </p>
            </div>
            {!isGenerating && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'customize' && selectedTemplate ? (
            <>
              {/* Specification Title */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Specification Title
                </label>
                <input
                  type="text"
                  value={specTitle}
                  onChange={(e) => setSpecTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter specification title..."
                />
              </div>

              {/* Reference Document Upload */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-900 dark:text-white">
                    Reference Documents (Optional)
                  </label>
                  {aiConfig?.model && (
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      new OpenRouterProvider('').isVisionModel(aiConfig.model)
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {new OpenRouterProvider('').isVisionModel(aiConfig.model)
                        ? 'Vision model - PDFs supported'
                        : 'Text model - PDFs will be extracted'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Upload PDF or DOCX reference documents to include in generation context.
                  Vision models can analyze PDFs directly; other models will use text extraction.
                </p>
                <ReferenceDocumentUpload
                  maxFiles={5}
                  disabled={isGenerating}
                />
              </div>

              {/* Section Composer */}
              <SectionComposer template={selectedTemplate} />

              {/* Token Usage Display */}
              {tokenEstimate && contextFitInfo && (
                <div className={`mt-6 rounded-lg border p-4 ${
                  !contextFitInfo.fits
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : contextFitInfo.isWarning
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                }`}>
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`flex-shrink-0 ${
                      !contextFitInfo.fits
                        ? 'text-red-500'
                        : contextFitInfo.isWarning
                        ? 'text-yellow-500'
                        : 'text-blue-500'
                    }`}>
                      {!contextFitInfo.fits ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      ) : contextFitInfo.isWarning ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <h4 className={`font-medium text-sm ${
                        !contextFitInfo.fits
                          ? 'text-red-900 dark:text-red-200'
                          : contextFitInfo.isWarning
                          ? 'text-yellow-900 dark:text-yellow-200'
                          : 'text-blue-900 dark:text-blue-200'
                      }`}>
                        {!contextFitInfo.fits
                          ? 'Context Exceeds Model Limit'
                          : contextFitInfo.isWarning
                          ? 'High Token Usage'
                          : 'Token Usage Estimate'
                        }
                      </h4>

                      {/* Progress bar */}
                      <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            !contextFitInfo.fits
                              ? 'bg-red-500'
                              : contextFitInfo.isWarning
                              ? 'bg-yellow-500'
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${Math.min(contextFitInfo.percentUsed, 100)}%` }}
                        />
                      </div>

                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className={
                          !contextFitInfo.fits
                            ? 'text-red-700 dark:text-red-300'
                            : contextFitInfo.isWarning
                            ? 'text-yellow-700 dark:text-yellow-300'
                            : 'text-blue-700 dark:text-blue-300'
                        }>
                          {formatTokenCount(tokenEstimate.total)} / {formatTokenCount(contextFitInfo.availableForContext)} tokens ({contextFitInfo.percentUsed}%)
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          Model: {aiConfig?.model?.split('/').pop() || 'Unknown'}
                        </span>
                      </div>

                      {/* Token breakdown - collapsible */}
                      <details className="mt-3">
                        <summary className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
                          Show token breakdown
                        </summary>
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                          {tokenEstimate.brsDocument > 0 && (
                            <>
                              <span>BRS Document:</span>
                              <span className="text-right font-mono">{formatTokenCount(tokenEstimate.brsDocument)}</span>
                            </>
                          )}
                          {tokenEstimate.existingSpec > 0 && (
                            <>
                              <span>Existing Spec:</span>
                              <span className="text-right font-mono">{formatTokenCount(tokenEstimate.existingSpec)}</span>
                            </>
                          )}
                          {tokenEstimate.references > 0 && (
                            <>
                              <span>References:</span>
                              <span className="text-right font-mono">{formatTokenCount(tokenEstimate.references)}</span>
                            </>
                          )}
                          {tokenEstimate.userGuidance > 0 && (
                            <>
                              <span>Custom Guidance:</span>
                              <span className="text-right font-mono">{formatTokenCount(tokenEstimate.userGuidance)}</span>
                            </>
                          )}
                          {tokenEstimate.systemPrompt > 0 && (
                            <>
                              <span>System Prompt:</span>
                              <span className="text-right font-mono">{formatTokenCount(tokenEstimate.systemPrompt)}</span>
                            </>
                          )}
                        </div>
                      </details>

                      {/* Warning/error messages */}
                      {!contextFitInfo.fits && (
                        <p className="mt-3 text-xs text-red-700 dark:text-red-300">
                          The context is too large for the selected model. Consider:
                          <ul className="mt-1 ml-4 list-disc">
                            <li>Selecting fewer sections to generate</li>
                            <li>Removing some reference documents</li>
                            <li>Using a model with a larger context window</li>
                          </ul>
                        </p>
                      )}
                      {contextFitInfo.fits && contextFitInfo.isWarning && (
                        <p className="mt-3 text-xs text-yellow-700 dark:text-yellow-300">
                          Token usage is above {contextFitInfo.warningThreshold}%. Generation may be slower or truncated. Consider reducing content or using a model with a larger context window.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Validation Messages */}
              {!brsDocument && (
                <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-sm text-yellow-900 dark:text-yellow-200">
                    <strong>Warning:</strong> No BRS document uploaded. Please upload a BRS document first.
                  </p>
                </div>
              )}

              {!aiConfig?.apiKey && (
                <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-900 dark:text-red-200">
                    <strong>Error:</strong> AI API key not configured. Please configure your AI settings first.
                  </p>
                </div>
              )}
            </>
          ) : step === 'generate' ? (
            <>
              {/* Generation Progress */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    {progress.section}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {Math.round((progress.current / progress.total) * 100)}%
                  </span>
                </div>

                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>

                {isGenerating && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Generating specification... This may take several minutes.</span>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-sm text-red-900 dark:text-red-200">
                      <strong>Error:</strong> {error}
                    </p>
                  </div>
                )}

                {!isGenerating && !error && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <p className="text-sm text-green-900 dark:text-green-200">
                      <strong>Success!</strong> {progress.section}
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        {step === 'customize' && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireApproval}
                  onChange={(e) => setRequireApproval(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                Require approval before applying
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('template')}
                disabled={isGenerating}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Change Template
              </button>
              <button
                onClick={handleGenerate}
                disabled={!canGenerate || isGenerating}
                className={`
                  px-4 py-2 text-sm font-medium rounded transition-colors
                  ${canGenerate && !isGenerating
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                {isGenerating ? 'Generating...' : 'Generate Specification'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
