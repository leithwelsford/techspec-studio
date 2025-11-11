/**
 * MermaidHealingModal Component
 * Interactive modal for user-controlled iterative Mermaid syntax healing
 */

import React, { useState, useEffect } from 'react';
import { mermaidSelfHealer, HealingProposal, HealingValidation } from '../services/mermaidSelfHealer';
import { DiffViewer } from './DiffViewer';
import { useProjectStore } from '../store/projectStore';
import { decrypt } from '../utils/encryption';
import { aiService } from '../services/ai';

interface MermaidHealingModalProps {
  isOpen: boolean;
  onClose: () => void;
  invalidCode: string;
  diagramId: string;
  diagramTitle: string;
  error: string; // Original Mermaid error message
  onFixed: (fixedCode: string) => void;
  onManualEdit: () => void;
}

export const MermaidHealingModal: React.FC<MermaidHealingModalProps> = ({
  isOpen,
  onClose,
  invalidCode,
  diagramId,
  diagramTitle,
  error,
  onFixed,
  onManualEdit
}) => {
  const aiConfig = useProjectStore(state => state.aiConfig);

  const [isHealing, setIsHealing] = useState(false);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [proposal, setProposal] = useState<HealingProposal | null>(null);
  const [validation, setValidation] = useState<HealingValidation | null>(null);
  const [healingError, setHealingError] = useState<string | null>(null);
  const [healingHistory, setHealingHistory] = useState<HealingProposal[]>([]);

  const maxIterations = mermaidSelfHealer.getMaxIterations();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIteration(0);
      setProposal(null);
      setValidation(null);
      setHealingError(null);
      setHealingHistory([]);
    }
  }, [isOpen]);

  // Check AI configuration
  const canHeal = aiConfig && aiConfig.apiKey;

  const handleStartHealing = async () => {
    if (!canHeal) {
      setHealingError('AI not configured. Please configure your AI provider first.');
      return;
    }

    await attemptHealing(1, invalidCode);
  };

  const attemptHealing = async (iteration: number, code: string) => {
    setIsHealing(true);
    setHealingError(null);
    setValidation(null);

    try {
      // Initialize AI service with decrypted API key
      const decryptedKey = decrypt(aiConfig!.apiKey);
      await aiService.initialize({
        ...aiConfig,
        apiKey: decryptedKey
      });

      console.log(`\n🔧 Attempting healing iteration ${iteration}/${maxIterations}`);

      // Propose healing fix
      const newProposal = await mermaidSelfHealer.proposeHealingIteration(code, iteration);
      setProposal(newProposal);
      setCurrentIteration(iteration);

      // Add to history
      setHealingHistory(prev => [...prev, newProposal]);

      // Validate the proposed fix
      const validationResult = await mermaidSelfHealer.validateProposedFix(newProposal.proposedCode);
      setValidation(validationResult);

      console.log(`   ${validationResult.isValid ? '✅' : '⚠️'} Validation result: ${validationResult.isValid ? 'FIXED' : 'Still has errors'}`);

    } catch (err: any) {
      console.error('Healing failed:', err);
      setHealingError(err.message || 'Failed to generate healing proposal');
    } finally {
      setIsHealing(false);
    }
  };

  const handleAcceptFix = () => {
    if (!proposal) return;

    console.log('✅ User accepted healing proposal');
    onFixed(proposal.proposedCode);
    onClose();
  };

  const handleRejectAndRetry = async () => {
    if (!proposal) return;

    console.log('🔄 User rejected proposal, trying again...');

    if (currentIteration >= maxIterations) {
      setHealingError(`Maximum iterations (${maxIterations}) reached. Please edit manually or cancel.`);
      return;
    }

    // Try again with the original code (not the proposed code)
    await attemptHealing(currentIteration + 1, invalidCode);
  };

  const handleAcceptAndContinue = async () => {
    if (!proposal) return;

    console.log('✅➡️ User accepted proposal but wants to continue healing...');

    if (currentIteration >= maxIterations) {
      // Accept and close
      onFixed(proposal.proposedCode);
      onClose();
      return;
    }

    // Continue healing from this accepted code
    await attemptHealing(currentIteration + 1, proposal.proposedCode);
  };

  const handleManualEdit = () => {
    console.log('✏️ User chose manual editing');
    onManualEdit();
    onClose();
  };

  const handleCancel = () => {
    console.log('❌ User cancelled healing');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                🔧 Mermaid Syntax Healing
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {diagramTitle}
              </p>
            </div>
            <div className="text-sm font-medium text-purple-600 dark:text-purple-400">
              Iteration: {currentIteration} / {maxIterations}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Original Error */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <h3 className="text-sm font-medium text-red-900 dark:text-red-300 mb-2">
              Original Error:
            </h3>
            <pre className="text-xs text-red-800 dark:text-red-400 whitespace-pre-wrap font-mono">
              {error}
            </pre>
          </div>

          {/* AI Configuration Warning */}
          {!canHeal && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-400">
                <strong>AI not configured.</strong> Please configure your AI provider and API key in Settings before using the healing system.
              </p>
            </div>
          )}

          {/* Initial State - No Proposal Yet */}
          {!proposal && !isHealing && !healingError && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                How Self-Healing Works:
              </h3>
              <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-disc list-inside">
                <li>AI analyzes the syntax error using Mermaid documentation</li>
                <li>Proposes a fix with minimal changes to preserve your content</li>
                <li>Shows you a side-by-side diff for review</li>
                <li>You choose to accept, reject and retry, or edit manually</li>
                <li>Maximum {maxIterations} iterations with your approval at each step</li>
              </ul>
            </div>
          )}

          {/* Healing in Progress */}
          {isHealing && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md p-4">
              <div className="flex items-center gap-3">
                <svg className="animate-spin h-5 w-5 text-purple-600 dark:text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-sm font-medium text-purple-900 dark:text-purple-300">
                  Analyzing error and proposing fix (iteration {currentIteration}/{maxIterations})...
                </p>
              </div>
            </div>
          )}

          {/* Healing Error */}
          {healingError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
              <h3 className="text-sm font-medium text-red-900 dark:text-red-300 mb-1">
                Healing Error:
              </h3>
              <p className="text-sm text-red-800 dark:text-red-400">{healingError}</p>
            </div>
          )}

          {/* Proposal and Diff */}
          {proposal && !isHealing && (
            <>
              {/* AI Explanation */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
                <h3 className="text-sm font-medium text-green-900 dark:text-green-300 mb-2">
                  AI Analysis:
                </h3>
                <p className="text-sm text-green-800 dark:text-green-400">{proposal.explanation}</p>
              </div>

              {/* Valid Examples */}
              {proposal.validExamples.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                  <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                    Valid Syntax Examples:
                  </h3>
                  <ul className="text-xs text-blue-800 dark:text-blue-400 space-y-1 font-mono">
                    {proposal.validExamples.slice(0, 5).map((example, idx) => (
                      <li key={idx}>✅ {example}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Validation Status */}
              {validation && (
                <div className={`border rounded-md p-4 ${
                  validation.isValid
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                }`}>
                  <h3 className={`text-sm font-medium mb-2 ${
                    validation.isValid
                      ? 'text-green-900 dark:text-green-300'
                      : 'text-yellow-900 dark:text-yellow-300'
                  }`}>
                    {validation.isValid ? '✅ This Fix Resolves the Error!' : '⚠️ Validation Status'}
                  </h3>
                  {validation.isValid ? (
                    <p className="text-sm text-green-800 dark:text-green-400">
                      The proposed code passes Mermaid validation and should render correctly.
                    </p>
                  ) : (
                    <div className="text-sm text-yellow-800 dark:text-yellow-400">
                      <p className="mb-2">The proposed fix still has errors. You can:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Try again (AI will make another attempt)</li>
                        <li>Accept this partial fix and try again (continue healing)</li>
                        <li>Edit manually to fix remaining issues</li>
                      </ul>
                      {validation.errors.length > 0 && (
                        <div className="mt-2">
                          <p className="font-medium">Remaining errors:</p>
                          <ul className="list-disc list-inside">
                            {validation.errors.map((err, idx) => (
                              <li key={idx} className="text-xs">{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Code Diff */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Proposed Changes:
                  </h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {(() => {
                    // Debug logging for diff viewer input
                    const errorLineNum = proposal.error.line;
                    console.log('📋 DiffViewer Input Debug:');
                    console.log(`   Original code: ${proposal.originalCode.length} chars, ${proposal.originalCode.split('\n').length} lines`);
                    console.log(`   Proposed code: ${proposal.proposedCode.length} chars, ${proposal.proposedCode.split('\n').length} lines`);
                    console.log(`   Error was on line ${errorLineNum}`);
                    console.log(`   Original line ${errorLineNum}: "${proposal.originalCode.split('\n')[errorLineNum - 1] || '(not found)'}"`);
                    console.log(`   Proposed line ${errorLineNum}: "${proposal.proposedCode.split('\n')[errorLineNum - 1] || '(not found)'}"`);
                    return null;
                  })()}
                  <DiffViewer
                    key={`diff-${currentIteration}`}
                    original={proposal.originalCode}
                    modified={proposal.proposedCode}
                    language="mermaid"
                    viewMode="unified"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer with Actions */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
          <div className="flex flex-wrap gap-3 justify-end">
            {/* Initial State - Only "Try to Fix" button */}
            {!proposal && !isHealing && (
              <>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleManualEdit}
                  className="px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-400 bg-white dark:bg-gray-700 border border-blue-300 dark:border-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  ✏️ Edit Manually Instead
                </button>
                <button
                  onClick={handleStartHealing}
                  disabled={!canHeal}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🔧 Try to Fix
                </button>
              </>
            )}

            {/* After Proposal - Show review actions */}
            {proposal && !isHealing && (
              <>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleManualEdit}
                  className="px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-400 bg-white dark:bg-gray-700 border border-blue-300 dark:border-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  ✏️ Edit Manually
                </button>
                {!validation?.isValid && currentIteration < maxIterations && (
                  <button
                    onClick={handleRejectAndRetry}
                    className="px-4 py-2 text-sm font-medium text-orange-700 dark:text-orange-400 bg-white dark:bg-gray-700 border border-orange-300 dark:border-orange-600 rounded-md hover:bg-orange-50 dark:hover:bg-orange-900/20"
                  >
                    🔄 Reject & Try Again
                  </button>
                )}
                {validation?.stillHasErrors && currentIteration < maxIterations && (
                  <button
                    onClick={handleAcceptAndContinue}
                    className="px-4 py-2 text-sm font-medium text-purple-700 dark:text-purple-400 bg-white dark:bg-gray-700 border border-purple-300 dark:border-purple-600 rounded-md hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  >
                    ✅➡️ Accept & Continue Healing
                  </button>
                )}
                <button
                  onClick={handleAcceptFix}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  ✅ Accept Fix
                </button>
              </>
            )}

            {/* During Healing - Disable all buttons */}
            {isHealing && (
              <button
                disabled
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md opacity-50 cursor-not-allowed"
              >
                Healing in progress...
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
