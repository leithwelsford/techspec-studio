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
 * Raw OOXML page break (not section break).
 * Uses <w:br w:type="page"/> which creates a page break without resetting
 * the template's heading numbering counter.
 * \newpage doesn't work reliably for DOCX output.
 */
const PAGE_BREAK = `

\`\`\`{=openxml}
<w:p>
  <w:r>
    <w:br w:type="page"/>
  </w:r>
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
 * Generate blank lines for spacing using simple markdown line breaks.
 */
function markdownSpacing(lines: number = 1): string {
  // Use non-breaking spaces on empty lines to force Pandoc to emit paragraphs
  return Array(lines).fill('&nbsp;\n').join('\n');
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
  parts.push(markdownSpacing(4));

  // Customer name (Title style)
  if (metadata.customer) {
    parts.push(`::: {custom-style="Title"}
${metadata.customer}
:::`);
  }

  // Document title (Title 1 style — larger/primary heading on cover)
  const title = options.specTitle || 'Technical Specification';
  parts.push(`::: {custom-style="Title 1"}
${title}
:::`);

  // Horizontal rule
  parts.push(ooXmlHorizontalRule());

  // Spacing
  parts.push('');

  // Document type (Title style)
  if (metadata.documentType) {
    parts.push(`::: {custom-style="Title"}
${metadata.documentType}
:::`);
  }

  // Version + status (Subtitle style)
  const version = metadata.version || '0.1';
  const status = metadata.versionStatus ? ` (${metadata.versionStatus})` : '';
  parts.push(`::: {custom-style="Subtitle"}
Version ${version}${status}
:::`);

  // Date (Date style)
  const date = metadata.date || new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
  parts.push(`::: {custom-style="Date"}
${date}
:::`);


  // Section break
  parts.push(PAGE_BREAK);

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
  parts.push(PAGE_BREAK);

  return parts.join('\n');
}
