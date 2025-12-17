/**
 * Pandoc Export Utilities
 *
 * Export specifications using Pandoc backend service with Word templates.
 * Provides professional DOCX export with corporate branding preservation.
 */

import type { Project } from '../types';
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
