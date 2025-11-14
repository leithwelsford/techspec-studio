# CASCADE REFINEMENT DATA LOSS BUG - FIX REPORT

**Date**: 2025-11-14
**Severity**: CRITICAL
**Status**: ✅ FIXED (Commit d98713b)
**Impact**: 75% document data loss when using cascade refinement

---

## Executive Summary

A catastrophic bug in the cascade refinement feature caused massive data loss (75% of document content) when users approved cascaded changes. The bug was caused by unsafe string replacement logic that deleted wrong sections or failed to apply changes correctly.

**The fix** replaces naive `.replace()` calls with index-based section operations that use section IDs for accurate replacement.

---

## Problem Description

### User Report

> "It seems that everything works but after accepting the changes I see that section 2 seems incomplete and section 3 is missing altogether?"

### Data Loss Evidence

Console investigation revealed:
- **Before cascade approval**: 107,599 characters, ~50+ sections
- **After cascade approval**: 26,219 characters, 29 sections ❌
- **Data loss**: 75% of document content deleted
- **Missing sections**: Section 2 (partial), Section 3 (complete), Section 6 (complete), most of Section 4

### Console Output

```
Total sections: 29

First 10 sections:
1. ## 1 Scope
2. ### 1.1 Purpose and Overview
3. ### 2.2 Informative References  ← Section 2.1 missing!
4. ### 4.1 Overview                ← Section 3 completely missing!
5. ### 4.2 Functional Elements
...

=== Looking for Section 2 & 3 ===
Has "## 2 ": true
Has "## 3 ": false  ← SECTION 3 DELETED
```

---

## Root Cause Analysis

### Buggy Code (ReviewPanel.tsx lines 239-259)

```typescript
// ❌ UNSAFE - Only replaces FIRST occurrence
let updatedMarkdown = selectedApproval.originalContent || '';

// Apply primary change first
updatedMarkdown = updatedMarkdown.replace(
  primaryChange.originalContent,  // Content to find
  primaryChange.refinedContent    // Replacement content
);

// Apply propagated changes
for (const change of selectedChanges) {
  if (change.actionType === 'REMOVE_SECTION') {
    updatedMarkdown = updatedMarkdown.replace(change.originalContent, '');
  } else if (change.actionType === 'MODIFY_SECTION') {
    updatedMarkdown = updatedMarkdown.replace(
      change.originalContent,
      change.proposedContent
    );
  }
}
```

### Why This Failed

JavaScript's `.replace()` method has critical limitations:

1. **Only replaces FIRST occurrence** - If content appears multiple times, it only changes the first match
2. **Exact matching required** - Any whitespace/formatting difference → no match → no replacement
3. **Partial matching** - If content partially matches elsewhere → wrong content replaced
4. **Cascading failures** - Multiple replacements compound the problem

**Example failure scenario:**
```markdown
## 2 References
Content here...

## 3 Architecture
Content here...

## 6 Procedures
References the architecture from section 3...
```

If cascade refinement tries to:
1. Modify section 2 → Might partially match "References" in section 6
2. Remove section 3 → Might match wrong content
3. Modify section 6 → Previous changes altered the document structure

Result: Sections get deleted or replaced incorrectly.

---

## The Fix

### New Safe Section Operations

Created two utility functions in `src/services/ai/prompts/refinementPrompts.ts`:

```typescript
/**
 * Replace a section safely using section boundaries
 */
export function replaceSectionById(
  fullDocument: string,
  sectionId: string,      // e.g., "2", "3.1", "6.3"
  newContent: string
): string | null {
  const sections = parseMarkdownSections(fullDocument);
  const sectionToReplace = sections.find(s => s.id === sectionId);

  if (!sectionToReplace) {
    console.error(`Section ${sectionId} not found`);
    return null;
  }

  // Index-based replacement (safe!)
  const before = fullDocument.substring(0, sectionToReplace.startIndex);
  const after = fullDocument.substring(sectionToReplace.endIndex);

  return before + newContent + after;
}

/**
 * Remove a section safely using section boundaries
 */
export function removeSectionById(
  fullDocument: string,
  sectionId: string
): string | null {
  const sections = parseMarkdownSections(fullDocument);
  const sectionToRemove = sections.find(s => s.id === sectionId);

  if (!sectionToRemove) {
    console.error(`Section ${sectionId} not found`);
    return null;
  }

  // Index-based removal (safe!)
  const before = fullDocument.substring(0, sectionToRemove.startIndex);
  const after = fullDocument.substring(sectionToRemove.endIndex);

  return before + after;
}
```

### Updated ReviewPanel.tsx

```typescript
// ✅ SAFE - Uses section IDs and index-based operations
onApply={async (selectedChanges: PropagatedChange[]) => {
  const { primaryChange } = cascadeData;
  let updatedMarkdown = selectedApproval.originalContent || '';

  console.log('🔄 Starting cascade refinement application...');
  console.log('📄 Original document:', updatedMarkdown.length, 'chars');

  // Import safe replacement functions
  const { replaceSectionById, removeSectionById } =
    await import('../../services/ai/prompts/refinementPrompts');

  // Apply primary change using SAFE section replacement
  const primaryReplaced = replaceSectionById(
    updatedMarkdown,
    primaryChange.sectionId,  // Use section ID, not content matching!
    primaryChange.refinedContent
  );

  if (!primaryReplaced) {
    alert(`Failed to apply primary change to section ${primaryChange.sectionId}`);
    return;
  }

  updatedMarkdown = primaryReplaced;
  console.log('✅ Primary change applied. Document now:', updatedMarkdown.length, 'chars');

  // Apply propagated changes using SAFE operations
  for (const change of selectedChanges) {
    if (change.actionType === 'REMOVE_SECTION') {
      const removed = removeSectionById(updatedMarkdown, change.sectionId);
      if (!removed) {
        alert(`Failed to remove section ${change.sectionId}. Continuing...`);
        continue;
      }
      updatedMarkdown = removed;
      console.log(`✅ Section ${change.sectionId} removed. Document now:`, updatedMarkdown.length, 'chars');
    } else if (change.actionType === 'MODIFY_SECTION') {
      const replaced = replaceSectionById(
        updatedMarkdown,
        change.sectionId,
        change.proposedContent
      );
      if (!replaced) {
        alert(`Failed to modify section ${change.sectionId}. Continuing...`);
        continue;
      }
      updatedMarkdown = replaced;
      console.log(`✅ Section ${change.sectionId} modified. Document now:`, updatedMarkdown.length, 'chars');
    }
  }

  console.log('✅ All changes applied. Final document:', updatedMarkdown.length, 'chars');

  // Update specification
  updateSpecification(updatedMarkdown);
  // ... create snapshot, remove approval, etc.
}}
```

### Key Improvements

1. **Section ID-based operations** - Uses `sectionId` (e.g., "2", "3.1") instead of content matching
2. **Index-based replacement** - Uses `substring()` with precise boundaries from `parseMarkdownSections()`
3. **Fail-safe alerts** - Warns user if any operation fails, continues with other changes
4. **Comprehensive logging** - Logs document length after each operation for debugging
5. **Null checks** - Returns null if section not found, prevents silent failures

---

## Additional Safety Measures

### User Warning in MarkdownEditor.tsx

Updated the refinement type prompt to warn users:

```typescript
const refinementType = prompt(
  'Choose refinement type:\n\n' +
  '1 = Simple Refinement (faster, fewer tokens)\n' +
  '   - Only refines the selected text\n\n' +
  '2 = Cascade Refinement (slower, 2-3x tokens) ⚠️  BETA\n' +
  '   - Refines selection AND analyzes impact on other sections\n' +
  '   - Suggests related changes for consistency\n' +
  '   - ⚠️  IMPORTANT: Carefully review ALL changes before approving\n' +
  '   - Cascade changes are shown in the Review Panel\n\n' +
  'Enter 1 for Simple, 2 for Cascade:',
  '1'
);
```

---

## Testing Recommendations

### Manual Testing Checklist

1. ✅ **Basic cascade refinement**:
   - Select a section (e.g., section 4)
   - Request refinement with cascade enabled
   - Verify primary change applied correctly
   - Verify propagated changes applied correctly
   - Check document length before/after

2. ✅ **Multiple propagated changes**:
   - Test with 3+ propagated changes
   - Mix of MODIFY_SECTION and REMOVE_SECTION actions
   - Verify all sections intact
   - Check console logs for operation sequence

3. ✅ **Section removal**:
   - Request removal of a section via cascade
   - Verify only target section removed
   - Verify surrounding sections unchanged
   - Check section numbering remains consistent

4. ✅ **Edge cases**:
   - Very large documents (100k+ chars)
   - Deeply nested sections (4.3.2.1)
   - Sections with similar content
   - Sections at document start/end

### Console Verification

After applying cascade changes, run in browser console:

```javascript
// Check document integrity
const doc = localStorage.getItem('tech-spec-project');
const parsed = JSON.parse(doc);
const markdown = parsed.state.project.specification.markdown;

console.log('Document length:', markdown.length);
const sections = markdown.match(/^#{2,4}\s+\d+/gm) || [];
console.log('Total sections:', sections.length);
console.log('First 10 sections:', sections.slice(0, 10));

// Check for specific sections
console.log('Has section 2:', /^## 2 /m.test(markdown));
console.log('Has section 3:', /^## 3 /m.test(markdown));
console.log('Has section 6:', /^## 6 /m.test(markdown));
```

Expected output after cascade refinement:
- Document length should be reasonable (not 75% reduced!)
- All expected sections should be present
- Section numbering should be sequential

---

## Version History Note

**Important**: If users experienced data loss from the buggy version, they may be able to restore from version snapshots if the feature was initialized:

```javascript
// Check for version snapshots
const stored = localStorage.getItem('tech-spec-project');
const parsed = JSON.parse(stored);
const snapshots = parsed.state.project?.versionHistory?.snapshots || [];
console.log('Available snapshots:', snapshots.length);

// Show snapshot details
snapshots.forEach((s, i) => {
  const len = s.projectState?.specification?.markdown?.length || 0;
  const sections = (s.projectState?.specification?.markdown?.match(/^#{2,4}\s+\d+/gm) || []).length;
  console.log(`${i+1}. ${s.description} - ${len} chars, ${sections} sections - ${new Date(s.timestamp).toLocaleString()}`);
});
```

If snapshots exist, use the `VersionHistoryDebug` component (not yet integrated into UI) to restore.

---

## Files Changed

1. **src/services/ai/prompts/refinementPrompts.ts** (+58 lines)
   - Added `replaceSectionById()` function
   - Added `removeSectionById()` function
   - Both use existing `parseMarkdownSections()` for accurate boundaries

2. **src/components/ai/ReviewPanel.tsx** (rewrote cascade application logic)
   - Replaced unsafe `.replace()` with safe section operations
   - Added comprehensive logging
   - Added user alerts for failed operations
   - Made `onApply` async to import utilities

3. **src/components/editors/MarkdownEditor.tsx** (added BETA warning)
   - Marked cascade refinement as "⚠️  BETA"
   - Added warning to carefully review changes
   - Reminded users about Review Panel

---

## Related Issues

- **REFINEMENT_APPROVAL_FIX.md** - Previous fix for refinement approvals not working (type check issue)
- **FUTURE_CASCADED_REFINEMENT.md** - Original design doc for cascade refinement feature
- **SESSION_2025-11-14_SUMMARY.md** - Session where this bug was discovered and fixed

---

## Lessons Learned

### Technical Lessons

1. **Never use `.replace()` for structured content** - Use index-based operations with proper parsing
2. **Section IDs are safer than content matching** - IDs are unique, content may not be
3. **Fail fast with user alerts** - Don't silently continue when operations fail
4. **Log everything during data mutation** - Essential for debugging data loss
5. **Test with realistic data** - 100k+ char documents expose edge cases

### Process Lessons

1. **Beta features need clear warnings** - Users should know when features are experimental
2. **Comprehensive logging in production** - Helps diagnose issues quickly
3. **Version snapshots are essential** - Always create backups before major changes
4. **Manual testing critical for data operations** - Automated tests wouldn't catch this

---

## Future Improvements

1. **Unit tests for section operations**:
   - Test `replaceSectionById()` with various section structures
   - Test `removeSectionById()` with edge cases
   - Test handling of malformed markdown

2. **Integration tests for cascade workflow**:
   - Mock AI responses with multiple propagated changes
   - Verify document integrity after cascade approval
   - Test with large documents (500+ sections)

3. **UI improvements**:
   - Show document diff in Review Panel for cascade changes
   - Display section count before/after in preview
   - Add "Undo" button for recently approved changes

4. **Version history UI integration**:
   - Add "Version History" tab to workspace
   - Integrate `VersionHistoryDebug` component
   - Allow easy snapshot restoration

---

## Commit Hash

**d98713b** - fix: CRITICAL - Fix cascade refinement data loss bug

View commit: `git show d98713b`

---

**Status**: ✅ RESOLVED - Cascade refinement now safe to use with careful review
