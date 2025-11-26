/**
 * Figure Numbering Utilities
 *
 * Automatically calculate figure numbers based on document structure.
 * Figures are numbered based on the section they appear in or are referenced from.
 *
 * Format: "Section-Position" (e.g., "4-1" = first figure in section 4)
 */

import { extractHeadings, parseFigureReferences } from './linkResolver';
import type { BlockDiagram, MermaidDiagram } from '../types';

export interface DiagramWithNumber {
  id: string;
  type: 'block' | 'sequence' | 'flow' | 'state' | 'class';
  title: string;
  figureNumber: string;
  sectionNumber: string | null;
  position: number;
}

/**
 * Extract diagram references from markdown and assign positions
 */
function extractDiagramPositions(markdown: string): Map<string, { sectionNumber: string | null; position: number }> {
  const lines = markdown.split('\n');
  const headings = extractHeadings(markdown);
  const positions = new Map<string, { sectionNumber: string | null; position: number }>();

  let currentSection: string | null = null;
  const sectionCounters = new Map<string, number>(); // Track position within each section

  lines.forEach((line, lineIndex) => {
    // Check if this line is a heading
    const heading = headings.find(h => h.position === lineIndex);
    if (heading && heading.sectionNumber) {
      currentSection = heading.sectionNumber;
      if (!sectionCounters.has(currentSection)) {
        sectionCounters.set(currentSection, 0);
      }
    }

    // Extract figure references from this line
    const figureIds = parseFigureReferences(line);
    figureIds.forEach(id => {
      // Only assign position if not already assigned (first occurrence wins)
      if (!positions.has(id)) {
        const section = currentSection || '0'; // Use '0' for figures before any numbered section
        let counter = sectionCounters.get(section) || 0;
        counter++;
        sectionCounters.set(section, counter);

        positions.set(id, {
          sectionNumber: currentSection,
          position: counter,
        });
      }
    });
  });

  return positions;
}

/**
 * Calculate figure numbers for all diagrams based on document structure
 *
 * Strategy:
 * 1. Extract all {{fig:...}} references from the specification markdown
 * 2. Determine the section number where each reference appears
 * 3. Assign sequential numbers within each section
 * 4. For diagrams without references, assign to a default section (e.g., "A" for appendix)
 *
 * @param markdown - The specification markdown content
 * @param blockDiagrams - All block diagrams in the project
 * @param mermaidDiagrams - All Mermaid diagrams in the project
 * @returns Map of diagram ID to calculated figure number
 */
export function calculateFigureNumbers(
  markdown: string,
  blockDiagrams: BlockDiagram[],
  mermaidDiagrams: MermaidDiagram[]
): Map<string, string> {
  const figureNumbers = new Map<string, string>();
  const positions = extractDiagramPositions(markdown);

  // Create a combined list of all diagrams
  const allDiagrams = [
    ...blockDiagrams.map(d => ({ id: d.id, type: 'block' as const })),
    ...mermaidDiagrams.map(d => ({ id: d.id, type: d.type })),
  ];

  // Assign numbers based on positions
  allDiagrams.forEach(diagram => {
    const pos = positions.get(diagram.id);
    if (pos) {
      const section = pos.sectionNumber || '0';
      const figNum = `${section}-${pos.position}`;
      figureNumbers.set(diagram.id, figNum);
    } else {
      // Diagram not referenced in document - assign to appendix
      // Count unreferenced diagrams
      const unreferencedCount = Array.from(figureNumbers.values())
        .filter(num => num.startsWith('A-'))
        .length;
      figureNumbers.set(diagram.id, `A-${unreferencedCount + 1}`);
    }
  });

  return figureNumbers;
}

/**
 * Update all diagrams with calculated figure numbers
 *
 * This function should be called whenever:
 * - The specification markdown changes
 * - Diagrams are added or removed
 * - User explicitly requests renumbering
 *
 * @param markdown - Current specification markdown
 * @param blockDiagrams - Block diagrams to update
 * @param mermaidDiagrams - Mermaid diagrams to update
 * @returns Updated diagrams with figure numbers
 */
export function assignFigureNumbers(
  markdown: string,
  blockDiagrams: BlockDiagram[],
  mermaidDiagrams: MermaidDiagram[]
): {
  blockDiagrams: BlockDiagram[];
  mermaidDiagrams: MermaidDiagram[];
} {
  const figureNumbers = calculateFigureNumbers(markdown, blockDiagrams, mermaidDiagrams);

  const updatedBlockDiagrams = blockDiagrams.map(d => ({
    ...d,
    figureNumber: figureNumbers.get(d.id) || 'X-X',
  }));

  const updatedMermaidDiagrams = mermaidDiagrams.map(d => ({
    ...d,
    figureNumber: figureNumbers.get(d.id) || 'X-X',
  }));

  return {
    blockDiagrams: updatedBlockDiagrams,
    mermaidDiagrams: updatedMermaidDiagrams,
  };
}

/**
 * Get all diagrams with their calculated figure numbers in document order
 *
 * Useful for:
 * - Generating a list of figures
 * - Displaying diagram navigation
 * - Export preparation
 *
 * @param markdown - Specification markdown
 * @param blockDiagrams - Block diagrams
 * @param mermaidDiagrams - Mermaid diagrams
 * @returns Sorted list of diagrams with numbers
 */
export function getDiagramsInOrder(
  markdown: string,
  blockDiagrams: BlockDiagram[],
  mermaidDiagrams: MermaidDiagram[]
): DiagramWithNumber[] {
  const figureNumbers = calculateFigureNumbers(markdown, blockDiagrams, mermaidDiagrams);
  const positions = extractDiagramPositions(markdown);

  const diagrams: DiagramWithNumber[] = [
    ...blockDiagrams.map(d => ({
      id: d.id,
      type: 'block' as const,
      title: d.title,
      figureNumber: figureNumbers.get(d.id) || 'X-X',
      sectionNumber: positions.get(d.id)?.sectionNumber || null,
      position: positions.get(d.id)?.position || 0,
    })),
    ...mermaidDiagrams.map(d => ({
      id: d.id,
      type: d.type,
      title: d.title,
      figureNumber: figureNumbers.get(d.id) || 'X-X',
      sectionNumber: positions.get(d.id)?.sectionNumber || null,
      position: positions.get(d.id)?.position || 0,
    })),
  ];

  // Sort by section number, then position
  diagrams.sort((a, b) => {
    const aSection = a.sectionNumber || 'Z'; // Put unreferenced at end
    const bSection = b.sectionNumber || 'Z';

    if (aSection !== bSection) {
      return aSection.localeCompare(bSection, undefined, { numeric: true });
    }

    return a.position - b.position;
  });

  return diagrams;
}

/**
 * Generate a table of figures in markdown format
 *
 * Example output:
 * ## List of Figures
 *
 * - Figure 4-1: Converged Service Edge Architecture
 * - Figure 4-2: Policy Control Function
 * - Figure 5-1: Authentication Flow
 *
 * @param markdown - Specification markdown
 * @param blockDiagrams - Block diagrams
 * @param mermaidDiagrams - Mermaid diagrams
 * @returns Markdown table of figures
 */
export function generateTableOfFigures(
  markdown: string,
  blockDiagrams: BlockDiagram[],
  mermaidDiagrams: MermaidDiagram[]
): string {
  const diagrams = getDiagramsInOrder(markdown, blockDiagrams, mermaidDiagrams);

  let output = '## List of Figures\n\n';

  diagrams.forEach(diagram => {
    output += `- Figure ${diagram.figureNumber}: ${diagram.title}\n`;
  });

  return output;
}
