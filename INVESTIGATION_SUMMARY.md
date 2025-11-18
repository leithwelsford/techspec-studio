# CASCADE REFINEMENT HEADING LOSS - INVESTIGATION SUMMARY

**Investigation Date**: 2025-11-17  
**Finding**: Root cause identified and fully documented  
**Status**: Ready for fix implementation  

---

## What Was Investigated

The user reported: "All level 1 section headings (##) have been lost after cascade refinement"

Console showed: "AI omitted heading for section 7: Policy and Charging Control. Restoring original heading: ## 7 Information Elements"

---

## Key Finding

**The problem is NOT in the section extraction or heading restoration code.**

The problem is in the **impact analysis prompt**, which truncates the document at 15,000 characters. When analyzing a 100,000+ character specification:

1. AI cannot see section headings for sections beyond position 15,000
2. AI must INFER section titles from the partial content it can see
3. AI's inferred titles don't match the actual document titles
4. This causes confusion throughout the cascaded refinement process
5. When multiple sections are affected, the boundary calculations fail
6. Result: Some section headings are lost

---

## Root Cause Chain

```
Impact Analysis (15k truncation)
        ↓
AI infers wrong section titles
        ↓
extractSection() uses fallback match (works)
        ↓
Metadata has wrong title information
        ↓
Multiple cascaded replacements
        ↓
parseMarkdownSections() has inconsistent state
        ↓
Section boundaries get confused
        ↓
Some headings are lost in final document
```

---

## Why extractSection() and replaceSectionById() Appear to Work

These functions are ACTUALLY WORKING CORRECTLY:

- `extractSection()` has a fallback pattern that matches any section ID, regardless of title
- `replaceSectionById()` uses index-based boundaries from `parseMarkdownSections()`
- Both functions use section ID as primary identifier, not title

The bug is MASKED because:
- Section ID matching works (fallback pattern in line 252)
- Single replacements work
- The problem only manifests when MULTIPLE replacements happen with confused metadata

---

## Console Log Evidence Explained

```
⚠️ AI omitted heading for section 7: Policy and Charging Control.
Restoring original heading: "## 7 Information Elements"
```

This shows:
- **Section 7** is being processed
- **AI thought** it was about "Policy and Charging Control"
- **Document actually has** "Information Elements"
- **Code correctly restored** the heading from the extracted section

BUT: If this mismatch happens for sections 7, 8, and 9 simultaneously during cascade refinement, the cumulative effect of confusion across multiple replacements can cause heading loss.

---

## Code Locations

**Root Cause**:
- `src/services/ai/prompts/refinementPrompts.ts` line 37: `fullDocument.substring(0, 15000)`

**Impact Analysis (accepts wrong titles)**:
- `src/services/ai/AIService.ts` lines 1267-1307: `analyzeRefinementImpact()`

**Section Extraction (works despite wrong titles)**:
- `src/services/ai/prompts/refinementPrompts.ts` lines 233-283: `extractSection()`
- Line 252: Fallback pattern `^##\\s*${escapedId}\\s+.*?$`

**Propagated Changes Generation (uses wrong titles)**:
- `src/services/ai/AIService.ts` lines 1313-1437: `generatePropagatedChanges()`
- Line 1345-1349: Calls `extractSection()` with wrong title

**No Validation**:
- `src/services/ai/AIService.ts` lines 1267-1307: No check that returned titles match document

---

## Why This Investigation Was Necessary

Initial hypothesis was that `extractSection()` was broken. But testing showed:
- `extractSection()` works correctly when given wrong title (fallback pattern rescues it)
- The real problem is SEMANTIC: AI is confused about which section is which
- This confusion cascades through multiple operations
- The heading loss is a SYMPTOM of the underlying confusion, not a direct failure

---

## Recommended Solution

**Immediate** (prevents data loss):
- Implement validation in `analyzeRefinementImpact()` to correct wrong titles

**Short-term** (improves reliability):
- Pass explicit section list to impact analysis prompt
- AI uses actual titles instead of inferring from truncated content

**Long-term** (architectural improvement):
- Pre-parse sections once at workflow start
- Reuse parsed sections throughout (don't reparse)

---

## Next Steps

1. **Implement validation** (Option 2 in detailed root cause doc)
2. **Test with realistic documents** (100k+ chars, multiple cascaded changes)
3. **Implement section list passing** (Option 1 in detailed root cause doc)
4. **Regression test** to ensure no heading loss

---

## Related Documentation

- `CASCADE_REFINEMENT_HEADING_LOSS_ROOT_CAUSE.md` - Detailed analysis with code evidence and fix options
- `CASCADE_REFINEMENT_DATA_LOSS_FIX.md` - Previous fix for unsafe string replacement (different issue)
- `SESSION_2025-11-14_SUMMARY.md` - Session history with other refinement fixes

---

## Key Takeaway

The cascade refinement feature's heading loss is caused by **incomplete information in the impact analysis prompt**, not by failures in the extraction or replacement code. The fix is to give the AI complete information (explicit section list) and validate the output, rather than relying on the AI to infer section identities from truncated context.

