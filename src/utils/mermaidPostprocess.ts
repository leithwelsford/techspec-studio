/**
 * Post-process Mermaid-rendered SVG to fix common issues:
 * - State diagram edge labels wrap mid-word into separate tspans
 *   ("Action=RESTRICT_ACCES" / "S"). Merge consecutive tspans that
 *   appear to be a mid-word break.
 */
export function mergeMidWordTspans(svgString: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const textElements = doc.querySelectorAll('text');
    let mergedCount = 0;

    textElements.forEach((textEl) => {
      // Query all descendant tspans, not just direct children
      const tspans = Array.from(textEl.querySelectorAll('tspan.text-inner-tspan'));
      if (tspans.length < 2) return;

      // Walk backwards so removals don't invalidate indices
      for (let i = tspans.length - 2; i >= 0; i--) {
        const curr = tspans[i];
        const next = tspans[i + 1];
        const currText = curr.textContent || '';
        const nextText = next.textContent || '';
        const currEnd = currText.slice(-1);
        const nextStart = nextText.slice(0, 1);
        // Mid-word split if both sides of the boundary are alphanumeric-ish
        const isMidWord =
          /[A-Za-z0-9=_\-]/.test(currEnd) &&
          /[A-Za-z0-9=_\-]/.test(nextStart);
        if (isMidWord) {
          curr.textContent = currText + nextText;
          next.remove();
          mergedCount++;
        }
      }
    });

    if (mergedCount > 0) {
      console.log(`[Mermaid Postprocess] Merged ${mergedCount} mid-word tspan splits`);
    }

    return new XMLSerializer().serializeToString(doc);
  } catch (err) {
    console.warn('[Mermaid Postprocess] mergeMidWordTspans failed:', err);
    return svgString;
  }
}
