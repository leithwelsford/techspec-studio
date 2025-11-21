# Future Feature: Cascaded Refinement Workflow

## Status: PLANNED FOR FUTURE DEVELOPMENT

**Date Proposed**: 2025-11-13
**Priority**: Medium (after Phase 3 completion)
**Estimated Effort**: 2-3 days of development

---

## Overview

A cascaded refinement system that automatically propagates changes from one section to related sections throughout the document, ensuring consistency across the entire technical specification.

## User Request

> "I want to confirm the following flow is enforced for the refinement workflow:
> - Section is highlighted for refinement.
> - Instruction is given to the AI for the required refinement.
> - Refinement is done in the applicable section.
> - The changes in that section are used to review the other sections where applicable changes might be applied (say for example a call flow or procedure becomes unnecessary it is removed or modified)?"

## Current Implementation (As of 2025-11-13)

**What Works Now:**
1. ✅ User selects a section (e.g., Architecture)
2. ✅ User provides refinement instruction (e.g., "Remove HSS/AuC component")
3. ✅ AI refines **only that selected section**
4. ✅ User reviews diff showing changes **only in that section**
5. ✅ User approves → Section updated
6. ❌ **No automatic propagation to other sections** (this is what needs to be added)

**Key Limitation:** If you remove HSS/AuC from Architecture, you must manually:
- Remove HSS/AuC procedures from Section 6 (Procedures)
- Remove HSS/AuC parameters from Section 7 (Information Elements)
- Remove HSS/AuC error handling from Section 8 (Error Handling)

## Proposed Cascaded Refinement Workflow

### User Experience Design

#### Step 1: Initiate Refinement with Propagation

```
[Markdown Editor - Refine Selection Dialog]
┌──────────────────────────────────────────────────────┐
│ Selected Section: Architecture (Section 4)           │
│                                                       │
│ Instruction for AI:                                  │
│ ┌───────────────────────────────────────────────┐  │
│ │ Remove HSS/AuC component from architecture    │  │
│ └───────────────────────────────────────────────┘  │
│                                                       │
│ ☑ Analyze impact on other sections                   │
│   When enabled, AI will check for related changes    │
│   needed in other sections and suggest them for      │
│   your review.                                        │
│                                                       │
│   This may take 2-3x longer and use more tokens.     │
│                                                       │
│ [Cancel] [Refine with Propagation]                   │
└──────────────────────────────────────────────────────┘
```

#### Step 2: AI Performs Multi-Step Analysis

**Backend Workflow:**
1. **Primary Refinement**: AI refines the selected Architecture section
2. **Impact Analysis**: AI analyzes what changed and identifies affected sections
3. **Propagation Generation**: AI generates specific changes for each affected section
4. **Consistency Validation**: AI checks that all proposed changes are coherent

**Progress Indicators:**
```
┌──────────────────────────────────────────────────────┐
│ Cascaded Refinement in Progress...                   │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 75%           │
│                                                       │
│ ✓ Step 1/4: Refined Architecture section             │
│ ✓ Step 2/4: Analyzed impact on document              │
│ ✓ Step 3/4: Generated propagated changes             │
│ ⟳ Step 4/4: Validating consistency...                │
│                                                       │
│ Estimated tokens: 45,000 | Est. cost: $0.45          │
└──────────────────────────────────────────────────────┘
```

#### Step 3: Review All Proposed Changes

```
[Review Panel - Cascaded Refinement Approval]
┌──────────────────────────────────────────────────────┐
│ Cascaded Refinement: Remove HSS/AuC                  │
│ Instruction: Remove HSS/AuC component from arch...   │
│                                                       │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                                       │
│ PRIMARY CHANGE                                        │
│ ☑ Section 4: Architecture                            │
│   Status: REFINED                                     │
│   Changes: Removed HSS/AuC node, removed Gr interface│
│   [View Diff] [View Full Section]                    │
│                                                       │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                                       │
│ PROPAGATED CHANGES (detected by AI)                  │
│                                                       │
│ ☑ Section 6.3: HSS Authentication Procedure          │
│   Impact: HIGH - Section references removed component│
│   Action: REMOVE ENTIRE SECTION                      │
│   Rationale: This procedure depends on HSS/AuC which │
│   no longer exists in the architecture.              │
│   [View Diff] [Accept] [Reject]                      │
│                                                       │
│ ☑ Section 6.1: Attach Procedure                      │
│   Impact: MEDIUM - Contains HSS references           │
│   Action: MODIFY (remove HSS steps)                  │
│   Rationale: Remove HSS authentication steps from    │
│   attach procedure while keeping rest of flow.       │
│   [View Diff] [Accept] [Reject]                      │
│                                                       │
│ ☑ Section 7.2: Authentication Vector (AV)            │
│   Impact: MEDIUM - HSS-specific data structure       │
│   Action: REMOVE TABLE                               │
│   Rationale: AV table describes HSS parameters.      │
│   [View Diff] [Accept] [Reject]                      │
│                                                       │
│ ☐ Section 8: Error Handling                          │
│   Impact: LOW - Contains generic error codes         │
│   Action: NO CHANGE NEEDED                           │
│   Rationale: Error handling is generic and not       │
│   specific to HSS/AuC.                               │
│   [View Details]                                      │
│                                                       │
│ ☐ Section 5: Functional Requirements                 │
│   Impact: NONE                                        │
│   Action: NO CHANGE NEEDED                           │
│                                                       │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                                       │
│ Summary: 1 primary change, 3 propagated changes      │
│ Total sections affected: 4/8                          │
│ Tokens used: 42,450 | Cost: $0.43                    │
│                                                       │
│ [Select All] [Deselect All]                          │
│ [Apply Selected Changes] [Reject All] [Cancel]       │
└──────────────────────────────────────────────────────┘
```

#### Step 4: Apply Changes and Create Snapshot

After user clicks "Apply Selected Changes":
1. All checked changes are applied atomically
2. Single snapshot created with metadata:
   - Primary change: Architecture section refined
   - Propagated changes: Sections 6.1, 6.3, 7.2 modified
   - Instruction: "Remove HSS/AuC component"
   - Tokens/cost tracking
3. User sees confirmation:
   ```
   ✓ Applied cascaded refinement
   - Architecture: Refined (removed HSS/AuC)
   - Procedures 6.3: Removed (HSS auth)
   - Procedures 6.1: Modified (removed HSS steps)
   - Info Elements 7.2: Removed (AV table)
   ```

## Technical Architecture

### New Components

#### 1. AIService Methods

```typescript
// src/services/ai/AIService.ts

/**
 * Analyze impact of a section refinement on other sections
 */
async analyzeRefinementImpact(
  originalSection: string,
  refinedSection: string,
  sectionTitle: string,
  fullDocument: string,
  instruction: string
): Promise<ImpactAnalysis> {
  // Returns:
  // - affectedSections: Array of section IDs that may need changes
  // - impactLevel: HIGH/MEDIUM/LOW for each section
  // - reasoning: Why each section is affected
}

/**
 * Generate propagated changes for affected sections
 */
async generatePropagatedChanges(
  impactAnalysis: ImpactAnalysis,
  fullDocument: string,
  originalSection: string,
  refinedSection: string
): Promise<PropagatedChange[]> {
  // For each affected section:
  // - Generate specific changes needed
  // - Extract before/after for diff
  // - Provide rationale
}

/**
 * Validate consistency across all proposed changes
 */
async validateCascadedChanges(
  primaryChange: SectionChange,
  propagatedChanges: PropagatedChange[],
  fullDocument: string
): Promise<ValidationResult> {
  // Check:
  // - No contradictions between changes
  // - No orphaned references
  // - Consistent terminology
}
```

#### 2. New Types

```typescript
// src/types/index.ts

interface ImpactAnalysis {
  affectedSections: AffectedSection[];
  totalImpact: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  reasoning: string;
}

interface AffectedSection {
  sectionId: string;
  sectionTitle: string;
  impactLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  impactType: 'REMOVE' | 'MODIFY' | 'NONE';
  reasoning: string;
}

interface PropagatedChange {
  sectionId: string;
  sectionTitle: string;
  actionType: 'REMOVE_SECTION' | 'MODIFY_SECTION' | 'NONE';
  originalContent: string;
  proposedContent: string;
  reasoning: string;
  impactLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number; // 0-1, AI's confidence in this change
}

interface CascadedRefinementApproval extends PendingApproval {
  type: 'cascaded-refinement';
  primaryChange: {
    sectionId: string;
    sectionTitle: string;
    originalContent: string;
    refinedContent: string;
  };
  propagatedChanges: PropagatedChange[];
  instruction: string;
  tokensUsed: number;
  costIncurred: number;
}

interface ValidationResult {
  isConsistent: boolean;
  issues: ValidationIssue[];
  warnings: string[];
}

interface ValidationIssue {
  type: 'CONTRADICTION' | 'ORPHANED_REFERENCE' | 'TERMINOLOGY_MISMATCH';
  description: string;
  affectedSections: string[];
  severity: 'ERROR' | 'WARNING';
}
```

#### 3. New Prompts

```typescript
// src/services/ai/prompts/refinementPrompts.ts

export function buildImpactAnalysisPrompt(
  originalSection: string,
  refinedSection: string,
  sectionTitle: string,
  fullDocument: string,
  instruction: string
): string {
  return `You are analyzing the impact of a section refinement on a technical specification document.

**ORIGINAL SECTION (${sectionTitle}):**
${originalSection}

**REFINED SECTION (${sectionTitle}):**
${refinedSection}

**USER INSTRUCTION:**
${instruction}

**FULL DOCUMENT (for context):**
${fullDocument}

**TASK:**
Analyze what changed in the refined section and identify which other sections of the document may need corresponding changes.

For each potentially affected section, determine:
1. **Section ID and Title**: Which section is affected
2. **Impact Level**: HIGH (must be changed), MEDIUM (should be changed), LOW (minor change), NONE
3. **Impact Type**: REMOVE (section should be removed), MODIFY (section needs changes), NONE
4. **Reasoning**: Why this section is affected and what changes might be needed

**GUIDELINES:**
- HIGH impact: Section directly references removed/changed components
- MEDIUM impact: Section describes procedures/data related to changed components
- LOW impact: Section mentions changed components in passing
- NONE: Section is unaffected

**OUTPUT FORMAT (JSON):**
{
  "affectedSections": [
    {
      "sectionId": "6.3",
      "sectionTitle": "HSS Authentication Procedure",
      "impactLevel": "HIGH",
      "impactType": "REMOVE",
      "reasoning": "This entire procedure depends on the HSS/AuC component which was removed from the architecture."
    }
  ],
  "totalImpact": "HIGH",
  "reasoning": "The removal of HSS/AuC affects multiple procedures and data structures..."
}

Output ONLY valid JSON, no explanations.`;
}

export function buildPropagationPrompt(
  affectedSection: AffectedSection,
  sectionContent: string,
  primaryChangeContext: string
): string {
  return `You are generating a specific change for a section affected by a refinement.

**PRIMARY CHANGE:**
${primaryChangeContext}

**SECTION TO UPDATE:**
${affectedSection.sectionTitle} (${affectedSection.sectionId})

**CURRENT CONTENT:**
${sectionContent}

**IMPACT ANALYSIS:**
- Impact Level: ${affectedSection.impactLevel}
- Action Type: ${affectedSection.impactType}
- Reasoning: ${affectedSection.reasoning}

**TASK:**
Generate the updated content for this section that reflects the primary change.

**REQUIREMENTS:**
- If action is REMOVE: Explain why removal is necessary (output reasoning, not content)
- If action is MODIFY: Output the complete modified section
- Maintain consistency with the primary change
- Keep the section structure and formatting
- Remove references to removed components
- Update procedures that depend on changed components

**OUTPUT FORMAT:**
For MODIFY actions, output the complete modified section in markdown.
For REMOVE actions, output: {"action": "REMOVE", "reasoning": "..."}

Output now:`;
}

export function buildConsistencyValidationPrompt(
  primaryChange: any,
  propagatedChanges: PropagatedChange[],
  fullDocument: string
): string {
  return `You are validating the consistency of a cascaded refinement.

**PRIMARY CHANGE:**
Section: ${primaryChange.sectionTitle}
Changes: ${primaryChange.refinedContent.substring(0, 500)}...

**PROPAGATED CHANGES:**
${propagatedChanges.map((c, i) => `${i + 1}. ${c.sectionTitle}: ${c.actionType}`).join('\n')}

**FULL DOCUMENT:**
${fullDocument}

**TASK:**
Check for consistency issues:
1. **Contradictions**: Do any changes contradict each other?
2. **Orphaned References**: Are there references to removed content?
3. **Terminology Mismatches**: Is terminology consistent across changes?

**OUTPUT FORMAT (JSON):**
{
  "isConsistent": true/false,
  "issues": [
    {
      "type": "ORPHANED_REFERENCE",
      "description": "Section 5.2 still references HSS parameters",
      "affectedSections": ["5.2"],
      "severity": "ERROR"
    }
  ],
  "warnings": ["Section 6.5 mentions authentication but doesn't specify mechanism"]
}

Output ONLY valid JSON.`;
}
```

#### 4. UI Components

```typescript
// src/components/ai/CascadedRefinementReviewPanel.tsx

interface CascadedRefinementReviewPanelProps {
  approval: CascadedRefinementApproval;
  onApply: (selectedChanges: PropagatedChange[]) => void;
  onReject: () => void;
}

export const CascadedRefinementReviewPanel: React.FC<...> = ({...}) => {
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(
    new Set(approval.propagatedChanges.map(c => c.sectionId))
  );

  // UI showing:
  // - Primary change (always applied)
  // - List of propagated changes with checkboxes
  // - Diff viewer for each change
  // - Accept/reject individual changes
  // - Apply all selected changes button
};
```

### Implementation Steps (Phased Approach)

#### Phase 1: Impact Analysis (Day 1)
- [ ] Create `analyzeRefinementImpact()` method
- [ ] Build impact analysis prompt
- [ ] Parse impact analysis JSON response
- [ ] Add checkbox in refine dialog: "Analyze impact on other sections"
- [ ] Show loading state during analysis
- [ ] Display impact summary to user

#### Phase 2: Propagation Generation (Day 2)
- [ ] Create `generatePropagatedChanges()` method
- [ ] Build propagation prompt for each affected section
- [ ] Parse propagated change responses
- [ ] Create `CascadedRefinementApproval` type
- [ ] Store propagated changes in approval

#### Phase 3: Review UI (Day 2-3)
- [ ] Create `CascadedRefinementReviewPanel` component
- [ ] Show primary change (always applied)
- [ ] Show list of propagated changes with checkboxes
- [ ] Add diff viewer for each change
- [ ] Add accept/reject buttons per change
- [ ] Implement "Select All" / "Deselect All"

#### Phase 4: Validation & Application (Day 3)
- [ ] Create `validateCascadedChanges()` method
- [ ] Build validation prompt
- [ ] Show validation warnings in review panel
- [ ] Apply selected changes atomically
- [ ] Create single snapshot with all changes
- [ ] Add rollback capability

#### Phase 5: Testing & Polish
- [ ] Test with complex scenarios (multiple affected sections)
- [ ] Test with no affected sections
- [ ] Test reject individual changes
- [ ] Test validation catches issues
- [ ] Add cost estimation before execution
- [ ] Add progress indicators
- [ ] Performance optimization

## Benefits

1. **Consistency**: Ensures entire document stays coherent after section changes
2. **Efficiency**: User doesn't have to manually find and update related sections
3. **Quality**: AI identifies dependencies human might miss
4. **Transparency**: User reviews and approves every change
5. **Safety**: Changes applied atomically with rollback capability

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| **High Token Cost** | Show cost estimate upfront, make propagation optional |
| **Long Processing Time** | Show progress indicators, allow cancellation |
| **AI Misidentifies Impact** | User can reject individual changes, validation step catches issues |
| **Complex Diffs** | Provide clear before/after view, section-by-section review |
| **Inconsistent Changes** | Validation step checks for contradictions before presenting to user |

## Cost Estimation

**Typical Cascaded Refinement:**
- Impact Analysis: ~5,000 tokens input, ~500 tokens output
- Propagation (3 sections): ~15,000 tokens input, ~3,000 tokens output
- Validation: ~8,000 tokens input, ~500 tokens output
- **Total**: ~32,000 tokens (~$0.32 with Claude Sonnet 3.5)

**Compare to Manual:**
- Refining 3 sections separately: 3 × 10,000 tokens = 30,000 tokens
- But user must manually identify which sections to refine
- Cascaded approach saves mental effort, adds slight token cost

## Future Enhancements (Phase 2)

- **Intelligent Grouping**: Group related propagated changes together
- **Partial Application**: Apply only primary change now, propagate later
- **Conflict Resolution**: AI suggests resolution when changes conflict
- **Template Patterns**: Learn common propagation patterns (e.g., Architecture → Procedures)
- **Undo Cascaded Changes**: Rollback entire cascaded refinement in one click
- **Preview Mode**: See all changes applied without committing
- **Export Changelog**: Generate report of all cascaded changes

## Integration with Existing Code

**Minimal Changes Required:**
1. Add checkbox to `MarkdownEditor` refine dialog
2. Add new approval type to `ReviewPanel` routing
3. Create new `CascadedRefinementReviewPanel` component
4. Add new methods to `AIService`
5. No breaking changes to existing refinement workflow

**Backward Compatibility:**
- Existing "refine selection" continues to work as-is
- Cascaded refinement is opt-in via checkbox
- Users can ignore propagated changes if they prefer manual approach

## User Documentation

**When to Use Cascaded Refinement:**
- ✅ Removing components from architecture
- ✅ Changing interface names or protocols
- ✅ Modifying procedures that affect other procedures
- ✅ Updating data structures referenced elsewhere
- ❌ Minor wording/formatting changes
- ❌ Adding new content (no dependencies to propagate)

**Tips for Best Results:**
1. Start with a clear, specific instruction
2. Review the impact analysis before proceeding
3. Check each propagated change's diff carefully
4. Use validation warnings to catch issues
5. Test with a small change first to understand the workflow

---

## Decision: Postponed for Future Development

**Reasoning:**
1. Current partial refinement fix resolves immediate user issue
2. Cascaded refinement adds significant complexity
3. Should validate Phase 3 completion first
4. User can test current functionality before requesting advanced features

**Next Steps:**
1. User tests current refinement workflow
2. If successful and needed, implement cascaded refinement in future sprint
3. Gather user feedback on desired UX for propagation

**Saved for Future Reference**: This document captures complete design for when user requests implementation.
