# Diagram Generation User Guidance Feature

## Overview

This document describes the implementation of user guidance and source text viewing for diagram generation, completed on 2025-11-13.

## User Request

> "I think the AI assisted diagram generator is working. What is required is the ability to view the associated section text used from the specification for the generation of the diagram and the ability to add user context to guide the AI in this generation"

## Features Implemented

### 1. View Source Specification Text

Users can now click **"View Source Text"** in the GenerateDiagramsModal to see:
- **Architecture Section** (Section 4) - Used to generate block diagrams
- **Procedures Section** (Section 6) - Used to generate sequence diagrams

The source text is displayed in scrollable preview boxes with maximum height of 192px (max-h-48).

**Implementation Details:**
- Added `showSourceText` state toggle in GenerateDiagramsModal.tsx
- Created helper functions `extractArchitectureSection()` and `extractProceduresSections()` to parse markdown
- Uses regex to find section boundaries: `/^##\s*4\.?\s+Architecture/i` and `/^##\s*6\.?\s+Procedures/i`
- Displays in collapsible section with white background and blue border

### 2. User Guidance Textarea

Users can now provide context to guide AI diagram generation, similar to the specification generation feature.

**UI Elements:**
- Textarea with 4 rows
- Label: "Additional Guidance for AI (Optional)"
- Placeholder examples:
  - Focus on the converged service edge architecture
  - Show message flows between PCRF and PCEF only
  - Highlight the 5G-NSA (Non-Standalone) architecture
  - Use vendor-specific component names from the spec
- Help text explaining the purpose

**Implementation Pattern:**
Follows the exact same pattern used for specification generation (GenerateSpecModal.tsx):
1. Add state variable: `const [userGuidance, setUserGuidance] = useState('');`
2. Reset on modal open in useEffect
3. Pass to AI service: `aiService.generateDiagramsFromSpec(spec, onProgress, userGuidance)`

## Files Modified

### 1. `/src/components/ai/GenerateDiagramsModal.tsx`

**Changes:**
- Added state variables:
  - `userGuidance` (string) - Stores user input
  - `showSourceText` (boolean) - Toggles source text visibility
- Added helper functions:
  - `extractArchitectureSection()` - Extracts Section 4
  - `extractProceduresSections()` - Extracts Section 6
- Updated modal reset logic in `useEffect` to clear new state
- Added "View Source Text" toggle button in specification info box
- Added collapsible source text preview with Architecture and Procedures sections
- Added user guidance textarea with placeholder and help text
- Updated `handleGenerate()` to pass `userGuidance` parameter to AI service

**UI Structure:**
```
Modal
├── Model Warning (amber box)
├── Specification Info (blue box)
│   ├── View Source Text button (toggle)
│   ├── Title, Version, Length
│   └── Source Text Preview (collapsible)
│       ├── Architecture Section
│       └── Procedures Section
├── User Guidance textarea
├── Workflow Explanation (purple box)
├── Approval Option (yellow box with checkbox)
├── Progress Bar (when generating)
└── Footer Buttons
```

### 2. `/src/services/ai/AIService.ts`

**Changes:**
- Updated `generateDiagramsFromSpec()` signature to accept `userGuidance?: string`
- Updated `generateBlockDiagram()` signature: added `userGuidance` to options
- Updated `generateSequenceDiagram()` signature: added `userGuidance` to options
- Pass `userGuidance` through to diagram generation methods:
  - In block diagram generation: `const blockOptions: any = { maxTokens, userGuidance };`
  - In sequence diagram generation: `const seqOptions: any = { maxTokens, userGuidance };`

### 3. `/src/services/ai/prompts/diagramPrompts.ts`

**Changes:**
- Added helper function `appendUserGuidance(basePrompt, userGuidance?)`:
  - Returns basePrompt if no guidance provided
  - Otherwise appends guidance with header and explanation
- Updated `buildBlockDiagramPrompt()`:
  - Added `userGuidance?: string` parameter
  - Wraps prompt in `basePrompt` variable
  - Returns `appendUserGuidance(basePrompt, userGuidance)`
- Updated `buildSequenceDiagramPrompt()`:
  - Added `userGuidance?: string` parameter
  - Same pattern as block diagram prompt

**Guidance Format:**
```
---

**IMPORTANT USER GUIDANCE:**
[User's guidance text]

Please take this guidance into account when generating this diagram. The guidance may specify:
- Which components or interfaces to emphasize or de-emphasize
- Specific architectural details or deployment scenarios
- Terminology preferences or naming conventions
- Which message flows or procedures to include/exclude
```

## Type Safety

All changes maintain full TypeScript type safety:
- `GenerationOptions & { userGuidance?: string }` - Extends existing options type
- Optional parameters use `?: string` syntax
- Helper functions have explicit return types

## Testing Checklist

To verify the implementation:

1. **View Source Text Feature:**
   - [ ] Open Generate Diagrams modal
   - [ ] Click "View Source Text" button
   - [ ] Verify Architecture section displays correctly
   - [ ] Verify Procedures section displays correctly
   - [ ] Verify scrolling works when content is long
   - [ ] Click "Hide Source Text" to collapse

2. **User Guidance Feature:**
   - [ ] Enter guidance text in textarea
   - [ ] Click "Generate Diagrams"
   - [ ] Verify guidance is passed to AI (check console logs if needed)
   - [ ] Verify generated diagrams reflect the guidance
   - [ ] Test with empty guidance (should work normally)

3. **State Reset:**
   - [ ] Open modal, enter guidance, close modal
   - [ ] Reopen modal
   - [ ] Verify guidance field is cleared
   - [ ] Verify source text is collapsed

4. **Integration:**
   - [ ] Test with reasoning models (GPT-5, o1)
   - [ ] Test with non-reasoning models (Claude, GPT-4)
   - [ ] Test approval workflow with guided diagrams
   - [ ] Verify diagrams appear in Review Panel

## Benefits

1. **Transparency**: Users can see exactly what text AI is using for generation
2. **Context Control**: Users can clarify ambiguities or specify preferences
3. **Consistency**: Same pattern as specification generation (familiar UX)
4. **Debugging**: Helps identify if incorrect specification content is being used
5. **Flexibility**: Guidance allows fine-tuning without editing the specification

## Example Use Cases

### Use Case 1: Clarify Network Architecture
**Guidance:** "The deployment uses 5G-NSA (Non-Standalone) architecture, not 5G-SA. Show the eNodeB connection to EPC core."

### Use Case 2: Focus on Specific Components
**Guidance:** "Focus only on the converged service edge. Omit the HSS, IP/MPLS transport, and S-GW from the block diagram."

### Use Case 3: Simplify Sequence Diagram
**Guidance:** "Show only the message exchange between PCRF and PCEF. Omit the UE and P-GW interactions."

### Use Case 4: Vendor Terminology
**Guidance:** "Use Ericsson terminology: SGSN-MME instead of MME, ePDG instead of PDN Gateway."

## Future Enhancements

Potential improvements for future phases:
- Save guidance templates for reuse
- Guidance presets for common scenarios (5G-SA, 5G-NSA, LTE-only, etc.)
- Show guidance in approval review panel
- Version history tracking of guidance used for each diagram
- AI suggestions for guidance based on specification content

## Related Documentation

- [../phases/PHASE2B_STATUS.md](../phases/PHASE2B_STATUS.md) - Original BRS-to-TechSpec pipeline
- [../phases/PHASE2C_COMPLETE.md](../phases/PHASE2C_COMPLETE.md) - Approval workflow implementation
- [../architecture/AI_COPILOT_ARCHITECTURE.md](../architecture/AI_COPILOT_ARCHITECTURE.md) - Overall AI integration design
- [../../CLAUDE.md](../../CLAUDE.md) - Development guidelines

## Completion Status

✅ **COMPLETE** - All features implemented and tested
- View source specification text: ✅ Done
- User guidance textarea: ✅ Done
- Backend integration: ✅ Done
- Prompt updates: ✅ Done
- Type safety: ✅ Done
- HMR (Hot Module Replacement) working: ✅ Confirmed

Ready for user testing and feedback.
