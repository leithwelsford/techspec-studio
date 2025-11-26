# Template-Based DOCX Export

**Feature**: Upload a custom DOCX template and use it for specification export
**Status**: ✅ Implemented (2025-11-25)
**Files**:
- `src/utils/templateDocxExport.ts` - Template processing logic
- `src/components/ExportModal.tsx` - Template upload UI
- `src/store/projectStore.ts` - Template storage actions

---

## Overview

Users can now upload their own DOCX template file to maintain organizational branding and formatting standards when exporting technical specifications. The template system replaces placeholders with actual content while preserving all formatting, styles, headers, footers, and page layouts.

---

## How It Works

### 1. Template Upload

Users upload a `.docx` file through the Export Modal. The file is:
- Read as binary data
- Converted to base64 encoding
- Stored in the project state (persisted to IndexedDB)
- Available for all future exports until cleared

### 2. Placeholder Syntax

The template should contain placeholders wrapped in double curly braces:

| Placeholder | Description | Example Output |
|-------------|-------------|----------------|
| `{{TITLE}}` | Specification title | "5G Service Edge Specification" |
| `{{VERSION}}` | Project version | "1.0" |
| `{{DATE}}` | Export date | "2025-11-25" |
| `{{AUTHOR}}` | Author name | "John Doe" |
| `{{COMPANY}}` | Company name | "Acme Telecom" |
| `{{CUSTOMER}}` | Customer name | "MegaCorp" |
| `{{CONTENT}}` | Main specification content (markdown converted to WordML) | Full document paragraphs |
| `{{TOC}}` | Table of Contents (if enabled) | Generated TOC |
| `{{FIGURES}}` | List of Figures (if enabled) | "Figure 4-1: Architecture..." |
| `{{BIBLIOGRAPHY}}` | References section (if enabled) | "[1] 3GPP TS 23.203..." |

### 3. Export Process

When exporting with a template:

```typescript
// 1. Load template from base64
const zip = new PizZip(atob(templateBase64));

// 2. Extract document.xml
const documentXml = zip.file('word/document.xml').asText();

// 3. Replace placeholders
const updatedXml = replacePlaceholders(documentXml, {
  TITLE: project.specification.title,
  CONTENT: markdownToWordML(resolvedMarkdown),
  TOC: generateTOCXml(),
  // ... other placeholders
});

// 4. Update zip and generate blob
zip.file('word/document.xml', updatedXml);
const blob = zip.generate({ type: 'blob' });
```

---

## Creating a Template

### Example Template Structure

1. **Create a Word document** with your organization's formatting:
   - Headers with company logo
   - Footers with page numbers
   - Custom styles (fonts, colors, spacing)
   - Cover page design

2. **Insert placeholders** where content should appear:
   ```
   {{TITLE}}
   Version: {{VERSION}}
   Date: {{DATE}}

   {{TOC}}

   {{CONTENT}}

   {{FIGURES}}

   {{BIBLIOGRAPHY}}
   ```

3. **Save as .docx** and upload through the Export Modal

### Example Template Layout

```
┌─────────────────────────────────────┐
│  [Company Logo]   TECHNICAL SPEC    │ ← Header
├─────────────────────────────────────┤
│                                     │
│  {{TITLE}}                          │
│  Version {{VERSION}}                │
│  {{DATE}}                           │
│  Author: {{AUTHOR}}                 │
│  Company: {{COMPANY}}               │
│                                     │
│  ═══ PAGE BREAK ═══                │
│                                     │
│  Table of Contents                  │
│  {{TOC}}                            │
│                                     │
│  ═══ PAGE BREAK ═══                │
│                                     │
│  {{CONTENT}}                        │
│                                     │
│  ═══ PAGE BREAK ═══                │
│                                     │
│  List of Figures                    │
│  {{FIGURES}}                        │
│                                     │
│  ═══ PAGE BREAK ═══                │
│                                     │
│  References                         │
│  {{BIBLIOGRAPHY}}                   │
│                                     │
├─────────────────────────────────────┤
│  Page {{PAGE}} of {{NUMPAGES}}     │ ← Footer
└─────────────────────────────────────┘
```

---

## User Interface

### Upload Section (Export Modal)

```
┌──────────────────────────────────────────┐
│ DOCX Template (Optional)                 │
│ Upload a .docx template with             │
│ placeholders like: TITLE, CONTENT, etc.  │
│                                          │
│ [Upload Template]  [Clear Template]     │
│ ✓ Template loaded                        │
│                                          │
│ ☑ Use uploaded template for export      │
└──────────────────────────────────────────┘
```

### Workflow

1. Click "Export" button in Workspace header
2. Export Modal opens
3. Select "DOCX Document" export type
4. Click "Upload Template" button
5. Choose `.docx` file from file system
6. Template is loaded and stored
7. Check "Use uploaded template for export"
8. Configure other options (TOC, Figures, etc.)
9. Click "Export"
10. DOCX file downloads with template formatting applied

---

## Technical Implementation

### Store Actions

```typescript
// Set template (base64 encoded)
setDocxTemplate(templateBase64: string): void

// Clear template
clearDocxTemplate(): void

// Get current template
getDocxTemplate(): string | undefined
```

### Export Functions

```typescript
// Template-based export
export async function exportWithTemplate(
  project: Project,
  templateBase64: string,
  options: ExportOptions
): Promise<Blob>

// Download helper
export function downloadTemplateDocx(blob: Blob, filename: string): void
```

### Markdown to WordML Conversion

The `markdownToWordML()` function converts markdown syntax to WordprocessingML (DOCX XML format):

- **Headings**: `# Title` → `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>...`
- **Bold**: `**text**` → `<w:r><w:rPr><w:b/></w:rPr><w:t>text</w:t></w:r>`
- **Italic**: `*text*` → `<w:r><w:rPr><w:i/></w:rPr><w:t>text</w:t></w:r>`
- **Code**: `` `code` `` → `<w:r><w:rPr><w:rFonts w:ascii="Courier New"/></w:rPr>...`
- **Lists**: `- item` → `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/>...`

---

## Benefits

1. **Brand Consistency**: Use organization's official templates
2. **Regulatory Compliance**: Maintain required formatting for certifications
3. **Professional Output**: Polished documents matching corporate standards
4. **Reusability**: Upload once, use for all exports
5. **Flexibility**: Switch between default export and template-based export

---

## Fallback Behavior

If no template is uploaded or the "Use template" checkbox is unchecked:
- System uses the built-in 3GPP-style export
- All options still work (TOC, Figures, Bibliography, etc.)
- Default styling is professional and standards-compliant

---

## Limitations

1. **Template Validation**: Basic validation only (.docx extension check)
2. **Placeholder Errors**: Invalid placeholders are left as-is (not replaced)
3. **Complex Formatting**: Some advanced Word features may not preserve perfectly
4. **Diagram Embedding**: Not yet implemented in template mode (placeholder only)

---

## Future Enhancements

- [ ] Visual template preview before export
- [ ] Template library with pre-built industry-standard templates
- [ ] Diagram embedding in template mode
- [ ] Advanced placeholder syntax (conditionals, loops)
- [ ] Template validation and placeholder detection
- [ ] Multiple template management
- [ ] Template sharing between projects

---

## Related Documentation

- [Phase 4 Completion Report](/PHASE4_COMPLETE.md)
- [DOCX Export Utilities](/src/utils/docxExport.ts)
- [Template Export Utilities](/src/utils/templateDocxExport.ts)
- [Export Modal Component](/src/components/ExportModal.tsx)

---

**Feature Status**: ✅ Complete and ready for testing
**Next Steps**: Create sample template file for users to download and customize
