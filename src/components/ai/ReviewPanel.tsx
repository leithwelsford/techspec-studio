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

import React, { useState, useEffect, useRef } from 'react';
import { useProjectStore } from '../../store/projectStore';
import type { PendingApproval, CascadedRefinementApproval, PropagatedChange, BlockDiagram, MermaidDiagram } from '../../types';
import DiffViewer from '../DiffViewer';
import { CascadedRefinementReviewPanel } from './CascadedRefinementReviewPanel';
import { PanZoomWrapper } from '../PanZoomWrapper';
import mermaid from 'mermaid';

interface ReviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// Helper component: Block Diagram Renderer (returns SVG content only, no <svg> wrapper)
const BlockDiagramRenderer: React.FC<{ diagram: BlockDiagram }> = ({ diagram }) => {
  console.log('🎨 BlockDiagramRenderer called with:', {
    nodeCount: diagram.nodes.length,
    edgeCount: diagram.edges.length,
    nodes: diagram.nodes.map(n => ({ id: n.id, label: n.label, position: n.position, size: n.size }))
  });

  return (
    <>
      {/* Render nodes */}
      {diagram.nodes.map((node) => (
        <g key={node.id}>
          {node.shape === 'cloud' ? (
            <path
              d={`M ${node.position.x},${node.position.y + 10}
                  Q ${node.position.x - 10},${node.position.y} ${node.position.x},${node.position.y - 5}
                  Q ${node.position.x + node.size.width / 4},${node.position.y - 15} ${node.position.x + node.size.width / 2},${node.position.y - 5}
                  Q ${node.position.x + (3 * node.size.width) / 4},${node.position.y - 15} ${node.position.x + node.size.width},${node.position.y - 5}
                  Q ${node.position.x + node.size.width + 10},${node.position.y} ${node.position.x + node.size.width},${node.position.y + 10}
                  L ${node.position.x + node.size.width},${node.position.y + node.size.height - 10}
                  Q ${node.position.x + node.size.width + 10},${node.position.y + node.size.height} ${node.position.x + node.size.width},${node.position.y + node.size.height + 5}
                  Q ${node.position.x + (3 * node.size.width) / 4},${node.position.y + node.size.height + 15} ${node.position.x + node.size.width / 2},${node.position.y + node.size.height + 5}
                  Q ${node.position.x + node.size.width / 4},${node.position.y + node.size.height + 15} ${node.position.x},${node.position.y + node.size.height + 5}
                  Q ${node.position.x - 10},${node.position.y + node.size.height} ${node.position.x},${node.position.y + node.size.height - 10}
                  Z`}
              fill="white"
              stroke="#3b82f6"
              strokeWidth="2"
            />
          ) : (
            <rect
              x={node.position.x}
              y={node.position.y}
              width={node.size.width}
              height={node.size.height}
              fill="white"
              stroke="#3b82f6"
              strokeWidth="2"
              rx="4"
            />
          )}
          <text
            x={node.position.x + node.size.width / 2}
            y={node.position.y + node.size.height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#1f2937"
            fontSize="14"
            fontWeight="500"
          >
            {node.label}
          </text>
        </g>
      ))}
      {/* Render edges */}
      {diagram.edges.map((edge, idx) => {
        const fromNode = diagram.nodes.find(n => n.id === edge.from);
        const toNode = diagram.nodes.find(n => n.id === edge.to);
        if (!fromNode || !toNode) return null;

        const fromX = fromNode.position.x + fromNode.size.width / 2;
        const fromY = fromNode.position.y + fromNode.size.height / 2;
        const toX = toNode.position.x + toNode.size.width / 2;
        const toY = toNode.position.y + toNode.size.height / 2;

        const strokeWidth = edge.style === 'bold' ? 4 : edge.style === 'solid' ? 1.6 : 1.2;
        const strokeDasharray = edge.style === 'dashed' ? '5,5' : undefined;

        return (
          <g key={idx}>
            <line
              x1={fromX}
              y1={fromY}
              x2={toX}
              y2={toY}
              stroke="#6b7280"
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
            />
            {edge.label && (
              <text
                x={(fromX + toX) / 2}
                y={(fromY + toY) / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#374151"
                fontSize="12"
                fontWeight="500"
                style={{ pointerEvents: 'none' }}
              >
                {edge.label}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
};

// Helper component: Mermaid Diagram Renderer
const MermaidDiagramRenderer: React.FC<{ diagram: MermaidDiagram }> = ({ diagram }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !diagram.mermaidCode) return;

    const renderDiagram = async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose'
        });

        const uniqueId = `mermaid-review-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(uniqueId, diagram.mermaidCode);

        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          setRenderError(null);
        }
      } catch (error: any) {
        console.error('Mermaid render error:', error);
        setRenderError(error.message || 'Failed to render diagram');
      }
    };

    renderDiagram();
  }, [diagram.mermaidCode]);

  if (renderError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-sm text-red-800">⚠️ Diagram rendering error: {renderError}</p>
        <pre className="mt-2 text-xs font-mono text-red-700 whitespace-pre-wrap">{diagram.mermaidCode}</pre>
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full flex items-center justify-center" />;
};

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
  const [debugMode, setDebugMode] = useState(false);

  const selectedApproval = pendingApprovals.find((a) => a.id === selectedApprovalId);

  if (!isOpen) return null;

  const handleApprove = (approval: PendingApproval) => {
    console.log('🔍 handleApprove called with:', {
      approvalId: approval.id,
      type: approval.type,
      hasOriginalContent: !!approval.originalContent,
      hasGeneratedContent: !!approval.generatedContent,
      originalLength: approval.originalContent?.length,
      generatedLength: typeof approval.generatedContent === 'string' ? approval.generatedContent.length : 'not-string',
    });

    try {
      // Apply the generated content
      if (approval.type === 'section' || approval.type === 'document' || approval.type === 'refinement') {
        console.log('✅ Type check passed, applying specification changes');
        // For specification content (section generation, document generation, or refinement)
        const currentMarkdown = approval.originalContent || '';
        const newMarkdown = approval.generatedContent;

        console.log('📝 Calling updateSpecification with', typeof newMarkdown === 'string' ? newMarkdown.length : 'not-string', 'characters');
        updateSpecification(newMarkdown);
        console.log('✅ updateSpecification completed');

        // Create snapshot
        createSnapshot(
          approval.type === 'refinement' ? 'refinement' : 'ai-generation',
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
    } catch (error) {
      console.error('❌ Error applying approval:', error);
      // Show error to user but still remove approval
      alert(`Error applying changes: ${error instanceof Error ? error.message : 'Unknown error'}. The approval will be removed from the queue.`);
    } finally {
      // Always remove from pending list, even if there was an error
      // This prevents approvals from getting stuck in the queue
      removeApproval(approval.id);
      console.log(`✅ Removed approval ${approval.id} from pending list`);
    }

    // Clear selection and feedback
    setSelectedApprovalId(null);
    setFeedback('');
  };

  const handleReject = (approval: PendingApproval) => {
    if (!feedback.trim()) {
      alert('Please provide feedback on why you are rejecting this content.');
      return;
    }

    // Mark as rejected in store
    rejectContent(approval.id, feedback);

    // Remove from pending list immediately (no delay to prevent double-rejection)
    removeApproval(approval.id);
    console.log(`❌ Removed rejected approval ${approval.id} from pending list`);

    // Clear selection and feedback
    setSelectedApprovalId(null);
    setFeedback('');
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
      case 'cascaded-refinement':
        return 'Cascaded Refinement';
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
      case 'cascaded-refinement':
        return 'bg-orange-100 text-orange-700';
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
              selectedApproval.type === 'cascaded-refinement' ? (
                // Cascaded Refinement - Use specialized panel
                <CascadedRefinementReviewPanel
                  approval={selectedApproval as CascadedRefinementApproval}
                  onApply={async (selectedChanges: PropagatedChange[]) => {
                    // Apply primary change and selected propagated changes
                    const cascadeData = (selectedApproval as CascadedRefinementApproval).generatedContent;
                    const { primaryChange } = cascadeData;

                    let updatedMarkdown = selectedApproval.originalContent || '';

                    console.log('🔄 Starting cascade refinement application...');
                    console.log('📄 Original document:', updatedMarkdown.length, 'chars');
                    console.log('🎯 Primary change section:', primaryChange.sectionId);
                    console.log('🔀 Propagated changes selected:', selectedChanges.length);

                    // Import safe replacement functions
                    const { replaceSectionById, removeSectionById } = await import('../../services/ai/prompts/refinementPrompts');

                    // Apply primary change first using SAFE section replacement
                    const primaryReplaced = replaceSectionById(
                      updatedMarkdown,
                      primaryChange.sectionId,
                      primaryChange.refinedContent
                    );

                    if (!primaryReplaced) {
                      alert(`Failed to apply primary change to section ${primaryChange.sectionId}. The section may not exist in the document.`);
                      return;
                    }

                    updatedMarkdown = primaryReplaced;
                    console.log('✅ Primary change applied. Document now:', updatedMarkdown.length, 'chars');

                    // Apply selected propagated changes using SAFE section operations
                    for (const change of selectedChanges) {
                      if (change.actionType === 'REMOVE_SECTION') {
                        console.log(`🗑️  Removing section ${change.sectionId}: ${change.sectionTitle}`);
                        const removed = removeSectionById(updatedMarkdown, change.sectionId);
                        if (!removed) {
                          console.error(`❌ Failed to remove section ${change.sectionId}`);
                          alert(`Failed to remove section ${change.sectionId}: ${change.sectionTitle}. Continuing with other changes.`);
                          continue;
                        }
                        updatedMarkdown = removed;
                        console.log(`✅ Section ${change.sectionId} removed. Document now:`, updatedMarkdown.length, 'chars');
                      } else if (change.actionType === 'MODIFY_SECTION') {
                        console.log(`📝 Modifying section ${change.sectionId}: ${change.sectionTitle}`);
                        const replaced = replaceSectionById(
                          updatedMarkdown,
                          change.sectionId,
                          change.proposedContent
                        );
                        if (!replaced) {
                          console.error(`❌ Failed to modify section ${change.sectionId}`);
                          alert(`Failed to modify section ${change.sectionId}: ${change.sectionTitle}. Continuing with other changes.`);
                          continue;
                        }
                        updatedMarkdown = replaced;
                        console.log(`✅ Section ${change.sectionId} modified. Document now:`, updatedMarkdown.length, 'chars');
                      }
                    }

                    console.log('✅ All changes applied successfully. Final document:', updatedMarkdown.length, 'chars');

                    // Update specification
                    updateSpecification(updatedMarkdown);

                    // Create snapshot
                    createSnapshot(
                      'ai-refinement',
                      `Applied cascaded refinement: ${primaryChange.sectionTitle}`,
                      'ai',
                      {
                        relatedApprovalId: selectedApproval.id,
                        tokensUsed: cascadeData.tokensUsed,
                        costIncurred: cascadeData.costIncurred
                      }
                    );

                    // Mark as approved and remove
                    approveContent(selectedApproval.id);
                    setTimeout(() => {
                      removeApproval(selectedApproval.id);
                      setSelectedApprovalId(null);
                    }, 500);
                  }}
                  onReject={() => {
                    rejectContent(selectedApproval.id, 'User rejected cascaded refinement');
                    setTimeout(() => {
                      removeApproval(selectedApproval.id);
                      setSelectedApprovalId(null);
                    }, 500);
                  }}
                  onCancel={() => {
                    setSelectedApprovalId(null);
                  }}
                />
              ) : (
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
                  <div className="flex gap-3">
                    {selectedApproval.originalContent && (
                      <button
                        onClick={() => setShowDiff(!showDiff)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {showDiff ? 'Hide Diff' : 'Show Diff'}
                      </button>
                    )}
                    <button
                      onClick={() => setDebugMode(!debugMode)}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      {debugMode ? 'Hide Debug' : 'Show Debug Info'}
                    </button>
                  </div>
                </div>

                {/* Debug Info Panel */}
                {debugMode && (
                  <div className="border-2 border-purple-300 rounded-lg p-4 bg-purple-50 space-y-4">
                    <h4 className="text-sm font-bold text-purple-900 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                      Debug Information
                    </h4>

                    {/* Statistics */}
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="bg-white p-3 rounded border border-purple-200">
                        <div className="text-purple-600 font-semibold mb-1">Original Length</div>
                        <div className="text-2xl font-bold text-gray-800">
                          {selectedApproval.originalContent?.length || 0}
                        </div>
                        <div className="text-gray-500 mt-1">
                          {selectedApproval.originalContent?.split('\n').length || 0} lines
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded border border-purple-200">
                        <div className="text-purple-600 font-semibold mb-1">Generated Length</div>
                        <div className="text-2xl font-bold text-gray-800">
                          {typeof selectedApproval.generatedContent === 'string'
                            ? selectedApproval.generatedContent.length
                            : JSON.stringify(selectedApproval.generatedContent).length}
                        </div>
                        <div className="text-gray-500 mt-1">
                          {typeof selectedApproval.generatedContent === 'string'
                            ? selectedApproval.generatedContent.split('\n').length
                            : 'N/A'} lines
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded border border-purple-200">
                        <div className="text-purple-600 font-semibold mb-1">Size Change</div>
                        <div className={`text-2xl font-bold ${
                          (typeof selectedApproval.generatedContent === 'string'
                            ? selectedApproval.generatedContent.length
                            : 0) > (selectedApproval.originalContent?.length || 0)
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}>
                          {typeof selectedApproval.generatedContent === 'string' && selectedApproval.originalContent
                            ? ((selectedApproval.generatedContent.length - selectedApproval.originalContent.length) > 0 ? '+' : '')
                            + (selectedApproval.generatedContent.length - selectedApproval.originalContent.length)
                            : 'N/A'}
                        </div>
                        <div className="text-gray-500 mt-1">characters</div>
                      </div>
                    </div>

                    {/* Raw Content Tabs */}
                    <div className="space-y-2">
                      <div className="flex gap-2 text-xs font-semibold text-purple-800">
                        <div className="flex-1 bg-purple-100 px-3 py-2 rounded">Original Content (Raw)</div>
                        <div className="flex-1 bg-purple-100 px-3 py-2 rounded">Generated Content (Raw)</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {/* Original Content */}
                        <div className="bg-white border-2 border-purple-300 rounded p-3 max-h-96 overflow-auto">
                          <pre className="font-mono text-xs whitespace-pre-wrap break-all text-gray-700">
                            {selectedApproval.originalContent || '(No original content)'}
                          </pre>
                        </div>
                        {/* Generated Content */}
                        <div className="bg-white border-2 border-purple-300 rounded p-3 max-h-96 overflow-auto">
                          <pre className="font-mono text-xs whitespace-pre-wrap break-all text-gray-700">
                            {typeof selectedApproval.generatedContent === 'string'
                              ? selectedApproval.generatedContent
                              : JSON.stringify(selectedApproval.generatedContent, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>

                    {/* Placeholder Detection */}
                    {typeof selectedApproval.generatedContent === 'string' && (
                      <div className="bg-white border border-purple-200 rounded p-3">
                        <div className="text-xs font-semibold text-purple-900 mb-2">Placeholder Detection</div>
                        <div className="space-y-1 text-xs">
                          {[
                            /\[Previous sections? remains? unchanged\]/gi,
                            /\[Sections? \d+-\d+ remains? identical\]/gi,
                            /\[The rest remains? as before\]/gi,
                            /\[Note:.*?\]/gi,
                            /\[Continue with previous content\]/gi,
                            /\[Same as original\]/gi,
                          ].map((pattern, idx) => {
                            const matches = selectedApproval.generatedContent.match(pattern);
                            return (
                              <div key={idx} className={`flex items-center gap-2 ${matches ? 'text-red-700' : 'text-green-700'}`}>
                                {matches ? (
                                  <>
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    <span className="font-semibold">FOUND:</span> {pattern.source} ({matches.length} occurrence{matches.length > 1 ? 's' : ''})
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    <span>Clean: {pattern.source}</span>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="bg-white border border-purple-200 rounded p-3">
                      <div className="text-xs font-semibold text-purple-900 mb-2">Approval Metadata</div>
                      <pre className="font-mono text-xs text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify({
                          id: selectedApproval.id,
                          taskId: selectedApproval.taskId,
                          type: selectedApproval.type,
                          status: selectedApproval.status,
                          createdAt: selectedApproval.createdAt,
                          metadata: selectedApproval.metadata,
                        }, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Diff viewer (if applicable) */}
                {showDiff && selectedApproval.originalContent && !debugMode && (
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

                {/* Generated content preview - Always show for diagrams, conditionally for text */}
                {!debugMode && (selectedApproval.type === 'diagram' || !showDiff || !selectedApproval.originalContent) ? (
                  selectedApproval.type === 'diagram' ? (
                    // Render diagram with pan/zoom
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                      <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
                        <h4 className="text-sm font-semibold text-blue-900">
                          Generated Diagram Preview
                        </h4>
                        <p className="text-xs text-blue-700 mt-1">
                          Use scroll wheel to zoom, click and drag to pan (or spacebar + drag)
                        </p>
                        {selectedApproval.generatedContent?.sourceSection && (
                          <p className="text-xs text-blue-600 dark:text-blue-500 mt-1 font-medium">
                            📄 From: Section {selectedApproval.generatedContent.sourceSection.id} - {selectedApproval.generatedContent.sourceSection.title}
                          </p>
                        )}
                      </div>
                      <div className="bg-white" style={{ height: '500px' }}>
                        {(() => {
                          const diagram = selectedApproval.generatedContent;

                          // 🔍 DIAGNOSTIC LOGGING
                          console.log('🔍 Diagram Review Rendering:', {
                            hasNodes: !!diagram?.nodes,
                            isNodesArray: Array.isArray(diagram?.nodes),
                            nodesType: typeof diagram?.nodes,
                            nodesLength: Array.isArray(diagram?.nodes) ? diagram.nodes.length : 0,
                            hasEdges: !!diagram?.edges,
                            isEdgesArray: Array.isArray(diagram?.edges),
                            edgesLength: Array.isArray(diagram?.edges) ? diagram.edges.length : 0,
                            hasMermaidCode: !!diagram?.mermaidCode,
                            mermaidCodeType: typeof diagram?.mermaidCode,
                            mermaidCodeLength: diagram?.mermaidCode?.length || 0,
                            diagramKeys: diagram ? Object.keys(diagram) : []
                          });
                          console.log('📦 Full diagram object:', diagram);

                          // If nodes exists but isn't an array, log its structure
                          if (diagram?.nodes && !Array.isArray(diagram.nodes)) {
                            console.log('⚠️ NODES IS NOT AN ARRAY! Type:', typeof diagram.nodes);
                            console.log('⚠️ Nodes keys:', Object.keys(diagram.nodes));
                            console.log('⚠️ Nodes value:', diagram.nodes);
                          }

                          // Check if it's a block diagram (has nodes and edges)
                          // Handle both array format and object format for nodes
                          const hasNodes = diagram?.nodes && (Array.isArray(diagram.nodes) || typeof diagram.nodes === 'object');
                          const hasEdges = diagram?.edges && Array.isArray(diagram.edges);

                          if (hasNodes && hasEdges) {
                            // Block diagrams use PanZoomWrapper (SVG-based)
                            // Convert nodes from object to array if needed
                            let nodesArray = Array.isArray(diagram.nodes)
                              ? diagram.nodes
                              : Object.entries(diagram.nodes).map(([id, node]: [string, any]) => ({
                                  id,
                                  ...node
                                }));

                            console.log('✅ Rendering block diagram with', nodesArray.length, 'nodes and', diagram.edges.length, 'edges');
                            console.log('📍 First node (before normalization):', nodesArray[0]);

                            // Normalize nodes: add default position and size if missing
                            nodesArray = nodesArray.map((node, index) => {
                              const normalized = {
                                ...node,
                                position: node.position || { x: 100 + (index % 3) * 300, y: 100 + Math.floor(index / 3) * 200 },
                                size: node.size || { width: 200, height: 100 },
                                shape: node.shape || 'rect'
                              };
                              return normalized;
                            });

                            console.log('📍 First node (after normalization):', nodesArray[0]);

                            // Create normalized diagram object
                            const normalizedDiagram: BlockDiagram = {
                              ...diagram,
                              nodes: nodesArray
                            };

                            return (
                              <PanZoomWrapper>
                                <BlockDiagramRenderer diagram={normalizedDiagram} />
                              </PanZoomWrapper>
                            );
                          }
                          // Otherwise it's a Mermaid diagram (has mermaidCode string)
                          else if (typeof diagram?.mermaidCode === 'string' && diagram.mermaidCode.length > 0) {
                            console.log('✅ Rendering Mermaid diagram, code length:', diagram.mermaidCode.length);
                            console.log('📜 Mermaid code preview:', diagram.mermaidCode.substring(0, 200));
                            // Mermaid diagrams don't use PanZoomWrapper (HTML-based)
                            return <MermaidDiagramRenderer diagram={diagram as MermaidDiagram} />;
                          }
                          // Fallback to JSON for debugging
                          console.log('❌ Unknown diagram format, showing fallback');
                          return (
                            <div className="p-4">
                              <div className="mb-2 text-sm text-red-600">
                                ⚠️ Unknown diagram format. Showing raw data:
                              </div>
                              <pre className="font-mono text-xs whitespace-pre-wrap">
                                {JSON.stringify(diagram, null, 2)}
                              </pre>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    // Text content preview
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
                  )
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
              )
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
