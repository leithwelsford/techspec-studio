/**
 * Diagram Export Utilities
 *
 * Export block diagrams and Mermaid diagrams as SVG or PNG images.
 */

import type { BlockDiagram, MermaidDiagram } from '../types';
import mermaid from 'mermaid';

/**
 * Escape special XML characters in text content
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render block diagram to SVG
 */
export async function renderBlockDiagramToSVG(diagram: BlockDiagram): Promise<string> {
  // Check if diagram has content
  const nodeIds = Object.keys(diagram.nodes || {});
  const positionIds = Object.keys(diagram.positions || {});

  if (nodeIds.length === 0 || positionIds.length === 0) {
    // Return a placeholder SVG for empty diagrams
    console.warn('[renderBlockDiagramToSVG] Empty diagram, returning placeholder');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
      <rect width="600" height="400" fill="#f5f5f5" stroke="#ccc" stroke-width="2"/>
      <text x="300" y="200" text-anchor="middle" font-family="Arial" font-size="16" fill="#666">
        Diagram: ${diagram.title || 'Untitled'}
      </text>
      <text x="300" y="230" text-anchor="middle" font-family="Arial" font-size="12" fill="#999">
        (No content)
      </text>
    </svg>`;
  }

  // Calculate bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  Object.entries(diagram.positions).forEach(([id, pos]) => {
    const size = diagram.sizes?.[id] || { width: 120, height: 60 };
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + (size.width || 120));
    maxY = Math.max(maxY, pos.y + (size.height || 60));
  });

  // Handle edge case where bounding box is invalid
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    minX = 0;
    minY = 0;
    maxX = 800;
    maxY = 600;
  }

  // Add padding
  const padding = 50;
  const viewBoxWidth = Math.max(maxX - minX + 2 * padding, 400);
  const viewBoxHeight = Math.max(maxY - minY + 2 * padding, 300);

  // Use viewBox dimensions for width/height to ensure proper sizing
  const width = viewBoxWidth;
  const height = viewBoxHeight;

  console.log(`[renderBlockDiagramToSVG] Rendering ${nodeIds.length} nodes, viewBox: ${minX - padding} ${minY - padding} ${viewBoxWidth} ${viewBoxHeight}`);
  console.log(`[renderBlockDiagramToSVG] Node positions:`, Object.entries(diagram.positions).map(([id, pos]) => `${id}: (${pos.x}, ${pos.y})`).join(', '));

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX - padding} ${minY - padding} ${viewBoxWidth} ${viewBoxHeight}">`;

  // Add white background with thin border for visibility
  svg += `<rect x="${minX - padding}" y="${minY - padding}" width="${viewBoxWidth}" height="${viewBoxHeight}" fill="#ffffff" stroke="#cccccc" stroke-width="1"/>`;

  // B&W theme colors for 3GPP-style technical diagrams (matches Mermaid config in main.tsx)
  const THEME = {
    nodeFill: '#ffffff',        // White fill
    nodeBorder: '#000000',      // Black border
    cloudFill: '#f5f5f5',       // Light gray for secondary elements
    cloudBorder: '#000000',     // Black border
    lineColor: '#000000',       // Black lines
    lineBoldColor: '#000000',   // Black bold lines
    lineDashedColor: '#666666', // Dark gray for dashed
    textColor: '#000000',       // Black text
  };

  // Render edges first (so they appear behind nodes) - using presentation attributes for canvas compatibility
  diagram.edges.forEach((edge, index) => {
    const fromPos = diagram.positions[edge.from];
    const toPos = diagram.positions[edge.to];
    const fromSize = diagram.sizes?.[edge.from] || { width: 120, height: 60 };
    const toSize = diagram.sizes?.[edge.to] || { width: 120, height: 60 };

    if (!fromPos || !toPos) return;

    const fromX = fromPos.x + (fromSize.width || 120) / 2;
    const fromY = fromPos.y + (fromSize.height || 60) / 2;
    const toX = toPos.x + (toSize.width || 120) / 2;
    const toY = toPos.y + (toSize.height || 60) / 2;

    // Presentation attributes for different edge types (B&W theme)
    let strokeColor = THEME.lineColor;
    let strokeWidth = '1.6';
    let strokeDasharray = '';
    if (edge.style === 'bold') {
      strokeColor = THEME.lineBoldColor;
      strokeWidth = '3';
    } else if (edge.style === 'dashed') {
      strokeColor = THEME.lineDashedColor;
      strokeWidth = '1.2';
      strokeDasharray = ' stroke-dasharray="5,5"';
    }

    // Draw line with presentation attributes
    svg += `<line x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${strokeDasharray} />`;

    // Draw label if present
    if (edge.label) {
      const labelX = (fromX + toX) / 2;
      const labelY = (fromY + toY) / 2;
      const offset = diagram.labelOffsets?.[index] || { dx: 0, dy: 0 };

      svg += `<text x="${labelX + offset.dx}" y="${labelY + offset.dy}" font-family="Arial, sans-serif" font-size="12" fill="${THEME.textColor}">${escapeXml(edge.label)}</text>`;
    }
  });

  // Render nodes with presentation attributes for canvas compatibility (B&W theme)
  Object.entries(diagram.nodes).forEach(([id, node]) => {
    const pos = diagram.positions[id];
    const size = diagram.sizes?.[id] || { width: 120, height: 60 };

    if (!pos) return;

    const nodeWidth = size.width || 120;
    const nodeHeight = size.height || 60;

    if (node.shape === 'cloud') {
      // Cloud shape (simplified as ellipse) - uses secondary color
      const cx = pos.x + nodeWidth / 2;
      const cy = pos.y + nodeHeight / 2;
      const rx = nodeWidth / 2;
      const ry = nodeHeight / 2;

      svg += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${THEME.cloudFill}" stroke="${THEME.cloudBorder}" stroke-width="2" />`;
      svg += `<text x="${cx}" y="${cy + 5}" font-family="Arial, sans-serif" font-size="14" fill="${THEME.textColor}" text-anchor="middle">${escapeXml(node.label)}</text>`;
    } else {
      // Rectangle - uses primary color
      svg += `<rect x="${pos.x}" y="${pos.y}" width="${nodeWidth}" height="${nodeHeight}" fill="${THEME.nodeFill}" stroke="${THEME.nodeBorder}" stroke-width="2" />`;
      svg += `<text x="${pos.x + nodeWidth / 2}" y="${pos.y + nodeHeight / 2 + 5}" font-family="Arial, sans-serif" font-size="14" fill="${THEME.textColor}" text-anchor="middle">${escapeXml(node.label)}</text>`;
    }
  });

  svg += '</svg>';

  // Debug: Log first 500 chars of SVG
  console.log(`[renderBlockDiagramToSVG] Generated SVG (first 500 chars):`, svg.substring(0, 500));

  return svg;
}

/**
 * Normalize SVG viewBox to remove excessive padding and constrain aspect ratio
 * Mermaid often generates SVGs with extra space around the content
 */
function normalizeViewBox(svg: string): string {
  // Create a temporary container to render the SVG and measure actual bounds
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.visibility = 'hidden';
  container.style.left = '-9999px';
  container.innerHTML = svg;
  document.body.appendChild(container);

  try {
    const svgElement = container.querySelector('svg');
    if (!svgElement) {
      return svg;
    }

    // Get the bounding box of all content
    const bbox = svgElement.getBBox();

    // Add small padding around content
    const padding = 20;
    let newMinX = Math.floor(bbox.x - padding);
    let newMinY = Math.floor(bbox.y - padding);
    let newWidth = Math.ceil(bbox.width + 2 * padding);
    let newHeight = Math.ceil(bbox.height + 2 * padding);

    console.log(`[normalizeViewBox] Original bbox: x=${bbox.x}, y=${bbox.y}, w=${bbox.width}, h=${bbox.height}`);

    // Note: Disabled aspect ratio trimming - it was incorrectly cutting off Gantt charts
    // and other wide diagrams. Better to have extra whitespace than missing content.
    // The getBBox() measurement already gives us tight bounds around actual content.
    console.log(`[normalizeViewBox] Aspect ratio: ${(newWidth / newHeight).toFixed(2)}, keeping full width`)

    console.log(`[normalizeViewBox] Final viewBox: ${newMinX} ${newMinY} ${newWidth} ${newHeight}`);

    // Update the viewBox attribute
    let normalizedSvg = svg;

    // Remove existing viewBox
    normalizedSvg = normalizedSvg.replace(/viewBox="[^"]*"/i, '');
    normalizedSvg = normalizedSvg.replace(/viewBox='[^']*'/i, '');

    // Remove existing width/height (we'll set them based on new viewBox)
    normalizedSvg = normalizedSvg.replace(/(<svg[^>]*)\s+width="[^"]*"/i, '$1');
    normalizedSvg = normalizedSvg.replace(/(<svg[^>]*)\s+height="[^"]*"/i, '$1');

    // Add new viewBox and dimensions
    normalizedSvg = normalizedSvg.replace(
      /<svg/,
      `<svg viewBox="${newMinX} ${newMinY} ${newWidth} ${newHeight}" width="${newWidth}" height="${newHeight}"`
    );

    return normalizedSvg;
  } catch (error) {
    console.warn('[normalizeViewBox] Failed to normalize:', error);
    return svg;
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Render Mermaid diagram to SVG
 * Note: Uses the global Mermaid configuration from main.tsx (B&W theme for 3GPP-style)
 * Do NOT call mermaid.initialize() here - it's already configured globally
 */
export async function renderMermaidDiagramToSVG(diagram: MermaidDiagram): Promise<string> {
  try {
    // Generate unique ID
    const id = `mermaid-export-${Date.now()}`;

    // Render to SVG using global Mermaid config (B&W theme)
    const { svg } = await mermaid.render(id, diagram.mermaidCode);

    // Normalize the viewBox to remove excessive padding
    const normalizedSvg = normalizeViewBox(svg);

    return normalizedSvg;
  } catch (error) {
    console.error('Error rendering Mermaid diagram:', error);
    throw new Error(`Failed to render Mermaid diagram: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse SVG dimensions from string
 * Checks multiple sources: width/height attributes, style attribute, viewBox
 */
function parseSvgDimensions(svg: string): { width: number; height: number } {
  // Try to get width/height attributes (numeric values only, not percentages)
  const widthAttrMatch = svg.match(/width="(\d+(?:\.\d+)?)(px)?"/);
  const heightAttrMatch = svg.match(/height="(\d+(?:\.\d+)?)(px)?"/);

  if (widthAttrMatch && heightAttrMatch) {
    const w = parseFloat(widthAttrMatch[1]);
    const h = parseFloat(heightAttrMatch[1]);
    // Only use if reasonable size (not tiny placeholder values)
    if (w >= 100 && h >= 50) {
      return { width: w, height: h };
    }
  }

  // Try style attribute (Mermaid often uses this)
  const styleMatch = svg.match(/style="[^"]*width:\s*(\d+(?:\.\d+)?)(px)?[^"]*height:\s*(\d+(?:\.\d+)?)(px)?/i);
  if (styleMatch) {
    const w = parseFloat(styleMatch[1]);
    const h = parseFloat(styleMatch[3]);
    if (w >= 100 && h >= 50) {
      return { width: w, height: h };
    }
  }

  // Try viewBox (format: minX minY width height)
  const viewBoxMatch = svg.match(/viewBox=["']?\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)["']?/);
  if (viewBoxMatch) {
    const w = parseFloat(viewBoxMatch[1]);
    const h = parseFloat(viewBoxMatch[2]);
    if (w >= 100 && h >= 50) {
      return { width: w, height: h };
    }
  }

  // Last resort: check for any max-width in style
  const maxWidthMatch = svg.match(/max-width:\s*(\d+(?:\.\d+)?)(px)?/i);
  if (maxWidthMatch) {
    const w = parseFloat(maxWidthMatch[1]);
    if (w >= 100) {
      return { width: w, height: w * 0.75 }; // Assume 4:3 aspect ratio
    }
  }

  // Default dimensions for diagrams
  return { width: 800, height: 600 };
}

/**
 * Sanitize SVG to remove elements that can taint the canvas
 * Note: We keep foreignObject elements as Mermaid uses them for text labels.
 * Since we use data URLs, the canvas shouldn't be tainted by same-origin content.
 */
function sanitizeSvgForCanvas(svg: string): string {
  let sanitized = svg;

  // Remove any external image references (these can taint the canvas)
  sanitized = sanitized.replace(/<image[^>]*xlink:href="http[^"]*"[^>]*\/?>/gi, '');
  sanitized = sanitized.replace(/<image[^>]*href="http[^"]*"[^>]*\/?>/gi, '');

  // Ensure xmlns is present
  if (!sanitized.includes('xmlns="http://www.w3.org/2000/svg"')) {
    sanitized = sanitized.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // Ensure xlink namespace is present (needed for some SVG elements)
  if (!sanitized.includes('xmlns:xlink')) {
    sanitized = sanitized.replace('<svg', '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  }

  return sanitized;
}

/**
 * Convert canvas to PNG blob, handling tainted canvas errors
 */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // First check if canvas is tainted by trying toDataURL
    try {
      canvas.toDataURL('image/png');
    } catch (error) {
      // Canvas is tainted, cannot export
      reject(new Error('Canvas tainted - SVG contains restricted content'));
      return;
    }

    // Canvas is not tainted, proceed with toBlob
    canvas.toBlob(
      (blob) => {
        if (blob && blob.size > 0) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create PNG blob'));
        }
      },
      'image/png'
    );
  });
}

/**
 * Convert SVG string to PNG blob
 * Enforces minimum dimensions for proper rendering
 */
export async function svgToPng(svgString: string, scale: number = 2): Promise<Blob> {
  const MIN_WIDTH = 400;
  const MIN_HEIGHT = 300;

  return new Promise((resolve, reject) => {
    // Sanitize and ensure SVG has explicit dimensions
    const sanitizedSvg = sanitizeSvgForCanvas(svgString);
    const dims = parseSvgDimensions(sanitizedSvg);

    // Enforce minimum dimensions
    let renderWidth = dims.width;
    let renderHeight = dims.height;

    if (renderWidth < MIN_WIDTH || renderHeight < MIN_HEIGHT) {
      console.log(`[svgToPng] Small SVG dimensions detected: ${dims.width}x${dims.height}, using minimum: ${MIN_WIDTH}x${MIN_HEIGHT}`);
      // Scale up proportionally if one dimension is too small
      const widthScale = MIN_WIDTH / renderWidth;
      const heightScale = MIN_HEIGHT / renderHeight;
      const upScale = Math.max(widthScale, heightScale);
      renderWidth = Math.round(renderWidth * upScale);
      renderHeight = Math.round(renderHeight * upScale);
    }

    // Update SVG with proper dimensions for rendering
    let svgWithDimensions = sanitizedSvg;

    console.log(`[svgToPng] Before dimension update (first 300 chars):`, svgWithDimensions.substring(0, 300));

    // Remove any existing width/height that might be too small
    svgWithDimensions = svgWithDimensions.replace(/(<svg[^>]*)\s+width="[^"]*"/i, '$1');
    svgWithDimensions = svgWithDimensions.replace(/(<svg[^>]*)\s+height="[^"]*"/i, '$1');

    // Add proper dimensions
    svgWithDimensions = svgWithDimensions.replace(
      /<svg/,
      `<svg width="${renderWidth}" height="${renderHeight}"`
    );

    // Add viewBox if not present (preserves aspect ratio)
    if (!svgWithDimensions.includes('viewBox')) {
      svgWithDimensions = svgWithDimensions.replace(
        /<svg/,
        `<svg viewBox="0 0 ${dims.width} ${dims.height}"`
      );
    }

    console.log(`[svgToPng] After dimension update (first 300 chars):`, svgWithDimensions.substring(0, 300));
    console.log(`[svgToPng] Rendering at ${renderWidth}x${renderHeight}, scale: ${scale}`);

    // Create image from SVG using data URL (more reliable than blob URL)
    const img = new Image();

    // Set crossOrigin before setting src
    img.crossOrigin = 'anonymous';

    img.onload = async () => {
      // Use render dimensions (they should be set properly now)
      const imgWidth = img.width > 0 ? img.width : renderWidth;
      const imgHeight = img.height > 0 ? img.height : renderHeight;

      console.log(`[svgToPng] Loaded image: ${imgWidth}x${imgHeight}`);

      if (imgWidth <= 0 || imgHeight <= 0) {
        reject(new Error(`Invalid SVG dimensions: ${imgWidth}x${imgHeight}`));
        return;
      }

      // Create canvas with scaled dimensions
      const canvas = document.createElement('canvas');
      canvas.width = imgWidth * scale;
      canvas.height = imgHeight * scale;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Fill with white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Scale for higher resolution
      ctx.scale(scale, scale);

      // Draw image
      ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

      // Convert to blob with proper error handling
      try {
        const blob = await canvasToBlob(canvas);
        console.log(`[svgToPng] Generated PNG: ${blob.size} bytes, canvas: ${canvas.width}x${canvas.height}`);
        resolve(blob);
      } catch (error) {
        console.error('[svgToPng] Failed to convert canvas to blob:', error);
        reject(error);
      }
    };

    img.onerror = (e) => {
      console.error('[svgToPng] Failed to load SVG:', e);
      reject(new Error('Failed to load SVG image'));
    };

    // Use data URL instead of blob URL for better compatibility
    const base64 = btoa(unescape(encodeURIComponent(svgWithDimensions)));
    img.src = `data:image/svg+xml;base64,${base64}`;
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
