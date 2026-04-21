/**
 * Detect the Mermaid diagram type from the first keyword in the source.
 *
 * Used to correct miscategorized diagrams — sometimes the AI (or a
 * manual edit) stores a diagram with a type that doesn't match its
 * Mermaid code (e.g., type="flow" but code starts with "stateDiagram-v2").
 */

import type { MermaidDiagramType } from '../types';

/**
 * Mapping from Mermaid source keywords to our internal type names.
 * Order matters — longer prefixes must come first (stateDiagram-v2 before stateDiagram).
 */
const KEYWORD_TO_TYPE: Array<[string, MermaidDiagramType]> = [
  ['sequenceDiagram', 'sequence'],
  ['flowchart', 'flow'],
  ['graph', 'flow'],
  ['stateDiagram-v2', 'state'],
  ['stateDiagram', 'state'],
  ['classDiagram', 'class'],
  ['erDiagram', 'er'],
  ['gantt', 'gantt'],
  ['timeline', 'timeline'],
  ['pie', 'pie'],
  ['quadrantChart', 'quadrant'],
  ['xychart-beta', 'xy'],
  ['sankey-beta', 'sankey'],
  ['mindmap', 'mindmap'],
  ['C4Context', 'c4'],
  ['C4Container', 'c4'],
  ['C4Component', 'c4'],
  ['C4Dynamic', 'c4'],
  ['C4Deployment', 'c4'],
  ['architecture-beta', 'architecture'],
  ['block-beta', 'block-beta'],
  ['journey', 'journey'],
  ['gitGraph', 'gitgraph'],
  ['requirementDiagram', 'requirement'],
  ['zenuml', 'zenuml'],
  ['kanban', 'kanban'],
  ['packet-beta', 'packet'],
  ['radar-beta', 'radar'],
  ['treemap-beta', 'treemap'],
  ['treemap', 'treemap'],
];

/**
 * Detect the diagram type from Mermaid source code.
 * Returns null if no known keyword is found.
 */
export function detectMermaidType(source: string): MermaidDiagramType | null {
  if (!source) return null;
  // Strip leading whitespace and get the first non-empty, non-comment line
  const lines = source.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'));
  if (lines.length === 0) return null;
  const firstLine = lines[0];

  for (const [keyword, type] of KEYWORD_TO_TYPE) {
    if (firstLine.startsWith(keyword)) {
      return type;
    }
  }
  return null;
}
