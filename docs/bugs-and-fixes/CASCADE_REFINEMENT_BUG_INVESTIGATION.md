# Cascade Refinement Section Not Found Bug Analysis

## Error Summary
When applying cascade refinement changes, users see:
```
Failed to modify section 1.2: Document Structure. Continuing with other changes.
```

This means `replaceSectionById()` returned `null`, indicating section "1.2" could not be found in the document.

## Root Cause Investigation

### The Problem Scenario
1. User selects section "### 1.2 Document Structure" and requests cascade refinement
2. AI analyzes impact and identifies 3 sections needing changes: [1.2 (primary), 6.3 (remove), 5.2 (modify)]
3. Primary change is applied successfully to section 1.2
4. When trying to apply propagated change to section 6.3, it FAILS with "section not found"

### Why Section 1.2 Disappears

The issue is in how `replaceSectionById()` handles the `newContent` parameter:

#### Step-by-step failure:
```
1. Original document has section 1.2 with heading:
   ### 1.2 Document Structure
   [old content]

2. extractSection() returns:
   sectionContent = "### 1.2 Document Structure\n[old content]"

3. buildPropagationPrompt() shows this to AI and asks:
   "Begin your response with the section heading and include all content"

4. BUT: If AI response doesn't include the heading, proposedContent is:
   "[new content without heading]"

5. replaceSectionById() receives newContent without heading and replaces:
   ### 1.2 Document Structure    <-- REMOVED
   [new content]

6. Next call to replaceSectionById() to parse sections finds NO heading for 1.2
   parseMarkdownSections() looks for: /^(#{2,4})\s+(\d+(?:\.\d+)*)\s+/
   Without heading line, section 1.2 is NOT FOUND
```

## Detailed Code Analysis

### File: `/work/src/services/ai/prompts/refinementPrompts.ts`

**Function: `parseMarkdownSections()` (lines 289-345)**
- Regex pattern (line 307): `/^(#{2,4})\s+(\d+(?:\.\d+)*)\s+(.+?)$/gm`
- This regex REQUIRES heading markers (#, ##, ###, ####)
- If a section has no heading, it's not matched and not included in results

**Function: `replaceSectionById()` (lines 358-376)**
- Uses `parseMarkdownSections()` to find section
- If section not found (line 366), returns null
- Doesn't validate that `newContent` includes a heading

**Function: `extractSection()` (lines 233-283)**
- Returns section content INCLUDING the heading line
- Example: `"### 1.2 Document Structure\nContent here"`

### File: `/work/src/services/ai/AIService.ts`

**Function: `generatePropagatedChanges()` (lines 1313-1420)**
- Calls `extractSection()` to get current section (line 1345-1349)
- Passes to `buildPropagationPrompt()` which includes the heading
- Stores result as-is: `proposedContent: result.content.trim()` (line 1406)
- **BUG**: Doesn't validate that result includes the heading

### File: `/work/src/components/ai/ReviewPanel.tsx`

**Cascade refinement application (lines 234-327)**
- Line 278-282: Calls `replaceSectionById(updatedMarkdown, change.sectionId, change.proposedContent)`
- If `proposedContent` lacks heading, the replacement removes it
- Subsequent section replacements fail because heading is gone

## Regex Pattern Analysis

The heading regex works correctly:
```javascript
/^(#{2,4})\s+(\d+(?:\.\d+)*)\s+(.+?)$/gm
```

Examples that MATCH:
- ✅ `## 1 Scope`
- ✅ `### 1.2 Document Structure`
- ✅ `#### 1.2.1 Overview`
- ✅ `### 6.3 HSS Authentication Procedure`

Examples that DON'T MATCH (if AI includes them):
- ❌ `Document Structure` (no heading markers)
- ❌ `This section describes...` (no heading markers)

## Section Boundary Detection

The boundary detection logic is correct:
```typescript
const headingLevel = (match[0].match(/^#+/)?.[0].length) || 2;
const endPattern = new RegExp(`^#{1,${headingLevel}}[^#]`, 'm');
```

This correctly identifies:
- Level 3 heading (###) should find next section at level 1-3 or higher
- Ignores sub-sections (#### level 4) when looking for section boundaries
- Pattern `^#{1,3}[^#]` correctly matches 1-3 hashes, NOT 4 hashes

## Why Section 1.2 Specifically Fails

The error message mentions "1.2: Document Structure", suggesting:
1. AI correctly identified 1.2 as needing modification
2. But the proposed content may have been stripped of its heading
3. When applied, the heading `### 1.2 Document Structure` was removed
4. Next parse found section 1.2 no longer exists
5. Subsequent modifications to other sections (like 6.3) also fail because document structure is corrupted

## The Real Issue

**Not a regex or parsing problem** - the issue is in the AI response handling:

The prompt asks: "Begin your response with the section heading and include all content"

But some responses might be formatted as:
```
### 1.2 Document Structure
New content here
```

OR just:

```
New content here
```

The code stores whatever AI returns without validating the heading is present.

## Additional Potential Issues

### Issue 1: Multiple Replacements in Sequence
If multiple cascaded changes are being applied:
```
1. Apply change to section 1.2 (heading removed if AI didn't include it)
2. Try to apply change to section 6.3 (works fine)
3. Try to apply change to section 5.2 (fails because document is now malformed)
```

### Issue 2: Subsection Handling
If AI response uses different heading levels:
- Original: `### 1.2 Title`
- AI returns: `## 1.2 Title` (wrong level)
- Result: Section structure becomes inconsistent
- Next parse might find it, but at wrong nesting level

### Issue 3: Missing Heading Validation
`replaceSectionById()` doesn't check if:
- `newContent` starts with a heading marker
- Heading includes the correct section ID
- Heading level matches the original section

## Recommended Fix

### Option 1: Validate and Enforce Heading in Response

After AI generates content, extract and validate:

```typescript
function validateAndFixSectionContent(
  sectionId: string,
  proposedContent: string,
  originalHeading: string
): string {
  // Check if proposedContent starts with a heading
  const headingMatch = proposedContent.match(/^(#{2,4})\s+(\d+(?:\.\d+)*)/);
  
  if (!headingMatch || headingMatch[2] !== sectionId) {
    // Missing or wrong heading - add the original heading
    return originalHeading + '\n' + proposedContent;
  }
  
  return proposedContent;
}
```

Usage in `AIService.ts` line 1406:
```typescript
// Extract original heading
const originalSection = await extractSection(fullDocument, affectedSection.sectionId, affectedSection.sectionTitle);
const originalHeading = originalSection.split('\n')[0]; // First line

// Validate and fix AI response
const validatedContent = validateAndFixSectionContent(
  affectedSection.sectionId,
  result.content.trim(),
  originalHeading
);

propagatedChanges.push({
  // ...
  proposedContent: validatedContent,  // Use validated content
  // ...
});
```

### Option 2: Enhance Prompt to Guarantee Heading

Strengthen the prompt in `buildPropagationPrompt()`:

```typescript
**CRITICAL REQUIREMENTS:**
❌ DO NOT include any other text before the section heading
❌ DO NOT change the section heading or heading level
❌ DO NOT remove the heading line

✅ MUST start with exactly: ${affectedSection.sectionId} (section ID must remain unchanged)
✅ MUST use the same heading level as original: ${originalHeadingLevel}
✅ MUST match this exact format: ${affectedSection.sectionTitle}

**EXAMPLE OUTPUT:**
For section "${affectedSection.sectionId}: ${affectedSection.sectionTitle}", respond:

${exampleHeading}
[new content here]

Never respond with just content without the heading.
```

### Option 3: Post-Process and Restore Headings

In `generatePropagatedChanges()`, after AI response:

```typescript
const sectionContent = extractSection(...);
const contentLines = sectionContent.split('\n');
const originalHeading = contentLines[0]; // First line is the heading

// ... call AI ...

const responseLines = result.content.trim().split('\n');
if (!responseLines[0].match(/^#{2,4}/)) {
  // Heading missing - prepend original heading
  result.content = originalHeading + '\n' + result.content.trim();
}

propagatedChanges.push({
  // ...
  proposedContent: result.content,
  // ...
});
```

## Recommended Fix Priority

1. **HIGH**: Add validation for heading presence in propagated content
2. **HIGH**: Enhance prompt to guarantee heading inclusion
3. **MEDIUM**: Add unit tests for `replaceSectionById()` with various inputs
4. **MEDIUM**: Add debug logging to show what heading was found/replaced
5. **LOW**: Consider marking sections as "structure-protected" to prevent heading removal

## Testing

### Test Case 1: Basic Replacement
```
Original: "### 1.2 Title\nContent"
New content with heading: "### 1.2 Title\nNew content"
Expected: ✅ Success
```

### Test Case 2: Missing Heading (Current Bug)
```
Original: "### 1.2 Title\nContent"
New content without heading: "New content only"
Expected: ❌ Next replacement fails
```

### Test Case 3: Wrong Heading Level
```
Original: "### 1.2 Title\nContent"
New content: "## 1.2 Title\nNew content"
Expected: ⚠️ Success but structure broken
```

### Test Case 4: Wrong Section ID in Heading
```
Original: "### 1.2 Title\nContent"
New content: "### 1.3 Title\nNew content"
Expected: ❌ Data loss/corruption
```

## Summary

The issue is not with the regex or section boundary detection logic - both work correctly. The problem is that `replaceSectionById()` doesn't validate that the `newContent` parameter includes the required section heading.

When the AI-generated content lacks a heading, it gets applied anyway, removing the original heading and corrupting the document structure for subsequent section replacements.

The fix should be to:
1. Validate heading presence in AI responses
2. Either restore missing headings or reject the response
3. Ensure section IDs in headings match what was requested
4. Add comprehensive logging to track what happened
