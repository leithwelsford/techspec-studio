/**
 * AI-Powered Section Analyzer
 *
 * Intelligently analyzes technical specification sections to determine
 * which sections contain architecture or procedural content that should
 * generate diagrams, regardless of section numbering.
 */

import { parseMarkdownSections } from './prompts/refinementPrompts';

export interface SectionAnalysis {
  sectionId: string;
  sectionTitle: string;
  content: string;
  diagramType: 'block' | 'sequence' | 'flow' | 'state' | 'multiple' | 'none';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  figureReferences?: string[]; // {{fig:...}} placeholders found in this section
  isMandatory?: boolean; // true if section has explicit figure placeholders
  todoComments?: string[]; // TODO comments associated with figure placeholders
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

  // Log details of mandatory sections
  if (mandatorySections.length > 0) {
    console.log('\n📌 MANDATORY Diagram Sections (must generate):');
    mandatorySections.forEach(s => {
      console.log(`  - ${s.sectionId} "${s.sectionTitle}": ${s.figureReferences?.join(', ')}`);
    });
  }

  return analyses;
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
 * Extract TODO comments associated with figure placeholders
 * Looks for HTML comments (<!-- TODO: ... -->) that appear on the same line or within 2 lines after {{fig:...}}
 */
function extractTodoComments(content: string): string[] {
  const todos: string[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line contains a {{fig:...}} placeholder
    if (/\{\{fig:[^}]+\}\}/.test(line)) {
      // Look for TODO comment on same line or next 2 lines
      for (let j = i; j <= Math.min(i + 2, lines.length - 1); j++) {
        const todoMatch = lines[j].match(/<!--\s*TODO:\s*(.+?)\s*-->/);
        if (todoMatch) {
          todos.push(todoMatch[1].trim());
          break; // Only take first TODO after this figure
        }
      }
    }
  }

  return todos;
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
  const todoComments = extractTodoComments(content);

  if (figureReferences.length > 0) {
    console.log(`📌 ${sectionId} ${sectionTitle}: MANDATORY - Found ${figureReferences.length} figure placeholder(s): ${figureReferences.join(', ')}`);
    if (todoComments.length > 0) {
      console.log(`   📝 TODO instructions found: ${todoComments.length} comment(s)`);
      todoComments.forEach((todo, idx) => {
        console.log(`      ${idx + 1}. ${todo.substring(0, 100)}${todo.length > 100 ? '...' : ''}`);
      });
    }

    // Determine diagram type from content (even if we have placeholders, we need to know what type)
    const heuristic = analyzeWithHeuristics(sectionId, sectionTitle, content);

    return {
      ...heuristic,
      figureReferences,
      todoComments: todoComments.length > 0 ? todoComments : undefined,
      isMandatory: true,
      confidence: 'high', // Override confidence - this is mandatory
      reasoning: `MANDATORY: Contains ${figureReferences.length} figure placeholder(s): ${figureReferences.join(', ')}. ${heuristic.reasoning}`
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

  // Check for conditional patterns (if/then/else)
  const hasConditionals = /\b(if|when|otherwise|else|in case)\b/gi.test(content);

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
 * Get sections that should generate block diagrams
 */
export function getBlockDiagramSections(analyses: SectionAnalysis[]): SectionAnalysis[] {
  return analyses.filter(a =>
    (a.diagramType === 'block' || a.diagramType === 'multiple') &&
    a.confidence !== 'low'
  );
}

/**
 * Get sections that should generate sequence diagrams
 */
export function getSequenceDiagramSections(analyses: SectionAnalysis[]): SectionAnalysis[] {
  return analyses.filter(a =>
    (a.diagramType === 'sequence' || a.diagramType === 'multiple') &&
    a.confidence !== 'low'
  );
}

/**
 * Get sections that should generate flow diagrams
 */
export function getFlowDiagramSections(analyses: SectionAnalysis[]): SectionAnalysis[] {
  return analyses.filter(a =>
    (a.diagramType === 'flow' || a.diagramType === 'multiple') &&
    a.confidence !== 'low'
  );
}

/**
 * Get sections that should generate state diagrams
 */
export function getStateDiagramSections(analyses: SectionAnalysis[]): SectionAnalysis[] {
  return analyses.filter(a =>
    (a.diagramType === 'state' || a.diagramType === 'multiple') &&
    a.confidence !== 'low'
  );
}
