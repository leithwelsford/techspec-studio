/**
 * Mermaid Diagram Validation Utilities
 *
 * Validates Mermaid diagram syntax and detects common errors.
 * Used by the self-healing system to identify and categorize errors.
 */

export enum MermaidErrorType {
  INVALID_ARROW = 'invalid_arrow',
  INVALID_PARTICIPANT = 'invalid_participant',
  INVALID_NOTE = 'invalid_note',
  INVALID_SYNTAX = 'invalid_syntax',
  MISSING_DECLARATION = 'missing_declaration',
  UNKNOWN = 'unknown'
}

export interface MermaidSyntaxError {
  line: number;
  column: number;
  message: string;
  errorType: MermaidErrorType;
  context: string; // The problematic line of code
  rawError: string; // Original error message from Mermaid
}

export interface MermaidValidationResult {
  isValid: boolean;
  errors: MermaidSyntaxError[];
  warnings: string[];
  originalCode: string;
  diagramType: string; // 'sequence', 'flow', 'state', etc.
}

/**
 * Validate Mermaid diagram code and parse errors
 */
export async function validateMermaidCode(code: string): Promise<MermaidValidationResult> {
  const errors: MermaidSyntaxError[] = [];
  const warnings: string[] = [];

  // Detect diagram type
  const diagramType = detectDiagramType(code);

  try {
    // Dynamically import mermaid for validation
    const mermaid = (await import('mermaid')).default;

    // Try to parse the diagram
    await mermaid.parse(code);

    // If parse succeeds, diagram is valid
    return {
      isValid: true,
      errors: [],
      warnings: [],
      originalCode: code,
      diagramType
    };
  } catch (error: any) {
    // Parse failed - extract error details
    const parsedError = parseMermaidError(error, code);
    errors.push(parsedError);

    return {
      isValid: false,
      errors,
      warnings,
      originalCode: code,
      diagramType
    };
  }
}

/**
 * Parse Mermaid error object into structured error
 */
function parseMermaidError(error: any, code: string): MermaidSyntaxError {
  const errorMessage = error.message || error.toString();

  // Extract line number from error message
  // Example: "Parse error on line 74:"
  const lineMatch = errorMessage.match(/line (\d+)/i);
  const line = lineMatch ? parseInt(lineMatch[1], 10) : 0;

  // Extract column number if available
  const columnMatch = errorMessage.match(/column (\d+)/i);
  const column = columnMatch ? parseInt(columnMatch[1], 10) : 0;

  // Get the problematic line of code
  const lines = code.split('\n');
  const context = line > 0 && line <= lines.length ? lines[line - 1] : '';

  // Categorize error type based on message patterns
  const errorType = categorizeError(errorMessage, context);

  return {
    line,
    column,
    message: errorMessage,
    errorType,
    context: context.trim(),
    rawError: errorMessage
  };
}

/**
 * Categorize error based on message and context
 */
function categorizeError(errorMessage: string, context: string): MermaidErrorType {
  const msgLower = errorMessage.toLowerCase();
  const ctxLower = context.toLowerCase();

  // Check for invalid arrow syntax
  // Common patterns: "->", "-)>", ">>-", etc.
  if (
    msgLower.includes('arrow') ||
    msgLower.includes('expecting') && msgLower.includes('actor') ||
    /[-=][)>]{1,2}[^>]/.test(context) || // Matches: -)>, ->X, etc.
    /[^-]>+[^>]/.test(context) // Matches: A>B, A>>B without proper dashes
  ) {
    return MermaidErrorType.INVALID_ARROW;
  }

  // Check for missing participant declaration
  if (
    msgLower.includes('participant') ||
    msgLower.includes('actor') && msgLower.includes('not found')
  ) {
    return MermaidErrorType.MISSING_DECLARATION;
  }

  // Check for invalid note syntax
  if (
    msgLower.includes('note') ||
    ctxLower.includes('note ') && !ctxLower.includes('note over') && !ctxLower.includes('note left') && !ctxLower.includes('note right')
  ) {
    return MermaidErrorType.INVALID_NOTE;
  }

  // Check for general syntax errors
  if (
    msgLower.includes('syntax') ||
    msgLower.includes('unexpected') ||
    msgLower.includes('expecting')
  ) {
    return MermaidErrorType.INVALID_SYNTAX;
  }

  return MermaidErrorType.UNKNOWN;
}

/**
 * Detect diagram type from code
 */
function detectDiagramType(code: string): string {
  const firstLine = code.trim().split('\n')[0].toLowerCase();

  if (firstLine.includes('sequencediagram')) return 'sequence';
  if (firstLine.includes('flowchart') || firstLine.includes('graph')) return 'flowchart';
  if (firstLine.includes('statediagram')) return 'state';
  if (firstLine.includes('classDiagram')) return 'class';
  if (firstLine.includes('erdiagram')) return 'er';
  if (firstLine.includes('gantt')) return 'gantt';

  return 'unknown';
}

/**
 * Quick validation check (doesn't use Mermaid parser, just regex patterns)
 */
export function quickValidateArrowSyntax(code: string): {
  isValid: boolean;
  invalidLines: { line: number; content: string; reason: string }[];
} {
  const lines = code.split('\n');
  const invalidLines: { line: number; content: string; reason: string }[] = [];

  // Valid arrow patterns for sequence diagrams
  const validArrows = [
    /->>/,   // Solid arrow: ->>
    /-->>/,  // Dotted arrow: -->>
    /-\)/,   // Async arrow: -)
    /--\)/,  // Async dotted arrow: --)
    /->>[\+\-]/, // Activate/deactivate: ->>+ or ->>-
    /-->>[\+\-]/ // Activate/deactivate dotted: -->>+ or -->>-
  ];

  // Invalid arrow patterns (common mistakes)
  const invalidArrows = [
    { pattern: /-\)>/, reason: 'Invalid async arrow syntax (should be -) not -)>)' },
    { pattern: /-\)(?!-)[^:]/, reason: 'Incomplete async arrow (should be -) for async)' },
    { pattern: /(?<!-)->(?!>)/, reason: 'Single arrow -> is invalid (use ->> for solid arrow)' },
    { pattern: /(?<!-)-->(?!>)/, reason: 'Single arrow --> is invalid (use -->> for dotted arrow)' },
    { pattern: /->{3,}/, reason: 'Too many arrow heads (use ->> not ->>>)' }
  ];

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Skip empty lines, comments, and directive lines
    if (!trimmed || trimmed.startsWith('%') || trimmed.startsWith('sequenceDiagram')) {
      return;
    }

    // Check if line contains an arrow
    const hasArrow = /-[->)]/.test(trimmed);
    if (!hasArrow) return;

    // Check for invalid patterns
    for (const { pattern, reason } of invalidArrows) {
      if (pattern.test(trimmed)) {
        invalidLines.push({
          line: index + 1,
          content: trimmed,
          reason
        });
        return;
      }
    }
  });

  return {
    isValid: invalidLines.length === 0,
    invalidLines
  };
}

/**
 * Extract participants from sequence diagram code
 */
export function extractParticipants(code: string): string[] {
  const participants: string[] = [];
  const lines = code.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Match explicit participant declarations
    // participant Alice
    // participant Bob as B
    const participantMatch = trimmed.match(/^participant\s+(\w+)/);
    if (participantMatch) {
      participants.push(participantMatch[1]);
      continue;
    }

    // Extract participants from arrows
    // Alice->>Bob: message
    const arrowMatch = trimmed.match(/^(\w+)(?:-[->)]|--[->)])/);
    if (arrowMatch) {
      const sender = arrowMatch[1];
      if (!participants.includes(sender)) {
        participants.push(sender);
      }

      // Extract receiver
      const receiverMatch = trimmed.match(/(?:-[->)]|--[->)])(\w+)/);
      if (receiverMatch) {
        const receiver = receiverMatch[1];
        if (!participants.includes(receiver)) {
          participants.push(receiver);
        }
      }
    }
  }

  return participants;
}
