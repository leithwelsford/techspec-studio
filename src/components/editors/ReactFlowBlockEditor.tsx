/**
 * React Flow Block Diagram Editor
 *
 * Replaces the custom SVG-based BlockDiagramEditor with React Flow (xyflow).
 * Provides drag-drop, resize, connect, and visual editing with the same
 * data model (BlockDiagram type) for backwards compatibility.
 *
 * Features:
 * - Drag nodes, resize, connect with handles
 * - Double-click to edit labels
 * - Node catalogue (telecom network elements)
 * - Edge labels with styles (bold, solid, dashed)
 * - SVG/PNG export
 * - B&W theme for technical diagrams
 */

import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  getSmoothStepPath,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useProjectStore } from '../../store/projectStore';
import type { NodeShape, NodeMeta, EdgeStyle, EdgeDef, BlockDiagram } from '../../types';

// ========== Node Catalogue ==========

const NODE_CATALOGUE: Array<{ id: string; label: string; shape: NodeShape; category: string }> = [
  { id: 'UE', label: 'UE/CPE', shape: 'rect', category: 'User' },
  { id: 'MME', label: 'MME', shape: 'rect', category: 'Core' },
  { id: 'HSS', label: 'HSS', shape: 'rect', category: 'Core' },
  { id: 'SGW', label: 'S-GW', shape: 'rect', category: 'Core' },
  { id: 'PGW', label: 'P-GW (PCEF)', shape: 'rect', category: 'Core' },
  { id: 'AMF', label: 'AMF', shape: 'rect', category: 'Core' },
  { id: 'SMF', label: 'SMF', shape: 'rect', category: 'Core' },
  { id: 'UPF', label: 'UPF', shape: 'rect', category: 'Core' },
  { id: 'PCRF', label: 'PCRF', shape: 'rect', category: 'Policy' },
  { id: 'PCF', label: 'PCF', shape: 'rect', category: 'Policy' },
  { id: 'OCS', label: 'OCS', shape: 'rect', category: 'Charging' },
  { id: 'OFCS', label: 'OFCS', shape: 'rect', category: 'Charging' },
  { id: 'CHF', label: 'CHF', shape: 'rect', category: 'Charging' },
  { id: 'TDF', label: 'TDF/SG', shape: 'rect', category: 'Traffic' },
  { id: 'SMP', label: 'SMP (Fixed)', shape: 'rect', category: 'Traffic' },
  { id: 'SMPM', label: 'SMP (Mobile)', shape: 'rect', category: 'Traffic' },
  { id: 'eNB', label: 'eNodeB', shape: 'rect', category: 'RAN' },
  { id: 'gNB', label: 'gNodeB', shape: 'rect', category: 'RAN' },
  { id: 'BNG', label: 'BNG/BRAS', shape: 'rect', category: 'Fixed' },
  { id: 'AAA', label: 'AAA Server', shape: 'rect', category: 'AAA' },
  { id: 'WLAN_AC', label: 'WLAN AC', shape: 'rect', category: 'WLAN' },
  { id: 'Internet', label: 'Internet', shape: 'cloud', category: 'External' },
  { id: 'IMS', label: 'IMS', shape: 'cloud', category: 'External' },
  { id: 'DN', label: 'Data Network', shape: 'cloud', category: 'External' },
];

const DEFAULT_SIZE: Record<NodeShape, { w: number; h: number }> = {
  rect: { w: 140, h: 44 },
  cloud: { w: 180, h: 72 },
};

// ========== Custom Node Components ==========

function RectNode({ data, selected }: { data: { label: string; onLabelChange?: (label: string) => void }; selected?: boolean }) {
  const handleDoubleClick = useCallback(() => {
    const newLabel = prompt('Edit node label:', data.label);
    if (newLabel !== null && newLabel.trim() && data.onLabelChange) {
      data.onLabelChange(newLabel.trim());
    }
  }, [data]);

  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{
        padding: '8px 16px',
        border: `2px solid ${selected ? '#2563eb' : '#000'}`,
        borderRadius: 4,
        background: '#fff',
        color: '#000',
        fontSize: 13,
        fontFamily: 'Calibri, Arial, sans-serif',
        fontWeight: 500,
        textAlign: 'center',
        minWidth: 80,
        cursor: 'grab',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#555', width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} id="left-target" style={{ background: '#555', width: 8, height: 8 }} />
      {data.label}
      <Handle type="source" position={Position.Bottom} style={{ background: '#555', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} id="right-source" style={{ background: '#555', width: 8, height: 8 }} />
    </div>
  );
}

function CloudNode({ data, selected }: { data: { label: string; onLabelChange?: (label: string) => void }; selected?: boolean }) {
  const handleDoubleClick = useCallback(() => {
    const newLabel = prompt('Edit node label:', data.label);
    if (newLabel !== null && newLabel.trim() && data.onLabelChange) {
      data.onLabelChange(newLabel.trim());
    }
  }, [data]);

  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{
        padding: '16px 24px',
        border: `2px solid ${selected ? '#2563eb' : '#000'}`,
        borderRadius: '50%',
        background: '#f5f5f5',
        color: '#000',
        fontSize: 13,
        fontFamily: 'Calibri, Arial, sans-serif',
        fontWeight: 500,
        textAlign: 'center',
        minWidth: 100,
        cursor: 'grab',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#555', width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} id="left-target" style={{ background: '#555', width: 8, height: 8 }} />
      {data.label}
      <Handle type="source" position={Position.Bottom} style={{ background: '#555', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} id="right-source" style={{ background: '#555', width: 8, height: 8 }} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  rect: RectNode,
  cloud: CloudNode,
};

// ========== Custom Edge with Label ==========

function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  style,
  markerEnd,
}: any) {
  const isOrthogonal = data?.orthogonal;
  const [edgePath, labelX, labelY] = isOrthogonal
    ? getSmoothStepPath({ sourceX, sourceY, targetX, targetY, borderRadius: 0 })
    : getStraightPath({ sourceX, sourceY, targetX, targetY });

  const edgeStyle = data?.edgeStyle || 'solid';
  const strokeWidth = edgeStyle === 'bold' ? 3 : edgeStyle === 'dashed' ? 1.2 : 1.6;
  const strokeDasharray = edgeStyle === 'dashed' ? '5,5' : undefined;
  const strokeColor = edgeStyle === 'dashed' ? '#666' : '#000';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray,
        }}
        markerEnd={markerEnd}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: '#fff',
              padding: '2px 6px',
              fontSize: 11,
              fontFamily: 'Calibri, Arial, sans-serif',
              color: '#000',
              border: '1px solid #ccc',
              borderRadius: 3,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
            onDoubleClick={() => {
              const newLabel = prompt('Edit edge label:', data.label);
              if (newLabel !== null && data.onLabelChange) {
                data.onLabelChange(newLabel);
              }
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const edgeTypes: EdgeTypes = {
  labeled: LabeledEdge,
};

// ========== Data Conversion ==========

function blockDiagramToFlow(diagram: BlockDiagram, onNodeLabelChange: (nodeId: string, label: string) => void, onEdgeLabelChange: (edgeIdx: number, label: string) => void, orthogonal: boolean): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = Object.entries(diagram.nodes).map(([nodeId, meta]) => {
    const pos = diagram.positions[nodeId] || { x: 100, y: 100 };
    const size = diagram.sizes[nodeId] || DEFAULT_SIZE[meta.shape];
    return {
      id: nodeId,
      type: meta.shape,
      position: { x: pos.x, y: pos.y },
      data: {
        label: meta.label,
        onLabelChange: (newLabel: string) => onNodeLabelChange(nodeId, newLabel),
      },
      style: { width: size.w, height: size.h },
    };
  });

  const edges: Edge[] = diagram.edges.map((edge, idx) => ({
    id: `e-${edge.from}-${edge.to}-${idx}`,
    source: edge.from,
    target: edge.to,
    type: 'labeled',
    data: {
      label: edge.label || '',
      edgeStyle: edge.style || 'solid',
      orthogonal,
      onLabelChange: (newLabel: string) => onEdgeLabelChange(idx, newLabel),
    },
  }));

  return { nodes, edges };
}

function flowToBlockDiagram(nodes: Node[], edges: Edge[]): Partial<BlockDiagram> {
  const newNodes: Record<string, NodeMeta> = {};
  const newPositions: Record<string, { x: number; y: number }> = {};
  const newSizes: Record<string, { w: number; h: number }> = {};

  for (const node of nodes) {
    newNodes[node.id] = {
      label: String(node.data?.label || ''),
      shape: (node.type as NodeShape) || 'rect',
    };
    newPositions[node.id] = { x: node.position.x, y: node.position.y };
    const shape = (node.type as NodeShape) || 'rect';
    const w = node.measured?.width || (node.style?.width as number) || DEFAULT_SIZE[shape].w;
    const h = node.measured?.height || (node.style?.height as number) || DEFAULT_SIZE[shape].h;
    newSizes[node.id] = { w, h };
  }

  const newEdges: EdgeDef[] = edges.map(e => ({
    from: e.source,
    to: e.target,
    label: (e.data?.label as string) || undefined,
    style: ((e.data?.edgeStyle as string) || 'solid') as EdgeStyle,
  }));

  return {
    nodes: newNodes,
    edges: newEdges,
    positions: newPositions,
    sizes: newSizes,
  };
}

// ========== Main Editor Component ==========

interface ReactFlowBlockEditorProps {
  diagramId: string;
}

function ReactFlowBlockEditorInner({ diagramId }: ReactFlowBlockEditorProps) {
  const diagram = useProjectStore(state =>
    state.project?.blockDiagrams.find(d => d.id === diagramId)
  );
  const updateBlockDiagram = useProjectStore(state => state.updateBlockDiagram);

  const [orthogonal, setOrthogonal] = useState(false);
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [catalogueFilter, setCatalogueFilter] = useState('');
  const reactFlowInstance = useReactFlow();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Convert BlockDiagram to React Flow format
  const onNodeLabelChange = useCallback((nodeId: string, label: string) => {
    if (!diagram) return;
    updateBlockDiagram(diagramId, {
      nodes: { ...diagram.nodes, [nodeId]: { ...diagram.nodes[nodeId], label } },
    });
  }, [diagram, diagramId, updateBlockDiagram]);

  const onEdgeLabelChange = useCallback((edgeIdx: number, label: string) => {
    if (!diagram) return;
    const newEdges = [...diagram.edges];
    newEdges[edgeIdx] = { ...newEdges[edgeIdx], label };
    updateBlockDiagram(diagramId, { edges: newEdges });
  }, [diagram, diagramId, updateBlockDiagram]);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!diagram) return { nodes: [], edges: [] };
    return blockDiagramToFlow(diagram, onNodeLabelChange, onEdgeLabelChange, orthogonal);
  }, [diagram?.id]); // Only recalculate on diagram change, not every render

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync from store when diagram changes externally
  useEffect(() => {
    if (!diagram) return;
    const { nodes: newNodes, edges: newEdges } = blockDiagramToFlow(
      diagram, onNodeLabelChange, onEdgeLabelChange, orthogonal
    );
    setNodes(newNodes);
    setEdges(newEdges);
  }, [diagram?.id, orthogonal]);

  // Debounced save to store
  const saveToStore = useCallback(() => {
    if (!diagram) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const currentNodes = reactFlowInstance.getNodes();
      const currentEdges = reactFlowInstance.getEdges();
      const updates = flowToBlockDiagram(currentNodes, currentEdges);
      updateBlockDiagram(diagramId, updates);
    }, 300);
  }, [diagram, diagramId, updateBlockDiagram, reactFlowInstance]);

  const handleNodesChange: OnNodesChange = useCallback((changes) => {
    onNodesChange(changes);
    // Save position/size changes
    const hasPositionChange = changes.some(c => c.type === 'position' && c.dragging === false);
    const hasDimensionChange = changes.some(c => c.type === 'dimensions');
    if (hasPositionChange || hasDimensionChange) {
      saveToStore();
    }
  }, [onNodesChange, saveToStore]);

  const handleEdgesChange: OnEdgesChange = useCallback((changes) => {
    onEdgesChange(changes);
    const hasRemoval = changes.some(c => c.type === 'remove');
    if (hasRemoval) {
      saveToStore();
    }
  }, [onEdgesChange, saveToStore]);

  const onConnect = useCallback((connection: Connection) => {
    const newEdge: Edge = {
      ...connection,
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      type: 'labeled',
      data: {
        label: '',
        edgeStyle: 'solid',
        orthogonal,
        onLabelChange: (_newLabel: string) => {},
      },
    } as Edge;
    setEdges(eds => addEdge(newEdge, eds));
    // Save after adding edge
    setTimeout(saveToStore, 50);
  }, [setEdges, orthogonal, saveToStore]);

  // Add node from catalogue
  const addNode = useCallback((catalogueItem: typeof NODE_CATALOGUE[0]) => {
    if (!diagram) return;
    // Generate unique ID
    const baseId = catalogueItem.id;
    const existingIds = Object.keys(diagram.nodes);
    let nodeId = baseId;
    let counter = 1;
    while (existingIds.includes(nodeId)) {
      counter++;
      nodeId = `${baseId}${counter}`;
    }

    const size = DEFAULT_SIZE[catalogueItem.shape];
    // Place in center of current viewport
    const position = reactFlowInstance.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    const newNode: Node = {
      id: nodeId,
      type: catalogueItem.shape,
      position,
      data: {
        label: catalogueItem.label,
        onLabelChange: (newLabel: string) => onNodeLabelChange(nodeId, newLabel),
      },
      style: { width: size.w, height: size.h },
    };

    setNodes(nds => [...nds, newNode]);

    // Update store
    updateBlockDiagram(diagramId, {
      nodes: { ...diagram.nodes, [nodeId]: { label: catalogueItem.label, shape: catalogueItem.shape } },
      positions: { ...diagram.positions, [nodeId]: position },
      sizes: { ...diagram.sizes, [nodeId]: size },
    });

    setShowCatalogue(false);
  }, [diagram, diagramId, updateBlockDiagram, setNodes, reactFlowInstance, onNodeLabelChange]);

  // Delete selected nodes/edges
  const deleteSelected = useCallback(() => {
    if (!diagram) return;
    const selectedNodes = nodes.filter(n => n.selected);
    const selectedEdges = edges.filter(e => e.selected);

    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

    const nodeIdsToRemove = new Set(selectedNodes.map(n => n.id));

    // Remove nodes
    const newNodes = { ...diagram.nodes };
    const newPositions = { ...diagram.positions };
    const newSizes = { ...diagram.sizes };
    for (const id of nodeIdsToRemove) {
      delete newNodes[id];
      delete newPositions[id];
      delete newSizes[id];
    }

    // Remove edges connected to deleted nodes + selected edges
    const selectedEdgeIndices = new Set(selectedEdges.map(e => {
      const match = e.id.match(/e-.*-(\d+)$/);
      return match ? parseInt(match[1]) : -1;
    }));
    const newEdges = diagram.edges.filter((edge, idx) =>
      !nodeIdsToRemove.has(edge.from) &&
      !nodeIdsToRemove.has(edge.to) &&
      !selectedEdgeIndices.has(idx)
    );

    updateBlockDiagram(diagramId, {
      nodes: newNodes,
      edges: newEdges,
      positions: newPositions,
      sizes: newSizes,
    });
  }, [diagram, diagramId, nodes, edges, updateBlockDiagram]);

  // Export SVG/PNG
  const handleExportSVG = useCallback(async () => {
    if (!diagram) return;
    const { renderBlockDiagramToSVG } = await import('../../utils/diagramExport');
    const svgText = await renderBlockDiagramToSVG(diagram);
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${diagram.title || 'diagram'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [diagram]);

  const handleExportPNG = useCallback(async () => {
    if (!diagram) return;
    const { renderBlockDiagramToSVG, svgToPng } = await import('../../utils/diagramExport');
    const svgText = await renderBlockDiagramToSVG(diagram);
    const pngBlob = await svgToPng(svgText, 2);
    if (pngBlob) {
      const url = URL.createObjectURL(pngBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${diagram.title || 'diagram'}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [diagram]);

  // Keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't delete if user is typing in an input
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
        deleteSelected();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deleteSelected]);

  if (!diagram) {
    return <div className="flex items-center justify-center h-full text-gray-500">Diagram not found</div>;
  }

  // Filter catalogue
  const filteredCatalogue = catalogueFilter
    ? NODE_CATALOGUE.filter(n =>
        n.label.toLowerCase().includes(catalogueFilter.toLowerCase()) ||
        n.category.toLowerCase().includes(catalogueFilter.toLowerCase())
      )
    : NODE_CATALOGUE;

  const categories = Array.from(new Set(filteredCatalogue.map(n => n.category)));

  return (
    <div className="h-full w-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
          {diagram.title}
        </span>
        <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />

        <button
          onClick={() => setShowCatalogue(!showCatalogue)}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add Node
        </button>

        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={orthogonal}
            onChange={e => setOrthogonal(e.target.checked)}
            className="rounded"
          />
          Orthogonal
        </label>

        <div className="flex-1" />

        <button
          onClick={deleteSelected}
          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
          title="Delete selected (Del)"
        >
          Delete
        </button>

        <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />

        <button onClick={handleExportSVG} className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          SVG
        </button>
        <button onClick={handleExportPNG} className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          PNG
        </button>
      </div>

      {/* Node catalogue dropdown */}
      {showCatalogue && (
        <div className="absolute top-12 left-3 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 w-64 max-h-80 overflow-y-auto">
          <input
            type="text"
            placeholder="Search nodes..."
            value={catalogueFilter}
            onChange={e => setCatalogueFilter(e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded mb-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
            autoFocus
          />
          {categories.map(cat => (
            <div key={cat}>
              <div className="text-xs font-semibold text-gray-400 uppercase mt-2 mb-1">{cat}</div>
              {filteredCatalogue.filter(n => n.category === cat).map(item => (
                <button
                  key={item.id}
                  onClick={() => addNode(item)}
                  className="w-full text-left px-2 py-1 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded flex items-center gap-2"
                >
                  <span className={`w-3 h-3 border border-gray-400 ${item.shape === 'cloud' ? 'rounded-full bg-gray-100' : 'bg-white'}`} />
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* React Flow Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{
            type: 'labeled',
          }}
          fitView
          snapToGrid
          snapGrid={[10, 10]}
          deleteKeyCode={null} // We handle delete ourselves
          style={{ background: '#fafafa' }}
        >
          <Background color="#ddd" gap={10} />
          <Controls />
          <MiniMap
            nodeColor={(n) => n.type === 'cloud' ? '#f5f5f5' : '#fff'}
            nodeStrokeColor="#000"
            nodeStrokeWidth={2}
            style={{ border: '1px solid #ccc' }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}

// Wrap with ReactFlowProvider
export default function ReactFlowBlockEditor(props: ReactFlowBlockEditorProps) {
  return (
    <ReactFlowProvider>
      <ReactFlowBlockEditorInner {...props} />
    </ReactFlowProvider>
  );
}
