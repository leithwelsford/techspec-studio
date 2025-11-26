/**
 * Diagram Export Utilities
 *
 * Export block diagrams and Mermaid diagrams as SVG or PNG images.
 */

import type { BlockDiagram, MermaidDiagram } from '../types';
import mermaid from 'mermaid';

/**
 * Render block diagram to SVG
 */
export async function renderBlockDiagramToSVG(diagram: BlockDiagram): Promise<string> {
  // Create SVG container
  const width = 1200;
  const height = 800;

  // Calculate bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  Object.entries(diagram.positions).forEach(([id, pos]) => {
    const size = diagram.sizes[id] || { width: 120, height: 60 };
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + size.width);
    maxY = Math.max(maxY, pos.y + size.height);
  });

  // Add padding
  const padding = 50;
  const viewBoxWidth = maxX - minX + 2 * padding;
  const viewBoxHeight = maxY - minY + 2 * padding;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX - padding} ${minY - padding} ${viewBoxWidth} ${viewBoxHeight}">`;

  // Add styles
  svg += `<style>
    .node-rect { fill: #e3f2fd; stroke: #1976d2; stroke-width: 2; }
    .node-cloud { fill: #fff3e0; stroke: #f57c00; stroke-width: 2; }
    .node-text { font-family: Arial, sans-serif; font-size: 14px; fill: #000; text-anchor: middle; }
    .edge-bold { stroke: #333; stroke-width: 4; fill: none; filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.3)); }
    .edge-solid { stroke: #666; stroke-width: 1.6; fill: none; }
    .edge-dashed { stroke: #999; stroke-width: 1.2; stroke-dasharray: 5,5; fill: none; }
    .edge-label { font-family: Arial, sans-serif; font-size: 12px; fill: #333; }
  </style>`;

  // Render edges first (so they appear behind nodes)
  diagram.edges.forEach((edge, index) => {
    const fromPos = diagram.positions[edge.from];
    const toPos = diagram.positions[edge.to];
    const fromSize = diagram.sizes[edge.from] || { width: 120, height: 60 };
    const toSize = diagram.sizes[edge.to] || { width: 120, height: 60 };

    if (!fromPos || !toPos) return;

    const fromX = fromPos.x + fromSize.width / 2;
    const fromY = fromPos.y + fromSize.height / 2;
    const toX = toPos.x + toSize.width / 2;
    const toY = toPos.y + toSize.height / 2;

    const styleClass = edge.style === 'bold' ? 'edge-bold' : edge.style === 'dashed' ? 'edge-dashed' : 'edge-solid';

    // Draw line
    svg += `<line x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}" class="${styleClass}" />`;

    // Draw label if present
    if (edge.label) {
      const labelX = (fromX + toX) / 2;
      const labelY = (fromY + toY) / 2;
      const offset = diagram.labelOffsets?.[index] || { dx: 0, dy: 0 };

      svg += `<text x="${labelX + offset.dx}" y="${labelY + offset.dy}" class="edge-label">${edge.label}</text>`;
    }
  });

  // Render nodes
  Object.entries(diagram.nodes).forEach(([id, node]) => {
    const pos = diagram.positions[id];
    const size = diagram.sizes[id] || { width: 120, height: 60 };

    if (!pos) return;

    if (node.shape === 'cloud') {
      // Cloud shape (simplified)
      const cx = pos.x + size.width / 2;
      const cy = pos.y + size.height / 2;
      const rx = size.width / 2;
      const ry = size.height / 2;

      svg += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" class="node-cloud" />`;
      svg += `<text x="${cx}" y="${cy + 5}" class="node-text">${node.label}</text>`;
    } else {
      // Rectangle
      svg += `<rect x="${pos.x}" y="${pos.y}" width="${size.width}" height="${size.height}" class="node-rect" />`;
      svg += `<text x="${pos.x + size.width / 2}" y="${pos.y + size.height / 2 + 5}" class="node-text">${node.label}</text>`;
    }
  });

  svg += '</svg>';
  return svg;
}

/**
 * Render Mermaid diagram to SVG
 */
export async function renderMermaidDiagramToSVG(diagram: MermaidDiagram): Promise<string> {
  try {
    // Initialize mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
    });

    // Generate unique ID
    const id = `mermaid-export-${Date.now()}`;

    // Render to SVG
    const { svg } = await mermaid.render(id, diagram.mermaidCode);

    return svg;
  } catch (error) {
    console.error('Error rendering Mermaid diagram:', error);
    throw new Error(`Failed to render Mermaid diagram: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert SVG string to PNG blob
 */
export async function svgToPng(svgString: string, scale: number = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Create image from SVG
    const img = new Image();
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Scale for higher resolution
      ctx.scale(scale, scale);

      // Draw image
      ctx.drawImage(img, 0, 0);

      // Convert to blob
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url);
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create PNG blob'));
        }
      }, 'image/png');
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG image'));
    };

    img.src = url;
  });
}

/**
 * Download SVG file
 */
export function downloadSVG(svg: string, filename: string): void {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download PNG file
 */
export function downloadPNG(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export block diagram as SVG
 */
export async function exportBlockDiagramAsSVG(diagram: BlockDiagram): Promise<string> {
  return renderBlockDiagramToSVG(diagram);
}

/**
 * Export block diagram as PNG
 */
export async function exportBlockDiagramAsPNG(diagram: BlockDiagram, scale: number = 2): Promise<Blob> {
  const svg = await renderBlockDiagramToSVG(diagram);
  return svgToPng(svg, scale);
}

/**
 * Export Mermaid diagram as SVG
 */
export async function exportMermaidDiagramAsSVG(diagram: MermaidDiagram): Promise<string> {
  return renderMermaidDiagramToSVG(diagram);
}

/**
 * Export Mermaid diagram as PNG
 */
export async function exportMermaidDiagramAsPNG(diagram: MermaidDiagram, scale: number = 2): Promise<Blob> {
  const svg = await renderMermaidDiagramToSVG(diagram);
  return svgToPng(svg, scale);
}
