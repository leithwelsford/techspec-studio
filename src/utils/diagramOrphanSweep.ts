import * as Diff from 'diff';
import type { BlockDiagram, MermaidDiagram } from '../types';
import { parseFigureReferences } from './linkResolver';

export interface OrphanSweepResult {
  orphanedBlockIds: string[];
  orphanedMermaidIds: string[];
  removedTitles: string[];
}

/**
 * Find diagrams that are no longer referenced by any {{fig:...}} placeholder
 * in the given markdown. A diagram is considered referenced if ANY of these
 * match against the set of fig-reference IDs in the markdown:
 *   - diagram.id
 *   - diagram.slug
 *   - diagram.figureNumber                (e.g. "5-1")
 *   - `fig-${diagram.figureNumber}`
 *   - any ref ID that starts with `${diagram.figureNumber}-` (prefix slug form)
 *
 * This mirrors the resolution strategies in linkResolver so the sweep does
 * not remove diagrams that the renderer would otherwise successfully resolve.
 */
export function findOrphanedDiagrams(
  markdown: string,
  blockDiagrams: BlockDiagram[],
  mermaidDiagrams: MermaidDiagram[]
): OrphanSweepResult {
  const refIds = new Set(parseFigureReferences(markdown));

  const isReferenced = (diagram: BlockDiagram | MermaidDiagram): boolean => {
    if (refIds.has(diagram.id)) return true;
    const slug = (diagram as { slug?: string }).slug;
    if (slug && refIds.has(slug)) return true;
    const figNum = diagram.figureNumber;
    if (figNum) {
      if (refIds.has(figNum)) return true;
      if (refIds.has(`fig-${figNum}`)) return true;
      for (const ref of refIds) {
        if (ref.startsWith(`${figNum}-`)) return true;
      }
    }
    return false;
  };

  const orphanedBlockIds: string[] = [];
  const orphanedMermaidIds: string[] = [];
  const removedTitles: string[] = [];

  for (const d of blockDiagrams) {
    if (!isReferenced(d)) {
      orphanedBlockIds.push(d.id);
      removedTitles.push(d.title || d.id);
    }
  }
  for (const d of mermaidDiagrams) {
    if (!isReferenced(d)) {
      orphanedMermaidIds.push(d.id);
      removedTitles.push(d.title || d.id);
    }
  }

  return { orphanedBlockIds, orphanedMermaidIds, removedTitles };
}

/**
 * Compute line-level additions / deletions between two markdown snippets
 * using the same diff library as DiffViewer.
 */
export function computeFixLineStats(original: string, modified: string): {
  added: number;
  removed: number;
} {
  const changes = Diff.diffLines(original || '', modified || '');
  let added = 0;
  let removed = 0;
  for (const change of changes) {
    const lines = change.value.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    if (change.added) added += lines.length;
    else if (change.removed) removed += lines.length;
  }
  return { added, removed };
}
