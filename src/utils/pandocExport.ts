/**
 * Pandoc Export Utilities
 *
 * Export specifications using Pandoc backend service with Word templates.
 * Provides professional DOCX export with corporate branding preservation.
 */

import PizZip from 'pizzip';
import type { Project, MarkdownGenerationGuidance, PandocStyleRoleMap } from '../types';
import { resolveAllLinks } from './linkResolver';
import {
  generateReferencedDiagramImages,
  transformMarkdownWithImages,
  type DiagramImage,
} from './diagramImageExporter';
import { generateLuaFilter } from './luaFilterGenerator';
import { generateFrontMatter } from './frontMatterGenerator';

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
  // Numbering mode: 'template' strips manual numbers (use template's auto-numbering),
  // 'markdown' keeps manual numbers (requires template without auto-numbering)
  numberingMode?: 'template' | 'markdown';
  // Style role map for Lua filter generation — maps Pandoc's hard-coded
  // style names to the template's actual style names
  pandocStyleRoleMap?: PandocStyleRoleMap;
  // Front matter options
  includeCoverPage?: boolean;
  includeDocControl?: boolean;
  vendorLogoFilename?: string;
  customerLogoFilename?: string;
  logoBlobs?: Array<{ filename: string; blob: Blob }>;
  // Paragraph style to apply to text inside table cells (e.g., "CellBodyLeft")
  cellParagraphStyle?: string;
  // Paragraph style to apply to bullet list items (e.g., "List Bullet 2")
  bulletListStyle?: string;
  // Paragraph style to apply to numbered list items (e.g., "List1Num")
  numberedListStyle?: string;
}

// ========== Markdown Transformation for Pandoc Custom Styles ==========

/**
 * Apply Pandoc custom-style wrappers to markdown content
 * Transforms various elements to use ::: {custom-style="..."} syntax
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

  // NOTE: List wrapping with custom-style divs is DISABLED because:
  // - Pandoc's fenced div custom-style applies to the container, not individual list items
  // - Pandoc's --reference-doc should use the template's list styles natively
  // - List styles are applied through Word's built-in list numbering, not paragraph styles
  //
  // If list styling from template isn't working, the template needs:
  // - "List Bullet" style for bullet lists
  // - "List Number" style for numbered lists
  // - These must be the default list styles in the template

  // Transform code blocks (must be done early to avoid interference with other patterns)
  if (pandocStyles.codeStyle) {
    result = wrapCodeBlocks(result, pandocStyles.codeStyle);
  }

  // Transform note/warning callouts (must be done BEFORE general blockquotes)
  // These are special blockquotes that start with > **Note:** etc.
  if (pandocStyles.noteStyle || pandocStyles.warningStyle) {
    result = wrapCallouts(
      result,
      pandocStyles.noteStyle,
      pandocStyles.warningStyle,
      pandocStyles.otherStyles?.['tip'] // Look for tip style in otherStyles
    );
  }

  // Transform regular blockquotes (after callouts are handled)
  if (pandocStyles.quoteStyle) {
    result = wrapBlockquotes(result, pandocStyles.quoteStyle);
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

// NOTE: List wrapping functions were removed because Pandoc's fenced div custom-style
// applies to the container, not individual list items. Pandoc's --reference-doc
// uses the template's native list styles (List Bullet, List Number).

/**
 * Wrap figure captions with Pandoc custom-style
 * Matches patterns like:
 *   - *Figure 1-1: Caption text* (italic)
 *   - **Figure 1-1: Caption text** (bold)
 *   - Figure 1-1: Caption text (plain, on its own line)
 *
 * IMPORTANT: Pandoc fenced divs require opening/closing on their own lines
 * with blank lines separating from content.
 */
function wrapFigureCaptions(markdown: string, styleName: string): string {
  let result = markdown;

  // Match italic figure captions: *Figure X-X: text*
  result = result.replace(
    /^(\*)(Figure\s+[\d\-\.]+:?\s+[^\*\n]+)\*\s*$/gim,
    `\n::: {custom-style="${styleName}"}\n*$2*\n:::\n`
  );

  // Match bold figure captions: **Figure X-X: text**
  result = result.replace(
    /^(\*\*)(Figure\s+[\d\-\.]+:?\s+[^\*\n]+)\*\*\s*$/gim,
    `\n::: {custom-style="${styleName}"}\n**$2**\n:::\n`
  );

  // Match plain text figure captions on their own line
  // Must start at beginning of line and not be part of a sentence
  result = result.replace(
    /^(Figure\s+[\d\-\.]+:\s+[^\n]+)$/gim,
    `\n::: {custom-style="${styleName}"}\n$1\n:::\n`
  );

  return result;
}

/**
 * Wrap table captions with Pandoc custom-style
 * Matches patterns like:
 *   - *Table 1-1: Caption text* (italic)
 *   - **Table 1-1: Caption text** (bold)
 *   - Table 1-1: Caption text (plain, on its own line)
 */
function wrapTableCaptions(markdown: string, styleName: string): string {
  let result = markdown;

  // Match italic table captions: *Table X-X: text*
  result = result.replace(
    /^(\*)(Table\s+[\d\-\.]+:?\s+[^\*\n]+)\*\s*$/gim,
    `\n::: {custom-style="${styleName}"}\n*$2*\n:::\n`
  );

  // Match bold table captions: **Table X-X: text**
  result = result.replace(
    /^(\*\*)(Table\s+[\d\-\.]+:?\s+[^\*\n]+)\*\*\s*$/gim,
    `\n::: {custom-style="${styleName}"}\n**$2**\n:::\n`
  );

  // Match plain text table captions on their own line
  result = result.replace(
    /^(Table\s+[\d\-\.]+:\s+[^\n]+)$/gim,
    `\n::: {custom-style="${styleName}"}\n$1\n:::\n`
  );

  return result;
}

/**
 * Wrap fenced code blocks with Pandoc custom-style
 * Transforms ```language ... ``` blocks to use custom-style div
 *
 * Note: Pandoc handles code blocks specially. For custom styling, we wrap
 * the entire code block in a fenced div with the custom-style attribute.
 */
function wrapCodeBlocks(markdown: string, styleName: string): string {
  // Match fenced code blocks: ```language\n...\n```
  // Capture the language (if any) and content
  return markdown.replace(
    /^(```(\w*)\n)([\s\S]*?)(^```\s*$)/gm,
    (_match, openFence, _language, content, closeFence) => {
      // Preserve the original code block inside the custom-style div
      return `\n::: {custom-style="${styleName}"}\n${openFence}${content}${closeFence}\n:::\n`;
    }
  );
}

/**
 * Wrap blockquotes with Pandoc custom-style
 * Transforms > quoted text to use custom-style div
 *
 * Handles contiguous blockquote lines as a single block.
 */
function wrapBlockquotes(markdown: string, styleName: string): string {
  const lines = markdown.split('\n');
  const result: string[] = [];
  let inQuote = false;
  let quoteBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match blockquote lines (starting with > )
    const isQuoteLine = /^>\s?/.test(line);
    // Empty line within a quote block (next line is also a quote)
    const isEmptyInQuote = line.trim() === '' && inQuote &&
      i + 1 < lines.length && /^>\s?/.test(lines[i + 1]);

    if (isQuoteLine || isEmptyInQuote) {
      if (!inQuote) {
        inQuote = true;
        quoteBuffer = [];
      }
      quoteBuffer.push(line);
    } else {
      if (inQuote) {
        // End of blockquote - wrap and flush
        result.push('');
        result.push(`::: {custom-style="${styleName}"}`);
        result.push(...quoteBuffer);
        result.push(':::');
        result.push('');
        inQuote = false;
        quoteBuffer = [];
      }
      result.push(line);
    }
  }

  // Handle blockquote at end of document
  if (inQuote && quoteBuffer.length > 0) {
    result.push('');
    result.push(`::: {custom-style="${styleName}"}`);
    result.push(...quoteBuffer);
    result.push(':::');
  }

  return result.join('\n');
}

/**
 * Wrap note/warning/tip callouts with Pandoc custom-style
 * Detects patterns like:
 *   - > **Note:** text
 *   - > **Warning:** text
 *   - > **Important:** text
 *   - > **Tip:** text
 *
 * These are special blockquotes that get their own style.
 * Must be called BEFORE wrapBlockquotes to handle these specially.
 */
function wrapCallouts(
  markdown: string,
  noteStyle?: string,
  warningStyle?: string,
  tipStyle?: string
): string {
  let result = markdown;

  // Define callout patterns and their styles
  const calloutPatterns: Array<{ pattern: RegExp; style: string | undefined }> = [
    { pattern: /^>\s*\*\*Note:\*\*/i, style: noteStyle },
    { pattern: /^>\s*\*\*Warning:\*\*/i, style: warningStyle || noteStyle },
    { pattern: /^>\s*\*\*Important:\*\*/i, style: warningStyle || noteStyle },
    { pattern: /^>\s*\*\*Tip:\*\*/i, style: tipStyle || noteStyle },
    { pattern: /^>\s*\*\*Caution:\*\*/i, style: warningStyle || noteStyle },
  ];

  const lines = result.split('\n');
  const processedLines: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check if this line starts a callout
    let matchedStyle: string | undefined;
    for (const { pattern, style } of calloutPatterns) {
      if (pattern.test(line) && style) {
        matchedStyle = style;
        break;
      }
    }

    if (matchedStyle) {
      // Collect all lines of this callout (contiguous > lines)
      const calloutLines: string[] = [line];
      i++;
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        calloutLines.push(lines[i]);
        i++;
      }

      // Wrap the callout
      processedLines.push('');
      processedLines.push(`::: {custom-style="${matchedStyle}"}`);
      processedLines.push(...calloutLines);
      processedLines.push(':::');
      processedLines.push('');
    } else {
      processedLines.push(line);
      i++;
    }
  }

  return processedLines.join('\n');
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

  // Generate diagram images if embedding is enabled
  let diagramImages: DiagramImage[] = [];
  if (options.embedDiagrams) {
    console.log('[Pandoc Export] Generating diagram images...');
    diagramImages = await generateReferencedDiagramImages(project);
    console.log(`[Pandoc Export] Generated ${diagramImages.length} diagram images`);
  }

  // Resolve all {{fig:...}} and {{ref:...}} links in markdown
  // If embedding diagrams, transform to markdown image syntax first
  let resolvedMarkdown: string;

  if (options.embedDiagrams && diagramImages.length > 0) {
    // Transform {{fig:...}} to ![caption](images/...) syntax
    const markdownWithImages = transformMarkdownWithImages(
      project.specification.markdown,
      diagramImages,
      'images/'
    );
    // Then resolve any remaining links (refs, etc)
    resolvedMarkdown = resolveAllLinks(markdownWithImages, allFigures, citations);
  } else {
    resolvedMarkdown = resolveAllLinks(
      project.specification.markdown,
      allFigures,
      citations
    );
  }

  // Handle heading numbering based on numberingMode
  // Default to 'template' mode which strips manual numbers (most templates have auto-numbering)
  const numberingMode = options.numberingMode ?? 'template';
  console.log('[Pandoc Export] Numbering mode:', numberingMode);

  // Extract first few headings for debugging
  const headingLines = resolvedMarkdown.split('\n').filter(l => /^#{1,6}[\s]/.test(l)).slice(0, 10);
  console.log('[Pandoc Export] Sample headings BEFORE stripping:');
  headingLines.forEach((h, i) => console.log(`  [${i}] "${h}"`));

  if (numberingMode === 'template') {
    // Strip manual numbering from headings (e.g., "# 1 Introduction" → "# Introduction")
    // This prevents double-numbering when the template has automatic heading numbering
    // Patterns matched (more flexible regex):
    // - "# 1 Introduction" (number space)
    // - "# 1. Introduction" (number dot space)
    // - "# 1.1 Sub-section" (multi-level)
    // - "# 1.1. Sub-section" (multi-level with trailing dot)
    // - "#  1 Introduction" (multiple spaces)
    // - "# 1  Introduction" (multiple spaces after number)
    const beforeStrip = resolvedMarkdown;

    // More flexible regex: captures #s, then any whitespace, then number pattern, then whitespace
    // The number pattern is: digits optionally followed by (.digits)* and optional trailing dot
    resolvedMarkdown = resolvedMarkdown.replace(
      /^(#{1,6})[ \t]+(\d+(?:\.\d+)*\.?)[ \t]+/gm,
      '$1 '
    );

    const headingLinesAfter = resolvedMarkdown.split('\n').filter(l => /^#{1,6}[\s]/.test(l)).slice(0, 10);
    console.log('[Pandoc Export] Sample headings AFTER stripping:');
    headingLinesAfter.forEach((h, i) => console.log(`  [${i}] "${h}"`));

    if (beforeStrip !== resolvedMarkdown) {
      const strippedCount = (beforeStrip.match(/^#{1,6}[ \t]+\d+(?:\.\d+)*\.?[ \t]+/gm) || []).length;
      console.log(`[Pandoc Export] ✓ Stripped manual heading numbers from ${strippedCount} headings (numberingMode: template)`);
    } else {
      console.log('[Pandoc Export] ⚠ No heading numbers found to strip - headings may not have manual numbers');
      // Log first heading char codes for debugging
      if (headingLines.length > 0) {
        const firstHeading = headingLines[0];
        console.log('[Pandoc Export] First heading char analysis:',
          firstHeading.substring(0, 30).split('').map((c, i) => `[${i}]'${c}'(${c.charCodeAt(0)})`).join(' ')
        );
      }
    }
  } else {
    console.log('[Pandoc Export] Keeping manual heading numbers (numberingMode: markdown)');
  }

  // Apply Pandoc custom-style wrappers for lists and captions
  // This uses the template-derived style names from pandocStyles
  if (options.pandocStyles) {
    resolvedMarkdown = applyPandocCustomStyles(resolvedMarkdown, options.pandocStyles);
  }

  // Add YAML front matter for title page metadata
  // When custom cover page is enabled, suppress Pandoc's auto-generated title page
  // by omitting title/author/date/abstract from YAML (our cover page handles these)
  const specMeta = project.specification.metadata;
  let yamlFrontMatter: string;
  if (options.includeCoverPage) {
    // Minimal YAML — no title page fields, just enough for Pandoc to process
    yamlFrontMatter = '---\n---\n\n';
  } else {
    yamlFrontMatter = `---
title: "${project.specification.title || 'Technical Specification'}"
${specMeta?.subtitle ? `subtitle: "${specMeta.subtitle}"` : ''}
author: "${options.author || specMeta?.author || 'TechSpec Studio'}"
date: "${specMeta?.date || new Date().toISOString().split('T')[0]}"
version: "${specMeta?.version || project.version}"
abstract: |
  ${specMeta?.abstract || 'This document provides a comprehensive technical specification.'}
---

`;
  }

  // Generate cover page and document control front matter
  console.log('[Pandoc Export] Front matter options:', {
    includeCoverPage: options.includeCoverPage,
    includeDocControl: options.includeDocControl,
    vendorLogo: options.vendorLogoFilename,
    customerLogo: options.customerLogoFilename,
    logoBlobs: options.logoBlobs?.length || 0,
  });
  console.log('[Pandoc Export] Metadata for front matter:', {
    customer: project.specification.metadata?.customer,
    documentType: project.specification.metadata?.documentType,
    versionStatus: project.specification.metadata?.versionStatus,
    version: project.specification.metadata?.version,
    author: project.specification.metadata?.author,
    releaseEntries: project.specification.metadata?.documentRelease?.length || 0,
    approvers: project.specification.metadata?.approvers?.length || 0,
    revisions: project.specification.metadata?.revisions?.length || 0,
  });

  const coverAndDocControl = generateFrontMatter(
    project.specification.metadata,
    {
      includeCoverPage: options.includeCoverPage,
      includeDocControl: options.includeDocControl,
      specTitle: project.specification.title,
      vendorLogoFilename: options.vendorLogoFilename,
      customerLogoFilename: options.customerLogoFilename,
    }
  );
  console.log('[Pandoc Export] Front matter generated:', coverAndDocControl.length, 'chars');
  if (coverAndDocControl.length > 0) {
    console.log('[Pandoc Export] Front matter preview:\n' + coverAndDocControl.substring(0, 500));
  }

  // Build front matter sections (TOC, LoF, LoT)
  // Use styled paragraphs instead of headings to avoid template's auto-numbering
  // The {-} attribute doesn't work because Word's heading styles apply their own numbering
  let frontMatterSections = '';

  // Table of Contents - generate our own with Word TOC field code
  // Using styled paragraph instead of heading to avoid numbering
  if (options.includeTOC) {
    frontMatterSections += `
::: {custom-style="TOC Heading"}
**Table of Contents**
:::

\`\`\`{=openxml}
<w:p>
  <w:r>
    <w:fldChar w:fldCharType="begin"/>
  </w:r>
  <w:r>
    <w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText>
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

\`\`\`{=openxml}
<w:p>
  <w:pPr>
    <w:sectPr>
      <w:type w:val="nextPage"/>
    </w:sectPr>
  </w:pPr>
</w:p>
\`\`\`

`;
  }

  // List of Figures - raw OOXML field code (using styled paragraph)
  if (options.includeFigureList) {
    frontMatterSections += `
::: {custom-style="TOC Heading"}
**List of Figures**
:::

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

\`\`\`{=openxml}
<w:p>
  <w:pPr>
    <w:sectPr>
      <w:type w:val="nextPage"/>
    </w:sectPr>
  </w:pPr>
</w:p>
\`\`\`

`;
  }

  // List of Tables - raw OOXML field code (using styled paragraph)
  if (options.includeTableList) {
    frontMatterSections += `
::: {custom-style="TOC Heading"}
**List of Tables**
:::

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

\`\`\`{=openxml}
<w:p>
  <w:pPr>
    <w:sectPr>
      <w:type w:val="nextPage"/>
    </w:sectPr>
  </w:pPr>
</w:p>
\`\`\`

`;
  }

  const markdownWithMetadata = yamlFrontMatter + coverAndDocControl + frontMatterSections + resolvedMarkdown;

  console.log('[Pandoc Export] Markdown resolved:', markdownWithMetadata.length, 'characters');

  // Debug: Log the first heading in the final markdown to verify stripping persisted
  const finalHeadingMatch = markdownWithMetadata.match(/^#[^#\n][^\n]*/m);
  console.log('[Pandoc Export] First H1 in final markdown:', finalHeadingMatch?.[0] || 'NOT FOUND');

  // Also check the actual content being sent (first 500 chars after YAML)
  const contentAfterYaml = markdownWithMetadata.split('---\n\n')[1] || '';
  const firstContentLines = contentAfterYaml.split('\n').slice(0, 20).join('\n');
  console.log('[Pandoc Export] First 20 lines of content:\n' + firstContentLines);

  // Create form data for multipart upload
  const formData = new FormData();

  // Add markdown file with YAML front matter
  const markdownBlob = new Blob([markdownWithMetadata], { type: 'text/markdown' });
  formData.append('markdown', markdownBlob, 'input.md');

  // Add template file
  formData.append('template', templateFile, templateFile.name);

  // Add diagram images if embedding is enabled
  if (options.embedDiagrams && diagramImages.length > 0) {
    console.log(`[Pandoc Export] Adding ${diagramImages.length} diagram images to form data`);
    for (const image of diagramImages) {
      formData.append('images', image.blob, image.filename);
    }
  }

  // Add logo images for front matter cover page
  if (options.logoBlobs && options.logoBlobs.length > 0) {
    console.log(`[Pandoc Export] Adding ${options.logoBlobs.length} logo images to form data`);
    for (const logo of options.logoBlobs) {
      formData.append('images', logo.blob, logo.filename);
    }
  }

  // Add export options
  // When using 'template' numbering mode:
  //   - We strip manual numbers from markdown
  //   - The Word template's built-in heading numbering handles everything
  //   - We do NOT use Pandoc's --number-sections (would cause double numbering)
  // When using 'markdown' numbering mode:
  //   - We keep manual numbers in markdown
  //   - We do NOT use Pandoc's --number-sections (manual numbers already there)
  // Only use --number-sections if explicitly requested AND not using template numbering
  const shouldNumberSections = numberingMode !== 'template' && options.includeNumberSections;
  console.log('[Pandoc Export] Pandoc --number-sections:', shouldNumberSections, '(mode:', numberingMode, ')',
    numberingMode === 'template' ? '(disabled - template has its own numbering)' : '');

  const exportOptions: Record<string, unknown> = {
    // Don't use Pandoc's --toc flag - we generate our own TOC with unnumbered heading
    // This prevents the TOC title from consuming numbering (e.g., "1 Contents")
    includeTOC: false,
    includeNumberSections: shouldNumberSections,
    embedDiagrams: options.embedDiagrams,
    // When custom cover page is enabled, suppress Pandoc's auto title page
    // by omitting metadata (title/author/date generate a title block)
    metadata: options.includeCoverPage ? undefined : {
      title: project.specification.title || 'Technical Specification',
      author: options.author || project.specification.metadata?.author || 'TechSpec Studio',
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    }
  };

  formData.append('options', JSON.stringify(exportOptions));

  // Generate and attach Lua filter for style remapping if we have role mappings
  const luaFilter = generateLuaFilter(options.pandocStyleRoleMap);
  if (luaFilter) {
    const filterBlob = new Blob([luaFilter], { type: 'text/x-lua' });
    formData.append('luaFilter', filterBlob, 'style-remap.lua');
    console.log('[Pandoc Export] Lua filter attached for style remapping');
  }

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
    let blob = await response.blob();
    console.log('[Pandoc Export] Received blob:', blob.size, 'bytes');

    // Post-process: apply table style by modifying the DOCX XML directly
    // Pandoc's custom-style doesn't work for table styles — it only handles
    // paragraph/character styles. We need to inject <w:tblStyle> into the XML.
    if (options.pandocStyleRoleMap?.tableStyle) {
      blob = await applyTableStyleToDocx(blob, options.pandocStyleRoleMap.tableStyle);
    }

    // Post-process: apply paragraph style to all paragraphs inside table cells
    // (e.g., "CellBodyLeft") so cell text uses the template's cell style
    // instead of inheriting from Normal.
    if (options.cellParagraphStyle) {
      blob = await applyCellParagraphStyleToDocx(blob, options.cellParagraphStyle);
    }

    // Post-process: inject SEQ fields into Figure/Table captions so Word's
    // List of Figures and List of Tables can find them.
    blob = await injectCaptionSeqFields(blob);

    // Post-process: apply template's list styles to list items
    if (options.bulletListStyle || options.numberedListStyle) {
      blob = await applyListStylesToDocx(blob, {
        bulletStyle: options.bulletListStyle,
        numberedStyle: options.numberedListStyle,
      });
    }

    return blob;

  } catch (error) {
    console.error('[Pandoc Export] Error:', error);
    throw new Error(
      `Failed to export with Pandoc: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Post-process a DOCX blob to apply a table style to all tables.
 * Opens the DOCX with PizZip, parses document.xml, and replaces/injects
 * <w:tblStyle> elements in each table's <w:tblPr>.
 */
async function applyTableStyleToDocx(blob: Blob, tableStyle: string): Promise<Blob> {
  try {
    console.log(`[Pandoc Export] Post-processing: applying table style "${tableStyle}"`);

    const arrayBuffer = await blob.arrayBuffer();
    const zip = new PizZip(arrayBuffer);

    const docFile = zip.file('word/document.xml');
    if (!docFile) {
      console.warn('[Pandoc Export] No document.xml found in DOCX');
      return blob;
    }

    let docXml = docFile.asText();
    let replacements = 0;

    // Replace existing <w:tblStyle w:val="..."/> with our style.
    const existingPattern = /<w:tblStyle\s+w:val="[^"]*"\s*\/>/g;
    docXml = docXml.replace(existingPattern, () => {
      replacements++;
      return `<w:tblStyle w:val="${tableStyle}"/>`;
    });

    // Enable the "first row" (header) conditional formatting for all tables.
    // Without w:firstRow="1", the table style's "Header Row" formatting never
    // applies — the "Whole Table" formatting applies to every row instead.
    // Pandoc's default tblLook has firstRow="0" which disables this.
    let tblLookReplacements = 0;
    const tblLookPattern = /<w:tblLook\s+([^/]*?)\/>/g;
    docXml = docXml.replace(tblLookPattern, (_match, attrs) => {
      tblLookReplacements++;
      // Remove any existing firstRow/lastRow/firstColumn/lastColumn/noHBand/noVBand attributes
      let cleaned = attrs
        .replace(/w:firstRow="[01]"\s*/g, '')
        .replace(/w:lastRow="[01]"\s*/g, '')
        .replace(/w:firstColumn="[01]"\s*/g, '')
        .replace(/w:lastColumn="[01]"\s*/g, '')
        .replace(/w:noHBand="[01]"\s*/g, '')
        .replace(/w:noVBand="[01]"\s*/g, '')
        .replace(/w:val="[0-9A-Fa-f]+"\s*/g, '') // remove old hex val
        .trim();
      // Build new attributes: enable first row header, keep banded rows
      const newAttrs = 'w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="1"';
      return cleaned
        ? `<w:tblLook ${cleaned} ${newAttrs}/>`
        : `<w:tblLook ${newAttrs}/>`;
    });

    // Add <w:cantSplit/> to every table row so rows don't break across pages.
    // Header row repeat (<w:tblHeader/>) is already emitted by Pandoc on the
    // first row of each markdown table, so we leave that alone.
    let cantSplitCount = 0;
    const rowPattern = /<w:tr(\s[^>]*)?>([\s\S]*?)<\/w:tr>/g;
    docXml = docXml.replace(rowPattern, (_rowMatch, rowAttrs: string | undefined, rowInner: string) => {
      // Skip if row already has cantSplit
      if (/<w:cantSplit\s*\/>/.test(rowInner)) return _rowMatch;
      cantSplitCount++;
      const attrs = rowAttrs || '';
      if (/<w:trPr>/.test(rowInner)) {
        // Inject into existing trPr
        const newInner = rowInner.replace(/<w:trPr>/, '<w:trPr><w:cantSplit/>');
        return `<w:tr${attrs}>${newInner}</w:tr>`;
      } else {
        // No trPr — add one at the start of row content
        return `<w:tr${attrs}><w:trPr><w:cantSplit/></w:trPr>${rowInner}</w:tr>`;
      }
    });

    console.log(`[Pandoc Export] Applied table style to ${replacements} table(s), updated ${tblLookReplacements} tblLook element(s), added cantSplit to ${cantSplitCount} row(s)`);

    zip.file('word/document.xml', docXml);
    const modifiedBlob = zip.generate({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

    console.log(`[Pandoc Export] Post-processed DOCX: ${modifiedBlob.size} bytes`);
    return modifiedBlob;

  } catch (error) {
    console.error('[Pandoc Export] Table style post-processing failed:', error);
    return blob; // Return original on failure
  }
}

/**
 * Post-process a DOCX to apply a paragraph style (e.g., "CellBodyLeft") to
 * every paragraph inside a table cell. This replaces the default Normal style
 * inheritance that causes leading tabs and wrong indentation in cells.
 */
async function applyCellParagraphStyleToDocx(blob: Blob, styleName: string): Promise<Blob> {
  try {
    console.log(`[Pandoc Export] Post-processing: applying cell paragraph style "${styleName}"`);
    const arrayBuffer = await blob.arrayBuffer();
    const zip = new PizZip(arrayBuffer);
    const docFile = zip.file('word/document.xml');
    if (!docFile) {
      console.warn('[Pandoc Export] No document.xml found');
      return blob;
    }

    let docXml = docFile.asText();
    let paragraphsStyled = 0;

    // Walk every <w:tc>, find every <w:p> inside, set/replace pStyle
    const cellPattern = /<w:tc>([\s\S]*?)<\/w:tc>/g;
    docXml = docXml.replace(cellPattern, (_cellMatch, cellContent: string) => {
      const updated = cellContent.replace(
        /<w:p(\s[^>]*)?>([\s\S]*?)<\/w:p>/g,
        (_pMatch, pAttrs: string | undefined, pInner: string) => {
          paragraphsStyled++;
          const attrs = pAttrs || '';
          // If <w:pPr> exists, replace or insert pStyle inside it
          if (/<w:pPr>/.test(pInner)) {
            let newInner = pInner;
            if (/<w:pStyle\s+w:val="[^"]*"\s*\/>/.test(pInner)) {
              // Replace existing pStyle
              newInner = pInner.replace(
                /<w:pStyle\s+w:val="[^"]*"\s*\/>/,
                `<w:pStyle w:val="${styleName}"/>`
              );
            } else {
              // Insert pStyle at start of pPr
              newInner = pInner.replace(
                /<w:pPr>/,
                `<w:pPr><w:pStyle w:val="${styleName}"/>`
              );
            }
            return `<w:p${attrs}>${newInner}</w:p>`;
          } else {
            // No pPr — add one with just pStyle at start of paragraph
            return `<w:p${attrs}><w:pPr><w:pStyle w:val="${styleName}"/></w:pPr>${pInner}</w:p>`;
          }
        }
      );
      return `<w:tc>${updated}</w:tc>`;
    });

    console.log(`[Pandoc Export] Styled ${paragraphsStyled} cell paragraph(s) with "${styleName}"`);

    zip.file('word/document.xml', docXml);
    const modifiedBlob = zip.generate({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    return modifiedBlob;

  } catch (error) {
    console.error('[Pandoc Export] Cell paragraph style post-processing failed:', error);
    return blob;
  }
}

/**
 * Post-process a DOCX to inject SEQ fields into Figure/Table caption paragraphs.
 *
 * Word's List of Figures/Tables field codes look for paragraphs with caption
 * style AND containing a SEQ Figure/Table field. Pandoc writes captions as
 * plain text like "Figure 1-1: Title" without the SEQ field, so the lists
 * stay empty. This function rewrites caption paragraphs to include the SEQ
 * field around the number.
 *
 * Pattern matched: "Figure N:" or "Table N:" at the start of the paragraph's
 * text content (where N is a number, possibly with dashes or dots).
 */
async function injectCaptionSeqFields(blob: Blob): Promise<Blob> {
  try {
    console.log('[Pandoc Export] Post-processing: injecting SEQ fields into captions');
    const arrayBuffer = await blob.arrayBuffer();
    const zip = new PizZip(arrayBuffer);
    const docFile = zip.file('word/document.xml');
    if (!docFile) return blob;

    let docXml = docFile.asText();
    let figureCount = 0;
    let tableCount = 0;

    // Find paragraphs and inspect their text content
    const paragraphPattern = /<w:p(\s[^>]*)?>([\s\S]*?)<\/w:p>/g;

    docXml = docXml.replace(paragraphPattern, (match, pAttrs: string | undefined, pInner: string) => {
      // Concatenate all visible text from the paragraph's runs
      const textMatches = Array.from(pInner.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g));
      const fullText = textMatches.map(m => m[1]).join('');

      // Check if it starts with "Figure N:" or "Table N:"
      const figureMatch = fullText.match(/^(Figure\s+)([\d\-\.]+)(:\s*.*)$/);
      const tableMatch = fullText.match(/^(Table\s+)([\d\-\.]+)(:\s*.*)$/);

      const captionMatch = figureMatch || tableMatch;
      if (!captionMatch) return match;

      const captionType = figureMatch ? 'Figure' : 'Table';
      if (figureMatch) figureCount++; else tableCount++;

      const [, prefix, numberText, suffix] = captionMatch;

      // Extract the pPr (paragraph properties) as-is
      const pPrMatch = pInner.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
      const pPr = pPrMatch ? pPrMatch[0] : '';

      // Build new paragraph content:
      // - prefix text ("Figure " / "Table ")
      // - SEQ field with number as separator text
      // - suffix text (": Title")
      const newInner = `${pPr}<w:r><w:t xml:space="preserve">${escapeXml(prefix)}</w:t></w:r>` +
        `<w:r><w:fldChar w:fldCharType="begin"/></w:r>` +
        `<w:r><w:instrText xml:space="preserve"> SEQ ${captionType} \\* ARABIC </w:instrText></w:r>` +
        `<w:r><w:fldChar w:fldCharType="separate"/></w:r>` +
        `<w:r><w:t>${escapeXml(numberText)}</w:t></w:r>` +
        `<w:r><w:fldChar w:fldCharType="end"/></w:r>` +
        `<w:r><w:t xml:space="preserve">${escapeXml(suffix)}</w:t></w:r>`;

      const attrs = pAttrs || '';
      return `<w:p${attrs}>${newInner}</w:p>`;
    });

    console.log(`[Pandoc Export] Injected SEQ fields: ${figureCount} figure(s), ${tableCount} table(s)`);

    zip.file('word/document.xml', docXml);
    return zip.generate({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

  } catch (error) {
    console.error('[Pandoc Export] Caption SEQ field injection failed:', error);
    return blob;
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Apply list paragraph styles to every list item in the document.
 *
 * Identifies list items by the presence of <w:numPr> in the paragraph
 * properties. Determines bullet vs numbered by looking up the numId in
 * numbering.xml — bullets have numFmt="bullet", numbered lists use
 * decimal/upperRoman/lowerRoman/etc.
 */
async function applyListStylesToDocx(
  blob: Blob,
  styles: { bulletStyle?: string; numberedStyle?: string }
): Promise<Blob> {
  try {
    console.log('[Pandoc Export] Post-processing: applying list styles', styles);
    const arrayBuffer = await blob.arrayBuffer();
    const zip = new PizZip(arrayBuffer);
    const docFile = zip.file('word/document.xml');
    const numFile = zip.file('word/numbering.xml');
    if (!docFile || !numFile) {
      console.warn('[Pandoc Export] Missing document.xml or numbering.xml');
      return blob;
    }

    const numXml = numFile.asText();
    let docXml = docFile.asText();

    // Build numId → 'bullet' | 'numbered' map
    // numbering.xml structure: <w:num w:numId="N"><w:abstractNumId w:val="M"/></w:num>
    // abstractNum defines the format: <w:abstractNum w:abstractNumId="M"><w:lvl ...><w:numFmt w:val="..."/></w:lvl>
    const abstractNumFormats = new Map<string, string>(); // abstractNumId → numFmt of level 0
    const abstractNumPattern = /<w:abstractNum\s+w:abstractNumId="([^"]+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g;
    let abstractMatch;
    while ((abstractMatch = abstractNumPattern.exec(numXml)) !== null) {
      const absId = abstractMatch[1];
      const content = abstractMatch[2];
      // Get numFmt of first level (ilvl=0)
      const lvlMatch = content.match(/<w:lvl[^>]*w:ilvl="0"[^>]*>([\s\S]*?)<\/w:lvl>/);
      if (lvlMatch) {
        const fmtMatch = lvlMatch[1].match(/<w:numFmt\s+w:val="([^"]+)"/);
        if (fmtMatch) {
          abstractNumFormats.set(absId, fmtMatch[1]);
        }
      }
    }

    const numIdToType = new Map<string, 'bullet' | 'numbered'>();
    const numPattern = /<w:num\s+w:numId="([^"]+)"[^>]*>([\s\S]*?)<\/w:num>/g;
    let numMatch;
    while ((numMatch = numPattern.exec(numXml)) !== null) {
      const numId = numMatch[1];
      const content = numMatch[2];
      const absIdMatch = content.match(/<w:abstractNumId\s+w:val="([^"]+)"/);
      if (absIdMatch) {
        const fmt = abstractNumFormats.get(absIdMatch[1]);
        if (fmt === 'bullet') {
          numIdToType.set(numId, 'bullet');
        } else if (fmt) {
          numIdToType.set(numId, 'numbered');
        }
      }
    }

    console.log(`[Pandoc Export] Parsed ${numIdToType.size} list numbering definitions`);

    // Build styleId → numId map by parsing styles.xml. When we apply a list
    // style to a paragraph, we'll also redirect its numId so the paragraph
    // uses the template's list definition (with correct indents per level)
    // instead of Pandoc's default.
    const stylesFile = zip.file('word/styles.xml');
    const styleNumIdMap = new Map<string, string>();
    if (stylesFile) {
      const stylesXml = stylesFile.asText();
      // Match ALL <w:style> blocks regardless of attribute order, then filter
      // for paragraph styles and extract styleId + numId.
      const styleBlockPattern = /<w:style\s+([^>]*)>([\s\S]*?)<\/w:style>/g;
      let styleMatch;
      let scannedCount = 0;
      while ((styleMatch = styleBlockPattern.exec(stylesXml)) !== null) {
        const attrs = styleMatch[1];
        const content = styleMatch[2];
        // Only consider paragraph styles
        if (!/w:type="paragraph"/.test(attrs)) continue;
        const styleIdMatch = attrs.match(/w:styleId="([^"]+)"/);
        if (!styleIdMatch) continue;
        scannedCount++;
        const numIdInStyle = content.match(/<w:numId\s+w:val="([^"]+)"/);
        if (numIdInStyle) {
          styleNumIdMap.set(styleIdMatch[1], numIdInStyle[1]);
        }
      }
      console.log(`[Pandoc Export] Scanned ${scannedCount} paragraph styles, ${styleNumIdMap.size} have list numbering`);
      if (styleNumIdMap.size > 0) {
        const sample = Array.from(styleNumIdMap.entries()).slice(0, 5);
        console.log('[Pandoc Export] Sample style → numId:', sample);
      }
    }

    // Walk each <w:p> with <w:numPr>, determine type, apply style
    let bulletsStyled = 0;
    let numbersStyled = 0;
    docXml = docXml.replace(
      /<w:p(\s[^>]*)?>([\s\S]*?)<\/w:p>/g,
      (match, pAttrs: string | undefined, pInner: string) => {
        // Check if paragraph has numPr (is a list item)
        const numPrMatch = pInner.match(/<w:numPr>[\s\S]*?<\/w:numPr>/);
        if (!numPrMatch) return match;

        // Extract numId from numPr
        const numIdMatch = numPrMatch[0].match(/<w:numId\s+w:val="([^"]+)"/);
        if (!numIdMatch) return match;

        const listType = numIdToType.get(numIdMatch[1]);
        if (!listType) return match;

        const targetStyle = listType === 'bullet' ? styles.bulletStyle : styles.numberedStyle;
        if (!targetStyle) return match;

        if (listType === 'bullet') bulletsStyled++;
        else numbersStyled++;

        // Apply pStyle inside pPr; keep Pandoc's numPr intact so lists stay
        // their correct type (bullet vs numbered). Redirecting numId breaks
        // list type when bullet/numbered styles share a name.
        const attrs = pAttrs || '';
        let newInner = pInner;

        if (/<w:pPr>/.test(newInner)) {
          if (/<w:pStyle\s+w:val="[^"]*"\s*\/>/.test(newInner)) {
            newInner = newInner.replace(
              /<w:pStyle\s+w:val="[^"]*"\s*\/>/,
              `<w:pStyle w:val="${targetStyle}"/>`
            );
          } else {
            newInner = newInner.replace(
              /<w:pPr>/,
              `<w:pPr><w:pStyle w:val="${targetStyle}"/>`
            );
          }
        } else {
          newInner = `<w:pPr><w:pStyle w:val="${targetStyle}"/></w:pPr>${newInner}`;
        }
        return `<w:p${attrs}>${newInner}</w:p>`;
      }
    );

    console.log(`[Pandoc Export] Applied list styles: ${bulletsStyled} bullet(s), ${numbersStyled} numbered item(s)`);

    zip.file('word/document.xml', docXml);
    return zip.generate({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

  } catch (error) {
    console.error('[Pandoc Export] List style post-processing failed:', error);
    return blob;
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
