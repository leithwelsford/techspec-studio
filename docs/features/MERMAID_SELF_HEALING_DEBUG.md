# Mermaid Self-Healing Debug Guide

## Investigation: Partial Line Display in Diff Viewer

**User Report**: The diff viewer appears to show only partial line deletions, not complete lines.

**Screenshot Evidence**: Line 77 shows red (deleted) with only part of the line content visible, no green (replacement) line.

## Debug Logging Added

To investigate this issue, comprehensive debug logging has been added at three key points:

### 1. AI Service Layer (`src/services/mermaidSelfHealer.ts`)

**Lines 99-111** - After AI response received:
```
📝 Raw AI response length: X chars
🎯 Extracted from [method] (X chars)
✅ Healing proposal generated
📊 Code comparison: Original X lines → Proposed X lines
🔍 Original line 74: "[content]"
✏️  Proposed line 74: "[content]"
```

**Lines 215, 222, 232** - Code extraction methods:
```
🎯 Extracted from ```mermaid code block (X chars)
🎯 Extracted from generic ``` code block (X chars)
🎯 Extracted from sequenceDiagram/flowchart start (X chars, X lines)
```

### 2. Modal Component (`src/components/MermaidHealingModal.tsx`)

**Lines 312-320** - Before rendering DiffViewer:
```
📋 DiffViewer Input Debug:
   Original code: X chars, X lines
   Proposed code: X chars, X lines
   Original line 74: "[content]"
   Proposed line 74: "[content]"
```

## What to Look For

### Scenario A: AI Proposal is Actually Incomplete
**Console Output Would Show**:
```
📊 Code comparison: Original 77 lines → Proposed 76 lines
🔍 Original line 74: "    UE-)>UE: Radio Link Fail"
✏️  Proposed line 74: "(not found)" or different content
```
**Meaning**: The AI actually proposed removing line 74 without replacement. This is a **bad proposal** that validation correctly caught. The diff viewer is working correctly.

**User Action**: Click "Reject & Try Again" for a second iteration.

### Scenario B: Extraction is Truncating Content
**Console Output Would Show**:
```
📝 Raw AI response length: 5000 chars
🎯 Extracted from ```mermaid code block (2000 chars)
📊 Code comparison: Original 77 lines → Proposed 50 lines
```
**Meaning**: The extraction regex is cutting off the code prematurely. This is a **bug** in the extraction logic.

**Fix Required**: Update the regex pattern in `extractCodeFromResponse()`.

### Scenario C: AI Returned Complete Code But Different Line Numbers
**Console Output Would Show**:
```
📊 Code comparison: Original 77 lines → Proposed 77 lines
🔍 Original line 74: "    UE-)>UE: Radio Link Fail"
✏️  Proposed line 74: "    loop Check coverage"
```
**Meaning**: The AI modified the code structure (added/removed lines elsewhere), so line 74 now contains different content. The diff algorithm is showing this as delete + add.

**User Action**: Review the full diff to see all changes. The AI may have fixed the error but also made other changes.

## Testing Instructions

1. **Open browser console** (F12)
2. **Click on the broken diagram** in the list view
3. **Click "🔧 Try Self-Healing"** button
4. **Click "🔧 Try to Fix"** in the modal
5. **Watch console output** for the debug logs above
6. **Compare with scenarios** to determine root cause

## Expected Output for Correct Behavior

If everything is working correctly, you should see:

```
🔧 Starting healing iteration 1/3
   Error type: invalid_arrow
   Error line 74: UE-)>UE: Radio Link Fail
   Calling AI with healing prompt (temperature: 0.1)
   📝 Raw AI response length: 4523 chars
   🎯 Extracted from ```mermaid code block (4102 chars)
   ✅ Healing proposal generated
   📊 Code comparison: Original 77 lines → Proposed 77 lines
   🔍 Original line 74: "    UE-)>UE: Radio Link Fail"
   ✏️  Proposed line 74: "    UE->>UE: Radio Link Fail"

🔍 Validating proposed fix...
   ❌ Quick validation failed - invalid arrow syntax detected
   (or)
   ✅ Validation passed - diagram is now valid!

📋 DiffViewer Input Debug:
   Original code: 4102 chars, 77 lines
   Proposed code: 4102 chars, 77 lines
   Original line 74: "    UE-)>UE: Radio Link Fail"
   Proposed line 74: "    UE->>UE: Radio Link Fail"
```

## Current Hypothesis

Based on the user's screenshot showing:
- Red line 77 (deleted)
- No green line (no replacement)
- Partial content visible

**Most Likely**: **Scenario A** - The AI's first attempt was to remove the problematic line rather than fix it. This is actually correct behavior for the validation system to catch.

**Validation Result**: "⚠️ Still has errors" correctly indicates the AI's proposal is invalid.

**User Action**: The user should click **"Reject & Try Again"** to attempt a second iteration with hopefully a better fix.

## Follow-Up Actions

After reviewing console logs:

### If Scenario A (AI made bad proposal):
- ✅ **No fix needed** - System working as designed
- User should try again or use a different AI model
- Consider adjusting AI prompt to be more explicit about syntax rules

### If Scenario B (Extraction bug):
- 🔧 **Fix needed** - Update regex in `extractCodeFromResponse()`
- Add test cases for code extraction
- Consider using a more robust parser

### If Scenario C (AI restructured code):
- ✅ **No fix needed** - Diff viewer showing correct changes
- User should review full diff, not just line 74
- Consider adding "Show full diff" option in modal

## Files Modified

- `/work/src/services/mermaidSelfHealer.ts` - Added extraction and comparison logging
- `/work/src/components/MermaidHealingModal.tsx` - Added DiffViewer input logging

## Rollback Instructions

If debug logging causes issues, remove:
1. Lines 99-111 in `mermaidSelfHealer.ts` (can keep 104 for basic logging)
2. Lines 215, 222, 232 extraction method logs
3. Lines 312-320 in `MermaidHealingModal.tsx`
