/**
 * 3GPP Technical Specification Template
 *
 * Standard template for telecommunications technical specifications
 * following 3GPP (3rd Generation Partnership Project) formatting conventions.
 *
 * Used for: Network equipment specs, protocol implementations, service descriptions
 *
 * UPDATED: Now uses flexible sections that can be modified, reordered, or customized.
 * These are suggestions - users can adapt, add, remove, or completely restructure.
 */

import type { SpecificationTemplate, FlexibleSection, DomainConfig } from '../../types';

/**
 * Domain configuration for 3GPP telecommunications specifications
 */
export const telecomDomainConfig: DomainConfig = {
  domain: 'telecommunications',
  industry: '3GPP mobile networks',
  standards: ['3GPP TS 23.501', '3GPP TS 23.502', '3GPP TS 23.503', '3GPP TS 29.500'],
  normativeLanguage: 'RFC2119',
  terminology: {
    'UE': 'User Equipment - mobile device',
    'gNB': 'gNodeB - 5G base station',
    'AMF': 'Access and Mobility Management Function',
    'SMF': 'Session Management Function',
    'UPF': 'User Plane Function',
    'PCF': 'Policy Control Function',
    'NRF': 'Network Repository Function',
    'AUSF': 'Authentication Server Function',
    'UDM': 'Unified Data Management',
    'NEF': 'Network Exposure Function',
  },
};

/**
 * Suggested sections for 3GPP Technical Specification
 * These are starting points - users can modify titles, descriptions, and order
 */
export const suggestedSections3GPP: FlexibleSection[] = [
  {
    id: 'scope',
    title: 'Scope',
    description: `Define the boundaries and coverage of this specification.

Include:
- Purpose and objectives of the specification
- What is explicitly in scope (systems, interfaces, functions)
- What is explicitly out of scope
- Target audience (implementers, operators, vendors)
- Relationship to other specifications`,
    isRequired: false,  // Even "standard" sections can be removed if not needed
    suggestedSubsections: ['Purpose', 'Applicability', 'Document Structure'],
    order: 1,
  },
  {
    id: 'service-overview',
    title: 'Service Overview',
    description: `High-level service description, objectives, and context.

Include:
- Business context and drivers
- Service description from customer perspective
- Key objectives and success criteria
- Architecture context (where this fits in the network)
- Dependencies on other services or systems`,
    isRequired: false,
    suggestedSubsections: ['Business Context', 'Service Description', 'Objectives', 'Architecture Context'],
    order: 2,
  },
  {
    id: 'functional-specification',
    title: 'Functional Specification',
    description: `Detailed functional requirements and features.

Include:
- Core functionality requirements
- Feature descriptions with unique identifiers
- Use cases or usage scenarios
- Input/output specifications
- Data requirements and formats`,
    isRequired: false,
    suggestedSubsections: ['Core Functions', 'Feature Requirements', 'Use Cases', 'Data Requirements'],
    order: 3,
  },
  {
    id: 'architecture-design',
    title: 'Solution Architecture and Design',
    description: `System architecture, components, interfaces, and procedures.

Include:
- High-level architecture diagram (use {{fig:system-architecture}})
- Component descriptions and responsibilities
- Interface definitions (reference points, APIs)
- Protocol specifications
- Call flows and procedures (use {{fig:...-call-flow}} placeholders)
- State machines if applicable`,
    isRequired: false,
    suggestedSubsections: ['Architecture Overview', 'Components', 'Interfaces', 'Procedures', 'Call Flows'],
    order: 4,
  },
  {
    id: 'non-functional',
    title: 'Non-Functional Requirements',
    description: `Performance, availability, security, and scalability requirements.

Include (in table format where appropriate):
- Performance requirements (latency, throughput, capacity)
- Availability targets (uptime, recovery time)
- Security requirements (authentication, encryption, access control)
- Scalability requirements (load handling, growth capacity)
- Compliance requirements`,
    isRequired: false,
    suggestedSubsections: ['Performance', 'Availability', 'Security', 'Scalability'],
    order: 5,
  },
  {
    id: 'oss-bss',
    title: 'OSS/BSS and Service Management',
    description: `Operational support systems, provisioning, assurance, and reporting.

Include:
- Service provisioning procedures
- Configuration management
- Identity and subscriber correlation
- Fault management and alarming
- Performance monitoring
- Reporting and analytics requirements`,
    isRequired: false,
    suggestedSubsections: ['Provisioning', 'Configuration', 'Fault Management', 'Performance Monitoring', 'Reporting'],
    order: 6,
  },
  {
    id: 'sla-summary',
    title: 'SLA Summary',
    description: `Service level agreements, measurement points, and commitments.

Include:
- SLA measurement points
- Service availability commitments
- Performance commitments by service variant
- Reporting procedures
- Escalation and penalty procedures`,
    isRequired: false,
    suggestedSubsections: ['Measurement Points', 'Availability SLAs', 'Performance SLAs', 'Reporting'],
    order: 7,
  },
  {
    id: 'open-items',
    title: 'Open Items',
    description: `Pending decisions, unresolved questions, and future work.

Include:
- Outstanding technical decisions
- Unresolved requirements
- Known gaps or limitations
- Items pending customer input
- Future enhancements (out of current scope)`,
    isRequired: false,
    order: 8,
  },
  {
    id: 'appendices',
    title: 'Appendices',
    description: `Abbreviations, references, glossary, and supporting materials.

Include:
- Abbreviations and acronyms
- Normative references (standards that must be followed)
- Informative references (standards for background)
- Glossary of terms
- Design rationale (why decisions were made)`,
    isRequired: false,
    suggestedSubsections: ['Abbreviations', 'Normative References', 'Informative References', 'Glossary'],
    order: 9,
  },
];

export const template3GPP: SpecificationTemplate = {
  id: '3gpp-ts',
  name: '3GPP Technical Specification',
  description: 'Template for telecommunications technical specifications. Sections can be customized, reordered, or removed.',
  domain: 'telecommunications',
  version: '2.0',
  domainConfig: telecomDomainConfig,
  suggestedSections: suggestedSections3GPP,
  // Legacy sections array for backward compatibility
  sections: [
    {
      id: 'scope',
      number: '1',
      title: 'Scope',
      description: 'Define the boundaries and coverage of this specification',
      promptKey: 'build3GPPScopePrompt',
      required: true,
      allowSubsections: false,
      defaultEnabled: true,
    },
    {
      id: 'service-overview',
      number: '2',
      title: 'Service Overview',
      description: 'High-level service description, objectives, and context',
      promptKey: 'buildServiceOverviewPrompt',
      required: true,
      allowSubsections: true,
      defaultEnabled: true,
    },
    {
      id: 'functional-specification',
      number: '3',
      title: 'Functional Specification',
      description: 'Detailed functional requirements and features',
      promptKey: 'build3GPPFunctionalRequirementsPrompt',
      required: true,
      allowSubsections: true,
      defaultEnabled: true,
    },
    {
      id: 'architecture-design',
      number: '4',
      title: 'Solution Architecture and Design',
      description: 'System architecture, components, interfaces, and procedures',
      promptKey: 'buildArchitectureAndProceduresPrompt',
      required: true,
      allowSubsections: true,
      defaultEnabled: true,
    },
    {
      id: 'non-functional',
      number: '5',
      title: 'Non-Functional Requirements',
      description: 'Performance, availability, security, scalability requirements',
      promptKey: 'buildNonFunctionalRequirementsPrompt',
      required: false,
      allowSubsections: true,
      defaultEnabled: true,
    },
    {
      id: 'oss-bss',
      number: '6',
      title: 'OSS/BSS and Service Management',
      description: 'Operational support systems, provisioning, assurance, reporting',
      promptKey: 'buildOSSBSSPrompt',
      required: false,
      allowSubsections: true,
      defaultEnabled: true,
    },
    {
      id: 'sla-summary',
      number: '7',
      title: 'SLA Summary',
      description: 'Service level agreements, measurement points, commitments',
      promptKey: 'buildSLASummaryPrompt',
      required: false,
      allowSubsections: true,
      defaultEnabled: true,
    },
    {
      id: 'open-items',
      number: '8',
      title: 'Open Items',
      description: 'Pending decisions, unresolved questions, future work',
      promptKey: 'buildOpenItemsPrompt',
      required: false,
      allowSubsections: false,
      defaultEnabled: true,
    },
    {
      id: 'appendices',
      number: '9',
      title: 'Appendices',
      description: 'Abbreviations, references, glossary, supporting materials',
      promptKey: 'buildAppendicesPrompt',
      required: true,
      allowSubsections: true,
      defaultEnabled: true,
    },
  ],
  formatGuidance: `This is a 3GPP-style Technical Specification Document (TSD).

FORMATTING GUIDELINES:
- Use normative language (SHALL, MUST, SHOULD, MAY) per RFC 2119
- Reference 3GPP specifications using standard notation (e.g., "TS 23.203")
- Use standard 3GPP terminology (UE, eNB, MME, PCRF, PDN-GW, etc.)
- Include reference points/interfaces (Gx, Sd, Gy, Gz, RADIUS, etc.)
- Number sections hierarchically (1, 1.1, 1.1.1)
- Use block diagrams for architecture, sequence diagrams for procedures
- Include figure placeholders: {{fig:diagram-id}} with TODO comments for requirements

TONE & STYLE:
- Formal, technical, precise
- Use present tense for specifications
- Use passive voice for system behavior ("The PCRF SHALL notify...")
- Use active voice for requirements ("The operator SHALL configure...")

STRUCTURE:
- DO NOT include title, subtitle, author, date, or version in the markdown content
- START DIRECTLY with the first content section (e.g., "# 1. Scope")
- Each major section starts with # (h1) - example: "# 1. Scope"
- Subsections use ## (h2) - example: "## 1.1 Overview"
- Sub-subsections use ### (h3) - example: "### 1.1.1 Purpose"
- Keep hierarchy depth reasonable (typically max 3 levels)
- Use numbered lists for procedures, bulleted lists for features
- Title page elements (title, author, version, TOC, document control) are handled by export system`,
  createdAt: new Date('2025-11-21'),
  modifiedAt: new Date('2025-11-21'),
  isBuiltIn: true,
};
