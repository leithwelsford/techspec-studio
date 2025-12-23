/**
 * Template-based DOCX Export
 *
 * Uses an uploaded DOCX template and replaces placeholders with specification content.
 * Template should contain placeholders like {{TITLE}}, {{CONTENT}}, {{AUTHOR}}, etc.
 */

import PizZip from 'pizzip';
import type { Project } from '../types';
import type { ExportOptions } from './docxExport';
import { resolveAllLinks, parseFigureReferences } from './linkResolver';
import {
  generateReferencedDiagramImages,
  buildDiagramImageMap,
  calculateEmuDimensions,
  type DiagramImage,
} from './diagramImageExporter';

/**
 * Normalize Word XML to merge split text runs
 * Word often splits {{PLACEHOLDER}} across multiple <w:t> tags like:
 * <w:t>{{</w:t><w:t>TITLE</w:t><w:t>}}</w:t>
 * This function merges them into a single run for easier replacement
 */
function normalizeWordXml(xml: string): string {
  // Merge consecutive <w:t> elements within the same <w:r> (run)
  return xml.replace(/<w:r[^>]*>(.*?)<\/w:r>/g, (match, runContent) => {
    // Extract all text content from <w:t> tags within this run
    const textParts: string[] = [];
    let normalizedContent = runContent.replace(/<w:t[^>]*>(.*?)<\/w:t>/g, (_: string, text: string) => {
      textParts.push(text);
      return ''; // Remove the original <w:t> tags
    });

    // If we found text, replace with a single merged <w:t> tag
    if (textParts.length > 0) {
      const mergedText = textParts.join('');
      // Re-insert the merged text as a single <w:t> tag
      // Keep any other run properties (formatting) that might exist
      const beforeText = normalizedContent.substring(0, normalizedContent.lastIndexOf('</w:rPr>') + 8);
      const afterText = normalizedContent.substring(normalizedContent.lastIndexOf('</w:rPr>') + 8);

      if (normalizedContent.includes('</w:rPr>')) {
        return `<w:r>${beforeText}<w:t xml:space="preserve">${mergedText}</w:t>${afterText}</w:r>`;
      } else {
        return `<w:r><w:t xml:space="preserve">${mergedText}</w:t>${normalizedContent}</w:r>`;
      }
    }

    return match; // Return original if no text found
  });
}

/**
 * Replace placeholders in template XML
 */
function replacePlaceholders(xml: string, replacements: Record<string, string>): string {
  // First normalize XML to merge split text runs
  let result = normalizeWordXml(xml);

  console.log('[Template Export] Starting placeholder replacement...');

  // Debug: Show a sample of the normalized XML
  const sample = result.substring(0, 2000);
  console.log('[Template Export] Normalized XML sample (first 2000 chars):', sample);

  // Debug: Search for any double curly braces
  const doubleBraceMatches = result.match(/\{\{[^}]*\}\}/g);
  if (doubleBraceMatches) {
    console.log('[Template Export] Found placeholders in template:', doubleBraceMatches);
  } else {
    console.warn('[Template Export] NO placeholders found in template!');
  }

  for (const [key, value] of Object.entries(replacements)) {
    // Replace {{KEY}} with value
    const placeholder = `{{${key}}}`;
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    const matches = result.match(regex);

    if (matches) {
      console.log(`[Template Export] Found ${matches.length} occurrence(s) of ${placeholder}`);
      console.log(`[Template Export] Replacing with: ${value.substring(0, 100)}${value.length > 100 ? '...' : ''}`);
      result = result.replace(regex, value); // Don't escape - value is already WordML XML
    } else {
      console.warn(`[Template Export] Placeholder ${placeholder} not found in template`);
    }
  }

  return result;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convert markdown to WordprocessingML (DOCX XML format)
 */
function markdownToWordML(markdown: string): string {
  const lines = markdown.split('\n');
  let xml = '';

  for (const line of lines) {
    if (!line.trim()) {
      // Empty paragraph
      xml += '<w:p><w:pPr></w:pPr></w:p>';
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      xml += `<w:p><w:pPr><w:pStyle w:val="Heading${level}"/></w:pPr><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
      continue;
    }

    // Lists
    if (line.match(/^[-*]\s+/)) {
      const text = line.replace(/^[-*]\s+/, '');
      xml += `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
      continue;
    }

    // Regular paragraph with inline formatting
    let processedLine = line;

    // Bold: **text**
    processedLine = processedLine.replace(/\*\*(.+?)\*\*/g, '<w:r><w:rPr><w:b/></w:rPr><w:t>$1</w:t></w:r>');

    // Italic: *text*
    processedLine = processedLine.replace(/\*(.+?)\*/g, '<w:r><w:rPr><w:i/></w:rPr><w:t>$1</w:t></w:r>');

    // Code: `code`
    processedLine = processedLine.replace(/`(.+?)`/g, '<w:r><w:rPr><w:rFonts w:ascii="Courier New"/></w:rPr><w:t>$1</w:t></w:r>');

    xml += `<w:p><w:r><w:t>${processedLine}</w:t></w:r></w:p>`;
  }

  return xml;
}

/**
 * Generate Table of Contents XML
 */
function generateTOCXml(): string {
  return `<w:p>
    <w:pPr><w:pStyle w:val="TOC"/></w:pPr>
    <w:r><w:t>Table of Contents</w:t></w:r>
  </w:p>
  <w:p>
    <w:pPr><w:pStyle w:val="TOCHeading"/></w:pPr>
  </w:p>
  <w:sdt>
    <w:sdtContent>
      <w:p>
        <w:pPr><w:pStyle w:val="TOC1"/></w:pPr>
        <w:hyperlink w:anchor="_Toc">
          <w:r><w:t>Contents will be generated by Word when document is opened</w:t></w:r>
        </w:hyperlink>
      </w:p>
    </w:sdtContent>
  </w:sdt>`;
}

/**
 * Generate List of Figures XML
 */
function generateListOfFiguresXml(figures: Array<{ number: string; title: string }>): string {
  let xml = `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>List of Figures</w:t></w:r></w:p>`;

  for (const figure of figures) {
    xml += `<w:p><w:r><w:t>Figure ${figure.number}: ${escapeXml(figure.title)}</w:t></w:r></w:p>`;
  }

  return xml;
}

/**
 * Generate Bibliography XML
 */
function generateBibliographyXml(references: Array<{ number: string; title: string }>): string {
  let xml = `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>References</w:t></w:r></w:p>`;

  for (const ref of references) {
    xml += `<w:p><w:r><w:t>[${ref.number}] ${escapeXml(ref.title)}</w:t></w:r></w:p>`;
  }

  return xml;
}

/**
 * Add image to DOCX ZIP structure
 * Returns the relationship ID for the image
 */
function addImageToDocx(
  zip: PizZip,
  imageData: Uint8Array,
  imageIndex: number
): string {
  const rId = `rIdImg${imageIndex}`;
  const imagePath = `word/media/image${imageIndex}.png`;

  // Add image to media folder
  zip.file(imagePath, imageData);

  return rId;
}

/**
 * Update [Content_Types].xml to include PNG images
 */
function updateContentTypes(zip: PizZip): void {
  const contentTypesPath = '[Content_Types].xml';
  let contentTypes = zip.file(contentTypesPath)?.asText();

  if (!contentTypes) {
    console.warn('[Template Export] Content_Types.xml not found');
    return;
  }

  // Check if PNG extension is already defined
  if (!contentTypes.includes('Extension="png"')) {
    // Add PNG extension before </Types>
    contentTypes = contentTypes.replace(
      '</Types>',
      '<Default Extension="png" ContentType="image/png"/></Types>'
    );
    zip.file(contentTypesPath, contentTypes);
  }
}

/**
 * Add image relationships to document.xml.rels
 */
function addImageRelationships(
  zip: PizZip,
  images: Array<{ rId: string; imageIndex: number }>
): void {
  const relsPath = 'word/_rels/document.xml.rels';
  let rels = zip.file(relsPath)?.asText();

  if (!rels) {
    // Create new relationships file if it doesn't exist
    rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;
  }

  // Add relationship for each image
  for (const img of images) {
    const relationship = `<Relationship Id="${img.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${img.imageIndex}.png"/>`;

    // Insert before closing tag
    rels = rels.replace('</Relationships>', `${relationship}</Relationships>`);
  }

  zip.file(relsPath, rels);
}

/**
 * Generate Word drawing XML for inline image
 * Uses DrawingML format for proper image embedding
 */
function generateDrawingXml(
  rId: string,
  image: DiagramImage,
  figureNumber: string
): string {
  // Calculate dimensions in EMUs (English Metric Units)
  // 914400 EMUs = 1 inch
  const { widthEmu, heightEmu } = calculateEmuDimensions(image.width, image.height, 6.0);

  // Unique IDs for drawing elements
  const docPrId = Math.floor(Math.random() * 100000);

  return `<w:p>
    <w:pPr><w:jc w:val="center"/></w:pPr>
    <w:r>
      <w:drawing>
        <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
          <wp:extent cx="${widthEmu}" cy="${heightEmu}"/>
          <wp:effectExtent l="0" t="0" r="0" b="0"/>
          <wp:docPr id="${docPrId}" name="${escapeXml(image.title)}" descr="${escapeXml(image.title)}"/>
          <wp:cNvGraphicFramePr>
            <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
          </wp:cNvGraphicFramePr>
          <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:nvPicPr>
                  <pic:cNvPr id="${docPrId}" name="${escapeXml(image.title)}"/>
                  <pic:cNvPicPr/>
                </pic:nvPicPr>
                <pic:blipFill>
                  <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rId}"/>
                  <a:stretch>
                    <a:fillRect/>
                  </a:stretch>
                </pic:blipFill>
                <pic:spPr>
                  <a:xfrm>
                    <a:off x="0" y="0"/>
                    <a:ext cx="${widthEmu}" cy="${heightEmu}"/>
                  </a:xfrm>
                  <a:prstGeom prst="rect">
                    <a:avLst/>
                  </a:prstGeom>
                </pic:spPr>
              </pic:pic>
            </a:graphicData>
          </a:graphic>
        </wp:inline>
      </w:drawing>
    </w:r>
  </w:p>
  <w:p>
    <w:pPr><w:pStyle w:val="Caption"/><w:jc w:val="center"/></w:pPr>
    <w:r><w:rPr><w:b/></w:rPr><w:t>Figure ${figureNumber}: ${escapeXml(image.title)}</w:t></w:r>
  </w:p>`;
}

/**
 * Process markdown and embed diagrams as images
 * Returns WordML with embedded images
 */
async function processMarkdownWithDiagrams(
  markdown: string,
  project: Project,
  zip: PizZip,
  embedDiagrams: boolean
): Promise<string> {
  if (!embedDiagrams) {
    // No diagram embedding - just convert markdown to WordML
    const allFigures = [
      ...project.blockDiagrams.map(d => ({ id: d.id, number: d.figureNumber || 'X-X', title: d.title, type: 'block' as const })),
      ...project.sequenceDiagrams.map(d => ({ id: d.id, number: d.figureNumber || 'X-X', title: d.title, type: 'sequence' as const })),
      ...project.flowDiagrams.map(d => ({ id: d.id, number: d.figureNumber || 'X-X', title: d.title, type: 'flow' as const })),
    ];
    const citations = project.references.map((ref, index) => ({
      id: ref.id,
      number: String(index + 1),
      title: ref.title,
    }));
    const resolvedMarkdown = resolveAllLinks(markdown, allFigures, citations);
    return markdownToWordML(resolvedMarkdown);
  }

  // Generate diagram images
  console.log('[Template Export] Generating diagram images...');
  const images = await generateReferencedDiagramImages(project);
  const imageMap = buildDiagramImageMap(images);
  console.log(`[Template Export] Generated ${images.length} diagram images`);

  // Add images to DOCX structure
  const imageRelationships: Array<{ rId: string; imageIndex: number }> = [];
  const rIdMap = new Map<string, string>();

  let imageIndex = 1;
  for (const image of images) {
    const imageData = new Uint8Array(image.arrayBuffer);
    const rId = addImageToDocx(zip, imageData, imageIndex);
    imageRelationships.push({ rId, imageIndex });
    rIdMap.set(image.id, rId);
    if (image.figureNumber) {
      rIdMap.set(image.figureNumber, rId);
    }
    imageIndex++;
  }

  // Update content types and relationships
  updateContentTypes(zip);
  addImageRelationships(zip, imageRelationships);

  // Build figure references for link resolution
  const allFigures = [
    ...project.blockDiagrams.map(d => ({ id: d.id, number: d.figureNumber || 'X-X', title: d.title, type: 'block' as const })),
    ...project.sequenceDiagrams.map(d => ({ id: d.id, number: d.figureNumber || 'X-X', title: d.title, type: 'sequence' as const })),
    ...project.flowDiagrams.map(d => ({ id: d.id, number: d.figureNumber || 'X-X', title: d.title, type: 'flow' as const })),
  ];
  const citations = project.references.map((ref, index) => ({
    id: ref.id,
    number: String(index + 1),
    title: ref.title,
  }));

  // Process markdown line by line
  const lines = markdown.split('\n');
  let xml = '';

  for (const line of lines) {
    const figureRefs = parseFigureReferences(line);

    if (figureRefs.length > 0) {
      // Resolve the text part of the line
      const resolvedLine = resolveAllLinks(line, allFigures, citations);

      // Add the text paragraph
      if (resolvedLine.trim()) {
        xml += markdownToWordML(resolvedLine);
      }

      // Add diagram images after the reference
      for (const figRef of figureRefs) {
        const image = imageMap.get(figRef);
        if (image) {
          const rId = rIdMap.get(image.id) || rIdMap.get(figRef);
          if (rId) {
            xml += generateDrawingXml(rId, image, image.figureNumber || 'X-X');
          }
        } else {
          // Placeholder for missing diagram
          xml += `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/></w:rPr><w:t>[Diagram not found: ${escapeXml(figRef)}]</w:t></w:r></w:p>`;
        }
      }
    } else {
      // No figure references - resolve and convert normally
      const resolvedLine = resolveAllLinks(line, allFigures, citations);
      xml += markdownToWordML(resolvedLine);
    }
  }

  return xml;
}

/**
 * Export project to DOCX using template
 */
export async function exportWithTemplate(
  project: Project,
  templateBase64: string,
  options: ExportOptions
): Promise<Blob> {
  try {
    console.log('[Template Export] Starting export...');
    console.log('[Template Export] Template base64 length:', templateBase64?.length);
    console.log('[Template Export] Project:', project?.name);

    // Decode template from base64
    const templateData = atob(templateBase64);
    console.log('[Template Export] Decoded template data length:', templateData.length);

    const zip = new PizZip(templateData);
    console.log('[Template Export] PizZip created');

    // Get document.xml
    const documentXml = zip.file('word/document.xml')?.asText();
    if (!documentXml) {
      throw new Error('Invalid template: document.xml not found');
    }

    console.log('[Template Export] Template loaded successfully');
    console.log('[Template Export] Document XML length:', documentXml.length);

    // Process markdown with optional diagram embedding
    const contentXml = await processMarkdownWithDiagrams(
      project.specification.markdown,
      project,
      zip,
      options.embedDiagrams
    );

    // Build figure list for List of Figures section
    const allFigures = [
      ...project.blockDiagrams.map(d => ({ id: d.id, number: d.figureNumber || 'X-X', title: d.title, type: 'block' as const })),
      ...project.sequenceDiagrams.map(d => ({ id: d.id, number: d.figureNumber || 'X-X', title: d.title, type: 'sequence' as const })),
      ...project.flowDiagrams.map(d => ({ id: d.id, number: d.figureNumber || 'X-X', title: d.title, type: 'flow' as const })),
    ];

    const citations = project.references.map((ref, index) => ({
      id: ref.id,
      number: String(index + 1),
      title: ref.title,
    }));

    // Prepare replacements
    const replacements: Record<string, string> = {
      TITLE: project.specification.title || project.name,
      VERSION: project.version,
      DATE: new Date().toLocaleDateString(),
      AUTHOR: options.author || project.specification.metadata.author || '',
      COMPANY: options.company || '',
      CUSTOMER: project.specification.metadata.customer || '',
      CONTENT: contentXml,
    };

    // Add optional sections
    if (options.includeTOC) {
      replacements.TOC = generateTOCXml();
    } else {
      replacements.TOC = '';
    }

    if (options.includeListOfFigures) {
      replacements.FIGURES = generateListOfFiguresXml(allFigures);
    } else {
      replacements.FIGURES = '';
    }

    if (options.includeBibliography) {
      replacements.BIBLIOGRAPHY = generateBibliographyXml(citations);
    } else {
      replacements.BIBLIOGRAPHY = '';
    }

    // Replace placeholders in document XML
    console.log('[Template Export] Replacing placeholders...');
    const updatedXml = replacePlaceholders(documentXml, replacements);
    console.log('[Template Export] Updated XML length:', updatedXml.length);

    // Update document.xml in zip
    zip.file('word/document.xml', updatedXml);
    console.log('[Template Export] Updated document.xml in zip');

    // Generate binary string using PizZip
    console.log('[Template Export] Generating DOCX...');
    const content = zip.generate({
      type: 'base64',
      compression: 'DEFLATE',
    });
    console.log('[Template Export] Generated base64 length:', content.length);

    // Convert base64 to blob
    const binary = atob(content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    console.log('[Template Export] Blob created, size:', bytes.length);
    return new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  } catch (error) {
    console.error('Template export error:', error);
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
