# AI Co-Pilot Architecture

## Vision

**User Role**: Guide, reviewer, approver
**AI Role**: Writer, drafter, diagram generator, technical expert

The user provides high-level requirements and context; the AI generates complete technical specifications, diagrams, and documentation. The user reviews, refines, and approves.

## Core Paradigm Shift

### Before (Manual Authoring)
```
User → Manual Writing → Manual Diagram Creation → Manual Export
```

### After (AI-Assisted Generation)
```
User Input (Requirements/Context)
    ↓
AI Co-Pilot (Generate/Refine)
    ↓
Generated Output (Spec + Diagrams)
    ↓
User Review (Approve/Reject/Refine)
    ↓
Final Document
```

## AI Integration Points

### 1. **Conversational Interface**
- Chat panel alongside document editor
- Context-aware: knows current document, diagrams, references
- Multi-turn conversations for iterative refinement

### 2. **Document Generation**
- **From Scratch**: "Generate a 5G Private Line technical specification"
- **From Template**: "Use the draft-technical-specification as a template"
- **Section-by-Section**: "Write section 4.2 about QoS and Bearer Model"
- **Refinement**: "Make section 3.1 more technical" or "Simplify section 2.1"

### 3. **Diagram Generation**
- **Block Diagrams**: "Create a block diagram showing converged service edge"
- **Sequence Diagrams**: "Generate IP-CAN session setup sequence"
- **Flow Diagrams**: "Create state machine for primary/backup coordination"
- **From Description**: Parse natural language → structured diagram

### 4. **Reference Integration**
- AI reads uploaded 3GPP specs
- Auto-quotes relevant sections
- Suggests citations during generation
- Validates technical accuracy against standards

### 5. **Smart Linking**
- AI auto-inserts {{fig:...}} and {{ref:...}} references
- Suggests when to create new diagrams
- Maintains consistency across document

## Technical Architecture

### AI Service Layer (`src/services/ai/`)

```typescript
AIService
├── providers/
│   ├── ClaudeProvider.ts       // Anthropic Claude API
│   ├── OpenAIProvider.ts       // OpenAI GPT-4
│   └── LocalProvider.ts        // Local LLM (optional)
├── prompts/
│   ├── systemPrompts.ts        // Base system prompts
│   ├── documentPrompts.ts      // Spec generation prompts
│   ├── diagramPrompts.ts       // Diagram generation prompts
│   └── reviewPrompts.ts        // Review/critique prompts
├── parsers/
│   ├── blockDiagramParser.ts   // Parse AI output → BlockDiagram
│   ├── mermaidParser.ts        // Validate/fix Mermaid code
│   └── markdownParser.ts       // Parse structured output
└── context/
    ├── documentContext.ts      // Build context from current state
    └── referenceContext.ts     // Inject 3GPP spec context
```

### State Management Updates (`src/store/`)

```typescript
// Add to projectStore.ts
interface AIState {
  chatHistory: Message[];
  isGenerating: boolean;
  currentTask: AITask | null;
  pendingApprovals: PendingItem[];
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  attachments?: Attachment[];
}

interface AITask {
  id: string;
  type: 'document' | 'diagram' | 'section' | 'refinement';
  status: 'pending' | 'generating' | 'complete' | 'error';
  input: string;
  output?: string | BlockDiagram | MermaidDiagram;
}

interface PendingItem {
  id: string;
  type: 'document' | 'section' | 'diagram';
  content: any;
  status: 'review' | 'approved' | 'rejected';
  feedback?: string;
}
```

### UI Components (`src/components/ai/`)

```typescript
<AIChatPanel>           // Persistent chat interface
<AICommandPalette>      // Quick AI commands (Cmd+K)
<ReviewPanel>           // Approve/reject generated content
<DiffViewer>            // Show before/after changes
<AIStatusIndicator>     // "Generating..." / "Ready"
```

## User Workflows

### Workflow 1: Generate Complete Specification

```
1. User: "Create a technical specification for 5G Private Line service"

2. AI:
   - Asks clarifying questions (service variants? SLA requirements? etc.)
   - User answers via chat

3. AI Generates:
   ├── Document structure (sections 1-9)
   ├── Initial content for each section
   ├── Suggests diagrams needed
   └── Identifies reference documents required

4. User Reviews:
   ├── Approve sections → Lock in
   ├── Reject sections → AI regenerates
   └── Refine sections → "Make this more technical"

5. AI Creates Diagrams:
   - "Generate block diagram for section 4.1"
   - "Create sequence diagram for bearer setup"

6. Final Review → Export
```

### Workflow 2: Iterative Section Refinement

```
1. User selects section 3.1 (Service Definition)

2. User: "This section needs to be more normative and include technical constraints"

3. AI:
   - Reads current section content
   - Reads related 3GPP references
   - Regenerates with stricter language
   - Adds normative keywords (SHALL, MUST, etc.)

4. User: Side-by-side diff → Approve or further refine

5. AI inserts approved version → Updates figure references
```

### Workflow 3: Generate Diagram from Description

```
1. User: "Create a block diagram showing:
   - UE/CPE connecting to P-GW
   - P-GW connecting to TDF
   - TDF connecting to Internet
   - PCRF controlling P-GW via Gx
   - Show fixed path via BNG"

2. AI:
   - Parses entities: UE, P-GW, TDF, Internet, PCRF, BNG
   - Infers relationships: connections, control plane
   - Generates BlockDiagram JSON structure
   - Suggests positions based on flow

3. User:
   - Preview diagram in editor
   - Fine-tune positions (drag nodes)
   - Approve → Add to project

4. AI:
   - Auto-inserts {{fig:...}} reference in document
   - Updates figure numbering
```

### Workflow 4: Reference-Driven Generation

```
1. User uploads: 3GPP TS 23.203 (PCC Architecture)

2. AI:
   - Parses DOCX structure
   - Indexes key sections
   - Extracts normative language

3. User: "Write section 4.2 about QoS enforcement based on TS 23.203"

4. AI:
   - Quotes relevant clauses
   - Paraphrases technical details
   - Inserts {{ref:3gpp-ts-23-203}} citations
   - Maintains compliance with standard

5. User: Reviews accuracy → Approves
```

## Prompt Engineering Strategy

### System Prompt Template

```
You are a technical specification writing expert specializing in 5G telecommunications.

Context:
- Project: {project.name}
- Current Document: {document.title}
- Available References: {references.titles}
- Existing Diagrams: {diagrams.list}

Your role:
1. Generate technically accurate specifications
2. Use precise telecom terminology
3. Follow normative language patterns (SHALL, MUST, MAY)
4. Insert diagram references {{fig:id}} where appropriate
5. Cite references {{ref:id}} for standards compliance
6. Output structured content for easy parsing

Current Task: {task.description}
```

### Document Generation Prompt

```
Generate a technical specification document with the following structure:

Title: {title}
Sections: {sections}
Technical Domain: {domain}
Target Audience: {audience}

Requirements:
- Each section must have clear objectives
- Include normative language where applicable
- Suggest diagrams for complex architectures
- Reference 3GPP standards where relevant
- Use markdown formatting
- Insert {{fig:...}} placeholders for diagrams

Available context:
{context.references}
{context.existingContent}

Output format:
# Section Title
Content here with {{fig:diagram-id}} references...
```

### Diagram Generation Prompt

```
Generate a block diagram for: {description}

Output JSON structure matching BlockDiagram interface:
{
  "title": "...",
  "nodes": {
    "node-id": { "label": "...", "shape": "rect|cloud" }
  },
  "edges": [
    { "from": "id", "to": "id", "label": "...", "style": "bold|solid|dashed" }
  ],
  "positions": {
    "node-id": { "x": 100, "y": 200 }
  }
}

Rules:
- Use camelCase IDs
- Position nodes logically (left-to-right flow)
- Group related nodes
- Label edges clearly
- Suggest separators for mobile/fixed sections
```

## AI Provider Configuration

### Anthropic Claude (Recommended)

```typescript
// src/services/ai/providers/ClaudeProvider.ts
export class ClaudeProvider {
  private apiKey: string;
  private model = 'claude-3-5-sonnet-20241022';

  async generate(prompt: string, context: Context): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        system: buildSystemPrompt(context),
        messages: [{ role: 'user', content: prompt }]
      })
    });
    return parseResponse(response);
  }
}
```

**Why Claude?**
- Best for long-form technical writing
- 200K token context (can process entire 3GPP specs)
- Strong JSON structured output
- Excellent at following complex instructions

### Configuration Storage

```typescript
// Environment variables (not committed)
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_AI_PROVIDER=claude  // or openai, local

// User settings (encrypted in localStorage)
{
  aiProvider: 'claude',
  apiKey: '***encrypted***',
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.7,
  maxTokens: 4096
}
```

## Review & Approval Workflow

### Three-State System

1. **Draft** (AI-generated, not approved)
   - Yellow highlight in editor
   - "Review" badge
   - Side panel shows original prompt

2. **Approved** (User accepted)
   - No highlight
   - Merged into document
   - Can still be edited manually

3. **Rejected** (User declined)
   - Red highlight (temporary)
   - "Regenerate" button
   - Feedback input for refinement

### Diff Viewer

```typescript
<DiffViewer>
  <div className="before">
    {originalContent}
  </div>
  <div className="after">
    {generatedContent}
  </div>
  <div className="actions">
    <button onClick={approve}>Approve</button>
    <button onClick={reject}>Reject</button>
    <button onClick={refine}>Refine...</button>
  </div>
</DiffViewer>
```

## Context Building

### Document Context

AI needs to know:
- Current document structure
- Existing sections and content
- All diagram titles and IDs
- All reference titles and IDs
- User's writing style (learn from approved edits)

```typescript
function buildDocumentContext(project: Project): string {
  return `
Current Document: ${project.specification.title}

Existing Sections:
${extractSections(project.specification.markdown)}

Available Diagrams:
${project.blockDiagrams.map(d => `- {{fig:${d.id}}} "${d.title}"`)}
${project.sequenceDiagrams.map(d => `- {{fig:${d.id}}} "${d.title}"`)}

Available References:
${project.references.map(r => `- {{ref:${r.id}}} "${r.title}"`)}

Writing Style:
- Formality: ${analyzeFormality(project)}
- Technical Level: ${analyzeTechnicalLevel(project)}
`;
}
```

### Reference Context (3GPP Specs)

```typescript
function buildReferenceContext(references: ReferenceDocument[]): string {
  return references.map(ref => `
Reference: ${ref.metadata.spec} v${ref.metadata.version}
Title: ${ref.title}

Key Sections:
${extractKeyContent(ref.content)}

Normative Language:
${extractNormativeRules(ref.content)}
`).join('\n\n');
}
```

## Progressive Enhancement Strategy

### Phase 1: Basic Chat Interface
- Simple chat panel
- Claude API integration
- Manual copy/paste of AI output

### Phase 2: Smart Generation
- One-click "Generate Section" buttons
- Structured output parsing
- Auto-insert into document

### Phase 3: Review Workflow
- Diff viewer for changes
- Approve/reject workflow
- Version history

### Phase 4: Advanced Features
- Multi-turn refinement dialogs
- Learning from user edits
- Proactive suggestions
- Auto-generate missing diagrams

## Security & Privacy

### API Key Management
- Never commit API keys
- Encrypt in localStorage
- Option to use backend proxy
- Clear sensitive data on logout

### Data Privacy
- All processing via API (no local LLM initially)
- User owns all generated content
- No telemetry sent to AI provider
- Option to self-host later

## Cost Considerations

### Claude API Pricing (as of 2024)
- Claude 3.5 Sonnet: $3 / 1M input tokens, $15 / 1M output tokens
- Typical spec (50 pages): ~20K tokens
- Full generation: ~$0.30 - $1.00 per document
- Iterative refinement: ~$0.05 - $0.20 per edit

### User Controls
- Token usage dashboard
- Cost estimates before generation
- Batch mode for multiple sections
- Option to use cheaper models for drafts

## Implementation Priority

1. ✅ **AI Service Layer** - Claude provider, prompt templates
2. ✅ **Chat Interface** - Basic conversation UI
3. ✅ **Document Generation** - Section-by-section generation
4. ⏳ **Diagram Generation** - Parse descriptions → diagrams
5. ⏳ **Review Workflow** - Approve/reject UI
6. ⏳ **Reference Integration** - Parse 3GPP DOCX → context
7. ⏳ **Learning System** - Adapt to user style

## Next Steps

Before Phase 2 UI development, we need to:
1. Add AI types to `src/types/index.ts`
2. Create AI service layer structure
3. Add API key configuration UI
4. Build chat interface component
5. Implement basic generation flow

This becomes the **central feature** - the UI is built around AI assistance, not manual editing.
