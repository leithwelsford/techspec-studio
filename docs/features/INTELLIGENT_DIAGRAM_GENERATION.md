# Intelligent Diagram Generation

**Status**: ✅ **ENHANCED** (2025-11-19 - Updated with Mandatory/Suggested Detection)

## Overview

Enhanced the diagram generation feature with a **two-tier system**:
- **Mandatory diagrams**: Generated for sections with explicit `{{fig:...}}` placeholders in the Technical Specification
- **Suggested diagrams**: Generated based on intelligent heuristic analysis of section content

This ensures diagram generation aligns with explicit figure references in the Technical Specification while also suggesting additional diagrams where appropriate based on content analysis.

## Problem Solved

### Before
- **Generate Diagrams** feature was creating diagrams for **every section** in the Technical Specification
- Too many low-value diagrams were generated
- Sections without meaningful diagram content (like "Definitions", "References", "Scope") were getting diagram suggestions
- Level 3 headings (###) were being analyzed, creating diagrams for subsections that didn't need them
- No distinction between explicitly requested diagrams and heuristic suggestions

### After
- **Two-tier diagram generation system**:
  - **Mandatory**: Sections with `{{fig:...}}` placeholders ALWAYS generate diagrams (high confidence)
  - **Suggested**: Sections with strong heuristic evidence MAY generate diagrams (requires approval)
- **Selective diagram generation** based on intelligent content analysis
- Only sections with **strong evidence** of diagram-worthy content generate suggested diagrams
- Focus on **major sections** (level 2 headings ##) rather than subsections
- Stricter heuristics require **both title AND content keywords** for high confidence
- Figure reference IDs used as diagram IDs for mandatory diagrams

## Implementation

### Two-Tier Detection System

**Mandatory Diagrams (Phase 1 - Figure Placeholder Detection)**:
```typescript
// Extract figure references from section content
const figureRegex = /\{\{fig:([^}]+)\}\}/g;
const figureReferences = Array.from(content.matchAll(figureRegex)).map(m => m[1]);

if (figureReferences.length > 0) {
  return {
    ...analysis,
    figureReferences,
    isMandatory: true,
    confidence: 'high', // Override - always high confidence
    reasoning: `MANDATORY: Contains ${figureReferences.length} figure placeholder(s): ${figureReferences.join(', ')}`
  };
}
```

**Suggested Diagrams (Phase 2 - Heuristic Analysis)**:
```typescript
// Only run heuristics if no figure placeholders found
const heuristic = analyzeWithHeuristics(sectionId, sectionTitle, content);

// High confidence only if BOTH title AND content keywords match
const hasArchKeywords = hasTitleArchKeywords && hasContentArchKeywords;
const hasStrongArchContent = hasContentArchKeywords && (componentCount >= 3);

return {
  ...heuristic,
  isMandatory: false,
  confidence: hasArchKeywords || hasStrongArchContent ? 'high' : 'medium'
};
```

**Diagram ID Assignment**:
- **Mandatory**: Use figure reference ID (e.g., `{{fig:converged-service-edge}}` → `converged-service-edge`)
- **Suggested**: Use section-based ID (e.g., `2-1` for section 2, first diagram)

### Files Modified

**[src/services/ai/sectionAnalyzer.ts](src/services/ai/sectionAnalyzer.ts)** - Enhanced section analysis logic

**Key Changes**:

1. **Reduced Section Depth** (lines 33-38):
```typescript
// Before: depth <= 2 (analyzed ## and ### headings)
// After: depth === 1 (only analyze ## headings)
const relevantSections = sections.filter(s => {
  const depth = s.id.split('.').length;
  return depth === 1; // Only top-level sections (##)
});
```

**Why**: Level 3 headings (###) are typically subsections that don't need separate diagrams. Focus on major sections only.

2. **Stricter Keyword Matching** (lines 140-155):
```typescript
// Before: Title keywords OR content keywords (too permissive)
// After: Title keywords AND content keywords (stricter)
const hasArchKeywords = hasTitleArchKeywords && hasContentArchKeywords;
const hasProcKeywords = hasTitleProcKeywords && hasContentProcKeywords;
const hasFlowKeywords = hasTitleFlowKeywords && hasContentFlowKeywords;
const hasStateKeywords = hasTitleStateKeywords && hasContentStateKeywords;

// Special cases: Allow content-only if strong evidence
const hasStrongArchContent = hasContentArchKeywords &&
  (lowerContent.match(/component|interface|node|entity/g) || []).length >= 3;

const hasStrongProcContent = hasContentProcKeywords && hasNumberedSteps;
```

**Why**: Requiring both title and content keywords prevents false positives where a section mentions architecture in passing but isn't actually about architecture.

3. **Enhanced Confidence Scoring** (lines 165-202):
```typescript
const indicators = {
  architecture: hasArchKeywords || hasStrongArchContent,
  procedure: hasProcKeywords || hasStrongProcContent,
  flow: hasFlowKeywords || (hasTitleFlowKeywords && hasConditionals && hasNumberedSteps),
  state: hasStateKeywords
};
```

**Why**: Different diagram types need different evidence levels. Architecture needs multiple components (3+), procedures need numbered steps, flows need conditionals AND steps.

4. **Added Helper Functions** (lines 325-341):
```typescript
export function getMandatorySections(analyses: SectionAnalysis[]): SectionAnalysis[] {
  return analyses.filter(a => a.isMandatory);
}

export function getSuggestedSections(analyses: SectionAnalysis[]): SectionAnalysis[] {
  return analyses.filter(a =>
    !a.isMandatory &&
    a.diagramType !== 'none' &&
    a.confidence !== 'low'
  );
}
```

**Why**: Allows calling code to distinguish between mandatory and suggested diagrams for different UI treatment.

5. **Enhanced Interface** (lines 11-20):
```typescript
export interface SectionAnalysis {
  sectionId: string;
  sectionTitle: string;
  content: string;
  diagramType: 'block' | 'sequence' | 'flow' | 'state' | 'multiple' | 'none';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  figureReferences?: string[]; // NEW: Extracted {{fig:...}} placeholders
  isMandatory?: boolean;       // NEW: True if has figure placeholders
}
```

**[src/services/ai/AIService.ts](src/services/ai/AIService.ts)** - Diagram generation with figure reference IDs

**Key Changes**:

1. **Diagram ID Selection** (lines 681-694):
```typescript
// Use figure reference as diagram ID if available (mandatory diagrams)
// Otherwise use section-based ID (suggested diagrams)
const diagramId = section.figureReferences && section.figureReferences.length > 0
  ? section.figureReferences[0] // Use first figure reference as ID
  : `${section.sectionId}-1`;   // Fallback to section-based ID

console.log(`\n📐 [${currentDiagram}/${totalDiagrams}] ${section.isMandatory ? '[MANDATORY]' : '[SUGGESTED]'} ${section.sectionId}: ${section.sectionTitle}`);
```

**Why**: Mandatory diagrams use the figure reference ID from the spec, making the connection explicit. Suggested diagrams get auto-generated IDs.

## Analysis Heuristics

### Block Diagram Detection

**High Confidence**:
- Title contains "architecture", "component", "interface", "topology", etc.
- **AND** content also contains these keywords

**Medium Confidence**:
- Content has 3+ mentions of "component", "interface", "node", "entity"
- Even if title doesn't explicitly mention architecture

**Example Section That Generates Block Diagram**:
```markdown
## System Architecture

The converged service edge architecture includes the following components:
- PCEF (Policy and Charging Enforcement Function)
- PCRF (Policy and Charging Rules Function)
- PDN-GW (PDN Gateway)

The PCEF interfaces with the PCRF via the Gx reference point...
```

**Example Section That Does NOT Generate Block Diagram**:
```markdown
## References

This specification references the following 3GPP documents:
- TS 23.203: Policy and Charging Control Architecture
- TS 23.401: GPRS Enhancements for E-UTRAN
```
*(Contains "architecture" in content but title is "References" - correctly skipped)*

### Sequence Diagram Detection

**High Confidence**:
- Title contains "procedure", "call flow", "message", "sequence", etc.
- **AND** content also contains these keywords

**Medium Confidence**:
- Content has procedure keywords **AND** numbered steps (1., 2., 3., ...)
- Even if title doesn't explicitly mention procedures

**Example Section That Generates Sequence Diagram**:
```markdown
## Session Establishment Procedure

The following steps describe the bearer activation procedure:

1. UE sends PDN Connectivity Request to MME
2. MME validates the request and sends Create Session Request to S-GW
3. S-GW forwards Create Session Request to P-GW
4. P-GW interacts with PCRF via Gx interface to retrieve policy rules
5. P-GW sends Create Session Response back to S-GW
```

### Flow Diagram Detection

**Requirements**:
- Title contains "algorithm", "decision", "flowchart", "workflow", etc.
- **AND** content contains conditionals ("if", "when", "otherwise", "else")
- **AND** content has numbered steps

**Example**:
```markdown
## QoS Enforcement Algorithm

The PCEF applies the following logic:

1. If subscriber is premium tier, allocate GBR bearer
2. Otherwise, if traffic is video streaming, apply traffic shaping
3. Else, use default QoS profile
```

### State Diagram Detection

**Requirements**:
- Title or content contains "state machine", "state diagram", "state transition", "FSM", etc.

**Example**:
```markdown
## Bearer State Machine

The bearer transitions through the following states:
- INACTIVE: No resources allocated
- ACTIVATING: Resources being allocated
- ACTIVE: Bearer operational
- DEACTIVATING: Resources being released
```

## Sections That Are Always Skipped

These section titles are **never** considered for diagram generation:
- "Definitions"
- "Abbreviations"
- "References"
- "Scope"
- "Error Codes"
- "Error Messages"

**Reasoning**: These are informational sections that document terminology, references, or metadata - they don't describe system behavior or structure that needs visualization.

## Benefits

1. **Explicit Figure Alignment**: Diagrams with `{{fig:...}}` placeholders in the spec are ALWAYS generated, ensuring spec completeness
2. **Intelligent Suggestions**: Additional diagrams suggested based on content analysis, not blindly generated for every section
3. **Clear Distinction**: Mandatory vs suggested diagrams clearly labeled during generation
4. **Proper ID Mapping**: Mandatory diagrams use figure reference IDs, making spec-diagram relationship explicit
5. **Fewer, Higher-Quality Diagrams**: Only sections with meaningful visual content generate suggested diagrams
6. **Reduced AI Costs**: Fewer unnecessary diagram generation calls = lower token usage
7. **Better User Experience**: Review Panel shows only relevant diagrams, not clutter
8. **Aligned with Spec Structure**: Focuses on major sections (##) not subsections (###)
9. **Smarter Detection**: Considers both title AND content, not just keywords

## User Guidance Integration

The diagram generation modal still supports **user guidance** to override or guide the AI:

```markdown
Additional Guidance for AI (Optional):
• Focus on the converged service edge architecture only
• Show message flows between PCRF and PCEF only
• Highlight the 5G-NSA (Non-Standalone) architecture components
```

This allows users to:
- **Narrow focus**: "Only generate diagrams for the S-GW interfaces"
- **Clarify context**: "This is a 5G-NSA deployment, not 5G-SA"
- **Specify details**: "Use vendor-specific component names from the spec"

## Example Analysis Output

Given a Technical Specification with these sections:

```markdown
## Scope (depth 1)
## References (depth 1)
## Definitions and Abbreviations (depth 1)
## System Architecture (depth 1)

The converged service edge architecture is shown in {{fig:converged-service-edge}}.

The architecture includes the following components:
- PCEF (Policy and Charging Enforcement Function)
- PCRF (Policy and Charging Rules Function)
- PDN-GW (PDN Gateway)

### Network Components (depth 2)
### Reference Points (depth 2)
## Session Establishment Procedure (depth 1)

The following diagram shows the session establishment flow: {{fig:session-flow}}.

1. UE sends PDN Connectivity Request to MME
2. MME validates the request and sends Create Session Request to S-GW
3. S-GW forwards Create Session Request to P-GW

### Bearer Activation (depth 2)
### Policy Rule Retrieval (depth 2)
## QoS Policy Enforcement (depth 1)

The PCEF applies QoS rules based on subscriber tier and traffic type.
Components involved: PCEF, PCRF, P-GW.

## Error Handling (depth 1)
## Error Codes and Messages (depth 1)
```

**Before (Too Many Diagrams)**:
- Analyzed 10 sections (depth <= 2: all ## and ###)
- Generated 8 diagrams (even for "References", "Error Codes", subsections)
- No distinction between explicit requests and heuristic suggestions

**After (Two-Tier System)**:
- Analyzed 7 sections (depth === 1: only ##)
- Generated diagrams:
  - **System Architecture** → Block Diagram **[MANDATORY]** (has `{{fig:converged-service-edge}}` placeholder, ID: `converged-service-edge`)
  - **Session Establishment Procedure** → Sequence Diagram **[MANDATORY]** (has `{{fig:session-flow}}` placeholder, ID: `session-flow`)
  - **QoS Policy Enforcement** → Block Diagram **[SUGGESTED]** (heuristic detected: 3+ components mentioned, ID: `5-1`)
- Skipped:
  - **Scope** (informational section, no figure placeholder)
  - **References** (informational section, no figure placeholder)
  - **Definitions and Abbreviations** (informational section, no figure placeholder)
  - **Error Handling** (no figure placeholder, no strong heuristic match)
  - **Error Codes and Messages** (informational section, no figure placeholder)
  - Subsections (###) not analyzed individually

**Logging Output**:
```
📌 2 System Architecture: MANDATORY - Found 1 figure placeholder(s): converged-service-edge
📌 3 Session Establishment Procedure: MANDATORY - Found 1 figure placeholder(s): session-flow
💡 5 QoS Policy Enforcement: SUGGESTED - Has architecture keywords and 3+ components
📐 [1/3] [MANDATORY] 2: System Architecture
   Reason: MANDATORY: Contains 1 figure placeholder(s): converged-service-edge
✅ Block diagram generated (MANDATORY): System Architecture → ID: converged-service-edge
📐 [2/3] [MANDATORY] 3: Session Establishment Procedure
   Reason: MANDATORY: Contains 1 figure placeholder(s): session-flow
✅ Sequence diagram generated (MANDATORY): Session Establishment Procedure → ID: session-flow
📐 [3/3] [SUGGESTED] 5: QoS Policy Enforcement
   Reason: SUGGESTED: Has architecture keywords and 3+ components
✅ Block diagram generated (SUGGESTED): QoS Policy Enforcement → ID: 5-1
```

## Technical Details

### Section Depth Calculation

```typescript
const depth = s.id.split('.').length;
// "1" → depth 1 (## heading)
// "1.1" → depth 2 (### heading)
// "1.1.1" → depth 3 (#### heading)
```

### Keyword Categories

**Architecture Keywords**:
- architecture, component, interface, topology, network element
- deployment, reference point, functional element, node, entity

**Procedure Keywords**:
- procedure, call flow, message, sequence, step, signaling
- protocol, handshake, request, response, session establishment

**Flow Keywords**:
- algorithm, decision, flow chart, flowchart, process flow
- if-then, condition, branch, logic flow, workflow

**State Keywords**:
- state machine, state diagram, state transition, fsm
- state model, mode, status, transition, state change

## Future Enhancements

### Possible Improvements

1. **Automatic Figure Reference Insertion** (HIGH PRIORITY):
   - When a suggested diagram is approved, automatically insert `{{fig:diagram-id}}` reference into the Technical Specification
   - Options for insertion location:
     - Beginning of section (before content)
     - End of section (after content)
     - AI-determined best location (contextually appropriate sentence)
   - User confirmation before insertion
   - Example: "Insert reference to {{fig:5-1}} in QoS Policy Enforcement section?"

2. **AI-Based Section Analysis**:
   - Use AI for **all** sections (not just low-confidence ones)
   - More accurate than keyword heuristics
   - Higher token cost but better accuracy

3. **User Preferences**:
   - "Generate diagrams for level 3 headings (###) too"
   - "Only generate diagrams for architecture sections"
   - Save preferences per project
   - Toggle mandatory-only mode (skip suggested diagrams entirely)

4. **Diagram Quality Scoring**:
   - After generating, score diagram quality (how useful/clear it is)
   - Learn which sections produce good diagrams vs. poor ones
   - Refine heuristics based on feedback

5. **Multi-Diagram Sections**:
   - Some sections might need **both** block and sequence diagrams
   - Example: "Architecture" section with components (block) and initialization flow (sequence)
   - Currently generates only one diagram type per section
   - Support multiple `{{fig:...}}` placeholders in a single section

6. **Figure Reference Validation**:
   - Detect orphaned figure references ({{fig:...}} with no corresponding diagram)
   - Detect unreferenced diagrams (diagrams with no {{fig:...}} in spec)
   - Show validation warnings in Review Panel

## Related Documentation

- [PHASE3_PROGRESS.md](PHASE3_PROGRESS.md) - Diagram editing status
- [DIAGRAM_GENERATION_GUIDANCE_FEATURE.md](DIAGRAM_GENERATION_GUIDANCE_FEATURE.md) - User guidance feature
- [DIAGRAM_REVIEW_ENHANCEMENT.md](DIAGRAM_REVIEW_ENHANCEMENT.md) - Visual diagram preview in Review Panel
- [src/services/ai/sectionAnalyzer.ts](src/services/ai/sectionAnalyzer.ts) - Section analysis implementation

## Conclusion

The enhanced intelligent diagram generation system now produces **fewer, more relevant diagrams** through a **two-tier approach**:

**Mandatory Diagrams** (Always Generated):
- Triggered by explicit `{{fig:...}}` placeholders in the Technical Specification
- Use figure reference ID as diagram ID for explicit linking
- Always marked as high confidence
- Ensures all explicitly requested diagrams are generated

**Suggested Diagrams** (Heuristic-Based):
- Focusing on major sections (##) only
- Requiring strong evidence (title AND content keywords)
- Skipping informational sections automatically
- Using special heuristics for architecture (3+ components) and procedures (numbered steps)
- Marked as suggested for user review

**Key Benefits**:
- **Spec Alignment**: Diagrams align with explicit figure references in the Technical Specification
- **Completeness**: All `{{fig:...}}` placeholders result in diagrams
- **Intelligence**: Additional diagrams suggested based on content analysis
- **Clarity**: Clear distinction between mandatory and suggested diagrams
- **Quality**: Only high-confidence suggested diagrams are generated

This results in a cleaner, more useful set of diagrams that truly reflect the Technical Specification's visual content needs, with mandatory diagrams ensuring spec completeness and suggested diagrams adding value where appropriate.
