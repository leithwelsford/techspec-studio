# Diff Viewer Investigation Summary

**Date**: 2025-11-11
**Issue**: User reported that the diff viewer shows only partial line deletions

## Investigation Completed

### What Was Done

I added comprehensive debug logging at three key points in the self-healing system to diagnose whether the issue is:
1. The AI proposing incomplete code
2. Code extraction truncating content
3. The diff viewer displaying incorrectly

### Files Modified

#### 1. `/work/src/services/mermaidSelfHealer.ts`

**Lines 99-111** - Added detailed comparison logging after AI response:
```typescript
console.log(`   📝 Raw AI response length: ${response.content.length} chars`);
// ... extraction happens ...
const originalLines = mermaidCode.split('\n').length;
const proposedLines = proposedCode.split('\n').length;
console.log(`   ✅ Healing proposal generated`);
console.log(`   📊 Code comparison: Original ${originalLines} lines → Proposed ${proposedLines} lines`);
console.log(`   🔍 Original line ${error.line}: "${mermaidCode.split('\n')[error.line - 1]?.trim() || '(not found)'}"`);
console.log(`   ✏️  Proposed line ${error.line}: "${proposedCode.split('\n')[error.line - 1]?.trim() || '(not found)'}"`);
```

**Lines 215, 222, 232** - Added logging to show which extraction method was used:
```typescript
console.log('   🎯 Extracted from ```mermaid code block (' + codeBlockMatch[1].length + ' chars)');
console.log('   🎯 Extracted from generic ``` code block (' + anyCodeBlockMatch[1].length + ' chars)');
console.log('   🎯 Extracted from sequenceDiagram/flowchart start (' + extracted.length + ' chars, ' + (lines.length - mermaidStartIndex) + ' lines)');
```

#### 2. `/work/src/components/MermaidHealingModal.tsx`

**Lines 312-320** - Added logging right before DiffViewer renders:
```typescript
{(() => {
  // Debug logging for diff viewer input
  console.log('📋 DiffViewer Input Debug:');
  console.log(`   Original code: ${proposal.originalCode.length} chars, ${proposal.originalCode.split('\n').length} lines`);
  console.log(`   Proposed code: ${proposal.proposedCode.length} chars, ${proposal.proposedCode.split('\n').length} lines`);
  console.log(`   Original line 74: "${proposal.originalCode.split('\n')[73] || '(not found)'}"`);
  console.log(`   Proposed line 74: "${proposal.proposedCode.split('\n')[73] || '(not found)'}"`);
  return null;
})()}
```

#### 3. Documentation Created

- **`/work/MERMAID_SELF_HEALING_DEBUG.md`** - Complete debugging guide with expected console output for different scenarios

### How to Test

1. **Open your browser** and navigate to http://localhost:3000
2. **Open browser console** (F12 or right-click → Inspect → Console tab)
3. **Click on the broken diagram** ("On-the-Move Operation and Coverage Exit")
4. **Click "🔧 Try Self-Healing"** button
5. **Click "🔧 Try to Fix"** in the modal
6. **Watch the console output** - you'll see detailed logging like:

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
   ✅ Validation passed - diagram is now valid!
   (or)
   ❌ Quick validation failed - invalid arrow syntax detected

📋 DiffViewer Input Debug:
   Original code: 4102 chars, 77 lines
   Proposed code: 4102 chars, 77 lines
   Original line 74: "    UE-)>UE: Radio Link Fail"
   Proposed line 74: "    UE->>UE: Radio Link Fail"
```

## What to Look For

### Scenario A: AI Made a Bad Proposal (Most Likely)

**Console Output:**
```
📊 Code comparison: Original 77 lines → Proposed 76 lines
🔍 Original line 74: "    UE-)>UE: Radio Link Fail"
✏️  Proposed line 74: "(not found)"
```

**Meaning**: The AI actually removed line 74 without replacement. This is a **bad proposal** that validation correctly caught.

**What You'll See in Diff**:
- Red line showing deleted content (only what existed)
- No green line (because nothing replaced it)
- This is **correct behavior** - the diff is showing exactly what the AI proposed

**What to Do**: Click **"Reject & Try Again"** to attempt iteration 2 with hopefully a better fix.

### Scenario B: Extraction Bug (Less Likely)

**Console Output:**
```
📝 Raw AI response length: 5000 chars
🎯 Extracted from ```mermaid code block (2000 chars)
📊 Code comparison: Original 77 lines → Proposed 50 lines
```

**Meaning**: The extraction regex cut off the code prematurely.

**What You'll See in Diff**: Truncated proposed code.

**What to Do**: Report this as a bug - I'll need to fix the extraction regex.

### Scenario C: AI Restructured Code (Possible)

**Console Output:**
```
📊 Code comparison: Original 77 lines → Proposed 77 lines
🔍 Original line 74: "    UE-)>UE: Radio Link Fail"
✏️  Proposed line 74: "    loop Check coverage"
```

**Meaning**: The AI added/removed lines elsewhere, shifting line numbers.

**What You'll See in Diff**: Multiple changed lines throughout the diagram.

**What to Do**: Review the full diff carefully. The AI may have fixed the error but made other changes too.

## Expected Outcome

Based on your screenshot, I believe this is **Scenario A** - the AI's first attempt removed the problematic line instead of fixing it. The validation system correctly caught this, and the diff viewer correctly showed the deletion.

This demonstrates the value of the **user-controlled approach**:
- ✅ Bad AI proposals are caught by validation
- ✅ User can see exactly what would change
- ✅ User has the power to reject and retry
- ✅ No bad fixes are applied automatically

## Next Steps

1. **Test with the debug logging** to confirm the scenario
2. **Try iteration 2** by clicking "Reject & Try Again"
3. **If iteration 2 also fails**, try:
   - Using a different AI model (Claude Opus is more reliable)
   - Manual editing (click "Edit Manually Instead")
   - Accepting that this particular error needs human review

## Why This Investigation Matters

The question "Is the diff viewer working?" is important because:
- If it's a **UI bug** → I need to fix the DiffViewer component
- If it's **AI behavior** → The system is working correctly, just the AI needs better guidance
- If it's an **extraction bug** → I need to fix the code parsing logic

The debug logging will definitively tell us which scenario we're dealing with.

## Rollback Instructions

If the debug logging causes performance issues or clutters the console, you can remove:

1. Lines 99-111 in `src/services/mermaidSelfHealer.ts` (keep line 108 for basic logging)
2. Lines 215, 222, 232 extraction method logs
3. Lines 312-320 in `src/components/MermaidHealingModal.tsx`

But I recommend **keeping the logging** at least until we've diagnosed this issue completely.
