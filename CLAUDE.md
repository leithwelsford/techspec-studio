# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Type-check and build for production
npm run preview      # Preview production build locally
npm run lint         # Check for TypeScript/ESLint errors
```

**Note**: No test suite exists. Verify changes manually by running the app.

**Pandoc Backend** (optional, for DOCX export with Word templates, requires Node ≥18):
```bash
cd server && npm install && npm start       # Port 3001
cd server && npm run dev                    # With --watch hot reload
# Or: docker-compose up                     # Both services via Docker
```

**Note**: Dev server uses `strictPort: true` on port 3000. If port is in use, it will fail rather than try another port.

## Critical Rules

1. **Use relative imports only** - `@/` path aliases are NOT configured
   ```typescript
   // ✅ CORRECT
   import { useProjectStore } from '../../store/projectStore';
   // ❌ WRONG
   import { useProjectStore } from '@/store/projectStore';
   ```

2. **Always initialize AI service before use** - API keys are stored encrypted
   ```typescript
   const { decrypt } = await import('../../utils/encryption');
   const decryptedKey = decrypt(aiConfig.apiKey);
   await aiService.initialize({ ...aiConfig, apiKey: decryptedKey });
   ```

3. **Use Zustand store actions only** - never mutate state directly
   ```typescript
   // ✅ CORRECT
   const updateSpec = useProjectStore(state => state.updateSpecification);
   updateSpec(newMarkdown);
   // ❌ WRONG
   project.specification.markdown = newMarkdown;
   ```

4. **Exclude current message from chat history** when calling AI
   ```typescript
   const history = chatHistory.slice(0, -1);  // Exclude message just added
   ```

5. **Check types before creating new ones** - All types in `src/types/index.ts`

6. **TypeScript strict mode** - No implicit any, unused vars/params disallowed. Prefix unused params with underscore: `(_event: Event) => {}`

## Project Overview

**TechSpec Studio** - AI-powered technical specification authoring system for telecommunications (3GPP standards).

**Core Workflow**: BRS (Business Requirements Spec) → AI generates tech spec + diagrams → User reviews/refines → Export to DOCX

**Key Files**:
- [src/store/projectStore.ts](src/store/projectStore.ts) - Zustand store (single source of truth)
- [src/types/index.ts](src/types/index.ts) - All TypeScript types
- [src/services/ai/AIService.ts](src/services/ai/AIService.ts) - AI orchestration (OpenRouter)
- [src/services/ai/contextManager.ts](src/services/ai/contextManager.ts) - Token budget allocation
- [server/pandoc-service.js](server/pandoc-service.js) - Pandoc backend (Express)

**Directory Structure**:
```
src/
├── components/         # React components
│   ├── ai/            # AI-related UI (ChatPanel, ReviewPanel, etc.)
│   ├── editors/       # MarkdownEditor, BlockDiagramEditor, SequenceDiagramEditor
│   └── documents/     # Reference document handling
├── services/
│   ├── ai/            # AI service, prompts, parsers, context management
│   └── storage/       # IndexedDB document storage
├── store/             # Zustand store (projectStore.ts)
├── types/             # TypeScript types (index.ts)
├── utils/             # Utilities (encryption, export, markdown processing)
└── data/templates/    # Spec templates (3GPP, IEEE, ISO)
```

## Architecture

### State Management (Zustand)

All state in `projectStore.ts` with IndexedDB persistence (middleware in `src/utils/indexedDBMiddleware.ts`):
- **Project Data**: Specification (markdown), BRS document, diagrams, references
- **AI State**: Config (encrypted API key), chat history, pending approvals
- **Version History**: Automatic snapshots on significant changes

**Storage Pattern**: Small state auto-persisted in Zustand, large binary data (PDFs, DOCX templates) stored via `documentStorage.ts` (IndexedDB) with references in store.

### AI Service Layer

**Provider**: OpenRouter (openrouter.ai) - unified access to Claude, GPT-4, Gemini, etc.

**Key Methods**:
- `generate()` / `generateStream()` - Basic completions
- `chat()` / `chatStream()` - Conversation with history
- `generateDocument()` - Full spec generation
- `generateSection()` - Individual sections
- `generateDiagrams()` - Block & Mermaid diagrams

**Context Management** (`contextManager.ts`):
- Priority: BRS document (highest) → Previous sections → References → Web search
- Full documents included when they fit; relevance-based excerpting when budget exceeded

**Prompts Organization** (`src/services/ai/prompts/`):
- `systemPrompts.ts` - Base system prompts, telecom domain expertise
- `documentPrompts.ts` - Full document generation
- `sectionPrompts.ts` - Individual section generation
- `refinementPrompts.ts` - Content refinement and cascaded updates
- `diagramPrompts.ts` - Block and Mermaid diagram generation
- `structurePrompts.ts` - Document structure discovery
- `templatePrompts.ts` - Template-aware generation

### Data Flow

```
User Action → Zustand Action → Immutable State Update → React Re-render → Auto-save
```

**AI Generation Flow**:
```
Generate → Create PendingApproval → User reviews in ReviewPanel → Approve → Apply + Snapshot
```

### Diagram Types

| Type | Technology | Editor |
|------|------------|--------|
| Block diagrams | Custom SVG | BlockDiagramEditor.tsx |
| Sequence/Flow/State | Mermaid.js | SequenceDiagramEditor.tsx |

**Parsers** (`src/services/ai/parsers/`): Convert AI text responses into structured diagram data:
- `blockDiagramParser.ts` - Extracts nodes/edges from AI response
- `mermaidParser.ts` - Extracts and validates Mermaid code blocks

## Key Patterns

### Link Resolution
Documents use `{{fig:diagram-id}}` and `{{ref:3gpp-ts-23-203}}` syntax. Implementation: [src/utils/linkResolver.ts](src/utils/linkResolver.ts)

### Approval Workflow
All AI-generated content goes through approval:
1. AI generates → creates `PendingApproval` (types: `'section'` | `'diagram'` | `'refinement'` | `'cascaded-refinement'`)
2. User reviews in `ReviewPanel` with diff view
3. Approve → applies changes + creates version snapshot

```typescript
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

### Cascaded Refinement
When refining a section, changes may propagate to other sections for consistency. Types: `ImpactAnalysis`, `AffectedSection`, `PropagatedChange` in [src/types/index.ts](src/types/index.ts).

### BRS Document Handling
- Uploaded as DOCX (parsed via `mammoth`) or entered as markdown
- Text and token estimate extracted at upload time
- Stored in `project.brsDocument` with `extractedText` and `tokenEstimate` fields

### Structure Discovery
AI-assisted document structure planning before generation:
- State in `structurePlanning` field (`StructurePlanningState` type)
- Flow: BRS analysis → AI proposes structure → User reviews → Approved structure guides generation

### DOCX Template Analysis
Upload Word templates for style-aware export:
- `DocxTemplateAnalysis` stores extracted styles, numbering, structure
- Template stored in IndexedDB, analysis cached in store
- Pandoc export uses extracted styles for `custom-style` attributes

## Keyboard Shortcuts

| Context | Shortcut | Action |
|---------|----------|--------|
| Editor | Split view button | Toggle markdown/preview split |
| Chat | Enter | Send message |
| Chat | Shift + Enter | New line |
| Diagram canvas | Space + Drag | Pan |
| Diagram canvas | Scroll wheel | Zoom |
| Diagram canvas | Double-click | Edit node/edge label |
| Diagram canvas | Drag corners | Resize node |

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed solutions.

**Quick Fixes**:
- **"AI service not initialized"**: Decrypt and initialize before use (see Critical Rules #2)
- **Import errors with `@/`**: Use relative imports only
- **State not persisting**: Check console for IndexedDB errors
- **Mermaid not rendering**: Validate at https://mermaid.live

**Clearing Data**:
```javascript
localStorage.removeItem('tech-spec-project');
indexedDB.deleteDatabase('techspec-documents');
location.reload();
```

**Debugging Store State**:
```javascript
JSON.parse(localStorage.getItem('tech-spec-project'))
```

## Environment Variables

Create `.env.local` (optional):
```bash
VITE_OPENROUTER_API_KEY=sk-or-v1-...
VITE_OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
VITE_AI_TEMPERATURE=0.7
VITE_AI_MAX_TOKENS=4096
VITE_AI_ENABLE_STREAMING=true
VITE_PANDOC_API_URL=http://localhost:3001/api
VITE_BRAVE_API_KEY=...              # Optional: web search
VITE_ENABLE_WEB_SEARCH=true         # Optional
```

Only `VITE_` prefixed variables are exposed to the browser.

## Documentation

Detailed docs in [docs/](docs/):
- `docs/architecture/` - System design, AI integration
- `docs/features/` - Feature implementations
- `docs/bugs-and-fixes/` - Bug investigations and fixes

## Git Commit Format

Follow conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`

Example: `feat: add SequenceDiagramEditor with live preview`
