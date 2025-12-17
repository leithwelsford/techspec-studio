/**
 * Pandoc Export Utilities
 *
 * Export specifications using Pandoc backend service with Word templates.
 * Provides professional DOCX export with corporate branding preservation.
 */

import type { Project, MarkdownGenerationGuidance } from '../types';
import { resolveAllLinks } from './linkResolver';

const PANDOC_API_URL = import.meta.env.VITE_PANDOC_API_URL || 'http://localhost:3001/api';

export interface PandocExportOptions {
  includeTOC?: boolean;
  includeNumberSections?: boolean;
  includeFigures?: boolean;
  includeFigureList?: boolean; // List of Figures
  includeTableList?: boolean; // List of Tables
  includeBibliography?: boolean;
  embedDiagrams?: boolean;
  author?: string;
  company?: string;
  // Template-derived style mappings
  pandocStyles?: MarkdownGenerationGuidance['pandocStyles'];
}

// ========== Markdown Transformation for Pandoc Custom Styles ==========

/**
 * Apply Pandoc custom-style wrappers to markdown content
 * Transforms lists and captions to use ::: {custom-style="..."} syntax
 */
export function applyPandocCustomStyles(
  markdown: string,
  pandocStyles?: MarkdownGenerationGuidance['pandocStyles']
): string {
  if (!pandocStyles?.enabled) {
    console.log('[Pandoc Export] Custom styles disabled, skipping transformation');
    return markdown;
  }

  console.log('[Pandoc Export] Applying custom styles:', pandocStyles);
  let result = markdown;

  // Transform bullet lists
  if (pandocStyles.bulletList) {
    result = wrapBulletLists(result, pandocStyles.bulletList);
  }

  // Transform numbered lists
  if (pandocStyles.numberedList) {
    result = wrapNumberedLists(result, pandocStyles.numberedList);
  }

  // Transform figure captions
  if (pandocStyles.figureCaption) {
    result = wrapFigureCaptions(result, pandocStyles.figureCaption);
  }

  // Transform table captions
  if (pandocStyles.tableCaption) {
    result = wrapTableCaptions(result, pandocStyles.tableCaption);
  }

  return result;
}

/**
 * Wrap bullet lists with Pandoc custom-style div
 * Finds contiguous bullet list blocks and wraps them
 */
function wrapBulletLists(markdown: string, styleName: string): string {
  // Match contiguous bullet list blocks (lines starting with - or *)
  // Must handle multi-line items and nested lists
  const lines = markdown.split('\n');
  const result: string[] = [];
  let inList = false;
  let listBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBulletLine = /^(\s*)[-*]\s/.test(line);
    const isContinuation = /^\s{2,}/.test(line) && !line.trim().startsWith('#'); // Indented continuation
    const isEmptyInList = line.trim() === '' && inList && i + 1 < lines.length && /^(\s*)[-*]\s/.test(lines[i + 1]);

    if (isBulletLine || (inList && (isContinuation || isEmptyInList))) {
      if (!inList) {
        inList = true;
        listBuffer = [];
      }
      listBuffer.push(line);
    } else {
      if (inList) {
        // End of list - wrap and flush
        result.push(`::: {custom-style="${styleName}"}`);
        result.push(...listBuffer);
        result.push(':::');
        result.push('');
        inList = false;
        listBuffer = [];
      }
      result.push(line);
    }
  }

  // Handle list at end of document
  if (inList && listBuffer.length > 0) {
    result.push(`::: {custom-style="${styleName}"}`);
    result.push(...listBuffer);
    result.push(':::');
  }

  return result.join('\n');
}

/**
 * Wrap numbered lists with Pandoc custom-style div
 * Finds contiguous numbered list blocks and wraps them
 */
function wrapNumberedLists(markdown: string, styleName: string): string {
  const lines = markdown.split('\n');
  const result: string[] = [];
  let inList = false;
  let listBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isNumberedLine = /^(\s*)\d+\.\s/.test(line);
    const isContinuation = /^\s{2,}/.test(line) && !line.trim().startsWith('#');
    const isEmptyInList = line.trim() === '' && inList && i + 1 < lines.length && /^(\s*)\d+\.\s/.test(lines[i + 1]);

    if (isNumberedLine || (inList && (isContinuation || isEmptyInList))) {
      if (!inList) {
        inList = true;
        listBuffer = [];
      }
      listBuffer.push(line);
    } else {
      if (inList) {
        // End of list - wrap and flush
        result.push(`::: {custom-style="${styleName}"}`);
        result.push(...listBuffer);
        result.push(':::');
        result.push('');
        inList = false;
        listBuffer = [];
      }
      result.push(line);
    }
  }

  // Handle list at end of document
  if (inList && listBuffer.length > 0) {
    result.push(`::: {custom-style="${styleName}"}`);
    result.push(...listBuffer);
    result.push(':::');
  }

  return result.join('\n');
}

/**
 * Wrap figure captions with Pandoc custom-style
 * Matches patterns like: *Figure 1-1: Caption text*
 */
function wrapFigureCaptions(markdown: string, styleName: string): string {
  // Match italic figure captions: *Figure X-X: text*
  // Also match bold: **Figure X-X: text**
  return markdown.replace(
    /^(\*{1,2})(Figure\s+[\d\-\.]+:?\s+[^\*]+)\1\s*$/gim,
    `::: {custom-style="${styleName}"}\n$1$2$1\n:::`
  );
}

/**
 * Wrap table captions with Pandoc custom-style
 * Matches patterns like: *Table 1-1: Caption text*
 * Also looks for "Table:" prefix before markdown tables
 */
function wrapTableCaptions(markdown: string, styleName: string): string {
  // Match italic table captions: *Table X-X: text*
  let result = markdown.replace(
    /^(\*{1,2})(Table\s+[\d\-\.]+:?\s+[^\*]+)\1\s*$/gim,
    `::: {custom-style="${styleName}"}\n$1$2$1\n:::`
  );

  // Also match plain table captions that precede a markdown table
  // Pattern: "Table X-X: text" followed by a blank line and then "|"
  result = result.replace(
    /^(Table\s+[\d\-\.]+:?\s+.+)\n\n(\|)/gim,
    `::: {custom-style="${styleName}"}\n$1\n:::\n\n$2`
  );

  return result;
}

/**
 * Check if Pandoc service is available
 */
export async function checkPandocService(): Promise<boolean> {
  try {
    const response = await fetch(`${PANDOC_API_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      console.warn('[Pandoc Export] Service returned non-OK status:', response.status);
      return false;
    }

    const data = await response.json();
    console.log('[Pandoc Export] Service available:', data);
    return data.status === 'ok';

  } catch (error) {
    console.warn('[Pandoc Export] Service not available:', error);
    return false;
  }
}

/**
 * Export project using Pandoc with template
 *
 * @param project - Complete project state
 * @param templateFile - Word template file (.docx)
 * @param options - Export options
 * @returns DOCX blob
 */
export async function exportWithPandoc(
  project: Project,
  templateFile: File,
  options: PandocExportOptions
): Promise<Blob> {
  console.log('[Pandoc Export] Starting export...');
  console.log('[Pandoc Export] Options:', options);

  // Build figures array for link resolution
  const allFigures = [
    ...project.blockDiagrams.map(d => ({
      id: d.id,
      number: d.figureNumber || 'X-X',
      title: d.title,
      type: 'block' as const
    })),
    ...project.sequenceDiagrams.map(d => ({
      id: d.id,
      number: d.figureNumber || 'X-X',
      title: d.title,
      type: 'sequence' as const
    })),
    ...project.flowDiagrams.map(d => ({
      id: d.id,
      number: d.figureNumber || 'X-X',
      title: d.title,
      type: 'flow' as const
    })),
  ];

  // Build citations array for link resolution
  const citations = project.references.map((ref, index) => ({
    id: ref.id,
    number: String(index + 1),
    title: ref.title,
  }));

  // Resolve all {{fig:...}} and {{ref:...}} links in markdown
  let resolvedMarkdown = resolveAllLinks(
    project.specification.markdown,
    allFigures,
    citations
  );

  // Strip manual numbering from headings (e.g., "# 1. Introduction" → "# Introduction")
  // This prevents double-numbering when Pandoc's --number-sections is enabled
  resolvedMarkdown = resolvedMarkdown.replace(/^(#{1,6})\s+\d+(\.\d+)*\.?\s+/gm, '$1 ');

  // Apply Pandoc custom-style wrappers for lists and captions
  // This uses the template-derived style names from pandocStyles
  if (options.pandocStyles) {
    resolvedMarkdown = applyPandocCustomStyles(resolvedMarkdown, options.pandocStyles);
  }

  // Add YAML front matter for title page metadata
  // This ensures title, subtitle, version, etc. are handled as metadata, not content
  const yamlFrontMatter = `---
title: "${project.specification.title || 'Technical Specification'}"
${project.specification.subtitle ? `subtitle: "${project.specification.subtitle}"` : ''}
author: "${options.author || project.specification.author || 'TechSpec Studio'}"
date: "${new Date().toISOString().split('T')[0]}"
version: "${project.specification.metadata?.version || project.version}"
abstract: |
  ${project.specification.metadata?.abstract || 'This document provides a comprehensive technical specification.'}
---

`;

  // Build front matter sections (TOC, LoF, LoT)
  let frontMatterSections = '';

  // List of Figures - raw OOXML field code
  if (options.includeFigureList) {
    frontMatterSections += `
## List of Figures

\`\`\`{=openxml}
<w:p>
  <w:r>
    <w:fldChar w:fldCharType="begin"/>
  </w:r>
  <w:r>
    <w:instrText xml:space="preserve"> TOC \\h \\z \\c "Figure" </w:instrText>
  </w:r>
  <w:r>
    <w:fldChar w:fldCharType="separate"/>
  </w:r>
  <w:r>
    <w:rPr><w:i/></w:rPr>
    <w:t>Right-click and select "Update Field" to populate</w:t>
  </w:r>
  <w:r>
    <w:fldChar w:fldCharType="end"/>
  </w:r>
</w:p>
\`\`\`

\\newpage

`;
  }

  // List of Tables - raw OOXML field code
  if (options.includeTableList) {
    frontMatterSections += `
## List of Tables

\`\`\`{=openxml}
<w:p>
  <w:r>
    <w:fldChar w:fldCharType="begin"/>
  </w:r>
  <w:r>
    <w:instrText xml:space="preserve"> TOC \\h \\z \\c "Table" </w:instrText>
  </w:r>
  <w:r>
    <w:fldChar w:fldCharType="separate"/>
  </w:r>
  <w:r>
    <w:rPr><w:i/></w:rPr>
    <w:t>Right-click and select "Update Field" to populate</w:t>
  </w:r>
  <w:r>
    <w:fldChar w:fldCharType="end"/>
  </w:r>
</w:p>
\`\`\`

\\newpage

`;
  }

  const markdownWithMetadata = yamlFrontMatter + frontMatterSections + resolvedMarkdown;

  console.log('[Pandoc Export] Markdown resolved:', markdownWithMetadata.length, 'characters');

  // Create form data for multipart upload
  const formData = new FormData();

  // Add markdown file with YAML front matter
  const markdownBlob = new Blob([markdownWithMetadata], { type: 'text/markdown' });
  formData.append('markdown', markdownBlob, 'input.md');

  // Add template file
  formData.append('template', templateFile, templateFile.name);

  // Add export options
  const exportOptions = {
    includeTOC: options.includeTOC,
    includeNumberSections: options.includeNumberSections,
    metadata: {
      title: project.specification.title || 'Technical Specification',
      author: options.author || project.specification.author || 'TechSpec Studio',
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    }
  };

  formData.append('options', JSON.stringify(exportOptions));

  try {
    console.log('[Pandoc Export] Sending request to backend...');

    const response = await fetch(`${PANDOC_API_URL}/export-pandoc`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = 'Pandoc export failed';
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    console.log('[Pandoc Export] Export successful');
    const blob = await response.blob();
    console.log('[Pandoc Export] Received blob:', blob.size, 'bytes');

    return blob;

  } catch (error) {
    console.error('[Pandoc Export] Error:', error);
    throw new Error(
      `Failed to export with Pandoc: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Download DOCX blob with custom filename
 */
export function downloadPandocDocx(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.docx`;

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  console.log('[Pandoc Export] Download initiated:', `${filename}.docx`);
}

/**
 * Get Pandoc service info (for debugging)
 */
export async function getPandocServiceInfo(): Promise<any> {
  try {
    const response = await fetch(`${PANDOC_API_URL}/health`);
    return await response.json();
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
