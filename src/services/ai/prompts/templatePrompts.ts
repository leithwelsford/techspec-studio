/**
 * Template-Based Prompt System
 *
 * Generic prompt builders that work with any template configuration.
 * Maps template section definitions to appropriate prompt generation logic.
 *
 * ROUTING STRATEGY:
 * - Legacy 3GPP prompts: Used for backward compatibility with existing templates.
 *   These are imported from documentPrompts.ts which re-exports from legacyTelecomPrompts.ts.
 *   They are DEPRECATED and will be phased out in future versions.
 *
 * - Flexible prompts: Use 'buildFlexibleSectionPrompt' key in your template's section.promptKey
 *   to use the new domain-agnostic sectionPrompts.ts system. This is the RECOMMENDED approach
 *   for new templates and domains beyond telecommunications.
 *
 * - Generic fallback: If no specific builder exists, falls back to buildGenericSectionPrompt()
 *   which provides a basic domain-agnostic template.
 */

import type { TemplateSectionDefinition, BRSDocument, FlexibleSection, DomainConfig } from '../../../types';

// BRSAnalysis type for template prompt builders
interface BRSAnalysis {
  components?: string[];
  interfaces?: Array<{ name: string; between: string[]; standard?: string; protocol?: string }>;
  requirementCategories?: Record<string, string[]>;
  procedures?: Array<{ name: string; steps: string[]; participants: string[] }>;
  standards?: Array<{ id: string; title: string }>;
  [key: string]: any;
}

// Legacy 3GPP prompt builders (DEPRECATED - use flexible prompts instead)
import {
  build3GPPScopePrompt,
  buildServiceOverviewPrompt,
  build3GPPFunctionalRequirementsPrompt,
  buildNonFunctionalRequirementsPrompt,
  buildOSSBSSPrompt,
  buildSLASummaryPrompt,
  buildOpenItemsPrompt,
  buildAppendicesPrompt,
} from './documentPrompts';

// New domain-agnostic flexible prompts (RECOMMENDED)
import { buildFlexibleSectionPrompt as flexiblePromptBuilder } from './sectionPrompts';

import { DIAGRAM_PLACEHOLDER_REQUIREMENTS } from './systemPrompts';

/**
 * Prompt builder context - all data needed to build section prompts
 */
export interface PromptBuilderContext {
  specTitle: string;
  brsDocument: BRSDocument;
  brsAnalysis: BRSAnalysis;
  previousSections: Array<{ title: string; content: string }>;
  template: {
    name: string;
    formatGuidance: string;
    /** Domain hint for flexible prompts (e.g., 'telecommunications', 'software', 'healthcare') */
    domain?: string;
  };
  userGuidance?: string;
  availableDiagrams?: Array<{ id: string; title: string; type: string }>;
  markdownGuidance?: import('../../../types').MarkdownGenerationGuidance | null;
}

/**
 * Prompt builder function signature
 */
type PromptBuilder = (
  section: TemplateSectionDefinition,
  context: PromptBuilderContext
) => string;

/**
 * Registry mapping promptKey → prompt builder function
 */
const promptBuilders: Record<string, PromptBuilder> = {
  // =============================================================================
  // FLEXIBLE PROMPTS (RECOMMENDED for new templates)
  // =============================================================================
  // Use these for domain-agnostic specifications. They adapt to any domain
  // based on the DomainConfig provided in the template.
  // =============================================================================

  /**
   * Flexible section prompt - adapts to any domain
   * Use this as the promptKey in your template's section definition
   */
  'buildFlexibleSectionPrompt': (section, context) => {
    // Convert TemplateSectionDefinition to FlexibleSection
    const flexibleSection: FlexibleSection = {
      id: section.id,
      title: section.title,
      description: section.description,
      isRequired: section.required ?? false,
      // Allow subsections hint can be used to suggest subsections
      suggestedSubsections: section.allowSubsections ? [] : undefined,
      contentGuidance: context.userGuidance,
      order: 0,  // Not used in prompt generation
    };

    // Build domain config from template (can be extended in the future)
    const domainConfig: DomainConfig | undefined = context.template.domain
      ? {
          domain: context.template.domain,
          standards: [],  // Can be extracted from BRS analysis
        }
      : undefined;

    // Build previous sections context as string
    const previousContent = context.previousSections.length > 0
      ? context.previousSections.map(s => `# ${s.title}\n\n${s.content}`).join('\n\n---\n\n')
      : undefined;

    return flexiblePromptBuilder(flexibleSection, {
      brsContent: context.brsDocument.markdown,
      previousSections: previousContent,
      domainConfig,
      userGuidance: context.userGuidance,
      markdownGuidance: context.markdownGuidance || null,
      sectionNumber: section.number,
    });
  },

  // =============================================================================
  // LEGACY 3GPP PROMPTS (DEPRECATED - will be removed in future versions)
  // =============================================================================
  // These are maintained for backward compatibility with existing 3GPP templates.
  // For new templates, use 'buildFlexibleSectionPrompt' instead.
  // =============================================================================

  // 3GPP prompts (DEPRECATED)
  'build3GPPScopePrompt': (_section, context) => {
    return build3GPPScopePrompt(
      context.specTitle,
      context.brsAnalysis,
      context.brsDocument.metadata,
      context.userGuidance
    );
  },

  'buildServiceOverviewPrompt': (_section, context) => {
    return buildServiceOverviewPrompt(
      context.specTitle,
      context.brsAnalysis,
      context.brsDocument.metadata,
      context.userGuidance
    );
  },

  'build3GPPFunctionalRequirementsPrompt': (_section, context) => {
    return build3GPPFunctionalRequirementsPrompt(
      context.brsAnalysis,
      context.userGuidance
    );
  },

  'buildArchitectureAndProceduresPrompt': (section, context) => {
    // Combined architecture + procedures section for 3GPP
    return buildArchitectureAndProceduresPrompt(section, context);
  },

  'buildNonFunctionalRequirementsPrompt': (_section, context) => {
    return buildNonFunctionalRequirementsPrompt(
      context.brsAnalysis,
      context.userGuidance
    );
  },

  'buildOSSBSSPrompt': (_section, context) => {
    return buildOSSBSSPrompt(
      context.brsAnalysis,
      context.userGuidance
    );
  },

  'buildSLASummaryPrompt': (_section, context) => {
    return buildSLASummaryPrompt(
      context.brsAnalysis,
      context.userGuidance
    );
  },

  'buildOpenItemsPrompt': (_section, context) => {
    return buildOpenItemsPrompt(
      context.brsAnalysis,
      context.userGuidance
    );
  },

  'buildAppendicesPrompt': (_section, context) => {
    return buildAppendicesPrompt(
      context.brsAnalysis,
      context.brsDocument.markdown,
      context.brsAnalysis.standards || [],
      context.userGuidance
    );
  },

  // IEEE 830 prompts (to be implemented)
  'buildIEEE830IntroductionPrompt': (section, context) => {
    return buildGenericIntroductionPrompt(section, context);
  },

  'buildIEEE830OverallDescriptionPrompt': (section, context) => {
    return buildGenericOverallDescriptionPrompt(section, context);
  },

  'buildIEEE830SpecificRequirementsPrompt': (section, context) => {
    return buildGenericSpecificRequirementsPrompt(section, context);
  },

  'buildIEEE830ExternalInterfacesPrompt': (section, context) => {
    return buildGenericExternalInterfacesPrompt(section, context);
  },

  'buildIEEE830SystemFeaturesPrompt': (section, context) => {
    return buildGenericSystemFeaturesPrompt(section, context);
  },

  'buildIEEE830PerformancePrompt': (section, context) => {
    return buildGenericPerformancePrompt(section, context);
  },

  'buildIEEE830DesignConstraintsPrompt': (section, context) => {
    return buildGenericDesignConstraintsPrompt(section, context);
  },

  'buildIEEE830SoftwareAttributesPrompt': (section, context) => {
    return buildGenericSoftwareAttributesPrompt(section, context);
  },

  'buildIEEE830AppendicesPrompt': (section, context) => {
    return buildGenericAppendicesPrompt(section, context);
  },

  // ISO 29148 prompts (to be implemented)
  'buildISO29148IntroductionPrompt': (section, context) => {
    return buildGenericIntroductionPrompt(section, context);
  },

  'buildISO29148ReferencesPrompt': (section, context) => {
    return buildGenericReferencesPrompt(section, context);
  },

  'buildISO29148DefinitionsPrompt': (section, context) => {
    return buildGenericDefinitionsPrompt(section, context);
  },

  'buildISO29148StakeholderRequirementsPrompt': (section, context) => {
    return buildGenericStakeholderRequirementsPrompt(section, context);
  },

  'buildISO29148SystemRequirementsPrompt': (section, context) => {
    return buildGenericSystemRequirementsPrompt(section, context);
  },

  'buildISO29148VerificationPrompt': (section, context) => {
    return buildGenericVerificationPrompt(section, context);
  },

  'buildISO29148AppendicesPrompt': (section, context) => {
    return buildGenericAppendicesPrompt(section, context);
  },
};

/**
 * List of legacy prompt keys that have hardcoded section numbers
 * These need post-processing to inject the correct dynamic section number
 */
const LEGACY_PROMPTS_WITH_HARDCODED_NUMBERS = [
  'build3GPPScopePrompt',
  'buildServiceOverviewPrompt',
  'build3GPPFunctionalRequirementsPrompt',
  'buildArchitectureAndProceduresPrompt',
  'buildNonFunctionalRequirementsPrompt',
  'buildOSSBSSPrompt',
  'buildSLASummaryPrompt',
  'buildOpenItemsPrompt',
  'buildAppendicesPrompt',
];

/**
 * Build a section prompt using template configuration
 *
 * @param section - Template section definition
 * @param context - All context needed for prompt generation
 * @returns Prompt string ready for LLM
 */
export function buildSectionPrompt(
  section: TemplateSectionDefinition,
  context: PromptBuilderContext
): string {
  const builder = promptBuilders[section.promptKey];

  if (!builder) {
    // Fallback to generic prompt if no specific builder exists
    console.warn(`No prompt builder found for "${section.promptKey}", using generic builder`);
    return buildGenericSectionPrompt(section, context);
  }

  let prompt = builder(section, context);

  // For legacy prompts with hardcoded section numbers, inject the correct dynamic number
  if (LEGACY_PROMPTS_WITH_HARDCODED_NUMBERS.includes(section.promptKey) && section.number) {
    prompt = injectDynamicSectionNumber(prompt, section.number, section.title);
  }

  return prompt;
}

/**
 * Inject dynamic section number instruction into legacy prompts
 * This ensures the LLM uses the correct section number even when sections are reordered
 */
function injectDynamicSectionNumber(prompt: string, sectionNumber: string, sectionTitle: string): string {
  return `**IMPORTANT: Section Numbering Override**
This section should be numbered as Section ${sectionNumber} (${sectionTitle}).
Use "## ${sectionNumber} ${sectionTitle}" as the main heading and "${sectionNumber}.X" for any subsections.
DO NOT use any other section number - the section order has been customized.

---

${prompt}`;
}

/**
 * Generic fallback prompt builder
 * Used when no specific prompt builder is registered for a section
 */
function buildGenericSectionPrompt(
  section: TemplateSectionDefinition,
  context: PromptBuilderContext
): string {
  const previousContent = context.previousSections.length > 0
    ? `\n\n### Previously Generated Sections:\n\n${context.previousSections.map(s => `**${s.title}**\n${s.content.substring(0, 500)}...\n`).join('\n')}`
    : '';

  // Include template-specific markdown formatting if available
  const formattingInstructions = buildTemplateFormattingInstructions(context.markdownGuidance || null);

  return `Generate section "${section.number} ${section.title}" for a technical specification document.

**Template**: ${context.template.name}
**Document Title**: ${context.specTitle}

**Section Description**: ${section.description}

**Format Guidance**:
${context.template.formatGuidance}

**Requirements from BRS**:
${JSON.stringify(context.brsAnalysis, null, 2)}

${context.availableDiagrams && context.availableDiagrams.length > 0
  ? `**Available Diagrams**:\n${context.availableDiagrams.map(d => `- {{fig:${d.id}}} - ${d.title}`).join('\n')}\n`
  : ''}

${previousContent}

${context.userGuidance ? `\n**Additional User Guidance**:\n${context.userGuidance}\n` : ''}

**Instructions**:
- Generate section ${section.number} (${section.title}) following the template format guidance above
- ${section.allowSubsections ? 'Create appropriate subsections (###, ####) as needed' : 'Keep section flat without subsections'}
- Maintain consistency with previously generated sections
- Include figure placeholders ({{fig:id}}) where diagrams would be helpful
- Follow the template's tone, style, and formatting conventions
- Use complete, production-ready content (no placeholders or "TODO" markers)

${DIAGRAM_PLACEHOLDER_REQUIREMENTS}

${formattingInstructions}

Generate the complete section now in markdown format:`;
}

// ========== 3GPP-Specific Helpers ==========

function buildArchitectureAndProceduresPrompt(
  _section: TemplateSectionDefinition,
  context: PromptBuilderContext
): string {
  // This is the combined Section 4 from the existing implementation
  return `Generate Section 4 (Solution Architecture and Design) for a 3GPP-style technical specification.

This section combines both architecture and procedures into a single comprehensive section.

Architecture Requirements from BRS:
${JSON.stringify(context.brsAnalysis.requirementCategories?.architecture || [], null, 2)}

Components:
${context.brsAnalysis.components?.join(', ') || 'Not specified'}

Interfaces:
${JSON.stringify(context.brsAnalysis.interfaces || [], null, 2)}

Procedures from BRS:
${JSON.stringify(context.brsAnalysis.procedures || [], null, 2)}

${context.availableDiagrams && context.availableDiagrams.length > 0
  ? `Available Diagrams:\n${context.availableDiagrams.map(d => `- {{fig:${d.id}}} - ${d.title}`).join('\n')}\n`
  : ''}

Section Structure:
## 4 Solution Architecture and Design

### 4.1 Overview
- High-level architecture description
- Key architectural principles and design decisions
- **Suggest block diagram**: {{fig:architecture-overview}} <!-- TODO: High-level system architecture -->

### 4.2 Functional Elements
For each component (PCRF, PCEF, TDF, P-GW, BNG/BRAS, OCS, OFCS, etc.):
- **4.2.X Component Name**
  - Function and responsibilities
  - Interfaces (Gx, Sd, Gy, Gz, RADIUS, etc.)
  - Standards compliance (3GPP TS references)
  - Deployment considerations

### 4.3 Interfaces and Reference Points
For each interface (Gx, Sd, Gy, Gz, RADIUS):
- Protocol specification
- Message flows
- Parameters and AVPs
- Error handling

### 4.4 Procedures
For each procedure (Session Establishment, Policy Update, Handover, Charging, etc.):

#### 4.4.X Procedure Name
- Overview and trigger conditions
- Step-by-step sequence
- **Suggest sequence diagram**: {{fig:procedure-name-flow}} <!-- TODO: Detailed message flow -->
- Success and failure scenarios
- Timing and performance considerations

Guidelines:
- Combine architecture description with operational procedures
- Use block diagrams for architecture, sequence diagrams for procedures
- Maintain 3GPP terminology and reference standards
- Include both structural (architecture) and behavioral (procedures) aspects
- Use normative language (SHALL/MUST) where appropriate

${DIAGRAM_PLACEHOLDER_REQUIREMENTS}

${context.userGuidance ? `\nAdditional User Guidance:\n${context.userGuidance}\n` : ''}

Generate the complete Section 4 now in markdown format.`;
}

// ========== IEEE 830 Generic Prompts ==========

function buildGenericIntroductionPrompt(
  section: TemplateSectionDefinition,
  context: PromptBuilderContext
): string {
  return `Generate Section ${section.number} (${section.title}) for an IEEE 830 Software Requirements Specification.

**Document Title**: ${context.specTitle}
**Section Purpose**: ${section.description}

Include the following subsections:
1. Purpose - Document purpose and intended audience
2. Scope - System overview, benefits, objectives, goals
3. Definitions, Acronyms, Abbreviations
4. References - Documents referenced in this SRS
5. Overview - Organization of the rest of the SRS

Requirements from BRS:
${JSON.stringify(context.brsAnalysis, null, 2)}

${DIAGRAM_PLACEHOLDER_REQUIREMENTS}

${context.userGuidance ? `\nAdditional User Guidance:\n${context.userGuidance}\n` : ''}

Generate the complete introduction section now in markdown format.`;
}

function buildGenericOverallDescriptionPrompt(
  section: TemplateSectionDefinition,
  context: PromptBuilderContext
): string {
  return `Generate Section ${section.number} (${section.title}) for an IEEE 830 Software Requirements Specification.

**Section Purpose**: ${section.description}

Include:
- Product Perspective (system interfaces, user interfaces, hardware interfaces, software interfaces, communications interfaces, memory, operations, site adaptation)
- Product Functions (summary of major functions)
- User Characteristics (education, experience, technical expertise)
- Constraints (regulatory policies, hardware limitations, interfaces to other applications, parallel operations, audit functions, control functions, higher-order language requirements, signal handshake protocols, reliability requirements, criticality of the application, safety and security considerations)
- Assumptions and Dependencies

Requirements from BRS:
${JSON.stringify(context.brsAnalysis, null, 2)}

${DIAGRAM_PLACEHOLDER_REQUIREMENTS}

${context.userGuidance ? `\nAdditional User Guidance:\n${context.userGuidance}\n` : ''}

Generate the complete section now in markdown format.`;
}

function buildGenericSpecificRequirementsPrompt(
  section: TemplateSectionDefinition,
  context: PromptBuilderContext
): string {
  return `Generate Section ${section.number} (${section.title}) for an IEEE 830 Software Requirements Specification.

**Section Purpose**: ${section.description}

For each requirement, provide:
- [REQ-XXX-###] Unique identifier
- Requirement statement using "shall" (mandatory) or "should" (desirable)
- Rationale/justification
- Priority (essential, desirable, optional)
- Verification method (test, analysis, demonstration, inspection)

Organize by functional area. Include:
- Functional requirements (what the system shall do)
- Performance requirements (speed, capacity, throughput, reliability)
- Logical database requirements
- Design constraints
- Software system attributes (reliability, availability, security, maintainability, portability)

Requirements from BRS:
${JSON.stringify(context.brsAnalysis, null, 2)}

${DIAGRAM_PLACEHOLDER_REQUIREMENTS}

${context.userGuidance ? `\nAdditional User Guidance:\n${context.userGuidance}\n` : ''}

Generate the complete section now in markdown format with all requirements properly identified and structured.`;
}

// Stubs for remaining IEEE 830 prompts
function buildGenericExternalInterfacesPrompt(section: TemplateSectionDefinition, context: PromptBuilderContext): string {
  return buildGenericSectionPrompt(section, context);
}

function buildGenericSystemFeaturesPrompt(section: TemplateSectionDefinition, context: PromptBuilderContext): string {
  return buildGenericSectionPrompt(section, context);
}

function buildGenericPerformancePrompt(section: TemplateSectionDefinition, context: PromptBuilderContext): string {
  return buildGenericSectionPrompt(section, context);
}

function buildGenericDesignConstraintsPrompt(section: TemplateSectionDefinition, context: PromptBuilderContext): string {
  return buildGenericSectionPrompt(section, context);
}

function buildGenericSoftwareAttributesPrompt(section: TemplateSectionDefinition, context: PromptBuilderContext): string {
  return buildGenericSectionPrompt(section, context);
}

// ========== ISO 29148 Generic Prompts ==========

function buildGenericReferencesPrompt(section: TemplateSectionDefinition, context: PromptBuilderContext): string {
  return buildGenericSectionPrompt(section, context);
}

function buildGenericDefinitionsPrompt(section: TemplateSectionDefinition, context: PromptBuilderContext): string {
  return buildGenericSectionPrompt(section, context);
}

function buildGenericStakeholderRequirementsPrompt(section: TemplateSectionDefinition, context: PromptBuilderContext): string {
  return buildGenericSectionPrompt(section, context);
}

function buildGenericSystemRequirementsPrompt(section: TemplateSectionDefinition, context: PromptBuilderContext): string {
  return buildGenericSectionPrompt(section, context);
}

function buildGenericVerificationPrompt(section: TemplateSectionDefinition, context: PromptBuilderContext): string {
  return buildGenericSectionPrompt(section, context);
}

function buildGenericAppendicesPrompt(section: TemplateSectionDefinition, context: PromptBuilderContext): string {
  return buildGenericSectionPrompt(section, context);
}

// ========== Template-Aware Markdown Formatting ==========

/**
 * Build template-specific markdown formatting instructions
 * Uses MarkdownGenerationGuidance from template analysis
 */
export function buildTemplateFormattingInstructions(
  guidance: import('../../../types').MarkdownGenerationGuidance | null
): string {
  if (!guidance) {
    // No template guidance available, return minimal instructions
    return `
**Markdown Formatting Guidelines**:
- Use ATX-style headings (# syntax)
- Include blank lines before and after headings, paragraphs, lists
- Use standard markdown tables
- Use fenced code blocks with language hints (\`\`\`typescript)
`;
  }

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 TEMPLATE-SPECIFIC MARKDOWN FORMATTING REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The user has uploaded a corporate Word template. To ensure optimal compatibility
and formatting when exported via Pandoc, follow these requirements EXACTLY:

## Heading Levels

- Use heading levels 1 through ${guidance.headingLevels.maxDepth} only (# through ${'#'.repeat(guidance.headingLevels.maxDepth)})
- ${guidance.headingLevels.numberingStyle}
- Leave blank line before and after each heading

## Figure References

- Format: ${guidance.figureFormat.syntax}
- Numbering pattern: ${guidance.figureFormat.numberingPattern}
- Caption placement: ${guidance.figureFormat.captionPlacement} the image
- Example: \`![Figure 4-1: Service Architecture](diagrams/arch.png)\`

## Table References

- Format: Standard markdown tables with caption ${guidance.tableFormat.captionPlacement}
- Numbering pattern: ${guidance.tableFormat.numberingPattern}
- Example:
  \`\`\`
  Table 4-1: Performance Requirements

  | Metric | Target | Unit |
  |--------|--------|------|
  | Latency | < 10 | ms |
  \`\`\`

## Lists

- Bullet lists: Use "${guidance.listFormat.bulletChar}" character
- Ordered lists: Use "${guidance.listFormat.orderedStyle}" format
- Maintain consistent indentation (2 spaces per level)

## Code Blocks

${guidance.codeBlockStyle.fenced
  ? `- Use fenced code blocks with triple backticks: \`\`\`
${guidance.codeBlockStyle.languageHints ? '- Include language hint: ```typescript' : '- No language hints needed'}`
  : '- Use indented code blocks (4 spaces)'
}

## Emphasis

- Bold: ${guidance.emphasis.bold}text${guidance.emphasis.bold}
- Italic: ${guidance.emphasis.italic}text${guidance.emphasis.italic}

## Section Breaks

${guidance.sectionBreaks.usePageBreaks
  ? `- Use "${guidance.sectionBreaks.pattern}" for page breaks between major sections`
  : '- Do not use explicit page breaks (Pandoc will handle based on template)'
}

## CRITICAL: Pandoc Markdown Best Practices

1. **Headings**: Always use ATX-style headings (# syntax), never Setext-style (underlines)
2. **Blank Lines**: Include blank line before and after:
   - Headings
   - Paragraphs
   - Lists
   - Code blocks
   - Tables
3. **Consistent Spacing**: Use single blank line to separate elements (not 2+)
4. **No HTML**: Avoid inline HTML - use pure markdown syntax only
5. **Link Format**: Use markdown links \`[text](url)\` not HTML \`<a href="">\`
6. **Image Attributes**: Use simple \`![alt](path)\` format - Pandoc will apply template styling

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Following these guidelines will ensure your markdown exports perfectly to the user's Word template.
`;
}
