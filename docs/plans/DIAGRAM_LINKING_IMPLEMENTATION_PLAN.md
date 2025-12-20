# Diagram Linking Implementation Plan

## Problem Statement

The markdown preview fails to correctly link `{{fig:...}}` references to their corresponding diagrams.

### Current Behavior

AI generates markdown with figure references like:
```markdown
{{fig:logical-architecture-cp-up}}
<!-- TODO: [BLOCK DIAGRAM] Show UE, AP/AC, BRAS/WAG, Metro VLAN/QinQ... -->
*Figure 5-1: Logical carrier Wi-Fi offload architecture with control-plane/user-plane demarcation and external interfaces*
```

Diagrams are generated separately with:
- **ID**: UUID like `1735123456789-abc123def`
- **Title**: "Logical carrier Wi-Fi offload architecture..."
- **Figure Number**: `5-1`

**The disconnect**: The slug `logical-architecture-cp-up` doesn't match the diagram's UUID, title slug, or figure number - so the preview shows "Diagram not found" or the wrong diagram.

### Relevant Files

| File | Purpose |
|------|---------|
| `src/components/InlineDiagramPreview.tsx` | Renders diagrams inline, contains `findDiagramByIdOrSlug()` |
| `src/utils/remarkLinkResolver.ts` | Remark plugin that transforms `{{fig:...}}` to links |
| `src/components/editors/MarkdownEditor.tsx` | Uses ReactMarkdown with the remark plugin |
| `src/services/ai/prompts/documentPrompts.ts` | AI prompts for generating specifications |
| `src/services/ai/prompts/diagramPrompts.ts` | AI prompts for generating diagrams |
| `src/store/projectStore.ts` | Zustand store with diagram data |
| `src/types/index.ts` | TypeScript types for diagrams |

---

## Option B: Caption-Based Fallback (Short-Term Fix) ✅ IMPLEMENTED

**Goal**: Parse the figure caption that follows `{{fig:...}}` to extract the figure number when the slug doesn't match.

### How It Works

When processing markdown:
```markdown
{{fig:logical-architecture-cp-up}}           ← slug doesn't match any diagram
<!-- TODO: [BLOCK DIAGRAM] Show UE... -->    ← skip
*Figure 5-1: Logical carrier Wi-Fi...*       ← extract "5-1", use it to find diagram
```

### Implementation Location

**File**: `src/utils/remarkLinkResolver.ts`

The remark plugin already transforms `{{fig:...}}` references. Add a fallback:

1. After all matching strategies fail
2. Look ahead in the AST for a text node matching `*Figure X-Y:` or `Figure X-Y:`
3. Extract the figure number (e.g., `5-1`)
4. Use that number to find the diagram

### Pseudocode

```typescript
// In remarkLinkResolver.ts, after existing matching strategies fail:

if (!figure) {
  // Strategy 6: Look for caption pattern after this reference
  // Find next sibling/child nodes that contain "Figure X-Y:" pattern
  const captionPattern = /\*?Figure\s+(\d+(?:-\d+)?):?/i;

  // Look ahead in the markdown for caption
  // The caption is typically within the next few lines
  const remainingText = value.slice(lastIndex);
  const captionMatch = remainingText.match(captionPattern);

  if (captionMatch) {
    const figureNumber = captionMatch[1];
    figure = figures.find(f => f.number === figureNumber);
  }
}
```

### Alternative: Pre-process markdown

Instead of modifying the remark plugin, pre-process the markdown before rendering:

**File**: `src/components/editors/MarkdownEditor.tsx`

```typescript
function preprocessFigureReferences(markdown: string): string {
  // Pattern: {{fig:slug}} followed eventually by *Figure X-Y:
  const figRefPattern = /\{\{fig:([a-zA-Z0-9-_]+)\}\}([\s\S]*?)\*Figure\s+(\d+(?:-\d+)?):/gi;

  return markdown.replace(figRefPattern, (match, slug, between, figureNumber) => {
    // Replace the slug with the figure number for reliable matching
    return `{{fig:${figureNumber}}}${between}*Figure ${figureNumber}:`;
  });
}

// Use in ReactMarkdown:
<ReactMarkdown>
  {preprocessFigureReferences(markdown)}
</ReactMarkdown>
```

### Testing

1. Keep existing `{{fig:logical-architecture-cp-up}}` reference
2. Ensure caption `*Figure 5-1: ...` exists below
3. Diagram with figure number `5-1` should render

---

## Option A: Better Reference Format (Long-Term) ✅ IMPLEMENTED

**Goal**: AI generates references with figure number prefix for reliable matching.

### New Format

```markdown
{{fig:5-1-logical-architecture-cp-up}}
```

- `5-1` = figure number (primary identifier)
- `logical-architecture-cp-up` = human-readable description

### Implementation

#### 1. Update Matching Logic

**File**: `src/components/InlineDiagramPreview.tsx` and `src/utils/remarkLinkResolver.ts`

```typescript
// Strategy: Extract figure number from beginning of slug
const figNumPrefixMatch = searchSlug.match(/^(\d+(?:-\d+)?)-/);
if (figNumPrefixMatch) {
  const figureNumber = figNumPrefixMatch[1];
  const found = allDiagrams.find(d => d.figureNumber === figureNumber);
  if (found) {
    diagram = getDiagramById(found.id);
    if (diagram) return diagram;
  }
}
```

#### 2. Update AI Prompts for Spec Generation

**File**: `src/services/ai/prompts/documentPrompts.ts` (and related prompt files)

Add instruction to the system prompt:

```
When referencing figures, use the format {{fig:X-Y-description}} where:
- X-Y is the figure number (e.g., 5-1 for the first figure in section 5)
- description is a short kebab-case description

Example: {{fig:5-1-logical-architecture-overview}}

The figure number MUST match the caption that follows:
*Figure 5-1: Logical Architecture Overview*
```

#### 3. Update Section/Document Generation

Ensure AI consistently uses figure numbers in references. Search for existing prompt templates that mention `{{fig:` and update them.

### Files to Update

- `src/services/ai/prompts/documentPrompts.ts`
- `src/services/ai/prompts/sectionPrompts.ts`
- `src/services/ai/prompts/templatePrompts.ts`
- Any other files in `src/services/ai/prompts/` that generate markdown with figure references

---

## Option C/D: Store Slug in Diagram (Long-Term) ✅ IMPLEMENTED

**Goal**: When diagrams are generated, explicitly link them to `{{fig:...}}` references.

### Approach C: Add `slug` Field to Diagram

#### 1. Update Types

**File**: `src/types/index.ts`

```typescript
export interface BlockDiagram {
  id: string;
  title: string;
  figureNumber?: string;
  slug?: string;  // NEW: matches {{fig:slug}} reference
  // ... other fields
}

export interface MermaidDiagram {
  id: string;
  title: string;
  type: 'sequence' | 'flow' | 'state' | 'class';
  figureNumber?: string;
  slug?: string;  // NEW: matches {{fig:slug}} reference
  // ... other fields
}
```

#### 2. Update Diagram Generation

**File**: `src/services/ai/AIService.ts` (or wherever diagrams are created)

When AI generates a diagram, it should output which `{{fig:...}}` it corresponds to:

```typescript
// AI response should include:
{
  title: "Logical carrier Wi-Fi offload architecture...",
  slug: "logical-architecture-cp-up",  // matches {{fig:logical-architecture-cp-up}}
  type: "block",
  // ... diagram data
}
```

#### 3. Update AI Prompts for Diagram Generation

**File**: `src/services/ai/prompts/diagramPrompts.ts`

```
When generating diagrams, include a "slug" field that matches the {{fig:...}} reference in the specification.

For example, if the specification contains:
{{fig:logical-architecture-cp-up}}

Your diagram output should include:
{
  "slug": "logical-architecture-cp-up",
  "title": "Logical carrier Wi-Fi offload architecture...",
  ...
}
```

#### 4. Update Matching Logic

**File**: `src/components/InlineDiagramPreview.tsx`

```typescript
// Strategy: Match by slug field
const found = allDiagrams.find(d => d.slug === searchSlug);
if (found) {
  diagram = getDiagramById(found.id);
  if (diagram) return diagram;
}
```

### Approach D: Use Slug as Part of Diagram ID

Instead of a separate `slug` field, use the slug as part of the diagram ID:

```typescript
// When creating diagram:
const diagramId = `${slug}-${Date.now()}`;
// e.g., "logical-architecture-cp-up-1735123456789"
```

Then matching can check if the ID starts with the slug:

```typescript
const found = allDiagrams.find(d => d.id.startsWith(searchSlug));
```

**Pros**: No schema change needed
**Cons**: Less explicit, IDs become longer

---

## Implementation Priority

| Phase | Option | Effort | Impact | Status |
|-------|--------|--------|--------|--------|
| 1 | **B** - Caption fallback | Low | Fixes existing specs without regeneration | ✅ Done |
| 2 | **A** - Better reference format | Medium | Prevents future issues | ✅ Done |
| 3 | **C** - Store slug in diagram | Medium | Creates explicit bidirectional link | ✅ Done |

### Recommended Order

1. ~~**Implement B first** - Quick win, no spec regeneration needed~~ ✅ Done
2. ~~**Implement A** - Update prompts so new specs work better~~ ✅ Done
3. ~~**Implement C** - Full solution with explicit diagram-to-reference linking~~ ✅ Done

---

## Testing Checklist

### Option B Testing
- [ ] Existing `{{fig:slug}}` with caption `*Figure X-Y:` below renders correctly
- [ ] Caption can be 1-3 lines below the reference
- [ ] Works with both `*Figure X-Y:*` (italic) and `Figure X-Y:` (plain)
- [ ] Doesn't break existing working references

### Option A Testing
- [ ] `{{fig:5-1-description}}` matches diagram with figureNumber `5-1`
- [ ] AI generates new specs with correct format
- [ ] Old format `{{fig:description}}` still works (backward compatible)

### Option C Testing
- [ ] Generated diagrams have `slug` field populated
- [ ] `slug` matches the `{{fig:...}}` reference in the spec
- [ ] Matching by slug works in InlineDiagramPreview

---

## Current Matching Strategies (Reference)

Located in `src/components/InlineDiagramPreview.tsx` function `findDiagramByIdOrSlug()`:

1. Direct ID match (exact UUID)
2. Figure number match (`5-1` or `fig-5-1`)
2b. **Figure number prefix match** (`5-1-description`) ✅ NEW (Option A)
2c. **Slug field match** (explicit slug stored on diagram) ✅ NEW (Option C)
3. Exact slug match on title
4. Exact ID match (case-insensitive)
5. Keyword matching (all words appear in title) - only if ONE match
6. Title contains search slug - only if ONE match

Located in `src/utils/remarkLinkResolver.ts` (same strategies plus):

7. **Caption-based fallback** - Look ahead in AST for `*Figure X-Y:` pattern and use figure number to match ✅ (Option B)

---

## Related Documentation

- [CLAUDE.md](../../CLAUDE.md) - Project overview and patterns
- [src/utils/linkResolver.ts](../../src/utils/linkResolver.ts) - Base link resolution utilities
- [src/utils/figureNumbering.ts](../../src/utils/figureNumbering.ts) - Figure number calculation
