/**
 * Front Matter Generator for Pandoc DOCX Export
 *
 * Generates cover page, document control, and section breaks as markdown
 * with raw OOXML blocks. Injected into the markdown before Pandoc processes it.
 *
 * Layout based on corporate template structure:
 *   Cover Page → Document Control → TOC → LoF → LoT → Main Content
 */

import type { DocumentMetadata } from '../types';

export interface FrontMatterOptions {
  includeCoverPage?: boolean;
  includeDocControl?: boolean;
  /** Title from the project spec (used on cover page) */
  specTitle?: string;
  /** Filenames of logo images added to FormData (e.g., "vendor-logo.png") */
  vendorLogoFilename?: string;
  customerLogoFilename?: string;
}

/**
 * Raw OOXML for a section break (next page).
 * Wrapped in Pandoc's raw openxml fence syntax.
 */
const SECTION_BREAK = `
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

/**
 * Raw OOXML for a horizontal rule with accent color.
 */
function ooXmlHorizontalRule(color: string = 'ED7D31'): string {
  return `
\`\`\`{=openxml}
<w:p>
  <w:pPr>
    <w:pBdr>
      <w:bottom w:val="single" w:sz="12" w:space="1" w:color="${color}"/>
    </w:pBdr>
  </w:pPr>
</w:p>
\`\`\`
`;
}

/**
 * Raw OOXML for empty spacing paragraphs.
 */
function ooXmlSpacing(lines: number = 1): string {
  const paras = Array(lines).fill(
    '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>'
  ).join('\n  ');
  return `
\`\`\`{=openxml}
  ${paras}
\`\`\`
`;
}

/**
 * Generate the complete front matter markdown string.
 *
 * Returns empty string if neither cover page nor doc control is requested.
 */
export function generateFrontMatter(
  metadata: DocumentMetadata,
  options: FrontMatterOptions
): string {
  const sections: string[] = [];

  if (options.includeCoverPage) {
    sections.push(generateCoverPage(metadata, options));
  }

  if (options.includeDocControl) {
    sections.push(generateDocumentControl(metadata));
  }

  return sections.join('\n');
}

/**
 * Generate cover page markdown with raw OOXML blocks.
 */
function generateCoverPage(
  metadata: DocumentMetadata,
  options: FrontMatterOptions
): string {
  const parts: string[] = [];

  // Logos (rendered as markdown images — added to FormData by the export pipeline)
  const logoImages: string[] = [];
  if (options.vendorLogoFilename) {
    logoImages.push(`![](images/${options.vendorLogoFilename}){ width=2in }`);
  }
  if (options.customerLogoFilename) {
    logoImages.push(`![](images/${options.customerLogoFilename}){ width=1.5in }`);
  }
  if (logoImages.length > 0) {
    parts.push(logoImages.join('  '));
  }

  // Spacing after logos
  parts.push(ooXmlSpacing(4));

  // Customer name (Title style)
  if (metadata.customer) {
    parts.push(`::: {custom-style="Title"}
${metadata.customer}
:::`);
  }

  // Document title (Title style)
  const title = options.specTitle || 'Technical Specification';
  parts.push(`::: {custom-style="Title"}
${title}
:::`);

  // Horizontal rule
  parts.push(ooXmlHorizontalRule());

  // Spacing
  parts.push('');

  // Document type (Subtitle style)
  if (metadata.documentType) {
    parts.push(`::: {custom-style="Subtitle"}
${metadata.documentType}
:::`);
  }

  // Version + status
  const version = metadata.version || '0.1';
  const status = metadata.versionStatus ? ` (${metadata.versionStatus})` : '';
  parts.push(`Version ${version}${status}`);

  // Date
  const date = metadata.date || new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
  parts.push(date);

  // Section break
  parts.push(SECTION_BREAK);

  return parts.join('\n\n');
}

/**
 * Generate document control page with tables.
 */
function generateDocumentControl(metadata: DocumentMetadata): string {
  const parts: string[] = [];

  // Heading (unnumbered — use TOC Heading style to avoid template numbering)
  parts.push(`::: {custom-style="TOC Heading"}
**Document Control**
:::`);

  // Document Release table
  parts.push('**Document Release**\n');
  parts.push('| | Name | Title | Date |');
  parts.push('|---|---|---|---|');
  if (metadata.documentRelease && metadata.documentRelease.length > 0) {
    for (const entry of metadata.documentRelease) {
      const date = entry.date || '';
      parts.push(`| ${entry.role} | ${entry.name} | ${entry.title} | ${date} |`);
    }
  } else {
    parts.push('| Author | | | |');
    parts.push('| Reviewer | | | |');
  }

  parts.push('');

  // Customer Sign-off table
  parts.push('**Customer Sign-off**\n');
  parts.push('| | Name | Title | Date |');
  parts.push('|---|---|---|---|');
  if (metadata.approvers && metadata.approvers.length > 0) {
    for (const approver of metadata.approvers) {
      const date = approver.date || '';
      parts.push(`| Approver | ${approver.name} | ${approver.title} | ${date} |`);
    }
  } else {
    parts.push('| Approver | | | |');
  }

  parts.push('');

  // Revision History table
  parts.push('**Revision History**\n');
  parts.push('| Revision | Name | Changes | Date |');
  parts.push('|---|---|---|---|');
  if (metadata.revisions && metadata.revisions.length > 0) {
    for (const rev of metadata.revisions) {
      // Escape pipe characters in changes text
      const changes = rev.changes.replace(/\|/g, '\\|');
      parts.push(`| ${rev.version} | ${rev.author} | ${changes} | ${rev.date} |`);
    }
  } else {
    parts.push('| 0.1 | | Initial draft | |');
  }

  // Section break
  parts.push(SECTION_BREAK);

  return parts.join('\n');
}
