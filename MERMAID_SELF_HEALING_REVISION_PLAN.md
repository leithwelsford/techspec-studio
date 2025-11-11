# Mermaid Self-Healing System - Revision Plan

**Date**: 2025-11-11
**Status**: 🔄 **REVISION NEEDED** - Issues discovered during testing

## Issues Discovered During Testing

### Issue 1: Multiple Errors Per Diagram
**Problem**: Diagrams can have multiple invalid arrows on different lines, but Mermaid only reports the first error it encounters. The AI fixes one error, but validation still fails because other errors exist.

**Current Behavior**:
- Line 74: `UE-)UE:` (invalid)
- Line 77: `UE-)>UE:` (invalid)
- Mermaid reports: "Parse error on line 77"
- AI fixes line 77 → `UE->>UE:` ✅
- Validation runs → Finds line 74 still broken ❌
- User sees: "⚠️ Still has errors after this fix"

**User Confusion**: The AI correctly fixed the reported error, but the diagram still shows as broken because there are OTHER unreported errors.

### Issue 2: Diff Viewer Not Showing Changes Clearly
**Problem**: When the AI makes a correct fix (like changing one line), the diff viewer might not highlight it prominently, making users think nothing changed.

**Contributing Factors**:
- Large diagrams (96 lines) make it hard to spot a single-line change
- No auto-scroll to the changed line
- No visual emphasis on the specific error line
- Console logging was showing wrong line numbers (now fixed)

### Issue 3: Iterative Healing Not Optimal for Multiple Errors
**Problem**: The current approach requires:
1. User clicks "Try to Fix" → Fixes error 1
2. Validation fails → "Still has errors"
3. User clicks "Reject & Try Again" → Fixes error 2
4. Validation fails → "Still has errors"
5. User clicks "Reject & Try Again" → Fixes error 3
6. Finally succeeds

This is tedious for diagrams with 3+ errors.

### Issue 4: "Syntax error in text" Displayed on Page
**Problem**: Mermaid's default error rendering shows ugly error messages on the page before users even try to heal them.

**Current UX**: User sees broken diagram → Red error bomb icon → "Syntax error in text" message

**Better UX**: User sees broken diagram → Purple healing button → Clear actionable message

## Proposed Solutions

### Solution 1A: Pre-Validate All Lines Before Healing (Recommended)
**Approach**: Before starting healing, scan the ENTIRE diagram for ALL invalid arrow patterns using `quickValidateArrowSyntax`.

**New Workflow**:
```
1. User clicks "🔧 Try Self-Healing"
2. System runs quick validation → Finds ALL invalid lines:
   - Line 74: UE-)UE (incomplete async arrow)
   - Line 77: UE-)>UE (mixed async/solid syntax)
   - Line 82: AMF->SMF (single arrow instead of ->>)
3. Modal shows: "Found 3 syntax errors. Attempt to fix all?"
4. User clicks "Fix All"
5. AI makes ONE healing attempt that fixes ALL errors at once
6. Validation passes → Success
```

**Advantages**:
- ✅ Fixes all errors in one iteration
- ✅ User sees complete picture upfront
- ✅ Faster workflow (1 iteration vs 3)
- ✅ Less AI API calls (1 vs 3)

**Disadvantages**:
- ⚠️ More complex AI prompt (must fix multiple lines)
- ⚠️ Higher chance of AI making mistakes with multiple targets
- ⚠️ Harder to validate each fix individually

**Implementation Changes**:
- Modify `proposeHealingIteration` to accept array of errors
- Update prompt to list ALL errors and request fixes for each
- Add pre-validation step in modal before first iteration
- Display list of errors found in modal header

### Solution 1B: Automatic Sequential Healing (Alternative)
**Approach**: After each successful fix, automatically attempt the next error without user intervention.

**New Workflow**:
```
1. User clicks "🔧 Try Self-Healing"
2. Iteration 1: Fix line 77 → Validation fails (line 74 still broken)
3. Auto-continue to Iteration 2: Fix line 74 → Validation fails (line 82 still broken)
4. Auto-continue to Iteration 3: Fix line 82 → Validation passes → Success
5. Show final diff with ALL changes
6. User approves or rejects complete set of changes
```

**Advantages**:
- ✅ No user input needed between iterations
- ✅ Each fix validated individually
- ✅ User still reviews final result before accepting

**Disadvantages**:
- ⚠️ User loses control between iterations
- ⚠️ More AI API calls
- ⚠️ Takes longer (sequential fixes)

### Solution 2: Enhanced Diff Viewer
**Approach**: Improve the diff viewer to make changes more obvious.

**Enhancements**:
1. **Auto-scroll to first change**: When diff loads, scroll to the changed line
2. **Highlight error line**: Add visual marker (🔴) next to the line that was fixed
3. **Minimize unchanged sections**: Collapse unchanged lines, show only ±5 lines around changes
4. **Side-by-side view option**: Show original vs proposed in two columns
5. **Line-level highlighting**: Make the specific characters that changed more obvious

**Example UI**:
```
📋 Proposed Changes (1 line modified):

Line 77: 🔴 Fixed invalid arrow syntax

[... lines 70-76 ...]
- 77    UE-)>UE: Enter RRC Idle, periodic cell search
+ 77    UE->>UE: Enter RRC Idle, periodic cell search
[... lines 78-84 ...]

✅ Validation: This fix resolves the error!
```

### Solution 3: Batch Healing with Individual Review
**Approach**: Combine Solution 1A and 1B - fix all errors at once, but show each change separately for review.

**New Workflow**:
```
1. User clicks "🔧 Try Self-Healing"
2. Quick validation finds 3 errors
3. Modal shows: "Found 3 syntax errors"
4. User clicks "Fix All"
5. AI makes ONE call with ALL errors listed
6. Modal shows expandable review:
   ✅ Line 74: UE-)UE → UE->>UE
   ✅ Line 77: UE-)>UE → UE->>UE
   ✅ Line 82: AMF->SMF → AMF->>SMF
7. User expands each to see diff for that specific line
8. User accepts all or rejects all
```

**Advantages**:
- ✅ Fast (1 AI call)
- ✅ Transparent (see each fix)
- ✅ Efficient (batch processing)

### Solution 4: Replace Mermaid Error Rendering
**Approach**: Hide Mermaid's default error messages and show custom error UI.

**Implementation**:
```typescript
// In DiagramViewer.tsx, catch Mermaid errors and show custom UI
try {
  await mermaid.render(diagram.id, diagram.code);
} catch (error) {
  // Instead of showing Mermaid's "Syntax error in text"
  return (
    <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-4xl">🔧</span>
        <div>
          <h3 className="text-lg font-semibold text-red-900">
            Mermaid Syntax Error Detected
          </h3>
          <p className="text-sm text-red-700">
            This diagram has invalid syntax and cannot be rendered.
          </p>
        </div>
      </div>

      <div className="bg-white rounded p-3 mb-4 text-sm text-gray-800 font-mono">
        {error.message}
      </div>

      <button
        onClick={() => openHealingModal(diagram)}
        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
      >
        🔧 Try Self-Healing
      </button>

      <button
        onClick={() => openEditor(diagram)}
        className="ml-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        ✏️ Edit Manually
      </button>
    </div>
  );
}
```

## Recommended Implementation Plan

### Phase 1: Enhanced Pre-Validation (High Priority)
**Goal**: Detect all errors upfront before healing starts.

**Changes**:
1. Add `getAllErrors()` function to `mermaidValidator.ts`:
   ```typescript
   export function getAllErrors(code: string): {
     quickErrors: { line: number; reason: string }[];
     mermaidError: MermaidSyntaxError | null;
   }
   ```

2. Update `MermaidHealingModal.tsx` to show all errors found:
   ```typescript
   const [allErrors, setAllErrors] = useState<Error[]>([]);

   // On open, detect all errors
   useEffect(() => {
     const errors = getAllErrors(invalidCode);
     setAllErrors(errors.quickErrors);
   }, [invalidCode]);
   ```

3. Display errors in modal header:
   ```tsx
   <div className="bg-yellow-50 border border-yellow-200 p-4">
     <h4 className="font-medium text-yellow-900">
       Found {allErrors.length} syntax error(s):
     </h4>
     <ul className="text-sm text-yellow-800 mt-2 space-y-1">
       {allErrors.map(err => (
         <li key={err.line}>• Line {err.line}: {err.reason}</li>
       ))}
     </ul>
   </div>
   ```

### Phase 2: Batch Healing Mode (Medium Priority)
**Goal**: Option to fix all errors in one AI call.

**Changes**:
1. Add "Fix All" vs "Fix One at a Time" choice in modal
2. Update `proposeHealingIteration` to accept array of errors
3. Modify AI prompt to handle multiple fixes:
   ```
   You must fix ALL of the following errors in one pass:
   - Line 74: Invalid arrow syntax (UE-)UE)
   - Line 77: Invalid arrow syntax (UE-)>UE)
   - Line 82: Invalid arrow syntax (AMF->SMF)

   For each error, change ONLY the arrow syntax on that specific line.
   ```

### Phase 3: Improved Diff Visualization (Medium Priority)
**Goal**: Make changes more obvious in the diff viewer.

**Changes**:
1. Auto-scroll to first change
2. Add line markers for errors
3. Implement collapsible unchanged sections
4. Add character-level diff highlighting

### Phase 4: Custom Error UI (Low Priority)
**Goal**: Replace Mermaid's ugly error messages with custom UI.

**Changes**:
1. Catch Mermaid rendering errors in DiagramViewer
2. Show custom error card with healing button
3. Hide default "Syntax error in text" messages

## Testing Plan

### Test Case 1: Single Error
**Setup**: Diagram with one invalid arrow
**Expected**: 1 iteration, successful fix, validation passes

### Test Case 2: Multiple Errors (Same Type)
**Setup**: Diagram with 3 `-)>` patterns
**Expected**:
- Batch mode: 1 iteration fixes all 3
- Sequential mode: 3 iterations, each fixes 1

### Test Case 3: Multiple Errors (Different Types)
**Setup**: Diagram with `-)>`, `->`, and `-->`
**Expected**: All detected upfront, batch fix handles all

### Test Case 4: Complex Restructuring
**Setup**: AI tries to reorder lines
**Expected**: Line count validation catches it, error thrown

### Test Case 5: Unreported Errors
**Setup**: Mermaid reports line 77, but line 74 also broken
**Expected**: Quick validation finds both, user informed upfront

## Migration Strategy

### Option A: Incremental (Recommended)
1. **Ship Phase 1 first** (pre-validation): Low risk, high value
2. Gather user feedback on showing all errors upfront
3. Ship Phase 2 (batch healing) based on feedback
4. Ship Phase 3 (better diff) as polish
5. Ship Phase 4 (custom error UI) as nice-to-have

### Option B: Big Bang
1. Implement all phases at once
2. Test extensively
3. Ship complete solution

**Recommendation**: Use Option A. Phase 1 alone will significantly improve UX with minimal risk.

## Success Metrics

### Current State (Before Revision)
- ❌ Users confused when "fix" doesn't resolve error
- ❌ Multiple iterations needed for multiple errors
- ❌ Diff viewer doesn't highlight changes clearly
- ⚠️ Ugly Mermaid error messages on page

### Target State (After Revision)
- ✅ Users see ALL errors upfront
- ✅ Batch fix resolves multiple errors in one iteration
- ✅ Diff viewer auto-scrolls to changes with clear highlighting
- ✅ Custom error UI with prominent healing button
- ✅ Success rate: 80%+ of diagrams fixed in 1-2 iterations
- ✅ User satisfaction: 90%+ prefer healing to manual editing

## Risk Assessment

### High Risk Changes
- **Batch healing with multiple errors**: AI might make more mistakes
- **Custom error UI**: Could hide important Mermaid error details

### Medium Risk Changes
- **Pre-validation**: Adds complexity to modal initialization
- **Sequential auto-healing**: Removes user control

### Low Risk Changes
- **Improved diff viewer**: Pure UI enhancement
- **Better error display**: Improves UX without changing logic

## Next Steps

1. **Review this plan** with user/team
2. **Choose approach**: Batch (1A), Sequential (1B), or Hybrid (1+2)
3. **Prioritize phases**: Which phases are must-have vs nice-to-have?
4. **Estimate effort**: Each phase is 2-4 hours
5. **Begin implementation** of approved phases

## Questions for User

1. **Batch vs Sequential**: Would you prefer to fix all errors at once (faster but less control) or one at a time (slower but more transparent)?

2. **Auto-continue**: Should the system automatically try the next error after fixing one, or require user approval between each iteration?

3. **Error Display**: Is showing all errors upfront helpful, or would it be overwhelming for diagrams with many errors?

4. **Priority**: Which issue is most painful for you right now?
   - Multiple errors requiring multiple iterations
   - Diff viewer not showing changes clearly
   - Ugly error messages on page
   - Something else?

---

**Status**: ⏳ **AWAITING APPROVAL** - Ready to implement once approach is chosen
