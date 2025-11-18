# CASCADE REFINEMENT SECTION HEADING LOSS - INVESTIGATION INDEX

**Investigation Date**: November 17, 2025  
**Status**: ROOT CAUSE IDENTIFIED & DOCUMENTED  
**Severity**: CRITICAL - Data Loss  

---

## Quick Start

**Issue**: All level 1 section headings (##) are lost after cascade refinement

**Root Cause**: Document truncation in impact analysis prompt + validation gap

**Files to Read** (in order):
1. **INVESTIGATION_SUMMARY.md** - 5 min read, executive summary
2. **CASCADE_FAILURE_DIAGRAM.txt** - 10 min read, visual explanation
3. **CASCADE_REFINEMENT_HEADING_LOSS_ROOT_CAUSE.md** - 15 min read, full details + fixes

---

## Document Overview

### 1. INVESTIGATION_SUMMARY.md
**Purpose**: Quick reference guide  
**Audience**: Anyone who wants to understand the issue quickly  
**Content**:
- Key finding (not a bug in extractSection/replaceSectionById)
- Root cause chain (15k truncation → wrong titles → cascading failure)
- Code locations (where the problem is)
- Why this investigation was necessary
- Recommended solution
- Next steps

**Read Time**: 5 minutes  
**Key Insight**: The bug is SEMANTIC (AI confused about section identity), not MECHANICAL

---

### 2. CASCADE_FAILURE_DIAGRAM.txt
**Purpose**: Visual representation of the failure sequence  
**Audience**: Visual learners, people who want to understand the mechanics  
**Content**:
- Stage-by-stage breakdown of the failure
- What AI sees vs. what's actually there
- How the fallback pattern masks the issue
- Why cascading replacements cause damage
- The twist (code is actually working correctly)
- Visual comparison of before/after

**Read Time**: 10 minutes  
**Key Insight**: Multiple replacements compound confusion, single replacements work fine

---

### 3. CASCADE_REFINEMENT_HEADING_LOSS_ROOT_CAUSE.md
**Purpose**: Complete technical analysis + implementation guidance  
**Audience**: Developers implementing the fix  
**Content**:
- Executive summary
- Detailed root cause analysis (4 stages)
- Evidence from code (4 problem points)
- Why this is critical
- 4 recommended fix options (with pros/cons)
- Implementation priority (immediate/short-term/long-term)
- Testing recommendations
- Conclusion

**Read Time**: 15 minutes  
**Key Insight**: Multiple solutions available; combined approach (Option 1+2) is best

---

## Problem Map

```
Document Truncation (refinementPrompts.ts:37)
    ↓
Impact Analysis Receives Incomplete Document
    ↓
AI Must Infer Section Titles From Partial Content
    ↓
AI's Inferred Titles Don't Match Actual Document
    ↓
analyzeRefinementImpact() Returns Wrong Titles (No Validation)
    ↓
generatePropagatedChanges() Uses Wrong Titles
    ↓
extractSection() Works By Fallback (Masks Issue)
    ↓
Multiple Cascaded Replacements
    ↓
Cumulative Confusion → Boundary Calculation Failures
    ↓
Some Section Headings Lost
```

---

## Code Locations

| Problem | File | Lines | Severity |
|---------|------|-------|----------|
| Root cause: Document truncation | `src/services/ai/prompts/refinementPrompts.ts` | 37 | CRITICAL |
| No validation of AI output | `src/services/ai/AIService.ts` | 1267-1307 | HIGH |
| Uses wrong titles for extraction | `src/services/ai/AIService.ts` | 1345-1349 | HIGH |
| Fallback pattern masks issue | `src/services/ai/prompts/refinementPrompts.ts` | 252 | MEDIUM |

---

## Solution Summary

### Option 2 (IMMEDIATE) - Validation
- Add validation to `analyzeRefinementImpact()`
- Check returned titles against actual document
- Correct mismatches before propagated changes
- **Risk**: Minimal
- **Effort**: ~40 lines of code
- **Benefit**: Prevents data loss

### Option 1 (SHORT-TERM) - Explicit Section List
- Pre-parse sections with `parseMarkdownSections()`
- Pass section list to impact analysis prompt
- Update `buildImpactAnalysisPrompt()` signature
- **Risk**: Medium (prompt changes)
- **Effort**: ~30 lines in prompt
- **Benefit**: AI can't make mistakes

### Combined (BEST)
- Do both Option 2 and Option 1
- Defense in depth
- Very robust

---

## Why This Investigation Was Necessary

Initial hypothesis: `extractSection()` is broken

Actual finding: `extractSection()` works correctly, but operates with wrong metadata

**The fallback pattern (line 252) masks the real issue**:
- Pattern: `^##\\s*${escapedId}\\s+.*?$`
- Works even when title is wrong
- Bug only manifests with multiple cascaded operations
- Single operations appear to work fine

---

## Key Learnings

1. **Document truncation creates semantic confusion**: AI doesn't know which section is which
2. **Fallback patterns can hide bugs**: Extraction succeeds but with corrupted metadata
3. **Cumulative failures in loops**: Multiple operations compound the issue
4. **Validation is critical**: Always verify AI-returned identifiers against ground truth
5. **The code is working correctly**: Problem is incomplete input specification

---

## Testing the Fix

### Before Implementing
1. Create 100k+ character document
2. Enable cascade refinement
3. Observe section heading loss

### After Implementing Option 2 (Validation)
1. Run cascade refinement
2. Check console for corrections: "Section title mismatch: ... Correcting..."
3. Verify document integrity (no heading loss)

### After Implementing Option 1 (Section List)
1. Check impact analysis prompt includes section list
2. Verify AI's returned titles match list
3. Test with 100k+, 200k+ documents

---

## Next Actions for User

1. **Understand the issue**
   - Read INVESTIGATION_SUMMARY.md (5 min)
   - Review CASCADE_FAILURE_DIAGRAM.txt (10 min)

2. **Choose fix approach**
   - Read solution options in CASCADE_REFINEMENT_HEADING_LOSS_ROOT_CAUSE.md
   - Recommend: Option 2 (immediate) + Option 1 (short-term)

3. **Implement fix**
   - Follow implementation guidance in root cause document
   - Test with realistic documents

4. **Verify**
   - Run regression tests (various document sizes)
   - Test edge cases (special characters, similar content)

---

## Related Issues & Documentation

- **CASCADE_REFINEMENT_DATA_LOSS_FIX.md** - Previous fix for unsafe string replacement (different issue)
- **SESSION_2025-11-14_SUMMARY.md** - Refinement approval workflow fix (different issue)
- **FUTURE_CASCADED_REFINEMENT.md** - Design doc for cascade refinement feature

---

## Files Created in This Investigation

1. **CASCADE_REFINEMENT_HEADING_LOSS_ROOT_CAUSE.md** (15KB)
   - Comprehensive technical analysis
   - 4 implementation options
   - Testing recommendations

2. **INVESTIGATION_SUMMARY.md** (5.2KB)
   - Quick reference guide
   - Key findings
   - Code locations

3. **CASCADE_FAILURE_DIAGRAM.txt** (This document shows the visual sequence)
   - Visual breakdown of failure
   - Stage-by-stage explanation
   - Before/after comparison

4. **CASCADE_REFINEMENT_BUG_INVESTIGATION_INDEX.md** (This file)
   - Navigation guide
   - Document overview
   - Problem map

---

## Confidence Level

**Very High** - Issue reproduced and root cause traced through code

Evidence:
- Documented truncation at line 37 of refinementPrompts.ts
- Console log shows mismatch between AI-reported title and actual heading
- Traced failure through all 6 stages of the process
- Identified why fallback pattern masks the issue
- Verified that extraction and replacement functions work correctly

---

## Summary

The cascade refinement section heading loss is caused by **incomplete information in the impact analysis prompt**. The AI cannot see section headings for sections beyond 15,000 characters, so it must infer their titles from partial content. These inferred titles don't match reality, causing semantic confusion that cascades through multiple section replacements, ultimately resulting in lost section headings.

The fix is straightforward: Either give the AI explicit section information, or validate the output, or both. This prevents the confusion that cascades through multiple operations.

**The code functions are working correctly. The problem is with incomplete specification of what the AI should analyze.**

