# Sequential Workflow Implementation: BRS → Spec → Diagrams

**Date:** 2025-11-10
**Status:** ✅ Complete
**Type:** Architectural Change

## Overview

Changed the diagram generation workflow from **parallel** (BRS → Spec + BRS → Diagrams) to **sequential** (BRS → Spec → Diagrams) to align with professional technical specification authoring practices.

---

## Motivation

### Professional Technical Specification Workflow

In real-world technical specification authoring (especially telecom/3GPP):

1. **BRS (Business Requirements)** - High-level business needs and use cases
2. **Technical Specification** - Detailed technical design with:
   - Architecture descriptions (component relationships, interfaces, protocols)
   - Procedure descriptions (call flows, state machines, message sequences)
   - Normative language (SHALL/MUST requirements)
   - 3GPP standards alignment
3. **Diagrams** - Visual representations that **illustrate** the specification text

### Why Sequential is Better

**The Technical Specification is the authoritative source:**
- BRS says: "The system should support user authentication"
- Tech Spec elaborates: "The UE SHALL authenticate with the MME using the EPS-AKA procedure over the S1-MME interface, following 3GPP TS 33.401 section 6.1"
- Diagram shows: UE ↔ MME (S1-MME) with EPS-AKA message flow

**Consistency Guarantee:**
- Component names in diagrams match spec text exactly
- Interface names (S1-MME, Gx, Rx) come from spec, not raw BRS
- Procedures in sequence diagrams reflect refined spec language
- Terminology is consistent (e.g., "converged service edge" vs raw BRS terms)

**Change Propagation:**
- Edit Architecture section → Regenerate block diagrams from updated text
- Edit Procedures section → Regenerate sequence diagrams
- Natural workflow: refine spec text, then update diagrams

---

## Implementation

### 1. Created Markdown Section Extraction Utility

**File:** [src/utils/markdownSectionExtractor.ts](src/utils/markdownSectionExtractor.ts) (150 lines)

**Features:**
- Extract all sections from numbered markdown (e.g., "4. Architecture", "6.1 Registration Procedure")
- Find Architecture section (tries "4", "3", "5" or title match)
- Find Procedures subsections (e.g., "6.1", "6.2", "6.3")
- Parse heading hierarchy and section numbers
- Return section content with metadata (line numbers, title, level)

**Key Functions:**
```typescript
export function extractArchitectureSection(markdown: string): MarkdownSection | null
export function extractProcedureSubsections(markdown: string): MarkdownSection[]
export function extractAllSections(markdown: string): MarkdownSection[]
export function extractSectionByNumber(markdown: string, sectionNumber: string): MarkdownSection | null
export function extractSectionByTitle(markdown: string, titleSearch: string): MarkdownSection | null
```

### 2. Created New AIService Method

**File:** [src/services/ai/AIService.ts](src/services/ai/AIService.ts#L555-L685)

**New Method:** `generateDiagramsFromSpec(specificationMarkdown: string, onProgress?: ...)`

**Workflow:**
1. Extract Architecture section from specification markdown
2. Extract Procedure subsections (6.1, 6.2, etc.) from specification
3. Generate block diagram from Architecture section content
4. Generate sequence diagram for each Procedure subsection
5. Return all diagrams with errors/warnings

**Example Console Output:**
```
📄 Specification analysis:
  Architecture section: Found (2847 chars)
  Procedure subsections: 3

📐 Generating block diagram from Architecture section 4...
✅ Block diagram generated: Architecture

📊 Generating 3 sequence diagrams from Procedures sections...
🔄 Processing procedure 1/3: 6.1. Registration Procedure
✅ Sequence diagram result: { hasDiagram: true, errors: [], warnings: [] }
```

**Deprecated:** `generateDiagramsFromBRS()` - Kept for backward compatibility with deprecation notice

### 3. Updated GenerateDiagramsModal Component

**File:** [src/components/ai/GenerateDiagramsModal.tsx](src/components/ai/GenerateDiagramsModal.tsx) (325 lines)

**Changes:**
- Removed BRS analysis logic (no longer needed)
- Changed source from `getBRSDocument()` to `project.specification`
- Updated validation to check specification has content
- Updated UI labels: "Generate Diagrams from Technical Specification"
- Added "How it works" explanation panel
- Calls `aiService.generateDiagramsFromSpec()` instead of `generateDiagramsFromBRS()`

**New UI Text:**
- Header: "Generate Diagrams from Technical Specification"
- Subtitle: "AI-powered diagram generation from Architecture and Procedures sections"
- Explanation: "Extracts Architecture section (typically Section 4) → generates Block Diagram"

### 4. Updated Workspace Component

**File:** [src/components/Workspace.tsx](src/components/Workspace.tsx#L105-L119)

**Changes:**
- "Generate Diagrams" button now appears only when specification exists and has content
- Condition changed from `brsDocument` to `project?.specification && project.specification.markdown.trim().length > 0`
- Tooltip updated: "Generate diagrams from Technical Specification" (was "from BRS")

**User Experience:**
1. Upload BRS → "Generate Spec" button appears
2. Generate Tech Spec → "Generate Diagrams" button appears
3. Generate Diagrams → Diagrams match spec text

---

## Workflow Comparison

### Before (Parallel):
```
BRS Document (uploaded)
    ↓
[PARALLEL PATHS]
    ├─→ BRS Analysis → Technical Specification (8 sections)
    └─→ BRS Analysis → Diagrams (blocks + sequences)
```

**Issues:**
- Diagrams generated from raw BRS analysis (structured JSON)
- Spec text and diagrams might use different terminology
- Spec refinements not reflected in diagrams
- User edits to spec don't update diagrams

### After (Sequential):
```
BRS Document (uploaded)
    ↓
Generate Technical Specification (8 sections with Architecture & Procedures)
    ↓
User Reviews/Edits Specification (refine terminology, add details)
    ↓
Extract Architecture Section → Generate Block Diagrams
Extract Procedure Subsections → Generate Sequence Diagrams
    ↓
Diagrams match specification text exactly
```

**Benefits:**
- Diagrams illustrate specification text (authoritative source)
- Consistent terminology and component names
- Professional workflow (spec first, diagrams second)
- Change propagation: Edit spec → regenerate diagrams

---

## Example Usage

### Step 1: Upload BRS Document
```
User uploads sample-brs.md (318 lines)
```

### Step 2: Generate Technical Specification
```
Click "Generate Spec" →
AI generates 8-section technical specification:
  1. Scope
  2. References
  3. Definitions and Abbreviations
  4. Architecture ← IMPORTANT FOR DIAGRAMS
  5. Capabilities
  6. Procedures ← IMPORTANT FOR DIAGRAMS
    6.1. Registration Procedure
    6.2. Service Request Procedure
    6.3. Handover Procedure
  7. Information Elements
  8. Error Handling
```

### Step 3: Review/Edit Specification
```
User reviews Section 4 (Architecture):
- Refines component names
- Adds interface details (S1-MME, Gx, Rx)
- Specifies 3GPP standards references

User reviews Section 6 (Procedures):
- Refines procedure steps
- Adds normative language (SHALL, MUST)
- Clarifies message sequences
```

### Step 4: Generate Diagrams from Specification
```
Click "Generate Diagrams" →
AI extracts Architecture section → Generates block diagram with:
  - Components: UE, MME, HSS, PCRF, PDN-GW (from spec text)
  - Interfaces: S1-MME, S6a, Gx, SGi (from spec text)
  - Terminology matches spec exactly

AI extracts Procedure subsections → Generates 3 sequence diagrams:
  6.1. Registration Procedure → Sequence diagram with message flow
  6.2. Service Request Procedure → Sequence diagram
  6.3. Handover Procedure → Sequence diagram
```

### Result:
- All diagrams match the refined specification text
- Component names consistent (not raw BRS terms)
- Interface names correct (3GPP standard naming)
- Procedures reflect normative language

---

## Files Modified

1. **src/utils/markdownSectionExtractor.ts** - NEW (150 lines)
   - Section extraction utilities
   - Architecture and Procedures parsers

2. **src/services/ai/AIService.ts** - MODIFIED
   - Added `generateDiagramsFromSpec()` (lines 555-685)
   - Deprecated `generateDiagramsFromBRS()` (kept for compatibility)

3. **src/components/ai/GenerateDiagramsModal.tsx** - REWRITTEN (325 lines)
   - Removed BRS analysis logic
   - Changed source to specification
   - Updated UI and labels

4. **src/components/Workspace.tsx** - MODIFIED (lines 105-119)
   - Button condition changed to require specification
   - Tooltip updated

---

## Testing Checklist

- [ ] Upload BRS document → "Generate Spec" button appears
- [ ] Generate specification → "Generate Diagrams" button appears
- [ ] Generate diagrams → Block diagram created from Architecture section
- [ ] Generate diagrams → Sequence diagrams created from Procedure subsections
- [ ] Verify diagram component names match spec text
- [ ] Edit Architecture section → Regenerate diagrams → Updated diagrams reflect changes
- [ ] Empty specification → "Generate Diagrams" button hidden
- [ ] Approval workflow → Diagrams sent to Review Panel when checkbox checked

---

## Migration Notes

### Backward Compatibility

The old `generateDiagramsFromBRS()` method is **deprecated but not removed**:
- Marked with `@deprecated` JSDoc tag
- Console warning suggests using `generateDiagramsFromSpec()` instead
- Still functional for existing code that might call it
- Will be removed in a future version

### User Migration

Users with existing projects:
1. **No action required** if they don't regenerate diagrams
2. **To use new workflow:** Regenerate specification, then generate diagrams
3. **Result:** Diagrams will match refined specification text instead of raw BRS

### Data Migration

No data migration needed:
- Existing diagrams stored in Zustand persist unchanged
- New diagrams generated with new method
- Users can mix old and new diagrams (though not recommended)

---

## Future Enhancements

1. **Smart Regeneration:**
   - Detect when Architecture section changes significantly
   - Prompt: "Architecture section updated. Regenerate block diagram?"

2. **Section-Specific Regeneration:**
   - "Regenerate diagrams for Section 6.2 only"
   - Selective updates instead of full regeneration

3. **Diff View for Diagram Changes:**
   - Show before/after when regenerating diagrams
   - Highlight what changed in the diagram

4. **Auto-link Insertion:**
   - When generating diagrams, auto-insert `{{fig:...}}` references in spec text
   - "The architecture is shown in {{fig:architecture-diagram}}"

---

## Summary

**Before:** Parallel generation (BRS → Spec + BRS → Diagrams)
**After:** Sequential generation (BRS → Spec → Diagrams)

**Key Benefit:** Diagrams now illustrate the refined specification text, not raw BRS, ensuring consistency and professional quality.

**Impact:** Users see "Generate Diagrams" button only after generating a specification, and diagrams match the spec text exactly.

**Files Changed:** 4 files (1 new utility, 1 new method, 2 component updates)
**Lines of Code:** ~325 new, ~450 rewritten
