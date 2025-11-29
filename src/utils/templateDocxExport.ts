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
import { exportBlockDiagramAsPNG, exportMermaidDiagramAsPNG } from './diagramExport';

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
 * Export project to DOCX using template
 */
export async function exportWithTemplate(
  project: Project,
  templateBase64: string,
  options: ExportOptions
): Promise<Blob> {
  try {
    // Decode template from base64
    const templateData = atob(templateBase64);
    const zip = new PizZip(templateData);

    // Get document.xml
    const documentXml = zip.file('word/document.xml')?.asText();
    if (!documentXml) {
      throw new Error('Invalid template: document.xml not found');
    }

    console.log('[Template Export] Template loaded successfully');
    console.log('[Template Export] Document XML length:', documentXml.length);

    // Resolve all links in markdown
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

    const resolvedMarkdown = resolveAllLinks(
      project.specification.markdown,
      allFigures,
      citations
    );

    // Convert markdown to WordML
    const contentXml = markdownToWordML(resolvedMarkdown);

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
    const updatedXml = replacePlaceholders(documentXml, replacements);

    // Update document.xml in zip
    zip.file('word/document.xml', updatedXml);

    // Generate blob using correct PizZip API
    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      compression: 'DEFLATE',
    });

    return blob;
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
