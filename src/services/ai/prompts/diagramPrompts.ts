/**
 * Diagram Generation Prompts
 * Prompts for generating various types of technical diagrams
 *
 * Uses cached Mermaid documentation for up-to-date syntax references.
 */

import { getCompactSyntaxReference, getMermaidDocs } from '../mermaidDocsCache';

/**
 * Helper function to append user guidance to prompts
 */
function appendUserGuidance(basePrompt: string, userGuidance?: string): string {
  if (!userGuidance) return basePrompt;

  // Check if this is a TODO comment (from specification) vs user-provided guidance
  const isTodoComment = userGuidance.includes('**IMPORTANT - Diagram Requirements from Specification:**');

  if (isTodoComment) {
    // TODO comments have ABSOLUTE PRIORITY - they define what MUST be in the diagram
    return `${basePrompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRITICAL: DIAGRAM REQUIREMENTS FROM TECHNICAL SPECIFICATION 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${userGuidance}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ MANDATORY REQUIREMENTS:
1. You MUST follow the requirements above EXACTLY
2. Include EVERY component, interface, and detail specified
3. Use the EXACT terminology and names provided
4. DO NOT add components that aren't specified
5. DO NOT omit components that are specified
6. DO NOT make assumptions - follow the requirements literally

The description below is for context only. The requirements above define what MUST be in the diagram.`;
  }

  // Regular user guidance (not from TODO comments)
  return `${basePrompt}

---

**IMPORTANT USER GUIDANCE:**
${userGuidance}

Please take this guidance into account when generating this diagram. The guidance may specify:
- Which components or interfaces to emphasize or de-emphasize
- Specific architectural details or deployment scenarios
- Terminology preferences or naming conventions
- Which message flows or procedures to include/exclude`;
}

/**
 * Generate block diagram from description
 */
export function buildBlockDiagramPrompt(
  description: string,
  title: string,
  figureNumber?: string,
  userGuidance?: string
): string {
  const basePrompt = `Generate a block diagram based on the following description:

Description: ${description}
Title: ${title}
${figureNumber ? `Figure Number: ${figureNumber}` : ''}

You must output valid JSON matching this TypeScript interface:

interface BlockDiagram {
  id: string;                    // camelCase ID (e.g., "convergentServiceEdge")
  title: string;                 // Display title
  description?: string;          // Optional description
  figureNumber?: string;         // e.g., "4-1"

  nodes: Record<string, NodeMeta>;  // Node definitions
  edges: EdgeDef[];                 // Connections between nodes
  positions: Record<string, Point>; // Node positions (x, y)
  sizes: Record<string, Size>;      // Node sizes (w, h)

  sepY?: number;                    // Optional horizontal separator Y position
  labelOffsets?: Record<string, { dx: number; dy: number }>; // Edge label offsets
}

interface NodeMeta {
  label: string;    // Display text
  shape: "rect" | "cloud";  // Shape type
}

interface EdgeDef {
  from: string;     // Source node ID
  to: string;       // Target node ID
  label?: string;   // Optional label text
  style?: "bold" | "solid" | "dashed";  // Line style
}

interface Point {
  x: number;  // X coordinate
  y: number;  // Y coordinate
}

interface Size {
  w: number;  // Width
  h: number;  // Height
}

Guidelines:
1. **Node IDs**: Use camelCase (e.g., "userEquipment", "policyServer", "internet")
2. **Node Shapes**:
   - Use "rect" for network functions, servers, equipment
   - Use "cloud" for networks, Internet, external domains
3. **Positioning**:
   - Left-to-right flow for typical data paths
   - X coordinates: start around 100, space nodes 200-300 units apart
   - Y coordinates: start around 100, space layers 150-200 units apart
   - Position related nodes close together
   - Create clear visual groupings
4. **Sizes**:
   - Standard rect nodes: { w: 120, h: 60 }
   - Larger components: { w: 150, h: 70 }
   - Cloud shapes: { w: 140, h: 80 }
5. **Edges**:
   - Use "bold" for primary data paths
   - Use "solid" for control interfaces
   - Use "dashed" for optional or backup paths
   - Add labels for interface names (e.g., "Gx", "S1", "SGi")
6. **Separator**: Use sepY if diagram has distinct sections (e.g., mobile network above, fixed network below)
7. **Label Offsets**: Usually not needed initially, can be added later for fine-tuning

Example structure:
{
  "id": "ipCanSessionSetup",
  "title": "IP-CAN Session Setup",
  "figureNumber": "4-1",
  "nodes": {
    "ue": { "label": "UE/CPE", "shape": "rect" },
    "pgw": { "label": "P-GW", "shape": "rect" },
    "pcrf": { "label": "PCRF", "shape": "rect" },
    "internet": { "label": "Internet", "shape": "cloud" }
  },
  "edges": [
    { "from": "ue", "to": "pgw", "label": "S5/S8", "style": "bold" },
    { "from": "pgw", "to": "pcrf", "label": "Gx", "style": "solid" },
    { "from": "pgw", "to": "internet", "label": "SGi", "style": "bold" }
  ],
  "positions": {
    "ue": { "x": 100, "y": 200 },
    "pgw": { "x": 350, "y": 200 },
    "pcrf": { "x": 350, "y": 50 },
    "internet": { "x": 600, "y": 200 }
  },
  "sizes": {
    "ue": { "w": 120, "h": 60 },
    "pgw": { "w": 120, "h": 60 },
    "pcrf": { "w": 120, "h": 60 },
    "internet": { "w": 140, "h": 80 }
  }
}

Now generate the block diagram JSON for the description provided above. Output ONLY valid JSON, no explanations.`;

  return appendUserGuidance(basePrompt, userGuidance);
}

/**
 * Generate sequence diagram (Mermaid syntax)
 */
export function buildSequenceDiagramPrompt(
  description: string,
  title: string,
  participants: string[] = [],
  figureNumber?: string,
  userGuidance?: string
): string {
  // Get current Mermaid syntax docs (from cache or embedded)
  const syntaxDocs = getCompactSyntaxReference('sequence');
  const docsVersion = getMermaidDocs().version;

  const basePrompt = `Generate a Mermaid sequence diagram based on the following description:

Description: ${description}
Title: ${title}
${participants.length > 0 ? `Participants: ${participants.join(', ')}` : ''}
${figureNumber ? `Figure Number: ${figureNumber}` : ''}

You must output valid Mermaid syntax for a sequence diagram.

=== MERMAID SEQUENCE DIAGRAM SYNTAX (v${docsVersion}) ===
${syntaxDocs}
=== END SYNTAX REFERENCE ===

Example (using shorthand +/- for activation - PREFERRED):
\`\`\`mermaid
sequenceDiagram
    participant UE as UE_CPE
    participant PGW as P_GW
    participant PCRF
    participant TDF

    Note over UE,TDF: IP-CAN Session Establishment

    UE->>+PGW: Attach Request
    PGW->>+PCRF: CCR-Initial (Gx)
    PCRF-->>-PGW: CCA-Initial (PCC Rules)
    PGW-->>-UE: Attach Accept

    Note right of PGW: Session established

    alt Application Traffic Detection
        UE->>PGW: Application Traffic
        PGW->>TDF: Deep Packet Inspection
        TDF->>PCRF: Service Detection (Sd)
        PCRF->>PGW: Updated PCC Rules (Gx)
    end
\`\`\`

**⚠️ OUTPUT FORMAT - READ CAREFULLY:**
- You MUST output Mermaid sequence diagram syntax (text-based diagram language)
- Start your output with \`\`\`mermaid and end with \`\`\`
- The first line inside the code block MUST be: sequenceDiagram
- DO NOT output JSON. This is NOT a block diagram request.
- DO NOT output a node/edge structure. Use Mermaid participant/arrow syntax.
- If you're unsure, look at the example above - it shows the exact format expected.

Guidelines:
1. Identify all participants from the description
2. Use meaningful aliases for clarity
3. Show the sequence of messages chronologically
4. Use appropriate arrow types:
   - Solid arrows for requests
   - Dotted arrows for responses
5. Add activation boxes for processing
6. Include notes to explain key steps
7. Use alt/opt/loop for conditional flows
8. Group related messages with rect blocks
9. Keep descriptions concise but clear
10. Use proper 3GPP interface names (Gx, Rx, S5, etc.) where applicable
11. **IMPORTANT**: Message labels must be single-line. Do NOT use \\n or line breaks in labels.
12. If you need to add multiple pieces of information, use commas or separate them with dashes.

**CRITICAL VALIDATION RULES (prevent syntax errors):**
13. **Participant names**: Use only alphanumeric characters and underscores. NO special characters like (, ), /, -, etc.
    - CORRECT: P_GW, TDF_PCEF, Mobile_UE, CPE, PCRF, AAA_Server
    - WRONG: P-GW (PCEF), TDF/PCEF, UE/CPE, AAA-Server

14. **AVOID activate/deactivate** - These cause the most common Mermaid errors!
    - For simple diagrams: DO NOT use activate/deactivate at all. They are optional.
    - The diagram will render correctly without them.
    - Only use them if explicitly needed for showing processing time.

15. **If you MUST use activation** (only when absolutely necessary):
    - EVERY activate MUST have a matching deactivate for the SAME participant
    - A participant can only be activated ONCE at a time
    - NEVER call deactivate on a participant that wasn't activated
    - NEVER call activate on a participant that's already active
    - WRONG: "activate AAA" ... (no deactivate) ... "deactivate AAA" ← ERROR: inactive!
    - WRONG: "activate A" ... "activate A" ← ERROR: already active!
    - CORRECT: "activate A" ... "deactivate A" ... "activate A" ... "deactivate A"

16. **Simpler alternative - shorthand notation** (PREFERRED over activate/deactivate):
    - Use + and - after arrows: "A->>+B: Request" activates B, "B-->>-A: Response" deactivates B
    - This is cleaner and less error-prone than separate activate/deactivate statements

17. **Participant aliases**: If you need to show "P-GW (PCEF)", declare it as: participant PGW as P-GW/PCEF
    - Then use PGW in all messages, NOT "P-GW (PCEF)"

18. **For complex diagrams with many participants**: Keep it simple!
    - Skip activation boxes entirely - they add visual clutter and cause errors
    - Focus on the message flow, which is the important part
    - Use notes and rect blocks for visual grouping instead

19. **KEEP CONTENT CONCISE** - Mermaid has text size limits!
    - Message labels: Maximum 50-60 characters. Use abbreviations.
    - Notes: Keep brief (1-2 short sentences max)
    - Limit to 10-12 participants per diagram
    - Limit to 20-25 messages per diagram
    - If content is complex, suggest splitting into multiple diagrams
    - WRONG: "Mobile_UE->>Access_Network: DHCP_RA_with_CAPPORT_URI_RFC8910_when_CAPTIVE_status_detected"
    - CORRECT: "Mobile_UE->>Access_Network: DHCP RA (CAPPORT URI)"

Now generate the Mermaid sequence diagram code for the description provided. Output the mermaid code block wrapped in \`\`\`mermaid ... \`\`\`.`;

  return appendUserGuidance(basePrompt, userGuidance);
}

/**
 * Generate any Mermaid diagram - AI decides the appropriate type based on content
 * This unified prompt includes syntax for all Mermaid diagram types and lets the AI
 * choose the most appropriate one based on the description and TODO comments.
 */
export function buildUnifiedMermaidPrompt(
  description: string,
  title: string,
  figureNumber?: string,
  userGuidance?: string
): string {
  const docs = getMermaidDocs();
  const docsVersion = docs.version;

  const basePrompt = `Generate a Mermaid diagram based on the following description.
Choose the most appropriate diagram type based on the content:

**Flows & Behavior:**
- **Sequence Diagram**: Message flows, call sequences, protocol interactions, signaling
- **Flowchart**: Algorithms, decision trees, process flows, conditional logic
- **State Diagram**: State machines, transitions, lifecycle states
- **User Journey**: User experience flows, satisfaction scores, touchpoints
- **ZenUML**: Alternative sequence diagrams with method-call syntax

**Structure & Relationships:**
- **Class Diagram**: OOP structures, class relationships, inheritance hierarchies
- **ER Diagram**: Entity relationships, data models, database schemas
- **C4 Diagram**: Software architecture (Context, Container, Component levels)
- **Architecture Diagram**: System architecture with services, databases, queues
- **Requirement Diagram**: Requirements traceability, SysML requirements

**Hierarchies & Concepts:**
- **Mindmap**: Concept hierarchies, feature breakdowns, brainstorming structures
- **Treemap**: Hierarchical proportional areas

**Planning & Time:**
- **Gantt Chart**: Project timelines, phases, schedules, dependencies
- **Timeline**: Sequential events, milestones, historical evolution
- **Kanban**: Task boards, sprint boards, workflow stages

**Data Visualization:**
- **Pie Chart**: Proportional data, percentage distribution
- **Quadrant Chart**: 2D comparisons, priority matrices (like BCG matrix)
- **XY Chart**: Line charts, bar charts, scatter plots
- **Sankey Diagram**: Flow distributions, energy/resource flows
- **Radar Chart**: Spider charts, competency comparisons

**Development & Version Control:**
- **Git Graph**: Commit history, branches, merges

**Network & Protocol:**
- **Packet Diagram**: Network packet structures, protocol headers

Description: ${description}
Title: ${title}
${figureNumber ? `Figure Number: ${figureNumber}` : ''}

Read the description and any TODO comments carefully to determine the best diagram type.

=== MERMAID SEQUENCE DIAGRAM SYNTAX (v${docsVersion}) ===
${getCompactSyntaxReference('sequence')}

=== MERMAID FLOWCHART SYNTAX (v${docsVersion}) ===
${getCompactSyntaxReference('flow')}

=== MERMAID STATE DIAGRAM SYNTAX (v${docsVersion}) ===
${getCompactSyntaxReference('state')}
=== END SYNTAX REFERENCES ===

**OUTPUT REQUIREMENTS:**
1. Output valid Mermaid syntax wrapped in \`\`\`mermaid ... \`\`\`
2. First line MUST be the diagram type declaration:
   - \`sequenceDiagram\` for sequence diagrams
   - \`flowchart TD\` (or LR) for flowcharts
   - \`stateDiagram-v2\` for state diagrams
   - \`classDiagram\` for class diagrams
   - \`erDiagram\` for ER diagrams
   - \`gantt\` for Gantt charts
   - \`pie\` for pie charts
   - \`mindmap\` for mindmaps
   - \`timeline\` for timelines
   - \`quadrantChart\` for quadrant charts
   - \`C4Context\` / \`C4Container\` / \`C4Component\` for C4 diagrams
   - \`xychart-beta\` for XY charts
   - \`sankey-beta\` for Sankey diagrams
   - \`journey\` for User Journey diagrams
   - \`gitGraph\` for Git graphs
   - \`requirementDiagram\` for requirement diagrams
   - \`zenuml\` for ZenUML sequence diagrams
   - \`kanban\` for Kanban boards
   - \`packet-beta\` for packet diagrams
   - \`architecture-beta\` for architecture diagrams
   - \`radar-beta\` for radar charts
   - \`treemap-beta\` for treemaps
3. Keep labels concise - no newlines in labels
4. Use valid identifiers (alphanumeric and underscores only)

Now generate the most appropriate Mermaid diagram for the description provided.`;

  return appendUserGuidance(basePrompt, userGuidance);
}

/**
 * Generate flow diagram / state machine (Mermaid syntax)
 * @deprecated Use buildUnifiedMermaidPrompt instead - it lets AI decide the type
 */
export function buildFlowDiagramPrompt(
  description: string,
  title: string,
  diagramType: 'flowchart' | 'stateDiagram' = 'flowchart',
  figureNumber?: string
): string {
  if (diagramType === 'stateDiagram') {
    return buildStateDiagramPrompt(description, title, figureNumber);
  }

  // Get current Mermaid syntax docs (from cache or embedded)
  const syntaxDocs = getCompactSyntaxReference('flow');
  const docsVersion = getMermaidDocs().version;

  return `Generate a Mermaid flowchart based on the following description:

Description: ${description}
Title: ${title}
${figureNumber ? `Figure Number: ${figureNumber}` : ''}

You must output valid Mermaid flowchart syntax.

=== MERMAID FLOWCHART SYNTAX (v${docsVersion}) ===
${syntaxDocs}
=== END SYNTAX REFERENCE ===

Example:
\`\`\`mermaid
flowchart TD
    Start([Start]) --> Init[Initialize Connection]
    Init --> Auth{Auth OK?}
    Auth -->|Yes| Setup[Setup Session]
    Auth -->|No| Retry{Retry < 3?}
    Retry -->|Yes| Init
    Retry -->|No| Fail([Auth Failed])
    Setup --> Monitor[Monitor Connection]
    Monitor --> Check{Healthy?}
    Check -->|Yes| Monitor
    Check -->|No| Reconnect[Attempt Reconnect]
    Reconnect --> Check

    style Start fill:#90EE90
    style Fail fill:#FFB6C6
    style Setup fill:#87CEEB
\`\`\`

**CRITICAL SYNTAX RULES (prevent errors):**
11. **NO newlines in node labels** - Keep all labels on a single line
    - WRONG: \`id{Multi\\nLine}\` or \`id{Multi<br>Line}\`
    - CORRECT: \`id{Short Label}\` or use abbreviations
12. **Keep labels concise** - Maximum 30-40 characters per label
13. **Quote special characters** - Use \`id["Label with (special) chars"]\` for complex text
14. **Valid node IDs** - Use only alphanumeric and underscores: \`node_id\`, \`NodeId\`, \`node1\`

Guidelines:
1. Choose appropriate direction (TD for processes, LR for workflows)
2. Use descriptive node labels
3. Use rhombus {Decision?} for decision points
4. Use rounded rectangles ([Text]) for start/end
5. Use regular rectangles [Text] for processes
6. Add labels to arrows to explain conditions or data flow
7. Group related nodes in subgraphs if needed
8. Add styling to highlight important nodes:
   - Green for start/success
   - Red for errors/failures
   - Blue for key processes
9. Keep the flow clear and easy to follow
10. Use consistent spacing and alignment

Now generate the Mermaid flowchart code for the description provided. Output the mermaid code block wrapped in \`\`\`mermaid ... \`\`\`.`;
}

/**
 * Generate state diagram (Mermaid syntax)
 */
function buildStateDiagramPrompt(
  description: string,
  title: string,
  figureNumber?: string
): string {
  // Get current Mermaid syntax docs (from cache or embedded)
  const syntaxDocs = getCompactSyntaxReference('state');
  const docsVersion = getMermaidDocs().version;

  return `Generate a Mermaid state diagram based on the following description:

Description: ${description}
Title: ${title}
${figureNumber ? `Figure Number: ${figureNumber}` : ''}

You must output valid Mermaid state diagram syntax.

=== MERMAID STATE DIAGRAM SYNTAX (v${docsVersion}) ===
${syntaxDocs}
=== END SYNTAX REFERENCE ===

Example:
\`\`\`mermaid
stateDiagram-v2
    [*] --> Idle

    Idle --> Connecting : Connect Request
    Connecting --> Authenticating : Connection Established
    Connecting --> Idle : Connection Failed

    Authenticating --> Active : Authentication Success
    Authenticating --> Idle : Authentication Failed

    Active --> Suspended : Suspend
    Suspended --> Active : Resume
    Active --> Disconnecting : Disconnect Request

    Disconnecting --> Idle : Cleanup Complete
    Idle --> [*] : Shutdown

    state Active {
        [*] --> DataTransfer
        DataTransfer --> ErrorRecovery : Error Detected
        ErrorRecovery --> DataTransfer : Recovery Success
        ErrorRecovery --> [*] : Recovery Failed
    }

    note right of Active : Primary operational state\\nwith error handling
\`\`\`

Guidelines:
1. Start with stateDiagram-v2 directive
2. Identify all states from the description
3. Define clear state names (PascalCase recommended)
4. Show all valid transitions with triggering events
5. Include start [*] and end states where applicable
6. Use composite states for complex states with substates
7. Add transition labels to explain conditions
8. Use notes to clarify important states or behaviors
9. Consider error states and recovery paths
10. Keep the diagram logical and easy to understand

Now generate the Mermaid state diagram code for the description provided. Output the mermaid code block wrapped in \`\`\`mermaid ... \`\`\`.`;
}

/**
 * Suggest diagrams needed for a document section
 */
export function buildDiagramSuggestionPrompt(
  sectionTitle: string,
  sectionContent: string
): string {
  return `Analyze the following document section and suggest what diagrams would be helpful:

Section: ${sectionTitle}

Content:
${sectionContent}

For this section, suggest:
1. **Block Diagrams**: For showing architecture, components, and connections
2. **Sequence Diagrams**: For showing message flows and interactions
3. **Flow Diagrams**: For showing processes, decisions, and state machines

For each suggested diagram, provide:
- **Type**: block, sequence, or flow
- **Suggested ID**: camelCase identifier
- **Title**: Clear descriptive title
- **Purpose**: Why this diagram would be helpful
- **Key Elements**: What should be included in the diagram
- **Priority**: High, Medium, or Low

Format your response as:
## Suggested Diagrams

### 1. [Type] - [Title]
- **ID**: suggestedId
- **Purpose**: [Why this is needed]
- **Key Elements**:
  - Element 1
  - Element 2
  - ...
- **Priority**: [High/Medium/Low]

Only suggest diagrams that would genuinely add value. If no diagrams are needed, explain why.`;
}

/**
 * Improve existing diagram based on feedback
 */
export function buildDiagramRefinementPrompt(
  diagramType: 'block' | 'sequence' | 'flow',
  currentDiagram: string,
  feedback: string
): string {
  return `Refine the following ${diagramType} diagram based on user feedback:

Current Diagram:
${currentDiagram}

User Feedback:
${feedback}

Instructions:
1. Understand what the user wants changed
2. Make the requested improvements
3. Maintain the overall structure unless feedback suggests major changes
4. Ensure technical accuracy
5. Keep the diagram clear and readable

${diagramType === 'block'
  ? 'Output the refined JSON structure matching the BlockDiagram interface.'
  : 'Output the refined Mermaid code wrapped in ```mermaid ... ```'}

Output only the refined diagram, no explanations.`;
}

/**
 * Convert text description to diagram
 */
export function buildTextToDiagramPrompt(
  textDescription: string,
  preferredType?: 'block' | 'sequence' | 'flow'
): string {
  return `Convert the following text description into a technical diagram:

Description:
${textDescription}

${preferredType
  ? `The user prefers a ${preferredType} diagram.`
  : 'Choose the most appropriate diagram type (block, sequence, or flow) based on the content.'}

Steps:
1. Analyze the description to identify:
   - Entities/components mentioned
   - Relationships and connections
   - Sequence of events or flows
   - Decision points or states
2. Determine the most suitable diagram type:
   - Block diagram: For architecture, components, interfaces
   - Sequence diagram: For message flows, interactions, protocols
   - Flow diagram: For processes, decisions, state machines
3. Generate the appropriate diagram

Output:
- State which diagram type you chose and why
- Provide the diagram in the correct format:
  - Block: JSON matching BlockDiagram interface
  - Sequence: Mermaid sequence diagram
  - Flow: Mermaid flowchart or state diagram

Format:
## Diagram Type: [block/sequence/flow]
**Rationale**: [Why this type is most appropriate]

## Diagram:
[JSON or Mermaid code]`;
}
