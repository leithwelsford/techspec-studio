# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**⚠️ Note:** This file is comprehensive (1500+ lines). For quick orientation, read these sections in order:

**Essential Reading (5 min):**
1. [Quick Start for Claude Code](#quick-start-for-claude-code) - Get productive immediately
2. [Import Path Patterns](#import-path-patterns) - CRITICAL: No `@/` aliases configured
3. [State Store Patterns](#state-store-patterns) - How to use Zustand correctly

**When Working with AI Features:**
4. [AI Service Usage](#ai-service-usage) - MUST initialize before use
5. [Common Pitfalls & Solutions](#common-pitfalls--solutions) - Debug common errors

**Reference as Needed:**
- [Architecture](#architecture) - State management, data flow, AI service
- [Development Commands](#development-commands) - npm scripts
- [Component Development Guidelines](#component-development-guidelines) - Best practices

---

## Repository Information

**GitHub Repository**: https://github.com/leithwelsford/techspec-studio

**Project Name**: TechSpec Studio

**Owner**: leithwelsford (Leith Welsford <leith.welsford@gmail.com>)

**License**: Not yet specified

**Main Branch**: `main`

**Initial Commit**: 2025-11-10 (commit 0fc2625)

### Cloning the Repository

```bash
# HTTPS (recommended for most users)
git clone https://github.com/leithwelsford/techspec-studio.git
cd techspec-studio

# SSH (if you have SSH keys configured)
git clone git@github.com:leithwelsford/techspec-studio.git
cd techspec-studio
```

### Local Development Setup

After cloning:

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Project Overview

This is an **AI-Powered Technical Specification Authoring System** built with React + TypeScript + Vite for the **telecommunications industry**. It transforms Business Requirement Specifications (BRS) into complete, standards-compliant technical specification documents.

**Core Paradigm**: **User = Guide/Reviewer**, **AI = Writer/Generator**

### Primary Workflow

**INPUT**: Business Requirement Specification (BRS) - Markdown format
  - Customer provides: Scanned PDF BRS
  - External conversion: PDF → Markdown (.md file)
  - Tool receives: Clean Markdown file for upload
  ↓
**PROCESS**: AI generates complete draft technical specification using:
  - Industry-standard technical specification templates
  - 3GPP standards alignment (3gpp.org references)
  - Auto-generated block diagrams, flow diagrams, and sequence diagrams
  - Contextual consistency across all artifacts
  ↓
**OUTPUT**: Draft technical specification package with:
  - Structured markdown document (sections, normative language)
  - Block diagrams (network architecture, component relationships)
  - Sequence diagrams (call flows, message exchanges)
  - Flow diagrams (state machines, procedures)
  - Cross-referenced figures and specification references
  ↓
**REFINEMENT**: Iterative editing with AI assistance:
  - Manual edits to text/diagrams OR
  - AI-guided refinements with full context awareness
  - Changes propagate automatically across related artifacts
  - Maintains consistency between document and diagrams

### Current State

🟡 **Phase 3 IN PROGRESS** (60% Complete) - Diagram Editing & Integration
- Phase 1: Foundation ✅
- Phase 1.5: AI service layer ✅
- Phase 2A: Core AI Experience ✅ (Chat, Config, Markdown Editor)
- Phase 2B: BRS-to-TechSpec Pipeline ✅ **COMPLETE**
- Phase 2C: Approval Workflow & Version History ✅ **COMPLETE**
- Phase 3: Diagram Editing & Integration 🟡 **60% COMPLETE**

**What's Working Now:**
- ✅ Configure AI provider (OpenRouter) with encrypted API key storage
- ✅ **Dynamic model loading** from OpenRouter (50+ models) with search/filter/sort (Phase 2C)
- ✅ Chat with AI using streaming responses
- ✅ Generate document sections from requirements
- ✅ Refine selected text with context awareness
- ✅ **Approval workflow** for all AI-generated content (Phase 2C)
- ✅ **Review Panel** with before/after diff view (Phase 2C)
- ✅ **Version history** with automatic snapshots (Phase 2C)
- ✅ **Placeholder text detection** with fail-fast error handling (Phase 2C)
- ✅ Edit markdown with live preview (Edit/Split/Preview modes)
- ✅ Insert figure references ({{fig:...}})
- ✅ Token usage and cost tracking
- ✅ Context-aware AI (document + diagrams + 3GPP references)
- ✅ **BRS upload and parsing** (Phase 2B)
- ✅ **Full specification generation from BRS** (8 sections, 3GPP-compliant) (Phase 2B)
- ✅ **AI-generated block diagrams** from architecture descriptions (Phase 2B)
- ✅ **AI-generated sequence diagrams** from call flows (Phase 2B)
- ✅ **Diagram viewer** with unified interface (Phase 2B)
- ✅ **Pan/zoom in view-only mode** for all diagram types (Phase 3 - 2025-11-09)
- ✅ **Block diagram editor** - Full edit mode with drag, resize, pan/zoom (Phase 3 - BlockDiagramEditor.tsx 998 lines)

**Phase 3 Status (60% COMPLETE):**
- ✅ Block diagram editor integration (COMPLETE - BlockDiagramEditor.tsx 998 lines, fully Zustand-integrated)
- ✅ Pan/zoom in view-only mode (COMPLETE - PanZoomWrapper.tsx wraps all diagram types)
- ✅ Sequence diagram editor (COMPLETE - SequenceDiagramEditor.tsx 359 lines, serves sequence & flow diagrams)
- 🚧 Link resolution ({{fig:...}} and {{ref:...}}) - HIGH PRIORITY TODO
- 🚧 Auto-numbering for figures and references - HIGH PRIORITY TODO
- 🚧 Flow diagram editor - OPTIONAL (currently reusing SequenceDiagramEditor)
- 🚧 Change propagation (edit in one place → update related artifacts) - LOW PRIORITY TODO

### End Goal Capabilities

- **BRS → Technical Spec Pipeline**: Upload BRS, get complete draft spec
- **3GPP Standards Alignment**: Reference and align with 3GPP specifications
- **Template-Driven Generation**: Industry-standard technical spec templates
- **Multi-Diagram Generation**: Block, sequence, and flow diagrams from descriptions
- **Contextual Consistency**: AI maintains coherence across document + diagrams
- **Iterative Refinement**: Edit manually or with AI, changes propagate everywhere
- **Reference Management**: 3GPP DOCX parsing → searchable context
- **Smart Linking**: {{fig:id}}, {{ref:3gpp-ts-23-203}} auto-resolution
- **Export to DOCX**: Unified document with embedded diagrams

**Key Architecture Files**:
- `PHASE2A_COMPLETE.md` - Complete Phase 2A report with features and workflows
- `PHASE2B_STATUS.md` - **Phase 2B completion report with full BRS-to-TechSpec pipeline**
- `PHASE2C_COMPLETE.md` - **Phase 2C completion report with approval workflow and version history**
- `PHASE2C_TROUBLESHOOTING.md` - Troubleshooting guide for Phase 2C features
- `PHASE3_PROGRESS.md` - **Phase 3 progress report with diagram editing status** (40% complete)
- `QUICK_START.md` - 5-minute setup guide for new users
- `TROUBLESHOOTING.md` - Common issues and solutions
- `AI_COPILOT_ARCHITECTURE.md` - Complete AI integration design and workflows
- `IMPLEMENTATION_PROGRESS.md` - Phase-by-phase roadmap with completion status
- `src/types/index.ts` - Complete type system including AI types and version history
- `src/store/projectStore.ts` - State management with AI state and version history
- `src/services/ai/` - AI service layer (OpenRouter provider, prompts, parsers)
- `src/components/` - Working UI components (Workspace, ChatPanel, AIConfigPanel, MarkdownEditor, BRSUpload, DiagramViewer, ReviewPanel, DiffViewer, BlockDiagramEditor, PanZoomWrapper)
- `src/hooks/` - Custom React hooks (usePanZoom for pan/zoom functionality)
- `sample-brs.md` - Example BRS document for testing (318 lines, realistic 5G use case)

## ⚠️ Critical Don'ts (Read This First!)

**Before you write ANY code, remember these rules:**

1. ❌ **NEVER use `@/` path aliases** - They are NOT configured. Use relative imports only.
2. ❌ **NEVER mutate Zustand state directly** - Always use store actions.
3. ❌ **NEVER use AI service without initializing** - Decrypt API key first.
4. ❌ **NEVER commit API keys** - Always encrypt before storing.
5. ❌ **NEVER pass encrypted keys to AI service** - Decrypt them first.
6. ❌ **NEVER include current message in chat history** - Use `.slice(0, -1)`.
7. ❌ **NEVER create new types without checking** - `src/types/index.ts` is comprehensive.
8. ❌ **NEVER use localStorage directly for shared data** - Use Zustand store instead.

## Quick Start for Claude Code

**First-time in this codebase?** Start here:

1. **Run the app**: `npm run dev` (opens http://localhost:3000 automatically)
2. **Key workflow**: BRS document → AI generates tech spec + diagrams → Iterative refinement
3. **Key files to understand**:
   - [src/store/projectStore.ts](src/store/projectStore.ts) - All application state
   - [src/types/index.ts](src/types/index.ts) - Complete TypeScript type system
   - [src/services/ai/AIService.ts](src/services/ai/AIService.ts) - AI orchestration layer
4. **AI features require**: OpenRouter API key (get at openrouter.ai)
5. **Import style**: Use **relative paths** (NOT `@/` aliases - they're not configured)
6. **State management**: Use Zustand store actions only (never mutate state directly)
7. **Before coding**: Check [IMPLEMENTATION_PROGRESS.md](IMPLEMENTATION_PROGRESS.md) for planned architecture

## Git Workflow

### Daily Development Workflow

```bash
# 1. Check current status
git status

# 2. See what changed
git diff

# 3. Stage changes (all files)
git add .

# 4. Or stage specific files
git add src/components/MyComponent.tsx

# 5. Commit with descriptive message
git commit -m "Add feature X: description of changes"

# 6. Push to GitHub
git push

# 7. Pull latest changes (when collaborating)
git pull
```

### Commit Message Guidelines

**Format**: `<type>: <short description>`

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style/formatting (no logic change)
- `refactor`: Code restructuring (no feature/bug change)
- `test`: Adding/updating tests
- `chore`: Maintenance (dependencies, build config)

**Examples**:
```bash
git commit -m "feat: add SequenceDiagramEditor with live preview"
git commit -m "fix: resolve spacebar handling in BlockDiagramEditor"
git commit -m "docs: update CLAUDE.md with Git workflow"
git commit -m "refactor: extract usePanZoom hook"
```

### Branch Strategy

**Main Branch**: `main`
- Always production-ready
- Protected (requires PR for direct pushes in team setting)
- All commits should be tested

**Feature Branches** (recommended for larger features):
```bash
# Create and switch to feature branch
git checkout -b feature/sequence-diagram-editor

# Work on feature, commit regularly
git add .
git commit -m "feat: implement sequence diagram parser"

# Push feature branch
git push -u origin feature/sequence-diagram-editor

# When ready, merge to main (via PR or locally)
git checkout main
git merge feature/sequence-diagram-editor
git push
```

### Viewing History

```bash
# View commit history
git log

# Compact view
git log --oneline

# Last 5 commits
git log --oneline -5

# View changes in a commit
git show <commit-hash>

# View file history
git log --follow -- src/components/MyComponent.tsx
```

### Undoing Changes

```bash
# Discard uncommitted changes to a file
git checkout -- src/file.tsx

# Unstage a file (keep changes)
git reset src/file.tsx

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes) - DANGEROUS!
git reset --hard HEAD~1
```

### Working with Remote

```bash
# View remote URLs
git remote -v

# Fetch changes without merging
git fetch origin

# Pull changes from main
git pull origin main

# Push to main
git push origin main
```

## Development Commands

```bash
# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

**Docker Environment** (IMPORTANT):
- Vite is configured for Docker with `host: '0.0.0.0'` in [vite.config.ts](vite.config.ts:7)
- Server listens on all interfaces to accept connections from host browser
- HMR (Hot Module Reload) configured for Docker port mapping
- Access from host browser at http://localhost:3000

**Testing**: No test runner is currently configured. Manual tests exist in legacy App.tsx. Jest + React Testing Library setup is planned.

**Docker/NVM Context**: If using NVM in Docker, prefix commands:
```bash
source /usr/local/share/nvm/nvm.sh && npm run dev
```

**Python Dev Server**: `app.py` (port 8001) and `main.py` are legacy dev utilities, not part of main application.

## Architecture

### State Management Architecture

**Zustand Store** ([src/store/projectStore.ts](src/store/projectStore.ts)) - Single source of truth with localStorage persistence:

**Core Project Data**:
- **Project**: Top-level container (version, metadata, created date)
- **Specification**: Technical spec markdown + metadata (author, date, revisions)
- **Block Diagrams**: Network architecture diagrams (nodes, edges, positions, sizes)
- **Sequence Diagrams**: Call flow diagrams (Mermaid code + rendered output)
- **Flow Diagrams**: State machine/procedure diagrams (Mermaid code)
- **References**: 3GPP specification documents (DOCX parsed → searchable text)
- **BRS Document**: Business requirements (Markdown uploaded from customer PDF)

**Workspace State**:
- Active tab (spec, diagrams, chat, references)
- Active diagram (for editing)
- UI toggles (sidebar, preview, split mode)

**AI State**:
- Configuration (provider, model, API key encrypted, temperature, tokens)
- Chat history (messages with token/cost tracking)
- Generation tasks (section generation, diagram creation, refinement)
- Pending approvals (review workflow for AI-generated content) ✅ Phase 2C
- Usage statistics (total tokens, total cost)

**Version History State** ✅ Phase 2C:
- Version snapshots (complete project state at each change)
- Change tracking (manual edits, AI refinements, approvals applied)
- Snapshot metadata (timestamp, author, tokens used, cost)

**CRITICAL**: All state mutations go through Zustand actions - **never modify state directly**.

### Data Flow

**Standard User Actions**:
```
User Action (edit text, drag node, configure AI)
    ↓
Zustand Store Action (e.g., updateSpecification, updateBlockDiagram)
    ↓
Immutable State Update
    ↓
Component Re-render (React)
    ↓
localStorage Auto-save (persist middleware)
```

**BRS-to-TechSpec Generation Flow** (Phase 2B + 2C):
```
User uploads BRS (.md file converted from customer PDF)
    ↓
Store markdown in Zustand (brsDocument)
    ↓
AI analyzes BRS → extract requirements, architecture descriptions, flows
    ↓
AI Service: Generate tech spec sections (with 3GPP template + BRS context)
    ↓
AI Service: Generate block diagrams (from architecture sections)
    ↓
AI Service: Generate sequence diagrams (from call flow sections)
    ↓
AI Service: Detect placeholder text → throw error if found (Phase 2C)
    ↓
Create PendingApproval (NOT applied automatically) (Phase 2C)
    ↓
User opens Review Panel → sees before/after diff (Phase 2C)
    ↓
User approves → updateSpecification() + createSnapshot() (Phase 2C)
    ↓
Changes propagate (edit spec → update related diagrams, or vice versa)
```

### AI Service Architecture

The AI service layer ([src/services/ai/](src/services/ai/)) orchestrates all AI-powered generation:

```
src/services/ai/
├── AIService.ts              # Main orchestration layer (singleton)
├── index.ts                  # Public API exports
├── providers/
│   └── OpenRouterProvider.ts # OpenRouter API integration
├── prompts/
│   ├── systemPrompts.ts      # Base system prompts for telecom domain
│   ├── documentPrompts.ts    # Tech spec generation prompts (3GPP-aligned)
│   └── diagramPrompts.ts     # Diagram generation prompts (block/sequence/flow)
└── parsers/
    ├── blockDiagramParser.ts # Parse AI JSON → BlockDiagram structure
    └── mermaidParser.ts      # Parse/validate Mermaid diagram code
```

**Key AI Capabilities**:
1. **BRS Analysis** (Planned): Extract requirements, architecture, flows from BRS
2. **Tech Spec Generation**: Create 3GPP-style specification sections from requirements
3. **Diagram Generation**: Convert text descriptions → structured diagrams (JSON/Mermaid)
4. **Contextual Refinement**: Update content with awareness of full document + diagrams
5. **Change Propagation**: Detect changes that affect related artifacts
6. **3GPP Alignment**: Reference and align with 3GPP specification standards

**AI Provider**: Uses **OpenRouter** (openrouter.ai) for unified access to multiple LLM providers:
- **Anthropic Claude** (3.5 Sonnet, Opus, Haiku) - Recommended for telecom specs
- OpenAI GPT-4 - Good for structured output
- Google Gemini Pro - Alternative option
- Meta Llama 3 - Cost-effective option
- **50+ models available** via dynamic loading (Phase 2C)

**Why OpenRouter?**
- Single API for multiple providers
- Unified pricing/billing
- Model fallback support
- Cost estimation built-in
- Dynamic model discovery (Phase 2C)

**Model Selection Features** (Phase 2C):
- **Dynamic Loading**: Fetches available models from OpenRouter API on API key entry
- **Search**: Real-time filtering by model name or ID
- **Provider Filter**: Filter by specific provider (Anthropic, OpenAI, Google, etc.)
- **Sorting**: By provider (grouped with optgroups), name (alphabetical), or context size
- **Smart UI**: Search/filter controls only appear when 10+ models available
- **Context Display**: Shows context window size for each model (e.g., "200k")

**API Key Security**: API keys are encrypted using AES (crypto-js) with device fingerprint before localStorage persistence. See [src/utils/encryption.ts](src/utils/encryption.ts).

### 3GPP Standards Integration

**Purpose**: Ensure generated technical specifications align with 3GPP telecommunications standards.

**Reference Documents** ([src/store/projectStore.ts](src/store/projectStore.ts) → `references` array):
- Store 3GPP specification documents (e.g., TS 23.203, TS 23.401)
- Parse DOCX using `mammoth` library → extract text/structure
- Index content for search and reference linking
- Provide to AI as context during generation

**3GPP Context Usage**:
```typescript
// When generating spec sections, AI receives:
const context = {
  brsRequirements: parsedBRS,           // What to build
  specTemplate: techSpecTemplate,        // How to structure
  referenceSpecs: [                      // Standards to align with
    { id: '3gpp-ts-23-203', content: '...' },
    { id: '3gpp-ts-23-401', content: '...' }
  ],
  existingDiagrams: blockDiagrams,      // Visual context
  existingContent: specification.markdown // Consistency context
};
```

**Reference Linking** (Phase 3):
- Documents use `{{ref:3gpp-ts-23-203}}` syntax
- AI generates references automatically
- Preview/export resolves to proper citations
- Click to navigate to reference document

**Template Structure** (Industry Standard):
- Scope and Introduction
- References (normative and informative)
- Definitions and Abbreviations
- Architecture (with block diagrams)
- Procedures (with sequence diagrams)
- Information Elements
- Error Handling

### Current Code Organization

```
src/
├── App.tsx                  # ✅ LEGACY - Now mostly unused (BlockDiagramEditor extracted)
├── AppContainer.tsx         # ✅ Main entry point with mode switching
├── main.tsx                 # ✅ Updated to use AppContainer
├── types/index.ts           # ✅ Complete type definitions (including AI types)
├── store/projectStore.ts    # ✅ Zustand store with AI state
├── services/
│   └── ai/                  # ✅ AI service layer (complete)
│       ├── AIService.ts     # Main orchestration
│       ├── providers/       # OpenRouter integration
│       ├── prompts/         # Prompt templates
│       └── parsers/         # Output parsers
├── utils/
│   └── encryption.ts        # ✅ API key encryption utilities
├── hooks/                   # ✅ Custom React hooks
│   └── usePanZoom.ts        # ✅ Reusable pan/zoom logic (95 lines, Phase 3)
├── components/              # ✅ Phase 2A-2C Components COMPLETE
│   ├── Workspace.tsx        # ✅ Main app shell (header, sidebar, content)
│   ├── DiagramViewer.tsx    # ✅ Unified diagram viewer with view/edit modes (Phase 3)
│   ├── PanZoomWrapper.tsx   # ✅ Reusable pan/zoom for view mode (82 lines, Phase 3)
│   ├── DiffViewer.tsx       # ✅ Line-by-line diff comparison (Phase 2C)
│   ├── DebugPanel.tsx       # ✅ Debug info overlay (Phase 2C)
│   ├── ai/
│   │   ├── ChatPanel.tsx    # ✅ AI chat with streaming
│   │   ├── AIConfigPanel.tsx # ✅ AI configuration modal (dynamic models Phase 2C)
│   │   ├── ReviewPanel.tsx  # ✅ Approve/reject workflow (Phase 2C)
│   │   ├── GenerateSpecModal.tsx  # ✅ Spec generation with approval
│   │   └── GenerateDiagramsModal.tsx  # ✅ Diagram generation with approval
│   ├── editors/
│   │   ├── BlockDiagramEditor.tsx  # ✅ COMPLETE (998 lines, Phase 3)
│   │   ├── MarkdownEditor.tsx      # ✅ Markdown editor with AI actions + approvals
│   │   ├── SequenceDiagramEditor.tsx  # ✅ COMPLETE (359 lines, Phase 3) - serves sequence & flow
│   │   └── FlowDiagramEditor.tsx      # 🚧 OPTIONAL (currently using SequenceDiagramEditor)
│   └── BRSUpload.tsx        # ✅ BRS document upload (Phase 2B)
└── data/                    # Sample data/templates (empty)
```

### Key Architecture Decisions

1. **Block Diagrams = Custom SVG** (not Mermaid)
   - Fine-grained control over interactions (drag, resize, pan, zoom)
   - Specialized for 5G telecom network diagrams
   - Existing working code in `App.tsx` to be extracted

2. **Sequence/Flow = Mermaid.js**
   - Text-based (version control friendly)
   - Standard syntax, wide adoption
   - Code editor + live preview pattern

3. **State = Zustand (not Redux/Context)**
   - Minimal boilerplate
   - Built-in persistence middleware
   - TypeScript-first API

4. **AI Provider = OpenRouter (not direct Anthropic/OpenAI)**
   - Single API for multiple LLM providers
   - Unified pricing/billing
   - Model fallback support
   - Cost estimation built-in

5. **3GPP References = DOCX Parsing**
   - Use `mammoth` library to extract text/structure
   - Index content for search/linking
   - Store metadata (spec number, version)

## Critical Implementation Notes

### ✅ MIGRATED: BlockDiagramEditor.tsx (Phase 3)

The block diagram editor has been **successfully extracted** from App.tsx into a standalone component at [src/components/editors/BlockDiagramEditor.tsx](src/components/editors/BlockDiagramEditor.tsx).

**Original features (ALL PRESERVED)**:

- **Pan/Zoom**:
  - Spacebar + drag or middle-click to pan
  - Scroll wheel to zoom (Ctrl+wheel prevents browser zoom)
  - Custom `usePanZoom` hook with transform state

- **Node Interactions**:
  - Drag nodes with pointer events
  - Resize via corner handles (4 handles per node: nw, ne, se, sw)
  - Double-click to edit labels (prompt-based)
  - Two shapes: `rect` and `cloud` (custom SVG path)

- **Edge System**:
  - Three styles: `bold` (4px + shadow), `solid` (1.6px), `dashed` (1.2px)
  - Draggable labels with persisted offsets
  - Straight or orthogonal routing (toggle)

- **Persistence**:
  - `useLocalValue` hook wraps localStorage
  - Stores: positions, sizes, node metadata, edges, label offsets
  - Migration system for legacy formats (e.g., AAA → SMP rename)

- **Special Features**:
  - Draggable horizontal separator (mobile vs fixed sections)
  - Grouped bounding box visualization (TDF/PCEF service edge)
  - Mermaid code generation (`toMermaid` function)

**Migration Status**:
- ✅ **COMPLETE** - Extracted to [src/components/editors/BlockDiagramEditor.tsx](src/components/editors/BlockDiagramEditor.tsx) (998 lines)
- ✅ **Zustand Integration** - Fully integrated with store (no localStorage hooks)
- ✅ **Pan/Zoom Hook** - Extracted to [src/hooks/usePanZoom.ts](src/hooks/usePanZoom.ts) (95 lines)
- ✅ **Key Fix Applied** - Spacebar/backspace prevention now detects text inputs to avoid interfering with typing
- ✅ **Keyboard Shortcuts** - Delete, Escape work correctly with input detection

**Current Usage**:
- Edit mode: Used by DiagramViewer when editing block diagrams
- View mode: Uses PanZoomWrapper with BlockDiagramRenderer for pan/zoom without editing

### Type System ([src/types/index.ts](src/types/index.ts))

All types are defined, including comprehensive AI types. **Check this file FIRST** before creating new types.

**Core Project Types**:
- `Project` - Top-level container (version, created date, metadata)
- `Specification` - Tech spec document (markdown, author, revisions)
- `BlockDiagram` - Network architecture diagram (nodes, edges, positions, sizes)
- `MermaidDiagram` - Sequence/flow diagram (Mermaid code, type, rendered SVG)
- `ReferenceDocument` - 3GPP spec reference (DOCX content, metadata)
- `BRSDocument` - Business requirements source (Markdown from customer PDF, with metadata and optional AI-extracted structure)
- `WorkspaceTab` - Union type for tab navigation

**AI Types** (Phase 1.5):
- `AIProvider`, `AIModel` - Provider/model configuration
- `AIConfig` - Full AI config with encrypted API keys
- `AIMessage` - Chat message with token/cost tracking
- `AITask` - Task management for generation workflows
- `AIContext` - Context building for AI prompts
- `PendingApproval` - Review/approval workflow for AI content
- `AIState` - Complete AI state structure (config, history, tasks, stats)

**Version History Types** (Phase 2C):
- `VersionSnapshot` - Complete project state at a point in time
- `VersionChangeType` - Union type for change types (edit, generation, approval, etc.)
- `VersionHistory` - Collection of snapshots with metadata

**Diagram-Specific Types**:
- `Node` - Block diagram node (id, label, shape, position, size)
- `Edge` - Block diagram edge (from, to, style, label)
- `Point` - Coordinate (x, y)

### Import Path Patterns

**CRITICAL**: This codebase uses **relative imports** - path aliases (`@/`) are NOT configured in tsconfig.json or vite.config.ts.

```typescript
// ✅ CORRECT - Relative imports
import { encrypt } from '../../utils/encryption';
import type { Project, AIConfig } from '../../types';
import { useProjectStore } from '../../store/projectStore';
import { aiService } from '../../services/ai';

// ❌ WRONG - Path aliases NOT configured (will cause TypeScript errors)
import { encrypt } from '@/utils/encryption';  // WILL FAIL
import type { Project } from '@/types';         // WILL FAIL
```

**Note:** Some code examples in this file use `@/` for illustration purposes, but you MUST use relative imports in actual code.

To add path aliases (if needed), update both:
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}

// vite.config.ts
import path from 'path'
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  }
})
```

### State Store Patterns

```typescript
// ✅ CORRECT - Use Zustand actions
const updateSpec = useProjectStore(state => state.updateSpecification);
updateSpec(newMarkdown);

// ❌ WRONG - Never mutate state directly
const project = useProjectStore(state => state.project);
project.specification.markdown = newMarkdown;  // BAD!

// ✅ CORRECT - Selector pattern for derived state
const diagrams = useProjectStore(state => state.getAllDiagrams());

// ✅ CORRECT - Conditional rendering
const project = useProjectStore(state => state.project);
if (!project) return <div>No project loaded</div>;

// ✅ CORRECT - AI configuration
const aiConfig = useProjectStore(state => state.aiConfig);
const setAIConfig = useProjectStore(state => state.setAIConfig);

// ✅ CORRECT - Approval workflow (Phase 2C)
const createApproval = useProjectStore(state => state.createApproval);
const approveContent = useProjectStore(state => state.approveContent);
const rejectContent = useProjectStore(state => state.rejectContent);
const removeApproval = useProjectStore(state => state.removeApproval);

const approvalId = createApproval({
  taskId: 'refine-123',
  type: 'section',
  originalContent: oldMarkdown,
  generatedContent: newMarkdown,
});

// ✅ CORRECT - Version history (Phase 2C)
const createSnapshot = useProjectStore(state => state.createSnapshot);
const restoreSnapshot = useProjectStore(state => state.restoreSnapshot);

// Create snapshot after approval
createSnapshot(
  'ai-refinement',
  'Applied AI refinement to Architecture section',
  'ai',
  { relatedApprovalId: approvalId, tokensUsed: 5000, costIncurred: 0.15 }
);
```

### AI Service Usage

**IMPORTANT:** The AI service MUST be initialized before each use because:
1. API keys are stored **encrypted** in Zustand store
2. The service needs the **decrypted** key to make API calls
3. Initialization is fast and idempotent

**Correct Pattern (used in all components):**

```typescript
// Note: Use relative imports in actual code, not @/ aliases
import { aiService } from '../../services/ai';
import { decrypt } from '../../utils/encryption';

// ✅ CORRECT - Initialize before use
const decryptedKey = decrypt(aiConfig.apiKey);

await aiService.initialize({
  provider: aiConfig.provider,
  apiKey: decryptedKey,  // Use decrypted key!
  model: aiConfig.model,
  temperature: aiConfig.temperature,
  maxTokens: aiConfig.maxTokens,
  enableStreaming: aiConfig.enableStreaming,
});

// Now safe to use AI service
const result = await aiService.generateSection({
  sectionTitle: 'Architecture Overview',
  context: documentContext,
  requirements: ['Include normative language', 'Reference diagrams']
});

// ❌ WRONG - Using without initialization
// This will throw "AI service not initialized"
const result = await aiService.generateSection(...); // ERROR!
```

**Examples from Working Components:**

```typescript
// ChatPanel.tsx - Before streaming chat
const { decrypt } = await import('../../utils/encryption');
const decryptedKey = decrypt(aiConfig.apiKey);
await aiService.initialize({ ...aiConfig, apiKey: decryptedKey });

for await (const chunk of aiService.chatStream(message, history, context)) {
  // Update UI with chunk
}

// MarkdownEditor.tsx - Before generating section
const { decrypt } = await import('../../utils/encryption');
const decryptedKey = decrypt(aiConfig.apiKey);
await aiService.initialize({ ...aiConfig, apiKey: decryptedKey });

const result = await aiService.generateSection({ sectionTitle, context });
```

### Encryption Utilities (`src/utils/encryption.ts`)

```typescript
// Note: Use relative imports in actual code
import { encrypt, decrypt, maskApiKey } from '../../utils/encryption';

// Encrypt API key before storing
const encrypted = encrypt(apiKey);
localStorage.setItem('ai-api-key', encrypted);

// Decrypt when needed
const decrypted = decrypt(encrypted);

// Mask for display (shows first/last 4 chars)
const masked = maskApiKey(apiKey); // "sk-or-****-****-1234"
```

**Security Notes**:
- Encryption uses device fingerprint as salt (browser-specific)
- Keys cannot be decrypted on different devices
- Never log or expose unencrypted API keys
- Clear sensitive data on logout/config change

### Linking System (Future Phase 3)

Documents will use template syntax:
```markdown
As shown in {{fig:converged-service-edge}}, the architecture...
According to {{ref:3gpp-ts-23-203}}, the PCRF...
```

Resolution happens at:
1. **Preview time** - Display "Figure 4-1" in preview
2. **Export time** - Replace with actual figure numbers
3. **Click time** - Navigate to diagram/reference

Store provides `getAllDiagrams()` utility for building link autocomplete.

### Export Pipeline (Future Phase 4)

Export flow:
1. Resolve all {{fig:...}} and {{ref:...}} links
2. Export diagrams as SVG/PNG (user choice)
3. Embed images in document
4. Generate table of contents
5. Apply DOCX template styles
6. Download final document

Libraries in place:
- `docx` - DOCX generation
- `mammoth` - DOCX parsing
- `pizzip` - ZIP handling (DOCX internals)

## Development Roadmap & Migration Strategy

The codebase follows **incremental migration** - preserve working code, enhance incrementally.

### Completed Phases

1. ✅ **Phase 1: Foundation** - Types, store, dependencies, Zustand persistence
2. ✅ **Phase 1.5: AI Service Layer** - OpenRouter provider, prompts, parsers, encryption
3. ✅ **Phase 2A: Core AI Experience** - Workspace UI, chat panel, markdown editor, config
4. ✅ **Phase 2B: BRS-to-TechSpec Pipeline** - BRS upload, full spec generation, diagrams
5. ✅ **Phase 2C: Approval Workflow & Version History** - Review panel, diff viewer, snapshots

### Phase 2C Implementation Details

**Overview**: Phase 2C adds a comprehensive approval workflow and version history system to ensure users review AI-generated content before it's applied to their documents.

**Key Components**:

1. **Review Panel** ([src/components/ai/ReviewPanel.tsx](src/components/ai/ReviewPanel.tsx))
   - Displays all pending approvals with red badge indicator
   - Shows before/after diff for each approval
   - Three actions: Approve (apply changes), Reject (discard), Dismiss (hide)
   - Feedback field for tracking rejection reasons
   - Automatic snapshot creation on approval

2. **Diff Viewer** ([src/components/DiffViewer.tsx](src/components/DiffViewer.tsx))
   - LCS-based line-by-line diff algorithm
   - Unified and split view modes
   - Syntax highlighting for markdown
   - Color-coded additions (green), deletions (red), unchanged (gray)
   - Statistics display (additions, deletions, unchanged lines)

3. **Version History System**
   - Automatic snapshots on every significant change
   - Captures complete project state (spec + all diagrams)
   - Metadata tracking: timestamp, author (user/AI), change type, tokens/cost
   - Store actions: `createSnapshot()`, `getSnapshot()`, `restoreSnapshot()`, `deleteSnapshot()`, `clearHistory()`

4. **Placeholder Text Detection** ([src/services/ai/AIService.ts](src/services/ai/AIService.ts))
   - Regex-based detection of common placeholder patterns
   - Examples: "[Previous sections remain unchanged]", "[Note: ...]", "[The rest remains...]"
   - **Fail-fast approach**: Throws error instead of silently removing placeholders
   - Error message suggests trying again or switching to Claude Opus

5. **Enhanced AI Prompts** ([src/services/ai/prompts/systemPrompts.ts](src/services/ai/prompts/systemPrompts.ts))
   - `buildRefinementPrompt()` strengthened with explicit requirements
   - Visual markers (❌ ✅) to emphasize forbidden/required patterns
   - Shows AI the input length and expects complete output
   - No length constraints - output can be longer/shorter depending on user request
   - Verification checklist for AI to check before responding

6. **Dynamic Model Loading** ([src/components/ai/AIConfigPanel.tsx](src/components/ai/AIConfigPanel.tsx))
   - Fetches available models from OpenRouter API on API key entry
   - Debounced fetch (500ms) to avoid excessive API calls
   - Search box for filtering by model name or ID
   - Provider filter dropdown (Anthropic, OpenAI, Google, etc.)
   - Sort options: by provider (with optgroups), by name, by context size
   - Smart UI: search/filter controls only appear when 10+ models available

**Workflow Integration**:

- **Generate Section** (MarkdownEditor): Creates approval, does NOT apply automatically
- **Refine Selection** (MarkdownEditor): Creates approval, does NOT apply automatically
- **Generate Spec** (GenerateSpecModal): Creates approval with checkbox option
- **Generate Diagrams** (GenerateDiagramsModal): Creates approval with checkbox option
- **All approvals** must be reviewed in Review Panel before being applied

**Troubleshooting**:

See [PHASE2C_TROUBLESHOOTING.md](PHASE2C_TROUBLESHOOTING.md) for common issues:
- Review button not visible
- AI chat context mismatch
- Approval workflow not triggering
- Placeholder text in AI output

### Phase 2B Implementation Details

**Goal**: Complete the primary workflow - BRS upload → full tech spec generation

**Tasks**:
1. **BRS Upload & Storage** ✅ **COMPLETE**
   - Component: [src/components/BRSUpload.tsx](src/components/BRSUpload.tsx) ✅ (349 lines, fully functional)
   - Drag-and-drop file upload with fallback file picker ✅
   - Markdown file validation (.md extension only) ✅
   - YAML frontmatter parsing for metadata extraction ✅
   - Metadata editing form (customer, version, date, project name) ✅
   - Content preview (first 1000 characters) ✅
   - Store markdown in Zustand: `setBRSDocument()` ✅
   - Type: `BRSDocument` added to [src/types/index.ts](src/types/index.ts) ✅
   - State: BRS actions added to [src/store/projectStore.ts](src/store/projectStore.ts) ✅
   - Visual status indicators (green checkmark on tab when loaded) ✅
   - Sample file: [sample-brs.md](sample-brs.md) (318 lines, realistic 5G BRS example) ✅

2. **Full Document Generation** ✅ **COMPLETE**
   - Service: `aiService.generateFullSpecification(brs, context)`
   - Prompt: Use 3GPP template structure + BRS requirements
   - Generate all sections: Scope, Architecture, Procedures, etc.
   - Creates approval for review (Phase 2C)

3. **Diagram Auto-Generation** ✅ **COMPLETE**
   - Service: `aiService.generateBlockDiagram(architectureText)`
   - Service: `aiService.generateSequenceDiagram(callFlowText)`
   - Parse AI output → structured diagram data
   - Creates approval for review (Phase 2C)

4. **Approval Workflow** ✅ **COMPLETE** (Phase 2C)
   - Component: [src/components/ai/ReviewPanel.tsx](src/components/ai/ReviewPanel.tsx)
   - Review AI-generated content before accepting
   - Approve/reject/dismiss workflow
   - Track changes with `PendingApproval` state
   - Automatic version snapshots on approval

5. **Diagram Editor Integration** ✅ **60% COMPLETE** (Phase 3)
   - ✅ Extract block diagram editor from App.tsx → `BlockDiagramEditor.tsx` (COMPLETE - 998 lines)
   - ✅ Pan/zoom in view-only mode → `PanZoomWrapper.tsx` (COMPLETE - 82 lines)
   - ✅ Integrate with Zustand (replace localStorage hooks) (COMPLETE)
   - ✅ Create `SequenceDiagramEditor.tsx` (Mermaid code + preview) (COMPLETE - 359 lines, serves both sequence & flow)
   - 🚧 Link resolution system ({{fig:...}} and {{ref:...}}) - HIGH PRIORITY TODO
   - 🚧 Auto-numbering for figures - HIGH PRIORITY TODO
   - 🚧 Create `FlowDiagramEditor.tsx` (Mermaid code + preview) - OPTIONAL (currently reusing SequenceDiagramEditor)

### Future Phases

**Phase 3: Change Propagation & Linking**
- Detect related changes (edit spec → update diagrams)
- `{{fig:...}}` and `{{ref:...}}` link resolution
- Auto-numbering for figures and references
- Click navigation between artifacts

**Phase 4: Export & Finalization**
- DOCX generation with template styling
- Embed diagrams (SVG/PNG)
- Resolve all links to proper citations
- Table of contents generation

**Phase 5: Advanced Features**
- Multi-document projects
- Version control for specs
- Collaboration features
- Template customization

**Do not** attempt full rewrites. Always preserve working functionality.

## Environment Variables

Create a `.env.local` file (not committed to git):

```bash
# AI Provider Configuration
VITE_OPENROUTER_API_KEY=sk-or-v1-...  # Optional: pre-configured key
```

**Note**: API keys are typically configured via UI and stored encrypted in localStorage, not environment variables.

## Known Issues & Workarounds

### Diagram Generation with Reasoning Models - Token Limits (FIXED 2025-11-08, UPDATED 2025-11-09)
- **Problem 1**: Sequence and block diagrams were failing with "Empty mermaid code" when using reasoning models (GPT-5, o1)
- **Root Cause 1**: Diagram generation was using default `maxTokens: 2000`, insufficient for reasoning models
- **Problem 2**: After increasing to 32k, diagrams still failed with empty content and `finish_reason: 'length'`
- **Root Cause 2**: For reasoning models (o1/GPT-5), `max_tokens` refers to OUTPUT tokens only. Reasoning tokens are separate and unlimited. The model was using all output tokens for reasoning, leaving 0 for actual content.
- **Solution**: Increased `maxTokens` to **64,000** for reasoning models (OUTPUT tokens only), 4,000 for non-reasoning models
- **Files Fixed**:
  - [src/services/ai/AIService.ts:580-596](src/services/ai/AIService.ts#L580-L596) - Block diagram generation (BRS-based)
  - [src/services/ai/AIService.ts:634-643](src/services/ai/AIService.ts#L634-L643) - Sequence diagram generation (BRS-based)
  - [src/components/ai/GenerateDiagramFromTextModal.tsx:60-76](src/components/ai/GenerateDiagramFromTextModal.tsx#L60-L76) - Text-based generation
- **Status**: ✅ Fixed, includes automatic reasoning model detection and `reasoning: { effort: 'high' }` parameter
- **Diagnostic Logging**: Added logging to OpenRouterProvider, AIService, and blockDiagramParser for troubleshooting
- **Key Learning**: OpenAI reasoning models (o1, GPT-5) count reasoning tokens separately from `max_tokens` parameter

### Pan/Zoom in View-Only Mode (IMPLEMENTED 2025-11-09)
- **Problem**: No pan or zoom functionality when viewing diagrams in view-only mode
- **Solution**: Created `PanZoomWrapper` component that wraps all diagram renderers with pan/zoom controls
- **Implementation**:
  - [src/components/PanZoomWrapper.tsx](src/components/PanZoomWrapper.tsx) - Reusable wrapper using `usePanZoom` hook (82 lines)
  - [src/hooks/usePanZoom.ts](src/hooks/usePanZoom.ts) - Shared pan/zoom logic (95 lines)
  - [src/components/DiagramViewer.tsx:461-601](src/components/DiagramViewer.tsx#L461-L601) - Block diagram renderer with pan/zoom
  - [src/components/DiagramViewer.tsx:607-644](src/components/DiagramViewer.tsx#L607-L644) - Mermaid diagram renderer with pan/zoom
- **Features**:
  - Scroll wheel to zoom (0.4x to 3x scale range)
  - Click and drag to pan (or spacebar + drag, or middle-click)
  - Visual instructions overlay on canvas
  - Dynamic cursor feedback: open hand → closed hand when dragging
  - Consistent behavior between block diagrams and sequence/flow diagrams
- **Status**: ✅ Implemented and working for all diagram types in view mode
- **User Experience**: Same pan/zoom controls as edit mode, but without editing capabilities
- **Key Implementation Detail**: Custom pan handlers allow panning anywhere on the diagram (not just background)

### BlockDiagramEditor Extraction (COMPLETE 2025-11-09)
- **Component**: [src/components/editors/BlockDiagramEditor.tsx](src/components/editors/BlockDiagramEditor.tsx) (998 lines)
- **Status**: ✅ Fully extracted from App.tsx and integrated with Zustand store
- **Features**:
  - Drag & drop nodes with mouse
  - Resize via corner handles (NW, NE, SE, SW)
  - Pan/zoom with spacebar + drag, middle-click, scroll wheel
  - Double-click to edit labels
  - Node shapes: rectangle and cloud
  - Edge styles: bold, solid, dashed with draggable labels
  - Edge routing: straight or orthogonal toggle
  - Keyboard shortcuts: Delete, Escape (with input detection fix)
- **Integration**: Fully integrated with Zustand store (no localStorage hooks)
- **Hook**: [src/hooks/usePanZoom.ts](src/hooks/usePanZoom.ts) - Reusable pan/zoom logic with fixed spacebar handling
- **Key Fix**: Spacebar/backspace prevention now detects text inputs to avoid interfering with typing:
  ```typescript
  const isTyping = target.tagName === 'INPUT' ||
                   target.tagName === 'TEXTAREA' ||
                   target.isContentEditable;
  ```
- **Store Actions Used**:
  - `updateBlockDiagram(id, updates)` - Save changes
  - `deleteNode(diagramId, nodeId)` - Remove nodes
  - `deleteEdge(diagramId, edgeIndex)` - Remove edges
- **Usage**: Integrated into DiagramViewer for edit mode

### BRS Document Source Verification (CONFIRMED 2025-11-08)
- **Question**: Is diagram generation using BRS or Technical Specification document?
- **Answer**: ✅ CONFIRMED - Diagram generation correctly uses BRS document (not specification)
- **Evidence**:
  - [src/store/projectStore.ts:453-455](src/store/projectStore.ts#L453-L455) - `getBRSDocument()` returns `project.brsDocument`
  - [src/components/ai/GenerateDiagramsModal.tsx:18](src/components/ai/GenerateDiagramsModal.tsx#L18) - Component uses `getBRSDocument()`
  - [src/types/index.ts:25-26](src/types/index.ts#L25-L26) - Project has separate `brsDocument` and `specification` fields

### Browser Zoom Conflict
- **Problem**: Ctrl+scroll triggers browser zoom instead of canvas zoom
- **Solution**: Global wheel event listener in `usePanZoom` hook prevents default when `e.ctrlKey` is true
- **Location**: `src/App.tsx:165-170`

### Tailwind CSS Version
- **Current**: Tailwind v3.4.1 (stable)
- **Reason**: v4 has breaking PostCSS plugin changes
- **Config**: `postcss.config.js` uses `tailwindcss: {}` (not `@tailwindcss/postcss`)

### localStorage Keys
- Legacy keys: `pcc_positions_v14`, `pcc_sizes_v14`, etc. (from App.tsx)
- New store key: `tech-spec-project` (Zustand persist)
- **Do not** clear legacy keys until migration is complete

### Docker/NVM Context
- If running in Docker with NVM: Always source NVM before npm commands
- Dev server must use `--host 0.0.0.0` for external access

## Component Development Guidelines

### When Creating New Components

1. **Import types from [src/types/index.ts](src/types/index.ts)** (use relative paths)
   ```typescript
   import type { BlockDiagram, MermaidDiagram, AIConfig } from '../../types';
   ```

2. **Use Zustand store actions, never local state for shared data**
   ```typescript
   const { updateBlockDiagram, setAIConfig } = useProjectStore();
   ```

3. **Check [IMPLEMENTATION_PROGRESS.md](IMPLEMENTATION_PROGRESS.md)** for planned architecture

4. **Preserve existing behavior** when refactoring App.tsx

### When Building BRS-to-TechSpec Features (Phase 2B+)

**BRS Upload & Storage**:
```typescript
// Component: src/components/BRSUpload.tsx
// Input: Markdown (.md) file (customer PDF already converted externally)
// 1. Handle .md file upload (drag-and-drop or file picker)
// 2. Read file content as text
// 3. Extract metadata from frontmatter or filename
// 4. Store in Zustand: setBRSDocument({ title, filename, markdown, metadata })
// 5. Optionally: Trigger AI analysis to extract BRSStructuredData
```

**Full Document Generation**:
```typescript
// Component: src/components/ai/GenerateSpecModal.tsx
// 1. User triggers "Generate from BRS" action
// 2. Build context: BRS + 3GPP references + template
// 3. Call aiService.generateFullSpecification(context)
// 4. AI generates ALL sections in one go (or batch)
// 5. Store: updateSpecification(generatedMarkdown)
// 6. Trigger diagram generation from sections
```

**Diagram Auto-Generation**:
```typescript
// Service: src/services/ai/AIService.ts
// generateBlockDiagram(architectureText, context)
// - Extract component names, relationships from text
// - Generate JSON: { nodes: [...], edges: [...] }
// - Parse & store: addBlockDiagram(parsedDiagram)

// generateSequenceDiagram(callFlowText, context)
// - Extract actors, messages, flows
// - Generate Mermaid code
// - Parse & store: addSequenceDiagram(mermaidCode)
```

**Change Propagation**:
```typescript
// Service: src/services/ai/AIService.ts
// detectRelatedChanges(editedSection, currentState)
// - Analyze what changed (architecture, flow, component name)
// - Identify affected diagrams/sections
// - Return: { affectedDiagrams: [...], affectedSections: [...] }
// - User approves → applyPropagatedChanges()
```

### When Building AI Components

1. **Always encrypt API keys before storage**
   ```typescript
   import { encrypt } from '../../utils/encryption';
   const encrypted = encrypt(apiKey);
   ```

2. **Handle streaming responses properly**
   ```typescript
   for await (const chunk of aiService.chatStream(msg, context)) {
     // Update UI incrementally
   }
   ```

3. **Track token usage and costs**
   ```typescript
   const updateUsageStats = useProjectStore(state => state.updateUsageStats);
   updateUsageStats(tokens, cost);
   ```

4. **Implement approval workflow for AI-generated content**
   ```typescript
   const createApproval = useProjectStore(state => state.createApproval);
   const approvalId = createApproval({
     taskId,
     type: 'section',
     generatedContent: markdown,
     originalContent: currentSection
   });
   ```

### ✅ Block Diagram Editor - Already Extracted (Phase 3)

The block diagram editor has been **fully extracted** from App.tsx:
- ✅ `usePanZoom` hook → [src/hooks/usePanZoom.ts](src/hooks/usePanZoom.ts) (95 lines)
- ✅ `Node` component → Integrated into BlockDiagramEditor
- ✅ `Edge` component → Integrated into BlockDiagramEditor
- ✅ Main editor → [src/components/editors/BlockDiagramEditor.tsx](src/components/editors/BlockDiagramEditor.tsx) (998 lines)

**Migration complete** - All functionality preserved and integrated with Zustand store.

## Reference Documents

- **README.md** - User-facing features and usage guide
- **AI_COPILOT_ARCHITECTURE.md** - Complete AI design and workflows
- **IMPLEMENTATION_PROGRESS.md** - Detailed roadmap with completion status
- **PROJECT_SUMMARY.md** - High-level project overview
- **draft-technical-specification** - Sample 5G technical spec document
- **draft-sequence-diagram** - Empty placeholder for future sequence diagrams

## External Dependencies

### Core Libraries
- `react` 18.2 + `react-dom` - UI framework
- `vite` 5.2 - Build tool with HMR
- `typescript` 5.2 - Type system
- `tailwindcss` 3.4.1 - Styling (v3, not v4)

### Diagram Libraries
- `mermaid` 11.12 - Sequence/flow diagram rendering
- Custom SVG - Block diagrams (in App.tsx)

### Document Processing
- `react-markdown` 10.1 + `remark-gfm` 4.0 - Markdown rendering
- `docx` 9.5 - DOCX generation
- `mammoth` 1.11 - DOCX parsing (3GPP specs)
- `pizzip` 3.2 - ZIP handling

### State Management
- `zustand` 5.0 - Global state with persistence

### AI & Security
- `crypto-js` 4.2 - AES encryption for API keys
- OpenRouter API - Unified LLM access (via fetch)

## Testing Strategy

**Current**: Manual testing via "Run Tests" button in UI (16 sanity checks in App.tsx)
**Future**: Jest + React Testing Library (not yet set up)

When adding tests:
- Test Zustand actions in isolation
- Test component rendering with mock store
- Test AI service with mocked API responses
- Test encryption/decryption utilities
- Test export pipeline with fixture data

## Performance Considerations

From code review (README.md):
- Grid rendering (18,000+ SVG lines) can be optimized with virtualization
- `nodeCenter()` function recalculates on every render - consider memoization
- `edges` useMemo dependencies could be more granular

**Do not** optimize prematurely - profile first if performance issues arise.

## AI Cost Management

- Claude 3.5 Sonnet via OpenRouter: ~$3-15 per 1M tokens
- Typical spec generation (50 pages): ~$0.30 - $1.00
- Usage tracking built into store (`usageStats`)
- Consider implementing cost alerts/limits in UI

## Common Pitfalls & Solutions

### Quick Debugging Checklist

When encountering errors, check these in order:
1. Is `npm run dev` running? (Check http://localhost:3000)
2. Are there TypeScript errors? (Run `npm run lint`)
3. Is the API key configured? (Check AI Config panel)
4. Are you using relative imports (not `@/` aliases)?
5. Check browser console for runtime errors
6. Check zustand store state via React DevTools

### 1. "AI service not initialized" Error
**Problem:** Calling AI service methods without initialization
**Solution:** Always decrypt API key and initialize before use (see AI Service Usage section above)
**Files to Check:** `ChatPanel.tsx`, `MarkdownEditor.tsx`

### 2. "history.map is not a function" Error
**Problem:** Passing parameters in wrong order to `aiService.chat()` or `chatStream()`
**Solution:** Correct signature is `(message, history, context, options)`
```typescript
// ✅ CORRECT
const history = chatHistory.slice(0, -1);
await aiService.chatStream(message, history, context);

// ❌ WRONG
await aiService.chatStream(message, context); // context treated as history!
```

### 3. Encrypted API Key Not Decrypting
**Problem:** Trying to use encrypted API key directly from store
**Solution:** Decrypt before passing to AI service
```typescript
// ✅ CORRECT
const decryptedKey = decrypt(aiConfig.apiKey);
await aiService.initialize({ ...config, apiKey: decryptedKey });

// ❌ WRONG
await aiService.initialize(aiConfig); // Passes encrypted key!
```

### 4. Chat History Including Current Message
**Problem:** Sending the message you just added back to the AI
**Solution:** Exclude the last message (user's current message) from history
```typescript
// ✅ CORRECT - Exclude the message we just added
const history = chatHistory.slice(0, -1);

// ❌ WRONG - Includes current message
const history = chatHistory;
```

### 5. Missing Context in AI Calls
**Problem:** AI doesn't know about current document/diagrams
**Solution:** Build and pass context object
```typescript
const context = {
  currentDocument: project.specification.markdown,
  availableDiagrams: project.blockDiagrams.map(d => ({...})),
  availableReferences: project.references
};
```

### 6. AI Generating Placeholder Text (Phase 2C)
**Problem:** AI outputs "[Previous sections remain unchanged]" or similar placeholders
**Root Cause:** AI being "efficient" by not repeating unchanged sections
**Solution Applied:**
1. Strengthened `buildRefinementPrompt()` with explicit requirements and visual markers
2. Added placeholder detection in `refineContent()` that throws error (fail-fast)
3. Error message suggests retrying or switching to Claude Opus
**User Action:** If error occurs, click "Refine Selection" again or use a more capable model
**Files:** [src/services/ai/prompts/systemPrompts.ts](src/services/ai/prompts/systemPrompts.ts:135-200), [src/services/ai/AIService.ts](src/services/ai/AIService.ts:48-67)

### 7. TypeScript Import Errors
**Problem:** `Cannot find module '@/...'` or similar import errors
**Root Cause:** Using `@/` path aliases when they're not configured
**Solution:** Replace all `@/` imports with relative paths
```typescript
// ❌ WRONG
import { useProjectStore } from '@/store/projectStore';

// ✅ CORRECT
import { useProjectStore } from '../../store/projectStore';
```

### 8. Mermaid Diagram Not Rendering
**Problem:** Mermaid diagram shows blank or error in preview
**Root Cause:** Invalid Mermaid syntax from AI generation
**Solutions:**
1. Check browser console for Mermaid parsing errors
2. Validate syntax at https://mermaid.live
3. Use SequenceDiagramEditor templates as starting point
4. Delete broken diagram and regenerate with fixed prompts

### 9. State Not Persisting
**Problem:** Changes disappear after page refresh
**Root Cause:** localStorage not saving or quota exceeded
**Solutions:**
1. Check browser console for localStorage errors
2. Clear old data: `localStorage.clear()` in console
3. Check localStorage quota (usually 5-10MB)
4. Verify Zustand persist middleware is working

### 10. Development Server Won't Start
**Problem:** `npm run dev` fails or port already in use
**Solutions:**
1. Check if port 3000 is already in use: `lsof -i :3000` (Mac/Linux) or `netstat -ano | findstr :3000` (Windows)
2. Kill existing process or change port in vite.config.ts
3. Delete node_modules and reinstall: `rm -rf node_modules && npm install`
4. If in Docker/NVM: Source NVM first: `source /usr/local/share/nvm/nvm.sh && npm run dev`

## Technical Specification Standards (3GPP Context)

When generating technical specifications, the AI must follow **3GPP standards** and industry best practices.

### 3GPP Document Structure

**Standard Sections** (from 3GPP template):
1. **Scope** - Define what the specification covers
2. **References** - Normative (required) and informative (helpful) references
3. **Definitions and Abbreviations** - Terms, acronyms, notation
4. **Architecture** - System components, interfaces, protocols (with block diagrams)
5. **Procedures** - Call flows, state machines, message sequences (with sequence diagrams)
6. **Information Elements** - Data structures, parameters, encoding
7. **Error Handling** - Failure scenarios, recovery procedures

### Language & Terminology

**Normative Language** (RFC 2119 keywords):
- **SHALL / SHALL NOT** - Absolute requirement / prohibition
- **MUST / MUST NOT** - Absolute requirement / prohibition (same as SHALL)
- **SHOULD / SHOULD NOT** - Recommendation (deviations must be justified)
- **MAY / OPTIONAL** - Truly optional

**3GPP Terminology Examples**:
- UE (User Equipment), eNB (eNodeB), MME (Mobility Management Entity)
- PCRF (Policy and Charging Rules Function), PDN-GW (PDN Gateway)
- Reference points: S1, S5, S6a, Gx, Rx (use standard names)

### Diagram Standards

**Block Diagrams** (Architecture):
- Network elements as rectangles
- Interfaces/reference points as labeled lines
- Grouping boxes for functional entities
- Standard 3GPP symbols where applicable

**Sequence Diagrams** (Call Flows):
- Mermaid syntax for consistency
- Actors: UE, Network nodes, Functions
- Messages: Request/Response pairs
- Arrows: Solid (request), dashed (response)

**Flow Diagrams** (Procedures):
- State machines using Mermaid state diagrams
- Decision points (if/else branching)
- Error paths clearly marked

### BRS Analysis Guidelines

When parsing a BRS document, extract:

1. **Functional Requirements** → Map to spec sections
   - "The system shall support..." → Architecture + Procedures
   - "User can..." → Use cases + Call flows

2. **Architecture Requirements** → Block diagrams
   - Components, interfaces, protocols
   - Network topology, deployment scenarios

3. **Procedure Requirements** → Sequence diagrams
   - Message flows, state changes
   - Success and failure paths

4. **Reference Standards** → 3GPP alignment
   - "Compliant with TS 23.401" → Add to references
   - "Based on LTE architecture" → Use 3GPP terminology

### AI Prompt Context for Tech Specs

When calling AI service for spec generation:

```typescript
const context = {
  brs: {
    requirements: [...],           // Structured requirements from BRS
    architecture: [...],            // Architecture descriptions
    procedures: [...]               // Procedure/flow descriptions
  },
  template: {
    structure: '3GPP_TS_template', // Standard section ordering
    normativeLanguage: true,        // Use SHALL/MUST/MAY
    includeReferences: true         // Auto-generate reference section
  },
  references: [
    { id: '3gpp-ts-23-203', title: 'Policy and Charging Control' },
    { id: '3gpp-ts-23-401', title: 'GPRS Enhancements for E-UTRAN' }
  ],
  existingContent: {
    specification: currentMarkdown,
    diagrams: currentDiagrams      // Maintain consistency
  }
};
```

### Quality Checks (Future)

- **Terminology consistency**: Same terms used throughout
- **Reference completeness**: All cited specs in reference section
- **Diagram-text alignment**: Figures match text descriptions
- **Normative language**: Correct use of SHALL/SHOULD/MAY
- **Section completeness**: All required sections present

## Security Best Practices

1. **Never commit API keys** to git
2. **Always encrypt** sensitive data before localStorage
3. **Always decrypt** before using API keys
4. **Validate AI output** before applying to document (approval workflow)
5. **Sanitize user input** in prompts to prevent injection
6. **Implement rate limiting** for AI requests (cost control)
7. **Clear sensitive data** on logout/config change

## AI Prompt Engineering Best Practices (Phase 2C Learnings)

### Handling Complete Document Output

When asking AI to refine/modify complete documents:

1. **Be Extremely Explicit**: Use visual markers (❌ ✅) to emphasize forbidden/required patterns
2. **Show Input Length**: Tell the AI how many lines it received, set expectations for output length
3. **No Length Constraints**: Don't restrict output length - let it vary based on user's request
4. **Forbid Placeholders Explicitly**: List all placeholder patterns that are forbidden
5. **Verification Checklist**: Include a checklist for AI to verify before responding

**Example from `buildRefinementPrompt()`:**
```typescript
ABSOLUTELY FORBIDDEN - NEVER DO THIS:
❌ "[Previous sections remain unchanged]"
❌ "[Sections 2-3 remain identical]"
❌ Any form of placeholder, summary, or meta-commentary

REQUIRED:
✅ Every single section from the original content must appear in full in your output
✅ If you're not changing a section, copy it exactly as-is from the original
✅ Never use placeholders - write out the actual content

VERIFICATION:
Before responding, ask yourself:
- Have I included ALL sections from the original document?
- Did I actually write out each section (not just say "previous content unchanged")?
```

### Fail-Fast Error Handling

**Don't silently fix AI mistakes** - throw errors and let user retry:

```typescript
// ✅ CORRECT - Fail fast
if (hasPlaceholderText(result.content)) {
  throw new Error(
    'AI generated incomplete content with placeholders. ' +
    'Try again, or switch to Claude Opus for more reliable output.'
  );
}

// ❌ WRONG - Silent removal hides missing content
const cleaned = removePlaceholderText(result.content);
```

**Why?**
- Placeholders indicate AI didn't follow instructions
- Silently removing them would hide missing content
- Better to fail fast and let user retry than deliver incomplete output

### Model Selection for Reliability

**Recommended models for complete document output:**
1. **Claude Opus** - Most reliable for following complex instructions
2. **Claude 3.5 Sonnet** - Good balance of speed and reliability
3. **GPT-4** - Generally reliable but slower
4. **Haiku/smaller models** - May cut corners, use with caution for full documents

**When to suggest model upgrades:**
- User reports placeholder text issues
- Document generation fails validation
- Output quality doesn't meet requirements
