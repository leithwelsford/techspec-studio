/**
 * Flexible Section Prompts
 *
 * Domain-agnostic prompt builders that adapt to any technical specification type.
 * Replaces the rigid template-specific prompts (build3GPPScopePrompt, etc.)
 */

import type {
  FlexibleSection,
  DomainConfig,
  ExtractedExcerpt,
  MarkdownGenerationGuidance,
} from '../../../types';
import type { WebSearchResult } from '../webSearch';

// ========== Constants ==========

/**
 * Diagram placeholder requirements - included in all section prompts
 */
export const DIAGRAM_PLACEHOLDER_REQUIREMENTS = `
## Diagram Placeholders

When visual aids would help explain concepts, use figure placeholders:

✅ USE: \`{{fig:descriptive-id}}\` syntax
- Block diagrams: \`{{fig:system-architecture}}\`, \`{{fig:network-topology}}\`
- Sequence diagrams: \`{{fig:authentication-flow}}\`, \`{{fig:message-exchange}}\`
- State diagrams: \`{{fig:session-state-machine}}\`, \`{{fig:lifecycle-states}}\`

❌ NEVER use ASCII art or text-based diagrams

Include a TODO comment near each placeholder describing what the diagram should show:
\`\`\`
{{fig:system-architecture}}
<!-- TODO: Show main components (A, B, C) and their interfaces (X, Y, Z) -->
\`\`\`
`;

// ========== Context Builders ==========

export interface FlexibleSectionContext {
  brsContent?: string;
  previousSections?: string;
  domainConfig?: DomainConfig;
  userGuidance?: string;
  referenceExcerpts?: ExtractedExcerpt[];
  webSearchResults?: WebSearchResult[];
  markdownGuidance?: MarkdownGenerationGuidance | null;
  sectionNumber?: string;  // e.g., "1", "2.1"
}

/**
 * Build domain expertise section based on configuration
 */
function buildDomainExpertise(domainConfig?: DomainConfig): string {
  if (!domainConfig?.domain) {
    return `
## Domain Expertise
You are an expert technical specification writer. Adapt your writing style, terminology,
and level of detail to match the subject matter provided in the requirements.
`;
  }

  const { domain, industry, standards, terminology } = domainConfig;

  let expertise = `
## Domain Expertise
You are an expert technical specification writer specializing in **${domain}**`;

  if (industry) {
    expertise += ` with focus on **${industry}**`;
  }
  expertise += '.\n\n';

  if (standards && standards.length > 0) {
    expertise += `**Reference Standards:** ${standards.join(', ')}\n\n`;
    expertise += `Ensure alignment with these standards where applicable. Use standard terminology and reference formats.\n\n`;
  }

  if (terminology && Object.keys(terminology).length > 0) {
    expertise += `**Key Terminology:**\n`;
    for (const [term, definition] of Object.entries(terminology)) {
      expertise += `- **${term}**: ${definition}\n`;
    }
    expertise += '\n';
  }

  return expertise;
}

/**
 * Build normative language guidance based on domain configuration
 */
function buildNormativeLanguageGuidance(domainConfig?: DomainConfig): string {
  const style = domainConfig?.normativeLanguage || 'RFC2119';
  const custom = domainConfig?.customNormativeTerms;

  if (custom) {
    return `
## Requirements Language
Use the following terms for requirements:
- **${custom.shall}** - Absolute requirement (mandatory)
- **${custom.should}** - Recommendation (deviations must be justified)
- **${custom.may}** - Optional feature
`;
  }

  switch (style) {
    case 'RFC2119':
      return `
## Requirements Language (RFC 2119)
Use standard normative language:
- **SHALL / SHALL NOT** - Absolute requirement/prohibition
- **SHOULD / SHOULD NOT** - Recommended (deviations require justification)
- **MAY** - Optional
`;
    case 'IEEE':
      return `
## Requirements Language (IEEE Style)
Use lowercase normative language:
- **shall** - Mandatory requirement
- **should** - Recommended
- **may** - Optional/permitted
`;
    case 'ISO':
      return `
## Requirements Language (ISO Style)
Use title case normative language:
- **Must** - Mandatory requirement
- **Should** - Recommended
- **May** - Optional
`;
    default:
      return `
## Requirements Language
Use clear requirements language:
- Use "shall" or "must" for mandatory requirements
- Use "should" for recommendations
- Use "may" for optional features
`;
  }
}

/**
 * Build reference context from extracted excerpts
 */
function buildReferenceContext(excerpts?: ExtractedExcerpt[]): string {
  if (!excerpts || excerpts.length === 0) return '';

  let context = `
## Reference Documents

The following excerpts from reference documents are relevant to this section:

`;

  for (const excerpt of excerpts) {
    context += `### From: ${excerpt.referenceTitle}
${excerpt.content}

---

`;
  }

  return context;
}

/**
 * Build web search context from results
 */
function buildWebSearchContext(results?: WebSearchResult[]): string {
  if (!results || results.length === 0) return '';

  let context = `
## Web Search Results

The following information was found via web search and may be relevant:

`;

  for (const result of results) {
    context += `### ${result.title}
Source: ${result.url}

${result.description}

---

`;
  }

  context += `
**Note:** Use web search results for supplementary information. Cite sources when using specific facts.
`;

  return context;
}

/**
 * Build markdown formatting instructions
 *
 * These instructions ensure generated markdown aligns with DOCX export requirements.
 * Heading levels in markdown map directly to Word heading styles:
 * - # (H1) → Heading 1 in Word
 * - ## (H2) → Heading 2 in Word
 * - ### (H3) → Heading 3 in Word, etc.
 */
function buildFormattingInstructions(guidance?: MarkdownGenerationGuidance | null): string {
  if (!guidance) {
    // Default formatting guidance when no template is provided
    return `
## Output Format (DOCX-Aligned)

**Heading Levels** (will map to Word heading styles):
- \`#\` (H1) for main sections (1, 2, 3...) → Heading 1 in Word
- \`##\` (H2) for subsections (1.1, 2.1...) → Heading 2 in Word
- \`###\` (H3) for sub-subsections (1.1.1...) → Heading 3 in Word
- Maximum depth: 6 levels (H6)

**Numbering**: Decimal style (1, 1.1, 1.1.1) - include numbers in your headings

**Figures**: Use \`{{fig:diagram-id}}\` syntax. Caption placement: below the figure.

**Tables**: Use standard markdown tables. Caption placement: above the table.

**Lists**:
- Use \`-\` for bullet lists
- Use \`1.\` for ordered/numbered lists

**Emphasis**:
- Use \`**bold**\` for emphasis
- Use \`*italic*\` for technical terms on first use
`;
  }

  // Template-specific formatting guidance
  let instructions = `
## Output Format (DOCX-Aligned)

**Heading Levels** (will map to Word heading styles):
- \`#\` (H1) for main sections → Heading 1 in Word
- \`##\` (H2) for subsections → Heading 2 in Word
- \`###\` (H3) for sub-subsections → Heading 3 in Word
`;

  if (guidance.headingLevels) {
    instructions += `- Maximum depth: ${guidance.headingLevels.maxDepth} levels\n`;
    if (guidance.headingLevels.numberingStyle === 'decimal') {
      instructions += `- **Numbering**: Decimal style (1, 1.1, 1.1.1) - include numbers in headings\n`;
    } else {
      instructions += `- **Numbering**: ${guidance.headingLevels.numberingStyle}\n`;
    }
    instructions += '\n';
  }

  if (guidance.figureFormat) {
    instructions += `**Figures**:
- Pattern: ${guidance.figureFormat.numberingPattern}
- Caption placement: ${guidance.figureFormat.captionPlacement}
- Syntax: Use \`${guidance.figureFormat.syntax}\` for figure references

`;
  }

  if (guidance.tableFormat) {
    instructions += `**Tables**:
- Pattern: ${guidance.tableFormat.numberingPattern}
- Caption placement: ${guidance.tableFormat.captionPlacement}
- Use ${guidance.tableFormat.useMarkdownTables ? 'standard markdown tables' : 'HTML tables if complex'}

`;
  }

  if (guidance.listFormat) {
    instructions += `**Lists**:
- Bullets: Use \`${guidance.listFormat.bulletChar}\`
- Numbered: Use \`${guidance.listFormat.orderedStyle}\`

`;
  }

  if (guidance.emphasis) {
    instructions += `**Emphasis**:
- Bold: Use \`${guidance.emphasis.bold}text${guidance.emphasis.bold}\`
- Italic: Use \`${guidance.emphasis.italic}text${guidance.emphasis.italic}\`

`;
  }

  if (guidance.codeBlockStyle) {
    instructions += `**Code Blocks**: Use ${guidance.codeBlockStyle.fenced ? 'fenced (```)' : 'indented'} code blocks${guidance.codeBlockStyle.languageHints ? ' with language hints' : ''}\n\n`;
  }

  return instructions;
}

// ========== Main Prompt Builder ==========

/**
 * Build a flexible section prompt that adapts to any domain
 *
 * This is the main prompt builder that replaces all the rigid template-specific
 * builders (build3GPPScopePrompt, build3GPPArchitecturePrompt, etc.)
 *
 * @param section - The section definition with user-editable description
 * @param context - All available context (BRS, references, search results, etc.)
 * @returns Complete prompt for generating the section
 */
export function buildFlexibleSectionPrompt(
  section: FlexibleSection,
  context: FlexibleSectionContext
): string {
  const {
    brsContent,
    previousSections,
    domainConfig,
    userGuidance,
    referenceExcerpts,
    webSearchResults,
    markdownGuidance,
    sectionNumber,
  } = context;

  // Build the heading - determine level from section number depth
  // "1" → # (H1), "1.1" → ## (H2), "1.1.1" → ### (H3), etc.
  const getHeadingLevel = (num?: string): string => {
    if (!num) return '##'; // Default to H2 if no number
    const depth = num.split('.').length;
    return '#'.repeat(Math.min(depth, 6)); // Max H6
  };

  const headingPrefix = getHeadingLevel(sectionNumber);
  const heading = sectionNumber
    ? `${headingPrefix} ${sectionNumber} ${section.title}`
    : `## ${section.title}`;

  // Compose the prompt
  let prompt = `# Generate Section: ${section.title}

${buildDomainExpertise(domainConfig)}

${buildNormativeLanguageGuidance(domainConfig)}

---

## Section Requirements

**Section:** ${heading}

**What This Section Should Cover:**
${section.description}

`;

  // Add suggested subsections if provided
  if (section.suggestedSubsections && section.suggestedSubsections.length > 0) {
    prompt += `**Suggested Subsections:**
${section.suggestedSubsections.map((s, i) => `${sectionNumber ? `${sectionNumber}.${i + 1}` : `${i + 1}.`} ${s}`).join('\n')}

These are suggestions - you may adapt the structure based on the content requirements.

`;
  }

  // Add user's custom guidance for this section
  if (section.contentGuidance) {
    prompt += `**Specific Requirements for This Section:**
${section.contentGuidance}

`;
  }

  // Add diagram placeholder requirements
  prompt += DIAGRAM_PLACEHOLDER_REQUIREMENTS;

  // Add context sections
  prompt += `
---

## Available Context

`;

  // BRS content
  if (brsContent) {
    // Include more content for single section generation
    const maxBrsChars = 5000;
    const truncatedBrs = brsContent.length > maxBrsChars
      ? brsContent.slice(0, maxBrsChars) + '\n\n[... truncated for length ...]'
      : brsContent;

    prompt += `### Business Requirements Specification

${truncatedBrs}

`;
  }

  // Previous sections for consistency
  if (previousSections) {
    const maxPrevChars = 3000;
    const truncatedPrev = previousSections.length > maxPrevChars
      ? '...' + previousSections.slice(-maxPrevChars)
      : previousSections;

    prompt += `### Previous Sections (for consistency)

${truncatedPrev}

`;
  }

  // Reference documents
  prompt += buildReferenceContext(referenceExcerpts);

  // Web search results
  prompt += buildWebSearchContext(webSearchResults);

  // Global user guidance
  if (userGuidance) {
    prompt += `
---

## User Guidance

${userGuidance}

`;
  }

  // Formatting instructions
  prompt += buildFormattingInstructions(markdownGuidance);

  // Output requirements
  prompt += `
---

## Output Requirements

Generate the complete section content in markdown format.

**CRITICAL:**
- Start with the section heading: \`${heading}\`
- Include all relevant content from the requirements
- Adapt terminology and formality to match the domain
- Use diagram placeholders where visual aids would help
- Maintain consistency with previous sections (if provided)
- Output ONLY the section content - no explanations or meta-commentary

**DO NOT:**
- Include placeholder text like "[Content to be added]"
- Add sections beyond what was requested
- Include document title, author, date, or version
- Use ASCII art or text-based diagrams
`;

  return prompt;
}

// ========== Specialized Section Helpers ==========

/**
 * Build prompt for an introduction/scope section
 */
export function buildIntroductionSectionPrompt(
  section: FlexibleSection,
  context: FlexibleSectionContext
): string {
  // Enhance the section description for introduction-type sections
  const enhancedSection: FlexibleSection = {
    ...section,
    description: section.description || `
Define the scope, purpose, and boundaries of this specification.
Include:
- What the specification covers
- What is explicitly out of scope
- Target audience
- Document structure overview
`,
    suggestedSubsections: section.suggestedSubsections || [
      'Purpose',
      'Scope',
      'Audience',
      'Document Organization',
    ],
  };

  return buildFlexibleSectionPrompt(enhancedSection, context);
}

/**
 * Build prompt for an architecture section
 */
export function buildArchitectureSectionPrompt(
  section: FlexibleSection,
  context: FlexibleSectionContext
): string {
  const enhancedSection: FlexibleSection = {
    ...section,
    description: section.description || `
Describe the system architecture and design.
Include:
- High-level architecture overview
- Key components and their responsibilities
- Interfaces and integration points
- Data flows and communication patterns
`,
    suggestedSubsections: section.suggestedSubsections || [
      'Architecture Overview',
      'Components',
      'Interfaces',
      'Data Flow',
    ],
  };

  return buildFlexibleSectionPrompt(enhancedSection, context);
}

/**
 * Build prompt for a requirements section
 */
export function buildRequirementsSectionPrompt(
  section: FlexibleSection,
  context: FlexibleSectionContext
): string {
  const enhancedSection: FlexibleSection = {
    ...section,
    description: section.description || `
Define the functional and non-functional requirements.
Include:
- Functional requirements with unique IDs
- Performance requirements
- Security requirements
- Reliability and availability requirements
`,
    suggestedSubsections: section.suggestedSubsections || [
      'Functional Requirements',
      'Performance Requirements',
      'Security Requirements',
      'Reliability Requirements',
    ],
  };

  return buildFlexibleSectionPrompt(enhancedSection, context);
}

/**
 * Build prompt for a procedures section
 */
export function buildProceduresSectionPrompt(
  section: FlexibleSection,
  context: FlexibleSectionContext
): string {
  const enhancedSection: FlexibleSection = {
    ...section,
    description: section.description || `
Document operational procedures and workflows.
Include:
- Step-by-step procedures
- Sequence diagrams for complex flows
- Error handling procedures
- State transitions
`,
    suggestedSubsections: section.suggestedSubsections || [
      'Standard Procedures',
      'Error Handling',
      'Recovery Procedures',
    ],
  };

  // Add emphasis on sequence diagrams for procedures
  const enhancedContext: FlexibleSectionContext = {
    ...context,
    userGuidance: `${context.userGuidance || ''}

For each significant procedure:
1. Provide a step-by-step description
2. Include a sequence diagram placeholder: {{fig:procedure-name-flow}}
3. Document success and failure scenarios
`,
  };

  return buildFlexibleSectionPrompt(enhancedSection, enhancedContext);
}
