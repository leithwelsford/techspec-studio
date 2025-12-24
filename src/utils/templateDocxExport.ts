/**
 * Template-based DOCX Export
 *
 * Creates DOCX documents using styles extracted from an uploaded Word template.
 * Uses the docx library with externalStyles to reference template styles.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ImageRun,
} from 'docx';
import PizZip from 'pizzip';
import type { Project, DocxTemplateAnalysis } from '../types';
import type { ExportOptions } from './docxExport';
import { resolveAllLinks } from './linkResolver';
import { getDiagramsInOrder } from './figureNumbering';
import {
  generateReferencedDiagramImages,
  buildDiagramImageMap,
  type DiagramImage,
} from './diagramImageExporter';

/**
 * Extract styles.xml from a DOCX template
 * Returns the XML string that can be used with docx library's externalStyles
 */
export function extractStylesFromTemplate(templateBase64: string): string | null {
  try {
    const templateData = atob(templateBase64);
    const zip = new PizZip(templateData);

    const stylesFile = zip.file('word/styles.xml');
    if (!stylesFile) {
      console.warn('[Template Export] No styles.xml found in template');
      return null;
    }

    const stylesXml = stylesFile.asText();
    console.log('[Template Export] Extracted styles.xml, length:', stylesXml.length);
    return stylesXml;
  } catch (error) {
    console.error('[Template Export] Failed to extract styles:', error);
    return null;
  }
}

/**
 * Map heading level to HeadingLevel enum
 */
function getHeadingLevel(level: number): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  const levelMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
    6: HeadingLevel.HEADING_6,
  };
  return levelMap[level] || HeadingLevel.HEADING_6;
}

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
 * Convert markdown inline formatting to TextRun array
 */
function parseInlineMarkdown(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let lastIndex = 0;

  // Pattern for bold, italic, code, links
  const pattern = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|(`)(.*?)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      runs.push(new TextRun(text.substring(lastIndex, match.index)));
    }

    if (match[2]) {
      // Bold: **text** or __text__
      runs.push(new TextRun({ text: match[2], bold: true }));
    } else if (match[4]) {
      // Italic: *text* or _text_
      runs.push(new TextRun({ text: match[4], italics: true }));
    } else if (match[6]) {
      // Code: `text`
      runs.push(new TextRun({
        text: match[6],
        font: 'Courier New',
        size: 20, // 10pt
      }));
    } else if (match[7] && match[8]) {
      // Link: [text](url) - just show text
      runs.push(new TextRun({ text: match[7], color: '0563C1', underline: {} }));
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    runs.push(new TextRun(text.substring(lastIndex)));
  }

  // If no matches, return simple text
  if (runs.length === 0) {
    runs.push(new TextRun(text));
  }

  return runs;
}

/**
 * Parse markdown table
 */
function parseMarkdownTable(lines: string[]): { headers: string[]; rows: string[][] } | null {
  if (lines.length < 2) return null;

  // First line should be header
  const headerLine = lines[0];
  if (!headerLine.includes('|')) return null;

  // Second line should be separator
  const separatorLine = lines[1];
  if (!separatorLine.match(/^\|?[\s\-:|]+\|?$/)) return null;

  // Parse header
  const headers = headerLine.split('|').map(s => s.trim()).filter(s => s);

  // Parse rows
  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('|')) break;
    const cells = line.split('|').map(s => s.trim()).filter(s => s);
    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  return { headers, rows };
}

/**
 * Create a table from parsed markdown
 */
function createTable(tableData: { headers: string[]; rows: string[][] }): Table {
  const { headers, rows } = tableData;

  const headerRow = new TableRow({
    children: headers.map(header => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text: header, bold: true })],
      })],
      shading: { fill: 'E7E6E6' },
    })),
  });

  const dataRows = rows.map(row => new TableRow({
    children: row.map(cell => new TableCell({
      children: [new Paragraph({
        children: parseInlineMarkdown(cell),
      })],
    })),
  }));

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

/**
 * Convert markdown to DOCX paragraphs with template styles
 */
async function markdownToDocxElements(
  markdown: string,
  project: Project,
  options: ExportOptions,
  templateAnalysis?: DocxTemplateAnalysis | null,
): Promise<(Paragraph | Table)[]> {
  const elements: (Paragraph | Table)[] = [];
  const lines = markdown.split('\n');

  // Generate diagram images if embedding is enabled
  let diagramImages: DiagramImage[] = [];
  let imageMap: Map<string, DiagramImage> = new Map();

  if (options.embedDiagrams) {
    console.log('[Template Export] Generating diagram images...');
    diagramImages = await generateReferencedDiagramImages(project);
    imageMap = buildDiagramImageMap(diagramImages);
    console.log(`[Template Export] Generated ${diagramImages.length} diagram images`);
  }

  // Build figure references for link resolution
  const mermaidDiagrams = [
    ...project.sequenceDiagrams,
    ...project.flowDiagrams,
  ];
  const allFigures = getDiagramsInOrder(
    project.specification.markdown,
    project.blockDiagrams,
    mermaidDiagrams
  ).map(d => ({
    id: d.id,
    number: d.figureNumber || 'X-X',
    title: d.title,
    type: d.type as 'block' | 'sequence' | 'flow',
  }));

  const citations = project.references.map((ref, index) => ({
    id: ref.id,
    number: String(index + 1),
    title: ref.title,
  }));

  // Get caption style from template
  const captionStyleId = templateAnalysis?.captionStyles?.figureCaption?.styleId;

  let i = 0;
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];

  while (i < lines.length) {
    const line = lines[i];

    // Handle code blocks
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockContent = [];
      } else {
        // End of code block
        inCodeBlock = false;

        // Get code style from template or use default
        const codeStyleId = templateAnalysis?.specialStyles?.otherStyles.find(
          s => /code|source|listing/i.test(s.name)
        )?.styleId;

        // Add code block as paragraphs with monospace font
        elements.push(new Paragraph({
          children: [new TextRun({
            text: codeBlockContent.join('\n'),
            font: 'Courier New',
            size: 18, // 9pt
          })],
          style: codeStyleId,
          spacing: { before: 120, after: 120 },
        }));
      }
      i++;
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      i++;
      continue;
    }

    // Skip empty lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // Handle headings
    const heading = parseHeading(line);
    if (heading) {
      elements.push(new Paragraph({
        text: heading.text,
        heading: getHeadingLevel(heading.level),
      }));
      i++;
      continue;
    }

    // Handle figure references {{fig:...}}
    const figMatch = line.match(/\{\{fig:([^}]+)\}\}/);
    if (figMatch && options.embedDiagrams) {
      const figRef = figMatch[1];
      const image = imageMap.get(figRef);

      if (image && image.arrayBuffer) {
        // Add the image
        const maxWidth = 500; // pixels
        const scale = Math.min(1, maxWidth / image.width);
        const width = Math.round(image.width * scale);
        const height = Math.round(image.height * scale);

        elements.push(new Paragraph({
          children: [
            new ImageRun({
              data: image.arrayBuffer,
              transformation: { width, height },
              type: 'png',
            }),
          ],
          alignment: AlignmentType.CENTER,
        }));

        // Add caption using template style
        elements.push(new Paragraph({
          children: [
            new TextRun({ text: `Figure ${image.figureNumber || 'X-X'}: `, bold: true }),
            new TextRun({ text: image.title }),
          ],
          alignment: AlignmentType.CENTER,
          style: captionStyleId,
        }));
      } else {
        // Resolve the line normally if image not found
        const resolved = resolveAllLinks(line, allFigures, citations);
        elements.push(new Paragraph({
          children: parseInlineMarkdown(resolved),
        }));
      }
      i++;
      continue;
    }

    // Handle tables
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1].match(/^\|?[\s\-:|]+\|?$/)) {
      const tableLines: string[] = [];
      while (i < lines.length && (lines[i].includes('|') || lines[i].match(/^\|?[\s\-:|]+\|?$/))) {
        tableLines.push(lines[i]);
        i++;
      }
      const tableData = parseMarkdownTable(tableLines);
      if (tableData) {
        elements.push(createTable(tableData));
      }
      continue;
    }

    // Handle blockquotes
    if (line.startsWith('>')) {
      const quoteText = line.replace(/^>\s?/, '');
      const quoteStyleId = templateAnalysis?.specialStyles?.otherStyles.find(
        s => /quote|block\s*text/i.test(s.name)
      )?.styleId;

      elements.push(new Paragraph({
        children: parseInlineMarkdown(quoteText),
        style: quoteStyleId,
        indent: { left: 720 }, // 0.5 inch indent
      }));
      i++;
      continue;
    }

    // Handle bullet lists
    if (line.match(/^[-*]\s+/)) {
      const listText = line.replace(/^[-*]\s+/, '');
      elements.push(new Paragraph({
        children: parseInlineMarkdown(resolveAllLinks(listText, allFigures, citations)),
        bullet: { level: 0 },
      }));
      i++;
      continue;
    }

    // Handle numbered lists
    if (line.match(/^\d+\.\s+/)) {
      const listText = line.replace(/^\d+\.\s+/, '');
      elements.push(new Paragraph({
        children: parseInlineMarkdown(resolveAllLinks(listText, allFigures, citations)),
        numbering: { reference: 'default-numbering', level: 0 },
      }));
      i++;
      continue;
    }

    // Regular paragraph
    const resolved = resolveAllLinks(line, allFigures, citations);
    elements.push(new Paragraph({
      children: parseInlineMarkdown(resolved),
    }));
    i++;
  }

  return elements;
}

/**
 * Export project to DOCX using template styles
 */
export async function exportWithTemplate(
  project: Project,
  templateBase64: string,
  options: ExportOptions,
  templateAnalysis?: DocxTemplateAnalysis | null,
): Promise<Blob> {
  try {
    console.log('[Template Export] Starting export with template styles...');

    // Extract styles from template
    const externalStyles = extractStylesFromTemplate(templateBase64);

    // Convert markdown to DOCX elements
    const contentElements = await markdownToDocxElements(
      project.specification.markdown,
      project,
      options,
      templateAnalysis,
    );

    // Build the document sections
    const children: (Paragraph | Table)[] = [];

    // Title page
    children.push(new Paragraph({
      text: project.specification.title || project.name,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { before: 3000, after: 500 },
    }));

    if (project.specification.metadata?.version) {
      children.push(new Paragraph({
        text: `Version ${project.specification.metadata.version}`,
        alignment: AlignmentType.CENTER,
        spacing: { after: 500 },
      }));
    }

    children.push(new Paragraph({
      text: new Date().toLocaleDateString(),
      alignment: AlignmentType.CENTER,
      spacing: { after: 2000 },
    }));

    // Page break before content
    children.push(new Paragraph({ pageBreakBefore: true }));

    // Add content
    children.push(...contentElements);

    // Create document with external styles
    const doc = new Document({
      externalStyles: externalStyles || undefined,
      numbering: {
        config: [{
          reference: 'default-numbering',
          levels: [{
            level: 0,
            format: 'decimal',
            text: '%1.',
            alignment: AlignmentType.START,
          }],
        }],
      },
      sections: [{
        children,
      }],
    });

    console.log('[Template Export] Generating DOCX...');
    const blob = await Packer.toBlob(doc);

    console.log('[Template Export] Export complete, size:', blob.size);
    return blob;
  } catch (error) {
    console.error('[Template Export] Export failed:', error);
    throw new Error(`Failed to export with template: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Download helper
 */
export function downloadTemplateDocx(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
