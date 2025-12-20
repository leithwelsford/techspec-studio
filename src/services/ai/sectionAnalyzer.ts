/**
 * AI-Powered Section Analyzer
 *
 * Intelligently analyzes technical specification sections to determine
 * which sections contain architecture or procedural content that should
 * generate diagrams, regardless of section numbering.
 */

import { parseMarkdownSections } from './prompts/refinementPrompts';
import type { SectionDiagramType, DiagramType } from '../../types';

export interface SectionAnalysis {
  sectionId: string;
  sectionTitle: string;
  content: string;
  diagramType: SectionDiagramType;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  figureReferences?: string[]; // {{fig:...}} placeholders found in this section
  isMandatory?: boolean; // true if section has explicit figure placeholders
  todoComments?: string[]; // TODO comments associated with figure placeholders
  /** Per-figure diagram types - maps figure reference ID to its specific diagram type */
  figureTypes?: Record<string, DiagramType>;
  /** Per-figure TODO comments - maps figure reference ID to its specific TODO */
  todosByFigure?: Record<string, string>;
}

/**
 * Analyze specification to find sections that should generate diagrams
 * Uses content-based heuristics and AI analysis
 */
export async function analyzeSectionsForDiagrams(
  specificationMarkdown: string,
  aiService: any
): Promise<SectionAnalysis[]> {
  console.log('🔍 Analyzing specification sections for diagram generation...');

  // First, scan the ENTIRE document for all {{fig:...}} placeholders
  const allFigureRefs = extractAllFigureReferences(specificationMarkdown);
  if (allFigureRefs.length > 0) {
    console.log(`📌 Found ${allFigureRefs.length} total figure placeholder(s) in document: ${allFigureRefs.join(', ')}`);
  }

  const sections = parseMarkdownSections(specificationMarkdown);
  const analyses: SectionAnalysis[] = [];

  // Filter to level 2 headings only (##) for major sections
  // Level 3 (###) is typically too granular for diagram generation
  const topLevelSections = sections.filter(s => {
    const depth = s.id.split('.').length;
    return depth === 1; // Only top-level sections (##)
  });

  console.log(`📊 Found ${topLevelSections.length} relevant sections to analyze`);

  // For each top-level section, aggregate content from all subsections
  for (const topSection of topLevelSections) {
    // Find all subsections that belong to this top-level section
    const subsections = sections.filter(s => {
      // Subsection if it starts with topSection.id followed by a dot
      // e.g., if topSection.id is "4", match "4.1", "4.2", "4.1.1", etc.
      return s.id.startsWith(topSection.id + '.') || s.id === topSection.id;
    });

    // Aggregate content from top section + all subsections
    const aggregatedContent = subsections
      .sort((a, b) => a.startIndex - b.startIndex) // Sort by position in document
      .map(s => s.content)
      .join('');

    console.log(`   Section ${topSection.id}: Aggregating ${subsections.length} subsections (${aggregatedContent.length} chars total)`);

    const analysis = await analyzeSectionContent(topSection.id, topSection.title, aggregatedContent, aiService);
    analyses.push(analysis);
  }

  // Log summary
  const mandatorySections = analyses.filter(a => a.isMandatory);
  const suggestedSections = analyses.filter(a => !a.isMandatory && a.diagramType !== 'none' && a.confidence !== 'low');
  const blockSections = analyses.filter(a => a.diagramType === 'block' || a.diagramType === 'multiple');
  const sequenceSections = analyses.filter(a => a.diagramType === 'sequence' || a.diagramType === 'multiple');
  const flowSections = analyses.filter(a => a.diagramType === 'flow' || a.diagramType === 'multiple');
  const stateSections = analyses.filter(a => a.diagramType === 'state' || a.diagramType === 'multiple');

  console.log('📋 Section Analysis Summary:');
  console.log(`  MANDATORY (with {{fig:...}} placeholders): ${mandatorySections.length} sections`);
  console.log(`  SUGGESTED (heuristic/AI detected): ${suggestedSections.length} sections`);
  console.log(`  ---`);
  console.log(`  Block diagrams: ${blockSections.length} sections`);
  console.log(`  Sequence diagrams: ${sequenceSections.length} sections`);
  console.log(`  Flow diagrams: ${flowSections.length} sections`);
  console.log(`  State diagrams: ${stateSections.length} sections`);
  console.log(`  Multiple types: ${analyses.filter(a => a.diagramType === 'multiple').length} sections`);
  console.log(`  No diagrams: ${analyses.filter(a => a.diagramType === 'none').length} sections`);

  // Log details of mandatory sections with per-figure types
  if (mandatorySections.length > 0) {
    console.log('\n📌 MANDATORY Diagram Sections (must generate):');
    mandatorySections.forEach(s => {
      console.log(`  - ${s.sectionId} "${s.sectionTitle}":`);
      if (s.figureTypes) {
        for (const [figRef, figType] of Object.entries(s.figureTypes)) {
          console.log(`      • ${figRef} → ${figType}`);
        }
      } else {
        console.log(`      • ${s.figureReferences?.join(', ')} → ${s.diagramType}`);
      }
    });
  }

  // Validate: ensure all document-level figure references were found in sections
  const foundRefs = new Set(mandatorySections.flatMap(s => s.figureReferences || []));
  const missingRefs = allFigureRefs.filter(ref => !foundRefs.has(ref));
  if (missingRefs.length > 0) {
    console.warn(`⚠️ WARNING: ${missingRefs.length} figure placeholder(s) not found in any section: ${missingRefs.join(', ')}`);
    console.warn('   These may be in the document header or outside of any ## section.');
  } else if (allFigureRefs.length > 0) {
    console.log(`✅ All ${allFigureRefs.length} figure placeholder(s) accounted for in sections.`);
  }

  return analyses;
}

/**
 * Extract ALL figure references ({{fig:...}}) from entire document
 * Used for upfront validation that all placeholders will be processed
 */
function extractAllFigureReferences(content: string): string[] {
  const figureRegex = /\{\{fig:([^}]+)\}\}/g;
  const matches = Array.from(content.matchAll(figureRegex));
  return matches.map(m => m[1]);
}

/**
 * Extract figure references ({{fig:...}}) from section content
 */
function extractFigureReferences(content: string): string[] {
  const figureRegex = /\{\{fig:([^}]+)\}\}/g;
  const matches = Array.from(content.matchAll(figureRegex));
  return matches.map(m => m[1]);
}

/**
 * Infer diagram type from figure placeholder names
 * e.g., {{fig:system-architecture}} suggests block diagram
 *       {{fig:call-flow}} suggests sequence diagram
 */
function inferDiagramTypeFromPlaceholders(figureRefs: string[]): DiagramType {
  const combinedRefs = figureRefs.join(' ').toLowerCase();

  // Check for sequence/call flow indicators
  if (/call[-_]?flow|sequence|signaling|message[-_]?flow|procedure/i.test(combinedRefs)) {
    return 'sequence';
  }

  // Check for state machine indicators
  if (/state[-_]?machine|state[-_]?diagram|fsm|state[-_]?transition/i.test(combinedRefs)) {
    return 'state';
  }

  // Check for flowchart indicators
  if (/flow[-_]?chart|decision[-_]?tree|algorithm|process[-_]?flow/i.test(combinedRefs)) {
    return 'flow';
  }

  // NEW: Check for ER diagram indicators
  if (/entity[-_]?relationship|er[-_]?diagram|data[-_]?model|schema/i.test(combinedRefs)) {
    return 'er';
  }

  // NEW: Check for Gantt chart indicators
  if (/gantt|timeline[-_]?chart|project[-_]?schedule|implementation[-_]?phase/i.test(combinedRefs)) {
    return 'gantt';
  }

  // NEW: Check for timeline indicators
  if (/timeline|milestone|evolution|history/i.test(combinedRefs)) {
    return 'timeline';
  }

  // NEW: Check for pie chart indicators
  if (/pie[-_]?chart|distribution|percentage|proportion/i.test(combinedRefs)) {
    return 'pie';
  }

  // NEW: Check for quadrant chart indicators
  if (/quadrant|priority[-_]?matrix|risk[-_]?matrix|bcg[-_]?matrix/i.test(combinedRefs)) {
    return 'quadrant';
  }

  // NEW: Check for mindmap indicators
  if (/mindmap|mind[-_]?map|concept[-_]?map|feature[-_]?breakdown/i.test(combinedRefs)) {
    return 'mindmap';
  }

  // NEW: Check for class diagram indicators
  if (/class[-_]?diagram|uml[-_]?class|inheritance|object[-_]?model/i.test(combinedRefs)) {
    return 'class';
  }

  // NEW: Check for C4 diagram indicators
  if (/c4[-_]?(context|container|component)|software[-_]?architecture/i.test(combinedRefs)) {
    return 'c4';
  }

  // Default to block diagram (architecture) - most common type
  return 'block';
}

/**
 * Infer diagram type from TODO comment content
 * Parses TODO comments for explicit type hints like "[BLOCK DIAGRAM]", "[SEQUENCE DIAGRAM]", etc.
 *
 * Priority order:
 * 1. Bracketed format: [BLOCK DIAGRAM], [SEQUENCE DIAGRAM], [FLOW DIAGRAM], [STATE DIAGRAM], etc.
 * 2. Natural language: "block diagram", "sequence diagram", "call flow", etc.
 */
function inferDiagramTypeFromTodo(todoComments: string[]): DiagramType | null {
  if (!todoComments || todoComments.length === 0) return null;

  const combinedTodos = todoComments.join(' ');
  console.log(`      🔍 Checking TODO text (${combinedTodos.length} chars): "${combinedTodos.substring(0, 80)}${combinedTodos.length > 80 ? '...' : ''}"`);

  // HIGHEST PRIORITY: Check for explicit bracketed format [DIAGRAM TYPE]
  // These are the preferred format from the prompt instructions
  if (/\[BLOCK\s+DIAGRAM\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests BLOCK diagram (bracketed format)`);
    return 'block';
  }
  if (/\[SEQUENCE\s+DIAGRAM\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests SEQUENCE diagram (bracketed format)`);
    return 'sequence';
  }
  if (/\[FLOW\s+DIAGRAM\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests FLOW diagram (bracketed format)`);
    return 'flow';
  }
  if (/\[STATE\s+DIAGRAM\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests STATE diagram (bracketed format)`);
    return 'state';
  }

  // NEW: Additional bracketed formats for expanded diagram types
  if (/\[CLASS\s+DIAGRAM\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests CLASS diagram (bracketed format)`);
    return 'class';
  }
  if (/\[ER\s+DIAGRAM\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests ER diagram (bracketed format)`);
    return 'er';
  }
  if (/\[GANTT\s+(CHART|DIAGRAM)\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests GANTT chart (bracketed format)`);
    return 'gantt';
  }
  if (/\[PIE\s+(CHART|DIAGRAM)\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests PIE chart (bracketed format)`);
    return 'pie';
  }
  if (/\[QUADRANT\s+(CHART|DIAGRAM)\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests QUADRANT chart (bracketed format)`);
    return 'quadrant';
  }
  if (/\[MINDMAP\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests MINDMAP (bracketed format)`);
    return 'mindmap';
  }
  if (/\[TIMELINE\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests TIMELINE (bracketed format)`);
    return 'timeline';
  }
  if (/\[C4\s+(DIAGRAM|CONTEXT|CONTAINER|COMPONENT)\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests C4 diagram (bracketed format)`);
    return 'c4';
  }

  // Additional bracketed formats for all 23 Mermaid diagram types
  if (/\[XY\s+(CHART|DIAGRAM)\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests XY chart (bracketed format)`);
    return 'xy';
  }
  if (/\[SANKEY\s*(DIAGRAM)?\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests SANKEY diagram (bracketed format)`);
    return 'sankey';
  }
  if (/\[USER\s+JOURNEY\]/i.test(combinedTodos) || /\[JOURNEY\s*(DIAGRAM)?\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests USER JOURNEY (bracketed format)`);
    return 'journey';
  }
  if (/\[GIT\s*(GRAPH|DIAGRAM)\]/i.test(combinedTodos) || /\[GITGRAPH\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests GIT GRAPH (bracketed format)`);
    return 'gitgraph';
  }
  if (/\[REQUIREMENT\s*(DIAGRAM)?\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests REQUIREMENT diagram (bracketed format)`);
    return 'requirement';
  }
  if (/\[ZENUML\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests ZENUML (bracketed format)`);
    return 'zenuml';
  }
  if (/\[KANBAN\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests KANBAN (bracketed format)`);
    return 'kanban';
  }
  if (/\[PACKET\s*(DIAGRAM)?\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests PACKET diagram (bracketed format)`);
    return 'packet';
  }
  if (/\[ARCHITECTURE\s*(DIAGRAM)?\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests ARCHITECTURE diagram (bracketed format)`);
    return 'architecture';
  }
  if (/\[MERMAID\s+BLOCK\]/i.test(combinedTodos) || /\[BLOCK[-\s]?BETA\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests BLOCK-BETA diagram (bracketed format)`);
    return 'block-beta';
  }
  if (/\[RADAR\s*(CHART|DIAGRAM)?\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests RADAR chart (bracketed format)`);
    return 'radar';
  }
  if (/\[TREEMAP\]/i.test(combinedTodos)) {
    console.log(`   📝 TODO explicitly requests TREEMAP (bracketed format)`);
    return 'treemap';
  }

  // LOWER PRIORITY: Natural language patterns (for legacy TODOs)
  const lowerTodos = combinedTodos.toLowerCase();

  // Sequence/call flow patterns
  if (/\b(sequence|call[-\s]?flow|message[-\s]?flow|signaling|protocol[-\s]?flow|procedure[-\s]?flow)\s*(diagram)?/i.test(lowerTodos)) {
    console.log(`   📝 TODO explicitly requests SEQUENCE diagram (natural language)`);
    return 'sequence';
  }

  // State diagram patterns - more comprehensive matching
  const statePatterns = [
    /\bstate\s+diagram\b/i,                    // "state diagram"
    /\bstate[-_]?machine\b/i,                  // "state machine", "state-machine", "state_machine"
    /\bfsm\b/i,                                // "FSM"
    /\bstate[-\s]?transition/i,                // "state transition", "state-transition"
    /\bmode[-\s]?transition/i,                 // "mode transition"
    /\bstate\s+model\b/i,                      // "state model"
    /\blifecycle\s+state/i,                    // "lifecycle state"
    /\bstates?\s+and\s+transitions?\b/i,       // "states and transitions"
    /\b(CAPTIVE|GRANTED|IDLE|ACTIVE)\s+(and\s+)?(CAPTIVE|GRANTED|IDLE|ACTIVE)/i  // Common state pairs
  ];

  for (const pattern of statePatterns) {
    if (pattern.test(lowerTodos)) {
      console.log(`   📝 TODO explicitly requests STATE diagram (matched: ${pattern.source})`);
      return 'state';
    }
  }

  // Flowchart patterns
  if (/\b(flow[-\s]?chart|decision[-\s]?(tree|diagram)|algorithm[-\s]?flow|process[-\s]?flow)\b/i.test(lowerTodos)) {
    console.log(`   📝 TODO explicitly requests FLOW diagram (natural language)`);
    return 'flow';
  }

  // Block/architecture patterns
  if (/\b(block[-\s]?diagram|architecture[-\s]?(diagram)?|component[-\s]?(diagram)?|system[-\s]?diagram|network[-\s]?diagram|topology)\b/i.test(lowerTodos)) {
    console.log(`   📝 TODO explicitly requests BLOCK diagram (natural language)`);
    return 'block';
  }

  // NEW: Natural language patterns for additional diagram types
  if (/\b(class[-\s]?diagram|uml[-\s]?class|inheritance|object[-\s]?model)\b/i.test(lowerTodos)) {
    console.log(`   📝 TODO explicitly requests CLASS diagram (natural language)`);
    return 'class';
  }
  if (/\b(er[-\s]?diagram|entity[-\s]?relationship|data[-\s]?model|database[-\s]?schema)\b/i.test(lowerTodos)) {
    console.log(`   📝 TODO explicitly requests ER diagram (natural language)`);
    return 'er';
  }
  if (/\b(gantt|project[-\s]?timeline|implementation[-\s]?schedule)\b/i.test(lowerTodos)) {
    console.log(`   📝 TODO explicitly requests GANTT chart (natural language)`);
    return 'gantt';
  }
  if (/\b(pie[-\s]?chart|percentage[-\s]?distribution|proportional)\b/i.test(lowerTodos)) {
    console.log(`   📝 TODO explicitly requests PIE chart (natural language)`);
    return 'pie';
  }
  if (/\b(quadrant[-\s]?chart|priority[-\s]?matrix|risk[-\s]?matrix|bcg[-\s]?matrix)\b/i.test(lowerTodos)) {
    console.log(`   📝 TODO explicitly requests QUADRANT chart (natural language)`);
    return 'quadrant';
  }
  if (/\b(mind[-\s]?map|concept[-\s]?hierarchy|feature[-\s]?breakdown)\b/i.test(lowerTodos)) {
    console.log(`   📝 TODO explicitly requests MINDMAP (natural language)`);
    return 'mindmap';
  }
  if (/\b(timeline|sequential[-\s]?events|milestones)\b/i.test(lowerTodos)) {
    console.log(`   📝 TODO explicitly requests TIMELINE (natural language)`);
    return 'timeline';
  }
  if (/\b(c4[-\s]?(context|container|component)|software[-\s]?architecture[-\s]?diagram)\b/i.test(lowerTodos)) {
    console.log(`   📝 TODO explicitly requests C4 diagram (natural language)`);
    return 'c4';
  }

  // Additional natural language patterns for all 23 Mermaid types
  if (/\b(xy[-\s]?chart|scatter[-\s]?plot|line[-\s]?chart|bar[-\s]?chart)\b/i.test(lowerTodos)) {
    console.log(`   📝 TODO explicitly requests XY chart (natural language)`);
    return 'xy';
  }
  if (/\b(sankey|flow[-\s]?distribution|energy[-\s]?flow)\b/i.test(lowerTodos)) {
    console.log(`   📝 TODO explicitly requests SANKEY diagram (natural language)`);
    return 'sankey';
  }
  if (/\b(user[-\s]?journey|customer[-\s]?journey|experience[-\s]?map)\b/i.test(lowerTodos)) {
    console.log(`   📝 TODO explicitly requests USER JOURNEY (natural language)`);
    return 'journey';
  }
  if (/\b(git[-\s]?graph|commit[-\s]?history|branch[-\s]?diagram|version[-\s]?control)\b/i.test(lowerTodos)) {
    console.log(`   📝 TODO explicitly requests GIT GRAPH (natural language)`);
    return 'gitgraph';
  }
  if (/\b(requirement[-\s]?diagram|requirements[-\s]?trace|sysml[-\s]?requirement)\b/i.test(lowerTodos)) {
    console.log(`   📝 TODO explicitly requests REQUIREMENT diagram (natural language)`);
    return 'requirement';
  }
  if (/\b(kanban|task[-\s]?board|sprint[-\s]?board|agile[-\s]?board)\b/i.test(lowerTodos)) {
    console.log(`   📝 TODO explicitly requests KANBAN (natural language)`);
    return 'kanban';
  }
  if (/\b(packet[-\s]?diagram|network[-\s]?packet|protocol[-\s]?packet)\b/i.test(lowerTodos)) {
    console.log(`   📝 TODO explicitly requests PACKET diagram (natural language)`);
    return 'packet';
  }
  if (/\b(radar[-\s]?chart|spider[-\s]?chart|competency[-\s]?chart)\b/i.test(lowerTodos)) {
    console.log(`   📝 TODO explicitly requests RADAR chart (natural language)`);
    return 'radar';
  }
  if (/\b(treemap|hierarchical[-\s]?area|space[-\s]?filling)\b/i.test(lowerTodos)) {
    console.log(`   📝 TODO explicitly requests TREEMAP (natural language)`);
    return 'treemap';
  }

  console.log(`      ⚠️ No diagram type pattern matched in TODO text`);
  return null; // No explicit type found
}

/**
 * Extract TODO comments associated with figure placeholders
 * Returns both a flat array (for backwards compatibility) and a map of figureRef → TODO
 */
interface TodoExtractionResult {
  todos: string[];  // Flat array of all TODOs
  todosByFigure: Record<string, string>;  // Map of figure reference ID to its TODO
}

function extractTodoComments(content: string): TodoExtractionResult {
  const todos: string[] = [];
  const todosByFigure: Record<string, string> = {};
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line contains a {{fig:...}} placeholder
    const figMatch = line.match(/\{\{fig:([^}]+)\}\}/);
    if (figMatch) {
      const figureRef = figMatch[1];

      // Look for TODO comment on same line or next 2 lines
      for (let j = i; j <= Math.min(i + 2, lines.length - 1); j++) {
        const todoMatch = lines[j].match(/<!--\s*TODO:\s*(.+?)\s*-->/);
        if (todoMatch) {
          const todoText = todoMatch[1].trim();
          todos.push(todoText);
          todosByFigure[figureRef] = todoText;
          break; // Only take first TODO after this figure
        }
      }
    }
  }

  return { todos, todosByFigure };
}

/**
 * Analyze a single section to determine if it should generate diagrams
 */
async function analyzeSectionContent(
  sectionId: string,
  sectionTitle: string,
  content: string,
  aiService: any
): Promise<SectionAnalysis> {
  // FIRST: Check for explicit figure references ({{fig:...}})
  const figureReferences = extractFigureReferences(content);
  const { todos: todoComments, todosByFigure } = extractTodoComments(content);

  if (figureReferences.length > 0) {
    console.log(`📌 ${sectionId} ${sectionTitle}: MANDATORY - Found ${figureReferences.length} figure placeholder(s): ${figureReferences.join(', ')}`);
    if (todoComments.length > 0) {
      console.log(`   📝 TODO instructions found: ${todoComments.length} comment(s)`);
      todoComments.forEach((todo, idx) => {
        console.log(`      ${idx + 1}. ${todo.substring(0, 100)}${todo.length > 100 ? '...' : ''}`);
      });
    }

    // Run heuristic analysis for overall section type (used as fallback)
    const heuristic = analyzeWithHeuristics(sectionId, sectionTitle, content);

    // Determine diagram type PER FIGURE REFERENCE
    // This allows different figures in the same section to have different types
    const figureTypes: Record<string, DiagramType> = {};
    // Initialize typeBreakdown with all supported diagram types (23 Mermaid types + 1 custom block)
    const typeBreakdown: Record<DiagramType, string[]> = {
      // Custom block diagram (our JSON format)
      block: [],
      // Core Mermaid diagrams
      sequence: [], flow: [], state: [], class: [],
      // Data & Relationships
      er: [],
      // Planning & Time
      gantt: [], timeline: [],
      // Analysis & Visualization
      pie: [], quadrant: [], xy: [], sankey: [],
      // Hierarchies & Concepts
      mindmap: [],
      // Architecture
      c4: [], architecture: [], 'block-beta': [],
      // User Experience
      journey: [],
      // Development
      gitgraph: [], requirement: [], zenuml: [],
      // Project Management
      kanban: [],
      // Network
      packet: [],
      // New in Mermaid v11+
      radar: [], treemap: []
    };

    for (const figRef of figureReferences) {
      const figTodo = todosByFigure[figRef];
      let figType: DiagramType;
      let figTypeSource: string;

      if (figTodo) {
        // Check this specific TODO for diagram type
        const todoType = inferDiagramTypeFromTodo([figTodo]);
        if (todoType) {
          figType = todoType;
          figTypeSource = 'TODO comment';
        } else if (heuristic.diagramType !== 'none' && heuristic.diagramType !== 'multiple') {
          figType = heuristic.diagramType as DiagramType;
          figTypeSource = 'heuristic (TODO had no type hint)';
        } else {
          figType = inferDiagramTypeFromPlaceholders([figRef]);
          figTypeSource = 'figure name';
        }
      } else {
        // No TODO for this figure - use heuristic or placeholder name
        if (heuristic.diagramType !== 'none' && heuristic.diagramType !== 'multiple') {
          figType = heuristic.diagramType as DiagramType;
          figTypeSource = 'heuristic';
        } else {
          figType = inferDiagramTypeFromPlaceholders([figRef]);
          figTypeSource = 'figure name';
        }
      }

      figureTypes[figRef] = figType;
      typeBreakdown[figType].push(figRef);
      console.log(`   📊 ${figRef}: '${figType}' (source: ${figTypeSource})`);
    }

    // Determine overall section diagram type from the per-figure types
    const typesFound = Object.entries(typeBreakdown)
      .filter(([_, refs]) => refs.length > 0)
      .map(([type]) => type);

    let diagramType: SectionDiagramType;
    if (typesFound.length > 1) {
      diagramType = 'multiple';
      console.log(`   📊 Section has MULTIPLE diagram types: ${typesFound.join(', ')}`);
    } else if (typesFound.length === 1) {
      diagramType = typesFound[0] as DiagramType;
    } else {
      diagramType = 'block'; // Default fallback
    }

    return {
      ...heuristic,
      diagramType,
      figureReferences,
      figureTypes, // NEW: Per-figure diagram types
      todoComments: todoComments.length > 0 ? todoComments : undefined,
      todosByFigure: Object.keys(todosByFigure).length > 0 ? todosByFigure : undefined,
      isMandatory: true,
      confidence: 'high',
      reasoning: `MANDATORY: Contains ${figureReferences.length} figure placeholder(s): ${figureReferences.join(', ')}. Types: ${typesFound.join(', ')}`
    };
  }

  // SECOND: Heuristic-based analysis for suggested diagrams (fast)
  const heuristic = analyzeWithHeuristics(sectionId, sectionTitle, content);

  // If heuristic is confident, use it
  if (heuristic.confidence === 'high') {
    console.log(`✅ ${sectionId} ${sectionTitle}: ${heuristic.diagramType} (suggested - heuristic)`);
    return { ...heuristic, isMandatory: false };
  }

  // THIRD: Use AI for deeper analysis (slower but more accurate)
  try {
    const aiAnalysis = await analyzeWithAI(sectionId, sectionTitle, content, aiService);
    console.log(`🤖 ${sectionId} ${sectionTitle}: ${aiAnalysis.diagramType} (suggested - AI analysis)`);
    return { ...aiAnalysis, isMandatory: false };
  } catch (error) {
    console.warn(`⚠️ AI analysis failed for ${sectionId}, using heuristic`);
    return { ...heuristic, isMandatory: false };
  }
}

/**
 * Fast heuristic-based analysis using keywords and patterns
 */
function analyzeWithHeuristics(
  sectionId: string,
  sectionTitle: string,
  content: string
): SectionAnalysis {
  const lowerTitle = sectionTitle.toLowerCase();
  const lowerContent = content.toLowerCase();

  // Strong architecture indicators
  const architectureKeywords = [
    'architecture', 'component', 'interface', 'topology', 'network element',
    'deployment', 'reference point', 'functional element', 'node', 'entity'
  ];

  // Strong procedure indicators (sequence diagrams)
  const procedureKeywords = [
    'procedure', 'call flow', 'message', 'sequence', 'step', 'signaling',
    'protocol', 'handshake', 'request', 'response', 'session establishment'
  ];

  // Flow diagram indicators (decision trees, algorithms)
  const flowKeywords = [
    'algorithm', 'decision', 'flow chart', 'flowchart', 'process flow',
    'if-then', 'condition', 'branch', 'logic flow', 'workflow'
  ];

  // State machine indicators
  const stateKeywords = [
    'state machine', 'state diagram', 'state transition', 'fsm',
    'state model', 'mode', 'status', 'transition', 'state change'
  ];

  // Check keywords in title (stronger signal)
  const hasTitleArchKeywords = architectureKeywords.some(kw => lowerTitle.includes(kw));
  const hasTitleProcKeywords = procedureKeywords.some(kw => lowerTitle.includes(kw));
  const hasTitleFlowKeywords = flowKeywords.some(kw => lowerTitle.includes(kw));
  const hasTitleStateKeywords = stateKeywords.some(kw => lowerTitle.includes(kw));

  // Check keywords in content (weaker signal, needs confirmation)
  const hasContentArchKeywords = architectureKeywords.some(kw => lowerContent.includes(kw));
  const hasContentProcKeywords = procedureKeywords.some(kw => lowerContent.includes(kw));
  const hasContentFlowKeywords = flowKeywords.some(kw => lowerContent.includes(kw));
  const hasContentStateKeywords = stateKeywords.some(kw => lowerContent.includes(kw));

  // Check for numbered lists (often indicate procedures or flows)
  const hasNumberedSteps = /\n\s*\d+\.\s+/.test(content);

  // Combined signals (require BOTH title AND content keywords for high confidence)
  // Title keywords alone are not enough - content must also support it
  const hasArchKeywords = hasTitleArchKeywords && hasContentArchKeywords;
  const hasProcKeywords = hasTitleProcKeywords && hasContentProcKeywords;
  const hasFlowKeywords = hasTitleFlowKeywords && hasContentFlowKeywords;
  const hasStateKeywords = hasTitleStateKeywords && hasContentStateKeywords;

  // STRICTER: Only allow content-only detection for VERY STRONG indicators
  // This prevents false positives where sections mention architecture/procedures but aren't diagram-worthy
  const hasStrongArchContent = hasTitleArchKeywords && hasContentArchKeywords &&
    (lowerContent.match(/component|interface|node|entity/g) || []).length >= 5; // Raised threshold from 3 to 5

  // Allow content-only detection for procedures if MULTIPLE procedure keywords + numbered steps
  // OR if title has procedure keywords + content keywords + numbered steps
  const procedureKeywordCount = procedureKeywords.filter(kw => lowerContent.includes(kw)).length;
  const hasStrongProcContent = (procedureKeywordCount >= 3 && hasNumberedSteps) || // Multiple keywords + steps
                                 (hasTitleProcKeywords && hasContentProcKeywords && hasNumberedSteps); // Title + content + steps

  // Determine diagram type
  let diagramType: 'block' | 'sequence' | 'flow' | 'state' | 'multiple' | 'none';
  let confidence: 'high' | 'medium' | 'low';
  let reasoning: string;

  // Count how many diagram types are indicated (with stricter checks)
  const indicators = {
    architecture: hasArchKeywords || hasStrongArchContent,
    procedure: hasProcKeywords || hasStrongProcContent,
    flow: hasFlowKeywords, // STRICTER: Require both title AND content keywords
    state: hasStateKeywords
  };

  const indicatorCount = Object.values(indicators).filter(Boolean).length;

  if (indicatorCount > 1) {
    // Multiple diagram types detected
    diagramType = 'multiple';
    confidence = hasTitleArchKeywords || hasTitleProcKeywords || hasTitleFlowKeywords || hasTitleStateKeywords ? 'high' : 'medium';
    const types = Object.entries(indicators)
      .filter(([_, present]) => present)
      .map(([type]) => type);
    reasoning = `Multiple diagram types detected: ${types.join(', ')}`;
  } else if (hasStateKeywords) {
    diagramType = 'state';
    confidence = hasTitleStateKeywords ? 'high' : 'medium';
    reasoning = 'Contains state machine keywords: states, transitions, modes';
  } else if (hasFlowKeywords) {
    diagramType = 'flow';
    confidence = hasTitleFlowKeywords ? 'high' : 'medium';
    reasoning = 'Contains flowchart indicators in title and content: decision logic, conditional branches';
  } else if (hasArchKeywords || hasStrongArchContent) {
    diagramType = 'block';
    confidence = hasTitleArchKeywords ? 'high' : 'medium';
    reasoning = hasStrongArchContent
      ? 'Contains multiple architecture components (3+): components, interfaces, topology'
      : 'Contains architecture keywords in title and content: components, interfaces, topology';
  } else if (hasProcKeywords || hasStrongProcContent) {
    diagramType = 'sequence';
    confidence = hasTitleProcKeywords ? 'high' : 'medium';
    reasoning = hasStrongProcContent
      ? 'Contains procedure keywords with numbered steps'
      : 'Contains procedure keywords in title and content';
  } else if (lowerTitle.includes('definition') || lowerTitle.includes('abbreviation') ||
             lowerTitle.includes('reference') || lowerTitle.includes('scope') ||
             lowerTitle.includes('error code') || lowerTitle.includes('error message')) {
    diagramType = 'none';
    confidence = 'high';
    reasoning = 'Informational section (definitions, references, scope, error codes)';
  } else {
    // Low confidence - will trigger AI analysis
    diagramType = 'none';
    confidence = 'low';
    reasoning = 'No clear indicators found - will use AI analysis';
  }

  return {
    sectionId,
    sectionTitle,
    content,
    diagramType,
    confidence,
    reasoning
  };
}

/**
 * AI-based analysis for ambiguous sections
 */
async function analyzeWithAI(
  sectionId: string,
  sectionTitle: string,
  content: string,
  aiService: any
): Promise<SectionAnalysis> {
  // Truncate content to first 2000 chars to save tokens
  const truncatedContent = content.substring(0, 2000);

  const prompt = `Analyze this technical specification section and determine what type of diagram(s) it should generate.

Section: ${sectionId} - ${sectionTitle}

Content (first 2000 chars):
${truncatedContent}

Respond in JSON format:
{
  "diagramType": "block" | "sequence" | "flow" | "state" | "multiple" | "none",
  "confidence": "high" | "medium" | "low",
  "reasoning": "brief explanation"
}

Diagram Type Rules:
- "block": Architecture content (components, interfaces, network topology, deployment, system structure)
- "sequence": Procedure content (call flows, message exchanges, protocol interactions, step-by-step communications)
- "flow": Flowchart content (algorithms, decision trees, conditional logic, process workflows)
- "state": State machine content (state transitions, modes, status changes, FSM behavior)
- "multiple": Section needs multiple diagram types (e.g., architecture + state machine)
- "none": Informational only (definitions, references, scope, abbreviations, terminology)

Consider:
- Telecom/networking domain context
- 3GPP technical specification style
- Presence of actors, components, states, conditions, or decision points`;

  const response = await aiService.chat(prompt, [], {});

  try {
    const result = JSON.parse(response.content);
    return {
      sectionId,
      sectionTitle,
      content,
      diagramType: result.diagramType,
      confidence: result.confidence,
      reasoning: result.reasoning
    };
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    throw error;
  }
}

/**
 * Get sections with mandatory diagrams (have {{fig:...}} placeholders)
 */
export function getMandatorySections(analyses: SectionAnalysis[]): SectionAnalysis[] {
  return analyses.filter(a => a.isMandatory);
}

/**
 * Get sections with suggested diagrams (heuristic/AI detected, no placeholders)
 */
export function getSuggestedSections(analyses: SectionAnalysis[]): SectionAnalysis[] {
  return analyses.filter(a =>
    !a.isMandatory &&
    a.diagramType !== 'none' &&
    a.confidence !== 'low'
  );
}

/**
 * Helper to check if a section has figures of a specific type
 * Uses figureTypes map for precise per-figure type checking, falls back to diagramType
 *
 * IMPORTANT: For 'multiple' sections WITHOUT a figureTypes map, we default to Mermaid
 * (let AI decide the exact type) rather than treating them as block diagrams.
 * This prevents double-counting where 'multiple' sections were being added to
 * both blockSections AND mermaidSections.
 */
function sectionHasFiguresOfType(
  section: SectionAnalysis,
  targetType: DiagramType
): boolean {
  // If we have per-figure types, check if ANY figure matches the target type
  if (section.figureTypes) {
    return Object.values(section.figureTypes).some(type => type === targetType);
  }
  // Fallback: check section-level diagramType
  // NOTE: 'multiple' without figureTypes defaults to Mermaid, NOT block
  // This prevents double-counting across block and mermaid sections
  return section.diagramType === targetType;
}

/**
 * Get figure references of a specific type from a section
 * Returns only the figure IDs that match the requested type
 *
 * IMPORTANT: For 'multiple' sections WITHOUT a figureTypes map, returns empty
 * for specific type queries. Use getMermaidFigureRefs() for 'multiple' sections
 * which defaults to treating them as Mermaid diagrams.
 */
export function getFigureRefsOfType(
  section: SectionAnalysis,
  targetType: DiagramType
): string[] {
  if (!section.figureReferences) return [];

  // If we have per-figure types, filter to only matching figures
  if (section.figureTypes) {
    return section.figureReferences.filter(ref => section.figureTypes![ref] === targetType);
  }

  // Fallback: only return figures if section type EXACTLY matches
  // NOTE: 'multiple' without figureTypes defaults to Mermaid (via getMermaidFigureRefs)
  // This prevents double-counting across block and mermaid sections
  if (section.diagramType === targetType) {
    return section.figureReferences;
  }

  return [];
}

/**
 * Get sections that should generate block diagrams
 * @param mandatoryOnly - If true, only return sections with {{fig:...}} placeholders
 */
export function getBlockDiagramSections(analyses: SectionAnalysis[], mandatoryOnly: boolean = false): SectionAnalysis[] {
  return analyses.filter(a =>
    sectionHasFiguresOfType(a, 'block') &&
    a.confidence !== 'low' &&
    (!mandatoryOnly || a.isMandatory)
  );
}

/**
 * Get sections that should generate sequence diagrams
 * @param mandatoryOnly - If true, only return sections with {{fig:...}} placeholders
 */
export function getSequenceDiagramSections(analyses: SectionAnalysis[], mandatoryOnly: boolean = false): SectionAnalysis[] {
  return analyses.filter(a =>
    sectionHasFiguresOfType(a, 'sequence') &&
    a.confidence !== 'low' &&
    (!mandatoryOnly || a.isMandatory)
  );
}

/**
 * Get sections that should generate flow diagrams
 * @param mandatoryOnly - If true, only return sections with {{fig:...}} placeholders
 */
export function getFlowDiagramSections(analyses: SectionAnalysis[], mandatoryOnly: boolean = false): SectionAnalysis[] {
  return analyses.filter(a =>
    sectionHasFiguresOfType(a, 'flow') &&
    a.confidence !== 'low' &&
    (!mandatoryOnly || a.isMandatory)
  );
}

/**
 * Get sections that should generate state diagrams
 * @param mandatoryOnly - If true, only return sections with {{fig:...}} placeholders
 */
export function getStateDiagramSections(analyses: SectionAnalysis[], mandatoryOnly: boolean = false): SectionAnalysis[] {
  return analyses.filter(a =>
    sectionHasFiguresOfType(a, 'state') &&
    a.confidence !== 'low' &&
    (!mandatoryOnly || a.isMandatory)
  );
}

/**
 * Get all sections that should generate Mermaid diagrams (any Mermaid type)
 * This is the PREFERRED approach - let AI decide the exact type based on TODO/content
 * instead of relying on complex pattern matching for type detection.
 * @param mandatoryOnly - If true, only return sections with {{fig:...}} placeholders
 */
export function getMermaidDiagramSections(analyses: SectionAnalysis[], mandatoryOnly: boolean = false): SectionAnalysis[] {
  // All Mermaid diagram types (everything except 'block')
  const mermaidTypes: SectionDiagramType[] = [
    'sequence', 'flow', 'state', 'class', 'er', 'gantt', 'pie',
    'quadrant', 'mindmap', 'timeline', 'c4', 'multiple'
  ];

  return analyses.filter(a =>
    // Include any section with non-block diagram type
    mermaidTypes.includes(a.diagramType) &&
    a.confidence !== 'low' &&
    (!mandatoryOnly || a.isMandatory)
  );
}

/**
 * Get all figure references from a section that are NOT block diagrams
 * These will be generated using the unified Mermaid prompt
 */
export function getMermaidFigureRefs(section: SectionAnalysis): string[] {
  if (!section.figureReferences) return [];

  // All Mermaid diagram types (everything except 'block')
  const mermaidTypes: DiagramType[] = [
    'sequence', 'flow', 'state', 'class', 'er', 'gantt', 'pie',
    'quadrant', 'mindmap', 'timeline', 'c4'
  ];

  if (section.figureTypes) {
    // Return figures that are NOT block diagrams (i.e., are Mermaid types)
    return section.figureReferences.filter(ref => {
      const type = section.figureTypes![ref];
      return type !== 'block'; // Everything except 'block' is Mermaid
    });
  }

  // Fallback: if section is a mermaid type, return all figures
  if (mermaidTypes.includes(section.diagramType as DiagramType) ||
      section.diagramType === 'multiple') {
    return section.figureReferences;
  }

  return [];
}
