/**
 * DOCX Export Utilities
 *
 * Convert technical specifications to Microsoft Word (.docx) format
 * with 3GPP-compliant styling.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  TableOfContents,
  convertInchesToTwip,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun,
} from 'docx';
import type { Project } from '../types';
import { resolveAllLinks } from './linkResolver';
import { getDiagramsInOrder } from './figureNumbering';
import {
  generateReferencedDiagramImages,
  buildDiagramImageMap,
  type DiagramImage,
} from './diagramImageExporter';

export interface ExportOptions {
  includeTOC: boolean;
  includeListOfFigures: boolean;  // List of Figures (used by browser export)
  includeFigureList?: boolean;    // Alias for Pandoc export compatibility
  includeTableList?: boolean;     // List of Tables (Pandoc export only)
  includeBibliography: boolean;
  embedDiagrams: boolean;
  author?: string;
  company?: string;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includeTOC: false,  // Most markdown already has manual ToC
  includeListOfFigures: true,
  includeFigureList: true,
  includeTableList: false,
  includeBibliography: true,
  embedDiagrams: true,  // Embed diagrams inline at {{fig:...}} references
};

/**
 * Parse markdown heading to extract level and text
 */
function parseHeading(line: string): { level: number; text: string } | null {
  const match = line.match(/^(#{1,6})\s+(.+)$/);
  if (!match) return null;
  return {
    level: match[1].length,
    text: match[2].trim(),
  };
}

/**
 * Convert markdown text styling to DOCX TextRun
 */
function parseInlineMarkdown(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let lastIndex = 0;

  // Pattern for bold, italic, code
  const pattern = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|(`)(.*?)`/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      runs.push(new TextRun(text.substring(lastIndex, match.index)));
    }

    // Add styled text
    if (match[2]) {
      // Bold
      runs.push(new TextRun({ text: match[2], bold: true }));
    } else if (match[4]) {
      // Italic
      runs.push(new TextRun({ text: match[4], italics: true }));
    } else if (match[6]) {
      // Code
      runs.push(new TextRun({
        text: match[6],
        font: 'Courier New',
        size: 20, // 10pt
      }));
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    runs.push(new TextRun(text.substring(lastIndex)));
  }

  return runs.length > 0 ? runs : [new TextRun(text)];
}

/**
 * Convert markdown line to DOCX paragraph
 */
function convertLineToParagraph(line: string): Paragraph {
  // Check for heading
  const heading = parseHeading(line);
  if (heading) {
    const headingLevels = [
      HeadingLevel.HEADING_1,
      HeadingLevel.HEADING_2,
      HeadingLevel.HEADING_3,
      HeadingLevel.HEADING_4,
      HeadingLevel.HEADING_5,
      HeadingLevel.HEADING_6,
    ];

    return new Paragraph({
      text: heading.text,
      heading: headingLevels[heading.level - 1],
      spacing: {
        before: 240,
        after: 120,
      },
    });
  }

  // Regular paragraph with inline styling
  if (line.trim().length === 0) {
    return new Paragraph({ text: '' });
  }

  return new Paragraph({
    children: parseInlineMarkdown(line),
    spacing: {
      after: 120,
    },
  });
}

/**
 * Check if a line is a markdown table row
 */
function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|');
}

/**
 * Check if a line is a table separator (e.g., |---|---|)
 */
function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  return isTableRow(line) && /^\|[\s\-:]+\|/.test(trimmed) && !trimmed.match(/[a-zA-Z0-9]/);
}

/**
 * Parse a table row into cells
 */
function parseTableRow(line: string): string[] {
  const trimmed = line.trim();
  // Remove leading and trailing pipes, then split by pipe
  const content = trimmed.slice(1, -1);
  return content.split('|').map(cell => cell.trim());
}

/**
 * Convert markdown table to DOCX Table
 */
function convertMarkdownTableToDocx(tableLines: string[]): Table {
  // Filter out separator rows
  const dataRows = tableLines.filter(line => !isTableSeparator(line));

  // Parse all rows
  const parsedRows = dataRows.map(line => parseTableRow(line));

  // Create table rows
  const rows = parsedRows.map((cells, rowIndex) => {
    const isHeader = rowIndex === 0;

    return new TableRow({
      children: cells.map(cellContent =>
        new TableCell({
          children: [
            new Paragraph({
              children: parseInlineMarkdown(cellContent),
              spacing: { before: 60, after: 60 },
            }),
          ],
          shading: isHeader ? { fill: 'E7E6E6' } : undefined,
        })
      ),
    });
  });

  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    rows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
      left: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
    },
  });
}

/**
 * Create image paragraph with caption for a diagram
 */
function createDiagramParagraph(image: DiagramImage): Paragraph[] {
  // Use a reasonable default size - 600px wide, scaled proportionally
  // The actual PNG is 2x scale, so divide by 2 for display size
  const MIN_WIDTH = 200;
  const MAX_WIDTH = 600;

  // Get actual dimensions, ensuring they're reasonable
  let displayWidth = image.width;
  let displayHeight = image.height;

  // If dimensions are too small or invalid, use defaults
  if (displayWidth < MIN_WIDTH || displayHeight < 50) {
    console.log(`[DOCX Export] Image ${image.figureNumber} has small dimensions (${displayWidth}x${displayHeight}), using defaults`);
    displayWidth = MAX_WIDTH;
    displayHeight = 400; // Default reasonable height
  }

  // Scale to fit within max width while maintaining aspect ratio
  if (displayWidth > MAX_WIDTH) {
    const scale = MAX_WIDTH / displayWidth;
    displayWidth = MAX_WIDTH;
    displayHeight = Math.round(displayHeight * scale);
  }

  console.log(`[DOCX Export] Image ${image.figureNumber}: display size ${displayWidth}x${displayHeight}`);

  const caption = image.figureNumber
    ? `Figure ${image.figureNumber}: ${image.title}`
    : image.title;

  return [
    // Image paragraph
    new Paragraph({
      children: [
        new ImageRun({
          data: image.arrayBuffer,
          transformation: {
            width: displayWidth,
            height: displayHeight,
          },
          type: 'png',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 120 },
    }),
    // Caption paragraph
    new Paragraph({
      children: [
        new TextRun({ text: caption, italics: true }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
  ];
}

/**
 * Process markdown content and extract tables, paragraphs, and diagrams
 * Returns an array of Paragraph or Table objects
 */
function processMarkdownContent(
  markdown: string,
  imageMap?: Map<string, DiagramImage>
): (Paragraph | Table)[] {
  const lines = markdown.split('\n');
  const result: (Paragraph | Table)[] = [];
  let currentTableLines: string[] = [];

  // Pattern to match {{fig:...}} references
  const figPattern = /\{\{fig:([a-zA-Z0-9-_]+)\}\}/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isTableRow(line)) {
      // Accumulate table lines
      currentTableLines.push(line);
    } else {
      // If we were accumulating a table, convert it
      if (currentTableLines.length > 0) {
        // Need at least 2 rows (header + separator or header + data)
        if (currentTableLines.length >= 2) {
          result.push(convertMarkdownTableToDocx(currentTableLines));
          // Add spacing after table
          result.push(new Paragraph({ text: '' }));
        } else {
          // Not enough rows for a table, treat as regular paragraphs
          currentTableLines.forEach(tl => result.push(convertLineToParagraph(tl)));
        }
        currentTableLines = [];
      }

      // Check for figure reference
      const figMatch = line.match(figPattern);
      if (figMatch) {
        const ref = figMatch[1];
        console.log(`[DOCX Export] Found figure reference: {{fig:${ref}}}`);

        if (imageMap) {
          const image = imageMap.get(ref);
          console.log(`[DOCX Export] Looking up ref "${ref}" in imageMap:`, image ? 'FOUND' : 'NOT FOUND');

          if (image) {
            // Insert diagram image with caption
            console.log(`[DOCX Export] Inserting image for ${ref}`);
            result.push(...createDiagramParagraph(image));
          } else {
            // Diagram not found, keep the reference text
            console.warn(`[DOCX Export] Diagram not found for reference: ${ref}`);
            result.push(convertLineToParagraph(line));
          }
        } else {
          console.log(`[DOCX Export] No imageMap available, keeping reference text`);
          result.push(convertLineToParagraph(line));
        }
      } else {
        // Process regular line
        result.push(convertLineToParagraph(line));
      }
    }
  }

  // Handle any remaining table at end of document
  if (currentTableLines.length >= 2) {
    result.push(convertMarkdownTableToDocx(currentTableLines));
  } else if (currentTableLines.length > 0) {
    currentTableLines.forEach(tl => result.push(convertLineToParagraph(tl)));
  }

  return result;
}

/**
 * Generate Table of Contents
 */
function generateTOC(): Paragraph[] {
  return [
    new Paragraph({
      text: 'Table of Contents',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
    }),
    new Paragraph({
      children: [new TableOfContents('Table of Contents', {
        hyperlink: true,
        headingStyleRange: '1-3',
      })],
    }),
    new Paragraph({ text: '' }),
  ];
}

/**
 * Generate List of Figures
 */
function generateListOfFigures(project: Project): Paragraph[] {
  const diagrams = getDiagramsInOrder(
    project.specification.markdown,
    project.blockDiagrams,
    [...project.sequenceDiagrams, ...project.flowDiagrams]
  );

  const paragraphs: Paragraph[] = [
    new Paragraph({
      text: 'List of Figures',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
    }),
  ];

  diagrams.forEach(diagram => {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Figure ${diagram.figureNumber}: `, bold: true }),
          new TextRun(diagram.title),
        ],
        spacing: { after: 80 },
      })
    );
  });

  paragraphs.push(new Paragraph({ text: '' }));

  return paragraphs;
}

/**
 * Generate Bibliography/References
 */
function generateBibliography(project: Project): Paragraph[] {
  if (project.references.length === 0) {
    return [];
  }

  const paragraphs: Paragraph[] = [
    new Paragraph({
      text: 'References',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
    }),
  ];

  project.references.forEach((ref, index) => {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: `[${index + 1}] `, bold: true }),
          new TextRun(ref.title),
          ...(ref.metadata?.spec ? [new TextRun(`, ${ref.metadata.spec}`)] : []),
          ...(ref.metadata?.version ? [new TextRun(`, Version ${ref.metadata.version}`)] : []),
        ],
        spacing: { after: 80 },
      })
    );
  });

  paragraphs.push(new Paragraph({ text: '' }));

  return paragraphs;
}

/**
 * Create document title page
 */
function createTitlePage(project: Project, options: ExportOptions): Paragraph[] {
  const metadata = project.specification.metadata;

  return [
    new Paragraph({
      text: metadata.title || 'Technical Specification',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { before: 1440, after: 480 },
    }),
    new Paragraph({
      text: metadata.subtitle || '',
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Version: ', bold: true }),
        new TextRun(metadata.version || '1.0'),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Date: ', bold: true }),
        new TextRun(metadata.date || new Date().toISOString().split('T')[0]),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    ...(options.author ? [
      new Paragraph({
        children: [
          new TextRun({ text: 'Author: ', bold: true }),
          new TextRun(options.author),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      }),
    ] : []),
    ...(options.company ? [
      new Paragraph({
        children: [
          new TextRun({ text: 'Company: ', bold: true }),
          new TextRun(options.company),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      }),
    ] : []),
    new Paragraph({ text: '', pageBreakBefore: true }),
  ];
}

/**
 * Export project to DOCX format
 */
export async function exportToDocx(
  project: Project,
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS
): Promise<Blob> {
  console.log('[DOCX Export] Starting export...');
  console.log('[DOCX Export] Options:', JSON.stringify(options));

  // Build figure and citation references for link resolution
  const figures = project.blockDiagrams.map(d => ({
    id: d.id,
    number: d.figureNumber || 'X-X',
    title: d.title,
    type: 'block' as const,
  }));

  const mermaidFigures = [
    ...project.sequenceDiagrams.map(d => ({
      id: d.id,
      number: d.figureNumber || 'X-X',
      title: d.title,
      type: d.type,
    })),
    ...project.flowDiagrams.map(d => ({
      id: d.id,
      number: d.figureNumber || 'X-X',
      title: d.title,
      type: d.type,
    })),
  ];

  const allFigures = [...figures, ...mermaidFigures];

  const citations = project.references.map((ref, index) => ({
    id: ref.id,
    number: String(index + 1),
    title: ref.title,
  }));

  // Generate diagram images if enabled
  let imageMap: Map<string, DiagramImage> | undefined;
  if (options.embedDiagrams) {
    console.log('[DOCX Export] Generating diagram images...');
    console.log('[DOCX Export] Block diagrams:', project.blockDiagrams.length);
    console.log('[DOCX Export] Sequence diagrams:', project.sequenceDiagrams.length);
    console.log('[DOCX Export] Flow diagrams:', project.flowDiagrams.length);

    // Log all diagram IDs for debugging
    project.blockDiagrams.forEach(d => console.log(`[DOCX Export] Block diagram: id=${d.id}, figNum=${d.figureNumber}, slug=${d.slug}`));
    project.sequenceDiagrams.forEach(d => console.log(`[DOCX Export] Sequence diagram: id=${d.id}, figNum=${d.figureNumber}, slug=${d.slug}`));
    project.flowDiagrams.forEach(d => console.log(`[DOCX Export] Flow diagram: id=${d.id}, figNum=${d.figureNumber}, slug=${d.slug}`));

    try {
      const images = await generateReferencedDiagramImages(project, { scale: 2 });
      console.log(`[DOCX Export] Generated ${images.length} diagram images`);
      images.forEach(img => console.log(`[DOCX Export] Image: id=${img.id}, figNum=${img.figureNumber}, filename=${img.filename}`));
      imageMap = buildDiagramImageMap(images);
      console.log(`[DOCX Export] Image map keys:`, Array.from(imageMap.keys()));
    } catch (error) {
      console.error('[DOCX Export] Failed to generate diagram images:', error);
      // Continue without images
    }
  }

  // Process markdown with original content (keep {{fig:...}} for image insertion)
  // Only resolve citation links, not figure references when embedding diagrams
  let markdownToProcess = options.embedDiagrams
    ? project.specification.markdown.replace(
        /\{\{ref:([a-zA-Z0-9-_]+)\}\}/g,
        (_match, ref) => {
          const citation = citations.find(c => c.id === ref);
          return citation ? `[${citation.number}]` : _match;
        }
      )
    : resolveAllLinks(project.specification.markdown, allFigures, citations);

  // Strip HTML comments (e.g., <!-- TODO: [BLOCK DIAGRAM]... -->)
  markdownToProcess = markdownToProcess.replace(/<!--[\s\S]*?-->/g, '');

  // Convert markdown to paragraphs, tables, and diagrams
  const contentElements = processMarkdownContent(markdownToProcess, imageMap);

  // Build document sections
  const sections: (Paragraph | Table)[] = [];

  // Title page
  sections.push(...createTitlePage(project, options));

  // Table of Contents
  if (options.includeTOC) {
    sections.push(...generateTOC());
  }

  // List of Figures
  if (options.includeListOfFigures && (project.blockDiagrams.length > 0 || project.sequenceDiagrams.length > 0 || project.flowDiagrams.length > 0)) {
    sections.push(...generateListOfFigures(project));
  }

  // Main content
  sections.push(...contentElements);

  // Bibliography
  if (options.includeBibliography) {
    sections.push(...generateBibliography(project));
  }

  // Create document
  const doc = new Document({
    creator: options.author || 'TechSpec Studio',
    title: project.specification.metadata.title || 'Technical Specification',
    description: project.specification.metadata.subtitle || '',
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 22,
          },
          paragraph: {
            spacing: {
              line: 276,
              before: 0,
              after: 160,
            },
          },
        },
        heading1: {
          run: {
            size: 32,
            bold: true,
            color: '2E74B5',
          },
          paragraph: {
            spacing: {
              before: 480,
              after: 240,
            },
          },
        },
        heading2: {
          run: {
            size: 28,
            bold: true,
            color: '2E74B5',
          },
          paragraph: {
            spacing: {
              before: 360,
              after: 180,
            },
          },
        },
        heading3: {
          run: {
            size: 24,
            bold: true,
            color: '1F4D78',
          },
          paragraph: {
            spacing: {
              before: 240,
              after: 120,
            },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children: sections,
      },
    ],
  });

  // Generate blob
  console.log('[DOCX Export] Generating blob...');
  const buffer = await Packer.toBlob(doc);
  console.log(`[DOCX Export] Generated blob: ${buffer.size} bytes`);
  return buffer;
}

/**
 * Download DOCX file
 */
export function downloadDocx(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
