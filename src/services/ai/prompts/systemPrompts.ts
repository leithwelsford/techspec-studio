/**
 * System Prompts for AI Co-Pilot
 * Base instructions that define the AI's role and capabilities
 *
 * UPDATED: Now supports domain-agnostic prompts via DomainConfig
 */

import type { DiagramReference, ReferenceDocument, DomainConfig } from '../../../types';

export interface SystemPromptContext {
  projectName?: string;
  documentTitle?: string;
  currentDocument?: string;
  availableDiagrams?: DiagramReference[];
  availableReferences?: ReferenceDocument[];
  userInstructions?: string;
  domainConfig?: DomainConfig;  // NEW: Domain configuration for adaptive prompts
}

/**
 * Build normative language section based on domain configuration
 */
function buildNormativeLanguageSection(domainConfig?: DomainConfig): string {
  const style = domainConfig?.normativeLanguage;
  const custom = domainConfig?.customNormativeTerms;

  if (custom) {
    return `
Normative Language:
- ${custom.shall}: Mandatory requirement
- ${custom.should}: Recommended but not mandatory
- ${custom.may}: Optional, implementer's choice`;
  }

  switch (style) {
    case 'IEEE':
      return `
Normative Language (IEEE Style):
- shall: Mandatory requirement
- shall not: Prohibited action
- should: Recommended but not mandatory
- may: Optional, implementer's choice`;

    case 'ISO':
      return `
Normative Language (ISO Style):
- Must: Mandatory requirement
- Must not: Prohibited action
- Should: Recommended but not mandatory
- May: Optional, implementer's choice`;

    case 'RFC2119':
    default:
      return `
Normative Language (RFC 2119):
- SHALL/MUST: Mandatory requirement
- SHALL NOT/MUST NOT: Prohibited action
- SHOULD/RECOMMENDED: Strongly encouraged but not mandatory
- SHOULD NOT/NOT RECOMMENDED: Discouraged but not prohibited
- MAY/OPTIONAL: Truly optional, implementer's choice`;
  }
}

/**
 * Build domain expertise section
 */
function buildDomainExpertiseSection(domainConfig?: DomainConfig): string {
  // No domain config = general technical writing
  if (!domainConfig?.domain) {
    return `You are an expert technical specification writer.

Your expertise spans multiple technical domains. Adapt your writing style, terminology,
and level of detail based on the subject matter provided in the requirements.`;
  }

  const { domain, industry, standards, terminology } = domainConfig;

  let expertise = `You are an expert technical specification writer specializing in **${domain}**`;

  if (industry) {
    expertise += ` with focus on **${industry}**`;
  }
  expertise += '.';

  if (standards && standards.length > 0) {
    expertise += `\n\nRelevant Standards: ${standards.join(', ')}`;
    expertise += `\nEnsure alignment with these standards where applicable.`;
  }

  if (terminology && Object.keys(terminology).length > 0) {
    expertise += `\n\nKey Terminology:`;
    for (const [term, definition] of Object.entries(terminology)) {
      expertise += `\n- ${term}: ${definition}`;
    }
  }

  return expertise;
}

/**
 * Base system prompt for technical specification writing
 *
 * UPDATED: Now domain-agnostic by default. Pass domainConfig to specialize.
 *
 * @param context - Context including project info, diagrams, references, and optional domain config
 * @returns System prompt string
 */
export function buildSystemPrompt(context: SystemPromptContext = {}): string {
  const {
    projectName,
    documentTitle,
    currentDocument,
    availableDiagrams = [],
    availableReferences = [],
    userInstructions,
    domainConfig
  } = context;

  return `${buildDomainExpertiseSection(domainConfig)}

${projectName ? `Current Project: ${projectName}` : ''}
${documentTitle ? `Document: ${documentTitle}` : ''}

${currentDocument ? `
Current Document Content:
---
${currentDocument}
---

When answering questions, ALWAYS refer to the actual content in the current document above. Do not make up or hallucinate information that is not present in the document.
` : ''}

Your Role:
- Generate technically accurate and professional technical specifications
- Use precise terminology appropriate to the domain
- Follow normative language patterns for requirements
- Structure content clearly with proper headings and organization
- Insert diagram references using {{fig:diagram-id}} syntax where appropriate
- Cite reference documents using {{ref:reference-id}} syntax
- Output well-formatted markdown content

Available Diagrams:
${availableDiagrams.length > 0
  ? availableDiagrams.map(d => `- {{fig:${d.id}}} - ${d.title} (${d.type})`).join('\n')
  : '(No diagrams available yet)'}

Available References:
${availableReferences.length > 0
  ? availableReferences.map(r => `- {{ref:${r.id}}} - ${r.title}${r.metadata?.spec ? ` (${r.metadata.spec})` : ''}`).join('\n')
  : '(No references available yet)'}

Writing Guidelines:
1. Use clear, concise technical language
2. Define acronyms on first use
3. Use numbered or bulleted lists for clarity
4. Include specific technical details and constraints
5. Reference relevant standards and specifications
6. Use tables for complex data relationships
7. Maintain consistency in terminology throughout
${buildNormativeLanguageSection(domainConfig)}

${userInstructions ? `\nAdditional User Instructions:\n${userInstructions}` : ''}

Always output clean, well-structured markdown that can be directly inserted into the document.`;
}

/**
 * Legacy system prompt with hardcoded telecom specialization
 * @deprecated Use buildSystemPrompt with domainConfig for telecommunications
 */
export function buildTelecomSystemPrompt(context: Omit<SystemPromptContext, 'domainConfig'>): string {
  return buildSystemPrompt({
    ...context,
    domainConfig: {
      domain: 'telecommunications',
      industry: '5G networks',
      standards: ['3GPP TS 23.501', '3GPP TS 23.502', '3GPP TS 23.503'],
      normativeLanguage: 'RFC2119',
    }
  });
}

/**
 * Specialized prompt for 3GPP standards compliance
 */
export function build3GPPCompliancePrompt(): string {
  return `When working with 3GPP specifications:

1. Reference Format:
   - Use proper 3GPP spec numbering (e.g., TS 23.203, TS 24.229)
   - Include version numbers when citing specific clauses
   - Quote normative language exactly when applicable

2. Architecture Alignment:
   - Follow 3GPP architectural principles (network functions, reference points, interfaces)
   - Use standard terminology (P-GW, S-GW, PCRF, etc.)
   - Maintain consistency with 3GPP naming conventions

3. Technical Accuracy:
   - Verify protocol flows against standard sequences
   - Ensure interface definitions match 3GPP specifications
   - Validate QoS parameters and bearers against standards

4. Compliance Language:
   - Clearly indicate where implementation follows or extends standards
   - Note any deviations or proprietary extensions
   - Use "compliant with" or "based on" appropriately`;
}

/**
 * Prompt for maintaining document consistency
 */
export function buildConsistencyPrompt(existingContent: string): string {
  return `Maintain consistency with existing document content:

Existing Content Analysis:
${existingContent.substring(0, 1000)}${existingContent.length > 1000 ? '...' : ''}

Style Guidelines:
1. Match the formality level of existing sections
2. Use consistent terminology (if existing content uses "User Equipment", continue using it rather than "UE" alone)
3. Follow the same heading hierarchy and structure
4. Maintain consistent voice (active vs. passive)
5. Use similar sentence complexity and technical depth
6. Match diagram referencing patterns
7. Follow the same citation style

Ensure your output feels like a natural continuation of the existing document.`;
}

/**
 * Prompt for iterative refinement based on feedback
 */
export function buildRefinementPrompt(originalContent: string, feedback: string, isPartialSelection: boolean = false): string {
  const contentLength = originalContent.split('\n').length;

  // For partial selections (e.g., just one section), use different instructions
  if (isPartialSelection) {
    return `You are refining a SELECTED PORTION of a larger document based on user feedback.

Selected Content (${contentLength} lines):
${originalContent}

User Feedback:
${feedback}

Instructions:
1. Carefully read the user's feedback and identify specific areas for improvement
2. You are ONLY refining the selected portion - DO NOT add content from other sections
3. Focus changes ONLY on addressing the feedback for this selection
4. Maintain the structure and formatting of this section
5. Keep or enhance any diagram/reference citations within this section
6. For diagram references, use descriptive kebab-case IDs like {{fig:system-architecture}} NOT random IDs

CRITICAL OUTPUT REQUIREMENTS:

YOU MUST OUTPUT ONLY THE REFINED VERSION OF THE SELECTED CONTENT.
- Do NOT include other sections or content that wasn't in the selection
- Do NOT add introductory text like "Here is the refined section..."
- Do NOT add explanatory notes or meta-commentary
- Output ONLY the markdown content that should replace the selection

ABSOLUTELY FORBIDDEN:
❌ Adding sections that weren't in the original selection
❌ "[Previous sections remain unchanged]" or similar placeholders
❌ "[Note: ...]" or explanatory comments
❌ Introductory phrases like "Here is the refined content:"
❌ Anything other than the actual refined markdown content

REQUIRED:
✅ Output the refined selected content exactly as it should appear in the document
✅ Apply the user's feedback to this section only
✅ Maintain proper markdown formatting
✅ The output must be production-ready and can directly replace the selection

Output the refined selection now:`;
  }

  // For full document refinement
  return `You are refining existing content based on user feedback.

Original Content (${contentLength} lines):
${originalContent}

User Feedback:
${feedback}

Instructions:
1. Carefully read the user's feedback and identify specific areas for improvement
2. Preserve any parts of the original that are working well
3. Focus changes on addressing the feedback
4. Maintain the overall structure unless feedback suggests otherwise
5. Ensure the refined version flows naturally
6. Keep or enhance any diagram/reference citations
7. For diagram references, use descriptive kebab-case IDs like {{fig:system-architecture}} NOT random IDs

CRITICAL OUTPUT REQUIREMENTS - READ CAREFULLY:

YOU MUST OUTPUT THE COMPLETE, FULL DOCUMENT WITH ALL SECTIONS.

The user has provided you with ${contentLength} lines of content. Your output MUST include every section from the original, in one of these forms:
- Unchanged (copied exactly as-is from the original)
- Refined/modified according to the user's feedback
- Expanded with more detail if requested
- Condensed/simplified if requested
- Completely rewritten if requested

ABSOLUTELY FORBIDDEN - NEVER DO THIS:
❌ "[Previous sections remain unchanged]"
❌ "[Sections 2-3 remain identical]"
❌ "[Other content unchanged]"
❌ "[Note: ...]"
❌ "[The rest remains the same]"
❌ "[Subsequent sections continue...]"
❌ Any form of placeholder, summary, or meta-commentary
❌ Skipping sections entirely
❌ Abbreviating or summarizing sections

THE ONLY RULE ABOUT LENGTH:
The output length can be longer, shorter, or the same as the input - that depends entirely on what the user asked for.
- "Expand with examples" → output will be LONGER
- "Simplify and condense" → output will be SHORTER
- "Focus on EPC instead of LTE" → output will be SIMILAR LENGTH

HOWEVER: Every section from the original MUST appear in the output in SOME form (unchanged, modified, expanded, or condensed - but NEVER as a placeholder).

REQUIRED:
✅ Every single section from the original content must appear in full in your output
✅ If you're not changing a section, copy it exactly as-is from the original
✅ Apply the user's feedback to ALL relevant sections
✅ The output must be production-ready markdown that can be used directly
✅ Never use placeholders - write out the actual content

VERIFICATION:
Before responding, ask yourself:
- Have I included ALL sections from the original document?
- Did I actually write out each section (not just say "previous content unchanged")?
- Have I avoided all placeholder text?
- Can this output replace the original document completely?

Output the complete refined content now:`;
}

/**
 * Prompt for technical review and suggestions
 */
export function buildReviewPrompt(content: string): string {
  return `Review the following technical specification content and provide constructive feedback:

Content to Review:
${content}

Provide feedback on:
1. Technical Accuracy: Are there any technical errors or inconsistencies?
2. Completeness: Are there missing details or gaps in coverage?
3. Clarity: Is the content clear and easy to understand?
4. Structure: Is the organization logical and effective?
5. Normative Language: Is normative language (SHALL/MUST/MAY) used appropriately?
6. References: Are diagrams and references cited properly?
7. Compliance: Does it align with relevant standards?

For each point, provide:
- What's working well
- Specific issues or concerns
- Concrete suggestions for improvement

Format your response as a structured review with clear sections.`;
}

/**
 * Prompt for extracting key information from reference documents
 */
export function buildReferenceExtractionPrompt(referenceContent: string, topic: string): string {
  return `Extract key information relevant to "${topic}" from the following reference document:

Reference Content:
${referenceContent.substring(0, 8000)}${referenceContent.length > 8000 ? '...\n[Content truncated for length]' : ''}

Extract:
1. Key concepts and definitions related to "${topic}"
2. Normative requirements (SHALL/MUST statements)
3. Technical parameters and constraints
4. Architectural elements and relationships
5. Protocol flows or procedures
6. Relevant figures or tables (describe them)

Format your response as:
## Key Concepts
[Bullet points]

## Normative Requirements
[Numbered list with exact quotes where appropriate]

## Technical Details
[Bullet points or tables]

## Relevant Figures
[Descriptions of any relevant diagrams or illustrations]

Be concise but comprehensive. Focus on information directly applicable to writing a technical specification.`;
}

/**
 * Guidance for shared diagrams across sub-sections
 * Prevents duplicate diagrams and encourages prose references
 */
export const SHARED_DIAGRAM_GUIDANCE = `
## Diagram Placement Strategy

Technical specifications often have sub-sections that share high-level diagrams:
- Architecture diagrams typically apply to multiple sub-sections
- Component diagrams may be referenced from different perspectives
- Interface diagrams are often shared across protocol descriptions

**Rule**: One diagram, one placement, multiple prose references.

When writing sub-sections:
1. Check if an earlier sub-section already has a relevant diagram
2. If yes, reference it with prose: "As shown in Figure X-Y..."
3. If no, and a new diagram is needed, place it in the current sub-section
4. If the new diagram will be relevant to later sub-sections, note this in the TODO

**Prose Reference Patterns:**
| Pattern | Use Case |
|---------|----------|
| "As shown in Figure X-Y, ..." | General reference to diagram content |
| "The architecture illustrated in Figure X-Y ..." | Referring to structure |
| "Referring to Figure X-Y, the [component] ..." | Calling out specific element |
| "Figure X-Y depicts the overall [topic], while this section focuses on ..." | Narrowing scope |
| "The [element] shown in Figure X-Y ..." | Specific element reference |
| "See Figure X-Y for the complete [view]" | Directing reader to diagram |
`.trim();

/**
 * Critical diagram requirements for all section generation
 * Ensures AI uses {{fig:...}} placeholders with explicit [DIAGRAM TYPE] hints
 */
export const DIAGRAM_PLACEHOLDER_REQUIREMENTS = `
## Diagram Placeholders

When visual aids would help explain concepts, use figure placeholders:

✅ USE: \`{{fig:X-Y-description}}\` format where:
   - X-Y = figure number matching the caption (e.g., 5-1 for Figure 5-1)
   - description = short kebab-case description

❌ NEVER use ASCII art or text-based diagrams

**IMPORTANT**: The figure number in the ID MUST match the caption below:
- ID: \`{{fig:5-1-system-architecture}}\` → Caption: \`*Figure 5-1: System Architecture*\`
- ID: \`{{fig:3-2-call-flow}}\` → Caption: \`*Figure 3-2: Call Flow*\`

**REQUIRED**: Include a TODO comment with EXPLICIT DIAGRAM TYPE after each placeholder:

Format: \`<!-- TODO: [DIAGRAM TYPE] Description of what the diagram should show -->\`

### Available Diagram Types (use exact bracketed text):

**Architecture & Structure:**
- \`[BLOCK DIAGRAM]\` - Architecture, components, interfaces, network topology (custom JSON format)
- \`[CLASS DIAGRAM]\` - OOP class structures, relationships, inheritance
- \`[C4 DIAGRAM]\` - Software architecture (Context, Container, Component levels)
- \`[ARCHITECTURE DIAGRAM]\` - System architecture with services, databases, queues

**Flows & Sequences:**
- \`[SEQUENCE DIAGRAM]\` - Call flows, message exchanges, protocol interactions, signaling
- \`[FLOW DIAGRAM]\` - Algorithms, decision trees, conditional logic, process flows
- \`[STATE DIAGRAM]\` - State machines, state transitions, modes, lifecycle states
- \`[USER JOURNEY]\` - User experience flows, satisfaction scores, touchpoints

**Data & Relationships:**
- \`[ER DIAGRAM]\` - Entity relationships, data models, database schemas
- \`[REQUIREMENT DIAGRAM]\` - Requirements traceability, SysML requirements

**Planning & Timelines:**
- \`[GANTT CHART]\` - Project timelines, implementation phases, schedules
- \`[TIMELINE]\` - Sequential events, milestones, evolution
- \`[KANBAN]\` - Task boards, sprint boards, workflow stages

**Analysis & Visualization:**
- \`[PIE CHART]\` - Proportional data, distribution, percentages
- \`[QUADRANT CHART]\` - Priority matrices, risk assessment, 2D comparisons
- \`[XY CHART]\` - Line charts, bar charts, scatter plots
- \`[SANKEY DIAGRAM]\` - Flow distributions, energy/resource flows
- \`[RADAR CHART]\` - Spider charts, competency comparisons

**Hierarchies & Concepts:**
- \`[MINDMAP]\` - Concept hierarchies, feature breakdowns, brainstorming

**Development & Version Control:**
- \`[GIT GRAPH]\` - Commit history, branches, merges

**Network & Protocol:**
- \`[PACKET DIAGRAM]\` - Network packet structures, protocol headers

### Examples:

\`\`\`markdown
{{fig:5-1-system-architecture}}
<!-- TODO: [BLOCK DIAGRAM] Show main components (AMF, SMF, UPF) and N-interfaces -->
*Figure 5-1: System Architecture Overview*

{{fig:5-2-session-establishment}}
<!-- TODO: [SEQUENCE DIAGRAM] Show UE attach flow with P-GW, PCRF interactions -->
*Figure 5-2: Session Establishment Flow*

{{fig:6-1-user-session-entity}}
<!-- TODO: [ER DIAGRAM] Show User, Session, and Subscription entities with relationships -->
*Figure 6-1: User Session Entity Relationships*

{{fig:7-1-implementation-timeline}}
<!-- TODO: [GANTT CHART] Show Phase 1 (months 1-3), Phase 2 (months 4-6) -->
*Figure 7-1: Implementation Timeline*
\`\`\`
`.trim();
