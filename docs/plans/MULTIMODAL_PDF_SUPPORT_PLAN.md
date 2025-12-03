# Multimodal PDF Support Implementation Plan

## Overview

Enable native PDF upload for reference documents using OpenRouter's Universal PDF Support feature. This allows vision-capable models (Gemini, Claude 3, GPT-4o) to directly analyze PDF documents without client-side text extraction.

## Goals

1. Allow users to upload PDF reference documents
2. Send PDFs natively to vision-capable models via OpenRouter
3. Display context window usage warnings
4. Support multiple reference documents per generation
5. Graceful fallback for non-vision models (extract text client-side)

## Architecture

```
User uploads PDF → Store in IndexedDB → Generate spec request
                                              ↓
                              Check if model supports vision
                                    ↓              ↓
                              [Yes]              [No]
                                ↓                  ↓
                        Send as base64      Extract text via
                        multimodal msg      pdf-parse library
                                    ↓              ↓
                              ← OpenRouter API ←
```

## Phase 1: OpenRouter Provider Multimodal Support

### 1.1 Update Message Types

**File:** `src/types/index.ts`

```typescript
/**
 * Multimodal content part for OpenRouter API
 */
export type MultimodalContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
  | { type: 'file'; file: { filename: string; file_data: string } };

/**
 * Extended AI message supporting multimodal content
 */
export interface AIMessageMultimodal {
  role: 'system' | 'user' | 'assistant';
  content: string | MultimodalContentPart[];
}

/**
 * Reference document stored in project
 */
export interface ReferenceDocument {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  // For PDFs: base64 data stored in IndexedDB
  // For text: extracted content
  dataRef?: string;  // IndexedDB key for large files
  extractedText?: string;  // Fallback text extraction
  tokenEstimate?: number;
}
```

### 1.2 Update OpenRouterProvider

**File:** `src/services/ai/providers/OpenRouterProvider.ts`

Add multimodal generation method:

```typescript
/**
 * Generate completion with multimodal content (images/PDFs)
 */
async generateMultimodal(
  messages: AIMessageMultimodal[],
  config: Partial<AIConfig> & { pdfEngine?: 'auto' | 'mistral-ocr' | 'pdf-text' }
): Promise<{
  content: string;
  tokens: { prompt: number; completion: number; total: number };
  cost: number;
}>
```

Changes:
- Accept `content` as string OR array of content parts
- Add `plugins` parameter for PDF processing engine selection
- Handle base64 encoding of file data

### 1.3 Add Vision Model Detection

**File:** `src/services/ai/providers/OpenRouterProvider.ts`

```typescript
/**
 * Check if a model supports vision/multimodal input
 */
isVisionModel(modelId: string): boolean {
  const visionModels = [
    'google/gemini-2.0-flash',
    'google/gemini-1.5-pro',
    'google/gemini-1.5-flash',
    'anthropic/claude-3.5-sonnet',
    'anthropic/claude-3-opus',
    'anthropic/claude-3-sonnet',
    'anthropic/claude-3-haiku',
    'openai/gpt-4o',
    'openai/gpt-4-turbo',
    'openai/gpt-4-vision-preview',
  ];
  return visionModels.some(v => modelId.includes(v));
}
```

---

## Phase 2: Reference Document Storage

### 2.1 Add IndexedDB Storage for Large Files

**File:** `src/services/storage/documentStorage.ts` (new)

```typescript
/**
 * IndexedDB storage for large reference documents
 * Keeps base64 PDF data out of localStorage/Zustand
 */
export class DocumentStorage {
  private dbName = 'techspec-documents';
  private storeName = 'reference-docs';

  async storeDocument(id: string, data: ArrayBuffer): Promise<void>;
  async getDocument(id: string): Promise<ArrayBuffer | null>;
  async deleteDocument(id: string): Promise<void>;
  async getDocumentAsBase64(id: string): Promise<string | null>;
}
```

### 2.2 Update Project Store

**File:** `src/store/projectStore.ts`

Add reference document management:

```typescript
// State
referenceDocuments: ReferenceDocument[];

// Actions
addReferenceDocument: (doc: ReferenceDocument) => void;
removeReferenceDocument: (id: string) => void;
clearReferenceDocuments: () => void;
getReferenceDocumentsForGeneration: () => Promise<ReferenceDocumentContent[]>;
```

### 2.3 Token Estimation for Documents

**File:** `src/services/ai/tokenCounter.ts` (existing)

Add PDF token estimation:

```typescript
/**
 * Estimate tokens for a PDF document
 * OpenRouter charges based on page count for PDFs
 * Approximate: 1 page ≈ 1,500-2,000 tokens
 */
estimatePDFTokens(pageCount: number): number;

/**
 * Estimate total context usage including reference docs
 */
estimateTotalContextUsage(
  brsContent: string,
  referenceDocuments: ReferenceDocument[],
  systemPromptTokens: number
): {
  total: number;
  breakdown: {
    brs: number;
    references: number;
    system: number;
  };
  warnings: string[];
};
```

---

## Phase 3: Reference Document Upload UI

### 3.1 Create Upload Component

**File:** `src/components/documents/ReferenceDocumentUpload.tsx` (new)

Features:
- Drag-and-drop PDF upload
- File size validation (max 20MB per file)
- Multiple file support
- Upload progress indicator
- Token estimate display per document
- Remove document button

```tsx
interface ReferenceDocumentUploadProps {
  documents: ReferenceDocument[];
  onUpload: (files: File[]) => Promise<void>;
  onRemove: (id: string) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}
```

### 3.2 Context Window Warning Component

**File:** `src/components/documents/ContextWindowWarning.tsx` (new)

Display:
- Total estimated tokens vs model context limit
- Visual progress bar (green/yellow/red)
- Per-document token breakdown
- Warning messages when approaching limit
- Suggestion to reduce documents if over limit

```tsx
interface ContextWindowWarningProps {
  modelContextLimit: number;
  estimatedUsage: {
    total: number;
    breakdown: {
      brs: number;
      references: number;
      system: number;
      outputReserved: number;
    };
  };
}
```

### 3.3 Integrate into GenerateSpecModal

**File:** `src/components/ai/GenerateSpecModal.tsx`

Add:
- Reference document upload section
- Context window warning display
- Option to enable/disable reference docs for generation
- Model compatibility indicator (vision vs text-only)

---

## Phase 4: AI Service Integration

### 4.1 Update Generation Methods

**File:** `src/services/ai/AIService.ts`

Modify `generateSpecificationFromTemplate`:

```typescript
async generateSpecificationFromTemplate(
  brs: string,
  template: SpecificationTemplate,
  config: ProjectTemplateConfig,
  options?: {
    referenceDocuments?: ReferenceDocument[];
    useMultimodal?: boolean;
  }
): Promise<GenerationResult>
```

Logic:
1. Check if model supports vision
2. If vision + PDFs provided → use multimodal API
3. If no vision + PDFs provided → extract text fallback
4. Build appropriate message format
5. Include reference context in system prompt

### 4.2 PDF Text Extraction Fallback

**File:** `src/services/documents/pdfExtractor.ts` (new)

For non-vision models, extract text client-side:

```typescript
import * as pdfjsLib from 'pdfjs-dist';

/**
 * Extract text from PDF for non-vision model fallback
 */
export async function extractPDFText(pdfData: ArrayBuffer): Promise<{
  text: string;
  pageCount: number;
}>;
```

Dependencies to add:
- `pdfjs-dist` (Mozilla's PDF.js)

---

## Phase 5: DOCX Support (Optional Enhancement)

### 5.1 DOCX to PDF Conversion

Since OpenRouter doesn't support DOCX natively, options:

**Option A: Client-side text extraction (recommended)**
- Use existing `mammoth.js` to extract text
- Send as text context (not multimodal)

**Option B: Server-side PDF conversion**
- Add endpoint to Pandoc server: `/api/convert/docx-to-pdf`
- Convert DOCX → PDF → send to OpenRouter
- More complex, requires server

### 5.2 Implementation for Option A

**File:** `src/services/documents/docxExtractor.ts` (new)

```typescript
import mammoth from 'mammoth';

export async function extractDOCXContent(docxData: ArrayBuffer): Promise<{
  text: string;
  html: string;
}>;
```

---

## Phase 6: Testing & Validation

### 6.1 Test Cases

1. **PDF Upload Flow**
   - Upload single PDF
   - Upload multiple PDFs
   - Exceed file size limit
   - Invalid file type rejection

2. **Vision Model Generation**
   - Generate with PDF reference (Gemini)
   - Generate with PDF reference (Claude 3)
   - Verify PDF content appears in output

3. **Fallback Text Extraction**
   - Generate with PDF using text-only model
   - Verify extracted text used correctly

4. **Context Window Warnings**
   - Warning at 80% usage
   - Error at 100% usage
   - Correct token estimation

5. **Storage**
   - IndexedDB persistence
   - Document retrieval after reload
   - Cleanup on document removal

### 6.2 Manual Test Checklist

- [ ] Upload 5MB PDF successfully
- [ ] Upload 25MB PDF shows error
- [ ] Token estimate updates on upload
- [ ] Warning shown when context near limit
- [ ] Generation includes PDF context
- [ ] Non-vision model falls back to text
- [ ] Documents persist after page refresh
- [ ] Remove document clears from IndexedDB

---

## File Summary

### New Files
| File | Purpose |
|------|---------|
| `src/services/storage/documentStorage.ts` | IndexedDB wrapper for large files |
| `src/components/documents/ReferenceDocumentUpload.tsx` | Upload UI component |
| `src/components/documents/ContextWindowWarning.tsx` | Token usage display |
| `src/services/documents/pdfExtractor.ts` | PDF.js text extraction |
| `src/services/documents/docxExtractor.ts` | Mammoth.js DOCX extraction |

### Modified Files
| File | Changes |
|------|---------|
| `src/types/index.ts` | Add multimodal types, ReferenceDocument |
| `src/services/ai/providers/OpenRouterProvider.ts` | Add multimodal generation |
| `src/store/projectStore.ts` | Reference document state/actions |
| `src/services/ai/AIService.ts` | Integrate reference docs in generation |
| `src/services/ai/tokenCounter.ts` | PDF token estimation |
| `src/components/ai/GenerateSpecModal.tsx` | Upload UI integration |

### New Dependencies
| Package | Purpose |
|---------|---------|
| `pdfjs-dist` | PDF text extraction fallback |

---

## Implementation Order

1. **Phase 1** - OpenRouter multimodal support (foundation)
2. **Phase 2** - Storage layer (required for Phase 3)
3. **Phase 3** - Upload UI (user-facing)
4. **Phase 4** - AI Service integration (connects everything)
5. **Phase 5** - DOCX support (optional enhancement)
6. **Phase 6** - Testing

Estimated effort: 3-4 development sessions

---

## API Reference

### OpenRouter Multimodal Request Format

```json
{
  "model": "google/gemini-2.0-flash-exp",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Analyze this reference specification and extract key requirements."
        },
        {
          "type": "file",
          "file": {
            "filename": "reference-spec.pdf",
            "file_data": "data:application/pdf;base64,JVBERi0xLjQK..."
          }
        }
      ]
    }
  ],
  "plugins": [
    {
      "id": "file-parser",
      "pdf": {
        "engine": "auto"
      }
    }
  ]
}
```

### OpenRouter PDF Engine Options

| Engine | Description |
|--------|-------------|
| `auto` | Automatically select best engine |
| `mistral-ocr` | Use Mistral's OCR for scanned documents |
| `pdf-text` | Direct text extraction (faster, text-based PDFs) |

---

## Notes

- OpenRouter charges for PDF processing based on page count
- Large PDFs (>50 pages) may hit rate limits
- Consider chunking very large documents
- Vision models have higher per-token costs than text-only
