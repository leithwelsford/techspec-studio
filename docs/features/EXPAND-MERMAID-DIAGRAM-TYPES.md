# Expanded Mermaid Diagram Type Support

> **Status: ✅ IMPLEMENTED** - All 23 Mermaid diagram types are now supported.

## Overview

The system now supports all 23 Mermaid diagram types (as of Mermaid v11), plus our custom block diagram format. The AI decides the most appropriate type based on TODO comments and content.

## Supported Types (24 total)

**Custom Format:**
- `block` - Custom JSON format (architecture diagrams with interactive editing)

**Core Mermaid Diagrams:**
- `sequence` - sequenceDiagram (message flows, protocol interactions)
- `flow` - flowchart/graph (algorithms, decision trees)
- `state` - stateDiagram-v2 (state machines, transitions)
- `class` - classDiagram (OOP structures, inheritance)

**Data & Relationships:**
- `er` - erDiagram (entity relationships, database schemas)

**Planning & Time:**
- `gantt` - gantt (project timelines, schedules)
- `timeline` - timeline (sequential events, milestones)

**Analysis & Visualization:**
- `pie` - pie (proportional data, percentages)
- `quadrant` - quadrantChart (priority matrices, 2D comparisons)
- `xy` - xychart-beta (line/bar/scatter charts)
- `sankey` - sankey-beta (flow distributions)
- `radar` - radar-beta (spider charts, competency comparisons)
- `treemap` - treemap-beta (hierarchical proportional areas)

**Hierarchies & Concepts:**
- `mindmap` - mindmap (concept hierarchies, brainstorming)

**Architecture:**
- `c4` - C4Context/C4Container/C4Component/C4Dynamic (software architecture)
- `architecture` - architecture-beta (system architecture with services)
- `block-beta` - block-beta (Mermaid's block diagram, CSS-grid style)

**User Experience:**
- `journey` - journey (user experience flows, satisfaction scores)

**Development:**
- `gitgraph` - gitGraph (commit history, branches)
- `requirement` - requirementDiagram (requirements traceability)
- `zenuml` - zenuml (alternative sequence diagrams)

**Project Management:**
- `kanban` - kanban (task boards, sprint boards)

**Network:**
- `packet` - packet-beta (network packet structures)

**Workflow:**
1. Spec generation: LLM adds `{{fig:id}}` + `<!-- TODO: [DIAGRAM TYPE] description -->`
2. Diagram generation: Parser reads TODO, determines type, generates diagram

---

## Phase 1: Update Type Definitions

**File: `src/types/index.ts`**

Update `MermaidDiagram.type` union (around line 103):

```typescript
// Current
type: 'sequence' | 'flow' | 'state' | 'class';

// New - add all Mermaid types
type: 'sequence' | 'flow' | 'state' | 'class' | 'er' | 'gantt' | 'pie' |
      'quadrant' | 'requirement' | 'gitgraph' | 'mindmap' | 'timeline' |
      'c4' | 'sankey' | 'xy' | 'block-beta' | 'architecture';
```

---

## Phase 2: Update Diagram Type Detection

**File: `src/services/ai/parsers/mermaidParser.ts`**

### 2a. Update `detectMermaidType()` return type and detection logic (around line 177):

```typescript
export function detectMermaidType(code: string):
  'sequence' | 'flow' | 'state' | 'class' | 'er' | 'gantt' | 'pie' |
  'quadrant' | 'requirement' | 'gitgraph' | 'mindmap' | 'timeline' |
  'c4' | 'sankey' | 'xy' | 'block-beta' | 'architecture' | null {

  // ... existing code fence stripping ...

  const firstLine = cleanedCode.split('\n')[0].toLowerCase().trim();

  // Existing detections
  if (firstLine.startsWith('sequencediagram')) return 'sequence';
  if (firstLine.startsWith('flowchart') || firstLine.startsWith('graph')) return 'flow';
  if (firstLine.startsWith('statediagram')) return 'state';
  if (firstLine.startsWith('classdiagram')) return 'class';

  // NEW: Add detection for additional types
  if (firstLine.startsWith('erdiagram')) return 'er';
  if (firstLine.startsWith('gantt')) return 'gantt';
  if (firstLine.startsWith('pie')) return 'pie';
  if (firstLine.startsWith('quadrantchart')) return 'quadrant';
  if (firstLine.startsWith('requirementdiagram')) return 'requirement';
  if (firstLine.startsWith('gitgraph')) return 'gitgraph';
  if (firstLine.startsWith('mindmap')) return 'mindmap';
  if (firstLine.startsWith('timeline')) return 'timeline';
  if (firstLine.startsWith('c4context') || firstLine.startsWith('c4container') ||
      firstLine.startsWith('c4component') || firstLine.startsWith('c4dynamic')) return 'c4';
  if (firstLine.startsWith('sankey')) return 'sankey';
  if (firstLine.startsWith('xychart')) return 'xy';
  if (firstLine.startsWith('block-beta')) return 'block-beta';
  if (firstLine.startsWith('architecture')) return 'architecture';

  // Update debug regex to include new types
  if (!firstLine.match(/^(sequence|flowchart|graph|state|class|erdiagram|gantt|pie|quadrant|requirement|gitgraph|mindmap|timeline|c4|sankey|xychart|block-beta|architecture)/i)) {
    console.warn(`⚠️ detectMermaidType: Could not detect type. First line: "${firstLine.substring(0, 100)}"`);
  }

  return null;
}
```

### 2b. Update `parseMermaidDiagram()` diagramType parameter type (line 14):

Change the type parameter to accept the expanded union or use a generic 'mermaid' type.

### 2c. Update `fixMermaidSyntax()` type signature (line 214):

Update to handle new types or make it more generic.

---

## Phase 3: Update Spec Generation Prompts

**File: `src/services/ai/prompts/sectionPrompts.ts`**

Update `DIAGRAM_PLACEHOLDER_REQUIREMENTS` (around line 21):

```typescript
export const DIAGRAM_PLACEHOLDER_REQUIREMENTS = `
## Diagram Placeholders

When visual aids would help explain concepts, use figure placeholders:

✅ USE: \`{{fig:descriptive-id}}\` syntax

**REQUIRED**: Include a TODO comment with EXPLICIT DIAGRAM TYPE after each placeholder:

Format: \`<!-- TODO: [DIAGRAM TYPE] Description of what the diagram should show -->\`

### Available Diagram Types (use exact bracketed text):

**Architecture & Structure:**
- \`[BLOCK DIAGRAM]\` - Architecture, components, interfaces, network topology (custom JSON format)
- \`[CLASS DIAGRAM]\` - OOP class structures, relationships, inheritance
- \`[C4 DIAGRAM]\` - Software architecture (Context, Container, Component levels)

**Flows & Sequences:**
- \`[SEQUENCE DIAGRAM]\` - Call flows, message exchanges, protocol interactions, signaling
- \`[FLOW DIAGRAM]\` - Algorithms, decision trees, conditional logic, process flows
- \`[STATE DIAGRAM]\` - State machines, state transitions, modes, lifecycle states

**Data & Relationships:**
- \`[ER DIAGRAM]\` - Entity relationships, data models, database schemas

**Planning & Timelines:**
- \`[GANTT CHART]\` - Project timelines, implementation phases, schedules
- \`[TIMELINE]\` - Sequential events, milestones, evolution

**Analysis & Visualization:**
- \`[PIE CHART]\` - Proportional data, distribution, percentages
- \`[QUADRANT CHART]\` - Priority matrices, risk assessment, 2D comparisons
- \`[MINDMAP]\` - Concept hierarchies, feature breakdowns, brainstorming

### Examples:

\`\`\`markdown
{{fig:system-architecture}}
<!-- TODO: [BLOCK DIAGRAM] Show main components (AMF, SMF, UPF) and N-interfaces -->

{{fig:user-session-entity}}
<!-- TODO: [ER DIAGRAM] Show User, Session, and Subscription entities with relationships -->

{{fig:implementation-timeline}}
<!-- TODO: [GANTT CHART] Show Phase 1 (months 1-3), Phase 2 (months 4-6), Phase 3 (months 7-9) -->

{{fig:feature-hierarchy}}
<!-- TODO: [MINDMAP] Show main features branching into sub-features and capabilities -->

{{fig:risk-matrix}}
<!-- TODO: [QUADRANT CHART] Plot risks by likelihood (x) vs impact (y) -->
\`\`\`
`;
```

---

## Phase 4: Update TODO Parser

**File: `src/services/ai/sectionAnalyzer.ts`**

### 4a. Update `inferDiagramTypeFromTodo()` return type and add new bracketed patterns (around line 175):

```typescript
function inferDiagramTypeFromTodo(todoComments: string[]):
  'block' | 'sequence' | 'flow' | 'state' | 'class' | 'er' | 'gantt' |
  'pie' | 'quadrant' | 'mindmap' | 'timeline' | 'c4' | null {

  if (!todoComments || todoComments.length === 0) return null;

  const combinedTodos = todoComments.join(' ');

  // HIGHEST PRIORITY: Check for explicit bracketed format [DIAGRAM TYPE]
  // Existing
  if (/\[BLOCK\s+DIAGRAM\]/i.test(combinedTodos)) return 'block';
  if (/\[SEQUENCE\s+DIAGRAM\]/i.test(combinedTodos)) return 'sequence';
  if (/\[FLOW\s+DIAGRAM\]/i.test(combinedTodos)) return 'flow';
  if (/\[STATE\s+DIAGRAM\]/i.test(combinedTodos)) return 'state';

  // NEW: Additional bracketed formats
  if (/\[CLASS\s+DIAGRAM\]/i.test(combinedTodos)) return 'class';
  if (/\[ER\s+DIAGRAM\]/i.test(combinedTodos)) return 'er';
  if (/\[GANTT\s+(CHART|DIAGRAM)\]/i.test(combinedTodos)) return 'gantt';
  if (/\[PIE\s+(CHART|DIAGRAM)\]/i.test(combinedTodos)) return 'pie';
  if (/\[QUADRANT\s+(CHART|DIAGRAM)\]/i.test(combinedTodos)) return 'quadrant';
  if (/\[MINDMAP\]/i.test(combinedTodos)) return 'mindmap';
  if (/\[TIMELINE\]/i.test(combinedTodos)) return 'timeline';
  if (/\[C4\s+(DIAGRAM|CONTEXT|CONTAINER|COMPONENT)\]/i.test(combinedTodos)) return 'c4';

  // ... existing natural language fallback patterns ...

  return null;
}
```

### 4b. Update `SectionAnalysis` interface `diagramType` (line 15):

```typescript
diagramType: 'block' | 'sequence' | 'flow' | 'state' | 'class' | 'er' |
             'gantt' | 'pie' | 'quadrant' | 'mindmap' | 'timeline' | 'c4' |
             'multiple' | 'none';
```

### 4c. Update `figureTypes` map type (line 22):

```typescript
figureTypes?: Record<string, 'block' | 'sequence' | 'flow' | 'state' | 'class' |
                              'er' | 'gantt' | 'pie' | 'quadrant' | 'mindmap' |
                              'timeline' | 'c4'>;
```

### 4d. Update `getMermaidFigureRefs()` to include new types (line 698):

```typescript
export function getMermaidFigureRefs(section: SectionAnalysis): string[] {
  if (!section.figureReferences) return [];

  if (section.figureTypes) {
    // Return figures that are NOT block diagrams (all Mermaid types)
    return section.figureReferences.filter(ref => {
      const type = section.figureTypes![ref];
      return type !== 'block'; // Everything except 'block' is Mermaid
    });
  }

  // Fallback: if section is NOT a block type, return all figures
  if (section.diagramType !== 'block' && section.diagramType !== 'none') {
    return section.figureReferences;
  }

  return [];
}
```

---

## Phase 5: Update Unified Mermaid Prompt

**File: `src/services/ai/prompts/diagramPrompts.ts`**

Update `buildUnifiedMermaidPrompt()` (around line 296):

```typescript
export function buildUnifiedMermaidPrompt(
  description: string,
  title: string,
  figureNumber?: string,
  userGuidance?: string
): string {
  const docs = getMermaidDocs();
  const docsVersion = docs.version;

  const basePrompt = `Generate a Mermaid diagram based on the following description.
Choose the most appropriate diagram type based on the content:

**Flows & Behavior:**
- **Sequence Diagram**: Message flows, call sequences, protocol interactions, signaling
- **Flowchart**: Algorithms, decision trees, process flows, conditional logic
- **State Diagram**: State machines, transitions, lifecycle states

**Structure & Relationships:**
- **Class Diagram**: OOP structures, class relationships, inheritance hierarchies
- **ER Diagram**: Entity relationships, data models, database schemas
- **C4 Diagram**: Software architecture (Context, Container, Component levels)

**Hierarchies & Concepts:**
- **Mindmap**: Concept hierarchies, feature breakdowns, brainstorming structures

**Planning & Time:**
- **Gantt Chart**: Project timelines, phases, schedules, dependencies
- **Timeline**: Sequential events, milestones, historical evolution

**Data Visualization:**
- **Pie Chart**: Proportional data, percentage distribution
- **Quadrant Chart**: 2D comparisons, priority matrices (like BCG matrix)

Description: ${description}
Title: ${title}
${figureNumber ? \`Figure Number: \${figureNumber}\` : ''}

Read the description and any TODO comments carefully to determine the best diagram type.

**OUTPUT REQUIREMENTS:**
1. Output valid Mermaid syntax wrapped in \`\`\`mermaid ... \`\`\`
2. First line MUST be the diagram type declaration:
   - \`sequenceDiagram\` for sequence diagrams
   - \`flowchart TD\` (or LR) for flowcharts
   - \`stateDiagram-v2\` for state diagrams
   - \`classDiagram\` for class diagrams
   - \`erDiagram\` for ER diagrams
   - \`gantt\` for Gantt charts
   - \`pie\` for pie charts
   - \`mindmap\` for mindmaps
   - \`timeline\` for timelines
   - \`quadrantChart\` for quadrant charts
   - \`C4Context\` / \`C4Container\` / \`C4Component\` for C4 diagrams
3. Keep labels concise - no newlines in labels
4. Use valid identifiers (alphanumeric and underscores only)

Now generate the most appropriate Mermaid diagram for the description provided.`;

  return appendUserGuidance(basePrompt, userGuidance);
}
```

---

## Phase 6: Create Shared Type Definition (Optional Refactor)

To avoid maintaining the same union in multiple places, consider creating a shared type:

**File: `src/types/index.ts`**

```typescript
// All supported Mermaid diagram types
export type MermaidDiagramType =
  | 'sequence'
  | 'flow'
  | 'state'
  | 'class'
  | 'er'
  | 'gantt'
  | 'pie'
  | 'quadrant'
  | 'mindmap'
  | 'timeline'
  | 'c4'
  | 'sankey'
  | 'xy'
  | 'block-beta'
  | 'architecture'
  | 'requirement'
  | 'gitgraph';

// All diagram types including custom block
export type DiagramType = 'block' | MermaidDiagramType;

// For section analysis (includes meta-types)
export type SectionDiagramType = DiagramType | 'multiple' | 'none';
```

Then import and use these types throughout.

---

## Implementation Summary

| File | Status | Changes |
|------|--------|---------|
| `src/types/index.ts` | ✅ Done | Added all 23 `MermaidDiagramType` values with comments |
| `src/services/ai/parsers/mermaidParser.ts` | ✅ Done | Updated `detectMermaidType()`, `fixMermaidSyntax()`, `validateMermaidSyntax()` |
| `src/services/ai/prompts/sectionPrompts.ts` | ✅ Done | Updated `DIAGRAM_PLACEHOLDER_REQUIREMENTS` with all types |
| `src/services/ai/prompts/diagramPrompts.ts` | ✅ Done | Updated `buildUnifiedMermaidPrompt()` with all diagram options |
| `src/services/ai/sectionAnalyzer.ts` | ✅ Done | Updated `inferDiagramTypeFromTodo()`, `typeBreakdown` initialization |

---

## Testing Checklist

1. [ ] Generate a spec with TODO comments for new diagram types (ER, Gantt, Mindmap, etc.)
2. [ ] Verify TODO comments are parsed correctly (check console logs for type detection)
3. [ ] Generate diagrams and verify correct Mermaid type is produced
4. [ ] Test each new diagram type renders in the Mermaid preview
5. [ ] Test edge cases:
   - Missing TODO comment (should fallback to heuristics)
   - Ambiguous content (AI should pick reasonable type)
   - Multiple diagram types in same section
6. [ ] Verify block diagrams still work (no regression)
7. [ ] Test the "detected type: unknown" fix for code fence stripping

---

## Notes

- All 23 Mermaid diagram types are now supported (as of Mermaid v11)
- The AI models (GPT-4, Claude, etc.) already know Mermaid syntax well
- Some types use `-beta` suffix in their declarations (xychart-beta, sankey-beta, etc.)
- The key insight: let the AI decide based on the TODO description rather than complex pattern matching

## Sources

- [Mermaid Diagram Syntax Reference](https://mermaid.js.org/intro/syntax-reference.html)
- [Mermaid Examples](https://mermaid.js.org/syntax/examples.html)
