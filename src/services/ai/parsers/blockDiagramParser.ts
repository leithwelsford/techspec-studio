/**
 * Block Diagram Parser
 * Parses AI-generated JSON into BlockDiagram structures with validation
 */

import type { BlockDiagram, NodeMeta, EdgeDef, Point, Size } from '../../../types';

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  errors: string[];
  warnings: string[];
}

/**
 * Parse AI-generated JSON string into BlockDiagram
 */
export function parseBlockDiagram(jsonString: string): ParseResult<BlockDiagram> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Clean up the response - extract JSON if wrapped in markdown code blocks
    let cleanJson = jsonString.trim();

    console.log('🔧 Block diagram parser - raw input length:', jsonString.length);
    console.log('🔧 Block diagram parser - raw input preview:', jsonString.substring(0, 500));

    // Remove markdown code fences if present
    const codeBlockMatch = cleanJson.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      cleanJson = codeBlockMatch[1].trim();
      console.log('🔧 Extracted from code block, length:', cleanJson.length);
    }

    // Parse JSON
    const parsed = JSON.parse(cleanJson);
    console.log('🔧 JSON parsed successfully');

    // Validate required fields
    if (!parsed.id) {
      errors.push('Missing required field: id');
    }
    if (!parsed.title) {
      errors.push('Missing required field: title');
    }
    if (!parsed.nodes || typeof parsed.nodes !== 'object') {
      errors.push('Missing or invalid required field: nodes');
    }
    if (!Array.isArray(parsed.edges)) {
      errors.push('Missing or invalid required field: edges');
    }
    if (!parsed.positions || typeof parsed.positions !== 'object') {
      errors.push('Missing or invalid required field: positions');
    }

    if (errors.length > 0) {
      return { success: false, errors, warnings };
    }

    // Validate node structure
    for (const [nodeId, node] of Object.entries<any>(parsed.nodes)) {
      if (!node.label) {
        errors.push(`Node '${nodeId}' missing label`);
      }
      if (!node.shape || !['rect', 'cloud'].includes(node.shape)) {
        errors.push(`Node '${nodeId}' has invalid shape: ${node.shape}`);
      }
    }

    // Validate edges
    for (let i = 0; i < parsed.edges.length; i++) {
      const edge = parsed.edges[i];
      if (!edge.from) {
        errors.push(`Edge ${i} missing 'from' field`);
      } else if (!parsed.nodes[edge.from]) {
        errors.push(`Edge ${i} references non-existent node: ${edge.from}`);
      }
      if (!edge.to) {
        errors.push(`Edge ${i} missing 'to' field`);
      } else if (!parsed.nodes[edge.to]) {
        errors.push(`Edge ${i} references non-existent node: ${edge.to}`);
      }
      if (edge.style && !['bold', 'solid', 'dashed'].includes(edge.style)) {
        warnings.push(`Edge ${i} has invalid style: ${edge.style}, defaulting to 'solid'`);
        edge.style = 'solid';
      }
    }

    // Validate positions
    for (const nodeId of Object.keys(parsed.nodes)) {
      if (!parsed.positions[nodeId]) {
        warnings.push(`Node '${nodeId}' missing position, will use default`);
        parsed.positions[nodeId] = { x: 100, y: 100 };
      } else {
        const pos = parsed.positions[nodeId];
        if (typeof pos.x !== 'number' || typeof pos.y !== 'number') {
          errors.push(`Node '${nodeId}' has invalid position`);
        }
      }
    }

    // Validate or generate sizes
    if (!parsed.sizes) {
      parsed.sizes = {};
      warnings.push('No sizes provided, generating defaults');
    }
    for (const [nodeId, node] of Object.entries<any>(parsed.nodes)) {
      if (!parsed.sizes[nodeId]) {
        const defaultSize = node.shape === 'cloud'
          ? { w: 140, h: 80 }
          : { w: 120, h: 60 };
        parsed.sizes[nodeId] = defaultSize;
        warnings.push(`Node '${nodeId}' missing size, using default ${JSON.stringify(defaultSize)}`);
      }
    }

    // Validate optional fields
    if (parsed.sepY !== undefined && typeof parsed.sepY !== 'number') {
      warnings.push('Invalid sepY value, ignoring');
      delete parsed.sepY;
    }

    if (parsed.labelOffsets && typeof parsed.labelOffsets !== 'object') {
      warnings.push('Invalid labelOffsets, ignoring');
      delete parsed.labelOffsets;
    }

    if (errors.length > 0) {
      return { success: false, errors, warnings };
    }

    // Cast to BlockDiagram type
    const diagram: BlockDiagram = {
      id: parsed.id,
      title: parsed.title,
      description: parsed.description,
      figureNumber: parsed.figureNumber,
      nodes: parsed.nodes,
      edges: parsed.edges,
      positions: parsed.positions,
      sizes: parsed.sizes,
      sepY: parsed.sepY,
      labelOffsets: parsed.labelOffsets
    };

    return { success: true, data: diagram, errors: [], warnings };

  } catch (error) {
    console.error('🔧 Block diagram parser - JSON parsing error:', error);
    console.error('🔧 Failed input (full):', jsonString);
    errors.push(`JSON parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { success: false, errors, warnings };
  }
}

/**
 * Validate an existing BlockDiagram for consistency
 */
export function validateBlockDiagram(diagram: BlockDiagram): ParseResult<BlockDiagram> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check all nodes have positions and sizes
  for (const nodeId of Object.keys(diagram.nodes)) {
    if (!diagram.positions[nodeId]) {
      errors.push(`Node '${nodeId}' missing position`);
    }
    if (!diagram.sizes[nodeId]) {
      warnings.push(`Node '${nodeId}' missing size`);
    }
  }

  // Check all edges reference valid nodes
  for (const edge of diagram.edges) {
    if (!diagram.nodes[edge.from]) {
      errors.push(`Edge references non-existent node: ${edge.from}`);
    }
    if (!diagram.nodes[edge.to]) {
      errors.push(`Edge references non-existent node: ${edge.to}`);
    }
  }

  // Check for orphaned positions or sizes
  for (const nodeId of Object.keys(diagram.positions)) {
    if (!diagram.nodes[nodeId]) {
      warnings.push(`Position exists for non-existent node: ${nodeId}`);
    }
  }
  for (const nodeId of Object.keys(diagram.sizes)) {
    if (!diagram.nodes[nodeId]) {
      warnings.push(`Size exists for non-existent node: ${nodeId}`);
    }
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings };
  }

  return { success: true, data: diagram, errors: [], warnings };
}

/**
 * Auto-layout nodes if positions are missing or invalid
 */
export function autoLayoutBlockDiagram(
  nodes: Record<string, NodeMeta>,
  edges: EdgeDef[],
  existingPositions?: Record<string, Point>
): Record<string, Point> {
  const positions: Record<string, Point> = { ...existingPositions };
  const nodeIds = Object.keys(nodes);

  // Simple grid layout for nodes without positions
  let x = 100;
  let y = 100;
  const spacing = 250;
  const nodesPerRow = 3;

  let count = 0;
  for (const nodeId of nodeIds) {
    if (!positions[nodeId]) {
      positions[nodeId] = { x, y };
      count++;
      if (count % nodesPerRow === 0) {
        x = 100;
        y += 150;
      } else {
        x += spacing;
      }
    }
  }

  return positions;
}

/**
 * Generate default sizes for nodes
 */
export function generateDefaultSizes(nodes: Record<string, NodeMeta>): Record<string, Size> {
  const sizes: Record<string, Size> = {};

  for (const [nodeId, node] of Object.entries(nodes)) {
    sizes[nodeId] = node.shape === 'cloud'
      ? { w: 140, h: 80 }
      : { w: 120, h: 60 };
  }

  return sizes;
}

/**
 * Extract block diagram ID suggestions from markdown content
 */
export function extractDiagramReferences(markdown: string): string[] {
  const figPattern = /\{\{fig:([a-zA-Z0-9-_]+)\}\}/g;
  const matches = [...markdown.matchAll(figPattern)];
  return matches.map(m => m[1]);
}

/**
 * Sanitize diagram ID (ensure camelCase, no spaces)
 */
export function sanitizeDiagramId(id: string): string {
  // Remove special characters except hyphens and underscores
  let sanitized = id.replace(/[^a-zA-Z0-9-_]/g, '');

  // Convert to camelCase
  sanitized = sanitized.replace(/[-_](.)/g, (_, char) => char.toUpperCase());

  // Ensure it starts with lowercase
  sanitized = sanitized.charAt(0).toLowerCase() + sanitized.slice(1);

  return sanitized;
}
