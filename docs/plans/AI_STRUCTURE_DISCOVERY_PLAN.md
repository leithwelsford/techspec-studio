# AI-Assisted Structure Discovery Workflow

**Status**: Planned
**Created**: 2025-12-15
**Priority**: High - Core workflow enhancement

---

## Overview

Replace the current template-first workflow with an AI-assisted structure discovery approach where the AI analyzes inputs and proposes document structure, which users refine through conversation before generation.

## User Requirements

### Desired Workflow
```
1. Upload BRS + References + Guiding Prompt
         ↓
2. Click "Plan Structure"
         ↓
3. AI analyzes content → proposes document structure + infers domain
         ↓
4. Chat to refine structure (add/remove/reorder sections)
         ↓
5. Approve structure
         ↓
6. Generate full spec
         ↓
7. Review generated content
         ↓
8. REVISE:
   - Direct edit in MarkdownEditor
   - Select text → "Refine Selection" → AI improves
   - Click section → "Regenerate" → AI rewrites with guidance
   - Chat: "make section 4 more detailed"
   - Chat: "revise entire doc to use passive voice"
         ↓
9. Approve final version
         ↓
10. Export to DOCX
```

### Key Requirements
1. **AI-driven structure proposal** - AI analyzes BRS, references, and user guidance to suggest sections
2. **Conversational iteration** - Chat interface to refine structure before generation
3. **Domain inference** - AI infers domain from content (user can override via chat)
4. **Manual control** - User can explicitly add/remove/modify sections
5. **Generate once approved** - Full spec generation after structure is agreed
6. **Post-generation revision** - Revise selected text, sections, or entire document via chat

---

## Current State vs Desired State

| Aspect | Current | Desired |
|--------|---------|---------|
| Starting point | Select template | AI proposes structure |
| Structure source | Predefined templates | AI analysis + user input |
| Domain config | Template-bound | AI-inferred, user-overridable |
| User interaction | Modal-based customization | Chat-based iteration |
| Section editing | After template selection | Before and during planning |
| Generation trigger | After template setup | After structure approval |

---

## Implementation Approach

### Architecture Decision: Dedicated Modal with Integrated Chat

Create a new `StructureDiscoveryModal.tsx` - a dedicated modal for the structure planning workflow that embeds a specialized chat interface.

**Rationale:**
- Follows existing pattern (GenerateSpecModal is modal-based)
- Focused workflow with clear start/end
- Side-by-side structure visualization and chat
- Doesn't disrupt main ChatPanel

### Coexistence with Templates

Both workflows will coexist:
- **"Plan Structure"** (new) - AI-assisted structure discovery
- **"Generate Spec"** (existing) - Template-based generation

Users can also use templates as starting points for AI enhancement.

---

## New Types (src/types/index.ts)

```typescript
interface ProposedStructure {
  id: string;
  sections: ProposedSection[];
  domainConfig: DomainConfig;
  formatGuidance: string;
  rationale: string;
  version: number;
}

interface ProposedSection {
  id: string;
  title: string;
  description: string;
  rationale: string;
  suggestedSubsections: string[];
  order: number;
  confidence: number;
}

interface DomainInference {
  domain: string;
  industry: string;
  confidence: number;
  reasoning: string;
  detectedStandards: string[];
  suggestedTerminology: Record<string, string>;
}

interface StructurePlanningState {
  isPlanning: boolean;
  proposedStructure: ProposedStructure | null;
  structureVersions: ProposedStructure[];
  inferredDomain: DomainInference | null;
  domainOverride: DomainConfig | null;
  planningChatHistory: AIMessage[];
  structureApproved: boolean;
}
```

---

## New Store Actions (src/store/projectStore.ts)

```typescript
// Planning session
startPlanningSession: () => void;
endPlanningSession: () => void;

// Structure management
setProposedStructure: (structure: ProposedStructure) => void;
updateProposedSection: (sectionId: string, updates: Partial<ProposedSection>) => void;
addProposedSection: (section: ProposedSection) => void;
removeProposedSection: (sectionId: string) => void;
reorderProposedSections: (sectionIds: string[]) => void;

// Domain management
setInferredDomain: (inference: DomainInference) => void;
setDomainOverride: (config: DomainConfig | null) => void;

// Chat & approval
addPlanningMessage: (message: AIMessage) => void;
approveStructure: () => void;
convertStructureToTemplateConfig: () => ProjectTemplateConfig;

// Post-generation revision
regenerateSection: (sectionId: string, guidance: string) => Promise<void>;
reviseDocument: (guidance: string) => Promise<void>;
```

---

## New AI Service Methods (src/services/ai/AIService.ts)

```typescript
// Analyze BRS + references + guidance → propose structure
async analyzeAndProposeStructure(params: {
  brsContent: string;
  referenceDocuments: ReferenceDocument[];
  userGuidance: string;
}): Promise<{
  proposedStructure: ProposedStructure;
  domainInference: DomainInference;
}>

// Process chat refinement → update structure
async processStructureRefinement(params: {
  currentStructure: ProposedStructure;
  chatHistory: AIMessage[];
  userMessage: string;
}): Promise<{
  updatedStructure: ProposedStructure | null;
  response: string;
  structureChanges: StructureChange[];
}>

// Generate from approved structure
async generateSpecificationFromStructure(params: {
  approvedStructure: ProposedStructure;
  brsDocument: BRSDocument;
  references: ReferenceDocument[];
}): Promise<GeneratedSection[]>
```

---

## New Components

```
src/components/ai/
├── StructureDiscoveryModal.tsx    # Main modal (steps: input → analyzing → refining → approved)
├── StructureProposalView.tsx      # Visual structure display with drag-drop
├── StructureChatPanel.tsx         # Embedded chat for refinement
├── SectionCard.tsx                # Individual section display/edit
└── DomainOverridePanel.tsx        # Domain customization UI
```

---

## New Prompts (src/services/ai/prompts/structurePrompts.ts)

1. **buildStructureProposalPrompt** - Analyze inputs, infer domain, propose sections
2. **buildStructureRefinementPrompt** - Process chat requests, return updated structure

---

## UI Flow

### Step 1: Entry Point
- New "Plan Structure" button in Workspace header (next to "Generate Spec")
- Enabled when: BRS uploaded AND AI configured

### Step 2: Input Collection
- Shows BRS summary, reference docs list
- Text area for guiding prompt
- Optional: select template as starting point
- "Analyze & Propose" button

### Step 3: Analysis (Loading)
- Progress: "Analyzing requirements...", "Detecting domain...", "Proposing structure..."

### Step 4: Structure Review & Chat (Split View)
- **Left panel**: Visual structure
  - Sections with title, description, rationale, confidence
  - Drag-drop reordering
  - Inline edit, add/remove buttons
- **Right panel**: Chat interface
  - AI explains structure
  - User requests changes naturally
  - Structure updates in real-time
- **Top**: Domain inference with override option

### Step 5: Approval
- "Approve & Generate" button
- Converts structure to ProjectTemplateConfig
- Triggers generation

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add ProposedStructure, ProposedSection, DomainInference, StructurePlanningState types |
| `src/store/projectStore.ts` | Add structurePlanning state slice and actions |
| `src/services/ai/AIService.ts` | Add analyzeAndProposeStructure(), processStructureRefinement() methods |
| `src/components/Workspace.tsx` | Add "Plan Structure" button, wire up modal |

## Files to Create

| File | Purpose |
|------|---------|
| `src/services/ai/prompts/structurePrompts.ts` | Structure proposal and refinement prompts |
| `src/components/ai/StructureDiscoveryModal.tsx` | Main modal container |
| `src/components/ai/StructureProposalView.tsx` | Visual structure display |
| `src/components/ai/StructureChatPanel.tsx` | Embedded chat for refinement |
| `src/components/ai/SectionCard.tsx` | Individual section card component |
| `src/components/ai/DomainOverridePanel.tsx` | Domain customization UI |

---

## Implementation Sequence

1. **Types** - Add new interfaces to types/index.ts
2. **Store** - Add structurePlanning slice to projectStore.ts
3. **Prompts** - Create structurePrompts.ts with proposal/refinement prompts
4. **AI Service** - Add new methods to AIService.ts
5. **Components** - Build UI components (modal, views, chat)
6. **Integration** - Add button to Workspace, wire everything up
7. **Revision Features** - Enhance post-generation revision capabilities

---

## Post-Generation Revision Workflow

After the spec is generated, users need to be able to revise content via:

### 1. Direct Editing (Already Exists)
- MarkdownEditor allows manual text editing
- Changes auto-save to store

### 2. AI-Assisted Revision (Enhance Existing)

| Revision Type | Current State | Enhancement Needed |
|--------------|---------------|-------------------|
| **Selected text** | "Refine Selection" button exists | Ensure works with new workflow |
| **Single section** | Partial support | Add "Regenerate Section" with chat context |
| **Entire document** | Not supported | Add "Revise Document" option |

### Revision via Chat
After generation, the main ChatPanel should:
- Have context of the generated spec
- Allow commands like "revise section 3 to be more technical"
- Allow "regenerate the architecture section based on [new guidance]"
- Support "make the whole document more concise"

### UI Enhancements
- **Section headers**: Add "Regenerate" button on each section in preview
- **Chat context**: After generation, chat automatically has spec context
- **Revision history**: Track revisions in version history (existing)

---

## Estimated Scope

- ~6-8 new/modified files
- ~1500-2000 lines of new code
- Additive change (no breaking changes to existing workflow)
- Post-generation revision enhances existing refinement features

---

## Reference Files

Key existing files to reference during implementation:

- `src/components/ai/GenerateSpecModal.tsx` - Pattern for multi-step modal
- `src/components/ai/ChatPanel.tsx` - Existing chat implementation
- `src/components/ai/SectionComposer.tsx` - Drag-drop section management with @dnd-kit
- `src/services/ai/prompts/sectionPrompts.ts` - Flexible prompt building patterns
- `src/data/templates/` - Template structure and domain config patterns
