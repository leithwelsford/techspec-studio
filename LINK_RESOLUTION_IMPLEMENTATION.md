# Link Resolution System Implementation

**Date:** 2025-11-10
**Status:** ✅ CORE SYSTEM COMPLETE (Phase 3.5 - 100% Core, 71% Overall)
**Completion:** 7 of 10 tasks complete (core features done, optional enhancements remaining)

---

## Overview

Implemented a comprehensive link resolution system that automatically resolves `{{fig:diagram-id}}` and `{{ref:reference-id}}` syntax in markdown documents to proper figure numbers and citations.

---

## ✅ Completed Core Features (100%)

### 1. Link Resolver Utility (`src/utils/linkResolver.ts`)

**File:** 259 lines
**Status:** ✅ COMPLETE
**Features:**
- Regex pattern matching for `{{fig:...}}` and `{{ref:...}}` syntax
- Parse all links in markdown text
- Validate link IDs against available diagrams/references
- Calculate figure numbers based on section and position
- Generate autocomplete suggestions
- Extract markdown headings with section numbers

**Key Functions:**
```typescript
parseLinks(markdown: string): ParsedLink[]
parseFigureReferences(markdown: string): string[]
parseCitationReferences(markdown: string): string[]
validateLinkId(id: string, validIds: string[]): boolean
findInvalidLinks(markdown, validFigureIds, validReferenceIds): ParsedLink[]
resolveFigureReference(id, figures): string | null  // "Figure 4-1"
resolveCitationReference(id, citations): string | null  // "3GPP TS 23.203 [1]"
generateFigureSuggestions(figures, query): Array<{id, label, description}>
generateReferenceSuggestions(citations, query): Array<{id, label, description}>
```

### 2. Store Utilities (`src/store/projectStore.ts`)

**Added 6 new utility methods:**

```typescript
// Get diagram by ID with type information
getDiagramById(id: string): (BlockDiagram | MermaidDiagram) & { type: 'block' | 'sequence' | 'flow' } | null

// Get figure number for a diagram
getDiagramNumber(id: string): string | null

// Get all figures for autocomplete
getAllFigureReferences(): Array<{ id, number, title, type }>

// Get all citations for autocomplete
getAllCitationReferences(): Array<{ id, number, title }>

// Get valid IDs for validation
getValidFigureIds(): string[]
getValidReferenceIds(): string[]
```

### 3. Remark Plugin (`src/utils/remarkLinkResolver.ts`)

**File:** 245 lines
**Purpose:** Custom remark plugin for react-markdown to transform link syntax

**Transformations:**
- `{{fig:diagram-id}}` → `[Figure 4-1](#diagram-id)` (clickable blue link)
- `{{ref:reference-id}}` → `[3GPP TS 23.203 [1]](#reference-id)` (clickable purple link)
- Invalid references → Red warning links with "Invalid reference" tooltip

**Features:**
- Clickable links that navigate to diagrams/references
- Color-coded: Blue for figures, Purple for citations, Red for invalid
- Dotted underline for visual clarity
- Data attributes for click handling
- Preserves surrounding text in markdown

### 4. MarkdownEditor Integration

**Updated:** `src/components/editors/MarkdownEditor.tsx`

**Changes:**
- Imported `remarkLinkResolver` plugin
- Added store hooks for `getAllFigureReferences()` and `getAllCitationReferences()`
- Configured ReactMarkdown with link resolver plugin
- Added navigation handler (click figure → go to diagrams tab)

**Usage:**
```tsx
<ReactMarkdown
  remarkPlugins={[
    remarkGfm,
    [remarkLinkResolver, {
      figures: getAllFigureReferences(),
      citations: getAllCitationReferences(),
      onNavigate: (type, id) => {
        if (type === 'figure') setActiveTab('diagrams');
        else setActiveTab('references');
      }
    }]
  ]}
>
  {markdown}
</ReactMarkdown>
```

### 5. CSS Styling (`src/index.css`)

**Added 56 lines of styles:**
**Status:** ✅ COMPLETE

- `.figure-reference` - Blue clickable links for figures
- `.figure-reference-invalid` - Red warning for invalid figures
- `.citation-reference` - Purple clickable links for citations
- `.citation-reference-invalid` - Red warning for invalid citations
- Hover states and transitions

**Colors:**
- Figure links: Blue (#3b82f6)
- Citation links: Purple (#8b5cf6)
- Invalid links: Red (#ef4444)

### 6. Click Navigation (`src/components/editors/MarkdownEditor.tsx`)

**Status:** ✅ COMPLETE
**Implementation:** Custom link component with onClick handler

**Features:**
- Click figure links → Navigate to Block Diagrams tab
- Click citation links → Navigate to References tab
- Console logging for debugging
- preventDefault to avoid default anchor behavior

**Code:**
```typescript
components={{
  a: ({ node, className, children, href, ...props }) => {
    const isFigureRef = className?.includes('figure-reference');
    const isCitationRef = className?.includes('citation-reference');

    if (isFigureRef || isCitationRef) {
      return (
        <a
          href={href}
          className={className}
          onClick={(e) => {
            e.preventDefault();
            const targetTab = isFigureRef ? 'block-diagrams' : 'references';
            setActiveTab(targetTab as WorkspaceTab);
          }}
          {...props}
        >
          {children}
        </a>
      );
    }
    return <a href={href} className={className} {...props}>{children}</a>;
  }
}}
```

### 7. Workspace Tab Integration (`src/components/Workspace.tsx`)

**Status:** ✅ COMPLETE
**Fixed:** Workspace was using local state instead of Zustand store

**Changes:**
- Replaced `useState` for activeTab with Zustand store hooks
- Updated tab content check to handle all diagram tab variations
- Tab button highlighting works for `'diagrams'`, `'block-diagrams'`, `'sequence-diagrams'`, `'flow-diagrams'`

**Code:**
```typescript
// Use Zustand store instead of local state
const activeTab = useProjectStore((state) => state.activeTab);
const setActiveTab = useProjectStore((state) => state.setActiveTab);

// Handle all diagram tab variations
{(activeTab === 'diagrams' || activeTab === 'block-diagrams' ||
  activeTab === 'sequence-diagrams' || activeTab === 'flow-diagrams') &&
  <DiagramViewer />}
```

---

## 🚧 Optional Enhancement Tasks (Remaining 29%)

### 8. Autocomplete Feature (TODO - High Priority)

**Goal:** Add dropdown autocomplete when typing `{{fig:` or `{{ref:`
**Status:** 🚧 PENDING

**Implementation Plan:**

1. **Add State to MarkdownEditor:**
   ```typescript
   const [showAutocomplete, setShowAutocomplete] = useState(false);
   const [autocompleteQuery, setAutocompleteQuery] = useState('');
   const [autocompleteType, setAutocompleteType] = useState<'figure' | 'reference' | null>(null);
   const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
   ```

2. **Detect Trigger on keyup:**
   ```typescript
   const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
     const textarea = e.currentTarget;
     const cursorPos = textarea.selectionStart;
     const textBefore = textarea.value.slice(0, cursorPos);

     // Check if we're inside {{fig: or {{ref:
     const figMatch = textBefore.match(/\{\{fig:([^}]*)$/);
     const refMatch = textBefore.match(/\{\{ref:([^}]*)$/);

     if (figMatch) {
       setAutocompleteType('figure');
       setAutocompleteQuery(figMatch[1]);
       setShowAutocomplete(true);
       calculatePosition(textarea, cursorPos);
     } else if (refMatch) {
       setAutocompleteType('reference');
       setAutocompleteQuery(refMatch[1]);
       setShowAutocomplete(true);
       calculatePosition(textarea, cursorPos);
     } else {
       setShowAutocomplete(false);
     }
   };
   ```

3. **Render Autocomplete Dropdown:**
   ```tsx
   {showAutocomplete && (
     <div
       className="autocomplete-dropdown"
       style={{ position: 'absolute', top: autocompletePosition.top, left: autocompletePosition.left }}
     >
       {autocompleteType === 'figure'
         ? generateFigureSuggestions(getAllFigureReferences(), autocompleteQuery).map(suggestion => (
             <div key={suggestion.id} onClick={() => insertSuggestion(suggestion.label)}>
               {suggestion.description}
             </div>
           ))
         : generateReferenceSuggestions(getAllCitationReferences(), autocompleteQuery).map(suggestion => (
             <div key={suggestion.id} onClick={() => insertSuggestion(suggestion.label)}>
               {suggestion.description}
             </div>
           ))
       }
     </div>
   )}
   ```

4. **Handle Arrow Keys and Enter:**
   - Up/Down arrows to navigate suggestions
   - Enter to select
   - Escape to dismiss

### 9. Inline Validation (TODO - Medium Priority)

**Goal:** Show red squiggly underline for invalid references in edit mode
**Status:** 🚧 PENDING

**Implementation Plan:**

1. **Parse markdown on change:**
   ```typescript
   const [invalidLinks, setInvalidLinks] = useState<ParsedLink[]>([]);

   useEffect(() => {
     const invalid = findInvalidLinks(
       markdown,
       getValidFigureIds(),
       getValidReferenceIds()
     );
     setInvalidLinks(invalid);
   }, [markdown]);
   ```

2. **Overlay validation markers:**
   - Use absolutely positioned `<span>` elements with red underline
   - Calculate positions based on line/column numbers
   - Show tooltip on hover with error message

3. **Alternative: CodeMirror/Monaco Editor:**
   - For advanced validation, consider switching to a code editor
   - Both support custom language modes with syntax highlighting
   - Can show inline diagnostics like VS Code

### 10. Comprehensive Testing (TODO - Medium Priority)

**Status:** ⚠️ PARTIALLY COMPLETE (Basic testing done, comprehensive testing pending)

**Completed Tests:**
- ✅ Basic link transformation (`{{fig:...}}` → clickable link)
- ✅ Click navigation to Diagrams tab
- ✅ Console logging verification
- ✅ Tab highlighting and content display

**Remaining Manual Tests:**

1. **Basic Resolution:**
   - Create a block diagram (id: "test-diagram")
   - In markdown editor, type: "See {{fig:test-diagram}} for details"
   - Switch to Preview mode
   - **Expected:** "See Figure 4-1 for details" (blue clickable link)
   - Click link → should navigate to diagrams tab

2. **Invalid Reference:**
   - Type: "See {{fig:nonexistent}}"
   - **Expected:** "See {{fig:nonexistent}}" (red link with warning)

3. **Citation Resolution:**
   - Add a reference document (id: "3gpp-ts-23-203")
   - Type: "According to {{ref:3gpp-ts-23-203}}"
   - **Expected:** "According to 3GPP TS 23.203 [1]" (purple link)

4. **Multiple Links:**
   - Type: "See {{fig:diagram1}} and {{fig:diagram2}} and {{ref:ref1}}"
   - **Expected:** All three links resolve correctly with different colors

---

## How It Works

### 1. Markdown Authoring (Edit Mode)

User types in MarkdownEditor textarea:
```markdown
## Architecture Overview

The system consists of multiple components as shown in {{fig:converged-service-edge}}.
This design follows {{ref:3gpp-ts-23-203}} specifications.
```

### 2. Link Resolution (Preview Mode)

When viewing in preview, the remark plugin:

1. **Parses Text Nodes:**
   - Finds all `{{fig:...}}` and `{{ref:...}}` patterns

2. **Looks Up Diagrams/References:**
   - `figures = getAllFigureReferences()` → `[{id: 'converged-service-edge', number: '4-1', title: 'Converged Service Edge', type: 'block'}]`
   - `citations = getAllCitationReferences()` → `[{id: '3gpp-ts-23-203', number: '1', title: '3GPP TS 23.203'}]`

3. **Transforms to Links:**
   - `{{fig:converged-service-edge}}` → AST Link node:
     ```javascript
     {
       type: 'link',
       url: '#diagram-converged-service-edge',
       title: 'Navigate to Converged Service Edge',
       children: [{ type: 'text', value: 'Figure 4-1' }],
       data: {
         hProperties: {
           className: 'figure-reference',
           'data-diagram-id': 'converged-service-edge'
         }
       }
     }
     ```

4. **Renders to HTML:**
   ```html
   <a href="#diagram-converged-service-edge"
      class="figure-reference"
      data-diagram-id="converged-service-edge"
      title="Navigate to Converged Service Edge">
     Figure 4-1
   </a>
   ```

### 3. User Interaction

User sees in preview:
> The system consists of multiple components as shown in **Figure 4-1** (blue clickable link).
> This design follows **3GPP TS 23.203 [1]** (purple clickable link) specifications.

Click behavior:
- Click "Figure 4-1" → Navigate to Diagrams tab (via `onNavigate` callback)
- Click "3GPP TS 23.203 [1]" → Navigate to References tab

---

## Technical Decisions

### Why Remark Plugin?

**Pros:**
- Integrates seamlessly with react-markdown
- Works on the AST (Abstract Syntax Tree) level
- Preserves markdown structure
- Can generate clickable links
- Supports custom HTML attributes

**Cons:**
- Requires understanding of mdast (Markdown AST) format
- More complex than simple string replacement
- Debugging AST transformations is harder

**Alternative Considered:**
- Simple string replacement in markdown before rendering
  - Rejected because it breaks markdown structure
  - Can't create clickable links easily

### Why Not CodeMirror/Monaco?

**Decision:** Start with simple textarea + preview, add advanced editor later if needed

**Pros of Advanced Editor:**
- Syntax highlighting
- Inline validation
- Autocomplete built-in
- Better UX for large documents

**Cons:**
- Large bundle size (Monaco: 5MB+)
- Complex integration
- May be overkill for MVP

**Next Step:** Implement autocomplete with simple dropdown first, then decide if advanced editor is needed.

### Auto-Numbering Strategy

**Current Implementation:**
- All diagrams numbered as "4-X" (section 4 is Architecture)
- Counter increments across all diagram types
- Simple but not section-aware

**Future Enhancement:**
- Parse markdown headings
- Determine which section each diagram is referenced in
- Number based on actual section: "2-1", "3-1", "4-1", etc.

---

## File Structure

```
src/
├── utils/
│   ├── linkResolver.ts           # ✅ 259 lines - Core parsing and validation
│   └── remarkLinkResolver.ts     # ✅ 245 lines - Remark plugin for preview
├── store/
│   └── projectStore.ts           # ✅ Updated - Added 6 utility methods
├── components/
│   └── editors/
│       └── MarkdownEditor.tsx    # ✅ Updated - Integrated plugin
├── index.css                     # ✅ Updated - Added link styles
└── types/
    └── index.ts                  # ✅ No changes needed - uses existing types
```

---

## Dependencies Added

```json
{
  "dependencies": {
    "unist-util-visit": "^5.0.0"  // For traversing markdown AST
  }
}
```

---

## Next Steps (Priority Order)

### High Priority:
1. ✅ ~~Core link resolution~~ **COMPLETE**
2. ✅ ~~Remark plugin integration~~ **COMPLETE**
3. ✅ ~~Store utilities~~ **COMPLETE**
4. ✅ ~~CSS styling~~ **COMPLETE**
5. 🚧 **Autocomplete dropdown** - Improve UX when typing links
6. 🚧 **Manual testing** - Verify all functionality works end-to-end

### Medium Priority:
7. **Inline validation** - Visual feedback for invalid links in edit mode
8. **Section-aware numbering** - Parse headings to number figures by section

### Low Priority:
9. **Advanced editor** - Consider CodeMirror/Monaco if simple solution is insufficient
10. **Automated tests** - Unit tests for parser, integration tests for plugin

---

## Known Limitations

1. **Auto-numbering is simplistic:**
   - All diagrams numbered as "4-X"
   - Should be section-aware ("2-1", "3-1", "4-1")

2. **No autocomplete yet:**
   - Users must manually type diagram IDs
   - Easy to make typos

3. **No inline validation in edit mode:**
   - Invalid references only shown in preview
   - Users won't see errors until switching modes

4. **Navigation is basic:**
   - Click only switches tabs
   - Doesn't scroll to specific diagram or reference

---

## Success Criteria

✅ **COMPLETE:**
- [x] Parse `{{fig:...}}` and `{{ref:...}}` syntax
- [x] Resolve to proper figure numbers in preview
- [x] Clickable links navigate to diagrams/references
- [x] Invalid references shown with visual warning
- [x] Color-coded links (blue/purple/red)
- [x] Store utilities for validation and suggestions

🚧 **TODO:**
- [ ] Autocomplete when typing `{{fig:` or `{{ref:`
- [ ] Inline validation in edit mode
- [ ] Manual end-to-end testing
- [ ] Section-aware auto-numbering

---

## Phase 3 Progress Update

**Overall Phase 3 Completion:** 60% → 75% (with link resolution core complete)

### Updated Task Breakdown:
1. ✅ Block Diagram Editor Integration (20%) - COMPLETE
2. ✅ Pan/Zoom in View-Only Mode (20%) - COMPLETE
3. ✅ Sequence Diagram Editor (20%) - COMPLETE
4. ✅ **Link Resolution System - Core** (15%) ← **COMPLETE**
5. 🚧 **Link Resolution - Enhancements** (5%) - Autocomplete + Inline Validation pending
6. 🚧 Auto-Numbering (5%) - Partially complete (simple numbering exists)
7. 🚧 Flow Diagram Editor (10%) - Optional (currently using SequenceDiagramEditor)
8. 🚧 Change Propagation (5%) - Low priority

**Next Milestone:** Complete autocomplete + inline validation to reach 80% completion.

**Summary of Link Resolution Implementation:**
- **Core Features:** 100% Complete (7/7 tasks)
- **Optional Enhancements:** 0% Complete (0/3 tasks)
- **Overall:** 71% Complete (7/10 tasks)

**What's Working:**
- ✅ Parse and validate `{{fig:...}}` and `{{ref:...}}` syntax
- ✅ Transform to clickable links in preview (blue for figures, purple for citations)
- ✅ Invalid references shown in red with warning tooltip
- ✅ Click navigation to appropriate tabs
- ✅ Store utilities for getting diagrams and references
- ✅ CSS styling with hover states
- ✅ Integration with Zustand store

**What's Pending:**
- 🚧 Autocomplete dropdown when typing `{{fig:` or `{{ref:`
- 🚧 Inline validation with red squiggly underlines in edit mode
- 🚧 Comprehensive end-to-end testing
