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
  RequirementCounterState,
} from '../../../types';
import type { WebSearchResult } from '../webSearch';

// ========== Constants ==========

/**
 * Diagram placeholder requirements - included in all section prompts
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
- \`[ZENUML]\` - Alternative sequence diagrams with method-call syntax

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
- \`[TREEMAP]\` - Hierarchical proportional areas

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

{{fig:5-2-user-session-entity}}
<!-- TODO: [ER DIAGRAM] Show User, Session, and Subscription entities with relationships -->
*Figure 5-2: User Session Entity Relationships*

{{fig:6-1-implementation-timeline}}
<!-- TODO: [GANTT CHART] Show Phase 1 (months 1-3), Phase 2 (months 4-6), Phase 3 (months 7-9) -->
*Figure 6-1: Implementation Timeline*

{{fig:4-1-feature-hierarchy}}
<!-- TODO: [MINDMAP] Show main features branching into sub-features and capabilities -->
*Figure 4-1: Feature Hierarchy*

{{fig:7-1-risk-matrix}}
<!-- TODO: [QUADRANT CHART] Plot risks by likelihood (x) vs impact (y) -->
*Figure 7-1: Risk Assessment Matrix*
\`\`\`

## Shared Diagrams Across Sub-Sections

When a diagram conceptually applies to multiple sub-sections:

1. **Place the diagram in the FIRST sub-section that uses it**
   - Include the {{fig:...}} placeholder and caption in that first sub-section
   - The diagram should show the complete view needed by all related sub-sections

2. **Reference with prose in subsequent sub-sections**
   - Do NOT create new diagram placeholders for the same conceptual content
   - Use phrases like:
     - "As shown in Figure X-Y, ..."
     - "The architecture illustrated in Figure X-Y ..."
     - "Referring to Figure X-Y, the [specific aspect] ..."

3. **Figure numbering remains section-level**
   - All diagrams in section 5 are numbered 5-1, 5-2, 5-3
   - NOT 5.1-1, 5.2-1 (sub-section level)

### Example: Section 5 with shared and unique diagrams

\`\`\`markdown
### 5.1 Logical Components
{{fig:5-1-system-architecture}}
<!-- TODO: [BLOCK DIAGRAM] Show all major components (AMF, SMF, UPF)
     and interfaces. FOCUS ON NODES. This diagram covers 5.1, 5.2, 5.3 -->
*Figure 5-1: System Architecture Overview*

The system comprises five logical components...

### 5.2 Control Plane Functions
As shown in Figure 5-1, the control plane encompasses the Policy Controller
and Session Manager components. This section details their responsibilities...
[No new diagram - uses prose reference to Figure 5-1]

### 5.3 User Plane Functions
The user plane data path, illustrated in Figure 5-1, flows through the
Access Gateway and Traffic Processor...
[No new diagram - uses prose reference to Figure 5-1]

### 5.4 Session Management
{{fig:5-2-session-states}}
<!-- TODO: [STATE DIAGRAM] Show session lifecycle: IDLE → INITIATING →
     ACTIVE → TERMINATING → CLOSED with transition triggers -->
*Figure 5-2: Session State Machine*

This section requires its own diagram showing state transitions...
\`\`\`

### Indicators in TODO Comments

When a diagram covers multiple sub-sections, indicate this in the TODO:

\`\`\`markdown
<!-- TODO: [BLOCK DIAGRAM] ... This diagram covers 5.1, 5.2, 5.3 -->
\`\`\`

This helps:
- Document authors understand the diagram's scope
- Future AI refinements know not to duplicate
- Reviewers verify appropriate coverage
`;

/**
 * Requirement numbering guidance - instructs AI to add requirement IDs
 */
export const REQUIREMENT_NUMBERING_GUIDANCE = `
## Requirement Numbering

**CRITICAL**: Every normative statement MUST have a unique requirement ID - no exceptions.

**Normative keywords** (per RFC 2119):
- **Absolute requirements**: SHALL, SHALL NOT, MUST, MUST NOT, REQUIRED
- **Recommendations**: SHOULD, SHOULD NOT, RECOMMENDED
- **Optional**: MAY, OPTIONAL

**Format**: \`<SUBSYSTEM>-<FEATURE>-<ARTEFACT>-<NNNNN>\`

**Components** (infer from BRS and section context):
- **SUBSYSTEM**: Major system block (e.g., PCC, AAA, WLAN, BNG, PCRF, OCS, CORE, EDGE)
- **FEATURE**: Functional slice (e.g., CAPTIVE, EAPSIM, ACCOUNTING, QOS, CHARGING, AUTH)
- **ARTEFACT**: Requirement type:
  - \`REQ\` - General requirement
  - \`FR\` - Functional requirement
  - \`NFR\` - Non-functional requirement
  - \`INT\` - Interface requirement
  - \`SEC\` - Security requirement
  - \`CFG\` - Configuration requirement
  - \`TST\` - Test requirement
  - \`RISK\` - Risk item
- **NNNNN**: 5-digit zero-padded counter (00001, 00002, etc.)

**Rules**:
1. Infer SUBSYSTEM and FEATURE from the BRS document and section context
2. Keep SUBSYSTEM and FEATURE consistent within related sections
3. Use appropriate ARTEFACT type based on requirement nature
4. Start counter at 00001 for each unique SUBSYSTEM-FEATURE-ARTEFACT combination
5. Format each requirement as: **ID**: The system SHALL/MUST/SHOULD/MAY...
6. **Lists with normative statements**: Each list item containing a normative keyword MUST have its own ID

**Examples**:

Simple requirements:
\`\`\`markdown
**PCC-CAPTIVE-REQ-00001**: The system SHALL authenticate users via RADIUS protocol.

**PCC-CAPTIVE-SEC-00001**: The system MUST encrypt all authentication credentials using TLS 1.3.
\`\`\`

Requirements with lists (each normative item gets an ID):
\`\`\`markdown
The operator SHALL configure the following parameters:

- **AAA-CONFIG-CFG-00001**: The operator SHALL configure primary/secondary AAA endpoints.
- **AAA-CONFIG-CFG-00002**: The operator SHALL configure request timeout and retry counts.
- **AAA-CONFIG-CFG-00003**: The operator MAY configure accounting interim interval (if used).
\`\`\`

Numbered list example:
\`\`\`markdown
The authentication flow SHALL proceed as follows:

1. **PCC-AUTH-REQ-00001**: The system SHALL receive the initial connection request.
2. **PCC-AUTH-REQ-00002**: The system SHALL validate the subscriber identity.
3. **PCC-AUTH-REQ-00003**: The system SHALL apply the appropriate policy profile.
\`\`\`

Nested lists (each level with normative keywords gets an ID):
\`\`\`markdown
**AAA-RADIUS-REQ-00001**: The AAA system SHALL support RADIUS authentication with the following capabilities:

- **AAA-RADIUS-REQ-00002**: The system SHALL support EAP-SIM authentication:
  - **AAA-RADIUS-REQ-00003**: The system SHALL validate IMSI against the HLR/HSS.
  - **AAA-RADIUS-REQ-00004**: The system SHALL support triplet and quintuplet vectors.
  - **AAA-RADIUS-CFG-00001**: The operator MAY configure vector pre-fetching.
- **AAA-RADIUS-REQ-00005**: The system SHALL support EAP-AKA authentication:
  - **AAA-RADIUS-REQ-00006**: The system MUST validate AUTN before generating RES.
  - **AAA-RADIUS-SEC-00001**: The system SHALL reject replayed authentication vectors.
\`\`\`
`;

/**
 * Instruction when requirement numbering is disabled for a section
 */
export const REQUIREMENT_NUMBERING_DISABLED = `
## Requirement Numbering

**IMPORTANT: Do NOT include requirement IDs in this section.**
Write normative statements (SHALL, MUST, SHOULD, MAY, etc.) without ID prefixes.
`;

/**
 * Build requirement numbering guidance with counter state
 */
export function buildRequirementNumberingSection(
  enabled: boolean,
  counters?: RequirementCounterState
): string {
  if (!enabled) {
    return REQUIREMENT_NUMBERING_DISABLED;
  }

  let guidance = REQUIREMENT_NUMBERING_GUIDANCE;

  // Add counter state if we have existing counters
  if (counters && Object.keys(counters.counters).length > 0) {
    guidance += `\n**Continue from these counters (use next number in sequence):**\n`;
    for (const [prefix, count] of Object.entries(counters.counters)) {
      guidance += `- ${prefix}: last used ${String(count).padStart(5, '0')}, next is ${String(count + 1).padStart(5, '0')}\n`;
    }
    guidance += `\n`;
  }

  return guidance;
}

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
  includeDiagrams?: boolean;  // Whether to include diagram placeholder instructions (default: true)
  requirementCounters?: RequirementCounterState;  // Counter state from previous sections
  enableRequirementNumbering?: boolean;  // Whether to include requirement IDs
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
- **IMPORTANT**: ALWAYS add a caption line after each figure reference:
\`\`\`
{{fig:diagram-id}}

*Figure X-Y: Descriptive caption explaining the diagram*
\`\`\`

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
- **IMPORTANT**: ALWAYS add a caption line after each figure reference:

\`\`\`markdown
{{fig:diagram-id}}

*Figure X-Y: Descriptive caption explaining the diagram*
\`\`\`

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

  // Add Pandoc custom-style instructions when enabled
  if (guidance.pandocStyles?.enabled) {
    instructions += `
**Pandoc Custom Styles** (for professional DOCX export):

Use fenced divs with \`custom-style\` attribute to apply Word styles from the template:

`;

    if (guidance.pandocStyles.figureCaption) {
      instructions += `**Figure Captions**:
\`\`\`markdown
{{fig:diagram-id}}

::: {custom-style="${guidance.pandocStyles.figureCaption}"}
Figure 1: Diagram Title
:::
\`\`\`

`;
    }

    if (guidance.pandocStyles.tableCaption) {
      instructions += `**Table Captions**:
\`\`\`markdown
::: {custom-style="${guidance.pandocStyles.tableCaption}"}
Table 1: Data Summary
:::

| Column 1 | Column 2 |
|----------|----------|
| Data     | Data     |
\`\`\`

`;
    }

    if (guidance.pandocStyles.appendixHeading) {
      instructions += `**Appendix Headings** (use instead of # for appendices):
\`\`\`markdown
::: {custom-style="${guidance.pandocStyles.appendixHeading}"}
Appendix A: Glossary
:::
\`\`\`

`;
    }

    if (guidance.pandocStyles.noteStyle) {
      instructions += `**Notes/Warnings**:
\`\`\`markdown
::: {custom-style="${guidance.pandocStyles.noteStyle}"}
Note: Important information here.
:::
\`\`\`

`;
    }

    instructions += `**Important**: The \`::: {custom-style="StyleName"}\` syntax maps directly to Word paragraph styles in the template. Use these for captions and special formatting to ensure consistent professional output.

`;
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
    includeDiagrams,
    requirementCounters,
    enableRequirementNumbering,
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

  // Add diagram placeholder requirements (only if not explicitly disabled)
  // Default is true - diagrams are included unless user unchecks the option
  if (includeDiagrams !== false && section.includeDiagrams !== false) {
    prompt += DIAGRAM_PLACEHOLDER_REQUIREMENTS;
  } else {
    prompt += `
## Diagram Placeholders

**IMPORTANT: Do NOT include any diagram placeholders in this section.**
The user has explicitly disabled diagram generation for this section.
Do not use \`{{fig:...}}\` syntax or include any TODO comments for diagrams.
`;
  }

  // Add requirement numbering guidance
  // Check both context-level and section-level settings (default to enabled)
  const enableReqNumbering = enableRequirementNumbering !== false && section.enableRequirementNumbering !== false;
  prompt += buildRequirementNumberingSection(enableReqNumbering, requirementCounters);

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
