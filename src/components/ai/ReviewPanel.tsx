/**
 * ReviewPanel Component
 *
 * Displays pending AI-generated content approvals with:
 * - List of pending reviews (sections, diagrams, refinements)
 * - Diff viewer for before/after comparison
 * - Approve/Reject/Edit actions
 * - Feedback mechanism for refinement requests
 * - Badge indicators for workspace tabs
 */

import React, { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import type { PendingApproval } from '../../types';
import DiffViewer from '../DiffViewer';

interface ReviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReviewPanel: React.FC<ReviewPanelProps> = ({ isOpen, onClose }) => {
  const pendingApprovals = useProjectStore((state) => state.pendingApprovals);
  const approveContent = useProjectStore((state) => state.approveContent);
  const rejectContent = useProjectStore((state) => state.rejectContent);
  const removeApproval = useProjectStore((state) => state.removeApproval);
  const updateSpecification = useProjectStore((state) => state.updateSpecification);
  const addBlockDiagram = useProjectStore((state) => state.addBlockDiagram);
  const addMermaidDiagram = useProjectStore((state) => state.addMermaidDiagram);
  const createSnapshot = useProjectStore((state) => state.createSnapshot);

  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [showDiff, setShowDiff] = useState(true);

  const selectedApproval = pendingApprovals.find((a) => a.id === selectedApprovalId);

  if (!isOpen) return null;

  const handleApprove = (approval: PendingApproval) => {
    // Apply the generated content
    if (approval.type === 'section' || approval.type === 'document') {
      // For specification content
      const currentMarkdown = approval.originalContent || '';
      const newMarkdown = approval.generatedContent;
      updateSpecification(newMarkdown);

      // Create snapshot
      createSnapshot(
        'ai-refinement',
        `Applied AI-generated ${approval.type}`,
        'ai',
        { relatedApprovalId: approval.id }
      );
    } else if (approval.type === 'diagram') {
      // For diagrams
      const diagram = approval.generatedContent;
      if (diagram.nodes && diagram.edges) {
        // Block diagram
        addBlockDiagram(diagram);
      } else if (diagram.mermaidCode) {
        // Mermaid diagram (sequence or flow)
        addMermaidDiagram(diagram.type || 'sequence', diagram);
      }

      // Create snapshot
      createSnapshot(
        'diagram-add',
        `Applied AI-generated diagram: ${diagram.title || 'Untitled'}`,
        'ai',
        { relatedApprovalId: approval.id }
      );
    }

    // Mark as approved in store
    approveContent(approval.id, feedback || undefined);

    // Remove from pending list after a brief delay
    setTimeout(() => {
      removeApproval(approval.id);
      setSelectedApprovalId(null);
      setFeedback('');
    }, 500);
  };

  const handleReject = (approval: PendingApproval) => {
    if (!feedback.trim()) {
      alert('Please provide feedback on why you are rejecting this content.');
      return;
    }

    // Mark as rejected in store
    rejectContent(approval.id, feedback);

    // Remove from pending list after a brief delay
    setTimeout(() => {
      removeApproval(approval.id);
      setSelectedApprovalId(null);
      setFeedback('');
    }, 500);
  };

  const handleDismiss = (approval: PendingApproval) => {
    if (confirm('Are you sure you want to dismiss this review? The generated content will be discarded.')) {
      removeApproval(approval.id);
      setSelectedApprovalId(null);
      setFeedback('');
    }
  };

  const getTypeLabel = (type: PendingApproval['type']): string => {
    switch (type) {
      case 'document':
        return 'Full Specification';
      case 'section':
        return 'Section';
      case 'diagram':
        return 'Diagram';
      case 'refinement':
        return 'Refinement';
      default:
        return 'Content';
    }
  };

  const getTypeColor = (type: PendingApproval['type']): string => {
    switch (type) {
      case 'document':
        return 'bg-purple-100 text-purple-700';
      case 'section':
        return 'bg-blue-100 text-blue-700';
      case 'diagram':
        return 'bg-green-100 text-green-700';
      case 'refinement':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Review AI-Generated Content</h2>
            <p className="text-sm text-gray-500 mt-1">
              {pendingApprovals.length} pending review{pendingApprovals.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar: Approval list */}
          <div className="w-80 border-r border-gray-200 overflow-y-auto">
            <div className="p-4 space-y-2">
              {pendingApprovals.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs mt-1">No pending reviews</p>
                </div>
              ) : (
                pendingApprovals.map((approval) => (
                  <button
                    key={approval.id}
                    onClick={() => setSelectedApprovalId(approval.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedApprovalId === approval.id
                        ? 'border-blue-400 bg-blue-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${getTypeColor(approval.type)}`}>
                        {getTypeLabel(approval.type)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(approval.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 font-medium line-clamp-2">
                      {approval.type === 'diagram'
                        ? approval.generatedContent.title || 'Untitled Diagram'
                        : `Generated ${approval.type}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                      Task ID: {approval.taskId.slice(0, 8)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right panel: Content preview and actions */}
          <div className="flex-1 overflow-y-auto">
            {selectedApproval ? (
              <div className="p-6 space-y-4">
                {/* Approval header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      {selectedApproval.type === 'diagram'
                        ? selectedApproval.generatedContent.title || 'Untitled Diagram'
                        : `${getTypeLabel(selectedApproval.type)} Review`}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Created {new Date(selectedApproval.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {selectedApproval.originalContent && (
                    <button
                      onClick={() => setShowDiff(!showDiff)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {showDiff ? 'Hide Diff' : 'Show Diff'}
                    </button>
                  )}
                </div>

                {/* Diff viewer (if applicable) */}
                {showDiff && selectedApproval.originalContent && (
                  <DiffViewer
                    original={selectedApproval.originalContent}
                    modified={
                      typeof selectedApproval.generatedContent === 'string'
                        ? selectedApproval.generatedContent
                        : JSON.stringify(selectedApproval.generatedContent, null, 2)
                    }
                    title="Content Changes"
                    viewMode="unified"
                  />
                )}

                {/* Generated content preview */}
                {!showDiff || !selectedApproval.originalContent ? (
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Generated Content:</h4>
                    <div className="bg-white border border-gray-200 rounded p-4 max-h-96 overflow-y-auto font-mono text-xs">
                      <pre className="whitespace-pre-wrap">
                        {typeof selectedApproval.generatedContent === 'string'
                          ? selectedApproval.generatedContent
                          : JSON.stringify(selectedApproval.generatedContent, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : null}

                {/* Feedback textarea */}
                <div>
                  <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 mb-2">
                    Feedback (optional for approval, required for rejection)
                  </label>
                  <textarea
                    id="feedback"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Provide feedback or suggestions for improvement..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleApprove(selectedApproval)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Approve & Apply
                  </button>
                  <button
                    onClick={() => handleReject(selectedApproval)}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Reject
                  </button>
                  <button
                    onClick={() => handleDismiss(selectedApproval)}
                    className="px-4 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <svg className="w-24 h-24 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm font-medium">Select a review from the list</p>
                  <p className="text-xs mt-1">Choose an item to preview and approve/reject</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer with summary */}
        {pendingApprovals.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{pendingApprovals.length}</span> pending review{pendingApprovals.length !== 1 ? 's' : ''}
            </div>
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                {pendingApprovals.filter(a => a.type === 'document').length} docs
              </span>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                {pendingApprovals.filter(a => a.type === 'section').length} sections
              </span>
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                {pendingApprovals.filter(a => a.type === 'diagram').length} diagrams
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewPanel;
