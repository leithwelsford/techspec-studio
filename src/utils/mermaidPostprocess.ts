/**
 * Post-process Mermaid-rendered SVG.
 *
 * Previous versions attempted to merge tspans that appeared wrap-broken
 * mid-word, but it incorrectly merged across user-intentional <br> breaks
 * (producing garbage like "FUIAction=TERMINATEor"). Distinguishing
 * wrap-breaks from <br>-breaks requires context Mermaid doesn't preserve
 * in the SVG output, so the merge logic has been removed.
 *
 * For now this is a passthrough. If state diagram labels wrap mid-word,
 * the fix is to shorten the source text or add more <br> tags.
 */
export function mergeMidWordTspans(svgString: string): string {
  return svgString;
}
