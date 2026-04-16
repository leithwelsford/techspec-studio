/**
 * Lua Filter Generator for Pandoc DOCX Export
 *
 * Generates a Pandoc Lua filter that remaps Pandoc's hard-coded internal
 * style names to the actual style names found in the uploaded Word template.
 *
 * This is necessary because Pandoc maps markdown elements to fixed Word style
 * names (e.g., lists → "Compact", blockquotes → "Block Text"). If a corporate
 * template uses different names, the output won't match the template without
 * this remapping.
 *
 * The filter is generated dynamically per-export based on the template analysis
 * and sent alongside the markdown to the Pandoc backend.
 */

import type { PandocStyleRoleMap } from '../types';

/**
 * Escape a string for use inside a Lua double-quoted string literal.
 */
function luaEscape(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

/**
 * Generate a Pandoc Lua filter from a style role map.
 *
 * Returns the Lua source code as a string, or null if no remappings are needed.
 * The filter uses Pandoc's AST traversal to wrap elements in custom-style Divs,
 * which Pandoc then maps to the specified Word styles in the output DOCX.
 *
 * @param roleMap - Mapping of Pandoc roles to template style names
 * @returns Lua filter source code, or null if no mappings
 */
export function generateLuaFilter(roleMap?: PandocStyleRoleMap): string | null {
  if (!roleMap) return null;

  const sections: string[] = [];

  // Header
  sections.push(`-- Auto-generated style remapping filter for TechSpec Studio
-- Maps Pandoc's default style names to template-specific style names
-- Generated at: ${new Date().toISOString()}

-- Helper: wrap block element(s) in a custom-style Div
local function styled(blocks, style)
  if type(blocks) ~= "table" then
    blocks = {blocks}
  end
  return pandoc.Div(blocks, pandoc.Attr("", {}, {{"custom-style", style}}))
end
`);

  let hasFunctions = false;

  // --- Bullet list remapping ---
  if (roleMap.listBullet) {
    hasFunctions = true;
    sections.push(`-- Remap bullet lists: Pandoc "Compact" → "${roleMap.listBullet}"
function BulletList(el)
  return styled({el}, "${luaEscape(roleMap.listBullet)}")
end
`);
  }

  // --- Numbered list remapping ---
  if (roleMap.listNumber) {
    hasFunctions = true;
    sections.push(`-- Remap numbered lists: Pandoc "Compact" → "${roleMap.listNumber}"
function OrderedList(el)
  return styled({el}, "${luaEscape(roleMap.listNumber)}")
end
`);
  }

  // --- Table style remapping ---
  // Set custom-style directly on the Table element's attributes rather than
  // wrapping in a Div, since table styles in Word are applied at the table
  // level (<w:tblStyle>), not as paragraph styles.
  if (roleMap.tableStyle) {
    hasFunctions = true;
    sections.push(`-- Apply table style: "${roleMap.tableStyle}"
function Table(el)
  el.attr.attributes["custom-style"] = "${luaEscape(roleMap.tableStyle)}"
  return el
end
`);
  }

  // --- Block text (blockquote) remapping ---
  // Only emit if the JS-side custom-style wrapping didn't already handle it.
  // When JS wraps blockquotes, Pandoc parses them as Div elements, not BlockQuotes,
  // so this filter only catches un-wrapped blockquotes.
  if (roleMap.blockText) {
    hasFunctions = true;
    sections.push(`-- Remap blockquotes: Pandoc "Block Text" → "${roleMap.blockText}"
function BlockQuote(el)
  return styled(el.content, "${luaEscape(roleMap.blockText)}")
end
`);
  }

  // --- Source code (code block) remapping ---
  // Same logic as blockquotes — only catches code blocks not already wrapped by JS.
  if (roleMap.sourceCode) {
    hasFunctions = true;
    sections.push(`-- Remap code blocks: Pandoc "Source Code" → "${roleMap.sourceCode}"
function CodeBlock(el)
  return styled({el}, "${luaEscape(roleMap.sourceCode)}")
end
`);
  }

  // --- Body text remapping ---
  // This is the most aggressive remap — wraps every plain Para not already
  // inside a custom-style Div. Only emitted when the template uses a non-standard
  // body text name (rare but important for exact template matching).
  if (roleMap.bodyText) {
    hasFunctions = true;
    sections.push(`-- Remap body text: Pandoc "Body Text" → "${roleMap.bodyText}"
-- Uses Pandoc-level filter to avoid wrapping paragraphs already inside custom-style Divs
function Pandoc(doc)
  local newblocks = {}
  for _, block in ipairs(doc.blocks) do
    if block.t == "Para" then
      table.insert(newblocks, styled({block}, "${luaEscape(roleMap.bodyText)}"))
    else
      table.insert(newblocks, block)
    end
  end
  return pandoc.Pandoc(newblocks, doc.meta)
end
`);
  }

  if (!hasFunctions) return null;

  const filter = sections.join('\n');
  console.log(`[Lua Filter] Generated filter with ${sections.length - 1} remapping(s)`);
  return filter;
}
