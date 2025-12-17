# Plan: Template-Aware Markdown Generation

**Created**: 2025-12-17
**Status**: Ready for Implementation

## Problem Statement

Currently, DOCX template analysis only happens at export time (in ExportModal), but by then the specification has already been generated with default formatting. This leads to misalignment between generated markdown heading levels and the target DOCX template styles.

## Goal

Enable template formatting guidance BEFORE specification generation so that:
1. Generated markdown aligns with the target DOCX export format
2. Users can upload a reference template early in the workflow
3. A sensible default exists when no template is provided
4. Document metadata (title, subtitle, etc.) is captured for front matter generation

## Key Architecture Insight: Front Matter vs Content

**Important**: Front matter (title page, TOC, LOF, LOT) is NOT part of the markdown content.

| Element | Where It Lives | When Generated |
|---------|---------------|----------------|
| Title page (title, subtitle, version, author) | `project.specification.metadata` | At export time |
| Table of Contents | Auto-generated from headings | At export time |
| List of Figures | Auto-generated from diagrams | At export time |
| List of Tables | Not yet implemented | - |
| **Main Content** | `project.specification.markdown` | During AI generation |

The markdown content starts directly with `# 1 Scope` (or first section). The export system combines metadata + TOC/LOF + content into the final DOCX.

## Implementation Plan

### Phase 1: Add Default Markdown Guidance

**File:** `src/services/templateAnalyzer.ts`

Add a function to generate default `MarkdownGenerationGuidance`:

```typescript
export function getDefaultMarkdownGuidance(): MarkdownGenerationGuidance {
  return {
    headingLevels: {
      maxDepth: 6,
      numberingStyle: 'decimal', // 1, 1.1, 1.1.1
    },
    figureFormat: {
      captionPlacement: 'below',
      numberingPattern: 'Figure {chapter}.{number}',
      syntax: '{{fig:id}}',
    },
    tableFormat: {
      captionPlacement: 'above',
      numberingPattern: 'Table {chapter}.{number}',
      useMarkdownTables: true,
    },
    listFormat: {
      bulletChar: '-',
      orderedStyle: '1.',
    },
    codeBlockStyle: {
      fenced: true,
      languageHints: true,
    },
    emphasis: {
      bold: '**',
      italic: '*',
    },
    sectionBreaks: {
      usePageBreaks: false,
      pattern: '---',
    },
  };
}
```

### Phase 2: Add "Generation Settings" Step to Structure Discovery

**File:** `src/components/ai/StructureDiscoveryModal.tsx`

Add a new step between structure approval and content generation. This step captures:

#### A. Document Metadata (for Front Matter)

Fields to capture (stored in `project.specification.metadata`):
- **Title** (required) - Document title for title page
- **Subtitle** (optional) - Secondary title
- **Version** (optional) - Document version
- **Author** (optional) - Author name(s)
- **Abstract** (optional) - Brief summary for Pandoc export

These are NOT included in markdown - they're used at export time to generate:
- Title page
- YAML front matter (for Pandoc)
- Document properties

#### B. Formatting Settings

Options for content formatting:
- **Use default formatting** (recommended, pre-selected)
- **Match DOCX template** - Upload reference template for analysis

**UI Mockup:**
```
┌─────────────────────────────────────────────────────────┐
│ Generation Settings                                      │
├─────────────────────────────────────────────────────────┤
│ DOCUMENT METADATA (for title page)                       │
│                                                          │
│ Title:    [Public Wi-Fi Technical Specification_______]  │
│ Subtitle: [Carrier Wi-Fi / Hotspot Service_____________] │
│ Version:  [1.0___] Author: [Engineering Team___________] │
│                                                          │
│ ─────────────────────────────────────────────────────── │
│ CONTENT FORMATTING                                       │
│                                                          │
│ ○ Use default formatting (recommended)                   │
│   # for H1, ## for H2, ### for H3, decimal numbering     │
│                                                          │
│ ○ Match DOCX reference template                          │
│   [Choose File...] SPD_Template.docx                     │
│   ✓ Analyzed: 6 heading levels, Heading 1-6 styles       │
│                                                          │
│ EXPORT PREVIEW                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Title Page          │ Content Sections              │ │
│ │ ─────────────────── │ ───────────────────────────── │ │
│ │ [Title]             │ # 1 Scope         → Heading 1 │ │
│ │ [Subtitle]          │ ## 1.1 Overview   → Heading 2 │ │
│ │ [Version] [Date]    │ ### 1.1.1 Detail  → Heading 3 │ │
│ │ ─────────────────── │                               │ │
│ │ Table of Contents   │                               │ │
│ │ List of Figures     │                               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│                    [Back] [Continue to Generation]       │
└─────────────────────────────────────────────────────────┘
```

### Phase 3: Wire Template Guidance into Generation Flow

**Files to modify:**

1. **`src/store/projectStore.ts`**
   - Ensure `markdownGuidance` is set from default OR analyzed template
   - Add action: `initializeDefaultMarkdownGuidance()`

2. **`src/components/ai/StructureDiscoveryModal.tsx`**
   - On "Continue", set `markdownGuidance` in store (default or from template)
   - Pass guidance through to generation step

3. **`src/components/ai/GenerateSpecModal.tsx`**
   - Already retrieves `markdownGuidance` from store (line 44)
   - Already passes to generation (line 264)
   - No changes needed if store is properly initialized

### Phase 4: Ensure Prompts Use Guidance

**File:** `src/services/ai/prompts/sectionPrompts.ts`

The `buildFormattingInstructions()` function already handles `markdownGuidance`, but currently returns generic instructions when guidance is null. Update to:

1. Always have guidance (from default or template)
2. Make instructions more explicit about heading levels matching DOCX styles

```typescript
function buildFormattingInstructions(guidance: MarkdownGenerationGuidance): string {
  return `
## Output Format (DOCX-Aligned)

**Heading Levels** (will map to Word heading styles):
- # (H1) for main sections (1, 2, 3...) → Heading 1 in Word
- ## (H2) for subsections (1.1, 2.1...) → Heading 2 in Word
- ### (H3) for sub-subsections (1.1.1...) → Heading 3 in Word
- Maximum depth: ${guidance.headingLevels.maxDepth} levels

**Numbering**: ${guidance.headingLevels.numberingStyle} style (1, 1.1, 1.1.1)

**Figures**: ${guidance.figureFormat.numberingPattern}
- Caption placement: ${guidance.figureFormat.captionPlacement}

**Tables**: ${guidance.tableFormat.numberingPattern}
- Caption placement: ${guidance.tableFormat.captionPlacement}
`;
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `subtitle` and `abstract` to `DocumentMetadata` type |
| `src/services/templateAnalyzer.ts` | Add `getDefaultMarkdownGuidance()` |
| `src/components/ai/StructureDiscoveryModal.tsx` | Add "Generation Settings" step with metadata + template upload |
| `src/store/projectStore.ts` | Add `initializeDefaultMarkdownGuidance()` and `updateSpecificationMetadata()` actions |
| `src/services/ai/prompts/sectionPrompts.ts` | Enhance `buildFormattingInstructions()` |

### Type Updates Required

**File:** `src/types/index.ts`

The `DocumentMetadata` interface needs these fields (referenced in export code but not defined):

```typescript
interface DocumentMetadata {
  author?: string;
  date?: string;
  version?: string;
  customer?: string;
  subtitle?: string;      // ADD - for title page
  abstract?: string;      // ADD - for Pandoc YAML front matter
  approvers?: ApproverRecord[];
  revisions?: RevisionRecord[];
}
```

## Flow After Implementation

```
1. User opens Structure Discovery Modal
   - Uploads BRS, adds reference docs, enters guidance
                    ↓
2. "Plan Structure" - AI proposes sections
                    ↓
3. User reviews/refines proposed structure
                    ↓
4. NEW: "Generation Settings" step
   ┌────────────────────────────────────────┐
   │ Document Metadata:                     │
   │   - Title, Subtitle (for title page)   │
   │   - Version, Author                    │
   │   - Abstract (for Pandoc)              │
   │                                        │
   │ Content Formatting:                    │
   │   - Default OR upload DOCX template    │
   └────────────────────────────────────────┘
                    ↓
5. Store updated:
   - specification.metadata (title, subtitle, etc.)
   - markdownGuidance (default or from template)
                    ↓
6. Section Generation uses guidance
   - Correct heading levels (# for H1, ## for H2)
   - NO title/metadata in markdown content
                    ↓
7. Generated markdown: "# 1 Scope\n## 1.1 Overview..."
                    ↓
8. Export combines:
   ┌────────────────────────────────────────┐
   │ TITLE PAGE (from metadata)             │
   │   Title, Subtitle, Version, Author     │
   ├────────────────────────────────────────┤
   │ TABLE OF CONTENTS (auto-generated)     │
   ├────────────────────────────────────────┤
   │ LIST OF FIGURES (from diagrams)        │
   ├────────────────────────────────────────┤
   │ MAIN CONTENT (from markdown)           │
   │   # 1 Scope → Heading 1                │
   │   ## 1.1 Overview → Heading 2          │
   ├────────────────────────────────────────┤
   │ BIBLIOGRAPHY (from references)         │
   └────────────────────────────────────────┘
```

## Testing Checklist

### Content Formatting
- [ ] Default guidance produces correct heading levels (# for H1, ## for H2, etc.)
- [ ] Uploaded template is analyzed and guidance extracted
- [ ] Generation uses the guidance from store
- [ ] Skipping the settings step uses default guidance
- [ ] Markdown does NOT contain title, subtitle, or metadata

### Document Metadata
- [ ] Title and subtitle are captured in Generation Settings step
- [ ] Metadata is stored in `project.specification.metadata`
- [ ] Metadata persists after modal closes

### DOCX Export
- [ ] Title page shows Title, Subtitle, Version, Author from metadata
- [ ] TOC is auto-generated from markdown headings
- [ ] List of Figures is auto-generated from diagrams
- [ ] Main content has correct heading style mapping (# → Heading 1)
- [ ] Pandoc export includes YAML front matter with subtitle/abstract

## Future Enhancements (Out of Scope)

These were discussed but are NOT part of this plan:

1. **Custom Style Support** - Mapping markdown patterns to custom Word styles (Note, Warning, etc.)
2. **List of Tables** - Auto-generating LOT from markdown tables
3. **Style Preview** - Live preview of how markdown will render with template styles
