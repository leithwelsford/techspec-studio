/**
 * Mermaid Diagram Parser
 * Validates and processes AI-generated Mermaid diagrams
 */

import type { MermaidDiagram } from '../../../types';
import type { ParseResult } from './blockDiagramParser';

/**
 * Parse AI-generated Mermaid code into MermaidDiagram
 */
export function parseMermaidDiagram(
  response: string,
  diagramType: 'sequence' | 'flow' | 'state' | 'class',
  title: string,
  figureNumber?: string
): ParseResult<MermaidDiagram> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Extract mermaid code from markdown code blocks
    let mermaidCode = response.trim();

    // Remove markdown code fences
    const codeBlockMatch = mermaidCode.match(/```mermaid\s*\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      mermaidCode = codeBlockMatch[1].trim();
    } else {
      // Check if it's wrapped in generic code block
      const genericMatch = mermaidCode.match(/```\s*\n([\s\S]*?)\n```/);
      if (genericMatch) {
        mermaidCode = genericMatch[1].trim();
      }
    }

    // Clean up invalid newline escapes in labels (AI sometimes generates \n which breaks Mermaid)
    // Replace \n in labels with space to fix syntax errors
    mermaidCode = mermaidCode.replace(/:\\s*([^:\n]*?)\\n([^:\n]*)/g, (match, before, after) => {
      // Only replace \n that appears within labels (between : and the end of the label)
      return `: ${before} ${after}`;
    });

    // Validate based on diagram type
    const validation = validateMermaidSyntax(mermaidCode, diagramType);
    errors.push(...validation.errors);
    warnings.push(...validation.warnings);

    if (errors.length > 0) {
      return { success: false, errors, warnings };
    }

    // Generate ID from title
    const id = sanitizeDiagramId(title);

    const diagram: MermaidDiagram = {
      id,
      type: diagramType,
      title,
      figureNumber,
      mermaidCode
    };

    return { success: true, data: diagram, errors: [], warnings };

  } catch (error) {
    errors.push(`Parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { success: false, errors, warnings };
  }
}

/**
 * Validate Mermaid syntax based on diagram type
 */
function validateMermaidSyntax(
  code: string,
  diagramType: 'sequence' | 'flow' | 'state' | 'class'
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!code || code.length === 0) {
    errors.push('Empty mermaid code');
    return { errors, warnings };
  }

  // Check for diagram type declaration
  const firstLine = code.split('\n')[0].trim();

  switch (diagramType) {
    case 'sequence':
      if (!firstLine.startsWith('sequenceDiagram')) {
        warnings.push('Missing sequenceDiagram declaration, may not render correctly');
      }
      // Check for basic sequence diagram elements
      if (!code.includes('->>') && !code.includes('-->>')) {
        warnings.push('No message arrows found (->>) in sequence diagram');
      }
      break;

    case 'flow':
      if (!firstLine.startsWith('flowchart') && !firstLine.startsWith('graph')) {
        warnings.push('Missing flowchart/graph declaration, may not render correctly');
      }
      // Check for nodes and connections
      if (!code.includes('-->') && !code.includes('-.->') && !code.includes('==>')) {
        warnings.push('No connections found in flowchart');
      }
      break;

    case 'state':
      if (!firstLine.startsWith('stateDiagram')) {
        warnings.push('Missing stateDiagram declaration, may not render correctly');
      }
      // Check for state transitions
      if (!code.includes('-->') && !code.includes(':')) {
        warnings.push('No state transitions found');
      }
      break;

    case 'class':
      if (!firstLine.startsWith('classDiagram')) {
        warnings.push('Missing classDiagram declaration, may not render correctly');
      }
      break;
  }

  // Check for common syntax errors
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) continue;

    // Check for unmatched brackets
    const openBrackets = (line.match(/[\[{(]/g) || []).length;
    const closeBrackets = (line.match(/[\]})]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      warnings.push(`Line ${i + 1}: Possibly unmatched brackets`);
    }
  }

  return { errors, warnings };
}

/**
 * Extract diagram type from mermaid code
 */
export function detectMermaidType(code: string): 'sequence' | 'flow' | 'state' | 'class' | null {
  const firstLine = code.trim().split('\n')[0].toLowerCase();

  if (firstLine.startsWith('sequencediagram')) return 'sequence';
  if (firstLine.startsWith('flowchart') || firstLine.startsWith('graph')) return 'flow';
  if (firstLine.startsWith('statediagram')) return 'state';
  if (firstLine.startsWith('classdiagram')) return 'class';

  return null;
}

/**
 * Fix common Mermaid syntax issues
 */
export function fixMermaidSyntax(code: string, diagramType: 'sequence' | 'flow' | 'state' | 'class'): string {
  let fixed = code.trim();

  // Ensure diagram type declaration
  const firstLine = fixed.split('\n')[0].trim().toLowerCase();
  let needsDeclaration = false;

  switch (diagramType) {
    case 'sequence':
      if (!firstLine.startsWith('sequencediagram')) {
        needsDeclaration = true;
        fixed = `sequenceDiagram\n${fixed}`;
      }
      break;
    case 'flow':
      if (!firstLine.startsWith('flowchart') && !firstLine.startsWith('graph')) {
        needsDeclaration = true;
        fixed = `flowchart TD\n${fixed}`;
      }
      break;
    case 'state':
      if (!firstLine.startsWith('statediagram')) {
        needsDeclaration = true;
        fixed = `stateDiagram-v2\n${fixed}`;
      }
      break;
    case 'class':
      if (!firstLine.startsWith('classdiagram')) {
        needsDeclaration = true;
        fixed = `classDiagram\n${fixed}`;
      }
      break;
  }

  // Remove any markdown code fences that might be embedded
  fixed = fixed.replace(/```mermaid\s*\n?/g, '');
  fixed = fixed.replace(/```\s*\n?/g, '');

  // Trim excessive blank lines
  fixed = fixed.replace(/\n{3,}/g, '\n\n');

  return fixed;
}

/**
 * Validate existing MermaidDiagram
 */
export function validateMermaidDiagram(diagram: MermaidDiagram): ParseResult<MermaidDiagram> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!diagram.id) {
    errors.push('Missing diagram ID');
  }
  if (!diagram.title) {
    errors.push('Missing diagram title');
  }
  if (!diagram.type) {
    errors.push('Missing diagram type');
  }
  if (!diagram.mermaidCode) {
    errors.push('Missing mermaid code');
  } else {
    const validation = validateMermaidSyntax(diagram.mermaidCode, diagram.type);
    errors.push(...validation.errors);
    warnings.push(...validation.warnings);
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings };
  }

  return { success: true, data: diagram, errors: [], warnings };
}

/**
 * Extract participant names from sequence diagram
 */
export function extractSequenceParticipants(mermaidCode: string): string[] {
  const participants: string[] = [];
  const lines = mermaidCode.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Look for participant declarations
    const participantMatch = trimmed.match(/participant\s+(\w+)/);
    if (participantMatch) {
      participants.push(participantMatch[1]);
      continue;
    }

    // Look for actors (aliases) in participant declarations
    const aliasMatch = trimmed.match(/participant\s+\w+\s+as\s+(.+)/);
    if (aliasMatch) {
      participants.push(aliasMatch[1].trim());
      continue;
    }

    // Extract from arrows
    const arrowMatch = trimmed.match(/(\w+)-[->]+(\w+)/);
    if (arrowMatch) {
      if (!participants.includes(arrowMatch[1])) {
        participants.push(arrowMatch[1]);
      }
      if (!participants.includes(arrowMatch[2])) {
        participants.push(arrowMatch[2]);
      }
    }
  }

  return participants;
}

/**
 * Extract states from state diagram
 */
export function extractStates(mermaidCode: string): string[] {
  const states: string[] = [];
  const lines = mermaidCode.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // State declarations
    const stateMatch = trimmed.match(/state\s+"([^"]+)"\s+as\s+(\w+)/);
    if (stateMatch) {
      states.push(stateMatch[2]);
      continue;
    }

    // State transitions
    const transitionMatch = trimmed.match(/(\w+)\s+-->\s+(\w+)/);
    if (transitionMatch) {
      if (!states.includes(transitionMatch[1]) && transitionMatch[1] !== '[*]') {
        states.push(transitionMatch[1]);
      }
      if (!states.includes(transitionMatch[2]) && transitionMatch[2] !== '[*]') {
        states.push(transitionMatch[2]);
      }
    }
  }

  return states;
}

/**
 * Sanitize diagram ID
 */
function sanitizeDiagramId(title: string): string {
  // Convert to camelCase
  let id = title
    .toLowerCase()
    .replace(/[^a-z0-9]+(.)/g, (_, char) => char.toUpperCase());

  // Ensure starts with lowercase
  id = id.charAt(0).toLowerCase() + id.slice(1);

  // Remove any remaining special characters
  id = id.replace(/[^a-zA-Z0-9]/g, '');

  return id || 'diagram';
}

/**
 * Generate preview text for a mermaid diagram
 */
export function generateMermaidPreview(diagram: MermaidDiagram): string {
  const lines = diagram.mermaidCode.split('\n').slice(0, 5);
  const preview = lines.join('\n');
  return diagram.mermaidCode.split('\n').length > 5
    ? `${preview}\n...`
    : preview;
}
