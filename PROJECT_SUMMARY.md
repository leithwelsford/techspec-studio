# Project Summary

## Repository

**GitHub**: https://github.com/leithwelsford/techspec-studio
**Project**: TechSpec Studio
**Author**: Leith Welsford (leithwelsford)

## What We're Building

An **AI-Powered Technical Specification Authoring System** where:
- **AI does the heavy lifting**: Writes specs, generates diagrams, suggests improvements
- **User guides and reviews**: Provides requirements, approves outputs, refines iteratively

Think: "GitHub Copilot for Technical Documentation"

## Current Status

### ✅ Completed Phases

**Phase 1: Foundation** ✅
1. **Project Structure** - Organized folders for components, hooks, utils, types, store
2. **Dependencies** - All required libraries installed
3. **Type System** ([src/types/index.ts](src/types/index.ts)) - Complete TypeScript definitions including AI types
4. **State Management** ([src/store/projectStore.ts](src/store/projectStore.ts)) - Zustand store with auto-save and AI state

**Phase 1.5: AI Service Layer** ✅
1. **AI Architecture** - Complete design in [AI_COPILOT_ARCHITECTURE.md](AI_COPILOT_ARCHITECTURE.md)
2. **OpenRouter Integration** - Multi-model support (Claude, GPT-4, Gemini, Llama)
3. **Prompt System** - Comprehensive prompt templates for specs and diagrams
4. **Security** - Encrypted API key storage with device fingerprint

**Phase 2A: Core AI Experience** ✅
1. **Workspace UI** - Main app shell with tab navigation
2. **AI Chat** - Streaming chat interface with context awareness
3. **Markdown Editor** - Edit/Split/Preview modes with AI integration
4. **AI Configuration** - Dynamic model loading with 50+ models

**Phase 2B: BRS-to-TechSpec Pipeline** ✅
1. **BRS Upload** - Markdown file upload with metadata extraction
2. **Full Spec Generation** - Complete 8-section 3GPP-compliant specs
3. **Block Diagram Generation** - AI-generated network architecture diagrams
4. **Sequence Diagram Generation** - AI-generated call flow diagrams

**Phase 2C: Approval Workflow & Version History** ✅
1. **Review Panel** - Before/after diff viewer for AI content
2. **Approval Workflow** - Approve/reject/dismiss AI-generated content
3. **Version History** - Automatic snapshots with rollback
4. **Placeholder Detection** - Fail-fast validation of AI output

### 🟡 In Progress (Phase 3: Diagram Editing - 40% Complete)

**Completed:**
1. ✅ **BlockDiagramEditor** ([src/components/editors/BlockDiagramEditor.tsx](src/components/editors/BlockDiagramEditor.tsx)) - 998 lines, fully extracted from App.tsx
2. ✅ **PanZoomWrapper** ([src/components/PanZoomWrapper.tsx](src/components/PanZoomWrapper.tsx)) - Pan/zoom for all diagram types in view mode
3. ✅ **usePanZoom Hook** ([src/hooks/usePanZoom.ts](src/hooks/usePanZoom.ts)) - Reusable pan/zoom logic

**In Progress:**
4. 🚧 **SequenceDiagramEditor** - Mermaid code editor with live preview
5. 🚧 **FlowDiagramEditor** - Mermaid flowchart/state diagram editor
6. 🚧 **Link Resolution** - {{fig:...}} and {{ref:...}} auto-resolution
7. 🚧 **Change Propagation** - AI-assisted consistency across artifacts
8. 🚧 **Auto-numbering** - Figure and reference numbering

### ⏳ Next (Phase 4: Export & Finalization)
1. DOCX generation with template styling
2. Embed diagrams (SVG/PNG)
3. Resolve all links to proper citations
4. Table of contents generation

## Key Architectural Decisions

### 1. AI-First Design
**Not**: Manual authoring tool with some AI assistance
**But**: AI generation tool with human oversight

**Workflows**:
```
User: "Generate a 5G Private Line technical specification"
  ↓
AI: Asks clarifying questions
  ↓
AI: Generates complete specification with diagrams
  ↓
User: Reviews, approves, or refines sections
  ↓
Final document ready for export
```

### 2. State Management: Zustand
- Lightweight, minimal boilerplate
- Built-in localStorage persistence
- TypeScript-first
- Perfect for this scale (single-user, local-first)

### 3. Diagram Strategy
- **Block Diagrams**: Custom SVG (fine control, existing code)
- **Sequence Diagrams**: Mermaid (text-based, standard)
- **Flow Diagrams**: Mermaid (state machines, flowcharts)

AI generates both:
- Custom SVG structure (JSON → BlockDiagram type)
- Mermaid code (string → rendered diagram)

### 4. Reference Handling: 3GPP DOCX
- Use `mammoth` library to parse DOCX
- Extract text and structure
- Feed into AI context
- AI quotes and cites automatically

### 5. OpenRouter API (Multi-Provider)
**Why OpenRouter?**
- Single API for multiple LLM providers
- Unified pricing/billing across models
- **50+ models available** with dynamic loading
- Model fallback support
- Cost estimation built-in

**Supported Providers:**
- Anthropic Claude (3.5 Sonnet, Opus, Haiku) - Recommended for telecom specs
- OpenAI GPT-4 - Good for structured output
- Google Gemini Pro - Alternative option
- Meta Llama 3 - Cost-effective option

## Data Architecture

```
Project (top-level)
├── Specification (markdown document)
│   ├── Title, version, metadata
│   └── Markdown content
├── Block Diagrams (custom SVG)
│   ├── Nodes (shapes, labels)
│   ├── Edges (connections, styles)
│   └── Layout (positions, sizes)
├── Sequence Diagrams (Mermaid)
│   └── Mermaid code + metadata
├── Flow Diagrams (Mermaid)
│   └── Mermaid code + metadata
├── References (3GPP DOCX, PDFs)
│   ├── Uploaded files
│   ├── Extracted content
│   └── Metadata (spec numbers, versions)
└── AI Chat History
    ├── Messages (user ↔ AI)
    ├── Pending approvals
    └── Generation tasks
```

All stored in Zustand + auto-persisted to localStorage.

## User Workflows

### Workflow 1: Generate Complete Specification
```
1. User creates new project: "5G Private Line Technical Spec"
2. User uploads reference: 3GPP TS 23.203 (DOCX)
3. User: "Generate a complete technical specification based on this reference"
4. AI:
   - Reads reference document
   - Asks clarifying questions
   - Generates all sections
   - Suggests diagrams needed
5. User reviews section-by-section
6. AI generates diagrams on demand
7. User exports final DOCX
```

### Workflow 2: Iterative Refinement
```
1. AI generates section 4.2 "QoS & Bearer Model"
2. User: "This needs to be more normative and include technical constraints"
3. AI: Regenerates with SHALL/MUST language
4. User: Side-by-side diff → Approves
5. Section locked in
```

### Workflow 3: Diagram from Description
```
1. User: "Create a block diagram showing UE → P-GW → TDF → Internet with PCRF control"
2. AI: Generates BlockDiagram JSON structure
3. User: Preview in visual editor
4. User: Drag nodes to fine-tune
5. AI: Auto-inserts {{fig:converged-service-edge}} reference in document
```

## Technology Stack

### Core
- **React 18** - UI framework
- **TypeScript 5** - Type safety
- **Vite 5** - Build tool (fast HMR)
- **Tailwind CSS 3** - Styling

### State & Data
- **Zustand 5** - State management
- **LocalStorage** - Persistence

### AI
- **Anthropic Claude API** - Primary LLM
- **OpenAI GPT-4** - Alternative provider

### Diagrams
- **Custom SVG** - Block diagrams
- **Mermaid.js** - Sequence/flow diagrams

### Documents
- **react-markdown** - Markdown rendering
- **docx** - DOCX generation
- **mammoth** - DOCX parsing (3GPP)
- **pizzip** - ZIP handling

## File Organization

```
/work/
├── src/
│   ├── App.tsx                    # ✅ LEGACY - Now mostly unused
│   ├── AppContainer.tsx           # ✅ Main entry point
│   ├── main.tsx                   # ✅ React entry point
│   ├── index.css                  # ✅ Tailwind imports
│   ├── types/index.ts             # ✅ Complete type system with AI types
│   ├── store/projectStore.ts      # ✅ Zustand store with AI state
│   ├── services/                  # ✅ COMPLETE
│   │   └── ai/
│   │       ├── AIService.ts       # Main AI orchestration
│   │       ├── providers/
│   │       │   └── OpenRouterProvider.ts
│   │       ├── prompts/
│   │       │   ├── systemPrompts.ts
│   │       │   ├── documentPrompts.ts
│   │       │   └── diagramPrompts.ts
│   │       └── parsers/
│   │           ├── blockDiagramParser.ts
│   │           └── mermaidParser.ts
│   ├── hooks/                     # ✅ Phase 3
│   │   └── usePanZoom.ts          # Reusable pan/zoom logic
│   ├── utils/                     # ✅ COMPLETE
│   │   └── encryption.ts          # API key encryption
│   ├── components/                # ✅ Phase 2A-2C COMPLETE, Phase 3 40%
│   │   ├── Workspace.tsx          # ✅ Main app shell
│   │   ├── DiagramViewer.tsx      # ✅ Unified viewer
│   │   ├── PanZoomWrapper.tsx     # ✅ Pan/zoom for view mode
│   │   ├── BRSUpload.tsx          # ✅ BRS document upload
│   │   ├── DiffViewer.tsx         # ✅ Line-by-line diff
│   │   ├── DebugPanel.tsx         # ✅ Debug overlay
│   │   ├── ai/
│   │   │   ├── ChatPanel.tsx      # ✅ AI chat with streaming
│   │   │   ├── AIConfigPanel.tsx  # ✅ Dynamic model config
│   │   │   ├── ReviewPanel.tsx    # ✅ Approval workflow
│   │   │   ├── GenerateSpecModal.tsx
│   │   │   └── GenerateDiagramsModal.tsx
│   │   └── editors/
│   │       ├── MarkdownEditor.tsx # ✅ Edit/Split/Preview modes
│   │       ├── BlockDiagramEditor.tsx # ✅ 998 lines (Phase 3)
│   │       ├── SequenceDiagramEditor.tsx # 🚧 TODO
│   │       └── FlowDiagramEditor.tsx # 🚧 TODO
├── public/
├── draft-technical-specification  # ✅ Sample spec (520 lines)
├── package.json                   # ✅ Dependencies configured
├── tsconfig.json                  # ✅ TypeScript config
├── vite.config.ts                 # ✅ Vite config
├── tailwind.config.js             # ✅ Tailwind config
├── postcss.config.js              # ✅ PostCSS config
├── README.md                      # ✅ User documentation
├── CLAUDE.md                      # ✅ AI assistant guide
├── IMPLEMENTATION_PROGRESS.md     # ✅ Detailed roadmap
├── AI_COPILOT_ARCHITECTURE.md     # ✅ AI design document
└── PROJECT_SUMMARY.md             # ✅ This file
```

## Development Environment

**Container**: Docker with Debian 13
**Node**: Managed via NVM (v24.11.0)
**Dev Server**: Vite (http://localhost:3000 or http://0.0.0.0:3000)

**Important**: Always source NVM before npm commands:
```bash
source /usr/local/share/nvm/nvm.sh && npm run dev
```

## Next Steps

### Immediate (Phase 3 Completion)
1. **SequenceDiagramEditor** - Mermaid code editor with live preview
2. **FlowDiagramEditor** - Flowchart/state machine editor
3. **Link Resolution** - {{fig:...}} and {{ref:...}} auto-resolution
4. **Change Propagation** - AI-assisted consistency across artifacts
5. **Auto-numbering** - Figure and reference numbering

### Phase 4 (Export & Finalization)
1. Link resolution ({{fig:...}} → Figure 4-1)
2. Diagram export (SVG/PNG)
3. Unified markdown generation
4. DOCX export with template support
5. Table of contents generation

### Phase 5 (Advanced Features)
1. Multi-document projects
2. Version control for specs
3. Collaboration features
4. Template customization
5. Advanced reference management

## Success Metrics

**MVP Goal**: User can generate a complete 50-page technical specification in < 30 minutes

**Quality Bar**:
- AI-generated content passes technical review 80% of the time
- User makes < 10 manual edits per section
- Diagrams are technically accurate
- References are correctly cited
- Final DOCX matches corporate template

## Cost Estimates

**Claude API Pricing**:
- ~$0.30 - $1.00 per complete specification (50 pages)
- ~$0.05 - $0.20 per section refinement
- ~$0.10 per diagram generation

**User Control**: Token usage dashboard, cost warnings, cheaper models for drafts

## Key Differentiators

1. **AI-First**: Not a text editor with AI features, but an AI generator with human oversight
2. **Domain-Specific**: Built for telecom technical specifications
3. **Reference-Aware**: Parses and understands 3GPP specs
4. **Diagram Intelligence**: Generates diagrams from descriptions
5. **Review Workflow**: Approve/reject/refine loop
6. **Template Export**: Maintains corporate formatting

## Architecture Decisions Made

1. **API Key Management**: ✅ Encrypted localStorage with device fingerprint
2. **AI Provider**: ✅ OpenRouter (supports multiple providers from single API)
3. **Reference Storage**: ✅ Store in browser (localStorage via Zustand persistence)
4. **Collaboration**: ✅ Single-user for MVP
5. **Backend**: ✅ Client-side only (no backend required)

## Resources

- **OpenRouter**: https://openrouter.ai/ (AI provider aggregator)
- **Anthropic Documentation**: https://docs.anthropic.com/
- **Mermaid Docs**: https://mermaid.js.org/
- **3GPP Specs**: https://www.3gpp.org/specifications
- **DOCX Library**: https://github.com/dolanmiu/docx
- **Mammoth**: https://github.com/mwilliamson/mammoth.js

## Documentation

- **[CLAUDE.md](CLAUDE.md)** - Complete guidance for AI assistants working on this codebase
- **[PHASE3_PROGRESS.md](PHASE3_PROGRESS.md)** - Current Phase 3 status and progress
- **[AI_COPILOT_ARCHITECTURE.md](AI_COPILOT_ARCHITECTURE.md)** - AI integration design
- **[IMPLEMENTATION_PROGRESS.md](IMPLEMENTATION_PROGRESS.md)** - Detailed roadmap
- **[QUICK_START.md](QUICK_START.md)** - 5-minute setup guide
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Common issues and solutions

---

**Current Focus**: Phase 3 completion (Sequence/Flow diagram editors, link resolution, change propagation)
