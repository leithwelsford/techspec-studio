/**
 * BlockDiagramEditor Component
 *
 * Full-featured block diagram editor with pan/zoom, drag, resize, and edit capabilities.
 * Extracted from legacy App.tsx and integrated with Zustand store.
 *
 * Features:
 * - Pan/Zoom: Spacebar + drag, middle-click, or scroll wheel
 * - Node editing: Drag nodes, resize with corner handles, double-click to edit labels
 * - Edge editing: Double-click edge labels to edit, drag labels to reposition
 * - Snap-to-grid: Toggle for precise alignment
 * - Orthogonal connectors: Toggle for right-angle edges
 * - Export: SVG and PNG export
 */

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { usePanZoom } from '../../hooks/usePanZoom';
import type { NodeShape, NodeMeta, Point, Size, EdgeStyle, EdgeDef } from '../../types';

interface BlockDiagramEditorProps {
  diagramId: string;
}

// Constants
const GRID = 10;
const MIN_W = 60;
const MIN_H = 28;
const CANVAS_W = 1800;
const CANVAS_H = 900;

// Node catalogue for common 5G network elements
const NODE_CATALOGUE: Array<{ id: string; label: string; shape: NodeShape; category: string }> = [
  // User Equipment
  { id: 'UE', label: 'UE/CPE', shape: 'rect', category: 'User' },

  // Core Network (EPC/5GC)
  { id: 'MME', label: 'MME', shape: 'rect', category: 'Core' },
  { id: 'HSS', label: 'HSS', shape: 'rect', category: 'Core' },
  { id: 'SGW', label: 'S-GW', shape: 'rect', category: 'Core' },
  { id: 'PGW', label: 'P-GW (PCEF)', shape: 'rect', category: 'Core' },
  { id: 'AMF', label: 'AMF', shape: 'rect', category: 'Core' },
  { id: 'SMF', label: 'SMF', shape: 'rect', category: 'Core' },
  { id: 'UPF', label: 'UPF', shape: 'rect', category: 'Core' },

  // Policy & Charging
  { id: 'PCRF', label: 'PCRF', shape: 'rect', category: 'Policy' },
  { id: 'PCF', label: 'PCF', shape: 'rect', category: 'Policy' },
  { id: 'OCS', label: 'OCS', shape: 'rect', category: 'Charging' },
  { id: 'OFCS', label: 'OFCS', shape: 'rect', category: 'Charging' },
  { id: 'CHF', label: 'CHF', shape: 'rect', category: 'Charging' },

  // Traffic Detection & Control
  { id: 'TDF', label: 'TDF/SG', shape: 'rect', category: 'Traffic' },
  { id: 'SMP', label: 'SMP (Fixed)', shape: 'rect', category: 'Traffic' },
  { id: 'SMPM', label: 'SMP (Mobile)', shape: 'rect', category: 'Traffic' },

  // Access Network
  { id: 'eNB', label: 'eNodeB', shape: 'rect', category: 'RAN' },
  { id: 'gNB', label: 'gNodeB', shape: 'rect', category: 'RAN' },
  { id: 'BNG', label: 'BNG/BRAS', shape: 'rect', category: 'Fixed' },

  // External Networks
  { id: 'Internet', label: 'Internet', shape: 'cloud', category: 'External' },
  { id: 'IMS', label: 'IMS', shape: 'cloud', category: 'External' },
  { id: 'DN', label: 'Data Network', shape: 'cloud', category: 'External' },
];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const snap = (v: number, g = GRID) => Math.round(v / g) * g;
const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

const DEFAULT_SIZE: Record<NodeShape, Size> = {
  rect: { w: 140, h: 44 },
  cloud: { w: 180, h: 72 },
};

// Cloud shape path generator
function cloudPath(w: number, h: number) {
  const r = Math.min(w, h) / 6;
  const x = 0,
    y = 0;
  return `M ${x + r},${y + h * 0.6}
          C ${x - r},${y + h * 0.6} ${x - r},${y + h * 0.2} ${x + w * 0.2},${y + h * 0.2}
          C ${x + w * 0.2},${y} ${x + w * 0.5},${y} ${x + w * 0.5},${y + h * 0.2}
          C ${x + w * 0.7},${y} ${x + w},${y + h * 0.2} ${x + w * 0.8},${y + h * 0.4}
          C ${x + w * 1.1},${y + h * 0.5} ${x + w * 0.9},${y + h} ${x + w * 0.5},${y + h}
          C ${x + w * 0.3},${y + h} ${x + w * 0.15},${y + h * 0.8} ${x + r},${y + h * 0.6} Z`;
}

// Node Component
function Node({
  id,
  meta,
  pos,
  size,
  onMove,
  onResize,
  onEditLabel,
  snapToGrid,
  isSelected,
  isEdgeSource,
  onSelect,
  onClickForEdge,
}: {
  id: string;
  meta: NodeMeta;
  pos: Point;
  size: Size;
  onMove: (id: string, p: Point) => void;
  onResize: (id: string, sz: Size) => void;
  onEditLabel: (id: string, label: string) => void;
  snapToGrid: boolean;
  isSelected?: boolean;
  isEdgeSource?: boolean;
  onSelect?: (id: string) => void;
  onClickForEdge?: (id: string) => void;
}) {
  const [drag, setDrag] = useState<null | { x: number; y: number; ox: number; oy: number }>(null);
  const [resizing, setResizing] = useState<null | {
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    ow: number;
    oh: number;
    handle: 'nw' | 'ne' | 'se' | 'sw';
  }>(null);
  const [hover, setHover] = useState(false);

  const s = size || DEFAULT_SIZE[meta.shape];

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement)?.dataset?.handle) return; // resizing takes precedence

    // Handle edge creation mode
    if (onClickForEdge) {
      onClickForEdge(id);
      e.stopPropagation();
      return;
    }

    // Select node
    onSelect?.(id);

    setDrag({ x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y });
    (e.currentTarget as any).setPointerCapture?.((e as any).pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      const nx = snapToGrid ? snap(drag.ox + dx) : drag.ox + dx;
      const ny = snapToGrid ? snap(drag.oy + dy) : drag.oy + dy;
      onMove(id, { x: nx, y: ny });
    } else if (resizing) {
      const dx = e.clientX - resizing.sx;
      const dy = e.clientY - resizing.sy;
      let w = resizing.ow;
      let h = resizing.oh;
      let x = resizing.ox;
      let y = resizing.oy;
      switch (resizing.handle) {
        case 'se':
          w = Math.max(MIN_W, resizing.ow + dx);
          h = Math.max(MIN_H, resizing.oh + dy);
          break;
        case 'ne':
          w = Math.max(MIN_W, resizing.ow + dx);
          h = Math.max(MIN_H, resizing.oh - dy);
          y = resizing.oy + (resizing.oh - h);
          break;
        case 'sw':
          w = Math.max(MIN_W, resizing.ow - dx);
          h = Math.max(MIN_H, resizing.oh + dy);
          x = resizing.ox + (resizing.ow - w);
          break;
        case 'nw':
          w = Math.max(MIN_W, resizing.ow - dx);
          h = Math.max(MIN_H, resizing.oh - dy);
          x = resizing.ox + (resizing.ow - w);
          y = resizing.oy + (resizing.oh - h);
          break;
      }
      onResize(id, { w, h });
      onMove(id, { x, y });
    }
  };

  const onPointerUp = () => {
    setDrag(null);
    setResizing(null);
  };

  const HANDLE = 6;
  const corner: Record<'nw' | 'ne' | 'se' | 'sw', { x: number; y: number; cursor: string }> = {
    nw: { x: -HANDLE / 2, y: -HANDLE / 2, cursor: 'nwse-resize' },
    ne: { x: s.w - HANDLE / 2, y: -HANDLE / 2, cursor: 'nesw-resize' },
    se: { x: s.w - HANDLE / 2, y: s.h - HANDLE / 2, cursor: 'nwse-resize' },
    sw: { x: -HANDLE / 2, y: s.h - HANDLE / 2, cursor: 'nesw-resize' },
  };

  const handleRect = (key: 'nw' | 'ne' | 'se' | 'sw') => (
    <rect
      key={key}
      x={corner[key].x}
      y={corner[key].y}
      width={HANDLE}
      height={HANDLE}
      rx={1}
      ry={1}
      data-handle={key}
      fill="#111827"
      fillOpacity={hover ? 0.25 : 0}
      stroke="#111827"
      strokeOpacity={hover ? 0.25 : 0}
      strokeWidth={0.75}
      style={{ cursor: corner[key].cursor }}
      onPointerDown={(e) => {
        e.stopPropagation();
        setResizing({
          handle: key,
          sx: (e as any).clientX,
          sy: (e as any).clientY,
          ox: pos.x,
          oy: pos.y,
          ow: s.w,
          oh: s.h,
        });
        (e.currentTarget as any).setPointerCapture?.((e as any).pointerId);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );

  const strokeColor = isEdgeSource ? '#3b82f6' : isSelected ? '#10b981' : '#111827';
  const strokeWidth = isEdgeSource ? 3 : isSelected ? 2.5 : 1;
  const fillColor = isEdgeSource ? '#dbeafe' : isSelected ? '#d1fae5' : '#fff';

  return (
    <g
      transform={`translate(${pos.x},${pos.y})`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ cursor: onClickForEdge ? 'pointer' : drag ? 'grabbing' : 'grab' }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        const v = prompt('Node label', meta.label);
        if (v != null) onEditLabel(id, v);
      }}
    >
      {meta.shape === 'rect' ? (
        <rect width={s.w} height={s.h} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />
      ) : (
        <path d={cloudPath(s.w, s.h)} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />
      )}
      <text x={s.w / 2} y={s.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#111827">
        {meta.label}
      </text>
      {(['nw', 'ne', 'se', 'sw'] as const).map(handleRect)}
    </g>
  );
}

// Edge Component - uses CSS classes for dark mode support
function Edge({
  a,
  b,
  style,
  orthogonal,
}: {
  a: Point;
  b: Point;
  label?: string;
  style?: EdgeStyle;
  orthogonal: boolean;
}) {
  const dash = style === 'dashed' ? '6,6' : undefined;
  const strokeWidth = style === 'bold' ? 4 : style === 'solid' ? 1.6 : 1.2;
  // Use CSS classes for dark mode - stroke-slate-700 in light, stroke-slate-400 in dark
  const strokeClass = style === 'dashed' ? 'stroke-gray-500 dark:stroke-slate-400' : 'stroke-slate-700 dark:stroke-slate-400';

  if (!orthogonal) {
    return (
      <g>
        {style === 'bold' && (
          <line
            x1={a.x}
            y1={a.y + 2}
            x2={b.x}
            y2={b.y + 2}
            className={strokeClass}
            strokeWidth={strokeWidth + 2}
            strokeOpacity={0.25}
          />
        )}
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={strokeClass} strokeWidth={strokeWidth} strokeDasharray={dash} />
      </g>
    );
  }

  // Right-angle connector: horizontal then vertical
  const midx = (a.x + b.x) / 2;
  return (
    <g>
      <polyline
        points={`${a.x},${a.y} ${midx},${a.y} ${midx},${b.y} ${b.x},${b.y}`}
        fill="none"
        className={strokeClass}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
      />
    </g>
  );
}

export default function BlockDiagramEditor({ diagramId }: BlockDiagramEditorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const diagram = useProjectStore((state) => state.project?.blockDiagrams.find((d) => d.id === diagramId));
  const updateBlockDiagram = useProjectStore((state) => state.updateBlockDiagram);

  const [snapToGrid, setSnapToGrid] = useState(true);
  const [orthogonal, setOrthogonal] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [addNodeMode, setAddNodeMode] = useState<NodeMeta | null>(null);
  const [addEdgeMode, setAddEdgeMode] = useState(false);
  const [edgeSourceNode, setEdgeSourceNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<number | null>(null);

  const { scale, setScale, offset, setOffset, onWheel, beginPan, movePan, endPan } = usePanZoom();

  if (!diagram) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Diagram not found: {diagramId}</p>
      </div>
    );
  }

  const { nodes, edges, positions, sizes, labelOffsets = {} } = diagram;

  // Helper: Get node center
  const nodeCenter = (id: string) => {
    const meta = nodes[id];
    const p = positions[id];
    const s = sizes[id] || DEFAULT_SIZE[meta?.shape || 'rect'];
    return { x: p.x + s.w / 2, y: p.y + s.h / 2 };
  };

  // Compute edge endpoints
  const edgesWithPoints = useMemo(() => {
    return edges.map((e) => ({ ...e, a: nodeCenter(e.from), b: nodeCenter(e.to) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, positions, sizes, nodes]);

  // Label dragging
  const labelDrag = useRef<null | { idx: number; sx: number; sy: number; odx: number; ody: number }>(null);
  const beginLabelDrag = (idx: number, e: React.MouseEvent<SVGTextElement, MouseEvent>) => {
    e.stopPropagation();
    const key = String(idx);
    const off = labelOffsets[key] || { dx: 0, dy: 0 };
    labelDrag.current = { idx, sx: e.clientX, sy: e.clientY, odx: off.dx, ody: off.dy };
  };
  const moveLabelDrag = (e: React.MouseEvent) => {
    if (!labelDrag.current) return;
    const dx = e.clientX - labelDrag.current.sx;
    const dy = e.clientY - labelDrag.current.sy;
    const key = String(labelDrag.current.idx);
    const newOffset = {
      dx: snapToGrid ? snap(labelDrag.current.odx + dx) : labelDrag.current.odx + dx,
      dy: snapToGrid ? snap(labelDrag.current.ody + dy) : labelDrag.current.ody + dy,
    };
    updateBlockDiagram(diagramId, {
      labelOffsets: { ...labelOffsets, [key]: newOffset },
    });
  };
  const endLabelDrag = () => {
    labelDrag.current = null;
  };

  // Handlers
  const onMove = (id: string, p: Point) => {
    updateBlockDiagram(diagramId, {
      positions: { ...positions, [id]: p },
    });
  };

  const onResize = (id: string, sz: Size) => {
    updateBlockDiagram(diagramId, {
      sizes: { ...sizes, [id]: sz },
    });
  };

  const onEditNodeLabel = (id: string, label: string) => {
    updateBlockDiagram(diagramId, {
      nodes: { ...nodes, [id]: { ...nodes[id], label } },
    });
  };

  const onEditEdgeLabel = (idx: number, label: string) => {
    const newEdges = [...edges];
    newEdges[idx] = { ...newEdges[idx], label };
    updateBlockDiagram(diagramId, { edges: newEdges });
  };

  // Add node handler
  const onCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!addNodeMode) return;
    if ((e.target as SVGElement).tagName !== 'rect' || (e.target as SVGElement).id !== 'pan-surface') return;

    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;

    // Calculate click position in SVG coordinates
    const x = (e.clientX - svgRect.left - offset.x) / scale;
    const y = (e.clientY - svgRect.top - offset.y) / scale;

    // Generate unique ID
    const baseId = addNodeMode.label.replace(/[^a-zA-Z0-9]/g, '');
    let nodeId = baseId;
    let counter = 1;
    while (nodes[nodeId]) {
      nodeId = `${baseId}${counter}`;
      counter++;
    }

    // Add node at click position
    const newNodes = {
      ...nodes,
      [nodeId]: addNodeMode,
    };

    const newPositions = {
      ...positions,
      [nodeId]: { x: snapToGrid ? snap(x) : x, y: snapToGrid ? snap(y) : y },
    };

    const newSizes = {
      ...sizes,
      [nodeId]: DEFAULT_SIZE[addNodeMode.shape],
    };

    updateBlockDiagram(diagramId, {
      nodes: newNodes,
      positions: newPositions,
      sizes: newSizes,
    });

    setStatusMsg(`Added node: ${addNodeMode.label}`);
    setAddNodeMode(null);
  };

  // Delete node handler
  const deleteNode = (nodeId: string) => {
    if (!confirm(`Delete node "${nodes[nodeId]?.label || nodeId}"?`)) return;

    const newNodes = { ...nodes };
    const newPositions = { ...positions };
    const newSizes = { ...sizes };
    delete newNodes[nodeId];
    delete newPositions[nodeId];
    delete newSizes[nodeId];

    // Remove edges connected to this node
    const newEdges = edges.filter((e) => e.from !== nodeId && e.to !== nodeId);

    updateBlockDiagram(diagramId, {
      nodes: newNodes,
      positions: newPositions,
      sizes: newSizes,
      edges: newEdges,
    });

    setSelectedNode(null);
    setStatusMsg(`Deleted node: ${nodes[nodeId]?.label || nodeId}`);
  };

  // Add edge handler
  const onNodeClickForEdge = (nodeId: string) => {
    if (!addEdgeMode) return;

    if (!edgeSourceNode) {
      // First click: set source
      setEdgeSourceNode(nodeId);
      setStatusMsg(`Edge source: ${nodes[nodeId]?.label}. Click target node.`);
    } else {
      // Second click: create edge
      if (edgeSourceNode === nodeId) {
        setStatusMsg('Cannot connect node to itself');
        return;
      }

      // Check if edge already exists
      const edgeExists = edges.some((e) => e.from === edgeSourceNode && e.to === nodeId);
      if (edgeExists) {
        setStatusMsg('Edge already exists between these nodes');
        setEdgeSourceNode(null);
        return;
      }

      const newEdge: EdgeDef = {
        from: edgeSourceNode,
        to: nodeId,
        label: '',
        style: 'solid',
      };

      updateBlockDiagram(diagramId, {
        edges: [...edges, newEdge],
      });

      setStatusMsg(`Added edge: ${nodes[edgeSourceNode]?.label} → ${nodes[nodeId]?.label}`);
      setEdgeSourceNode(null);
      setAddEdgeMode(false);
    }
  };

  // Delete edge handler
  const deleteEdge = (edgeIdx: number) => {
    const edge = edges[edgeIdx];
    if (!confirm(`Delete edge "${edge.label || 'unlabeled'}" (${edge.from} → ${edge.to})?`)) return;

    const newEdges = edges.filter((_, i) => i !== edgeIdx);
    updateBlockDiagram(diagramId, { edges: newEdges });

    setSelectedEdge(null);
    setStatusMsg('Deleted edge');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keyboard shortcuts if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (isTyping) {
        return; // Let the input handle the key
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedNode) {
          deleteNode(selectedNode);
        } else if (selectedEdge !== null) {
          deleteEdge(selectedEdge);
        }
      } else if (e.key === 'Escape') {
        setAddNodeMode(null);
        setAddEdgeMode(false);
        setEdgeSourceNode(null);
        setSelectedNode(null);
        setSelectedEdge(null);
        setStatusMsg('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, selectedEdge]);

  // Get unique categories
  const categories = ['All', ...Array.from(new Set(NODE_CATALOGUE.map((n) => n.category)))];
  const filteredCatalogue =
    selectedCategory === 'All' ? NODE_CATALOGUE : NODE_CATALOGUE.filter((n) => n.category === selectedCategory);

  // Zoom controls
  const onZoomIn = () => setScale((s) => clamp(s + 0.1, 0.4, 3));
  const onZoomOut = () => setScale((s) => clamp(s - 0.1, 0.4, 3));
  const onResetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  // Export SVG
  const getSerializedSVG = (): string => {
    const svg = svgRef.current;
    if (!svg) throw new Error('SVG not ready');
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', String(CANVAS_W));
    clone.setAttribute('height', String(CANVAS_H));
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    while (clone.firstChild) g.appendChild(clone.firstChild);
    g.setAttribute('transform', `translate(${offset.x}, ${offset.y}) scale(${scale})`);
    clone.appendChild(g);

    const serializer = new XMLSerializer();
    const raw = serializer.serializeToString(clone);
    const header = '<?xml version="1.0" encoding="UTF-8"?>\n';
    return header + raw;
  };

  const onExportSVG = async () => {
    try {
      const svgText = getSerializedSVG();
      const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${diagram.title || 'block-diagram'}.svg`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
        } catch {}
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }, 0);
      setStatusMsg('Exported SVG successfully');
    } catch {
      setStatusMsg('SVG export failed');
    }
  };

  const onExportPNG = async () => {
    try {
      const svgText = getSerializedSVG();
      const img = new Image();
      const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = svgUrl;
      });
      const scaleFactor = 2;
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W * scaleFactor;
      canvas.height = CANVAS_H * scaleFactor;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D not available');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b as Blob), 'image/png'));

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${diagram.title || 'block-diagram'}.png`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
        } catch {}
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }, 0);
      setStatusMsg('Exported PNG successfully');
    } catch {
      setStatusMsg('PNG export failed');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex-wrap bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <button
            onClick={onZoomOut}
            className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            −
          </button>
          <button
            onClick={onZoomIn}
            className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            +
          </button>
          <button
            onClick={onResetView}
            className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors text-sm"
          >
            Reset View
          </button>
          <span className="text-xs text-gray-500 ml-1">({Math.round(scale * 100)}%)</span>
        </div>

        <div className="h-6 w-px bg-gray-300" />

        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} />
          Snap to grid
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={orthogonal} onChange={(e) => setOrthogonal(e.target.checked)} />
          Orthogonal connectors
        </label>

        <div className="h-6 w-px bg-gray-300" />

        <button
          onClick={() => {
            setShowCatalogue(!showCatalogue);
            setAddNodeMode(null);
            setAddEdgeMode(false);
          }}
          className={`px-3 py-1.5 border rounded hover:bg-gray-50 transition-colors text-sm font-medium ${
            showCatalogue ? 'bg-blue-50 border-blue-400 text-blue-700' : 'border-gray-300'
          }`}
        >
          {showCatalogue ? 'Hide' : 'Add Node'}
        </button>

        <button
          onClick={() => {
            setAddEdgeMode(!addEdgeMode);
            setEdgeSourceNode(null);
            setAddNodeMode(null);
            setShowCatalogue(false);
          }}
          className={`px-3 py-1.5 border rounded hover:bg-gray-50 transition-colors text-sm font-medium ${
            addEdgeMode ? 'bg-purple-50 border-purple-400 text-purple-700' : 'border-gray-300'
          }`}
        >
          {addEdgeMode ? 'Cancel Edge' : 'Add Edge'}
        </button>

        {selectedNode && (
          <button
            onClick={() => deleteNode(selectedNode)}
            className="px-3 py-1.5 bg-red-50 border border-red-300 text-red-700 rounded hover:bg-red-100 transition-colors text-sm font-medium"
          >
            Delete Node
          </button>
        )}

        <div className="h-6 w-px bg-gray-300" />

        <button
          onClick={onExportSVG}
          className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors text-sm"
        >
          Export SVG
        </button>
        <button
          onClick={onExportPNG}
          className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors text-sm"
        >
          Export PNG
        </button>

        {statusMsg && (
          <div className="ml-auto text-xs text-gray-600 px-3 py-1 bg-gray-50 rounded border border-gray-200">
            {statusMsg}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Node Catalogue Sidebar */}
        {showCatalogue && (
          <div className="w-64 border-r border-gray-200 dark:border-slate-700 overflow-y-auto flex-shrink-0 bg-white dark:bg-slate-900">
            <div className="p-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-sm text-gray-900 mb-2">Node Catalogue</h3>
              <div className="flex flex-wrap gap-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-1 text-xs rounded ${
                      selectedCategory === cat
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-2 space-y-1">
              {filteredCatalogue.map((node) => (
                <button
                  key={node.id}
                  onClick={() => {
                    setAddNodeMode({ label: node.label, shape: node.shape });
                    setStatusMsg(`Click on canvas to place: ${node.label}`);
                  }}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    addNodeMode?.label === node.label
                      ? 'bg-blue-50 border border-blue-400 text-blue-700'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 flex items-center justify-center rounded ${
                      node.shape === 'cloud' ? 'bg-sky-100' : 'bg-gray-100'
                    }`}>
                      {node.shape === 'cloud' ? '☁' : '□'}
                    </span>
                    <span className="font-medium">{node.label}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 ml-8">{node.category}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Canvas */}
        <div
          className="flex-1 overflow-auto bg-gray-50 dark:bg-slate-800"
          onWheel={onWheel}
        onMouseMove={(e) => {
          movePan(e as any);
          moveLabelDrag(e as any);
        }}
        onMouseUp={() => {
          endPan();
          endLabelDrag();
        }}
        onMouseLeave={() => {
          endPan();
          endLabelDrag();
        }}
      >
        <svg
          ref={svgRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
          onMouseDown={beginPan}
          onClick={onCanvasClick}
        >
          {/* Pan surface - uses slate-800 (#1e293b) for dark mode compatibility */}
          <rect id="pan-surface" x={0} y={0} width={CANVAS_W} height={CANVAS_H} className="fill-gray-50 dark:fill-slate-800" style={{ cursor: addNodeMode ? 'crosshair' : 'default' }} />

          {/* Grid */}
          {Array.from({ length: Math.ceil(CANVAS_W / GRID) }, (_, i) => (
            <line
              key={`vg${i}`}
              x1={i * GRID}
              y1={0}
              x2={i * GRID}
              y2={CANVAS_H}
              className="stroke-gray-300 dark:stroke-slate-600"
              strokeWidth={i % 5 === 0 ? 0.8 : 0.4}
            />
          ))}
          {Array.from({ length: Math.ceil(CANVAS_H / GRID) }, (_, j) => (
            <line
              key={`hg${j}`}
              x1={0}
              y1={j * GRID}
              x2={CANVAS_W}
              y2={j * GRID}
              className="stroke-gray-300 dark:stroke-slate-600"
              strokeWidth={j % 5 === 0 ? 0.8 : 0.4}
            />
          ))}

          {/* Edges */}
          {edgesWithPoints.map((e: any, i: number) => (
            <Edge key={`edge-${i}`} a={e.a} b={e.b} label={e.label} style={e.style} orthogonal={orthogonal} />
          ))}

          {/* Nodes */}
          {Object.keys(nodes).map((id) => (
            <Node
              key={id}
              id={id}
              meta={nodes[id]}
              pos={positions[id]}
              size={sizes[id]}
              onMove={onMove}
              onResize={onResize}
              snapToGrid={snapToGrid}
              onEditLabel={onEditNodeLabel}
              isSelected={selectedNode === id}
              isEdgeSource={edgeSourceNode === id}
              onSelect={setSelectedNode}
              onClickForEdge={addEdgeMode ? onNodeClickForEdge : undefined}
            />
          ))}

          {/* Edge labels (draggable) */}
          {edgesWithPoints.map((e: any, i: number) => {
            const p = mid(e.a, e.b);
            const off = labelOffsets[String(i)] || { dx: 0, dy: 0 };
            const lbl = e.label || '';
            const isSelected = selectedEdge === i;
            return (
              <g key={`edge-label-${i}`}>
                {/* Clickable area for edge selection */}
                <rect
                  x={p.x + off.dx - 30}
                  y={p.y - 20 + off.dy}
                  width={60}
                  height={24}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setSelectedEdge(i);
                    setSelectedNode(null);
                  }}
                />
                {/* Highlight for selected edge */}
                {isSelected && (
                  <rect
                    x={p.x + off.dx - 32}
                    y={p.y - 22 + off.dy}
                    width={64}
                    height={28}
                    fill="#dcfce7"
                    stroke="#10b981"
                    strokeWidth={2}
                    rx={4}
                    opacity={0.5}
                  />
                )}
                {/* Label background for dark mode readability */}
                {lbl && (
                  <rect
                    x={p.x + off.dx - (lbl.length * 3.5)}
                    y={p.y - 18 + off.dy}
                    width={lbl.length * 7}
                    height={14}
                    className="fill-white/90 dark:fill-slate-700/90"
                    rx={2}
                  />
                )}
                <text
                  x={p.x + off.dx}
                  y={p.y - 8 + off.dy}
                  textAnchor="middle"
                  fontSize={11}
                  className="fill-slate-700 dark:fill-slate-200"
                  onDoubleClick={(ev) => {
                    (ev as any).stopPropagation();
                    const v = prompt('Connector label', lbl);
                    if (v != null) onEditEdgeLabel(i, v);
                  }}
                  onMouseDown={(ev) => beginLabelDrag(i, ev)}
                  style={{ userSelect: 'none', cursor: 'move' }}
                >
                  {lbl}
                </text>
                {/* Delete button for selected edge */}
                {isSelected && (
                  <g
                    onClick={(ev) => {
                      ev.stopPropagation();
                      deleteEdge(i);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle cx={p.x + off.dx + 35} cy={p.y - 8 + off.dy} r={8} fill="#ef4444" opacity={0.9} />
                    <text
                      x={p.x + off.dx + 35}
                      y={p.y - 8 + off.dy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={10}
                      fill="white"
                      fontWeight="bold"
                    >
                      ×
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-xs text-gray-600 dark:text-gray-400">
        <p>
          <strong>Controls:</strong> Spacebar/Middle-click to pan • Scroll to zoom • Drag nodes • Double-click to edit
          labels • Drag resize handles • Delete/Backspace to delete selection • Escape to cancel
        </p>
        {addNodeMode && (
          <p className="mt-1 text-blue-600">
            <strong>Add Node Mode:</strong> Click on the canvas to place "{addNodeMode.label}"
          </p>
        )}
        {addEdgeMode && (
          <p className="mt-1 text-purple-600">
            <strong>Add Edge Mode:</strong> {edgeSourceNode ? `Click target node to connect from ${nodes[edgeSourceNode]?.label}` : 'Click source node to start edge'}
          </p>
        )}
      </div>
    </div>
  );
}
