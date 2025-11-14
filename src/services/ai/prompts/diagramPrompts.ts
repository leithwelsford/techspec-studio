/**
 * Diagram Generation Prompts
 * Prompts for generating various types of technical diagrams
 */

import type { BlockDiagram, MermaidDiagram } from '../../../types';

/**
 * Helper function to append user guidance to prompts
 */
function appendUserGuidance(basePrompt: string, userGuidance?: string): string {
  if (!userGuidance) return basePrompt;

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
  const basePrompt = `Generate a Mermaid sequence diagram based on the following description:

Description: ${description}
Title: ${title}
${participants.length > 0 ? `Participants: ${participants.join(', ')}` : ''}
${figureNumber ? `Figure Number: ${figureNumber}` : ''}

You must output valid Mermaid syntax for a sequence diagram.

Mermaid Sequence Diagram Syntax Guide:
- Participants: participant Name as Alias
- Messages:
  - Solid arrow: A->>B: Message
  - Dotted arrow: A-->>B: Response
  - Open arrow: A-)B: Async message
- Activation: activate A / deactivate A
- Notes: Note right of A: Text or Note over A,B: Text
- Loops: loop Text ... end
- Alternatives: alt Condition ... else ... end
- Optional: opt Condition ... end
- Parallel: par ... and ... end
- Grouping: rect rgb(200,220,240) ... end

Example:
\`\`\`mermaid
sequenceDiagram
    participant UE as UE/CPE
    participant PGW as P-GW
    participant PCRF
    participant TDF

    Note over UE,TDF: IP-CAN Session Establishment

    UE->>PGW: Attach Request
    activate PGW
    PGW->>PCRF: CCR-Initial (Gx)
    activate PCRF
    PCRF-->>PGW: CCA-Initial (PCC Rules)
    deactivate PCRF
    PGW->>UE: Attach Accept
    deactivate PGW

    Note right of PGW: Session established with\\ndefault QoS profile

    alt Application Traffic Detection
        UE->>PGW: Application Traffic
        PGW->>TDF: Deep Packet Inspection
        TDF->>PCRF: Service Detection (Sd)
        PCRF->>PGW: Updated PCC Rules (Gx)
    end
\`\`\`

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

Now generate the Mermaid sequence diagram code for the description provided. Output the mermaid code block wrapped in \`\`\`mermaid ... \`\`\`.`;

  return appendUserGuidance(basePrompt, userGuidance);
}

/**
 * Generate flow diagram / state machine (Mermaid syntax)
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

  return `Generate a Mermaid flowchart based on the following description:

Description: ${description}
Title: ${title}
${figureNumber ? `Figure Number: ${figureNumber}` : ''}

You must output valid Mermaid flowchart syntax.

Mermaid Flowchart Syntax Guide:
- Direction: flowchart TD (top-down) or LR (left-right)
- Nodes:
  - Rectangle: id[Text]
  - Rounded: id(Text)
  - Stadium: id([Text])
  - Cylinder: id[(Database)]
  - Circle: id((Text))
  - Asymmetric: id>Text]
  - Rhombus: id{Decision?}
  - Hexagon: id{{Text}}
  - Trapezoid: id[/Text/]
- Arrows:
  - Simple: A --> B
  - With text: A -->|label| B
  - Dotted: A -.->|label| B
  - Thick: A ==>|label| B
- Subgraphs: subgraph Title ... end
- Styling: style id fill:#f9f,stroke:#333

Example:
\`\`\`mermaid
flowchart TD
    Start([Start]) --> Init[Initialize Connection]
    Init --> Auth{Authentication\\nSuccessful?}
    Auth -->|Yes| Setup[Setup Session]
    Auth -->|No| Retry{Retry\\nCount < 3?}
    Retry -->|Yes| Init
    Retry -->|No| Fail([Authentication Failed])
    Setup --> Monitor[Monitor Connection]
    Monitor --> Check{Connection\\nHealthy?}
    Check -->|Yes| Monitor
    Check -->|No| Reconnect[Attempt Reconnect]
    Reconnect --> Check

    style Start fill:#90EE90
    style Fail fill:#FFB6C6
    style Setup fill:#87CEEB
\`\`\`

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
  return `Generate a Mermaid state diagram based on the following description:

Description: ${description}
Title: ${title}
${figureNumber ? `Figure Number: ${figureNumber}` : ''}

You must output valid Mermaid state diagram syntax.

Mermaid State Diagram Syntax Guide:
- Basic state: state "State Name" as StateName
- Transitions: StateA --> StateB : Event/Condition
- Start: [*] --> FirstState
- End: LastState --> [*]
- Composite states: state CompositeState { ... }
- Choice: state choice <<choice>>
- Fork/Join: state fork <<fork>> or <<join>>
- Concurrent states: state Concurrent { --}
- Notes: note right of State : Text

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
