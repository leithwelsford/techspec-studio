# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

### Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Type-check and build for production
npm run preview      # Preview production build locally
npm run lint         # Check for TypeScript/ESLint errors
```

**Pandoc Export Backend** (optional, for professional DOCX export, requires Node.js 18+):
```bash
cd server && npm install && npm start  # Port 3001
cd server && npm run dev               # Port 3001, with hot-reload
# Or use: docker-compose up
```

**Docker Development** (runs both frontend and backend):
```bash
docker-compose up              # Start services (frontend:3000, backend:3001)
docker-compose up --build      # Rebuild and start
docker-compose down            # Stop services
```

### Critical Rules

1. **Use relative imports only** - `@/` path aliases are NOT configured
   ```typescript
   // ✅ CORRECT
   import { useProjectStore } from '../../store/projectStore';

   // ❌ WRONG - will fail
   import { useProjectStore } from '@/store/projectStore';
   ```

2. **Always initialize AI service before use** - API keys are stored encrypted
   ```typescript
   const decryptedKey = decrypt(aiConfig.apiKey);
   await aiService.initialize({ ...aiConfig, apiKey: decryptedKey });
   // Now safe to use AI service
   ```

3. **Use Zustand store actions only** - never mutate state directly
   ```typescript
   // ✅ CORRECT
   const updateSpec = useProjectStore(state => state.updateSpecification);
   updateSpec(newMarkdown);

   // ❌ WRONG
   project.specification.markdown = newMarkdown;
   ```

4. **Exclude current message from chat history**
   ```typescript
   const history = chatHistory.slice(0, -1);  // Exclude message just added
   ```

5. **Check types before creating new ones** - All types in `src/types/index.ts`
   ```typescript
   // Check existing types first:
   // Project, BlockDiagram, MermaidDiagram, PendingApproval, AIConfig, etc.
   ```

## Project Overview

**TechSpec Studio** - AI-powered technical specification authoring system for telecommunications (3GPP standards).

**Core Workflow**: BRS (Business Requirements Spec) → AI generates tech spec + diagrams → User reviews/refines → Export to DOCX

**Key Files**:
- [src/store/projectStore.ts](src/store/projectStore.ts) - Zustand store (single source of truth)
- [src/types/index.ts](src/types/index.ts) - All TypeScript types (check before creating new ones)
- [src/services/ai/AIService.ts](src/services/ai/AIService.ts) - AI orchestration (OpenRouter)
- [src/services/ai/contextManager.ts](src/services/ai/contextManager.ts) - Token budget allocation
- [server/pandoc-service.js](server/pandoc-service.js) - Pandoc backend (Express)
- [docs/README.md](docs/README.md) - Documentation index (50+ files)

## Architecture

### State Management (Zustand)

All application state lives in `projectStore.ts` with IndexedDB persistence (custom middleware in `src/utils/indexedDBMiddleware.ts`):

- **Project Data**: Specification (markdown), BRS document, block diagrams, sequence diagrams, references
- **AI State**: Config (encrypted API key), chat history, pending approvals, usage stats
- **Version History**: Automatic snapshots on significant changes
- **PDF References**: Large files stored separately via `documentStorage.ts` (IndexedDB)

**Storage Pattern**: Small state in Zustand store (auto-persisted), large binary data (PDFs, DOCX templates) stored via `documentStorage` service with references in store.

### AI Service Layer

```
src/services/ai/
├── AIService.ts           # Main orchestration (singleton)
├── providers/OpenRouterProvider.ts
├── prompts/
│   ├── systemPrompts.ts   # Base system prompts for all workflows
│   ├── documentPrompts.ts # Tech spec generation prompts
│   ├── diagramPrompts.ts  # Block & Mermaid diagram prompts
│   ├── sectionPrompts.ts  # Flexible section generation
│   ├── templatePrompts.ts # Template-specific prompts (3GPP, IEEE, ISO)
│   ├── structurePrompts.ts # AI structure discovery prompts
│   └── refinementPrompts.ts # Content refinement prompts
├── parsers/               # Block diagram JSON, Mermaid parsing
├── sectionAnalyzer.ts     # Section boundary detection
├── contextManager.ts      # Token budget calculation
├── tokenCounter.ts        # Token counting for cost estimation
└── webSearch.ts           # Brave Search API integration (optional)
```

**AI Provider**: OpenRouter (openrouter.ai) - unified access to Claude, GPT-4, Gemini, etc.

**Key Pattern**: Always decrypt API key before AI calls:
```typescript
const { decrypt } = await import('../../utils/encryption');
const decryptedKey = decrypt(aiConfig.apiKey);
await aiService.initialize({ ...aiConfig, apiKey: decryptedKey });
```

**AI Service Methods**:
- `generate()` / `generateStream()` - Basic completions
- `chat()` / `chatStream()` - Conversation with history
- `generateDocument()` - Full spec generation
- `generateSection()` - Individual sections
- `generateDiagrams()` - Block & Mermaid diagrams

**Context Management**: The `contextManager.ts` handles token budget allocation:
- Priority order: BRS document (highest) → Previous sections → References → Web search
- Model context limits fetched from OpenRouter API (`getModelContextLimitWithSource()`) with hardcoded fallbacks
- **Smart allocation**: Full documents included when they fit; relevance-based excerpting only when budget exceeded
- When excerpting: `scoreReferenceRelevance()` scores docs, budget distributed proportionally (more relevant = more tokens)
- Config: `maxReferenceTokens: 100000` (generous default), `minReferenceTokens: 500`

### Reference Documents

Multiple file types can be uploaded as reference documents for AI context:
- **Supported formats**: PDF, DOCX, TXT, MD
- Stored in IndexedDB via `documentStorage.ts` (avoids localStorage limits)
- Vision-capable models receive PDF pages as images
- Non-vision models receive extracted text fallback
- Store actions: `addPDFReference()`, `removePDFReference()`, `getPDFReferencesForGeneration()`

### Diagram Types

| Type | Technology | Editor |
|------|------------|--------|
| Block diagrams | Custom SVG | BlockDiagramEditor.tsx |
| Sequence/Flow/State/Class | Mermaid.js | SequenceDiagramEditor.tsx |

### Data Flow

```
User Action → Zustand Action → Immutable State Update → React Re-render → Auto-save
```

**AI Generation Flow**:
```
Generate → Create PendingApproval → User reviews in ReviewPanel → Approve → Apply + Snapshot
```

## Key Implementation Details

### Link Resolution System

Documents use `{{fig:diagram-id}}` and `{{ref:3gpp-ts-23-203}}` syntax:
- Resolved at preview time, export time, and for click navigation
- Implementation: [src/utils/linkResolver.ts](src/utils/linkResolver.ts)

### Template System

Three built-in templates: 3GPP, IEEE 830, ISO 29148
- Templates in [src/data/templates/](src/data/templates/)
- Section customization with drag-and-drop reordering (@dnd-kit)

### BRS Document Handling

The BRS (Business Requirements Spec) is the input document that drives spec generation:
- Uploaded as DOCX (parsed via `mammoth`) or entered as markdown
- Text and token estimate extracted at upload time for efficient context building
- Stored in `project.brsDocument` with `extractedText` and `tokenEstimate` fields
- Used as primary context for all AI generation calls

### Structure Discovery Workflow

AI-assisted document structure planning before generation:
- State tracked in `structurePlanning` field of store (`StructurePlanningState` type)
- `StructureDiscoveryModal.tsx` - Main wizard UI with multi-step flow
- `StructureProposalView.tsx` - Displays AI-proposed sections for user review
- `StructureChatPanel.tsx` - Interactive refinement of proposed structure
- `DomainOverridePanel.tsx` - Domain configuration (telecom, general, etc.)

**Flow**: BRS analysis → AI proposes structure → User reviews/edits → Approved structure guides generation

### Export System

- **Browser-based**: DOCX generation via `docx` library
- **Pandoc-based**: Professional output with full template preservation (requires backend on port 3001)

### Approval Workflow

All AI-generated content goes through approval:
1. AI generates content → creates `PendingApproval`
2. User reviews in `ReviewPanel` with diff view
3. Approve → applies changes + creates version snapshot
4. Reject → discards with optional feedback

**PendingApproval types**: `'section'` | `'diagram'` | `'refinement'`

```typescript
// Creating an approval (in AI service or component)
const approval: PendingApproval = {
  id: crypto.randomUUID(),
  type: 'section',
  title: 'Generated Introduction',
  originalContent: existingContent,
  proposedContent: aiGeneratedContent,
  timestamp: Date.now(),
};
addPendingApproval(approval);
```

## Common Issues

### "AI service not initialized"
Forgot to decrypt and initialize. See AI Service Layer pattern above.

### TypeScript import errors (`Cannot find module '@/...'`)
Using `@/` aliases which aren't configured. Use relative paths instead.

### Mermaid diagram not rendering
Invalid syntax. Validate at https://mermaid.live. Use "Try Self-Healing" button for AI-assisted fixes.

### Placeholder text in AI output ("[Previous sections remain unchanged]")
AI generated incomplete content. Retry the request or switch to Claude Opus for better reliability.

### State not persisting
Check browser console for localStorage/IndexedDB errors. Try `localStorage.clear()` if quota exceeded.

### Clearing persisted data
Use the "Clear Data" button in the UI header (recommended), or via DevTools console:
```javascript
localStorage.removeItem('tech-spec-project');  // Clear project data
// For IndexedDB (PDF references, large files):
indexedDB.deleteDatabase('techspec-documents');
location.reload();
```

### Debugging store state
```javascript
// In browser console, inspect Zustand state:
JSON.parse(localStorage.getItem('tech-spec-project'))
```

## Environment Variables

Create `.env.local` (optional, for pre-configured environments):
```bash
VITE_OPENROUTER_API_KEY=sk-or-v1-...
VITE_OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
VITE_AI_TEMPERATURE=0.7
VITE_AI_MAX_TOKENS=4096
VITE_AI_ENABLE_STREAMING=true
VITE_PANDOC_API_URL=http://localhost:3001/api
VITE_BRAVE_API_KEY=...              # Optional: for web search
VITE_ENABLE_WEB_SEARCH=true         # Optional: enable Brave Search
```

**Note**: Only `VITE_` prefixed variables are exposed to the browser (Vite requirement).

## Testing

- **Manual**: "Run Tests" button in UI (sanity checks)
- **Automated**: Not yet configured (Jest + RTL planned)

## Documentation

Detailed documentation in [docs/](docs/):
- `docs/architecture/` - System design, AI integration
- `docs/phases/` - Phase completion reports
- `docs/features/` - Feature implementations
- `docs/bugs-and-fixes/` - Bug investigations and fixes

## Key Dependencies

- **React 18** + **Vite 5** + **TypeScript 5**
- **Zustand 5** - State management with persistence
- **Tailwind CSS 3.4** - Styling (not v4)
- **Mermaid 11** - Sequence/flow diagrams
- **docx 9** - DOCX generation
- **crypto-js 4** - API key encryption
- **@dnd-kit** - Drag-and-drop for section reordering
- **mammoth** - DOCX parsing for reference documents
- **pdfjs-dist** - PDF page rendering for multimodal AI context
- **idb** - IndexedDB wrapper for large data persistence
- **diff** - Diff calculation for approval workflow

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Core editor | ✅ | ✅ | ✅ | ✅ |
| File System API | ✅ | ❌ | ❌ | ✅ |
| Clipboard API | ✅ | ✅ | ✅ | ✅ |

## Component Overview

Key UI components in `src/components/`:
- **Workspace.tsx** - Main container, tab navigation, layout
- **ai/ChatPanel.tsx** - Interactive AI chat interface
- **ai/ReviewPanel.tsx** - Approval workflow with diff view
- **ai/GenerateSpecModal.tsx** - Full specification generation wizard
- **ai/StructureDiscoveryModal.tsx** - AI-assisted structure planning wizard
- **ai/SectionComposer.tsx** - Section-by-section editing
- **ai/AIConfigPanel.tsx** - OpenRouter API configuration
- **editors/MarkdownEditor.tsx** - Tech spec editor with preview
- **editors/BlockDiagramEditor.tsx** - Custom SVG diagram editor (largest component)
- **editors/SequenceDiagramEditor.tsx** - Mermaid-based sequence diagrams
- **ExportModal.tsx** - DOCX/Pandoc export options

## Keyboard Shortcuts

**Editor:**
- `Enter` - Send chat message
- `Shift + Enter` - New line in chat input

**Diagram Canvas:**
- `Space + Drag` - Pan the canvas
- `Scroll Wheel` - Zoom in/out
- `Double-click` - Edit node/edge labels
- `Drag corners` - Resize nodes

## Git Commit Format

Follow conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

Example: `feat: add SequenceDiagramEditor with live preview`
