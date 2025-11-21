/**
 * Template-Based Prompt System
 *
 * Generic prompt builders that work with any template configuration.
 * Maps template section definitions to appropriate prompt generation logic.
 */

import type { TemplateSectionDefinition, BRSDocument } from '../../../types';
import type { BRSAnalysis } from '../types';
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
  };
  userGuidance?: string;
  availableDiagrams?: Array<{ id: string; title: string; type: string }>;
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
  // 3GPP prompts
  'build3GPPScopePrompt': (section, context) => {
    return build3GPPScopePrompt(
      context.specTitle,
      context.brsAnalysis,
      context.brsDocument.metadata,
      context.userGuidance
    );
  },

  'buildServiceOverviewPrompt': (section, context) => {
    return buildServiceOverviewPrompt(
      context.specTitle,
      context.brsAnalysis,
      context.brsDocument.metadata,
      context.userGuidance
    );
  },

  'build3GPPFunctionalRequirementsPrompt': (section, context) => {
    return build3GPPFunctionalRequirementsPrompt(
      context.brsAnalysis,
      context.userGuidance
    );
  },

  'buildArchitectureAndProceduresPrompt': (section, context) => {
    // Combined architecture + procedures section for 3GPP
    return buildArchitectureAndProceduresPrompt(section, context);
  },

  'buildNonFunctionalRequirementsPrompt': (section, context) => {
    return buildNonFunctionalRequirementsPrompt(
      context.brsAnalysis,
      context.userGuidance
    );
  },

  'buildOSSBSSPrompt': (section, context) => {
    return buildOSSBSSPrompt(
      context.brsAnalysis,
      context.userGuidance
    );
  },

  'buildSLASummaryPrompt': (section, context) => {
    return buildSLASummaryPrompt(
      context.brsAnalysis,
      context.userGuidance
    );
  },

  'buildOpenItemsPrompt': (section, context) => {
    return buildOpenItemsPrompt(
      context.brsAnalysis,
      context.userGuidance
    );
  },

  'buildAppendicesPrompt': (section, context) => {
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

  return builder(section, context);
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

Generate the complete section now in markdown format:`;
}

// ========== 3GPP-Specific Helpers ==========

function buildArchitectureAndProceduresPrompt(
  section: TemplateSectionDefinition,
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
