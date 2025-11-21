# TODO Comment Extraction Feature

**Status**: ✅ **COMPLETE** (2025-11-19)

## Overview

Enhanced the diagram generation system to extract and use TODO comments associated with figure placeholders in the Technical Specification. This ensures that AI-generated diagrams follow the detailed requirements specified in HTML comments next to `{{fig:...}}` placeholders.

## Problem Solved

### Before
- Figure placeholders (`{{fig:...}}`) triggered diagram generation
- TODO comments with detailed diagram requirements were ignored
- AI generated diagrams based only on surrounding text content
- Diagrams didn't match the specific requirements documented in TODO comments

### After
- TODO comments associated with figure placeholders are extracted
- Diagram requirements are passed to AI as additional guidance
- AI generates diagrams that match the detailed specifications
- Clear logging shows when TODO instructions are being used

## Implementation

### Files Modified

1. **[src/services/ai/sectionAnalyzer.ts](src/services/ai/sectionAnalyzer.ts)**
   - Added `todoComments?: string[]` field to `SectionAnalysis` interface
   - Created `extractTodoComments()` function
   - Enhanced logging to show TODO comments

2. **[src/services/ai/AIService.ts](src/services/ai/AIService.ts)**
   - Combined user guidance with TODO comments
   - Passed combined guidance to diagram generation functions
   - Enhanced logging to indicate when TODO instructions are used

### Key Changes

#### 1. Interface Update (sectionAnalyzer.ts, lines 11-21)

```typescript
export interface SectionAnalysis {
  sectionId: string;
  sectionTitle: string;
  content: string;
  diagramType: 'block' | 'sequence' | 'flow' | 'state' | 'multiple' | 'none';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  figureReferences?: string[]; // {{fig:...}} placeholders found in this section
  isMandatory?: boolean; // true if section has explicit figure placeholders
  todoComments?: string[]; // NEW: TODO comments associated with figure placeholders
}
```

#### 2. TODO Comment Extraction (sectionAnalyzer.ts, lines 89-114)

```typescript
/**
 * Extract TODO comments associated with figure placeholders
 * Looks for HTML comments (<!-- TODO: ... -->) that appear on the same line or within 2 lines after {{fig:...}}
 */
function extractTodoComments(content: string): string[] {
  const todos: string[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line contains a {{fig:...}} placeholder
    if (/\{\{fig:[^}]+\}\}/.test(line)) {
      // Look for TODO comment on same line or next 2 lines
      for (let j = i; j <= Math.min(i + 2, lines.length - 1); j++) {
        const todoMatch = lines[j].match(/<!--\s*TODO:\s*(.+?)\s*-->/);
        if (todoMatch) {
          todos.push(todoMatch[1].trim());
          break; // Only take first TODO after this figure
        }
      }
    }
  }

  return todos;
}
```

**How it works**:
- Searches for lines containing `{{fig:...}}` placeholders
- Checks the same line and next 2 lines for HTML comments
- Extracts text between `<!-- TODO:` and `-->`
- Returns array of TODO comment texts

#### 3. Enhanced Section Analysis (sectionAnalyzer.ts, lines 125-149)

```typescript
// FIRST: Check for explicit figure references ({{fig:...}})
const figureReferences = extractFigureReferences(content);
const todoComments = extractTodoComments(content);

if (figureReferences.length > 0) {
  console.log(`📌 ${sectionId} ${sectionTitle}: MANDATORY - Found ${figureReferences.length} figure placeholder(s): ${figureReferences.join(', ')}`);
  if (todoComments.length > 0) {
    console.log(`   📝 TODO instructions found: ${todoComments.length} comment(s)`);
    todoComments.forEach((todo, idx) => {
      console.log(`      ${idx + 1}. ${todo.substring(0, 100)}${todo.length > 100 ? '...' : ''}`);
    });
  }

  // Determine diagram type from content
  const heuristic = analyzeWithHeuristics(sectionId, sectionTitle, content);

  return {
    ...heuristic,
    figureReferences,
    todoComments: todoComments.length > 0 ? todoComments : undefined,
    isMandatory: true,
    confidence: 'high',
    reasoning: `MANDATORY: Contains ${figureReferences.length} figure placeholder(s): ${figureReferences.join(', ')}. ${heuristic.reasoning}`
  };
}
```

#### 4. Combined Guidance for Block Diagrams (AIService.ts, lines 698-710)

```typescript
// Combine user guidance with TODO comments
let combinedGuidance = userGuidance || '';
if (section.todoComments && section.todoComments.length > 0) {
  const todoGuidance = section.todoComments.join('\n\n');
  combinedGuidance = combinedGuidance
    ? `${combinedGuidance}\n\n**IMPORTANT - Diagram Requirements from Specification:**\n${todoGuidance}`
    : `**IMPORTANT - Diagram Requirements from Specification:**\n${todoGuidance}`;
}

const blockOptions: any = { maxTokens, userGuidance: combinedGuidance };
if (isReasoning) {
  blockOptions.reasoning = { effort: 'high' };
}
```

**Priority**: TODO comments are marked as **IMPORTANT** and labeled as requirements from the specification, ensuring AI gives them high priority.

#### 5. Combined Guidance for Sequence Diagrams (AIService.ts, lines 766-778)

```typescript
// Combine user guidance with TODO comments
let combinedGuidance = userGuidance || '';
if (section.todoComments && section.todoComments.length > 0) {
  const todoGuidance = section.todoComments.join('\n\n');
  combinedGuidance = combinedGuidance
    ? `${combinedGuidance}\n\n**IMPORTANT - Diagram Requirements from Specification:**\n${todoGuidance}`
    : `**IMPORTANT - Diagram Requirements from Specification:**\n${todoGuidance}`;
}

const seqOptions: any = { maxTokens, userGuidance: combinedGuidance };
if (isReasoning) {
  seqOptions.reasoning = { effort: 'high' };
}
```

#### 6. Enhanced Logging (AIService.ts)

**Block Diagrams** (lines 688-690):
```typescript
if (section.todoComments && section.todoComments.length > 0) {
  console.log(`   📝 Using TODO instructions (${section.todoComments.length})`);
}
```

**Sequence Diagrams** (lines 756-758):
```typescript
if (section.todoComments && section.todoComments.length > 0) {
  console.log(`   📝 Using TODO instructions (${section.todoComments.length})`);
}
```

## Example Usage

### Technical Specification Format

```markdown
## System Architecture

The converged service edge architecture is shown in {{fig:architecture-overview}}
*Figure 4.1-1: High-level PCC Architecture for 5G Private Line over EPC*
<!-- TODO: High-level block diagram showing: UE/CPE via 3G/LTE/5G-NR (NSA) to EPC (MME/S-GW/P-GW); BNG/BRAS for fixed; central PCRF; TDF/PCEF compound node with TDF, PCEF, Gy/Gz; OCS/OFCS; CRM/BSS as provisioning system. Clearly indicate Gx, Sd, Gy, Gz, RADIUS, and that Gy/Gz exist only between TDF/PCEF and OCS/OFCS. -->

The architecture includes the following components...
```

### Console Logging Output

```
📌 2 System Architecture: MANDATORY - Found 1 figure placeholder(s): architecture-overview
   📝 TODO instructions found: 1 comment(s)
      1. High-level block diagram showing: UE/CPE via 3G/LTE/5G-NR (NSA) to EPC (MME/S-GW/P-GW); BNG/B...

📐 [1/3] [MANDATORY] 2: System Architecture
   Reason: MANDATORY: Contains 1 figure placeholder(s): architecture-overview
   📝 Using TODO instructions (1)
✅ Block diagram generated (MANDATORY): System Architecture → ID: architecture-overview
```

### AI Prompt Enhancement

The TODO comment is passed to the AI as:

```
User Guidance (if any)

**IMPORTANT - Diagram Requirements from Specification:**
High-level block diagram showing: UE/CPE via 3G/LTE/5G-NR (NSA) to EPC (MME/S-GW/P-GW); BNG/BRAS for fixed; central PCRF; TDF/PCEF compound node with TDF, PCEF, Gy/Gz; OCS/OFCS; CRM/BSS as provisioning system. Clearly indicate Gx, Sd, Gy, Gz, RADIUS, and that Gy/Gz exist only between TDF/PCEF and OCS/OFCS.
```

## Benefits

1. **Specification Alignment**: Diagrams match detailed requirements documented in spec
2. **Explicit Requirements**: TODO comments provide precise instructions for AI
3. **No Manual Copy-Paste**: Requirements automatically extracted and applied
4. **Clear Attribution**: Logging shows when TODO instructions are used
5. **Priority Handling**: TODO comments marked as IMPORTANT for AI attention
6. **Flexible Format**: Works with both user guidance AND TODO comments

## Technical Details

### TODO Comment Format

**Pattern**: `<!-- TODO: ... -->`

**Location**: Same line or within 2 lines after `{{fig:...}}` placeholder

**Multiple TODOs**: If multiple figure placeholders exist in a section, each can have its own TODO comment

### Extraction Algorithm

1. Split content into lines
2. Find lines with `{{fig:...}}` pattern
3. Check same line and next 2 lines for `<!-- TODO: ... -->`
4. Extract text between `TODO:` and `-->`
5. Trim whitespace and store

### Priority in AI Prompts

TODO comments are:
- Labeled as "IMPORTANT"
- Marked as "Diagram Requirements from Specification"
- Appended after user guidance (if any)
- Passed to both block and sequence diagram generation

## Future Enhancements

### Possible Improvements

1. **Support for Multiple Comment Formats**:
   - Support `// TODO:` for markdown code blocks
   - Support multi-line TODO comments
   - Support structured TODO comments (JSON format)

2. **Validation**:
   - Warn if figure placeholder has no TODO comment
   - Suggest adding TODO comments for better diagram quality
   - Validate TODO comment structure

3. **UI Integration**:
   - Show TODO comments in Review Panel
   - Allow editing TODO comments before diagram generation
   - Highlight when TODO instructions were followed

4. **Smart Extraction**:
   - Use AI to extract requirements from surrounding paragraphs
   - Combine explicit TODO comments with inferred requirements
   - Validate that generated diagram matches TODO requirements

## Related Documentation

- [INTELLIGENT_DIAGRAM_GENERATION.md](INTELLIGENT_DIAGRAM_GENERATION.md) - Two-tier diagram generation system
- [DIAGRAM_GENERATION_GUIDANCE_FEATURE.md](DIAGRAM_GENERATION_GUIDANCE_FEATURE.md) - User guidance feature
- [../sessions/SESSION_2025-11-19_SUMMARY.md](../sessions/SESSION_2025-11-19_SUMMARY.md) - Session summary with diagram preview

## Testing

### Test Cases

1. **Single TODO Comment**:
   - Figure placeholder with TODO on same line
   - Verify extraction and logging
   - Verify diagram matches requirements

2. **TODO on Next Line**:
   - Figure placeholder with TODO on next line
   - Verify extraction (within 2-line window)

3. **Multiple Figure Placeholders**:
   - Section with 2+ figure placeholders
   - Each with different TODO comment
   - Verify correct association

4. **No TODO Comment**:
   - Figure placeholder without TODO
   - Verify diagram generation still works
   - Only uses section content and user guidance

5. **Combined with User Guidance**:
   - User provides guidance in modal
   - TODO comment also present
   - Verify both are combined correctly

## Conclusion

The TODO comment extraction feature ensures that AI-generated diagrams follow the detailed specifications documented alongside figure placeholders in the Technical Specification. This provides a seamless way for spec authors to define precise diagram requirements without needing to manually copy requirements into the generation modal.

**Key Advantages**:
- **Automatic**: No manual intervention required
- **Precise**: Detailed requirements directly from spec
- **Traceable**: Clear logging shows when TODO instructions are used
- **Flexible**: Works alongside user guidance
- **Non-invasive**: Doesn't break existing workflow
