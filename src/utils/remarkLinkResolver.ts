/**
 * Remark Plugin for Link Resolution
 *
 * Custom remark plugin to resolve {{fig:...}} and {{ref:...}} syntax
 * in markdown preview using react-markdown.
 */

import { visit } from 'unist-util-visit';
import type { Root, Text, Link, Parent, PhrasingContent } from 'mdast';
import type { FigureReference, CitationReference } from './linkResolver';
import { LINK_PATTERNS } from './linkResolver';

/**
 * Convert a string to a URL-friendly slug
 * "Logical Architecture CP UP" → "logical-architecture-cp-up"
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Extract text content from a node (handles text, emphasis, strong, etc.)
 */
function extractTextFromNode(node: { type: string; value?: string; children?: Array<{ type: string; value?: string; children?: unknown[] }> }): string {
  if (node.type === 'text' && node.value) {
    return node.value;
  }
  if (node.children && Array.isArray(node.children)) {
    return node.children
      .map(child => extractTextFromNode(child as { type: string; value?: string; children?: Array<{ type: string; value?: string; children?: unknown[] }> }))
      .join('');
  }
  return '';
}

/**
 * Look ahead in the tree for a figure caption pattern
 * Searches both sibling nodes and subsequent paragraphs
 * Returns the figure number if found (e.g., "5-1")
 */
function findCaptionFigureNumber(
  tree: Root,
  parent: Parent,
  nodeIndex: number,
  remainingTextInNode: string
): string | null {
  const captionPattern = /Figure\s+(\d+(?:-\d+)?)\s*:/i;

  // First check remaining text in current node
  const match = remainingTextInNode.match(captionPattern);
  if (match) {
    return match[1];
  }

  // Look at subsequent sibling nodes within the same paragraph
  const maxSiblingLookahead = Math.min(nodeIndex + 10, parent.children.length);
  for (let i = nodeIndex + 1; i < maxSiblingLookahead; i++) {
    const sibling = parent.children[i];
    const siblingText = extractTextFromNode(sibling as { type: string; value?: string; children?: Array<{ type: string; value?: string; children?: unknown[] }> });

    if (siblingText) {
      const siblingMatch = siblingText.match(captionPattern);
      if (siblingMatch) {
        return siblingMatch[1];
      }
    }
  }

  // Find parent's index in the tree and look at subsequent paragraphs
  const parentIndex = tree.children.indexOf(parent as typeof tree.children[number]);
  if (parentIndex !== -1) {
    // Look at next few top-level nodes (paragraphs, etc.)
    const maxParagraphLookahead = Math.min(parentIndex + 5, tree.children.length);
    for (let i = parentIndex + 1; i < maxParagraphLookahead; i++) {
      const nextNode = tree.children[i];
      const nodeText = extractTextFromNode(nextNode as { type: string; value?: string; children?: Array<{ type: string; value?: string; children?: unknown[] }> });

      if (nodeText) {
        const nodeMatch = nodeText.match(captionPattern);
        if (nodeMatch) {
          return nodeMatch[1];
        }
      }
    }
  }

  return null;
}

export interface LinkResolverOptions {
  figures: FigureReference[];
  citations: CitationReference[];
  onNavigate?: (type: 'figure' | 'reference', id: string) => void;
}

/**
 * Remark plugin to resolve {{fig:...}} and {{ref:...}} syntax
 *
 * Transforms:
 * - {{fig:diagram-id}} → [Figure 4-1](#diagram-id) (clickable link)
 * - {{ref:reference-id}} → [3GPP TS 23.203 [1]](#reference-id) (clickable link)
 */
export function remarkLinkResolver(options: LinkResolverOptions) {
  const { figures, citations } = options;

  return function transformer(tree: Root) {
    try {
      // Collect all text nodes that need transformation
      const nodesToReplace: Array<{
        parent: Parent;
        index: number;
        newNodes: PhrasingContent[];
      }> = [];

      visit(tree, 'text', (node: Text, index: number | undefined, parent: Parent | undefined) => {
        if (!parent || index === undefined) return;

      const { value } = node;

      // Check if text contains link syntax
      const hasFigureLink = LINK_PATTERNS.figure.test(value);
      const hasRefLink = LINK_PATTERNS.reference.test(value);

      if (!hasFigureLink && !hasRefLink) return;

      // Reset regex state
      LINK_PATTERNS.figure.lastIndex = 0;
      LINK_PATTERNS.reference.lastIndex = 0;

      // Parse and build replacement nodes
      const newNodes: PhrasingContent[] = [];
      let lastIndex = 0;

      // Create combined regex
      const combinedRegex = new RegExp(
        `(${LINK_PATTERNS.figure.source})|(${LINK_PATTERNS.reference.source})`,
        'g'
      );

      let match;
      while ((match = combinedRegex.exec(value)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
          newNodes.push({
            type: 'text',
            value: value.slice(lastIndex, match.index),
          });
        }

        // Determine type and ID
        const isFigure = match[1] !== undefined;
        const id = isFigure ? match[2] : match[4];

        if (isFigure) {
          // Resolve figure reference - exact matching first, then keyword matching
          // only if it results in exactly ONE match (to avoid wrong diagrams)
          let figure = figures.find(f => f.id === id);
          const searchSlug = id.toLowerCase();

          // Strategy 1: Match by figure number (e.g., "5-1" or "fig-5-1")
          if (!figure) {
            const numMatch = searchSlug.match(/^(?:fig-?)?(\d+(?:-\d+)?)$/);
            if (numMatch) {
              figure = figures.find(f => f.number === numMatch[1]);
            }
          }

          // Strategy 2: Exact slug match on title (strict - full match required)
          if (!figure) {
            figure = figures.find(f => slugify(f.title) === searchSlug);
          }

          // Strategy 3: Exact ID match ignoring case
          if (!figure) {
            figure = figures.find(f => f.id.toLowerCase() === searchSlug);
          }

          // Strategy 4: Keyword matching - ALL keywords must appear in title
          // Only use if exactly ONE figure matches (prevents wrong matches)
          if (!figure) {
            const searchWords = searchSlug.split('-').filter(w => w.length > 1);
            if (searchWords.length >= 2) {
              const matches = figures.filter(f => {
                const titleLower = f.title.toLowerCase();
                return searchWords.every(word => titleLower.includes(word));
              });
              if (matches.length === 1) {
                figure = matches[0];
              }
            }
          }

          // Strategy 5: Title slug contains search slug
          // Only use if exactly ONE figure matches
          if (!figure) {
            const containsMatches = figures.filter(f =>
              slugify(f.title).includes(searchSlug)
            );
            if (containsMatches.length === 1) {
              figure = containsMatches[0];
            }
          }

          // Strategy 6: Caption-based fallback
          // Look for *Figure X-Y:* pattern in following text/nodes and subsequent paragraphs
          if (!figure && parent && index !== undefined) {
            const remainingText = value.slice(match.index + match[0].length);
            const captionFigNum = findCaptionFigureNumber(tree, parent, index, remainingText);
            if (captionFigNum) {
              figure = figures.find(f => f.number === captionFigNum);
            }
          }

          const resolvedId = figure ? figure.id : id;
          const resolvedNumber = figure ? figure.number : 'X-X';
          const resolvedTitle = figure ? figure.title : id;
          const isValid = !!figure;

          newNodes.push({
            type: 'link',
            url: `#figure-${resolvedId}`,  // Changed prefix to 'figure' to indicate it needs rendering
            title: isValid ? `Figure ${resolvedNumber}: ${resolvedTitle}` : `Unresolved: ${id}`,
            children: [
              {
                type: 'text',
                value: isValid ? `Figure ${resolvedNumber}` : `{{fig:${id}}}`,
              },
            ],
            data: {
              hProperties: {
                className: isValid ? 'figure-reference' : 'figure-reference-unresolved',
                'data-figure-slug': id,  // Original slug from markdown
                'data-diagram-id': resolvedId,
                'data-resolved': isValid ? 'true' : 'false',
              },
            },
          } as Link);
        } else {
          // Resolve citation reference
          const citation = citations.find(c => c.id === id);
          if (citation) {
            // Create clickable link
            newNodes.push({
              type: 'link',
              url: `#reference-${id}`,
              title: `Navigate to ${citation.title}`,
              children: [
                {
                  type: 'text',
                  value: `${citation.title} [${citation.number}]`,
                },
              ],
              data: {
                hProperties: {
                  className: 'citation-reference',
                  'data-reference-id': id,
                },
              },
            } as Link);
          } else {
            // Invalid reference - show as broken link with warning
            newNodes.push({
              type: 'link',
              url: '#',
              title: `Invalid reference: ${id}`,
              children: [
                {
                  type: 'text',
                  value: `{{ref:${id}}}`,
                },
              ],
              data: {
                hProperties: {
                  className: 'citation-reference-invalid',
                  'data-reference-id': id,
                },
              },
            } as Link);
          }
        }

        lastIndex = match.index + match[0].length;
      }

      // Add remaining text
      if (lastIndex < value.length) {
        newNodes.push({
          type: 'text',
          value: value.slice(lastIndex),
        });
      }

      // Queue replacement
      if (newNodes.length > 0) {
        nodesToReplace.push({ parent, index, newNodes });
      }
      });

      // Apply all replacements in reverse order to preserve indices
      nodesToReplace.reverse().forEach(({ parent, index, newNodes }) => {
        parent.children.splice(index, 1, ...newNodes);
      });
    } catch (error) {
      console.error('Error in remarkLinkResolver:', error);
      // Return tree unchanged if there's an error
    }
  };
}

/**
 * CSS styles for link references (to be added to global styles)
 */
export const linkReferenceStyles = `
/* Figure references */
.figure-reference {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
  border-bottom: 1px dotted #3b82f6;
  cursor: pointer;
}

.figure-reference:hover {
  color: #2563eb;
  border-bottom-color: #2563eb;
}

.figure-reference-invalid {
  color: #ef4444;
  text-decoration: none;
  font-weight: 500;
  border-bottom: 1px dotted #ef4444;
  cursor: not-allowed;
}

.figure-reference-invalid:hover {
  color: #dc2626;
  border-bottom-color: #dc2626;
}

/* Citation references */
.citation-reference {
  color: #8b5cf6;
  text-decoration: none;
  font-weight: 500;
  border-bottom: 1px dotted #8b5cf6;
  cursor: pointer;
}

.citation-reference:hover {
  color: #7c3aed;
  border-bottom-color: #7c3aed;
}

.citation-reference-invalid {
  color: #ef4444;
  text-decoration: none;
  font-weight: 500;
  border-bottom: 1px dotted #ef4444;
  cursor: not-allowed;
}

.citation-reference-invalid:hover {
  color: #dc2626;
  border-bottom-color: #dc2626;
}
`;
