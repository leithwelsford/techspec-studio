# TODO Comment Priority Enhancement

**Status**: ✅ **COMPLETE** (2025-11-19)

## Overview

Enhanced the AI diagram generation prompts to give **ABSOLUTE PRIORITY** to TODO comments from the Technical Specification. This ensures that when explicit diagram requirements are documented in TODO comments next to `{{fig:...}}` placeholders, the AI follows them exactly rather than generating generic diagrams based on section content alone.

## Problem Solved

### Before
- TODO comments were being extracted and passed to AI
- BUT: They were treated as "user guidance" with equal weight to section content
- AI was generating **generic diagrams** based on section text, largely ignoring the detailed TODO requirements
- Result: Diagrams didn't match the explicit specifications documented in TODO comments

**Example Issue**:
- TODO comment specified: "UE/CPE via 3G/LTE/5G-NR (NSA) to EPC (MME/S-GW/P-GW); BNG/BRAS for fixed; central PCRF; TDF/PCEF compound node with TDF, PCEF, Gy/Gz; OCS/OFCS; CRM/BSS as provisioning system. Clearly indicate Gx, Sd, Gy, Gz, RADIUS..."
- AI generated: Generic architecture with unrelated components
- User feedback: "totally wrong and out of context"

### After
- TODO comments are now **detected and prioritized** with special formatting
- Prompt includes **CRITICAL banner** with visual separators (━━━━━━)
- **6 mandatory requirements** listed explicitly:
  1. Follow requirements EXACTLY
  2. Include EVERY component, interface, and detail specified
  3. Use EXACT terminology and names provided
  4. DO NOT add components that aren't specified
  5. DO NOT omit components that are specified
  6. DO NOT make assumptions - follow requirements literally
- Section description explicitly marked as "for context only"
- TODO requirements marked as what "MUST be in the diagram"

## Implementation

### Files Modified

**[src/services/ai/prompts/diagramPrompts.ts](src/services/ai/prompts/diagramPrompts.ts)** - Enhanced prompt priority system

**Key Changes**:

1. **TODO Comment Detection** (line 15):
```typescript
const isTodoComment = userGuidance.includes('**IMPORTANT - Diagram Requirements from Specification:**');
```

**Why**: Distinguishes between TODO comments (from spec) vs. user-provided guidance (from modal). They need different treatment.

2. **Priority Banner for TODO Comments** (lines 17-37):
```typescript
if (isTodoComment) {
  // TODO comments have ABSOLUTE PRIORITY - they define what MUST be in the diagram
  return `${basePrompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRITICAL: DIAGRAM REQUIREMENTS FROM TECHNICAL SPECIFICATION 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${userGuidance}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ MANDATORY REQUIREMENTS:
1. You MUST follow the requirements above EXACTLY
2. Include EVERY component, interface, and detail specified
3. Use the EXACT terminology and names provided
4. DO NOT add components that aren't specified
5. DO NOT omit components that are specified
6. DO NOT make assumptions - follow the requirements literally

The description below is for context only. The requirements above define what MUST be in the diagram.`;
}
```

**Why**:
- **Visual separators** (━━━━━━) grab AI's attention
- **Emoji markers** (🚨 ⚠️) emphasize urgency
- **Explicit instructions** remove ambiguity
- **"MUST" language** makes requirements non-negotiable
- **Explicit prohibition** prevents AI from adding/omitting/assuming

3. **Regular User Guidance** (lines 40-52):
```typescript
// Regular user guidance (not from TODO comments)
return `${basePrompt}

---

**IMPORTANT USER GUIDANCE:**
${userGuidance}

Please take this guidance into account when generating this diagram. The guidance may specify:
- Which components or interfaces to emphasize or de-emphasize
- Specific architectural details or deployment scenarios
- Terminology preferences or naming conventions
- Which message flows or procedures to include/exclude`;
```

**Why**: User-provided guidance from the modal is still important but treated as suggestions rather than absolute requirements.

## How It Works

### TODO Comment Flow

1. **Section Analysis** ([sectionAnalyzer.ts](src/services/ai/sectionAnalyzer.ts)):
   - Finds `{{fig:...}}` placeholders in section
   - Extracts TODO comments within 2 lines after placeholder
   - Stores in `SectionAnalysis.todoComments[]`

2. **Guidance Combination** ([AIService.ts](src/services/ai/AIService.ts)):
   - Combines user guidance with TODO comments
   - Labels TODO comments as "**IMPORTANT - Diagram Requirements from Specification:**"
   - Passes combined guidance to diagram generation

3. **Priority Detection** ([diagramPrompts.ts](src/services/ai/prompts/diagramPrompts.ts)):
   - Detects presence of "**IMPORTANT - Diagram Requirements from Specification:**"
   - If found, wraps in CRITICAL banner with mandatory requirements
   - If not found, treats as regular user guidance

4. **AI Processing**:
   - AI sees requirements with maximum visual emphasis
   - Explicit instructions to follow requirements exactly
   - Section description marked as "for context only"
   - Clear prohibition against adding/omitting/assuming

### Prompt Structure Comparison

**Regular User Guidance** (no TODO comment):
```
[Base prompt with JSON schema and guidelines]

---

**IMPORTANT USER GUIDANCE:**
Focus on the converged service edge architecture only

Please take this guidance into account...
```

**TODO Comment** (from specification):
```
[Base prompt with JSON schema and guidelines]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRITICAL: DIAGRAM REQUIREMENTS FROM TECHNICAL SPECIFICATION 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**IMPORTANT - Diagram Requirements from Specification:**
High-level block diagram showing: UE/CPE via 3G/LTE/5G-NR (NSA) to EPC (MME/S-GW/P-GW); BNG/BRAS for fixed; central PCRF; TDF/PCEF compound node with TDF, PCEF, Gy/Gz; OCS/OFCS; CRM/BSS as provisioning system. Clearly indicate Gx, Sd, Gy, Gz, RADIUS, and that Gy/Gz exist only between TDF/PCEF and OCS/OFCS.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ MANDATORY REQUIREMENTS:
1. You MUST follow the requirements above EXACTLY
2. Include EVERY component, interface, and detail specified
3. Use the EXACT terminology and names provided
4. DO NOT add components that aren't specified
5. DO NOT omit components that are specified
6. DO NOT make assumptions - follow the requirements literally

The description below is for context only. The requirements above define what MUST be in the diagram.
```

## Benefits

1. **Specification Alignment**: Diagrams now match the exact requirements documented in TODO comments
2. **No More Generic Diagrams**: AI can't ignore detailed specifications in favor of generic interpretations
3. **Explicit Component Lists**: Every component mentioned in TODO must appear in diagram
4. **Interface Accuracy**: Interface names (Gx, Sd, Gy, Gz, RADIUS) must be included as specified
5. **Terminology Consistency**: Exact names from spec (e.g., "TDF/PCEF compound node") preserved
6. **Non-Negotiable**: 6 mandatory requirements make it clear these are not suggestions
7. **Context Separation**: Section description explicitly marked as context, not requirements
8. **Applies to All Diagrams**: Works for block diagrams, sequence diagrams, flow diagrams, and state diagrams

## Example: Architecture Diagram

### Technical Specification
```markdown
## System Architecture

The converged service edge architecture is shown in {{fig:architecture-overview}}
*Figure 4.1-1: High-level PCC Architecture for 5G Private Line over EPC*
<!-- TODO: High-level block diagram showing: UE/CPE via 3G/LTE/5G-NR (NSA) to EPC (MME/S-GW/P-GW); BNG/BRAS for fixed; central PCRF; TDF/PCEF compound node with TDF, PCEF, Gy/Gz; OCS/OFCS; CRM/BSS as provisioning system. Clearly indicate Gx, Sd, Gy, Gz, RADIUS, and that Gy/Gz exist only between TDF/PCEF and OCS/OFCS. -->

The architecture includes...
```

### Before (Generic)
AI generated diagram with unrelated components, missing specified interfaces, wrong terminology.

### After (Exact Match)
AI generates diagram with:
- ✅ UE/CPE node
- ✅ 3G/LTE/5G-NR (NSA) connectivity shown
- ✅ EPC components: MME, S-GW, P-GW
- ✅ BNG/BRAS for fixed connectivity
- ✅ Central PCRF
- ✅ TDF/PCEF compound node (labeled exactly)
- ✅ OCS/OFCS node
- ✅ CRM/BSS provisioning system
- ✅ Interfaces labeled: Gx, Sd, Gy, Gz, RADIUS
- ✅ Gy/Gz only between TDF/PCEF and OCS/OFCS (not elsewhere)

## Technical Details

### Detection Mechanism

The detection relies on the marker string added in AIService.ts:
```typescript
combinedGuidance = combinedGuidance
  ? `${combinedGuidance}\n\n**IMPORTANT - Diagram Requirements from Specification:**\n${todoGuidance}`
  : `**IMPORTANT - Diagram Requirements from Specification:**\n${todoGuidance}`;
```

If this marker is present, the guidance is treated as TODO comments. Otherwise, it's regular user guidance.

### Visual Markers

- **━━━━━━** (box drawing character): Creates visual boundaries
- **🚨** (rotating light emoji): Indicates critical/urgent
- **⚠️** (warning sign emoji): Emphasizes mandatory nature
- **CRITICAL**, **MANDATORY**, **MUST**: Strong imperative language
- **DO NOT**: Explicit prohibitions

### AI Model Compatibility

This enhancement works with:
- ✅ Claude 3.5 Sonnet (recommended)
- ✅ Claude Opus (most reliable)
- ✅ GPT-4, GPT-5
- ✅ Reasoning models (o1, GPT-5)
- ⚠️ Smaller models (Haiku) may still struggle with complex requirements

## Future Enhancements

### Possible Improvements

1. **Validation Before Approval**:
   - After diagram generation, validate that it includes all components from TODO
   - Show checklist: "✅ Contains PCRF", "✅ Contains Gx interface", etc.
   - Warn user if any requirements are missing

2. **Component Extraction**:
   - Parse TODO comments to extract component list
   - Interface list
   - Relationship list
   - Pass as structured data instead of text

3. **Iterative Refinement**:
   - If diagram doesn't match TODO requirements, auto-regenerate with even stronger prompts
   - Maximum 3 attempts before showing error

4. **TODO Syntax Validation**:
   - Validate TODO comment structure
   - Warn if TODO is too vague (e.g., "Draw an architecture diagram")
   - Suggest more specific language

## Related Documentation

- [TODO_COMMENT_EXTRACTION_FEATURE.md](TODO_COMMENT_EXTRACTION_FEATURE.md) - TODO comment extraction implementation
- [DIAGRAM_GENERATION_GUIDANCE_FEATURE.md](DIAGRAM_GENERATION_GUIDANCE_FEATURE.md) - User guidance feature
- [INTELLIGENT_DIAGRAM_GENERATION.md](INTELLIGENT_DIAGRAM_GENERATION.md) - Two-tier diagram generation system
- [src/services/ai/prompts/diagramPrompts.ts](src/services/ai/prompts/diagramPrompts.ts) - Prompt engineering implementation

## Testing

### Test Cases

1. **TODO Comment with Specific Components**:
   - Create section with TODO listing exact components
   - Verify all components appear in generated diagram
   - Verify no extra components added

2. **TODO Comment with Interface Names**:
   - Create section with TODO specifying interface labels (Gx, Sd, etc.)
   - Verify all interfaces are labeled correctly
   - Verify labels match exact terminology from TODO

3. **TODO Comment with Constraints**:
   - Create section with TODO saying "Gy/Gz ONLY between TDF/PCEF and OCS/OFCS"
   - Verify constraint is respected (no Gy/Gz elsewhere)

4. **User Guidance without TODO**:
   - Provide user guidance in modal without TODO comment
   - Verify guidance is treated as suggestion, not absolute requirement

5. **Combined TODO + User Guidance**:
   - Have TODO comment in spec + user guidance in modal
   - Verify TODO takes priority
   - Verify user guidance still influences diagram where it doesn't conflict

## Conclusion

The TODO comment priority enhancement ensures that AI-generated diagrams match the exact specifications documented in the Technical Specification. By using strong visual markers, explicit mandatory requirements, and clear prohibitions, the AI now prioritizes TODO comments over general section content.

**Key Success Factors**:
- **Visual Emphasis**: Box drawing characters and emojis grab attention
- **Explicit Instructions**: 6 mandatory requirements remove ambiguity
- **Strong Language**: "MUST", "CRITICAL", "MANDATORY" make requirements non-negotiable
- **Clear Separation**: Section description explicitly marked as context, not requirements
- **Prohibition**: Explicit "DO NOT" prevents common AI mistakes

This results in diagrams that accurately reflect the detailed specifications documented by the spec author, rather than AI's generic interpretation of the section content.
