/**
 * DOCX Export Utilities
 *
 * Convert technical specifications to Microsoft Word (.docx) format
 * with 3GPP-compliant styling and embedded diagrams.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ImageRun,
  TableOfContents,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  convertInchesToTwip,
} from 'docx';
import type { Project } from '../types';
import { resolveAllLinks, parseFigureReferences } from './linkResolver';
import { getDiagramsInOrder } from './figureNumbering';
import { exportBlockDiagramAsPNG, exportMermaidDiagramAsPNG } from './diagramExport';

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
  includeTOC: false,  // Changed to false: Most markdown already has manual ToC
  includeListOfFigures: true,
  includeFigureList: true,   // Default for Pandoc
  includeTableList: false,   // Default for Pandoc (opt-in)
  includeBibliography: true,
  embedDiagrams: true,
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
        before: 240, // 12pt
        after: 120, // 6pt
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
      after: 120, // 6pt
    },
  });
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
    new Paragraph({ text: '' }), // Spacer
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

  paragraphs.push(new Paragraph({ text: '' })); // Spacer

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

  paragraphs.push(new Paragraph({ text: '' })); // Spacer

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
      spacing: { before: 1440, after: 480 }, // 1 inch before, 0.5 inch after
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
    new Paragraph({ text: '', pageBreakBefore: true }), // Page break
  ];
}

/**
 * Create diagram image paragraph
 */
async function createDiagramParagraph(
  diagramId: string,
  figureNumber: string,
  title: string,
  project: Project
): Promise<Paragraph[]> {
  try {
    // Find the diagram
    const blockDiagram = project.blockDiagrams.find(d => d.id === diagramId);
    const mermaidDiagram = [...project.sequenceDiagrams, ...project.flowDiagrams].find(d => d.id === diagramId);

    let imageBlob: Blob;

    if (blockDiagram) {
      imageBlob = await exportBlockDiagramAsPNG(blockDiagram, 2);
    } else if (mermaidDiagram) {
      imageBlob = await exportMermaidDiagramAsPNG(mermaidDiagram, 2);
    } else {
      // Diagram not found
      return [
        new Paragraph({
          children: [
            new TextRun({ text: `[Figure ${figureNumber}: ${title} - Image not available]`, italics: true }),
          ],
          alignment: AlignmentType.CENTER,
        }),
      ];
    }

    // Convert blob to array buffer
    const arrayBuffer = await imageBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Create image paragraph
    return [
      new Paragraph({
        children: [
          new ImageRun({
            data: uint8Array,
            transformation: {
              width: 600,
              height: 400,
            },
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 120 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `Figure ${figureNumber}: ${title}`, bold: true }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
      }),
    ];
  } catch (error) {
    console.error('Error creating diagram paragraph:', error);
    return [
      new Paragraph({
        children: [
          new TextRun({ text: `[Figure ${figureNumber}: ${title} - Error loading image]`, italics: true }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ];
  }
}

/**
 * Export project to DOCX format
 */
export async function exportToDocx(
  project: Project,
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS
): Promise<Blob> {
  // Resolve all links in markdown
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

  const resolvedMarkdown = resolveAllLinks(
    project.specification.markdown,
    allFigures,
    citations
  );

  // Convert markdown to paragraphs and embed diagrams
  const lines = resolvedMarkdown.split('\n');
  const contentParagraphs: Paragraph[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line contains a figure reference
    const figureRefs = parseFigureReferences(line);

    if (figureRefs.length > 0 && options.embedDiagrams) {
      // Add the line first
      contentParagraphs.push(convertLineToParagraph(line));

      // Embed diagrams after the line
      for (const figId of figureRefs) {
        const diagram = allFigures.find(f => f.id === figId);
        if (diagram) {
          const diagramParas = await createDiagramParagraph(
            diagram.id,
            diagram.number,
            diagram.title,
            project
          );
          contentParagraphs.push(...diagramParas);
        }
      }
    } else {
      contentParagraphs.push(convertLineToParagraph(line));
    }
  }

  // Build document sections
  const sections: Paragraph[] = [];

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
  sections.push(...contentParagraphs);

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
            size: 22, // 11pt
          },
          paragraph: {
            spacing: {
              line: 276, // 1.15 line spacing
              before: 0,
              after: 160, // 8pt
            },
          },
        },
        heading1: {
          run: {
            size: 32, // 16pt
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
            size: 28, // 14pt
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
            size: 24, // 12pt
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
  const buffer = await Packer.toBlob(doc);
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
