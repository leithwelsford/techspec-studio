/**
 * DiagramViewer Component
 * Displays all diagrams (block, sequence, flow) in a unified interface
 */

import { useState, useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import mermaid from 'mermaid';
import BlockDiagramEditor from './editors/BlockDiagramEditor';
import SequenceDiagramEditor from './editors/SequenceDiagramEditor';
import { GenerateDiagramsModal } from './ai/GenerateDiagramsModal';
import { GenerateDiagramFromTextModal } from './ai/GenerateDiagramFromTextModal';
import { PanZoomWrapper } from './PanZoomWrapper';
import { MermaidHealingModal } from './MermaidHealingModal';

type DiagramType = 'all' | 'block' | 'sequence' | 'flow';

export default function DiagramViewer() {
  const project = useProjectStore(state => state.project);
  const addBlockDiagram = useProjectStore(state => state.addBlockDiagram);
  const deleteBlockDiagram = useProjectStore(state => state.deleteBlockDiagram);
  const deleteMermaidDiagram = useProjectStore(state => state.deleteMermaidDiagram);
  const brsDocument = useProjectStore(state => state.getBRSDocument());
  const aiConfig = useProjectStore(state => state.aiConfig);

  const [selectedType, setSelectedType] = useState<DiagramType>('all');
  const [selectedDiagramId, setSelectedDiagramId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showNewDiagramModal, setShowNewDiagramModal] = useState(false);
  const [showGenerateDiagramsModal, setShowGenerateDiagramsModal] = useState(false);
  const [showGenerateFromTextModal, setShowGenerateFromTextModal] = useState(false);
  const [newDiagramTitle, setNewDiagramTitle] = useState('');
  const [newDiagramDescription, setNewDiagramDescription] = useState('');

  // Initialize Mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    });
  }, []);

  // Re-render Mermaid diagrams when selection changes
  useEffect(() => {
    mermaid.run();
  }, [selectedDiagramId, selectedType]);

  // Handle create new block diagram
  const handleCreateDiagram = () => {
    if (!newDiagramTitle.trim()) {
      alert('Please enter a diagram title');
      return;
    }

    const newDiagramId = addBlockDiagram({
      title: newDiagramTitle,
      description: newDiagramDescription,
      nodes: {},
      edges: [],
      positions: {},
      sizes: {},
    });

    setNewDiagramTitle('');
    setNewDiagramDescription('');
    setShowNewDiagramModal(false);
    setSelectedDiagramId(newDiagramId);
    setSelectedType('block');
    setEditMode(true);
  };

  // Handle delete diagram
  const handleDeleteDiagram = (diagramId: string, diagramType: 'block' | 'sequence' | 'flow') => {
    const diagram = allDiagrams.find(d => d.id === diagramId);
    if (!diagram) return;

    if (!confirm(`Delete diagram "${diagram.title}"? This cannot be undone.`)) return;

    if (diagramType === 'block') {
      deleteBlockDiagram(diagramId);
    } else {
      deleteMermaidDiagram(diagramId);
    }

    // Clear selection if deleting selected diagram
    if (selectedDiagramId === diagramId) {
      setSelectedDiagramId(null);
      setEditMode(false);
    }
  };

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800">
        <p>No project loaded</p>
      </div>
    );
  }

  const blockDiagrams = project.blockDiagrams || [];
  const sequenceDiagrams = project.sequenceDiagrams || [];
  const flowDiagrams = project.flowDiagrams || [];

  const allDiagrams = [
    ...blockDiagrams.map(d => ({ ...d, type: 'block' as const })),
    ...sequenceDiagrams.map(d => ({ ...d, type: 'sequence' as const })),
    ...flowDiagrams.map(d => ({ ...d, type: 'flow' as const }))
  ];

  const filteredDiagrams = selectedType === 'all'
    ? allDiagrams
    : allDiagrams.filter(d => d.type === selectedType);

  const selectedDiagram = selectedDiagramId
    ? allDiagrams.find(d => d.id === selectedDiagramId)
    : filteredDiagrams[0];

  const totalCount = allDiagrams.length;
  const blockCount = blockDiagrams.length;
  const sequenceCount = sequenceDiagrams.length;
  const flowCount = flowDiagrams.length;

  if (totalCount === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-gray-800">
        <div className="text-center max-w-md">
          <div className="text-gray-400 dark:text-gray-500 mb-4">
            <svg className="w-24 h-24 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Diagrams Yet</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Generate diagrams from your BRS document or create them manually.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Use the <strong className="text-purple-600 dark:text-purple-400">"Generate Diagrams"</strong> button in the header to auto-generate diagrams from your BRS.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Sidebar - Diagram List */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
        {/* Filter Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Diagrams</h3>
            <div className="flex gap-2">
              {/* AI from BRS button */}
              {brsDocument && (
                <button
                  onClick={() => setShowGenerateDiagramsModal(true)}
                  disabled={!aiConfig?.apiKey || !aiConfig.apiKey.trim()}
                  className="px-2 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-md hover:bg-purple-700 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={(!aiConfig?.apiKey || !aiConfig.apiKey.trim()) ? "Configure AI first" : "Generate diagrams from BRS"}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  BRS
                </button>
              )}

              {/* AI from Text button */}
              <button
                onClick={() => setShowGenerateFromTextModal(true)}
                disabled={!aiConfig?.apiKey || !aiConfig.apiKey.trim()}
                className="px-2 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-md hover:bg-purple-700 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                title={(!aiConfig?.apiKey || !aiConfig.apiKey.trim()) ? "Configure AI first" : "Generate diagram from text description"}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI
              </button>

              {/* Manual create button */}
              <button
                onClick={() => setShowNewDiagramModal(true)}
                className="px-2 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
                title="Create new block diagram manually"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                selectedType === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setSelectedType('block')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                selectedType === 'block'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Block ({blockCount})
            </button>
            <button
              onClick={() => setSelectedType('sequence')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                selectedType === 'sequence'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Sequence ({sequenceCount})
            </button>
            <button
              onClick={() => setSelectedType('flow')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                selectedType === 'flow'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Flow ({flowCount})
            </button>
          </div>
        </div>

        {/* Diagram List */}
        <div className="flex-1 overflow-y-auto">
          {filteredDiagrams.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
              No {selectedType} diagrams
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredDiagrams.map(diagram => (
                <div
                  key={diagram.id}
                  className={`relative group ${
                    selectedDiagram?.id === diagram.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600 dark:border-blue-400' : ''
                  }`}
                >
                  <button
                    onClick={() => setSelectedDiagramId(diagram.id)}
                    className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-start gap-3 pr-8">
                    {/* Type Badge */}
                    <span className={`mt-0.5 px-2 py-0.5 text-xs font-medium rounded ${
                      diagram.type === 'block'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                        : diagram.type === 'sequence'
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400'
                        : 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400'
                    }`}>
                      {diagram.type}
                    </span>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                        {diagram.title}
                      </h4>
                      {diagram.figureNumber && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Figure {diagram.figureNumber}
                        </p>
                      )}
                      {diagram.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                          {diagram.description}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDiagram(diagram.id, diagram.type);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-opacity"
                    title="Delete diagram"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Diagram Display */}
      <div className="flex-1 bg-gray-50 dark:bg-gray-900 overflow-hidden flex flex-col">
        {selectedDiagram ? (
          <>
            {/* Diagram Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {selectedDiagram.title}
                  </h2>
                  {selectedDiagram.figureNumber && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Figure {selectedDiagram.figureNumber}
                    </p>
                  )}
                  {selectedDiagram.sourceSection && (
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                      📄 From: Section {selectedDiagram.sourceSection.id} - {selectedDiagram.sourceSection.title}
                    </p>
                  )}
                  {selectedDiagram.description && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                      {selectedDiagram.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setEditMode(!editMode)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      editMode
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {editMode ? 'View Only' : 'Edit'}
                  </button>
                  <span className={`px-3 py-1 text-xs font-medium rounded ${
                    selectedDiagram.type === 'block'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                      : selectedDiagram.type === 'sequence'
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400'
                      : 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400'
                  }`}>
                    {selectedDiagram.type.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Diagram Content */}
            {editMode ? (
              <div className="flex-1 overflow-hidden">
                {selectedDiagram.type === 'block' ? (
                  <BlockDiagramEditor diagramId={selectedDiagram.id} />
                ) : selectedDiagram.type === 'sequence' ? (
                  <SequenceDiagramEditor diagramId={selectedDiagram.id} />
                ) : selectedDiagram.type === 'flow' ? (
                  <SequenceDiagramEditor diagramId={selectedDiagram.id} />
                ) : null}
              </div>
            ) : (
              <div className="flex-1 overflow-hidden">
                {selectedDiagram.type === 'block' ? (
                  <BlockDiagramRenderer diagram={selectedDiagram} />
                ) : (
                  <MermaidDiagramRenderer diagram={selectedDiagram} />
                )}
              </div>
            )}
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
            <p>Select a diagram to view</p>
          </div>
        )}
      </div>

      {/* New Diagram Modal */}
      {showNewDiagramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Create New Block Diagram</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="diagram-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title *
                </label>
                <input
                  id="diagram-title"
                  type="text"
                  value={newDiagramTitle}
                  onChange={(e) => setNewDiagramTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="e.g., System Architecture"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateDiagram();
                  }}
                />
              </div>

              <div>
                <label htmlFor="diagram-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description (optional)
                </label>
                <textarea
                  id="diagram-description"
                  value={newDiagramDescription}
                  onChange={(e) => setNewDiagramDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Brief description of the diagram"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateDiagram}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Create Diagram
              </button>
              <button
                onClick={() => {
                  setShowNewDiagramModal(false);
                  setNewDiagramTitle('');
                  setNewDiagramDescription('');
                }}
                className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Diagrams Modal (from BRS) */}
      <GenerateDiagramsModal
        isOpen={showGenerateDiagramsModal}
        onClose={() => setShowGenerateDiagramsModal(false)}
      />

      {/* Generate Diagram from Text Modal */}
      <GenerateDiagramFromTextModal
        isOpen={showGenerateFromTextModal}
        onClose={() => setShowGenerateFromTextModal(false)}
      />
    </div>
  );
}

/**
 * Block Diagram SVG Content (for use inside PanZoomWrapper or standalone SVG)
 */
function BlockDiagramContent({ diagram }: { diagram: any }) {
  const nodes = diagram.nodes || {};
  const edges = diagram.edges || [];
  const positions = diagram.positions || {};
  const sizes = diagram.sizes || {};

  return (
    <>
        {/* Render Edges */}
        {edges.map((edge: any, idx: number) => {
          const fromPos = positions[edge.from];
          const toPos = positions[edge.to];
          const fromSize = sizes[edge.from] || { w: 120, h: 60 };
          const toSize = sizes[edge.to] || { w: 120, h: 60 };

          if (!fromPos || !toPos) return null;

          const fromX = fromPos.x + fromSize.w / 2;
          const fromY = fromPos.y + fromSize.h / 2;
          const toX = toPos.x + toSize.w / 2;
          const toY = toPos.y + toSize.h / 2;

          const lineStyle = edge.style === 'bold'
            ? { strokeWidth: 3, stroke: '#4B5563' }
            : edge.style === 'dashed'
            ? { strokeWidth: 1.5, stroke: '#6B7280', strokeDasharray: '5,5' }
            : { strokeWidth: 2, stroke: '#6B7280' };

          return (
            <g key={`edge-${idx}`}>
              <line
                x1={fromX}
                y1={fromY}
                x2={toX}
                y2={toY}
                {...lineStyle}
                markerEnd="url(#arrowhead)"
              />
              {edge.label && (
                <text
                  x={(fromX + toX) / 2}
                  y={(fromY + toY) / 2 - 5}
                  textAnchor="middle"
                  className="text-xs fill-gray-700"
                  style={{ fontSize: '12px' }}
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Render Nodes */}
        {Object.entries(nodes).map(([nodeId, node]: [string, any]) => {
          const pos = positions[nodeId];
          const size = sizes[nodeId] || { w: 120, h: 60 };

          if (!pos) return null;

          return (
            <g key={`node-${nodeId}`}>
              {node.shape === 'cloud' ? (
                <>
                  <ellipse
                    cx={pos.x + size.w / 2}
                    cy={pos.y + size.h / 2}
                    rx={size.w / 2}
                    ry={size.h / 2}
                    fill="#E0F2FE"
                    stroke="#0EA5E9"
                    strokeWidth="2"
                  />
                  <text
                    x={pos.x + size.w / 2}
                    y={pos.y + size.h / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="font-medium fill-gray-900"
                    style={{ fontSize: '14px' }}
                  >
                    {node.label}
                  </text>
                </>
              ) : (
                <>
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={size.w}
                    height={size.h}
                    fill="#DBEAFE"
                    stroke="#3B82F6"
                    strokeWidth="2"
                    rx="4"
                  />
                  <text
                    x={pos.x + size.w / 2}
                    y={pos.y + size.h / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="font-medium fill-gray-900"
                    style={{ fontSize: '14px' }}
                  >
                    {node.label}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Arrow marker definition */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#6B7280" />
          </marker>
        </defs>
    </>
  );
}

/**
 * Block Diagram Renderer (with pan/zoom wrapper)
 * Renders block diagrams using custom SVG with pan and zoom controls
 */
function BlockDiagramRenderer({ diagram }: { diagram: any }) {
  return (
    <PanZoomWrapper>
      <BlockDiagramContent diagram={diagram} />
    </PanZoomWrapper>
  );
}

/**
 * Mermaid Diagram Renderer
 * Renders sequence and flow diagrams using Mermaid.js with pan/zoom
 */
function MermaidDiagramRenderer({ diagram }: { diagram: any }) {
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showHealingModal, setShowHealingModal] = useState(false);
  const updateMermaidDiagram = useProjectStore(state => state.updateMermaidDiagram);

  useEffect(() => {
    let mounted = true;

    // Render Mermaid to get SVG content
    const renderMermaid = async () => {
      try {
        setError('');
        const uniqueId = `mermaid-${diagram.id}-${Date.now()}`;
        const { svg } = await mermaid.render(uniqueId, diagram.mermaidCode);
        if (mounted) {
          setSvgContent(svg);
        }
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram');
          setSvgContent('');
        }
      }
    };

    renderMermaid();

    return () => {
      mounted = false;
    };
  }, [diagram.id, diagram.mermaidCode]);

  const handleFixApplied = (fixedCode: string) => {
    console.log('✅ Applying fixed Mermaid code to diagram:', diagram.id);
    updateMermaidDiagram(diagram.id, { mermaidCode: fixedCode });
    setShowHealingModal(false);
    setError(''); // Clear error after fix
  };

  const handleManualEdit = () => {
    // TODO: Switch to edit mode for this diagram
    console.log('User chose manual edit for diagram:', diagram.id);
    setShowHealingModal(false);
    alert('Manual editing: Please use the Edit button in the diagram list to edit this diagram.');
  };

  if (error) {
    return (
      <>
        <div className="flex flex-col justify-center items-center h-64 p-4 gap-4">
          <div className="text-red-500 dark:text-red-400 text-sm text-center">
            <div className="font-semibold mb-2">❌ Failed to render diagram</div>
            <div className="text-xs opacity-80 mb-4 whitespace-pre-wrap max-w-2xl">{error}</div>
            <button
              onClick={() => setShowHealingModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700"
            >
              🔧 Try Self-Healing
            </button>
          </div>
        </div>

        {/* Healing Modal */}
        <MermaidHealingModal
          isOpen={showHealingModal}
          onClose={() => setShowHealingModal(false)}
          invalidCode={diagram.mermaidCode}
          diagramId={diagram.id}
          diagramTitle={diagram.title}
          error={error}
          onFixed={handleFixApplied}
          onManualEdit={handleManualEdit}
        />
      </>
    );
  }

  if (!svgContent) {
    return (
      <div className="flex justify-center items-center h-64 text-gray-500">
        Rendering diagram...
      </div>
    );
  }

  return (
    <div className="mermaid-container w-full h-full">
      <PanZoomWrapper>
        <g dangerouslySetInnerHTML={{ __html: svgContent }} />
      </PanZoomWrapper>
    </div>
  );
}
