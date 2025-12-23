# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

**Tech Stack**: React 18 + Vite 5 + TypeScript 5 + Zustand 5 + Tailwind CSS 3.4

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Type-check and build for production
npm run preview      # Preview production build locally
npm run lint         # Check for TypeScript/ESLint errors (run before commits)
```

**Notes**:
- No test suite exists. Verify changes manually by running the app.
- Lint uses `--max-warnings 0` - any ESLint warning fails the check.
- React Strict Mode is enabled (components render twice in dev for detecting side effects).

**Pandoc Backend** (optional, for DOCX export with Word templates, requires Node ≥18):
```bash
cd server && npm install && npm start       # Port 3001
cd server && npm run dev                    # With --watch hot reload
# Or: docker-compose up                     # Both services via Docker
```

**Note**: Dev server uses `strictPort: true` on port 3000. If port is in use, it will fail rather than try another port.

**Editor Shortcuts** (for manual testing):
- **Space + Drag**: Pan diagram canvas
- **Scroll Wheel**: Zoom diagrams
- **Double-click**: Edit node/edge labels
- **Enter**: Send chat message
- **Shift + Enter**: New line in chat

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

7. **Never re-initialize Mermaid** - Mermaid is initialized once in `main.tsx`. Components should use `mermaid.render()` directly, never call `mermaid.initialize()`:
   ```typescript
   // ✅ CORRECT - use render directly
   import mermaid from 'mermaid';
   await mermaid.render(id, code);

   // ❌ WRONG - re-initializing causes render conflicts
   mermaid.initialize({ ... });
   ```

## Project Overview

**TechSpec Studio** - AI-powered technical specification authoring system for telecommunications (3GPP standards).

**Core Workflow**: BRS (Business Requirements Spec) → AI generates tech spec + diagrams → User reviews/refines → Export to DOCX

**Key Files**:
- [src/main.tsx](src/main.tsx) - App entry point (Mermaid init, React mount)
- [src/AppContainer.tsx](src/AppContainer.tsx) - Root component with error boundary
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

**Storage Pattern**:
- **localStorage** (`tech-spec-project` key): Zustand store state (project, AI config, chat history)
- **IndexedDB** (`techspec-documents` database): Large binary data (PDFs, DOCX templates) via `documentStorage.ts`
- Store holds references (IDs) to IndexedDB documents

### AI Service Layer

**Provider**: OpenRouter (openrouter.ai) - unified access to Claude, GPT-4, Gemini, etc.

**Key Methods**:
- `generate()` / `generateStream()` - Basic completions
- `chat()` / `chatStream()` - Conversation with history
- `generateDocument()` - Full spec generation
- `generateSection()` - Individual sections
- `generateDiagrams()` - Block & Mermaid diagrams

**Section Analyzer** (`sectionAnalyzer.ts`): AI-powered analysis of specification sections to detect which need diagrams. Scans for `{{fig:...}}` placeholders and infers diagram types from content.

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
- `legacyTelecomPrompts.ts` - Legacy 3GPP-specific prompts (deprecated)

### Data Flow

```
User Action → Zustand Action → Immutable State Update → React Re-render → Auto-save
```

**AI Generation Flow**:
```
Generate → Create PendingApproval → User reviews in ReviewPanel → Approve → Apply + Snapshot
```

### Diagram Types

**Two diagram technologies:**
| Type | Technology | Editor | Use Case |
|------|------------|--------|----------|
| Block diagrams | Custom SVG (JSON) | BlockDiagramEditor.tsx | Architecture, network topology, interactive editing |
| All other diagrams | Mermaid.js | SequenceDiagramEditor.tsx | 23 Mermaid types - see below |

**Supported Mermaid types** (AI selects based on `<!-- TODO: [DIAGRAM TYPE] -->` comments):
- **Core:** sequence, flow, state, class, er
- **Planning:** gantt, timeline, kanban
- **Data viz:** pie, quadrant, xy, sankey, radar, treemap
- **Architecture:** c4, architecture, block-beta
- **Other:** mindmap, journey, gitgraph, requirement, zenuml, packet

**Parsers** (`src/services/ai/parsers/`): Convert AI text responses into structured diagram data:
- `blockDiagramParser.ts` - Extracts nodes/edges from AI response
- `mermaidParser.ts` - Extracts and validates Mermaid code blocks

**Mermaid Self-Healing** (`src/services/mermaidSelfHealer.ts`): AI-powered automatic fix for Mermaid syntax errors. When a diagram fails to render, the self-healer sends the error and code to AI for correction.

**Mermaid Docs Cache** (`src/services/ai/mermaidDocsCache.ts`): Pre-fetches and caches Mermaid documentation at app startup (non-blocking). Provides syntax examples to AI for accurate diagram generation and error correction.

**Protocol Terminology** (`sectionPrompts.ts`): Auto-detects 50+ protocols (Gx, RADIUS, BGP, TLS, etc.) in content and injects exact command names into AI prompts. Ensures specifications use precise terminology (e.g., "CCR-I" not "policy request") even without reference documents.

## Key Patterns

### Link Resolution
Documents use `{{fig:diagram-id}}` and `{{ref:3gpp-ts-23-203}}` syntax:
- [src/utils/linkResolver.ts](src/utils/linkResolver.ts) - Core resolution logic and pattern matching
- [src/utils/remarkLinkResolver.ts](src/utils/remarkLinkResolver.ts) - Remark plugin for markdown preview
- [src/utils/figureNumbering.ts](src/utils/figureNumbering.ts) - Figure number calculation (e.g., section 5, position 1 → "5-1")
- [src/components/InlineDiagramPreview.tsx](src/components/InlineDiagramPreview.tsx) - Renders diagrams inline in markdown

**Diagram Matching Strategies** (in order of precedence):
1. Direct ID/UUID match
2. Figure number match (`5-1` or `fig-5-1`)
3. Figure number prefix in slug (`{{fig:5-1-description}}`)
4. Explicit `slug` field on diagram (matches `{{fig:slug}}`)
5. Caption-based fallback (parses `*Figure X-Y:` after the reference)

Diagrams have an optional `slug` field that explicitly links them to `{{fig:...}}` references.

**Auto Figure Numbering**: When a new diagram is created and linked via `{{fig:...}}`, `assignFigureNumbers()` in [src/utils/figureNumbering.ts](src/utils/figureNumbering.ts) auto-assigns the next available figure number for that section (e.g., section 5 with 2 existing diagrams → new diagram gets `5-3`).

**Shared Diagrams Across Sub-Sections**: When sub-sections share a conceptual diagram (e.g., architecture overview used by 5.1, 5.2, 5.3):
- Place the diagram in the **first** sub-section that uses it
- Use **prose references** in subsequent sub-sections: "As shown in Figure 5-1..."
- Add scope indicator in TODO: `<!-- TODO: [BLOCK DIAGRAM] ... This diagram covers 5.1, 5.2, 5.3 -->`
- Prevents duplicate diagrams and maintains document coherence

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

### Requirement Numbering
Normative statements (SHALL, MUST, SHOULD, MAY per RFC 2119) get unique IDs:
- **Format**: `<SUBSYSTEM>-<FEATURE>-<ARTEFACT>-<NNNNN>` (e.g., `PCC-CAPTIVE-REQ-00001`)
- **ARTEFACT types**: `REQ` (general), `FR` (functional), `NFR` (non-functional), `INT` (interface), `SEC` (security), `CFG` (config), `TST` (test)
- Counters track per-prefix state across sections via `RequirementCounterState`
- Can be toggled per-section in generation options

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
- `docs/architecture/` - System design, AI integration, project summaries
- `docs/features/` - Feature implementations and testing guides
- `docs/bugs-and-fixes/` - Bug investigations and fixes
- `docs/phases/` - Development phase progress tracking
- `docs/plans/` - Implementation plans for upcoming features
- `docs/sessions/` - Development session summaries

## Git Commit Format

Follow conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`

Example: `feat: add SequenceDiagramEditor with live preview`
