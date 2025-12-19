# Requirement Numbering Implementation Plan

> **Self-contained document for implementation in a separate context window**

## Overview

Add inline requirement numbering to generated specifications using the format:
```
<SUBSYSTEM>-<FEATURE>-<ARTEFACT>-<NNNNN>
```

**Example**: `PCC-CAPTIVE-REQ-00001: The system SHALL authenticate users via RADIUS`

## User Requirements

- **SUBSYSTEM**: Major system block (PCC, AAA, WLAN, BNG, PCRF, OCS)
- **FEATURE**: Functional slice (CAPTIVE, EAPSIM, ACCOUNTING, QOS, CHARGING)
- **ARTEFACT**: REQ, FR, NFR, INT, CFG, TST, SEC, RISK
- **NNNNN**: 5-digit zero-padded counter
- **Scope**: Any section with normative language (SHALL/SHOULD/MAY)
- **Generation**: Inline IDs - AI infers SUBSYSTEM/FEATURE from BRS context

---

## Design Approach: AI-Inferred Naming

The AI will determine SUBSYSTEM and FEATURE values based on:
1. **BRS document content** - identifies the system/domain being specified
2. **Section context** - identifies the functional area of each section
3. **Requirement nature** - chooses appropriate ARTEFACT type

**No manual configuration needed** - just prompt guidance and counter tracking.

---

## Codebase Context

**Project**: TechSpec Studio - AI-powered technical specification authoring system
**Stack**: React 18 + TypeScript + Vite + Zustand
**Key Pattern**: Similar to `includeDiagrams` toggle recently added to sections

**Relevant existing code:**
- `FlexibleSection` interface at `src/types/index.ts:569`
- `ProposedSection` interface at `src/types/index.ts:988`
- `FlexibleSectionContext` interface at `src/services/ai/prompts/sectionPrompts.ts:103`
- `buildFlexibleSectionPrompt()` function at `src/services/ai/prompts/sectionPrompts.ts:450`
- `generateFromApprovedStructure()` method at `src/services/ai/AIService.ts:2700+`
- `SectionCard` component at `src/components/ai/SectionCard.tsx`

---

## Implementation Steps

### Step 1: Add Types (`src/types/index.ts`)

```typescript
// Controlled list of artefact types
export type RequirementArtefactType =
  'REQ' | 'FR' | 'NFR' | 'INT' | 'CFG' | 'TST' | 'SEC' | 'RISK';

// Counter state passed between sections (tracks highest ID seen per prefix)
export interface RequirementCounterState {
  // Key: "SUBSYSTEM-FEATURE-ARTEFACT", Value: highest number used
  counters: Record<string, number>;
}
```

**Add to `FlexibleSectionContext`:**
```typescript
requirementCounters?: RequirementCounterState;
enableRequirementNumbering?: boolean;
```

**Add to `FlexibleSection` and `ProposedSection`:**
```typescript
enableRequirementNumbering?: boolean;  // Per-section toggle (default: true)
```

---

### Step 2: Add Toggle UI (`src/components/ai/SectionCard.tsx`)

Add checkbox after `includeDiagrams` toggle:

```tsx
{/* Requirement Numbering Toggle */}
<div className="mt-3">
  <label className="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      checked={section.enableRequirementNumbering !== false}
      onChange={(e) => onUpdate({ enableRequirementNumbering: e.target.checked })}
      className="w-4 h-4 text-blue-600 border-gray-300 rounded..."
    />
    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
      Number requirements (SHALL/SHOULD/MAY)
    </span>
  </label>
</div>
```

---

### Step 3: Add Prompt Guidance (`src/services/ai/prompts/sectionPrompts.ts`)

Add constant for requirement numbering instructions:

```typescript
export const REQUIREMENT_NUMBERING_GUIDANCE = `
## Requirement Numbering

Every normative statement (using SHALL, SHOULD, or MAY) MUST have a unique requirement ID.

**Format**: \`<SUBSYSTEM>-<FEATURE>-<ARTEFACT>-<NNNNN>\`

**Components** (you determine based on context):
- **SUBSYSTEM**: Major system block from BRS (e.g., PCC, AAA, WLAN, BNG, PCRF, OCS)
- **FEATURE**: Functional slice being specified (e.g., CAPTIVE, EAPSIM, ACCOUNTING, QOS)
- **ARTEFACT**: Requirement type:
  - \`REQ\` - General requirement
  - \`FR\` - Functional requirement
  - \`NFR\` - Non-functional requirement
  - \`INT\` - Interface requirement
  - \`SEC\` - Security requirement
  - \`CFG\` - Configuration requirement
  - \`TST\` - Test requirement
  - \`RISK\` - Risk item
- **NNNNN**: 5-digit zero-padded counter (00001, 00002, etc.)

**Rules**:
1. Infer SUBSYSTEM and FEATURE from the BRS document and section context
2. Keep SUBSYSTEM and FEATURE consistent within related sections
3. Use appropriate ARTEFACT type based on requirement nature
4. Start counter at 00001 for each unique SUBSYSTEM-FEATURE-ARTEFACT combination
5. Format: **ID**: The system SHALL/SHOULD/MAY...

**Example**:
\`\`\`markdown
**PCC-CAPTIVE-REQ-00001**: The system SHALL authenticate users via RADIUS protocol.

**PCC-CAPTIVE-SEC-00001**: The system SHALL encrypt all authentication credentials.

**PCC-CAPTIVE-NFR-00001**: The system SHOULD complete authentication within 3 seconds.
\`\`\`
`;

export const REQUIREMENT_NUMBERING_DISABLED = `
## Requirement Numbering

**IMPORTANT: Do NOT include requirement IDs in this section.**
Write normative statements (SHALL/SHOULD/MAY) without ID prefixes.
`;
```

**Integrate into `buildFlexibleSectionPrompt()`:**
```typescript
// After diagram placeholder section
if (enableRequirementNumbering !== false) {
  prompt += REQUIREMENT_NUMBERING_GUIDANCE;

  // If we have counters from previous sections, include them
  if (requirementCounters && Object.keys(requirementCounters.counters).length > 0) {
    prompt += `\n**Continue from these counters:**\n`;
    for (const [prefix, count] of Object.entries(requirementCounters.counters)) {
      prompt += `- ${prefix}: next is ${String(count + 1).padStart(5, '0')}\n`;
    }
  }
} else {
  prompt += REQUIREMENT_NUMBERING_DISABLED;
}
```

---

### Step 4: Track Counters (`src/services/ai/AIService.ts`)

In `generateFromApprovedStructure()`:

```typescript
// Initialize counter state
let requirementCounters: RequirementCounterState = { counters: {} };

for (let i = 0; i < sections.length; i++) {
  const section = sections[i];

  const prompt = buildFlexibleSectionPrompt(
    { ...sectionData },
    {
      // ... existing context
      requirementCounters,
      enableRequirementNumbering: section.enableRequirementNumbering,
    }
  );

  const result = await this.provider.generate(...);

  // Parse generated content to update counters
  requirementCounters = updateRequirementCounters(requirementCounters, result);
}

// Helper function
function updateRequirementCounters(
  current: RequirementCounterState,
  content: string
): RequirementCounterState {
  // Match pattern: SUBSYSTEM-FEATURE-ARTEFACT-NNNNN
  const pattern = /\*\*([A-Z]+-[A-Z]+-(?:REQ|FR|NFR|INT|CFG|TST|SEC|RISK))-(\d{5})\*\*/g;
  const updated = { ...current.counters };

  let match;
  while ((match = pattern.exec(content)) !== null) {
    const prefix = match[1];  // e.g., "PCC-CAPTIVE-REQ"
    const num = parseInt(match[2], 10);
    updated[prefix] = Math.max(updated[prefix] || 0, num);
  }

  return { counters: updated };
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `RequirementArtefactType`, `RequirementCounterState`; add `enableRequirementNumbering` to section types and context |
| `src/components/ai/SectionCard.tsx` | Add "Number requirements" checkbox toggle |
| `src/services/ai/prompts/sectionPrompts.ts` | Add `REQUIREMENT_NUMBERING_GUIDANCE` constant; integrate into `buildFlexibleSectionPrompt()` |
| `src/services/ai/AIService.ts` | Add `updateRequirementCounters()` helper; track counters in `generateFromApprovedStructure()` |

---

## Testing Plan

1. Create a project with BRS document about a telecom system
2. Generate specification with default settings (numbering enabled)
3. Verify:
   - AI infers appropriate SUBSYSTEM/FEATURE from BRS
   - Requirements have IDs in correct format
   - Counter increments within each prefix
   - Different ARTEFACT types for different requirement natures
4. Test with numbering disabled on a section - verify no IDs

---

## Benefits of AI-Inferred Approach

1. **Zero configuration** - no UI for SUBSYSTEM/FEATURE entry
2. **Context-aware** - AI adapts naming to match BRS domain
3. **Simpler implementation** - just prompts + counter tracking
4. **Flexible** - AI can use different prefixes for different functional areas

---

## Detailed Edit Instructions

### Edit 1: `src/types/index.ts`

**Location**: After line 275 (after `BRSRequirement` interface)

**Add:**
```typescript
// ========== Requirement Numbering ==========

/**
 * Controlled list of requirement artefact types
 */
export type RequirementArtefactType =
  | 'REQ'   // General requirement
  | 'FR'    // Functional requirement
  | 'NFR'   // Non-functional requirement
  | 'INT'   // Interface requirement
  | 'CFG'   // Configuration requirement
  | 'TST'   // Test requirement
  | 'SEC'   // Security requirement
  | 'RISK'; // Risk item

/**
 * Counter state for requirement numbering across sections
 * Tracks highest ID used per SUBSYSTEM-FEATURE-ARTEFACT combination
 */
export interface RequirementCounterState {
  counters: Record<string, number>;  // e.g., { "PCC-CAPTIVE-REQ": 5, "PCC-CAPTIVE-SEC": 2 }
}
```

**Location**: `FlexibleSection` interface (line ~576)

**Add field:**
```typescript
enableRequirementNumbering?: boolean;  // Whether to generate requirement IDs (default: true)
```

**Location**: `ProposedSection` interface (line ~995)

**Add field:**
```typescript
enableRequirementNumbering?: boolean;  // Whether to generate requirement IDs (default: true)
```

---

### Edit 2: `src/services/ai/prompts/sectionPrompts.ts`

**Location**: `FlexibleSectionContext` interface (line ~103)

**Add fields:**
```typescript
requirementCounters?: RequirementCounterState;
enableRequirementNumbering?: boolean;
```

**Location**: After `DIAGRAM_PLACEHOLDER_REQUIREMENTS` constant (around line 99)

**Add new constants:**
```typescript
/**
 * Requirement numbering guidance - instructs AI to add requirement IDs
 */
export const REQUIREMENT_NUMBERING_GUIDANCE = `
## Requirement Numbering

Every normative statement (using SHALL, SHOULD, or MAY) MUST have a unique requirement ID.

**Format**: \`<SUBSYSTEM>-<FEATURE>-<ARTEFACT>-<NNNNN>\`

**Components** (infer from BRS and section context):
- **SUBSYSTEM**: Major system block (e.g., PCC, AAA, WLAN, BNG, PCRF, OCS, CORE, EDGE)
- **FEATURE**: Functional slice (e.g., CAPTIVE, EAPSIM, ACCOUNTING, QOS, CHARGING, AUTH)
- **ARTEFACT**: Requirement type:
  - \`REQ\` - General requirement
  - \`FR\` - Functional requirement
  - \`NFR\` - Non-functional requirement
  - \`INT\` - Interface requirement
  - \`SEC\` - Security requirement
  - \`CFG\` - Configuration requirement
  - \`TST\` - Test requirement
  - \`RISK\` - Risk item
- **NNNNN**: 5-digit zero-padded counter (00001, 00002, etc.)

**Rules**:
1. Infer SUBSYSTEM and FEATURE from the BRS document and section context
2. Keep SUBSYSTEM and FEATURE consistent within related sections
3. Use appropriate ARTEFACT type based on requirement nature
4. Start counter at 00001 for each unique SUBSYSTEM-FEATURE-ARTEFACT combination
5. Format each requirement as: **ID**: The system SHALL/SHOULD/MAY...

**Example**:
\`\`\`markdown
**PCC-CAPTIVE-REQ-00001**: The system SHALL authenticate users via RADIUS protocol.

**PCC-CAPTIVE-SEC-00001**: The system SHALL encrypt all authentication credentials using TLS 1.3.

**PCC-CAPTIVE-NFR-00001**: The system SHOULD complete authentication within 3 seconds.
\`\`\`
`;

/**
 * Instruction when requirement numbering is disabled for a section
 */
export const REQUIREMENT_NUMBERING_DISABLED = `
## Requirement Numbering

**IMPORTANT: Do NOT include requirement IDs in this section.**
Write normative statements (SHALL/SHOULD/MAY) without ID prefixes.
`;

/**
 * Build requirement numbering guidance with counter state
 */
export function buildRequirementNumberingSection(
  enabled: boolean,
  counters?: RequirementCounterState
): string {
  if (!enabled) {
    return REQUIREMENT_NUMBERING_DISABLED;
  }

  let guidance = REQUIREMENT_NUMBERING_GUIDANCE;

  // Add counter state if we have existing counters
  if (counters && Object.keys(counters.counters).length > 0) {
    guidance += `\n**Continue from these counters (use next number in sequence):**\n`;
    for (const [prefix, count] of Object.entries(counters.counters)) {
      guidance += `- ${prefix}: last used ${String(count).padStart(5, '0')}, next is ${String(count + 1).padStart(5, '0')}\n`;
    }
    guidance += `\n`;
  }

  return guidance;
}
```

**Location**: Inside `buildFlexibleSectionPrompt()` function, after the diagram placeholder section (around line 525)

**Add:**
```typescript
  // Add requirement numbering guidance
  const enableReqNumbering = context.enableRequirementNumbering !== false && section.enableRequirementNumbering !== false;
  prompt += buildRequirementNumberingSection(enableReqNumbering, context.requirementCounters);
```

**Also extract `enableRequirementNumbering` and `requirementCounters` from context destructuring (around line 454):**
```typescript
  const {
    brsContent,
    previousSections,
    domainConfig,
    userGuidance,
    referenceExcerpts,
    webSearchResults,
    markdownGuidance,
    sectionNumber,
    includeDiagrams,
    enableRequirementNumbering,  // ADD THIS
    requirementCounters,          // ADD THIS
  } = context;
```

---

### Edit 3: `src/components/ai/SectionCard.tsx`

**Location**: After the "Include Diagrams Toggle" div (around line 307)

**Add:**
```tsx
          {/* Requirement Numbering Toggle */}
          <div className="mt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={section.enableRequirementNumbering !== false}
                onChange={(e) => onUpdate({ enableRequirementNumbering: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Number requirements (SHALL/SHOULD/MAY)
              </span>
              {section.enableRequirementNumbering === false && (
                <span className="text-xs text-orange-600 dark:text-orange-400">(disabled)</span>
              )}
            </label>
          </div>
```

---

### Edit 4: `src/services/ai/AIService.ts`

**Location**: Add helper function near top of file or in a utility section

**Add:**
```typescript
/**
 * Parse generated content to extract requirement IDs and update counters
 */
function updateRequirementCounters(
  current: RequirementCounterState,
  content: string
): RequirementCounterState {
  // Match pattern: **SUBSYSTEM-FEATURE-ARTEFACT-NNNNN**
  const pattern = /\*\*([A-Z0-9]+-[A-Z0-9]+-(?:REQ|FR|NFR|INT|CFG|TST|SEC|RISK))-(\d{5})\*\*/g;
  const updated = { ...current.counters };

  let match;
  while ((match = pattern.exec(content)) !== null) {
    const prefix = match[1];  // e.g., "PCC-CAPTIVE-REQ"
    const num = parseInt(match[2], 10);
    updated[prefix] = Math.max(updated[prefix] || 0, num);
  }

  return { counters: updated };
}
```

**Location**: Inside `generateFromApprovedStructure()` method (around line 2770)

**Find the section generation loop and modify:**

```typescript
// Before the loop, initialize counter state
let requirementCounters: RequirementCounterState = { counters: {} };

// Inside the loop, when building the prompt context:
const prompt = buildFlexibleSectionPrompt(
  {
    id: section.id,
    title: section.title,
    description: section.description,
    isRequired: true,
    suggestedSubsections: section.suggestedSubsections,
    contentGuidance: section.contentGuidance,
    includeDiagrams: section.includeDiagrams,
    enableRequirementNumbering: section.enableRequirementNumbering,  // ADD THIS
    order: section.order,
  },
  {
    brsContent: brsContent.slice(0, 8000),
    previousSections: previousContent.slice(-4000),
    domainConfig: structure.domainConfig,
    userGuidance: combinedGuidance,
    sectionNumber: String(section.order),
    includeDiagrams: section.includeDiagrams,
    enableRequirementNumbering: section.enableRequirementNumbering,  // ADD THIS
    requirementCounters,  // ADD THIS
  }
);

// After generating each section, update counters:
// (After the line that appends to generatedContent or similar)
requirementCounters = updateRequirementCounters(requirementCounters, result);
```

---

## Import Statement Updates

### `src/services/ai/prompts/sectionPrompts.ts`
Add to imports:
```typescript
import type { RequirementCounterState } from '../../../types';
```

### `src/services/ai/AIService.ts`
Add to imports from types:
```typescript
import type { RequirementCounterState } from '../../types';
```

---

## Verification Checklist

After implementation, verify:

- [ ] `npm run build` passes with no new TypeScript errors
- [ ] SectionCard shows "Number requirements" checkbox
- [ ] Checkbox defaults to checked (enabled)
- [ ] Unchecking shows "(disabled)" indicator
- [ ] Generated sections include requirement IDs when enabled
- [ ] Requirement IDs follow format: `SUBSYSTEM-FEATURE-ARTEFACT-NNNNN`
- [ ] Counter increments correctly across sections
- [ ] Different artefact types have separate counters
- [ ] Sections with numbering disabled have no IDs
