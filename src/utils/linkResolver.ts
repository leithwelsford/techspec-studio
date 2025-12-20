/**
 * Link Resolution Utilities
 *
 * Resolves {{fig:diagram-id}} and {{ref:reference-id}} syntax in markdown documents.
 * Provides parsing, validation, and resolution functions.
 */

export interface FigureReference {
  id: string;
  number: string;
  title: string;
  type: 'block' | 'sequence' | 'flow';
  slug?: string; // matches {{fig:slug}} reference, e.g., "5-1-system-architecture"
}

export interface CitationReference {
  id: string;
  number: string;
  title: string;
}

export interface ParsedLink {
  type: 'figure' | 'reference';
  id: string;
  raw: string;
  start: number;
  end: number;
}

/**
 * Regex patterns for link syntax
 */
export const LINK_PATTERNS = {
  figure: /\{\{fig:([a-zA-Z0-9-_]+)\}\}/g,
  reference: /\{\{ref:([a-zA-Z0-9-_]+)\}\}/g,
  all: /\{\{(fig|ref):([a-zA-Z0-9-_]+)\}\}/g,
};

/**
 * Parse all links in markdown text
 */
export function parseLinks(markdown: string): ParsedLink[] {
  const links: ParsedLink[] = [];
  const regex = new RegExp(LINK_PATTERNS.all.source, 'g');

  let match;
  while ((match = regex.exec(markdown)) !== null) {
    links.push({
      type: match[1] as 'figure' | 'reference',
      id: match[2],
      raw: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return links;
}

/**
 * Parse figure references only
 */
export function parseFigureReferences(markdown: string): string[] {
  const ids: string[] = [];
  const regex = new RegExp(LINK_PATTERNS.figure.source, 'g');

  let match;
  while ((match = regex.exec(markdown)) !== null) {
    ids.push(match[1]);
  }

  return ids;
}

/**
 * Parse citation references only
 */
export function parseCitationReferences(markdown: string): string[] {
  const ids: string[] = [];
  const regex = new RegExp(LINK_PATTERNS.reference.source, 'g');

  let match;
  while ((match = regex.exec(markdown)) !== null) {
    ids.push(match[1]);
  }

  return ids;
}

/**
 * Validate if a link ID exists in the provided list
 */
export function validateLinkId(id: string, validIds: string[]): boolean {
  return validIds.includes(id);
}

/**
 * Find invalid links in markdown
 */
export function findInvalidLinks(
  markdown: string,
  validFigureIds: string[],
  validReferenceIds: string[]
): ParsedLink[] {
  const allLinks = parseLinks(markdown);

  return allLinks.filter(link => {
    if (link.type === 'figure') {
      return !validateLinkId(link.id, validFigureIds);
    } else {
      return !validateLinkId(link.id, validReferenceIds);
    }
  });
}

/**
 * Extract section number from heading
 * Example: "## 4. Architecture Overview" -> "4"
 */
export function extractSectionNumber(heading: string): string | null {
  const match = heading.match(/^#+\s*(\d+)(?:\.\d+)*\./);
  return match ? match[1] : null;
}

/**
 * Calculate figure number based on section and position
 * Example: section "4", position 1 -> "4-1"
 */
export function calculateFigureNumber(sectionNumber: string, position: number): string {
  return `${sectionNumber}-${position}`;
}

/**
 * Resolve figure reference to display text
 * Example: "converged-service-edge" -> "Figure 4-1"
 */
export function resolveFigureReference(
  id: string,
  figures: FigureReference[]
): string | null {
  const figure = figures.find(f => f.id === id);
  return figure ? `Figure ${figure.number}` : null;
}

/**
 * Resolve citation reference to display text
 * Example: "3gpp-ts-23-203" -> "3GPP TS 23.203 [1]"
 */
export function resolveCitationReference(
  id: string,
  citations: CitationReference[]
): string | null {
  const citation = citations.find(c => c.id === id);
  return citation ? `${citation.title} [${citation.number}]` : null;
}

/**
 * Ensure every {{fig:...}} placeholder has a caption line after it
 * If missing, adds a caption line using the diagram's title
 *
 * Caption format: *Figure X-Y: Diagram Title*
 */
export function ensureFigureCaptions(
  markdown: string,
  figures: FigureReference[]
): string {
  const lines = markdown.split('\n');
  const result: string[] = [];

  // Pattern to detect existing caption lines
  const captionPattern = /^\s*\*?Figure\s+[\d\-\.]+:?\s+/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    result.push(line);

    // Check if this line contains a {{fig:...}} placeholder
    const figMatch = line.match(/\{\{fig:([a-zA-Z0-9-_]+)\}\}/);
    if (figMatch) {
      const figId = figMatch[1];
      const figure = figures.find(f => f.id === figId);

      if (figure) {
        // Look ahead to see if there's already a caption within the next 2 non-empty lines
        let hasCaption = false;
        let lookAhead = 1;

        while (lookAhead <= 3 && i + lookAhead < lines.length) {
          const nextLine = lines[i + lookAhead].trim();
          if (nextLine === '') {
            lookAhead++;
            continue;
          }
          // Check if it's a caption line
          if (captionPattern.test(nextLine)) {
            hasCaption = true;
          }
          break; // Stop at first non-empty line
        }

        // If no caption found, add one
        if (!hasCaption) {
          result.push(''); // Empty line before caption
          result.push(`*Figure ${figure.number}: ${figure.title}*`);
          console.log(`[ensureFigureCaptions] Added missing caption for {{fig:${figId}}}: "Figure ${figure.number}: ${figure.title}"`);
        }
      }
    }
  }

  return result.join('\n');
}

/**
 * Replace all link syntax with resolved text
 */
export function resolveAllLinks(
  markdown: string,
  figures: FigureReference[],
  citations: CitationReference[]
): string {
  // First, ensure all figures have captions
  let resolved = ensureFigureCaptions(markdown, figures);

  // Resolve figure references
  resolved = resolved.replace(
    new RegExp(LINK_PATTERNS.figure.source, 'g'),
    (match, id) => {
      const resolvedRef = resolveFigureReference(id, figures);
      return resolvedRef || match; // Keep original if not found
    }
  );

  // Resolve citation references
  resolved = resolved.replace(
    new RegExp(LINK_PATTERNS.reference.source, 'g'),
    (match, id) => {
      const resolvedRef = resolveCitationReference(id, citations);
      return resolvedRef || match; // Keep original if not found
    }
  );

  return resolved;
}

/**
 * Extract markdown headings with their positions
 */
export interface MarkdownHeading {
  level: number;
  text: string;
  sectionNumber: string | null;
  position: number;
}

export function extractHeadings(markdown: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  const lines = markdown.split('\n');

  lines.forEach((line, index) => {
    const match = line.match(/^(#+)\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2];
      const sectionNumber = extractSectionNumber(line);

      headings.push({
        level,
        text,
        sectionNumber,
        position: index,
      });
    }
  });

  return headings;
}

/**
 * Generate autocomplete suggestions for figure references
 */
export function generateFigureSuggestions(
  figures: FigureReference[],
  query: string = ''
): Array<{ id: string; label: string; description: string }> {
  const lowerQuery = query.toLowerCase();

  return figures
    .filter(fig => {
      if (!query) return true;
      return (
        fig.id.toLowerCase().includes(lowerQuery) ||
        fig.title.toLowerCase().includes(lowerQuery)
      );
    })
    .map(fig => ({
      id: fig.id,
      label: `{{fig:${fig.id}}}`,
      description: `Figure ${fig.number}: ${fig.title}`,
    }));
}

/**
 * Generate autocomplete suggestions for reference citations
 */
export function generateReferenceSuggestions(
  citations: CitationReference[],
  query: string = ''
): Array<{ id: string; label: string; description: string }> {
  const lowerQuery = query.toLowerCase();

  return citations
    .filter(ref => {
      if (!query) return true;
      return (
        ref.id.toLowerCase().includes(lowerQuery) ||
        ref.title.toLowerCase().includes(lowerQuery)
      );
    })
    .map(ref => ({
      id: ref.id,
      label: `{{ref:${ref.id}}}`,
      description: `[${ref.number}] ${ref.title}`,
    }));
}
