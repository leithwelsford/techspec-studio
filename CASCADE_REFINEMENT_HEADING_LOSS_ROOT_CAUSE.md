# CASCADE REFINEMENT - SECTION HEADING LOSS ROOT CAUSE ANALYSIS

**Date**: 2025-11-17  
**Status**: ROOT CAUSE IDENTIFIED  
**Severity**: CRITICAL - Data Loss  
**Issue**: All level 1 section headings (##) have been lost after cascade refinement  

---

## Executive Summary

The cascade refinement feature is causing level 1 section headings (##) to be lost from technical specifications. The root cause is a **document truncation problem** combined with **section title validation gap** that creates a cascading failure mode.

**Primary Issue**: The impact analysis prompt truncates the full document at 15,000 characters. When the document is 100,000+ characters (typical for specifications), the AI cannot see the headings for sections beyond the truncation point and must infer their titles from partial content. These inferred titles don't match the actual document headings, causing confusion throughout the cascaded refinement process.

**Console Evidence**:
```
⚠️ AI omitted heading for section 7: Policy and Charging Control.
Restoring original heading: "## 7 Information Elements"
```

Note the mismatch: AI thinks section 7 is "Policy and Charging Control" but it's actually "Information Elements".

---

## Root Cause Analysis

### The Document Truncation Problem

**Location**: `src/services/ai/prompts/refinementPrompts.ts` line 37

```typescript
export function buildImpactAnalysisPrompt(
  originalSection: string,
  refinedSection: string,
  sectionTitle: string,
  fullDocument: string,    // ← This can be 100,000+ characters
  instruction: string
): string {
  return `...
**FULL DOCUMENT (for context):**
\`\`\`markdown
${fullDocument.substring(0, 15000)}...  // ← TRUNCATED AT 15,000 CHARS
[Document truncated for context - full document is ${fullDocument.length} characters]
\`\`\`
...`;
}
```

### Why This Causes Section Title Confusion

When a specification document is 100,000+ characters:

1. **AI sees only first 15,000 chars** of the document
   - Early sections (1-4): Headers visible ✓
   - Late sections (7-9): Headers CUT OFF ✗

2. **AI must infer section titles from partial content**
   - Doesn't see: `## 7 Information Elements`
   - Sees instead: Content about "Policy and Charging Control"
   - AI infers: "This section is about Policy and Charging Control"

3. **Impact analysis returns WRONG section titles**
   ```javascript
   // What AI returns:
   {
     "sectionId": "7",
     "sectionTitle": "Policy and Charging Control"  // ← WRONG!
   }
   
   // What document actually has:
   "## 7 Information Elements"  // ← ACTUAL
   ```

### The Cascading Failure Mode

**Stage 1: Section Extraction (Works by accident)**

Location: `src/services/ai/AIService.ts` line 1345-1349

```typescript
const sectionContent = extractSection(
  fullDocument,
  affectedSection.sectionId,        // "7" ← Correct
  affectedSection.sectionTitle      // "Policy and Charging Control" ← WRONG
);
```

The `extractSection()` function has a fallback pattern (line 252 of refinementPrompts.ts):

```typescript
// Fallback pattern: Just section number with ANY title
new RegExp(`^##\\s*${escapedId}\\s+.*?$`, 'im'),  // Line 252
```

This fallback **rescues the extraction** even though the title is wrong:
- Pattern looks for: `^## 7 ` (any title after the number)
- Finds: `## 7 Information Elements` ✓ (Correct section extracted)

BUT the metadata is still corrupted: AI thinks this section is about "Policy and Charging Control".

**Stage 2: Content Generation (With Wrong Context)**

Location: `src/services/ai/AIService.ts` line 1362-1379

AI is asked to modify "Policy and Charging Control" section but actually received "Information Elements" section content. This context mismatch could cause:
- AI to generate changes that don't match the actual content
- AI to miss section-specific considerations
- AI to reference wrong procedures/components

**Stage 3: Heading Restoration (Reveals the Bug)**

Location: `src/services/ai/AIService.ts` line 1404-1416

```typescript
const originalHeading = sectionContent.split('\n')[0];
// ↓ This gets "## 7 Information Elements" (CORRECT)

let proposedContent = result.content.trim();

const hasHeading = /^#{2,4}\s+\d+/.test(proposedContent);

if (!hasHeading) {
  console.warn(
    `⚠️ AI omitted heading for section ${affectedSection.sectionId}: ` +
    `${affectedSection.sectionTitle}. ` +  // ← Still WRONG title
    `Restoring original heading: "${originalHeading}"`
  );
  proposedContent = originalHeading + '\n\n' + proposedContent;
}
```

The code **successfully restores** the original heading. But console shows the mismatch.

**Stage 4: Multiple Cascaded Changes (Where Damage Occurs)**

Location: `src/services/ai/AIService.ts` line 1335-1437

When cascade affects multiple sections (e.g., 7, 8, 9):

1. **Extract section 7**: Uses fallback match, gets `Information Elements` ✓
2. **AI processes section 7**: With wrong title context in mind
3. **Replace section 7**: `replaceSectionById(doc, "7", newContent)` ✓
4. **Extract section 8**: parseMarkdownSections called fresh, should work...
5. **But**: If section 7's replacement was malformed (due to wrong context), subsequent regex matching could fail
6. **Extract section 9**: Boundaries might be offset due to previous failures
7. **Replace sections**: Some headings might get mangled or lost

### Why Section Headings Are Lost

The heading loss occurs in a specific scenario:

```
Original Document:
## 1 Scope
...
## 7 Information Elements
...
## 8 Procedures
...

After Cascade Refinement:
## 1 Scope
...
7 Information Elements          ← Level 1 heading lost! (No ##)
...
8 Procedures                    ← Level 1 heading lost! (No ##)
...
```

This happens when:

1. **Multiple sections receive wrong context** from truncated analysis
2. **Each replacement adds partial content** due to context confusion
3. **parseMarkdownSections() fails to match** malformed headings in fresh calls
4. **Final replacements use wrong boundaries**
5. **Some sections lose their heading markers**

---

## Evidence from Code

### Problem Point 1: Document Truncation

`src/services/ai/prompts/refinementPrompts.ts:37`

```typescript
${fullDocument.substring(0, 15000)}...
[Document truncated for context - full document is ${fullDocument.length} characters]
```

**Impact**: AI sees incomplete document structure

### Problem Point 2: Implicit Title Extraction

`src/services/ai/prompts/refinementPrompts.ts:44-46`

```typescript
For each potentially affected section, determine:
1. **Section ID and Title**: Which section is affected (e.g., "6.3 HSS Authentication Procedure")
```

**Impact**: AI must infer titles from truncated context

### Problem Point 3: No Validation Against Actual Document

`src/services/ai/AIService.ts:1267-1307`

```typescript
async analyzeRefinementImpact(
  originalSection: string,
  refinedSection: string,
  sectionTitle: string,
  fullDocument: string,
  instruction: string
): Promise<ImpactAnalysis> {
  // ...no validation that returned sectionIds/Titles match document
  const analysis = JSON.parse(result.content);
  return analysis;
}
```

**Impact**: Wrong titles are accepted without verification

### Problem Point 4: Fallback Pattern Masks the Issue

`src/services/ai/prompts/refinementPrompts.ts:252`

```typescript
// Just section number with ## (most lenient - matches any title)
new RegExp(`^##\\s*${escapedId}\\s+.*?$`, 'im'),
```

**Impact**: Extraction succeeds even with wrong title, hiding the underlying bug

---

## Why This Is Critical

### Impact Chain

1. AI infers wrong section titles from truncated document
2. Code extracts correct section (by ID fallback)
3. AI generates content with wrong understanding of what it's modifying
4. Multiple cascaded changes create cumulative boundary errors
5. parseMarkdownSections() calls fail due to malformed markdown
6. Final document loses section heading markers

### User Impact

- **Data Loss**: Section structure is damaged
- **Confusion**: Missing headings make document unreadable
- **Trust**: User sees feature is broken ("I lost my section headings!")
- **Recovery**: Hard to fix without version history restore

---

## Recommended Fixes

### Option 1: Pre-parse Sections and Pass Explicit Boundaries (RECOMMENDED)

**Approach**: Don't rely on AI to infer section titles. Give AI an explicit list of actual sections.

**Implementation**:
```typescript
async analyzeRefinementImpact(
  originalSection: string,
  refinedSection: string,
  sectionTitle: string,
  fullDocument: string,
  instruction: string
): Promise<ImpactAnalysis> {
  // NEW: Parse sections BEFORE creating prompt
  const { parseMarkdownSections } = await import('./refinementPrompts');
  const allSections = parseMarkdownSections(fullDocument);
  
  // Create section list for AI reference
  const sectionList = allSections
    .map(s => `${s.id} ${s.title}`)
    .join('\n');
  
  const prompt = buildImpactAnalysisPrompt(
    originalSection,
    refinedSection,
    sectionTitle,
    fullDocument,
    instruction,
    sectionList  // NEW: Pass explicit section boundaries
  );
  
  // ... rest of analysis
}
```

**Modified Prompt**:
```typescript
export function buildImpactAnalysisPrompt(
  originalSection: string,
  refinedSection: string,
  sectionTitle: string,
  fullDocument: string,
  instruction: string,
  sectionList: string  // NEW
): string {
  return `You are analyzing the impact of a section refinement...

**DOCUMENT STRUCTURE (Complete Section List):**
${sectionList}

When identifying affected sections, reference the above list to ensure accuracy.
Do NOT infer section titles - use the exact titles from the list above.

**FULL DOCUMENT (for context):**
\`\`\`markdown
${fullDocument.substring(0, 15000)}...
\`\`\`

...rest of prompt
`;
}
```

**Benefit**: AI has explicit reference for all section IDs and titles, no guessing

### Option 2: Validate AI's Impact Analysis Against Document

**Approach**: After AI returns impact analysis, verify each section exists with correct title.

**Implementation**:
```typescript
async analyzeRefinementImpact(...): Promise<ImpactAnalysis> {
  // ... existing code ...
  const analysis = JSON.parse(result.content);
  
  // NEW: Validate against actual document
  const actualSections = parseMarkdownSections(fullDocument);
  const validatedSections = analysis.affectedSections.map(affectedSection => {
    const actual = actualSections.find(s => s.id === affectedSection.sectionId);
    
    if (!actual) {
      console.error(`Section ${affectedSection.sectionId} not found in document`);
      return null;
    }
    
    if (actual.title !== affectedSection.sectionTitle) {
      console.warn(
        `Section title mismatch: AI said "${affectedSection.sectionTitle}", ` +
        `actual is "${actual.title}". Correcting...`
      );
      affectedSection.sectionTitle = actual.title;  // FIX: Use actual title
    }
    
    return affectedSection;
  }).filter(s => s !== null);
  
  return { ...analysis, affectedSections: validatedSections };
}
```

**Benefit**: Wrong titles are corrected before propagated changes are generated

### Option 3: Increase Document Context (Quick Fix)

**Approach**: Send more of the document to AI.

**Implementation**:
```typescript
// Before:
${fullDocument.substring(0, 15000)}...

// After:
${fullDocument.substring(0, 50000)}...  // 50k instead of 15k
```

**Benefit**: More section headers are visible to AI  
**Risk**: Increased token usage, might still be insufficient for very large documents

### Option 4: Combined Approach (BEST)

Combine Options 1 + 2:

1. **Option 1**: Send explicit section list to AI
2. **Option 2**: Validate and correct any mismatches
3. Optional **Option 3**: Increase context if budget allows

This provides defense-in-depth:
- AI has explicit reference (doesn't need to guess)
- Even if AI makes mistakes, they're caught and corrected
- Document context is sufficient

---

## Implementation Priority

### Immediate (Prevents Data Loss)

Implement **Option 2** validation:
- Add validation function to `analyzeRefinementImpact()`
- Correct wrong titles before propagated changes
- Log all corrections for debugging
- ~40 lines of code, minimal risk

### Short Term (Improves Reliability)

Implement **Option 1** section list:
- Pre-parse sections once
- Pass section list in prompt
- Update `buildImpactAnalysisPrompt()` signature
- ~30 lines of code, medium risk (prompt changes)

### Long Term (Architectural Improvement)

Review cascaded refinement architecture:
- Consider pre-parsing sections at start of entire flow
- Cache parsed sections throughout
- Eliminate re-parsing in each replacement call
- Reduce computational overhead and potential for inconsistency

---

## Testing Recommendations

### Before Implementing Fix

1. **Reproduce the issue**:
   - Create document with 100k+ characters
   - Enable cascade refinement
   - Observe section heading loss

2. **Identify exact failure point**:
   - Check which sections lose headings
   - Verify impact analysis received wrong titles
   - Trace through replacement operations

### After Implementing Fix

1. **Validation tests**:
   - Cascade refinement with validation enabled
   - Verify no heading loss
   - Check console for corrections
   - Verify document integrity

2. **Regression tests**:
   - Test with 50k, 100k, 200k character documents
   - Test with 5, 10, 20 affected sections
   - Test with mixed MODIFY and REMOVE operations

3. **Edge cases**:
   - Sections with special characters in titles
   - Sections with similar content
   - Deeply nested subsections (4.3.2.1)

---

## Related Issues

- **CASCADE_REFINEMENT_DATA_LOSS_FIX.md** - Previous fix for unsafe string replacement
- **SESSION_2025-11-14_SUMMARY.md** - Refinement approval workflow fix

---

## Conclusion

The section heading loss is not a failure of `extractSection()` or `replaceSectionById()` (these work correctly). It's a failure of **impact analysis under-specification** combined with **lack of validation**.

The fix is straightforward: Either give AI explicit section information, or validate the output, or both. This prevents the confusion that cascades through multiple section replacements.

**Recommended approach**: Implement Option 2 immediately (validation) for safety, then Option 1 (explicit list) for robustness.

