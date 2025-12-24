/**
 * InlineDiagramPreview Component
 *
 * Renders diagrams inline within the markdown preview.
 * Supports both custom block diagrams (SVG) and Mermaid diagrams.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useProjectStore } from '../store/projectStore';
import mermaid from 'mermaid';
import type { BlockDiagram, MermaidDiagram, NodeMeta, Point, Size, EdgeDef, EdgeStyle } from '../types';

interface InlineDiagramPreviewProps {
  diagramId: string;
  figureNumber?: string;
  title?: string;
  maxWidth?: number;
  showCaption?: boolean;
}

// Constants for block diagram rendering
const CANVAS_W = 1800;
const CANVAS_H = 900;
const DEFAULT_SIZE: Record<string, Size> = {
  rect: { w: 140, h: 44 },
  cloud: { w: 180, h: 72 },
};

// Cloud shape path generator
function cloudPath(w: number, h: number) {
  const r = Math.min(w, h) / 6;
  const x = 0, y = 0;
  return `M ${x + r},${y + h * 0.6}
          C ${x - r},${y + h * 0.6} ${x - r},${y + h * 0.2} ${x + w * 0.2},${y + h * 0.2}
          C ${x + w * 0.2},${y} ${x + w * 0.5},${y} ${x + w * 0.5},${y + h * 0.2}
          C ${x + w * 0.7},${y} ${x + w},${y + h * 0.2} ${x + w * 0.8},${y + h * 0.4}
          C ${x + w * 1.1},${y + h * 0.5} ${x + w * 0.9},${y + h} ${x + w * 0.5},${y + h}
          C ${x + w * 0.3},${y + h} ${x + w * 0.15},${y + h * 0.8} ${x + r},${y + h * 0.6} Z`;
}

// Calculate midpoint for edge labels
const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// Render a block diagram node
function BlockNode({ id, meta, pos, size }: {
  id: string;
  meta: NodeMeta;
  pos: Point;
  size: Size;
}) {
  const s = size || DEFAULT_SIZE[meta.shape] || DEFAULT_SIZE.rect;

  return (
    <g transform={`translate(${pos.x}, ${pos.y})`}>
      {meta.shape === 'cloud' ? (
        <path d={cloudPath(s.w, s.h)} fill="#ffffff" stroke="#000000" strokeWidth={1} />
      ) : (
        <rect
          x={0}
          y={0}
          width={s.w}
          height={s.h}
          fill="#ffffff"
          stroke="#000000"
          strokeWidth={1}
          rx={0}
        />
      )}
      <text
        x={s.w / 2}
        y={s.h / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={11}
        fill="#000000"
        fontWeight={400}
        fontFamily="Arial, Helvetica, sans-serif"
      >
        {meta.label}
      </text>
    </g>
  );
}

// Render an edge between nodes
function BlockEdge({ a, b, label, style }: {
  a: Point;
  b: Point;
  label?: string;
  style?: EdgeStyle;
}) {
  const strokeDasharray = style === 'dashed' ? '4,4' : undefined;
  const strokeWidth = style === 'bold' ? 1.5 : 1;
  const stroke = '#000000'; // Black for 3GPP-style diagrams
  const midPoint = mid(a, b);

  return (
    <g>
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        markerEnd="url(#arrowhead)"
      />
      {label && (
        <>
          {/* White background for label readability */}
          <rect
            x={midPoint.x - (label.length * 3) - 2}
            y={midPoint.y - 15}
            width={label.length * 6 + 4}
            height={14}
            fill="#ffffff"
            stroke="none"
          />
          <text
            x={midPoint.x}
            y={midPoint.y - 5}
            textAnchor="middle"
            fontSize={9}
            fill="#000000"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            {label}
          </text>
        </>
      )}
    </g>
  );
}

// Render a block diagram as SVG
function BlockDiagramPreview({ diagram, maxWidth = 800 }: { diagram: BlockDiagram; maxWidth?: number }) {
  const { nodes, edges, positions, sizes, labelOffsets } = diagram;

  // Calculate bounding box of all nodes
  const bounds = useMemo(() => {
    const nodeIds = Object.keys(nodes);
    if (nodeIds.length === 0) return { minX: 0, minY: 0, maxX: CANVAS_W, maxY: CANVAS_H };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodeIds.forEach(id => {
      const pos = positions[id];
      const size = sizes[id] || DEFAULT_SIZE[nodes[id]?.shape] || DEFAULT_SIZE.rect;
      if (pos) {
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + size.w);
        maxY = Math.max(maxY, pos.y + size.h);
      }
    });

    // Add padding
    const padding = 40;
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
    };
  }, [nodes, positions, sizes]);

  const viewBox = `${bounds.minX} ${bounds.minY} ${bounds.maxX - bounds.minX} ${bounds.maxY - bounds.minY}`;
  const aspectRatio = (bounds.maxX - bounds.minX) / (bounds.maxY - bounds.minY);
  const height = Math.min(maxWidth / aspectRatio, 600);

  // Calculate edge connection points
  const edgesWithPoints = useMemo(() => {
    return edges.map((e: EdgeDef) => {
      const fromPos = positions[e.from];
      const toPos = positions[e.to];
      const fromSize = sizes[e.from] || DEFAULT_SIZE[nodes[e.from]?.shape] || DEFAULT_SIZE.rect;
      const toSize = sizes[e.to] || DEFAULT_SIZE[nodes[e.to]?.shape] || DEFAULT_SIZE.rect;

      if (!fromPos || !toPos) return null;

      // Calculate center points
      const fromCenter = { x: fromPos.x + fromSize.w / 2, y: fromPos.y + fromSize.h / 2 };
      const toCenter = { x: toPos.x + toSize.w / 2, y: toPos.y + toSize.h / 2 };

      // Simple edge connection from center to center
      return {
        a: fromCenter,
        b: toCenter,
        label: e.label,
        style: e.style,
      };
    }).filter(Boolean);
  }, [edges, positions, sizes, nodes]);

  return (
    <svg
      width={maxWidth}
      height={height}
      viewBox={viewBox}
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#000000" />
        </marker>
      </defs>

      {/* Edges */}
      {edgesWithPoints.map((e: any, i: number) => (
        <BlockEdge key={`edge-${i}`} a={e.a} b={e.b} label={e.label} style={e.style} />
      ))}

      {/* Nodes */}
      {Object.keys(nodes).map((id) => (
        <BlockNode
          key={id}
          id={id}
          meta={nodes[id]}
          pos={positions[id]}
          size={sizes[id]}
        />
      ))}
    </svg>
  );
}

/**
 * Find the rightmost extent of actual content in a Gantt chart
 * This looks for task bars (rect elements) to determine where content ends
 * Ignores thin lines (gridlines, markers) by checking both width AND height
 */
function findGanttContentWidth(svgElement: SVGSVGElement): number | null {
  try {
    // Look for Gantt-specific elements: task bars are rect elements with significant width AND height
    const rects = svgElement.querySelectorAll('rect');

    let maxX = 0;
    let foundTaskBars = false;

    // Check rect elements - only count those that look like task bars
    // Task bars have significant width AND height (not thin lines)
    rects.forEach(rect => {
      const x = parseFloat(rect.getAttribute('x') || '0');
      const width = parseFloat(rect.getAttribute('width') || '0');
      const height = parseFloat(rect.getAttribute('height') || '0');
      const rightEdge = x + width;

      // Task bars: width > 10 AND height > 10 (excludes thin gridlines and markers)
      // Also check if it has a fill (task bars typically have fill colors)
      const fill = rect.getAttribute('fill') || '';
      const hasVisibleFill = fill && fill !== 'none' && fill !== 'transparent' && !fill.startsWith('url(');

      if (width > 10 && height > 10 && hasVisibleFill) {
        if (rightEdge > maxX) {
          maxX = rightEdge;
          foundTaskBars = true;
        }
      }
    });

    // Only use text bounds if we didn't find any task bars
    // (text like dates on timeline can extend far right)
    if (!foundTaskBars) {
      const texts = svgElement.querySelectorAll('text');
      texts.forEach(text => {
        try {
          const textBBox = (text as SVGTextElement).getBBox();
          const rightEdge = textBBox.x + textBBox.width;
          if (rightEdge > maxX) {
            maxX = rightEdge;
          }
        } catch {
          // Some text elements may not have valid bbox
        }
      });
    }

    console.log('[Mermaid Crop] findGanttContentWidth: maxX =', maxX, ', foundTaskBars =', foundTaskBars);
    return maxX > 0 ? maxX : null;
  } catch {
    return null;
  }
}

/**
 * Post-process Mermaid SVG to crop to actual content bounds
 * This removes excessive whitespace that Mermaid often adds
 * Returns the final width for container sizing
 *
 * @param svgElement - The SVG element to crop
 * @param styleMaxWidth - Optional max-width extracted from Mermaid's style (important for Gantt charts)
 */
function cropMermaidSvgToContent(svgElement: SVGSVGElement, styleMaxWidth: number | null): number | null {
  try {
    // First, remove ALL width/height/style attributes that Mermaid may have set
    svgElement.removeAttribute('style');
    svgElement.style.cssText = '';

    // Get the bounding box of all content
    const bbox = svgElement.getBBox();
    console.log('[Mermaid Crop] getBBox:', bbox, 'styleMaxWidth:', styleMaxWidth);

    if (bbox.width > 0 && bbox.height > 0) {
      // Add padding around content to prevent clipping
      const paddingX = 24;
      const paddingY = 16;

      // For charts where styleMaxWidth is much smaller than bbox (like Gantt charts),
      // try to find the actual content extent by examining elements
      let effectiveWidth = bbox.width;

      if (styleMaxWidth && bbox.width > styleMaxWidth * 2) {
        // This looks like a Gantt/timeline chart - try to find actual content bounds
        const contentWidth = findGanttContentWidth(svgElement);
        console.log('[Mermaid Crop] Gantt content width:', contentWidth);

        if (contentWidth && contentWidth > 0) {
          // Use the content width plus a small buffer
          effectiveWidth = Math.min(contentWidth + 50, styleMaxWidth);
        } else {
          // Fall back to styleMaxWidth
          effectiveWidth = styleMaxWidth;
        }
      }

      console.log('[Mermaid Crop] effectiveWidth:', effectiveWidth, '(bbox:', bbox.width, ', styleMaxWidth:', styleMaxWidth, ')');

      const contentWidth = effectiveWidth + paddingX * 2;
      const contentHeight = bbox.height + paddingY * 2;

      // Set viewBox to exactly match the content bounds (with padding)
      const newViewBox = `${bbox.x - paddingX} ${bbox.y - paddingY} ${contentWidth} ${contentHeight}`;
      svgElement.setAttribute('viewBox', newViewBox);

      // Apply max dimension constraints while preserving aspect ratio
      const maxWidth = 1200;
      const maxHeight = 800;

      let finalWidth = contentWidth;
      let finalHeight = contentHeight;

      if (finalWidth > maxWidth) {
        const scale = maxWidth / finalWidth;
        finalWidth = maxWidth;
        finalHeight *= scale;
      }
      if (finalHeight > maxHeight) {
        const scale = maxHeight / finalHeight;
        finalHeight = maxHeight;
        finalWidth *= scale;
      }

      const roundedWidth = Math.ceil(finalWidth);
      const roundedHeight = Math.ceil(finalHeight);

      console.log('[Mermaid Crop] Final dimensions:', roundedWidth, 'x', roundedHeight);

      // Set explicit pixel dimensions
      svgElement.setAttribute('width', String(roundedWidth));
      svgElement.setAttribute('height', String(roundedHeight));
      svgElement.setAttribute('preserveAspectRatio', 'xMinYMin meet');

      // Set CSS to match
      svgElement.style.width = `${roundedWidth}px`;
      svgElement.style.height = `${roundedHeight}px`;
      svgElement.style.maxWidth = '100%';
      svgElement.style.display = 'block';

      return roundedWidth;
    }
  } catch (e) {
    console.warn('Could not crop SVG:', e);
  }
  return null;
}

/**
 * Pre-process SVG string to remove Mermaid's width/height attributes
 * but preserve max-width from style (important for Gantt charts)
 */
function preprocessMermaidSvg(svgString: string): { svg: string; maxWidth: number | null } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  let maxWidth: number | null = null;

  if (svgEl) {
    // Extract max-width from style before removing
    const style = svgEl.getAttribute('style') || '';
    const maxWidthMatch = style.match(/max-width:\s*([\d.]+)px/i);
    if (maxWidthMatch) {
      maxWidth = parseFloat(maxWidthMatch[1]);
      console.log('[Mermaid Preprocess] Found max-width in style:', maxWidth);
    }

    // Remove width, height, and style
    svgEl.removeAttribute('width');
    svgEl.removeAttribute('height');
    svgEl.removeAttribute('style');

    return { svg: new XMLSerializer().serializeToString(doc), maxWidth };
  }

  // Fallback: regex-based
  const maxWidthMatch = svgString.match(/max-width:\s*([\d.]+)px/i);
  if (maxWidthMatch) {
    maxWidth = parseFloat(maxWidthMatch[1]);
  }

  const svg = svgString
    .replace(/(<svg[^>]*)\s+width="[^"]*"/gi, '$1')
    .replace(/(<svg[^>]*)\s+height="[^"]*"/gi, '$1')
    .replace(/(<svg[^>]*)\s+style="[^"]*"/gi, '$1');

  return { svg, maxWidth };
}

// Render a Mermaid diagram
// Crops SVG to actual content and sets container width to match
function MermaidDiagramPreview({ diagram }: { diagram: MermaidDiagram; maxWidth?: number }) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [styleMaxWidth, setStyleMaxWidth] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!diagram.mermaidCode?.trim()) {
        setSvg('');
        setError('No diagram code');
        return;
      }

      try {
        setError('');
        const uniqueId = `inline-mermaid-${diagram.id}-${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(uniqueId, diagram.mermaidCode);
        // Pre-process SVG to remove width/height, but extract max-width first
        const { svg: processedSvg, maxWidth: extractedMaxWidth } = preprocessMermaidSvg(renderedSvg);
        setSvg(processedSvg);
        setStyleMaxWidth(extractedMaxWidth);
        setContainerWidth(null); // Reset width when new SVG is rendered
      } catch (err) {
        console.error('Mermaid render error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
        setSvg('');
      }
    };

    renderDiagram();
  }, [diagram.id, diagram.mermaidCode]);

  // After SVG is inserted into DOM, crop it and set container width
  useEffect(() => {
    if (svg && containerRef.current) {
      const svgElement = containerRef.current.querySelector('svg');
      if (svgElement) {
        // Need to wait for SVG to be laid out before getBBox() works correctly
        const timerId = setTimeout(() => {
          const width = cropMermaidSvgToContent(svgElement as SVGSVGElement, styleMaxWidth);
          if (width) {
            setContainerWidth(width);
          }
        }, 50);
        return () => clearTimeout(timerId);
      }
    }
  }, [svg, styleMaxWidth]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-sm">
        <p className="font-medium">Diagram render error</p>
        <p className="text-xs mt-1">{error}</p>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded text-gray-500 dark:text-gray-400 text-sm">
        Loading diagram...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="inline-diagram-mermaid"
      style={{
        display: 'block',
        width: containerWidth ? `${containerWidth}px` : 'auto',
        maxWidth: '100%',
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/**
 * Convert a string to a URL-friendly slug for matching
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Find a diagram by ID or slug using matching strategies
 *
 * Strategy: Use exact matching first, then keyword matching ONLY if it
 * results in exactly ONE match (to avoid showing wrong diagrams).
 */
function findDiagramByIdOrSlug(
  idOrSlug: string,
  getDiagramById: (id: string) => any,
  getAllDiagrams: () => Array<{ id: string; type: string; title: string; figureNumber?: string }>
): any {
  // Strategy 1: Direct ID match (most reliable)
  let diagram = getDiagramById(idOrSlug);
  if (diagram) return diagram;

  const searchSlug = idOrSlug.toLowerCase();
  const allDiagrams = getAllDiagrams();

  // Strategy 2: Match by figure number (e.g., "5-1" or "fig-5-1")
  const numMatch = searchSlug.match(/^(?:fig-?)?(\d+(?:-\d+)?)$/);
  if (numMatch) {
    const found = allDiagrams.find(d => d.figureNumber === numMatch[1]);
    if (found) {
      diagram = getDiagramById(found.id);
      if (diagram) return diagram;
    }
  }

  // Strategy 2b: Extract figure number from prefix (e.g., "5-1-logical-architecture")
  // Supports format {{fig:X-Y-description}} where X-Y is the figure number
  const prefixMatch = searchSlug.match(/^(\d+-\d+)-/);
  if (prefixMatch) {
    const found = allDiagrams.find(d => d.figureNumber === prefixMatch[1]);
    if (found) {
      diagram = getDiagramById(found.id);
      if (diagram) return diagram;
    }
  }

  // Strategy 2c: Match by stored slug field (explicit mapping from diagram generation)
  const slugMatch = allDiagrams.find(d => (d as { slug?: string }).slug === idOrSlug || (d as { slug?: string }).slug === searchSlug);
  if (slugMatch) {
    diagram = getDiagramById(slugMatch.id);
    if (diagram) return diagram;
  }

  // Strategy 3: Exact slug match on title (strict - full match required)
  let found = allDiagrams.find(d => slugify(d.title) === searchSlug);
  if (found) {
    diagram = getDiagramById(found.id);
    if (diagram) return diagram;
  }

  // Strategy 4: Exact ID match ignoring case
  found = allDiagrams.find(d => d.id.toLowerCase() === searchSlug);
  if (found) {
    diagram = getDiagramById(found.id);
    if (diagram) return diagram;
  }

  // Strategy 5: Keyword matching - ALL keywords must appear in title
  // Only use if exactly ONE diagram matches (prevents wrong matches)
  const searchWords = searchSlug.split('-').filter(w => w.length > 1);
  if (searchWords.length >= 2) {
    const matches = allDiagrams.filter(d => {
      const titleLower = d.title.toLowerCase();
      return searchWords.every(word => titleLower.includes(word));
    });

    // Only return if EXACTLY one match - avoids ambiguity
    if (matches.length === 1) {
      diagram = getDiagramById(matches[0].id);
      if (diagram) return diagram;
    }
  }

  // Strategy 6: Title contains search slug as substring
  // Only use if exactly ONE diagram matches
  const containsMatches = allDiagrams.filter(d =>
    slugify(d.title).includes(searchSlug)
  );
  if (containsMatches.length === 1) {
    diagram = getDiagramById(containsMatches[0].id);
    if (diagram) return diagram;
  }

  return null;
}

export default function InlineDiagramPreview({
  diagramId,
  figureNumber,
  title,
  maxWidth = 800,
  showCaption = true,
}: InlineDiagramPreviewProps) {
  const getDiagramById = useProjectStore(state => state.getDiagramById);
  const getAllDiagrams = useProjectStore(state => state.getAllDiagrams);
  const setActiveBlockDiagram = useProjectStore(state => state.setActiveBlockDiagram);
  const setActiveMermaidDiagram = useProjectStore(state => state.setActiveMermaidDiagram);
  const setActiveTab = useProjectStore(state => state.setActiveTab);

  const [isExpanded, setIsExpanded] = useState(false);

  // Use comprehensive matching to find the diagram
  const diagram = useMemo(
    () => findDiagramByIdOrSlug(diagramId, getDiagramById, getAllDiagrams),
    [diagramId, getDiagramById, getAllDiagrams]
  );

  // Navigate to diagram editor (saves scroll position first)
  const handleEditDiagram = useCallback(() => {
    if (!diagram) return;

    // Save current scroll position for restoration
    const scrollContainer = document.querySelector('.prose')?.closest('[class*="overflow"]');
    if (scrollContainer) {
      sessionStorage.setItem('techspec-scroll-position', String(scrollContainer.scrollTop));
    }

    if (diagram.type === 'block') {
      setActiveBlockDiagram(diagram.id);
    } else {
      // For sequence/flow diagrams, set active and switch tab
      setActiveMermaidDiagram(diagram.id);
      const tab = diagram.type === 'sequence' ? 'sequence-diagrams' : 'flow-diagrams';
      setActiveTab(tab as any);
    }
  }, [diagram, setActiveBlockDiagram, setActiveMermaidDiagram, setActiveTab]);

  if (!diagram) {
    return (
      <div className="my-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
        <p className="text-yellow-700 dark:text-yellow-400 text-sm">
          <strong>Diagram not found:</strong> {diagramId}
        </p>
        <p className="text-yellow-600 dark:text-yellow-500 text-xs mt-1">
          Tip: Use figure numbers like <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">{'{{fig:5-1}}'}</code> for reliable matching
        </p>
      </div>
    );
  }

  const displayTitle = title || diagram.title;
  const displayNumber = figureNumber || diagram.figureNumber || 'X-X';

  // Expanded modal view
  if (isExpanded) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={() => setIsExpanded(false)}
      >
        <div
          className="relative bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-[95vw] max-h-[95vh] overflow-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal header */}
          <div className="sticky top-0 flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-600 z-10">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                Figure {displayNumber}: {displayTitle}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {diagram.type === 'block' ? 'Block' : diagram.type === 'sequence' ? 'Sequence' : 'Flow'} Diagram
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleEditDiagram}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                title="Edit this diagram"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          {/* Full-size diagram */}
          <div className="p-6">
            {diagram.type === 'block' ? (
              <BlockDiagramPreview diagram={diagram as BlockDiagram} maxWidth={1400} />
            ) : (
              <MermaidDiagramPreview diagram={diagram as MermaidDiagram} maxWidth={1400} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Inline view with floating controls
  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
      <figure
        className="my-6 inline-diagram-figure"
        id={`diagram-${diagramId}`}
        style={{ display: 'inline-block', maxWidth: '100%' }}
      >
        <div
          className="relative bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden group"
          style={{ display: 'inline-block' }}
        >
        {/* Floating controls - appear on hover */}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 border border-gray-300 dark:border-slate-500 rounded shadow-sm transition-colors"
            title="Expand diagram"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            Expand
          </button>
          <button
            onClick={handleEditDiagram}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 border border-gray-300 dark:border-slate-500 rounded shadow-sm transition-colors"
            title="Edit this diagram"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
        </div>
        {/* Diagram content - clickable to expand */}
        <div
          className="p-4 cursor-pointer"
          onClick={() => setIsExpanded(true)}
          title="Click to expand"
        >
          {diagram.type === 'block' ? (
            <BlockDiagramPreview diagram={diagram as BlockDiagram} maxWidth={maxWidth} />
          ) : (
            <MermaidDiagramPreview diagram={diagram as MermaidDiagram} maxWidth={maxWidth} />
          )}
        </div>
      </div>
      {showCaption && (
        <figcaption className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300">
          <span className="font-medium">Figure {displayNumber}:</span> {displayTitle}
        </figcaption>
      )}
    </figure>
    </div>
  );
}
