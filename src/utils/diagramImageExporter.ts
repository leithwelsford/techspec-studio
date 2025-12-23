/**
 * Shared Diagram Image Export Utilities
 *
 * Provides consistent image generation for all export formats (DOCX, Pandoc, Markdown).
 * Used by docxExport.ts, templateDocxExport.ts, pandocExport.ts, and ExportModal.tsx.
 */

import type { Project, BlockDiagram, MermaidDiagram } from '../types';
import {
  exportBlockDiagramAsPNG,
  exportMermaidDiagramAsPNG,
  renderBlockDiagramToSVG,
  renderMermaidDiagramToSVG,
} from './diagramExport';
import { parseFigureReferences } from './linkResolver';

/**
 * Result of generating a diagram image
 */
export interface DiagramImage {
  id: string;
  figureNumber: string;
  title: string;
  slug?: string;  // Optional slug for matching {{fig:slug}} references
  blob: Blob;
  base64: string;
  arrayBuffer: ArrayBuffer;
  width: number;
  height: number;
  filename: string;
  diagramType: 'block' | 'mermaid';
}

/**
 * Options for diagram image generation
 */
export interface DiagramImageOptions {
  scale?: number;        // Default: 2 (retina quality)
  maxWidthPx?: number;   // Max width in pixels (default: 624 = 6.5 inches at 96 DPI)
  format?: 'png';        // Currently only PNG supported
}

const DEFAULT_OPTIONS: DiagramImageOptions = {
  scale: 2,
  maxWidthPx: 624, // 6.5 inches at 96 DPI
  format: 'png',
};

/**
 * Convert Blob to base64 string
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix to get raw base64
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Parse SVG dimensions from SVG string
 * Checks multiple sources and enforces minimum dimensions
 */
function parseSvgDimensions(svg: string): { width: number; height: number } {
  const MIN_WIDTH = 400;
  const MIN_HEIGHT = 300;

  // Try to get width/height attributes (numeric values only)
  const widthAttrMatch = svg.match(/width="(\d+(?:\.\d+)?)(px)?"/);
  const heightAttrMatch = svg.match(/height="(\d+(?:\.\d+)?)(px)?"/);

  if (widthAttrMatch && heightAttrMatch) {
    const w = parseFloat(widthAttrMatch[1]);
    const h = parseFloat(heightAttrMatch[1]);
    if (w >= 100 && h >= 50) {
      return {
        width: Math.max(w, MIN_WIDTH),
        height: Math.max(h, MIN_HEIGHT),
      };
    }
  }

  // Try style attribute (Mermaid often uses this)
  const styleMatch = svg.match(/style="[^"]*width:\s*(\d+(?:\.\d+)?)(px)?[^"]*height:\s*(\d+(?:\.\d+)?)(px)?/i);
  if (styleMatch) {
    const w = parseFloat(styleMatch[1]);
    const h = parseFloat(styleMatch[3]);
    if (w >= 100 && h >= 50) {
      return {
        width: Math.max(w, MIN_WIDTH),
        height: Math.max(h, MIN_HEIGHT),
      };
    }
  }

  // Try viewBox (format: minX minY width height)
  const viewBoxMatch = svg.match(/viewBox=["']?\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)["']?/);
  if (viewBoxMatch) {
    const w = parseFloat(viewBoxMatch[1]);
    const h = parseFloat(viewBoxMatch[2]);
    if (w >= 100 && h >= 50) {
      return {
        width: Math.max(Math.ceil(w), MIN_WIDTH),
        height: Math.max(Math.ceil(h), MIN_HEIGHT),
      };
    }
  }

  // Default dimensions
  return { width: 800, height: 600 };
}

/**
 * Generate a sanitized filename from figure number and title
 */
function generateFilename(figureNumber: string, title: string): string {
  const slugifiedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);

  if (figureNumber) {
    return `figure-${figureNumber}${slugifiedTitle ? '-' + slugifiedTitle : ''}.png`;
  }
  return `figure-${slugifiedTitle || 'diagram'}.png`;
}

/**
 * Generate image for a single block diagram
 */
export async function generateBlockDiagramImage(
  diagram: BlockDiagram,
  options: DiagramImageOptions = {}
): Promise<DiagramImage> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Get SVG for dimensions
  const svg = await renderBlockDiagramToSVG(diagram);
  const dimensions = parseSvgDimensions(svg);

  // Generate PNG
  const blob = await exportBlockDiagramAsPNG(diagram, opts.scale);
  const base64 = await blobToBase64(blob);
  const arrayBuffer = await blob.arrayBuffer();

  return {
    id: diagram.id,
    figureNumber: diagram.figureNumber || '',
    title: diagram.title,
    slug: diagram.slug,
    blob,
    base64,
    arrayBuffer,
    width: dimensions.width,
    height: dimensions.height,
    filename: generateFilename(diagram.figureNumber || '', diagram.title),
    diagramType: 'block',
  };
}

/**
 * Generate image for a single Mermaid diagram
 */
export async function generateMermaidDiagramImage(
  diagram: MermaidDiagram,
  options: DiagramImageOptions = {}
): Promise<DiagramImage> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Get SVG for dimensions
  const svg = await renderMermaidDiagramToSVG(diagram);
  const dimensions = parseSvgDimensions(svg);

  // Generate PNG
  const blob = await exportMermaidDiagramAsPNG(diagram, opts.scale);
  const base64 = await blobToBase64(blob);
  const arrayBuffer = await blob.arrayBuffer();

  return {
    id: diagram.id,
    figureNumber: diagram.figureNumber || '',
    title: diagram.title,
    slug: diagram.slug,
    blob,
    base64,
    arrayBuffer,
    width: dimensions.width,
    height: dimensions.height,
    filename: generateFilename(diagram.figureNumber || '', diagram.title),
    diagramType: 'mermaid',
  };
}

/**
 * Find diagram by ID in project
 */
function findDiagramById(
  project: Project,
  id: string
): { diagram: BlockDiagram | MermaidDiagram; type: 'block' | 'mermaid' } | null {
  // Check block diagrams
  const blockDiagram = project.blockDiagrams.find(d => d.id === id);
  if (blockDiagram) {
    return { diagram: blockDiagram, type: 'block' };
  }

  // Check sequence diagrams
  const sequenceDiagram = project.sequenceDiagrams.find(d => d.id === id);
  if (sequenceDiagram) {
    return { diagram: sequenceDiagram, type: 'mermaid' };
  }

  // Check flow diagrams
  const flowDiagram = project.flowDiagrams.find(d => d.id === id);
  if (flowDiagram) {
    return { diagram: flowDiagram, type: 'mermaid' };
  }

  // Try matching by slug
  const allDiagrams = [
    ...project.blockDiagrams.map(d => ({ ...d, _type: 'block' as const })),
    ...project.sequenceDiagrams.map(d => ({ ...d, _type: 'mermaid' as const })),
    ...project.flowDiagrams.map(d => ({ ...d, _type: 'mermaid' as const })),
  ];

  for (const d of allDiagrams) {
    if (d.slug === id || d.figureNumber === id) {
      if (d._type === 'block') {
        return { diagram: d as BlockDiagram, type: 'block' };
      }
      return { diagram: d as MermaidDiagram, type: 'mermaid' };
    }
  }

  return null;
}

/**
 * Generate images for all diagrams referenced in markdown
 */
export async function generateReferencedDiagramImages(
  project: Project,
  options: DiagramImageOptions = {}
): Promise<DiagramImage[]> {
  const markdown = project.specification.markdown;
  const figureRefs = parseFigureReferences(markdown);
  const uniqueRefs = [...new Set(figureRefs)];

  const images: DiagramImage[] = [];

  for (const ref of uniqueRefs) {
    const found = findDiagramById(project, ref);
    if (!found) {
      console.warn(`[DiagramImageExporter] Diagram not found for reference: ${ref}`);
      continue;
    }

    try {
      const image = found.type === 'block'
        ? await generateBlockDiagramImage(found.diagram as BlockDiagram, options)
        : await generateMermaidDiagramImage(found.diagram as MermaidDiagram, options);
      images.push(image);
    } catch (error) {
      console.error(`[DiagramImageExporter] Failed to generate image for ${ref}:`, error);
    }
  }

  return images;
}

/**
 * Generate images for all diagrams in project
 */
export async function generateAllDiagramImages(
  project: Project,
  options: DiagramImageOptions = {}
): Promise<DiagramImage[]> {
  const images: DiagramImage[] = [];

  // Block diagrams
  for (const diagram of project.blockDiagrams) {
    try {
      const image = await generateBlockDiagramImage(diagram, options);
      images.push(image);
    } catch (error) {
      console.error(`[DiagramImageExporter] Failed to generate block diagram ${diagram.id}:`, error);
    }
  }

  // Sequence diagrams
  for (const diagram of project.sequenceDiagrams) {
    try {
      const image = await generateMermaidDiagramImage(diagram, options);
      images.push(image);
    } catch (error) {
      console.error(`[DiagramImageExporter] Failed to generate sequence diagram ${diagram.id}:`, error);
    }
  }

  // Flow diagrams
  for (const diagram of project.flowDiagrams) {
    try {
      const image = await generateMermaidDiagramImage(diagram, options);
      images.push(image);
    } catch (error) {
      console.error(`[DiagramImageExporter] Failed to generate flow diagram ${diagram.id}:`, error);
    }
  }

  return images;
}

/**
 * Build a map of figure reference to DiagramImage for quick lookup
 */
export function buildDiagramImageMap(images: DiagramImage[]): Map<string, DiagramImage> {
  const map = new Map<string, DiagramImage>();

  for (const image of images) {
    // Map by ID (UUID)
    map.set(image.id, image);

    // Map by figure number (e.g., "5-1")
    if (image.figureNumber) {
      map.set(image.figureNumber, image);
      map.set(`fig-${image.figureNumber}`, image);
    }

    // Map by slug (e.g., "policy-architecture")
    if (image.slug) {
      map.set(image.slug, image);
    }
  }

  return map;
}

/**
 * Transform markdown to replace {{fig:...}} with markdown image syntax
 *
 * @param markdown - Original markdown with {{fig:...}} references
 * @param images - Generated diagram images
 * @param imagePath - Path prefix for images (e.g., "images/" or "" for same directory)
 * @returns Transformed markdown with ![caption](path) syntax
 */
export function transformMarkdownWithImages(
  markdown: string,
  images: DiagramImage[],
  imagePath: string = 'images/'
): string {
  const imageMap = buildDiagramImageMap(images);

  // Match {{fig:...}} pattern and replace with markdown image syntax
  return markdown.replace(/\{\{fig:([a-zA-Z0-9-_]+)\}\}/g, (match, ref) => {
    const image = imageMap.get(ref);
    if (!image) {
      console.warn(`[DiagramImageExporter] No image found for reference: ${ref}`);
      return match; // Keep original if not found
    }

    const caption = image.figureNumber
      ? `Figure ${image.figureNumber}: ${image.title}`
      : image.title;

    const path = `${imagePath}${image.filename}`;
    return `![${caption}](${path})`;
  });
}

/**
 * Calculate EMU (English Metric Units) dimensions for Word documents
 * 914400 EMUs = 1 inch
 * Assuming 96 DPI for pixel to inch conversion
 */
export function calculateEmuDimensions(
  widthPx: number,
  heightPx: number,
  maxWidthInches: number = 6.5
): { widthEmu: number; heightEmu: number } {
  const DPI = 96;
  const EMU_PER_INCH = 914400;

  const widthInches = widthPx / DPI;
  const heightInches = heightPx / DPI;

  // Scale down if exceeds max width
  let scale = 1;
  if (widthInches > maxWidthInches) {
    scale = maxWidthInches / widthInches;
  }

  return {
    widthEmu: Math.round(widthInches * scale * EMU_PER_INCH),
    heightEmu: Math.round(heightInches * scale * EMU_PER_INCH),
  };
}
