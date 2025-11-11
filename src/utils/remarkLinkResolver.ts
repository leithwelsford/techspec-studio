/**
 * Remark Plugin for Link Resolution
 *
 * Custom remark plugin to resolve {{fig:...}} and {{ref:...}} syntax
 * in markdown preview using react-markdown.
 */

import { visit, SKIP } from 'unist-util-visit';
import type { Root, Text, Link, Parent, PhrasingContent } from 'mdast';
import type { FigureReference, CitationReference } from './linkResolver';
import { LINK_PATTERNS } from './linkResolver';

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
          // Resolve figure reference
          const figure = figures.find(f => f.id === id);
          if (figure) {
            // Create clickable link
            newNodes.push({
              type: 'link',
              url: `#diagram-${id}`,
              title: `Navigate to ${figure.title}`,
              children: [
                {
                  type: 'text',
                  value: `Figure ${figure.number}`,
                },
              ],
              data: {
                hProperties: {
                  className: 'figure-reference',
                  'data-diagram-id': id,
                  'data-diagram-type': figure.type,
                },
              },
            } as Link);
          } else {
            // Invalid reference - show as broken link with warning
            newNodes.push({
              type: 'link',
              url: '#',
              title: `Invalid figure reference: ${id}`,
              children: [
                {
                  type: 'text',
                  value: `{{fig:${id}}}`,
                },
              ],
              data: {
                hProperties: {
                  className: 'figure-reference-invalid',
                  'data-diagram-id': id,
                },
              },
            } as Link);
          }
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
