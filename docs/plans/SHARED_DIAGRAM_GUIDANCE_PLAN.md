# Shared Diagram Guidance Implementation Plan

## Problem Statement

When generating specifications with sub-sections that share conceptual diagrams, the AI currently:
1. Creates duplicate/similar diagrams for each sub-section
2. Does not know to place a shared diagram in the first sub-section
3. Does not reference existing diagrams with prose in subsequent sub-sections

### Example Scenario

Section 5 has sub-sections where 5.1, 5.2, and 5.3 share a system architecture diagram:

**Current Behavior (Wrong):**
```markdown
### 5.1 Logical Components
{{fig:5-1-system-architecture}}
*Figure 5-1: System Architecture*

### 5.2 Control Plane Functions
{{fig:5-2-control-plane-view}}        ← DUPLICATE diagram created
*Figure 5-2: Control Plane View*

### 5.3 User Plane Functions
{{fig:5-3-user-plane-view}}           ← DUPLICATE diagram created
*Figure 5-3: User Plane View*
```

**Desired Behavior:**
```markdown
### 5.1 Logical Components
{{fig:5-1-system-architecture}}
*Figure 5-1: System Architecture Overview*

### 5.2 Control Plane Functions
As shown in Figure 5-1, the control plane encompasses...  ← PROSE REFERENCE
[No new diagram - references existing Figure 5-1]

### 5.3 User Plane Functions
The user plane path illustrated in Figure 5-1 shows...   ← PROSE REFERENCE
[No new diagram - references existing Figure 5-1]
```

---

## Current State

### What Works ✅

| Feature | Location | Notes |
|---------|----------|-------|
| Section-level figure numbering | `src/utils/linkResolver.ts:120` | `extractSectionNumber` returns "5" from "## 5.1 Overview" |
| Format `{section}-{position}` | `src/utils/figureNumbering.ts` | All diagrams in section 5 numbered 5-1, 5-2, 5-3 |
| Diagram matching by slug | `src/utils/figureNumbering.ts:99-118` | Multiple matching strategies |
| Visual emphasis for related diagrams | `src/services/ai/prompts/diagramPrompts.ts:133-137` | FOCUS ON NODES/INTERFACES |

### What's Missing ❌

| Feature | Gap |
|---------|-----|
| Shared diagram detection | AI doesn't recognize when sub-sections share conceptual content |
| First sub-section placement | No guidance to place shared diagram in first relevant sub-section |
| Prose reference pattern | No guidance to use "As shown in Figure X-Y..." instead of new placeholders |
| Diagram scope indicators | No way for AI to specify diagram covers multiple sub-sections |

---

## Implementation Plan

### Phase 1: Update AI Prompts for Section Generation

**File**: `src/services/ai/prompts/sectionPrompts.ts`

Add new guidance to `DIAGRAM_PLACEHOLDER_REQUIREMENTS`:

```typescript
## Shared Diagrams Across Sub-Sections

When a diagram conceptually applies to multiple sub-sections:

1. **Place the diagram in the FIRST sub-section that uses it**
   - Include the {{fig:...}} placeholder and caption in that first sub-section
   - The diagram should show the complete view needed by all related sub-sections

2. **Reference with prose in subsequent sub-sections**
   - Do NOT create new diagram placeholders
   - Use phrases like:
     - "As shown in Figure X-Y, ..."
     - "The architecture illustrated in Figure X-Y ..."
     - "Referring to Figure X-Y, the [specific aspect] ..."

3. **Figure numbering remains section-level**
   - All diagrams in section 5 are numbered 5-1, 5-2, 5-3
   - NOT 5.1-1, 5.2-1 (sub-section level)

### Example: Section 5 with shared and unique diagrams

\`\`\`markdown
### 5.1 Logical Components
{{fig:5-1-system-architecture}}
<!-- TODO: [BLOCK DIAGRAM] Show all major components (AMF, SMF, UPF)
     and interfaces. FOCUS ON NODES. This diagram covers 5.1, 5.2, 5.3 -->
*Figure 5-1: System Architecture Overview*

The system comprises five logical components...

### 5.2 Control Plane Functions
As shown in Figure 5-1, the control plane encompasses the Policy Controller
and Session Manager components. This section details their responsibilities...
[No new diagram - uses prose reference to Figure 5-1]

### 5.3 User Plane Functions
The user plane data path, illustrated in Figure 5-1, flows through the
Access Gateway and Traffic Processor...
[No new diagram - uses prose reference to Figure 5-1]

### 5.4 Session Management
{{fig:5-2-session-states}}
<!-- TODO: [STATE DIAGRAM] Show session lifecycle: IDLE → INITIATING →
     ACTIVE → TERMINATING → CLOSED with transition triggers -->
*Figure 5-2: Session State Machine*

This section requires its own diagram showing state transitions...

### 5.5 Authentication Framework
{{fig:5-3-auth-system}}
<!-- TODO: [BLOCK DIAGRAM] Show authentication components and
     credential flows. FOCUS ON INTERFACES. Covers 5.5 and 5.6 -->
*Figure 5-3: Authentication System Overview*

The authentication framework supports multiple methods...

### 5.6 Authorization and Access Control
The authorization layer, shown in Figure 5-3, integrates with the
authentication components to enforce access policies...
[No new diagram - uses prose reference to Figure 5-3]
\`\`\`

### Indicators in TODO Comments

When a diagram covers multiple sub-sections, indicate this in the TODO:

\`\`\`markdown
<!-- TODO: [BLOCK DIAGRAM] ... This diagram covers 5.1, 5.2, 5.3 -->
\`\`\`

This helps:
- Document authors understand the diagram's scope
- Future AI refinements know not to duplicate
- Reviewers verify appropriate coverage
```

### Phase 2: Update System Prompts

**File**: `src/services/ai/prompts/systemPrompts.ts`

Add to the telecom domain expertise section:

```typescript
// Add to buildTelecomSystemPrompt or similar
const SHARED_DIAGRAM_GUIDANCE = `
## Diagram Placement Strategy

Technical specifications often have sub-sections that share high-level diagrams:
- Architecture diagrams typically apply to multiple sub-sections
- Component diagrams may be referenced from different perspectives
- Interface diagrams are often shared across protocol descriptions

**Rule**: One diagram, one placement, multiple prose references.

When writing sub-sections:
1. Check if an earlier sub-section already has a relevant diagram
2. If yes, reference it with prose: "As shown in Figure X-Y..."
3. If no, and a new diagram is needed, place it in the current sub-section
4. If the new diagram will be relevant to later sub-sections, note this in the TODO
`;
```

### Phase 3: Update Document Generation Prompts

**File**: `src/services/ai/prompts/documentPrompts.ts`

Update `buildDocumentGenerationPrompt` to include awareness of shared diagrams:

```typescript
// Add to the document generation prompt
const DIAGRAM_SCOPE_GUIDANCE = `
When planning diagrams for the document:

1. **Identify shared diagrams first**
   - Architecture overview → likely shared across multiple sub-sections
   - Component diagrams → may apply to related sub-sections
   - Sequence diagrams → usually specific to one sub-section

2. **Plan diagram placement**
   - Place each shared diagram in the earliest relevant sub-section
   - Plan prose references for subsequent sub-sections

3. **Avoid diagram proliferation**
   - Don't create separate diagrams that show the same topology
   - Use prose references liberally
   - A document with 10 sections shouldn't have 10 similar architecture diagrams
`;
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/services/ai/prompts/sectionPrompts.ts` | Add shared diagram guidance to `DIAGRAM_PLACEHOLDER_REQUIREMENTS` |
| `src/services/ai/prompts/systemPrompts.ts` | Add `SHARED_DIAGRAM_GUIDANCE` constant and include in system prompts |
| `src/services/ai/prompts/documentPrompts.ts` | Add diagram scope awareness to document generation |
| `docs/plans/DIAGRAM_LINKING_IMPLEMENTATION_PLAN.md` | Reference this plan |
| `CLAUDE.md` | Document the shared diagram pattern |

---

## Testing Checklist

### Prompt Verification
- [ ] Generate a section with sub-sections 5.1, 5.2, 5.3 that share an architecture concept
- [ ] Verify diagram appears only in 5.1
- [ ] Verify 5.2 and 5.3 use prose references ("As shown in Figure 5-1...")
- [ ] Verify figure numbers are section-level (5-1, 5-2) not sub-section-level (5.1-1)

### Mixed Scenarios
- [ ] Section with some shared diagrams and some unique diagrams
- [ ] Multiple groups of shared diagrams in same section (5.1-5.3 share one, 5.5-5.6 share another)
- [ ] Sub-section that needs both a shared reference AND its own unique diagram

### Edge Cases
- [ ] First sub-section has no diagram, second does (should work normally)
- [ ] All sub-sections need unique diagrams (no sharing - should work as before)
- [ ] Diagram placed in section header (not sub-section) - should still work

---

## Prose Reference Patterns

Standard phrases for referencing existing diagrams:

| Pattern | Use Case |
|---------|----------|
| "As shown in Figure X-Y, ..." | General reference to diagram content |
| "The architecture illustrated in Figure X-Y ..." | Referring to structure |
| "Referring to Figure X-Y, the [component] ..." | Calling out specific element |
| "Figure X-Y depicts the overall [topic], while this section focuses on ..." | Narrowing scope |
| "The [element] shown in Figure X-Y ..." | Specific element reference |
| "See Figure X-Y for the complete [view]" | Directing reader to diagram |

---

## Implementation Notes

### Why Prompts Only (No Code Changes)

This feature is implemented entirely through prompt engineering because:

1. **Figure numbering already works correctly** - Section-level (5-1) not sub-section (5.1-1)
2. **Diagram matching already works** - Slug matching handles references correctly
3. **The problem is AI behavior** - AI doesn't know WHEN to reference vs. create
4. **Prompt guidance is sufficient** - Clear instructions change AI output effectively

### Backward Compatibility

- Existing specifications remain unchanged
- Existing diagram linking continues to work
- New specifications benefit from improved guidance
- No schema or type changes required

---

## Related Documentation

- [DIAGRAM_LINKING_IMPLEMENTATION_PLAN.md](DIAGRAM_LINKING_IMPLEMENTATION_PLAN.md) - Diagram linking strategies
- [CLAUDE.md](../../CLAUDE.md) - Project overview and patterns
- [src/utils/figureNumbering.ts](../../src/utils/figureNumbering.ts) - Figure number calculation
- [src/services/ai/prompts/sectionPrompts.ts](../../src/services/ai/prompts/sectionPrompts.ts) - Section generation prompts
