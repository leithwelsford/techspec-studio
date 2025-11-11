/**
 * Mermaid Documentation Search Utilities
 *
 * Embedded Mermaid syntax documentation for offline validation and examples.
 * Used by the self-healing system to provide correct syntax references.
 */

import { MermaidErrorType } from './mermaidValidator';

export interface MermaidDocEntry {
  section: string;
  topic: string;
  syntax: string;
  examples: string[];
  description: string;
  commonMistakes?: string[];
}

/**
 * Embedded Mermaid documentation database
 */
const MERMAID_DOCS: MermaidDocEntry[] = [
  // ========== SEQUENCE DIAGRAM ARROWS ==========
  {
    section: 'sequence-diagram',
    topic: 'arrows',
    syntax: 'Participant->>Participant: Message',
    examples: [
      'Alice->>Bob: Hello Bob',
      'Bob-->>Alice: Hi Alice (dotted)',
      'Alice-)Bob: Fire and forget (async)',
      'Bob--)Alice: Async dotted response',
      'Alice->>+Bob: Activate Bob',
      'Bob-->>-Alice: Deactivate Bob',
      'Alice->>Alice: Self message'
    ],
    description: 'Valid arrow syntax for sequence diagrams. Use ->> for solid arrows, -->> for dotted arrows, -) for async, and --) for async dotted.',
    commonMistakes: [
      '❌ A-)>B (wrong: -)> should be ->>)',
      '❌ A->B (wrong: single arrow, use ->>)',
      '❌ A-->B (wrong: single arrow, use -->>)',
      '❌ A->>>B (wrong: too many >, use ->>)'
    ]
  },

  // ========== SEQUENCE DIAGRAM PARTICIPANTS ==========
  {
    section: 'sequence-diagram',
    topic: 'participants',
    syntax: 'participant Name as Alias',
    examples: [
      'participant Alice',
      'participant Bob as B',
      'participant "Complex Name" as CN',
      'actor User',
      'actor System as Sys'
    ],
    description: 'Declare participants before using them in messages. Use "participant" or "actor" keywords.',
    commonMistakes: [
      '❌ Using participant without declaring it first',
      '❌ Spaces in names without quotes',
      '❌ Special characters without proper escaping'
    ]
  },

  // ========== SEQUENCE DIAGRAM NOTES ==========
  {
    section: 'sequence-diagram',
    topic: 'notes',
    syntax: 'Note [position] [participants]: text',
    examples: [
      'Note left of Alice: Alice thinks',
      'Note right of Bob: Bob responds',
      'Note over Alice: Alice does something',
      'Note over Alice,Bob: Spanning multiple participants'
    ],
    description: 'Add notes to sequence diagrams. Position can be "left of", "right of", or "over" participant(s).',
    commonMistakes: [
      '❌ Note Alice: text (missing position)',
      '❌ Note between Alice Bob (should be "over Alice,Bob")',
      '❌ Note on Alice (should be "left of" or "right of")'
    ]
  },

  // ========== SEQUENCE DIAGRAM ACTIVATION ==========
  {
    section: 'sequence-diagram',
    topic: 'activation',
    syntax: 'Participant->>+Participant: Activate\nParticipant-->>-Participant: Deactivate',
    examples: [
      'Alice->>+Bob: Request (activate Bob)',
      'Bob-->>-Alice: Response (deactivate Bob)',
      'Alice->>+Bob: First request',
      'Alice->>+Bob: Nested request',
      'Bob-->>-Alice: First response',
      'Bob-->>-Alice: Second response'
    ],
    description: 'Activate participants with + suffix, deactivate with - suffix. Can be nested.',
    commonMistakes: [
      '❌ Using + or - without arrow',
      '❌ Mismatched activation/deactivation counts',
      '❌ Activating already active participant without nesting'
    ]
  },

  // ========== SEQUENCE DIAGRAM LOOPS ==========
  {
    section: 'sequence-diagram',
    topic: 'loops',
    syntax: 'loop [label]\n    ...\nend',
    examples: [
      'loop Every minute\n    Alice->>Bob: Ping\n    Bob-->>Alice: Pong\nend',
      'loop Check status\n    System->>Database: Query\nend'
    ],
    description: 'Create loops with the loop keyword. End with "end".',
    commonMistakes: [
      '❌ Missing "end" keyword',
      '❌ Incorrect indentation',
      '❌ Using "endloop" instead of "end"'
    ]
  },

  // ========== SEQUENCE DIAGRAM ALT/OPT ==========
  {
    section: 'sequence-diagram',
    topic: 'conditionals',
    syntax: 'alt [condition]\n    ...\nelse [condition]\n    ...\nend',
    examples: [
      'alt Success case\n    Alice->>Bob: Success\nelse Failure\n    Alice->>Bob: Error\nend',
      'opt Optional flow\n    Alice->>Bob: Optional message\nend'
    ],
    description: 'Use alt/else/end for conditionals, opt/end for optional flows.',
    commonMistakes: [
      '❌ Missing "end" keyword',
      '❌ Using "if" instead of "alt"',
      '❌ Multiple "else" blocks (use "else if" pattern)'
    ]
  },

  // ========== FLOWCHART SYNTAX ==========
  {
    section: 'flowchart',
    topic: 'basic-syntax',
    syntax: 'flowchart TD\n    A[Node] --> B{Decision}',
    examples: [
      'flowchart TD\n    A[Start] --> B[Process]',
      'flowchart LR\n    A[Left] --> B[Right]',
      'flowchart TD\n    A{Decision} -->|Yes| B[Action]'
    ],
    description: 'Flowcharts use TD (top-down), LR (left-right), BT (bottom-top), or RL (right-left) direction.',
    commonMistakes: [
      '❌ Using "graph" instead of "flowchart" (deprecated)',
      '❌ Missing direction (TD, LR, etc.)',
      '❌ Invalid node shapes'
    ]
  }
];

/**
 * Search documentation by error type
 */
export function searchDocsByErrorType(errorType: MermaidErrorType): MermaidDocEntry[] {
  switch (errorType) {
    case MermaidErrorType.INVALID_ARROW:
      return MERMAID_DOCS.filter(doc => doc.topic === 'arrows');

    case MermaidErrorType.MISSING_DECLARATION:
    case MermaidErrorType.INVALID_PARTICIPANT:
      return MERMAID_DOCS.filter(doc => doc.topic === 'participants');

    case MermaidErrorType.INVALID_NOTE:
      return MERMAID_DOCS.filter(doc => doc.topic === 'notes');

    case MermaidErrorType.INVALID_SYNTAX:
      // Return general syntax docs
      return MERMAID_DOCS.filter(doc =>
        doc.topic === 'arrows' ||
        doc.topic === 'participants' ||
        doc.topic === 'basic-syntax'
      );

    default:
      // Return all docs for unknown errors
      return MERMAID_DOCS;
  }
}

/**
 * Search documentation by query string
 */
export function searchDocsByQuery(query: string): MermaidDocEntry[] {
  const queryLower = query.toLowerCase();

  return MERMAID_DOCS.filter(doc => {
    return (
      doc.topic.toLowerCase().includes(queryLower) ||
      doc.description.toLowerCase().includes(queryLower) ||
      doc.syntax.toLowerCase().includes(queryLower) ||
      doc.examples.some(ex => ex.toLowerCase().includes(queryLower))
    );
  });
}

/**
 * Get all valid examples for a specific topic
 */
export function getValidExamples(errorType: MermaidErrorType): string[] {
  const docs = searchDocsByErrorType(errorType);
  const examples: string[] = [];

  for (const doc of docs) {
    examples.push(...doc.examples);
  }

  return examples;
}

/**
 * Get common mistakes for a specific error type
 */
export function getCommonMistakes(errorType: MermaidErrorType): string[] {
  const docs = searchDocsByErrorType(errorType);
  const mistakes: string[] = [];

  for (const doc of docs) {
    if (doc.commonMistakes) {
      mistakes.push(...doc.commonMistakes);
    }
  }

  return mistakes;
}

/**
 * Build context string for AI healing prompt
 */
export function buildHealingContext(errorType: MermaidErrorType): string {
  const docs = searchDocsByErrorType(errorType);
  const validExamples = getValidExamples(errorType);
  const commonMistakes = getCommonMistakes(errorType);

  let context = '=== MERMAID SYNTAX REFERENCE ===\n\n';

  // Add documentation sections
  for (const doc of docs) {
    context += `## ${doc.topic.toUpperCase()}\n`;
    context += `${doc.description}\n\n`;
    context += `Correct syntax: ${doc.syntax}\n\n`;
    context += `Valid examples:\n`;
    doc.examples.forEach(ex => {
      context += `  ✅ ${ex}\n`;
    });
    context += '\n';

    if (doc.commonMistakes && doc.commonMistakes.length > 0) {
      context += 'Common mistakes to avoid:\n';
      doc.commonMistakes.forEach(mistake => {
        context += `  ${mistake}\n`;
      });
      context += '\n';
    }
  }

  context += '\n=== END REFERENCE ===\n';

  return context;
}

/**
 * Get all documentation entries
 */
export function getAllDocs(): MermaidDocEntry[] {
  return MERMAID_DOCS;
}

/**
 * Get documentation for sequence diagrams specifically
 */
export function getSequenceDiagramDocs(): MermaidDocEntry[] {
  return MERMAID_DOCS.filter(doc => doc.section === 'sequence-diagram');
}

/**
 * Get documentation for flowcharts specifically
 */
export function getFlowchartDocs(): MermaidDocEntry[] {
  return MERMAID_DOCS.filter(doc => doc.section === 'flowchart');
}
