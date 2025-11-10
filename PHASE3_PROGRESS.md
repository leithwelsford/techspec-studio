# Phase 3 Progress Report: Diagram Editing & Integration

**Date:** 2025-11-09
**Status:** 🟡 **IN PROGRESS** (2 of 5 features complete)
**Dev Server:** Running on http://localhost:3000

---

## Executive Summary

Phase 3 focuses on diagram editing, linking systems, and change propagation. **Two major features are complete**, with three remaining for full Phase 3 completion.

### ✅ Completed Features (40%)
1. **Block Diagram Editor Integration** - Full-featured editor with 998 lines
2. **Pan/Zoom in View-Only Mode** - Works for all diagram types

### 🚧 Remaining Features (60%)
3. **Sequence/Flow Diagram Editors** - Mermaid code editors with live preview
4. **Link Resolution System** - `{{fig:...}}` and `{{ref:...}}` auto-resolution
5. **Change Propagation** - AI-assisted consistency across artifacts

---

## ✅ 1. Block Diagram Editor Integration (COMPLETE)

**Component:** [src/components/editors/BlockDiagramEditor.tsx](src/components/editors/BlockDiagramEditor.tsx) (998 lines)

**Implementation Date:** Prior to 2025-11-09 (extracted from App.tsx)

### Features:
- ✅ **Drag & Drop** - Move nodes with mouse
- ✅ **Resize** - Corner handles (NW, NE, SE, SW)
- ✅ **Pan/Zoom** - Spacebar + drag, middle-click, scroll wheel
- ✅ **Edit Labels** - Double-click to rename nodes
- ✅ **Node Shapes** - Rectangle and cloud shapes
- ✅ **Edge Styles** - Bold, solid, dashed with labels
- ✅ **Edge Routing** - Straight or orthogonal toggle
- ✅ **Zustand Integration** - Full state management integration
- ✅ **Keyboard Shortcuts** - Delete, Escape (with input detection fix)

### Key Implementation Details:

**Pan/Zoom Hook** - [src/hooks/usePanZoom.ts](src/hooks/usePanZoom.ts) (95 lines):
```typescript
// Fixed spacebar prevention to not interfere with text inputs
const isTyping = target.tagName === 'INPUT' ||
                 target.tagName === 'TEXTAREA' ||
                 target.isContentEditable;
```

**Integration with DiagramViewer:**
- Edit mode: Uses `BlockDiagramEditor` for full editing
- View mode: Uses `BlockDiagramRenderer` with pan/zoom

**Store Actions Used:**
- `updateBlockDiagram(id, updates)` - Save changes
- `deleteNode(diagramId, nodeId)` - Remove nodes
- `deleteEdge(diagramId, edgeIndex)` - Remove edges

---

## ✅ 2. Pan/Zoom in View-Only Mode (COMPLETE)

**Component:** [src/components/PanZoomWrapper.tsx](src/components/PanZoomWrapper.tsx) (82 lines)

**Implementation Date:** 2025-11-09

### Features:
- ✅ **Works on all diagram types** - Block, sequence, and flow diagrams
- ✅ **Click anywhere to pan** - No longer requires clicking background
- ✅ **Scroll wheel zoom** - 0.4x to 3x scale range
- ✅ **Visual cursor feedback** - Open hand → closed hand when dragging
- ✅ **Instructions overlay** - Helpful tips visible on canvas

### Key Implementation Details:

**Custom Pan Handlers:**
```typescript
// Always allow panning in view mode (left click or middle click)
const handleMouseDown = (e: React.MouseEvent) => {
  if (e.button === 0 || e.button === 1) {
    e.preventDefault();
    dragging.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    setIsDragging(true);
  }
};
```

**Cursor State Management:**
- Uses `useState` for `isDragging` to trigger re-renders
- Dynamic cursor: `isDragging ? 'grabbing' : 'grab'`

**Usage:**
```tsx
<PanZoomWrapper>
  <BlockDiagramContent diagram={diagram} />
</PanZoomWrapper>
```

### Bug Fixes Applied:
1. **Infinite Render Loop** - Fixed MermaidDiagramRenderer useEffect dependencies
2. **Keyboard Interference** - Fixed spacebar/backspace in text inputs
3. **Pan on Diagram Elements** - Custom handlers work on any click, not just background

---

## 🚧 3. Sequence/Flow Diagram Editors (TODO)

**Goal:** Create Mermaid code editors with live preview for sequence and flow diagrams.

### Planned Components:

**SequenceDiagramEditor.tsx:**
- Mermaid code editor (Monaco or CodeMirror)
- Live preview pane (split view)
- Syntax validation
- Common pattern templates (e.g., "Basic Call Flow", "Error Handling")
- Save to Zustand: `updateMermaidDiagram(id, mermaidCode)`

**FlowDiagramEditor.tsx:**
- Similar to sequence editor but for flowcharts/state machines
- Template library (e.g., "State Machine", "Decision Tree")

### Integration Points:
- Add to DiagramViewer edit mode toggle
- Use existing `MermaidDiagramRenderer` for preview
- Store: `updateMermaidDiagram(id, updates)`

---

## 🚧 4. Link Resolution System (TODO)

**Goal:** Auto-resolve `{{fig:...}}` and `{{ref:...}}` syntax in markdown.

### Planned Features:

**Figure References:**
- Syntax: `{{fig:diagram-id}}` in markdown
- Resolution: Replace with "Figure 4-1" in preview
- Auto-numbering: Based on section and order
- Click-to-navigate: Jump to diagram viewer

**Reference Citations:**
- Syntax: `{{ref:3gpp-ts-23-203}}` in markdown
- Resolution: Replace with "3GPP TS 23.203 [1]" in preview
- Bibliography: Auto-generate reference section
- Click-to-view: Open reference document

### Implementation Tasks:

1. **Parser:**
   - Regex: `/\{\{fig:([^}]+)\}\}/g`
   - Regex: `/\{\{ref:([^}]+)\}\}/g`
   - Extract IDs and validate against store

2. **Markdown Editor Enhancement:**
   - Autocomplete for diagram IDs
   - Autocomplete for reference IDs
   - Inline validation (red underline for invalid)

3. **Preview Renderer:**
   - Custom remark plugin for react-markdown
   - Replace syntax with resolved text
   - Add click handlers for navigation

4. **Store Utilities:**
   - `getAllDiagrams()` - Already exists
   - `getDiagramNumber(id)` - Calculate figure number
   - `getReferenceNumber(id)` - Calculate citation number

---

## 🚧 5. Change Propagation (TODO)

**Goal:** AI-assisted consistency when editing specs or diagrams.

### Planned Features:

**Detection:**
- User edits specification text → AI detects affected diagrams
- User edits diagram → AI detects affected spec sections
- Trigger: On save or explicit "Check Consistency" button

**AI Service Method:**
```typescript
async detectRelatedChanges(
  editedContent: string,
  contentType: 'spec' | 'diagram',
  currentState: ProjectState
): Promise<{
  affectedDiagrams: string[],
  affectedSections: string[],
  suggestedChanges: Change[]
}>
```

**Workflow:**
1. User makes change
2. AI analyzes impact
3. Show "Related Changes Detected" banner
4. User reviews suggested changes
5. Approve/reject via existing approval workflow
6. Changes applied atomically

**Example Scenarios:**
- Rename "PCRF" → "PCF" in spec → Update all diagrams
- Add new component to block diagram → Suggest spec update
- Change procedure flow → Update sequence diagram

---

## Current Architecture Status

### File Structure (Phase 3):
```
src/components/
├── editors/
│   ├── BlockDiagramEditor.tsx     ✅ COMPLETE (998 lines)
│   ├── MarkdownEditor.tsx         ✅ COMPLETE (with AI integration)
│   ├── SequenceDiagramEditor.tsx  🚧 TODO
│   └── FlowDiagramEditor.tsx      🚧 TODO
├── DiagramViewer.tsx              ✅ COMPLETE (with view/edit modes)
├── PanZoomWrapper.tsx             ✅ COMPLETE (82 lines)
└── Workspace.tsx                  ✅ COMPLETE (tab navigation)
```

### Store Integration:
- ✅ `updateBlockDiagram(id, updates)` - Working
- ✅ `updateMermaidDiagram(id, updates)` - Type exists, needs editor
- ✅ `getAllDiagrams()` - Utility for linking
- 🚧 `getDiagramNumber(id)` - TODO for auto-numbering
- 🚧 `detectRelatedChanges(...)` - TODO for propagation

---

## Next Steps (Priority Order)

### High Priority:
1. **Sequence Diagram Editor** - Most requested for call flows
2. **Link Resolution** - Critical for professional documents
3. **Auto-numbering** - Part of link resolution

### Medium Priority:
4. **Flow Diagram Editor** - Less used than sequence
5. **Change Propagation** - Nice-to-have for consistency

### Low Priority:
6. **Template Library** - Common patterns for diagrams
7. **Export Enhancements** - Phase 4 dependency

---

## Known Issues

### Fixed in This Session (2025-11-09):
- ✅ Infinite render loop in MermaidDiagramRenderer
- ✅ Spacebar prevented in text inputs
- ✅ Backspace prevented in text inputs
- ✅ Pan only worked on background (not diagram elements)
- ✅ Cursor didn't change to "grabbing" when dragging

### Remaining Issues:
- ⚠️ Mermaid syntax errors in stored diagrams (from earlier AI generation)
  - **Solution:** Delete broken diagrams or regenerate with fixed prompts
- ⚠️ No editor for sequence/flow diagrams yet (view-only)

---

## Testing Recommendations

### Manual Tests:
1. ✅ Create block diagram → Edit mode → Drag, resize, pan, zoom
2. ✅ View block diagram → Pan/zoom works everywhere
3. ✅ View sequence diagram → Pan/zoom works
4. ⚠️ Edit sequence diagram → NOT IMPLEMENTED (needs editor)
5. ⚠️ Add `{{fig:...}}` to spec → Preview doesn't resolve yet

### Automated Tests (Future):
- Unit tests for link resolution parser
- Integration tests for change propagation
- E2E tests for editor workflows

---

## Documentation Status

### Updated Files:
- ✅ [CLAUDE.md](CLAUDE.md) - Added pan/zoom, updated Phase 3 status
- ✅ [PHASE3_PROGRESS.md](PHASE3_PROGRESS.md) - This document

### Needs Update:
- 🚧 [IMPLEMENTATION_PROGRESS.md](IMPLEMENTATION_PROGRESS.md) - Still shows Phase 3 as "FUTURE"
- 🚧 [README.md](README.md) - May need user-facing updates

---

## Summary

**Phase 3 is 40% complete** with the hardest parts (BlockDiagramEditor extraction) already done. The remaining work focuses on:

1. **Mermaid editors** (straightforward - code + preview)
2. **Link resolution** (medium complexity - parser + autocomplete)
3. **Change propagation** (complex - AI integration)

**Recommendation:** Prioritize sequence diagram editor next, as it's most useful for telecom call flows.
