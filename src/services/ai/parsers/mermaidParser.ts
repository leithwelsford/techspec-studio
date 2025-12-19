/**
 * Mermaid Diagram Parser
 * Validates and processes AI-generated Mermaid diagrams
 */

import type { MermaidDiagram, MermaidDiagramType } from '../../../types';
import type { ParseResult } from './blockDiagramParser';

/**
 * Parse AI-generated Mermaid code into MermaidDiagram
 */
export function parseMermaidDiagram(
  response: string,
  diagramType: MermaidDiagramType,
  title: string,
  figureNumber?: string
): ParseResult<MermaidDiagram> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Extract mermaid code from markdown code blocks
    let mermaidCode = response.trim();

    // FIRST: Check if the response looks like JSON (block diagram format) instead of Mermaid
    // This happens when the LLM generates the wrong diagram type
    const jsonIndicators = [
      /^\s*\{[\s\S]*"nodes"\s*:/,      // JSON with nodes property
      /^\s*\{[\s\S]*"edges"\s*:/,      // JSON with edges property
      /^\s*\{[\s\S]*"positions"\s*:/,  // JSON with positions property
      /```json\s*\n\s*\{/,              // JSON code block
    ];

    const isLikelyJson = jsonIndicators.some(pattern => pattern.test(mermaidCode));
    if (isLikelyJson) {
      errors.push(
        `Wrong diagram format: Received JSON (block diagram format) instead of Mermaid ${diagramType} diagram syntax. ` +
        `The AI may have generated a block diagram instead of a ${diagramType} diagram. ` +
        `Expected Mermaid syntax starting with "${diagramType === 'sequence' ? 'sequenceDiagram' : diagramType === 'flow' ? 'flowchart' : 'stateDiagram-v2'}".`
      );
      return { success: false, errors, warnings };
    }

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
    // This fixes common syntax errors caused by LLMs generating \n for multi-line labels

    // For sequence diagrams: Replace \n in labels after colons
    mermaidCode = mermaidCode.replace(/:\\s*([^:\n]*?)\\n([^:\n]*)/g, (_match, before, after) => {
      return `: ${before} ${after}`;
    });

    // For flowcharts: Replace \n inside node labels (inside [], {}, (), etc.)
    // This handles patterns like: id{Decision\nText} or id[Process\nDescription]
    mermaidCode = mermaidCode.replace(/(\[[^\]]*?)\\n([^\]]*?\])/g, '$1 $2');  // [...\n...]
    mermaidCode = mermaidCode.replace(/(\{[^}]*?)\\n([^}]*?\})/g, '$1 $2');    // {...\n...}
    mermaidCode = mermaidCode.replace(/(\([^)]*?)\\n([^)]*?\))/g, '$1 $2');    // (...\n...)
    mermaidCode = mermaidCode.replace(/(\[\[[^\]]*?)\\n([^\]]*?\]\])/g, '$1 $2'); // [[...\n...]]
    mermaidCode = mermaidCode.replace(/(\(\([^)]*?)\\n([^)]*?\)\))/g, '$1 $2');   // ((...\n...))

    // Also handle literal newline characters that might have been inserted
    mermaidCode = mermaidCode.replace(/(\[[^\]]*?)\n([^\]]*?\])/g, '$1 $2');
    mermaidCode = mermaidCode.replace(/(\{[^}]*?)\n([^}]*?\})/g, '$1 $2');
    mermaidCode = mermaidCode.replace(/(\([^)]*?)\n([^)]*?\))/g, '$1 $2');

    // Fix common flowchart syntax errors
    if (diagramType === 'flow') {
      // Fix incorrect arrow syntax: --> --> should be just -->
      mermaidCode = mermaidCode.replace(/-->\s*-->/g, '-->');

      // Fix missing spaces around arrows
      mermaidCode = mermaidCode.replace(/(\w)(-->)(\w)/g, '$1 --> $3');
      mermaidCode = mermaidCode.replace(/(\])(-->)/g, '$1 -->');
      mermaidCode = mermaidCode.replace(/(-->)(\[)/g, '--> $2');

      // Fix common typos: flowchar -> flowchart
      mermaidCode = mermaidCode.replace(/^flowchar\s/i, 'flowchart ');

      // Ensure flowchart has direction
      if (/^flowchart\s*$/m.test(mermaidCode)) {
        mermaidCode = mermaidCode.replace(/^flowchart\s*$/m, 'flowchart TD');
      }
    }

    // Fix common state diagram syntax errors
    if (diagramType === 'state') {
      // Ensure using v2 syntax
      mermaidCode = mermaidCode.replace(/^stateDiagram\s*$/m, 'stateDiagram-v2');

      // Fix state transitions without proper spacing
      mermaidCode = mermaidCode.replace(/(\w)(-->)(\w)/g, '$1 --> $3');
    }

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
  diagramType: MermaidDiagramType
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!code || code.length === 0) {
    errors.push('Empty mermaid code');
    return { errors, warnings };
  }

  // Check for diagram type declaration
  const firstLine = code.split('\n')[0].trim();
  const firstLineLower = firstLine.toLowerCase();

  // Expected declarations for each diagram type
  const expectedDeclarations: Record<MermaidDiagramType, string[]> = {
    sequence: ['sequencediagram'],
    flow: ['flowchart', 'graph'],
    state: ['statediagram'],
    class: ['classdiagram'],
    er: ['erdiagram'],
    gantt: ['gantt'],
    timeline: ['timeline'],
    pie: ['pie'],
    quadrant: ['quadrantchart'],
    xy: ['xychart'],
    sankey: ['sankey'],
    mindmap: ['mindmap'],
    c4: ['c4context', 'c4container', 'c4component', 'c4dynamic', 'c4deployment'],
    architecture: ['architecture'],
    'block-beta': ['block-beta'],
    journey: ['journey'],
    gitgraph: ['gitgraph'],
    requirement: ['requirementdiagram'],
    zenuml: ['zenuml'],
    kanban: ['kanban'],
    packet: ['packet'],
    radar: ['radar'],
    treemap: ['treemap'],
  };

  const expected = expectedDeclarations[diagramType];
  const hasValidDeclaration = expected?.some(decl => firstLineLower.startsWith(decl));

  if (!hasValidDeclaration) {
    // Check if it's a different Mermaid type (wrong type generated)
    const allDeclarations = Object.values(expectedDeclarations).flat();
    const detectedType = allDeclarations.find(decl => firstLineLower.startsWith(decl));

    if (detectedType) {
      errors.push(`Wrong diagram type: Expected ${diagramType} but received ${detectedType}. The AI generated the wrong diagram type.`);
    } else {
      warnings.push(`Missing ${diagramType} declaration, may not render correctly`);
    }
  }

  // Type-specific content validation
  switch (diagramType) {
    case 'sequence':
      if (!code.includes('->>') && !code.includes('-->>') && !code.includes('--)') && !code.includes('-->')) {
        warnings.push('No message arrows found in sequence diagram. Expected ->> or -->> syntax.');
      }
      break;
    case 'flow':
      if (!code.includes('-->') && !code.includes('-.->') && !code.includes('==>')) {
        warnings.push('No connections found in flowchart');
      }
      break;
    case 'state':
      if (!code.includes('-->') && !code.includes(':')) {
        warnings.push('No state transitions found');
      }
      break;
    case 'er':
      if (!code.includes('||') && !code.includes('|{') && !code.includes('}|')) {
        warnings.push('No relationship cardinality found in ER diagram');
      }
      break;
    case 'gantt':
      if (!code.includes('section') && !code.includes(':')) {
        warnings.push('No sections or tasks found in Gantt chart');
      }
      break;
    case 'journey':
      if (!code.includes('section') && !code.includes(':')) {
        warnings.push('No sections or tasks found in User Journey');
      }
      break;
    case 'gitgraph':
      if (!code.includes('commit') && !code.includes('branch')) {
        warnings.push('No commits or branches found in Git graph');
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
 * Handles raw AI responses that may include markdown code fences
 */
export function detectMermaidType(code: string): MermaidDiagramType | null {
  let cleanedCode = code.trim();

  // Strip markdown code fences if present (AI often wraps output in ```mermaid ... ```)
  // This is critical - without this, the first line would be "```mermaid" not the diagram type
  const codeBlockMatch = cleanedCode.match(/```(?:mermaid)?\s*\n([\s\S]*?)\n```/);
  if (codeBlockMatch) {
    cleanedCode = codeBlockMatch[1].trim();
  }

  // Also handle case where ``` is on same line as content or no closing fence
  if (cleanedCode.startsWith('```')) {
    // Remove opening fence (with or without 'mermaid' label)
    cleanedCode = cleanedCode.replace(/^```(?:mermaid)?\s*\n?/, '').trim();
    // Remove closing fence if present
    cleanedCode = cleanedCode.replace(/\n?```\s*$/, '').trim();
  }

  const firstLine = cleanedCode.split('\n')[0].toLowerCase().trim();

  // Core diagrams
  if (firstLine.startsWith('sequencediagram')) return 'sequence';
  if (firstLine.startsWith('flowchart') || firstLine.startsWith('graph')) return 'flow';
  if (firstLine.startsWith('statediagram')) return 'state';
  if (firstLine.startsWith('classdiagram')) return 'class';

  // Data & Relationships
  if (firstLine.startsWith('erdiagram')) return 'er';

  // Planning & Time
  if (firstLine.startsWith('gantt')) return 'gantt';
  if (firstLine.startsWith('timeline')) return 'timeline';

  // Analysis & Visualization
  if (firstLine.startsWith('pie')) return 'pie';
  if (firstLine.startsWith('quadrantchart')) return 'quadrant';
  if (firstLine.startsWith('xychart')) return 'xy';
  if (firstLine.startsWith('sankey')) return 'sankey';

  // Hierarchies & Concepts
  if (firstLine.startsWith('mindmap')) return 'mindmap';

  // Architecture
  if (firstLine.startsWith('c4context') || firstLine.startsWith('c4container') ||
      firstLine.startsWith('c4component') || firstLine.startsWith('c4dynamic') ||
      firstLine.startsWith('c4deployment')) return 'c4';
  if (firstLine.startsWith('architecture')) return 'architecture';
  if (firstLine.startsWith('block-beta')) return 'block-beta';

  // User Experience
  if (firstLine.startsWith('journey')) return 'journey';

  // Development
  if (firstLine.startsWith('gitgraph')) return 'gitgraph';
  if (firstLine.startsWith('requirementdiagram')) return 'requirement';
  if (firstLine.startsWith('zenuml')) return 'zenuml';

  // Project Management
  if (firstLine.startsWith('kanban')) return 'kanban';

  // Network
  if (firstLine.startsWith('packet')) return 'packet';

  // New in Mermaid v11+
  if (firstLine.startsWith('radar')) return 'radar';
  if (firstLine.startsWith('treemap')) return 'treemap';

  // Debug: Log what we're seeing if detection fails
  const knownTypes = /^(sequencediagram|flowchart|graph|statediagram|classdiagram|erdiagram|gantt|timeline|pie|quadrantchart|xychart|sankey|mindmap|c4|architecture|block-beta|journey|gitgraph|requirementdiagram|zenuml|kanban|packet|radar|treemap)/i;
  if (!firstLine.match(knownTypes)) {
    console.warn(`⚠️ detectMermaidType: Could not detect type. First line: "${firstLine.substring(0, 100)}"`);
    console.warn(`   Full response preview (first 300 chars): "${cleanedCode.substring(0, 300)}"`);
  }

  return null;
}

/**
 * Fix common Mermaid syntax issues
 */
export function fixMermaidSyntax(code: string, diagramType: MermaidDiagramType): string {
  let fixed = code.trim();

  // Ensure diagram type declaration
  const firstLine = fixed.split('\n')[0].trim().toLowerCase();

  // Map of diagram types to their declarations and detection patterns
  const diagramDeclarations: Record<MermaidDiagramType, { declaration: string; patterns: string[] }> = {
    // Core diagrams
    sequence: { declaration: 'sequenceDiagram', patterns: ['sequencediagram'] },
    flow: { declaration: 'flowchart TD', patterns: ['flowchart', 'graph'] },
    state: { declaration: 'stateDiagram-v2', patterns: ['statediagram'] },
    class: { declaration: 'classDiagram', patterns: ['classdiagram'] },
    // Data & Relationships
    er: { declaration: 'erDiagram', patterns: ['erdiagram'] },
    // Planning & Time
    gantt: { declaration: 'gantt', patterns: ['gantt'] },
    timeline: { declaration: 'timeline', patterns: ['timeline'] },
    // Analysis & Visualization
    pie: { declaration: 'pie', patterns: ['pie'] },
    quadrant: { declaration: 'quadrantChart', patterns: ['quadrantchart'] },
    xy: { declaration: 'xychart-beta', patterns: ['xychart'] },
    sankey: { declaration: 'sankey-beta', patterns: ['sankey'] },
    // Hierarchies & Concepts
    mindmap: { declaration: 'mindmap', patterns: ['mindmap'] },
    // Architecture
    c4: { declaration: 'C4Context', patterns: ['c4context', 'c4container', 'c4component', 'c4dynamic', 'c4deployment'] },
    architecture: { declaration: 'architecture-beta', patterns: ['architecture'] },
    'block-beta': { declaration: 'block-beta', patterns: ['block-beta'] },
    // User Experience
    journey: { declaration: 'journey', patterns: ['journey'] },
    // Development
    gitgraph: { declaration: 'gitGraph', patterns: ['gitgraph'] },
    requirement: { declaration: 'requirementDiagram', patterns: ['requirementdiagram'] },
    zenuml: { declaration: 'zenuml', patterns: ['zenuml'] },
    // Project Management
    kanban: { declaration: 'kanban', patterns: ['kanban'] },
    // Network
    packet: { declaration: 'packet-beta', patterns: ['packet'] },
    // New in Mermaid v11+
    radar: { declaration: 'radar-beta', patterns: ['radar'] },
    treemap: { declaration: 'treemap-beta', patterns: ['treemap'] },
  };

  const config = diagramDeclarations[diagramType];
  if (config) {
    const hasDeclaration = config.patterns.some(pattern => firstLine.startsWith(pattern));
    if (!hasDeclaration) {
      fixed = `${config.declaration}\n${fixed}`;
    }
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
