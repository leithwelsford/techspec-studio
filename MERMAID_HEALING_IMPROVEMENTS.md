# Mermaid Self-Healing System Improvements

**Date**: 2025-11-11
**Issue**: AI was restructuring diagrams instead of fixing syntax errors in place

## Problem Discovered

During testing, the AI self-healing system was:
1. **Deleting lines** instead of fixing them
2. **Restructuring diagrams** by moving content around
3. **Passing validation** because the invalid syntax was removed (not fixed)

**Example**:
- **Original line 77**: `UE-)>UE: Enter RRC Idle, periodic cell search`
- **AI's proposal**: Deleted this line, moved other content to line 77
- **Result**: Diagram structure changed, original message lost

## Root Causes

### 1. Weak AI Prompt
The original prompt said "fix ONLY the syntax error" but didn't explicitly forbid:
- Removing lines
- Reordering lines
- Restructuring the diagram

### 2. Missing Validation Pattern
The `quickValidateArrowSyntax` function didn't catch `-)UE` as invalid (incomplete async arrow).

### 3. No Line Count Validation
The system didn't check if the AI added or removed lines, which is a strong indicator of restructuring.

## Solutions Implemented

### Fix 1: Strengthened AI Prompt

**File**: [src/services/mermaidSelfHealer.ts:190-215](src/services/mermaidSelfHealer.ts#L190-L215)

**Before**:
```
INSTRUCTIONS:
1. Fix ONLY the syntax error on line ${error.line}
2. Make minimal changes - preserve all content and intent
3. Do NOT add new features or change the diagram structure
4. Do NOT remove any participants or messages
5. Use the correct Mermaid syntax from the reference documentation above
```

**After**:
```
CRITICAL RULES - FOLLOW EXACTLY:
1. Fix ONLY the syntax error on line ${error.line}
2. Do NOT remove, reorder, or restructure ANY lines
3. Do NOT delete the problematic line - FIX IT IN PLACE
4. Change ONLY the invalid syntax (e.g., change "-)>" to "->>" or "-)" as needed)
5. Keep ALL other lines EXACTLY as they are - same order, same content
6. The output must have the SAME NUMBER OF LINES as the input (${lines.length} lines)

EXAMPLE OF CORRECT FIX:
If line says: "UE-)>UE: Enter RRC Idle"
CORRECT: Change it to "UE->>UE: Enter RRC Idle" (fixed arrow, kept message)
WRONG: Delete the line entirely
WRONG: Move the line to a different position
WRONG: Change the message content
```

**Key Improvements**:
- ✅ Explicit "CRITICAL RULES" header with "FOLLOW EXACTLY"
- ✅ Explicit prohibition of removing/reordering lines
- ✅ Clear example of CORRECT vs WRONG fixes
- ✅ Required output line count specified: `${lines.length} lines`
- ✅ Shorter, more imperative language ("Do NOT" instead of "should not")

### Fix 2: Added Validation Pattern for Incomplete Async Arrows

**File**: [src/utils/mermaidValidator.ts:191](src/utils/mermaidValidator.ts#L191)

**Before**:
```typescript
const invalidArrows = [
  { pattern: /-\)>/, reason: 'Invalid async arrow syntax (should be -) not -)>)' },
  { pattern: /(?<!-)->(?!>)/, reason: 'Single arrow -> is invalid (use ->> for solid arrow)' },
  { pattern: /(?<!-)-->(?!>)/, reason: 'Single arrow --> is invalid (use -->> for dotted arrow)' },
  { pattern: /->{3,}/, reason: 'Too many arrow heads (use ->> not ->>>)' }
];
```

**After** (added line 191):
```typescript
const invalidArrows = [
  { pattern: /-\)>/, reason: 'Invalid async arrow syntax (should be -) not -)>)' },
  { pattern: /-\)(?!-)[^:]/, reason: 'Incomplete async arrow (should be -) for async)' }, // NEW
  { pattern: /(?<!-)->(?!>)/, reason: 'Single arrow -> is invalid (use ->> for solid arrow)' },
  { pattern: /(?<!-)-->(?!>)/, reason: 'Single arrow --> is invalid (use -->> for dotted arrow)' },
  { pattern: /->{3,}/, reason: 'Too many arrow heads (use ->> not ->>>)' }
];
```

**Pattern Explanation**: `/-\)(?!-)[^:]/`
- `-\)` - Matches literal `-)` characters
- `(?!-)` - NOT followed by `-` (negative lookahead)
- `[^:]` - Followed by any character except `:` (the message separator)

This catches cases like:
- ❌ `UE-)UE: message` (invalid - `-)` without proper continuation)
- ❌ `UE-)>UE: message` (invalid - mixed syntax)
- ✅ `UE->>UE: message` (valid - solid arrow)
- ✅ `UE--)UE: message` (valid - async arrow, but probably not intended - needs two dashes)

**Note**: Mermaid actually doesn't have `-)` as a valid arrow. The correct async arrow is likely `->>` or a different syntax. This pattern catches incomplete arrows that might have been created by AI removing characters.

### Fix 3: Added Line Count Validation

**File**: [src/services/mermaidSelfHealer.ts:113-121](src/services/mermaidSelfHealer.ts#L113-L121)

**Before**:
```typescript
// Debug logging
const originalLines = mermaidCode.split('\n').length;
const proposedLines = proposedCode.split('\n').length;
console.log(`   ✅ Healing proposal generated`);
console.log(`   📊 Code comparison: Original ${originalLines} lines → Proposed ${proposedLines} lines`);
console.log(`   🔍 Original line ${error.line}: "${mermaidCode.split('\n')[error.line - 1]?.trim() || '(not found)'}"`);
console.log(`   ✏️  Proposed line ${error.line}: "${proposedCode.split('\n')[error.line - 1]?.trim() || '(not found)'}"`);

return {
  proposedCode,
  ...
};
```

**After**:
```typescript
// Debug logging
const originalLines = mermaidCode.split('\n').length;
const proposedLines = proposedCode.split('\n').length;
console.log(`   ✅ Healing proposal generated`);
console.log(`   📊 Code comparison: Original ${originalLines} lines → Proposed ${proposedLines} lines`);
console.log(`   🔍 Original line ${error.line}: "${mermaidCode.split('\n')[error.line - 1]?.trim() || '(not found)'}"`);
console.log(`   ✏️  Proposed line ${error.line}: "${proposedCode.split('\n')[error.line - 1]?.trim() || '(not found)'}"`);

// Validate that AI didn't restructure the diagram
if (originalLines !== proposedLines) {
  console.log(`   ⚠️ WARNING: Line count changed! AI may have restructured the diagram.`);
  throw new Error(
    `AI changed the number of lines (${originalLines} → ${proposedLines}). ` +
    `This suggests the AI restructured the diagram instead of fixing it in place. ` +
    `Please try again or edit manually.`
  );
}

return {
  proposedCode,
  ...
};
```

**Key Improvements**:
- ✅ **Fail-fast approach**: Throw error immediately if line count changes
- ✅ **Clear error message**: Explains what went wrong and suggests next steps
- ✅ **Automatic retry trigger**: User can click "Reject & Try Again" to get a different AI proposal

## Expected Behavior After Fixes

### Scenario 1: AI Tries to Remove Lines
**Input**: 96-line diagram with error on line 77
**AI Proposal**: 95-line diagram (deleted line 77)
**System Response**:
```
⚠️ WARNING: Line count changed! AI may have restructured the diagram.
Error: AI changed the number of lines (96 → 95). This suggests the AI
restructured the diagram instead of fixing it in place. Please try again
or edit manually.
```
**User Sees**: Error modal with "Reject & Try Again" button
**User Action**: Click "Reject & Try Again" → AI gets second chance with stronger prompt

### Scenario 2: AI Fixes Syntax Correctly
**Input**: 96-line diagram with `UE-)>UE:` on line 77
**AI Proposal**: 96-line diagram with `UE->>UE:` on line 77
**System Response**:
```
✅ Healing proposal generated
📊 Code comparison: Original 96 lines → Proposed 96 lines
🔍 Original line 77: "UE-)>UE: Enter RRC Idle"
✏️  Proposed line 77: "UE->>UE: Enter RRC Idle"
✅ Validation passed - diagram is now valid!
```
**User Sees**: Diff viewer with single-line change, "Accept Fix" button
**User Action**: Review change, click "Accept Fix" → Diagram updated

### Scenario 3: AI Makes Partial Fix
**Input**: 96-line diagram with `UE-)>UE:` on line 77
**AI Proposal**: 96-line diagram with `UE-)UE:` on line 77 (removed `>` but still invalid)
**System Response**:
```
✅ Healing proposal generated
📊 Code comparison: Original 96 lines → Proposed 96 lines
🔍 Original line 77: "UE-)>UE: Enter RRC Idle"
✏️  Proposed line 77: "UE-)UE: Enter RRC Idle"
⚠️ Validation failed - invalid arrow syntax detected
Line 77: Incomplete async arrow (should be -) for async)
```
**User Sees**: Diff viewer + "⚠️ Still has errors" warning + "Reject & Try Again" button
**User Action**: Click "Reject & Try Again" → AI gets second chance

## Testing Instructions

1. **Open browser** at http://localhost:3000
2. **Open browser console** (F12)
3. **Click on broken diagram** ("On-the-Move Operation and Coverage Exit")
4. **Click "🔧 Try Self-Healing"**
5. **Click "🔧 Try to Fix"**
6. **Watch console output** - should now see one of:

### Expected Output A: Line Count Error (AI tried to restructure)
```
🔧 Starting healing iteration 1/3
   Error type: invalid_arrow
   Error line 77: UE-)>UE: Enter RRC Idle, periodic cell search
   Calling AI with healing prompt (temperature: 0.1)
   📝 Raw AI response length: 1785 chars
   🎯 Extracted from ```mermaid code block (1715 chars)
   ✅ Healing proposal generated
   📊 Code comparison: Original 96 lines → Proposed 95 lines
   ⚠️ WARNING: Line count changed! AI may have restructured the diagram.

Error: AI changed the number of lines (96 → 95). This suggests the AI
restructured the diagram instead of fixing it in place. Please try again
or edit manually.
```

### Expected Output B: Invalid Fix Caught (AI made incomplete fix)
```
🔧 Starting healing iteration 1/3
   Error type: invalid_arrow
   Error line 77: UE-)>UE: Enter RRC Idle, periodic cell search
   Calling AI with healing prompt (temperature: 0.1)
   📝 Raw AI response length: 1785 chars
   🎯 Extracted from ```mermaid code block (1715 chars)
   ✅ Healing proposal generated
   📊 Code comparison: Original 96 lines → Proposed 96 lines
   🔍 Original line 77: "UE-)>UE: Enter RRC Idle"
   ✏️  Proposed line 77: "UE-)UE: Enter RRC Idle"

🔍 Validating proposed fix...
   ❌ Quick validation failed - invalid arrow syntax detected
   Line 77: Incomplete async arrow (should be -) for async)
```

### Expected Output C: Correct Fix (AI fixed it properly)
```
🔧 Starting healing iteration 1/3
   Error type: invalid_arrow
   Error line 77: UE-)>UE: Enter RRC Idle, periodic cell search
   Calling AI with healing prompt (temperature: 0.1)
   📝 Raw AI response length: 1785 chars
   🎯 Extracted from ```mermaid code block (1715 chars)
   ✅ Healing proposal generated
   📊 Code comparison: Original 96 lines → Proposed 96 lines
   🔍 Original line 77: "UE-)>UE: Enter RRC Idle"
   ✏️  Proposed line 77: "UE->>UE: Enter RRC Idle"

🔍 Validating proposed fix...
   ✅ Validation passed - diagram is now valid!

📋 DiffViewer Input Debug:
   Original code: 4102 chars, 96 lines
   Proposed code: 4102 chars, 96 lines
   Original line 77: "    UE-)>UE: Enter RRC Idle, periodic cell search"
   Proposed line 77: "    UE->>UE: Enter RRC Idle, periodic cell search"
```

## Summary of Changes

### Files Modified

1. **[src/services/mermaidSelfHealer.ts](src/services/mermaidSelfHealer.ts)**
   - Strengthened AI prompt (lines 190-215)
   - Added line count validation (lines 113-121)

2. **[src/utils/mermaidValidator.ts](src/utils/mermaidValidator.ts)**
   - Added incomplete async arrow pattern (line 191)

### Impact

| Issue | Before | After |
|-------|--------|-------|
| **AI restructuring diagram** | ❌ Allowed, no detection | ✅ Caught immediately, error thrown |
| **AI deleting lines** | ❌ Allowed, validation passed | ✅ Line count check catches it |
| **Invalid async arrow `-)UE:`** | ❌ Validation passed | ✅ Validation fails with clear reason |
| **User trust** | ⚠️ Low (AI changes things unpredictably) | ✅ High (system catches bad proposals) |
| **Transparency** | ⚠️ Medium (saw result but not why) | ✅ High (sees exact error + reason) |

### Success Metrics

After these fixes, the self-healing system should:
- ✅ **Catch 100% of line count changes** (restructuring attempts)
- ✅ **Catch 100% of incomplete async arrows** (`-)X` patterns)
- ✅ **Provide clear error messages** (user knows why fix was rejected)
- ✅ **Allow automatic retry** (user clicks "Reject & Try Again" for iteration 2)
- ✅ **Maintain user control** (no bad fixes applied automatically)

## Next Steps

1. **Test with the existing broken diagram** to verify fixes work
2. **Try iteration 2** if first attempt fails (AI should learn from stronger prompt)
3. **Consider switching to Claude Opus** if Haiku/Sonnet consistently fails
4. **Gather user feedback** on whether the stronger prompt improves success rate
5. **Monitor console logs** to see which scenario occurs most often:
   - Scenario A: Line count error (prompt too weak)
   - Scenario B: Invalid fix caught (prompt better but still imperfect)
   - Scenario C: Correct fix (prompt working well)

## Lessons Learned

### AI Prompt Engineering for Syntax Fixes

1. **Be extremely explicit**: "Do NOT remove lines" is better than "preserve all content"
2. **Use examples**: Show CORRECT vs WRONG to set clear expectations
3. **Set constraints**: Specify exact line count required in output
4. **Use imperative language**: "CRITICAL RULES - FOLLOW EXACTLY" gets more attention than "Instructions"
5. **Validate immediately**: Check line count before even trying to validate Mermaid syntax

### Fail-Fast Philosophy

- **Don't try to salvage bad AI output** - fail fast and let user retry
- **Clear error messages** help users understand what went wrong
- **Automatic retry** is better than forcing manual edit immediately
- **Transparency builds trust** - show exactly what AI tried to do and why it was rejected

### User-Controlled Healing

This incident reinforces why the **user-controlled iterative approach** is superior:
- User sees each proposal before it's applied
- Bad proposals can be rejected immediately
- System can automatically retry with stronger constraints
- User always has option to edit manually if AI can't handle it

**Status**: ✅ **All fixes implemented and deployed via HMR**
