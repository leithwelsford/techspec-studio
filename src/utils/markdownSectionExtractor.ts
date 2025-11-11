/**
 * Markdown Section Extraction Utilities
 *
 * Utility functions to extract specific sections from technical specification markdown documents.
 * Follows standard technical specification structure (numbered sections with headings).
 */

export interface MarkdownSection {
  sectionNumber: string;
  title: string;
  content: string;
  level: number; // heading level (1, 2, 3, etc.)
  lineStart: number;
  lineEnd: number;
}

/**
 * Extract all sections from markdown document
 * Parses numbered sections like "4. Architecture" or "4.1. Network Topology"
 */
export function extractAllSections(markdown: string): MarkdownSection[] {
  const lines = markdown.split('\n');
  const sections: MarkdownSection[] = [];

  let currentSection: MarkdownSection | null = null;

  lines.forEach((line, index) => {
    // Match headings like: ## 4. Architecture or ### 4.1. Network Components
    // Also matches: ## 4 Architecture (period after section number is optional)
    const headingMatch = line.match(/^(#+)\s+(\d+(?:\.\d+)*)\.?\s+(.+)$/);

    if (headingMatch) {
      // Save previous section if exists
      if (currentSection) {
        currentSection.lineEnd = index - 1;
        currentSection.content = lines.slice(currentSection.lineStart, index).join('\n').trim();
        sections.push(currentSection);
      }

      // Start new section
      const level = headingMatch[1].length;
      const sectionNumber = headingMatch[2];
      const title = headingMatch[3].trim();

      currentSection = {
        sectionNumber,
        title,
        content: '',
        level,
        lineStart: index + 1, // content starts on next line
        lineEnd: index + 1
      };
    }
  });

  // Save last section
  if (currentSection) {
    currentSection.lineEnd = lines.length - 1;
    currentSection.content = lines.slice(currentSection.lineStart).join('\n').trim();
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Extract a specific section by number (e.g., "4" for Architecture, "4.1" for subsection)
 */
export function extractSectionByNumber(markdown: string, sectionNumber: string): MarkdownSection | null {
  const sections = extractAllSections(markdown);
  return sections.find(s => s.sectionNumber === sectionNumber) || null;
}

/**
 * Extract a section by title (case-insensitive partial match)
 * Example: "Architecture" will match "4. Architecture" or "System Architecture"
 */
export function extractSectionByTitle(markdown: string, titleSearch: string): MarkdownSection | null {
  const sections = extractAllSections(markdown);
  const searchLower = titleSearch.toLowerCase();
  return sections.find(s => s.title.toLowerCase().includes(searchLower)) || null;
}

/**
 * Extract multiple sections that match a pattern
 * Example: extractSectionsByPattern(markdown, /^6\.\d+/) gets all subsections under section 6
 */
export function extractSectionsByPattern(markdown: string, pattern: RegExp): MarkdownSection[] {
  const sections = extractAllSections(markdown);
  return sections.filter(s => pattern.test(s.sectionNumber));
}

/**
 * Extract a section with all its subsections combined
 * Example: extractSectionWithSubsections(markdown, "4") returns section 4 + 4.1 + 4.2 + etc.
 */
export function extractSectionWithSubsections(markdown: string, sectionNumber: string): MarkdownSection | null {
  const sections = extractAllSections(markdown);

  // Find the main section
  const mainSection = sections.find(s => s.sectionNumber === sectionNumber);
  if (!mainSection) {
    return null;
  }

  // Find all subsections (e.g., 4.1, 4.2, 4.1.1, etc.)
  const subsectionPattern = new RegExp(`^${sectionNumber.replace(/\./g, '\\.')}\\.`);
  const subsections = sections.filter(s => subsectionPattern.test(s.sectionNumber));

  // If no subsections, return the main section as-is
  if (subsections.length === 0) {
    return mainSection;
  }

  // Combine main section heading with all subsection content
  const combinedLines: string[] = [];

  // Add main section content if it exists
  if (mainSection.content.trim()) {
    combinedLines.push(mainSection.content);
  }

  // Add all subsections with their headings and content
  const markdownLines = markdown.split('\n');
  for (const subsection of subsections) {
    // Add subsection heading
    const headingLine = markdownLines[subsection.lineStart - 1];
    if (headingLine) {
      combinedLines.push('');
      combinedLines.push(headingLine);
    }
    // Add subsection content
    if (subsection.content.trim()) {
      combinedLines.push(subsection.content);
    }
  }

  return {
    ...mainSection,
    content: combinedLines.join('\n').trim()
  };
}

/**
 * Get Architecture section (typically section 4 in 3GPP spec structure)
 * Tries multiple common section numbers: "4", "3", "5"
 * Also matches subsections like "3.1 Architecture Requirements"
 * Returns the section with ALL subsections combined
 */
export function extractArchitectureSection(markdown: string): MarkdownSection | null {
  const sections = extractAllSections(markdown);

  // Try by title match (case-insensitive, partial match)
  const architectureKeywords = ['architecture', 'system architecture', 'network architecture', 'architecture overview'];

  for (const keyword of architectureKeywords) {
    const section = sections.find(s => s.title.toLowerCase().includes(keyword));
    if (section) {
      console.log(`✅ Found Architecture section: ${section.sectionNumber}. ${section.title}`);

      // Extract with all subsections
      const withSubsections = extractSectionWithSubsections(markdown, section.sectionNumber);
      if (withSubsections) {
        console.log(`   Including subsections, total content: ${withSubsections.content.length} chars`);
        return withSubsections;
      }
      return section;
    }
  }

  console.warn('⚠️ No Architecture section found. Available sections:',
    sections.map(s => `${s.sectionNumber}. ${s.title}`).join(', '));

  return null;
}

/**
 * Get Procedures section (typically section 6 in 3GPP spec structure)
 * Tries multiple common section numbers: "6", "5", "7"
 * Also matches "flows", "operations", etc.
 */
export function extractProceduresSection(markdown: string): MarkdownSection | null {
  const sections = extractAllSections(markdown);

  // Try by title match (case-insensitive, partial match)
  const procedureKeywords = [
    'procedure', 'procedures',
    'call flow', 'message flow', 'flows',
    'operations', 'operation',
    'process flow', 'workflow'
  ];

  for (const keyword of procedureKeywords) {
    const section = sections.find(s => s.title.toLowerCase().includes(keyword));
    if (section) {
      console.log(`✅ Found Procedures section: ${section.sectionNumber}. ${section.title}`);
      return section;
    }
  }

  console.warn('⚠️ No Procedures section found. Available sections:',
    sections.map(s => `${s.sectionNumber}. ${s.title}`).join(', '));

  return null;
}

/**
 * Get all procedure subsections (e.g., 6.1, 6.2, 6.3) under the main Procedures section
 * If no subsections found, returns the main Procedures section itself as a single-item array
 */
export function extractProcedureSubsections(markdown: string): MarkdownSection[] {
  const proceduresSection = extractProceduresSection(markdown);
  if (!proceduresSection) {
    console.warn('⚠️ No Procedures section found, cannot extract subsections');
    return [];
  }

  // Get subsections matching "6.X" pattern (or whatever the procedures section number is)
  const pattern = new RegExp(`^${proceduresSection.sectionNumber.replace(/\./g, '\\.')}\\.\\d+$`);
  const subsections = extractSectionsByPattern(markdown, pattern);

  if (subsections.length > 0) {
    console.log(`✅ Found ${subsections.length} procedure subsections`);
    return subsections;
  }

  // No subsections found - return the main Procedures section itself
  console.log(`ℹ️ No subsections found, using main Procedures section: ${proceduresSection.sectionNumber}. ${proceduresSection.title}`);
  return [proceduresSection];
}

/**
 * Extract section content only (without the heading)
 */
export function getSectionContent(section: MarkdownSection): string {
  return section.content;
}

/**
 * Extract section with heading
 */
export function getSectionWithHeading(section: MarkdownSection, markdown: string): string {
  const lines = markdown.split('\n');
  const headingLine = lines[section.lineStart - 1] || ''; // line before content
  return headingLine + '\n\n' + section.content;
}

/**
 * Summarize document structure (useful for debugging)
 */
export function summarizeStructure(markdown: string): string {
  const sections = extractAllSections(markdown);
  return sections.map(s => `${'  '.repeat(s.level - 1)}${s.sectionNumber}. ${s.title} (${s.content.length} chars)`).join('\n');
}
