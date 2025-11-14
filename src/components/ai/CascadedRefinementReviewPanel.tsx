/**
 * CascadedRefinementReviewPanel Component
 *
 * Specialized review panel for cascaded refinements that shows:
 * - Primary change (always applied)
 * - List of propagated changes with checkboxes
 * - Before/after diff for each change
 * - Accept/reject individual changes
 * - Validation warnings
 */

import React, { useState } from 'react';
import type { CascadedRefinementApproval, PropagatedChange } from '../../types';
import DiffViewer from '../DiffViewer';

interface CascadedRefinementReviewPanelProps {
  approval: CascadedRefinementApproval;
  onApply: (selectedChanges: PropagatedChange[]) => void;
  onReject: () => void;
  onCancel: () => void;
}

export const CascadedRefinementReviewPanel: React.FC<CascadedRefinementReviewPanelProps> = ({
  approval,
  onApply,
  onReject,
  onCancel,
}) => {
  // Extract cascade data with defensive checks
  const cascadeData = approval.generatedContent || {};
  const primaryChange = cascadeData.primaryChange || {};
  const propagatedChanges = cascadeData.propagatedChanges || [];
  const validation = cascadeData.validation || { issues: [], warnings: [], isConsistent: true };
  const impactAnalysis = cascadeData.impactAnalysis || { totalImpact: 'NONE', affectedSections: [], reasoning: '' };

  // Debug logging
  console.log('🔍 CascadedRefinementReviewPanel Data:', {
    hasPrimaryChange: !!cascadeData.primaryChange,
    propagatedChangesCount: propagatedChanges.length,
    validationIssuesCount: validation.issues.length,
    validationWarningsCount: validation.warnings.length,
    impactLevel: impactAnalysis.totalImpact,
  });

  const [selectedChangeIds, setSelectedChangeIds] = useState<Set<string>>(
    new Set(propagatedChanges.map(c => c.sectionId))
  );
  const [expandedChangeId, setExpandedChangeId] = useState<string | null>(null);
  const [showPrimaryDiff, setShowPrimaryDiff] = useState(false);
  const [showValidation, setShowValidation] = useState(true);

  const toggleChange = (sectionId: string) => {
    const newSet = new Set(selectedChangeIds);
    if (newSet.has(sectionId)) {
      newSet.delete(sectionId);
    } else {
      newSet.add(sectionId);
    }
    setSelectedChangeIds(newSet);
  };

  const toggleExpand = (sectionId: string) => {
    setExpandedChangeId(expandedChangeId === sectionId ? null : sectionId);
  };

  const selectAll = () => {
    setSelectedChangeIds(new Set(propagatedChanges.map((c: PropagatedChange) => c.sectionId)));
  };

  const deselectAll = () => {
    setSelectedChangeIds(new Set());
  };

  const handleApply = () => {
    const selectedChanges = propagatedChanges.filter((c: PropagatedChange) => selectedChangeIds.has(c.sectionId));
    onApply(selectedChanges);
  };

  const getImpactColor = (level: 'HIGH' | 'MEDIUM' | 'LOW') => {
    switch (level) {
      case 'HIGH': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
      case 'LOW': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
    }
  };

  const getSeverityColor = (severity: 'ERROR' | 'WARNING') => {
    return severity === 'ERROR'
      ? 'text-red-600 bg-red-50 dark:bg-red-900/20'
      : 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Cascaded Refinement Review
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Instruction: "{cascadeData.instruction}"
        </p>
        <div className="flex items-center gap-4 mt-2 text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Impact: <span className={`font-medium px-2 py-1 rounded ${getImpactColor(impactAnalysis.totalImpact)}`}>
              {impactAnalysis.totalImpact}
            </span>
          </span>
          <span className="text-gray-600 dark:text-gray-400">
            Affected Sections: <span className="font-medium">{propagatedChanges.length}</span>
          </span>
          <span className="text-gray-600 dark:text-gray-400">
            Tokens: <span className="font-medium">{cascadeData.tokensUsed.toLocaleString()}</span>
          </span>
          <span className="text-gray-600 dark:text-gray-400">
            Cost: <span className="font-medium">${cascadeData.costIncurred.toFixed(3)}</span>
          </span>
        </div>
      </div>

      {/* Validation Issues */}
      {showValidation && validation.issues.length > 0 && (
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-yellow-50 dark:bg-yellow-900/10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                ⚠️ Validation Issues ({validation.issues.length})
              </h3>
              <div className="space-y-2">
                {validation.issues.map((issue: any, idx: number) => (
                  <div key={idx} className={`px-3 py-2 rounded text-sm ${getSeverityColor(issue.severity)}`}>
                    <div className="font-medium">{issue.type}: {issue.severity}</div>
                    <div className="mt-1">{issue.description}</div>
                    <div className="mt-1 text-xs">Affected: {issue.affectedSections.join(', ')}</div>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowValidation(false)}
              className="ml-4 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Validation Warnings */}
      {showValidation && validation.warnings.length > 0 && (
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-3 bg-blue-50 dark:bg-blue-900/10">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            💡 Warnings ({validation.warnings.length})
          </h3>
          <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300">
            {validation.warnings.map((warning: string, idx: number) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* Primary Change */}
        <div className="border border-green-300 dark:border-green-700 rounded-lg overflow-hidden bg-green-50 dark:bg-green-900/10">
          <div className="px-4 py-3 bg-green-100 dark:bg-green-900/20">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  ✓ Primary Change
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {primaryChange.sectionTitle} (Section {primaryChange.sectionId})
                </p>
              </div>
              <button
                onClick={() => setShowPrimaryDiff(!showPrimaryDiff)}
                className="px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                {showPrimaryDiff ? 'Hide' : 'Show'} Diff
              </button>
            </div>
          </div>
          {showPrimaryDiff && (
            <div className="p-4 bg-white dark:bg-gray-800">
              <DiffViewer
                original={primaryChange.originalContent}
                modified={primaryChange.refinedContent}
                viewMode="unified"
              />
            </div>
          )}
        </div>

        {/* Propagated Changes */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Propagated Changes ({selectedChangeIds.size}/{propagatedChanges.length} selected)
            </h3>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400"
              >
                Deselect All
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {propagatedChanges.map((change: PropagatedChange) => {
              const isSelected = selectedChangeIds.has(change.sectionId);
              const isExpanded = expandedChangeId === change.sectionId;

              return (
                <div
                  key={change.sectionId}
                  className={`border rounded-lg overflow-hidden ${
                    isSelected
                      ? 'border-blue-300 dark:border-blue-700'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleChange(change.sectionId)}
                      className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          {change.sectionTitle}
                        </h4>
                        <span className={`text-xs px-2 py-0.5 rounded ${getImpactColor(change.impactLevel)}`}>
                          {change.impactLevel}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {change.actionType === 'REMOVE_SECTION' ? 'REMOVE' : 'MODIFY'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {change.reasoning}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Confidence: {(change.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                    <button
                      onClick={() => toggleExpand(change.sectionId)}
                      className="px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      {isExpanded ? 'Hide' : 'Show'} Diff
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                      {change.actionType === 'REMOVE_SECTION' ? (
                        <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                          <p className="font-medium">This section will be removed</p>
                          <p className="text-sm mt-2">Original content will be deleted</p>
                        </div>
                      ) : (
                        <DiffViewer
                          original={change.originalContent}
                          modified={change.proposedContent}
                          viewMode="unified"
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {selectedChangeIds.size} of {propagatedChanges.length} changes selected
          {validation.issues.length > 0 && (
            <span className="ml-3 text-red-600 dark:text-red-400">
              ⚠️ {validation.issues.length} validation issue(s)
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={onReject}
            className="px-4 py-2 text-sm border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
          >
            Reject All
          </button>
          <button
            onClick={handleApply}
            disabled={selectedChangeIds.size === 0 && validation.issues.some(i => i.severity === 'ERROR')}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded font-medium"
          >
            Apply Selected Changes ({selectedChangeIds.size})
          </button>
        </div>
      </div>
    </div>
  );
};

export default CascadedRefinementReviewPanel;
