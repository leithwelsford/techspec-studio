/**
 * Post-process Mermaid-rendered SVG.
 *
 * Previous versions attempted to merge tspans that appeared wrap-broken
 * mid-word, but it incorrectly merged across user-intentional <br> breaks.
 * The current approach is to strip <br> tags from source BEFORE rendering
 * (see stripBrTagsFromMermaidSource) so Mermaid controls wrapping itself.
 */
export function mergeMidWordTspans(svgString: string): string {
  return svgString;
}

/**
 * Remove <br>, <br/>, <br /> tags from Mermaid source.
 * Replaces each with a single space so text flows continuously, letting
 * Mermaid's layout engine decide where to wrap based on its wrappingWidth
 * configuration.
 *
 * Applied to the Mermaid source code before it's passed to mermaid.render().
 */
export function stripBrTagsFromMermaidSource(source: string): string {
  return source.replace(/<br\s*\/?>/gi, ' ').replace(/  +/g, ' ');
}
