# Pandoc Double Numbering Investigation

**Date**: 2025-11-26
**Status**: ✅ Root Cause Identified, Awaiting Solution Selection
**Issue**: DOCX output shows double numbering (e.g., "1 1 Ethio Telecom" instead of "1 Ethio Telecom")

---

## Problem Description

When exporting a technical specification from TechSpec Studio to DOCX using Pandoc with a Word template, the output shows double numbering on headings:

**Expected** (from Markdown):
```
# 1 Ethio Telecom
## 1.1 Background
```

**Actual** (in DOCX output):
```
1 1 Ethio Telecom
1.1 1.1 Background
```

Additionally, a duplicate Table of Contents appears even when `includeTOC: false` is set.

---

## Investigation Timeline

### Phase 1: Initial Implementation
- ✅ Created Node.js backend service with Pandoc integration
- ✅ Frontend API client (`src/utils/pandocExport.ts`)
- ✅ UI integration in `ExportModal.tsx`
- ✅ Docker deployment configuration

### Phase 2: First Error - GFM Extension
**Error**: "The extension gfm is not supported for markdown"

**Root Cause**: Line 145 in `server/pandoc-service.js` had incorrect syntax:
```javascript
'--from=markdown+gfm'  // INCORRECT
```

**Fix**: Changed to correct GFM format:
```javascript
'--from=gfm'  // CORRECT - GitHub-flavored markdown
```

**Files Modified**: [server/pandoc-service.js:145](server/pandoc-service.js#L145)

### Phase 3: Double Numbering Discovery
User reported formatting issues with numbered headings appearing twice.

**Investigation Steps**:
1. Checked backend logs - confirmed correct Pandoc command execution
2. Examined frontend code - found hardcoded `includeNumberSections: true`
3. Analyzed default options - found `includeTOC: true` default
4. Applied fixes to both issues

### Phase 4: Applied Fixes (Option 1)
**Fix 1**: Removed hardcoded `includeNumberSections: true` from ExportModal.tsx

**Before** (line 113-115):
```typescript
blob = await exportWithPandoc(project, templateFile, {
  ...exportOpts,
  includeNumberSections: true, // Pandoc-specific option
});
```

**After** (line 113):
```typescript
blob = await exportWithPandoc(project, templateFile, exportOpts);
```

**Fix 2**: Changed default TOC option in docxExport.ts

**Before** (line 39):
```typescript
export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includeTOC: true,
  // ...
};
```

**After** (line 39):
```typescript
export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includeTOC: false,  // Most markdown already has manual ToC
  // ...
};
```

**Files Modified**:
- [src/components/ExportModal.tsx:113](src/components/ExportModal.tsx#L113)
- [src/utils/docxExport.ts:39](src/utils/docxExport.ts#L39)

### Phase 5: Issue Persisted
User tested with hard refresh - **double numbering still appeared**.

Backend logs confirmed fixes were working:
```
[abc123] Options: { includeTOC: false, includeNumberSections: undefined }
[abc123] Executing: pandoc "input.md" --reference-doc="template.docx" --output="output.docx" --from=gfm --standalone
```

No `--number-sections` or `--toc` flags were being sent, yet numbering persisted.

### Phase 6: Pandoc Documentation Research
Comprehensive research of Pandoc manual revealed **no flags exist** to disable template numbering styles.

**Key Findings**:
- `--reference-doc`: Applies ALL template styles including numbering
- `--number-sections`: Adds Pandoc's own auto-numbering (separate from template)
- No flag to selectively disable template heading numbering
- Template styles are preserved by design

---

## Root Cause Analysis

### The Real Problem

The Word template file `SPD_Customer_ProjectName_2018 BFP.docx` has **automatic numbering configured** in its heading styles (Heading 1, Heading 2, Heading 3, etc.).

When Pandoc applies the template via `--reference-doc`, it preserves ALL template properties including:
- Fonts, colors, spacing ✅ (desired)
- Headers, footers, logos ✅ (desired)
- **Heading numbering styles** ❌ (conflicts with manual markdown numbering)

### Why This Happens

1. **Markdown Source** has manual numbering:
   ```markdown
   # 1 Ethio Telecom
   ## 1.1 Background
   ```

2. **Pandoc Conversion** converts headings to Word styles:
   ```
   Heading 1: "1 Ethio Telecom"
   Heading 2: "1.1 Background"
   ```

3. **Template Application** (`--reference-doc`) applies heading styles:
   - Heading 1 style has automatic numbering: `1.`
   - Heading 2 style has automatic numbering: `1.1.`

4. **Result** is double numbering:
   ```
   1 1 Ethio Telecom      (template "1" + manual "1")
   1.1 1.1 Background     (template "1.1" + manual "1.1")
   ```

### Why Pandoc Flags Don't Help

- `--number-sections`: Adds **Pandoc's** auto-numbering (would create TRIPLE numbering!)
- `--reference-doc`: Applies **template's** numbering styles (the source of the problem)
- **NO FLAG EXISTS** to disable template numbering while preserving other template properties

---

## Solution Options

### Option 1: Modify Word Template (RECOMMENDED)

**Action**: Remove automatic numbering from Heading 1-6 styles in the Word template.

**Steps**:
1. Open `SPD_Customer_ProjectName_2018 BFP.docx` in Microsoft Word
2. Right-click Heading 1 style → Modify Style
3. Format → Numbering → None
4. Repeat for Heading 2, 3, 4, 5, 6
5. Save template

**Pros**:
- ✅ Clean solution - template matches markdown intent
- ✅ Preserves all other template formatting (fonts, colors, headers, footers)
- ✅ No code changes required
- ✅ Works for all future exports

**Cons**:
- ❌ Requires modifying corporate template (may need approval)
- ❌ Must maintain two template versions (with/without numbering)

**Code Changes**: None

---

### Option 2: Strip Manual Numbering from Markdown

**Action**: Remove manual numbering from markdown before export, let template handle numbering.

**Implementation**:
```typescript
// In pandocExport.ts
function stripManualNumbering(markdown: string): string {
  return markdown.replace(/^(#+)\s+(\d+(?:\.\d+)*)\s+/gm, '$1 ');
}

// Before export
const cleanedMarkdown = stripManualNumbering(project.specification.markdown);
```

**Pros**:
- ✅ Uses template's numbering system (professional Word output)
- ✅ No template modification needed
- ✅ Simple code change

**Cons**:
- ❌ Loses manual numbering customization (user can't control numbering)
- ❌ Template must have numbering configured correctly
- ❌ Changes markdown content before export (side effect)

**Code Changes**: Modify `src/utils/pandocExport.ts`

---

### Option 3: Create Two Template Versions

**Action**: Provide two template options - one with numbering, one without.

**Implementation**:
- Template A: `SPD_Template_WithNumbering.docx` (automatic numbering)
- Template B: `SPD_Template_NoNumbering.docx` (no numbering)
- UI option: "Use template numbering" checkbox

**User Workflow**:
1. Upload template
2. Choose: "Use template numbering" or "Use markdown numbering"
3. Backend uses appropriate template or strips numbering accordingly

**Pros**:
- ✅ Flexible - user controls numbering mode
- ✅ Supports both use cases (manual vs template numbering)
- ✅ No loss of functionality

**Cons**:
- ❌ Requires maintaining two template versions
- ❌ More complex UI
- ❌ Template management overhead

**Code Changes**:
- Add UI checkbox in `ExportModal.tsx`
- Add logic in `pandocExport.ts` to strip numbering conditionally

---

### Option 4: Add UI Controls for Numbering Mode

**Action**: Add UI option to let users choose numbering mode per export.

**Implementation**:
```typescript
// ExportModal.tsx
<label>
  <input type="radio" name="numbering" value="markdown" />
  Use markdown numbering (template without auto-numbering)
</label>
<label>
  <input type="radio" name="numbering" value="template" />
  Use template numbering (strip markdown numbers)
</label>
```

**Backend Logic**:
```typescript
if (options.numberingMode === 'template') {
  // Strip manual numbering from markdown
  markdown = stripManualNumbering(markdown);
}
// Else: use markdown as-is (requires template without numbering)
```

**Pros**:
- ✅ User control per export
- ✅ No template duplication required
- ✅ Clear user intent

**Cons**:
- ❌ Still requires template without numbering for markdown mode
- ❌ Additional UI complexity
- ❌ User must understand the difference

**Code Changes**:
- Modify `ExportModal.tsx` to add radio buttons
- Modify `pandocExport.ts` to add `stripManualNumbering()` function
- Modify `server/pandoc-service.js` to handle numbering mode

---

## Recommended Solution

**Primary Recommendation**: **Option 1 - Modify Word Template**

**Rationale**:
1. TechSpec Studio's markdown already includes manual numbering
2. Users have fine-grained control over section numbering in markdown
3. Template should preserve formatting (fonts, colors, headers) but NOT numbering
4. Clean separation of concerns: markdown controls structure, template controls styling

**Implementation**:
1. Create modified template: `SPD_Customer_ProjectName_2018_BFP_NoNumbering.docx`
2. Remove automatic numbering from Heading 1-6 styles
3. Document the change in template README
4. Optionally: Keep original template for users who prefer template numbering

**Fallback Option**: If template modification is not approved, implement **Option 2** (strip manual numbering) as it requires minimal code changes.

---

## Pandoc Flags Reference

For reference, here are all relevant Pandoc flags researched:

### Numbering Flags
```bash
--number-sections         # Add Pandoc auto-numbering (would stack with template)
--number-offset=N         # Start Pandoc numbering at N (doesn't help)
--shift-heading-level-by=N # Shift heading hierarchy (not relevant)
```

### TOC Flags
```bash
--toc                     # Generate automatic table of contents
--toc-depth=N             # TOC depth (1-6, default 3)
```

### Template Flags
```bash
--reference-doc=FILE      # Apply Word template (ALL styles including numbering)
--standalone              # Produce complete document (not fragment)
```

### Input/Output Flags
```bash
--from=gfm                # GitHub-flavored markdown input
--output=FILE             # Output file path
```

**Key Finding**: NO flag exists to disable template heading numbering while preserving other template properties.

---

## Testing Checklist

When implementing the chosen solution:

- [ ] Backend logs show correct Pandoc command (no unexpected flags)
- [ ] Exported DOCX has single numbering (not double)
- [ ] Template formatting preserved (fonts, colors, headers, footers)
- [ ] Table of Contents appears only when `includeTOC: true`
- [ ] Heading styles match template (font, size, spacing)
- [ ] Test with multiple section levels (1, 1.1, 1.1.1, etc.)
- [ ] Test with sections without manual numbering
- [ ] Test with custom numbering schemes (e.g., A.1, B.2)

---

## Files Modified (So Far)

### Backend
- [server/pandoc-service.js:145](server/pandoc-service.js#L145) - Fixed GFM syntax

### Frontend
- [src/components/ExportModal.tsx:113](src/components/ExportModal.tsx#L113) - Removed hardcoded `includeNumberSections`
- [src/utils/docxExport.ts:39](src/utils/docxExport.ts#L39) - Changed `includeTOC` default to `false`

### Documentation
- Created this investigation document

---

## Next Steps

**Awaiting user decision** on which solution to implement:
1. Modify Word template (recommended)
2. Strip manual numbering from markdown
3. Create two template versions
4. Add UI controls for numbering mode

Once direction is chosen, implementation can proceed.

---

## References

- Pandoc Manual: https://pandoc.org/MANUAL.html
- Word Template Styles: https://support.microsoft.com/en-us/office/customize-or-create-new-styles
- PANDOC_IMPLEMENTATION_COMPLETE.md - Full implementation details
- PANDOC_QUICK_TEST.md - Testing guide

---

**Document Created**: 2025-11-26
**Last Updated**: 2025-11-26
**Investigation Time**: ~2 hours
**Status**: Root cause identified, awaiting solution selection
