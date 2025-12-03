# Implementation Plan: Dynamic Section Numbering & Full Section Customization

## Overview

This plan transforms the rigid template system into a flexible, user-customizable section system with:
1. **Dynamic section numbering** that updates when sections are reordered
2. **Editable section descriptions** showing the prompt that guides AI generation
3. **Custom sections** users can add with their own titles and descriptions

---

## Problem Statement

### Current Issues

1. **Section numbers are hardcoded** in templates (e.g., `number: '5'`) and don't update when users reorder sections
2. **Section prompts are hardcoded** to specific prompt builder functions via `promptKey`, meaning:
   - Renaming a section doesn't change what content is generated
   - Users can't see or modify the underlying prompt/description that guides AI generation
3. **No custom sections** - users can only enable/disable template-defined sections

### User Requirements

1. **Dynamic Numbering**: When sections are reordered, numbers should update automatically (1, 2, 3... based on position)
2. **Flexible Section Definitions**:
   - Rename sections (AI adapts content to new title)
   - Edit section descriptions (show current hardcoded prompt, allow modification)
   - Add custom sections with user-defined titles and descriptions

---

## Phase E.1: Dynamic Section Numbering

### Current State

**Template Definition** (`src/data/templates/3gpp.ts`):
```typescript
sections: [
  { id: 'scope', number: '1', title: 'Scope', promptKey: 'build3GPPScopePrompt', ... },
  { id: 'non-functional', number: '5', title: 'Non-Functional Requirements', ... },
  { id: 'architecture-design', number: '4', title: 'Solution Architecture and Design', ... },
]
```

**Problem**: `number` is static. Reordering via drag-and-drop doesn't change it.

### Implementation

#### Step 1: Remove static `number` from templates

**File: `src/types/index.ts`**

Update `TemplateSectionDefinition`:
```typescript
interface TemplateSectionDefinition {
  id: string;
  title: string;
  // REMOVE: number: string;  // Static number - DEPRECATED
  promptKey?: string;  // Optional - legacy prompt builder
  description: string;  // What this section should contain
  required?: boolean;
  defaultEnabled?: boolean;
  allowSubsections?: boolean;
}
```

#### Step 2: Calculate section number dynamically

**File: `src/services/ai/AIService.ts`**

In `generateSpecificationFromTemplate()`:
```typescript
// Get enabled sections in user's order
const orderedSectionIds = config.sectionOrder.filter(id => config.enabledSections.includes(id));

for (let i = 0; i < orderedSectionIds.length; i++) {
  const section = template.sections.find(s => s.id === orderedSectionIds[i]);

  // DYNAMIC NUMBERING: Position-based, not template-based
  const sectionNumber = i + 1;  // 1, 2, 3, etc.
  const sectionTitle = `${sectionNumber}. ${section.title}`;

  // Pass dynamic number to prompt builder
  const promptContext = {
    sectionNumber,
    sectionTitle: section.title,
    ...
  };
}
```

#### Step 3: Update prompt builders to use dynamic number

**File: `src/services/ai/prompts/sectionPrompts.ts`**

```typescript
function buildFlexibleSectionPrompt(
  section: FlexibleSection,
  context: FlexibleSectionContext
): string {
  // Use the dynamic section number from context, not a hardcoded value
  const sectionHeading = `# ${context.sectionNumber}. ${section.title}`;

  return `
Generate the following section for a technical specification:

${sectionHeading}

**What this section should cover:**
${section.description}

${section.contentGuidance ? `**Additional guidance:**\n${section.contentGuidance}` : ''}

...
`;
}
```

#### Step 4: Update legacy prompt builders

**File: `src/services/ai/prompts/legacyTelecomPrompts.ts`**

Modify all `build3GPP*` functions to accept dynamic section number:
```typescript
// BEFORE
export function buildNonFunctionalRequirementsPrompt(
  brsAnalysis: any,
  userGuidance?: string
): string {
  const basePrompt = `Generate Section 5 (Non-Functional Requirements)...`;  // HARDCODED
  ...
}

// AFTER
export function buildNonFunctionalRequirementsPrompt(
  brsAnalysis: any,
  context: { sectionNumber: number; ... },
  userGuidance?: string
): string {
  const basePrompt = `Generate Section ${context.sectionNumber} (Non-Functional Requirements)...`;
  ...
}
```

#### Step 5: Update templates - remove hardcoded numbers

**File: `src/data/templates/3gpp.ts`** (and other templates)

```typescript
// BEFORE
{ id: 'scope', number: '1', title: 'Scope', ... }

// AFTER
{ id: 'scope', title: 'Scope', ... }  // No number field
```

---

## Phase E.2: Editable Section Descriptions

### Current State

- Sections have a `promptKey` that maps to a hardcoded prompt builder function
- Users can't see what instructions guide AI generation for each section
- Changing section title doesn't change what content is generated

### Implementation

#### Step 1: Add `defaultDescription` to template sections

Each section stores its default prompt/description that users can see and modify.

**File: `src/types/index.ts`**

```typescript
interface TemplateSectionDefinition {
  id: string;
  title: string;
  promptKey?: string;  // Legacy - used if no custom description

  // NEW: User-visible and editable description
  defaultDescription: string;  // The default prompt guidance (extracted from legacy prompts)

  required?: boolean;
  defaultEnabled?: boolean;
  allowSubsections?: boolean;
}
```

**File: `src/types/index.ts`** - User's customization:

```typescript
interface ProjectTemplateConfig {
  templateId: string;
  enabledSections: string[];
  sectionOrder: string[];
  customGuidance: string;

  // NEW: Per-section customizations
  sectionOverrides?: Record<string, {
    customTitle?: string;      // If set, overrides template title
    customDescription?: string; // If set, overrides defaultDescription
  }>;
}
```

#### Step 2: Extract default descriptions from legacy prompts

Create readable descriptions from existing hardcoded prompts.

**File: `src/data/templates/3gpp.ts`**

```typescript
sections: [
  {
    id: 'scope',
    title: 'Scope',
    promptKey: 'build3GPPScopePrompt',  // Keep for backward compat
    defaultDescription: `Define the boundaries and objectives of this specification.

**Required content:**
- Purpose statement explaining what this specification defines
- Applicability describing target systems and use cases
- Exclusions listing what is explicitly out of scope
- Document structure overview

**Format guidance:**
- Use RFC 2119 normative language (SHALL, SHOULD, MAY)
- Reference related specifications using {{ref:...}} syntax
- Keep scope focused - broader context belongs in Introduction`,
    required: true,
    defaultEnabled: true,
  },
  {
    id: 'non-functional',
    title: 'Non-Functional Requirements',
    promptKey: 'buildNonFunctionalRequirementsPrompt',
    defaultDescription: `Specify non-functional requirements in a structured table format.

**Required content:**
| Category | Parameter | Requirement | Source |
|----------|-----------|-------------|--------|
| Performance | Throughput | ... | BRS §X |
| Performance | Latency | ... | BRS §Y |
| Availability | Uptime | ... | BRS §Z |
| Security | Authentication | ... | BRS §W |
| Scalability | Growth capacity | ... | BRS §V |

**Each row must include:**
- Measurable requirement (not vague like "high performance")
- BRS source reference
- Units and thresholds where applicable`,
    defaultEnabled: true,
  },
  // ... more sections with extracted descriptions
]
```

#### Step 3: Update SectionComposer UI

**File: `src/components/ai/SectionComposer.tsx`**

Add editing capabilities:

```typescript
interface SectionItemProps {
  section: TemplateSectionDefinition;
  isEnabled: boolean;
  position: number;
  override?: { customTitle?: string; customDescription?: string };
  onToggle: () => void;
  onUpdateOverride: (override: { customTitle?: string; customDescription?: string }) => void;
}

function SectionItem({ section, isEnabled, position, override, onToggle, onUpdateOverride }: SectionItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);

  // Display title - custom or default
  const displayTitle = override?.customTitle || section.title;

  // Display description - custom or default
  const displayDescription = override?.customDescription || section.defaultDescription;

  return (
    <div className="border rounded-lg p-3">
      {/* Header row with drag handle, checkbox, title */}
      <div className="flex items-center gap-2">
        <DragHandle />
        <Checkbox checked={isEnabled} onChange={onToggle} />

        {/* Dynamic number based on position */}
        <span className="text-gray-500 font-mono w-6">{position + 1}.</span>

        {/* Editable title */}
        {editingTitle ? (
          <input
            value={override?.customTitle ?? section.title}
            onChange={(e) => onUpdateOverride({ ...override, customTitle: e.target.value })}
            onBlur={() => setEditingTitle(false)}
            className="flex-1 border rounded px-2"
            autoFocus
          />
        ) : (
          <span
            className="flex-1 cursor-pointer hover:bg-gray-100 rounded px-2"
            onClick={() => setEditingTitle(true)}
          >
            {displayTitle}
            {override?.customTitle && <span className="text-xs text-blue-500 ml-2">(customized)</span>}
          </span>
        )}

        {/* Expand/collapse button */}
        <button onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? '▼' : '▶'} Edit Description
        </button>
      </div>

      {/* Expanded: Show editable description */}
      {isExpanded && (
        <div className="mt-3 pl-8">
          <label className="text-sm font-medium text-gray-700">
            Section Description / AI Guidance
            {override?.customDescription && (
              <button
                className="text-xs text-red-500 ml-2"
                onClick={() => onUpdateOverride({ ...override, customDescription: undefined })}
              >
                Reset to default
              </button>
            )}
          </label>
          <textarea
            value={displayDescription}
            onChange={(e) => onUpdateOverride({ ...override, customDescription: e.target.value })}
            className="w-full h-48 mt-1 p-2 border rounded font-mono text-sm"
            placeholder="Describe what this section should contain..."
          />
          <p className="text-xs text-gray-500 mt-1">
            This description guides the AI when generating content for this section.
            Modify it to change what content is produced.
          </p>
        </div>
      )}
    </div>
  );
}
```

#### Step 4: Update store actions

**File: `src/store/projectStore.ts`**

Add action for section overrides:
```typescript
updateSectionOverride: (sectionId: string, override: { customTitle?: string; customDescription?: string }) => {
  set(state => ({
    activeTemplateConfig: state.activeTemplateConfig ? {
      ...state.activeTemplateConfig,
      sectionOverrides: {
        ...state.activeTemplateConfig.sectionOverrides,
        [sectionId]: override,
      }
    } : null
  }));
},

clearSectionOverride: (sectionId: string) => {
  set(state => {
    if (!state.activeTemplateConfig) return state;
    const { [sectionId]: _, ...remaining } = state.activeTemplateConfig.sectionOverrides || {};
    return {
      activeTemplateConfig: {
        ...state.activeTemplateConfig,
        sectionOverrides: remaining,
      }
    };
  });
},
```

#### Step 5: Use custom descriptions in generation

**File: `src/services/ai/AIService.ts`**

```typescript
// In generateSpecificationFromTemplate()
for (let i = 0; i < orderedSectionIds.length; i++) {
  const sectionId = orderedSectionIds[i];
  const templateSection = template.sections.find(s => s.id === sectionId);
  const override = config.sectionOverrides?.[sectionId];

  // Build effective section with overrides applied
  const effectiveSection: FlexibleSection = {
    id: sectionId,
    title: override?.customTitle || templateSection.title,
    description: override?.customDescription || templateSection.defaultDescription,
    order: i + 1,  // Dynamic numbering
  };

  // Use flexible prompt builder (not legacy) when custom description exists
  if (override?.customDescription) {
    const prompt = buildFlexibleSectionPrompt(effectiveSection, context);
    // ... generate
  } else if (templateSection.promptKey) {
    // Legacy path for backward compatibility
    const legacyBuilder = legacyPromptBuilders[templateSection.promptKey];
    // ... generate
  }
}
```

---

## Phase E.3: Custom Sections

### Implementation

#### Step 1: Add "Add Custom Section" button to SectionComposer

**File: `src/components/ai/SectionComposer.tsx`**

```typescript
function SectionComposer({ template }: Props) {
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionDescription, setNewSectionDescription] = useState('');

  const addCustomSection = useProjectStore(state => state.addCustomSection);

  const handleAddSection = () => {
    if (!newSectionTitle.trim()) return;

    const customId = `custom-${Date.now()}`;
    addCustomSection({
      id: customId,
      title: newSectionTitle,
      description: newSectionDescription || `Generate content for the "${newSectionTitle}" section based on the business requirements.`,
      isCustom: true,
    });

    setNewSectionTitle('');
    setNewSectionDescription('');
    setShowAddSection(false);
  };

  return (
    <div>
      {/* Existing section list */}
      <SortableContext items={sectionIds}>
        {sections.map((section, index) => (
          <SectionItem key={section.id} section={section} position={index} ... />
        ))}
      </SortableContext>

      {/* Add Custom Section */}
      {showAddSection ? (
        <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 mt-4">
          <h4 className="font-medium mb-2">Add Custom Section</h4>

          <input
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            placeholder="Section title (e.g., 'Security Considerations')"
            className="w-full border rounded px-3 py-2 mb-2"
          />

          <textarea
            value={newSectionDescription}
            onChange={(e) => setNewSectionDescription(e.target.value)}
            placeholder="Describe what this section should contain. This guides the AI generation."
            className="w-full h-32 border rounded px-3 py-2 mb-2"
          />

          <div className="flex gap-2">
            <button onClick={handleAddSection} className="bg-blue-500 text-white px-4 py-2 rounded">
              Add Section
            </button>
            <button onClick={() => setShowAddSection(false)} className="border px-4 py-2 rounded">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddSection(true)}
          className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 mt-4 text-gray-500 hover:border-blue-400 hover:text-blue-500"
        >
          + Add Custom Section
        </button>
      )}
    </div>
  );
}
```

#### Step 2: Update types for custom sections

**File: `src/types/index.ts`**

```typescript
interface CustomSection {
  id: string;  // Format: "custom-{timestamp}"
  title: string;
  description: string;
  isCustom: true;  // Discriminator
}

interface ProjectTemplateConfig {
  templateId: string;
  enabledSections: string[];
  sectionOrder: string[];  // Includes both template and custom section IDs
  customGuidance: string;
  sectionOverrides?: Record<string, { customTitle?: string; customDescription?: string }>;

  // NEW: Custom sections added by user
  customSections?: CustomSection[];
}
```

#### Step 3: Update store actions

**File: `src/store/projectStore.ts`**

```typescript
addCustomSection: (section: CustomSection) => {
  set(state => {
    if (!state.activeTemplateConfig) return state;
    return {
      activeTemplateConfig: {
        ...state.activeTemplateConfig,
        customSections: [...(state.activeTemplateConfig.customSections || []), section],
        enabledSections: [...state.activeTemplateConfig.enabledSections, section.id],
        sectionOrder: [...state.activeTemplateConfig.sectionOrder, section.id],
      }
    };
  });
},

removeCustomSection: (sectionId: string) => {
  set(state => {
    if (!state.activeTemplateConfig) return state;
    return {
      activeTemplateConfig: {
        ...state.activeTemplateConfig,
        customSections: state.activeTemplateConfig.customSections?.filter(s => s.id !== sectionId),
        enabledSections: state.activeTemplateConfig.enabledSections.filter(id => id !== sectionId),
        sectionOrder: state.activeTemplateConfig.sectionOrder.filter(id => id !== sectionId),
      }
    };
  });
},
```

#### Step 4: Update generation to include custom sections

**File: `src/services/ai/AIService.ts`**

```typescript
// In generateSpecificationFromTemplate()

// Merge template sections with custom sections
const allSections = [
  ...template.sections.map(s => ({ ...s, isCustom: false })),
  ...(config.customSections || []).map(s => ({ ...s, isCustom: true })),
];

for (let i = 0; i < orderedSectionIds.length; i++) {
  const sectionId = orderedSectionIds[i];
  const section = allSections.find(s => s.id === sectionId);

  if (!section) continue;

  const effectiveSection: FlexibleSection = {
    id: sectionId,
    title: config.sectionOverrides?.[sectionId]?.customTitle || section.title,
    description: config.sectionOverrides?.[sectionId]?.customDescription || section.description || section.defaultDescription,
    order: i + 1,
  };

  // Custom sections always use flexible prompt builder
  if (section.isCustom) {
    const prompt = buildFlexibleSectionPrompt(effectiveSection, context);
    // ... generate
  } else if (section.promptKey && !config.sectionOverrides?.[sectionId]?.customDescription) {
    // Legacy path for unmodified template sections
    // ... use legacy builder
  } else {
    // Modified template section - use flexible builder
    const prompt = buildFlexibleSectionPrompt(effectiveSection, context);
    // ... generate
  }
}
```

---

## Implementation Order

| Phase | Task | Estimated Time |
|-------|------|----------------|
| E.1.1 | Remove `number` from `TemplateSectionDefinition` type | 15 min |
| E.1.2 | Update `AIService.ts` to calculate dynamic numbers | 30 min |
| E.1.3 | Update legacy prompt builders to accept dynamic number | 45 min |
| E.1.4 | Update all template files to remove hardcoded numbers | 20 min |
| E.1.5 | Update `SectionComposer` to display dynamic numbers | 15 min |
| **E.1** | **Subtotal: Dynamic Numbering** | **~2 hours** |
| E.2.1 | Add `defaultDescription` to `TemplateSectionDefinition` | 15 min |
| E.2.2 | Extract descriptions from legacy prompts into templates | 1 hour |
| E.2.3 | Add `sectionOverrides` to `ProjectTemplateConfig` | 15 min |
| E.2.4 | Add store actions for overrides | 30 min |
| E.2.5 | Update `SectionComposer` UI with expandable description editor | 1 hour |
| E.2.6 | Update `AIService.ts` to use custom descriptions | 30 min |
| **E.2** | **Subtotal: Editable Descriptions** | **~3.5 hours** |
| E.3.1 | Add `CustomSection` type and update `ProjectTemplateConfig` | 15 min |
| E.3.2 | Add store actions for custom sections | 20 min |
| E.3.3 | Add "Add Custom Section" UI to `SectionComposer` | 45 min |
| E.3.4 | Update `AIService.ts` to generate custom sections | 30 min |
| E.3.5 | Add delete button for custom sections | 15 min |
| **E.3** | **Subtotal: Custom Sections** | **~2 hours** |
| | **Total Estimated Time** | **~7.5 hours** |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/index.ts` | Remove `number` from section type, add `defaultDescription`, `sectionOverrides`, `CustomSection` |
| `src/data/templates/3gpp.ts` | Remove hardcoded numbers, add `defaultDescription` to all sections |
| `src/data/templates/ieee830.ts` | Same as above |
| `src/data/templates/iso29148.ts` | Same as above |
| `src/store/projectStore.ts` | Add actions: `updateSectionOverride`, `clearSectionOverride`, `addCustomSection`, `removeCustomSection` |
| `src/components/ai/SectionComposer.tsx` | Major UI update: editable titles, expandable descriptions, add custom sections |
| `src/components/ai/SectionItem.tsx` | Update to show dynamic number, editable title, expand/collapse description |
| `src/services/ai/AIService.ts` | Dynamic numbering, use custom descriptions, generate custom sections |
| `src/services/ai/prompts/sectionPrompts.ts` | Accept dynamic section number in context |
| `src/services/ai/prompts/legacyTelecomPrompts.ts` | Update all builders to accept dynamic section number |

---

## Testing Checklist

- [ ] Reorder sections → numbers update correctly (1, 2, 3...)
- [ ] Disable middle section → remaining sections renumber (no gaps)
- [ ] Edit section title → AI generates content matching new title
- [ ] Edit section description → AI follows new guidance
- [ ] Reset description to default → reverts to original behavior
- [ ] Add custom section → appears in list, can be reordered
- [ ] Delete custom section → removed from list and order
- [ ] Generate spec with mix of template + custom sections → all generate correctly
- [ ] Backward compatibility: specs generated before this change still work

---

## Key Architectural Decisions

1. **Dynamic numbering is position-based**: Section numbers are calculated as `index + 1` during generation, not stored in templates
2. **Descriptions are user-visible prompts**: The `defaultDescription` field contains the actual guidance given to the AI, making it transparent and editable
3. **Legacy support via promptKey**: Existing `promptKey` mappings continue to work for backward compatibility
4. **Custom sections use flexible prompts**: All custom sections route through `buildFlexibleSectionPrompt()`, not legacy builders
5. **Overrides are separate from templates**: User customizations stored in `sectionOverrides` don't modify the original template
