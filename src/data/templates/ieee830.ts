/**
 * IEEE 830 Software Requirements Specification Template
 *
 * Standard template for software requirements specifications
 * following IEEE Std 830-1998 (Recommended Practice for Software Requirements Specifications).
 *
 * Used for: Software product requirements, system specifications, application requirements
 *
 * UPDATED: Now uses flexible sections that can be modified, reordered, or customized.
 * These are suggestions - users can adapt, add, remove, or completely restructure.
 */

import type { SpecificationTemplate, FlexibleSection, DomainConfig } from '../../types';

/**
 * Domain configuration for IEEE 830 software specifications
 */
export const softwareDomainConfig: DomainConfig = {
  domain: 'software',
  industry: 'software engineering',
  standards: ['IEEE 830-1998', 'IEEE 1233', 'ISO/IEC 25010'],
  normativeLanguage: 'IEEE',
  terminology: {
    'SRS': 'Software Requirements Specification',
    'Functional Requirement': 'A requirement that specifies a function the system must perform',
    'Non-Functional Requirement': 'A requirement that specifies quality attributes or constraints',
    'Use Case': 'A description of how users interact with the system',
    'Stakeholder': 'A person or organization with an interest in the system',
    'Constraint': 'A restriction that limits the design or implementation',
  },
};

/**
 * Suggested sections for IEEE 830 Software Requirements Specification
 * These are starting points - users can modify titles, descriptions, and order
 */
export const suggestedSectionsIEEE830: FlexibleSection[] = [
  {
    id: 'introduction',
    title: 'Introduction',
    description: `Purpose, scope, definitions, references, and document overview.

Include:
- Purpose of this SRS document
- Scope of the software product
- Definitions, acronyms, and abbreviations
- References to other documents
- Overview of document organization`,
    isRequired: false,
    suggestedSubsections: ['Purpose', 'Scope', 'Definitions', 'References', 'Overview'],
    order: 1,
  },
  {
    id: 'overall-description',
    title: 'Overall Description',
    description: `Product perspective, functions, user characteristics, constraints, and assumptions.

Include:
- Product perspective (how it relates to other systems)
- Product functions (high-level summary)
- User classes and characteristics
- Operating environment
- Design and implementation constraints
- Assumptions and dependencies`,
    isRequired: false,
    suggestedSubsections: ['Product Perspective', 'Product Functions', 'User Classes', 'Operating Environment', 'Constraints', 'Assumptions'],
    order: 2,
  },
  {
    id: 'specific-requirements',
    title: 'Specific Requirements',
    description: `Detailed functional and non-functional requirements.

Include:
- Functional requirements with unique IDs (REQ-FUNC-001)
- Input/output specifications
- Processing logic descriptions
- Data requirements
- Error handling requirements

Format: [REQ-XXX-###] The system shall [action] [object] [qualifier]`,
    isRequired: false,
    suggestedSubsections: ['Functional Requirements', 'Data Requirements', 'Error Handling'],
    order: 3,
  },
  {
    id: 'external-interfaces',
    title: 'External Interface Requirements',
    description: `User interfaces, hardware interfaces, software interfaces, and communications interfaces.

Include:
- User interface requirements (screens, navigation, accessibility)
- Hardware interface requirements (devices, peripherals)
- Software interface requirements (APIs, databases, external services)
- Communications interface requirements (protocols, formats)`,
    isRequired: false,
    suggestedSubsections: ['User Interfaces', 'Hardware Interfaces', 'Software Interfaces', 'Communications Interfaces'],
    order: 4,
  },
  {
    id: 'system-features',
    title: 'System Features',
    description: `Detailed feature descriptions organized by feature.

For each feature, include:
- Feature name and description
- Stimulus/response sequences
- Functional requirements specific to this feature
- Priority (essential, desirable, optional)

Use {{fig:feature-name-diagram}} for feature flow diagrams.`,
    isRequired: false,
    suggestedSubsections: ['Feature 1: [Name]', 'Feature 2: [Name]', 'Feature N: [Name]'],
    order: 5,
  },
  {
    id: 'performance',
    title: 'Performance Requirements',
    description: `Speed, capacity, throughput, and reliability requirements.

Include quantifiable metrics:
- Response time requirements (e.g., "< 2 seconds for 95th percentile")
- Throughput requirements (e.g., "1000 transactions per second")
- Capacity requirements (e.g., "support 10,000 concurrent users")
- Resource utilization limits (CPU, memory, storage)`,
    isRequired: false,
    suggestedSubsections: ['Response Time', 'Throughput', 'Capacity', 'Resource Utilization'],
    order: 6,
  },
  {
    id: 'design-constraints',
    title: 'Design Constraints',
    description: `Standards compliance, hardware limitations, and technology constraints.

Include:
- Standards compliance requirements (e.g., WCAG 2.1, PCI-DSS)
- Hardware limitations (supported platforms, minimum specs)
- Technology constraints (required frameworks, languages, databases)
- Regulatory or legal constraints`,
    isRequired: false,
    suggestedSubsections: ['Standards Compliance', 'Hardware Limitations', 'Technology Constraints', 'Regulatory Constraints'],
    order: 7,
  },
  {
    id: 'software-attributes',
    title: 'Software System Attributes',
    description: `Reliability, availability, security, maintainability, and portability.

Include:
- Reliability (MTBF, error rates, recovery procedures)
- Availability (uptime requirements, maintenance windows)
- Security (authentication, authorization, data protection)
- Maintainability (code standards, documentation requirements)
- Portability (supported platforms, migration requirements)`,
    isRequired: false,
    suggestedSubsections: ['Reliability', 'Availability', 'Security', 'Maintainability', 'Portability'],
    order: 8,
  },
  {
    id: 'appendices',
    title: 'Appendices',
    description: `Glossary, analysis models, and supporting information.

Include:
- Glossary of terms
- Analysis models (data flow diagrams, class diagrams)
- Traceability matrix (requirements to design/test)
- Supporting information (prototypes, research)`,
    isRequired: false,
    suggestedSubsections: ['Glossary', 'Analysis Models', 'Traceability Matrix'],
    order: 9,
  },
];

export const templateIEEE830: SpecificationTemplate = {
  id: 'ieee-830',
  name: 'IEEE 830 Software Requirements Specification',
  description: 'Template for software requirements specifications. Sections can be customized, reordered, or removed.',
  domain: 'software',
  version: '2.0',
  domainConfig: softwareDomainConfig,
  suggestedSections: suggestedSectionsIEEE830,
  // Legacy sections array for backward compatibility
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      description: 'Purpose, scope, definitions, references, and overview',
      promptKey: 'buildIEEE830IntroductionPrompt',
      required: true,
      allowSubsections: true,
      defaultEnabled: true,
    },
    {
      id: 'overall-description',
      number: '2',
      title: 'Overall Description',
      description: 'Product perspective, functions, user characteristics, constraints, assumptions',
      promptKey: 'buildIEEE830OverallDescriptionPrompt',
      required: true,
      allowSubsections: true,
      defaultEnabled: true,
    },
    {
      id: 'specific-requirements',
      number: '3',
      title: 'Specific Requirements',
      description: 'Detailed functional and non-functional requirements',
      promptKey: 'buildIEEE830SpecificRequirementsPrompt',
      required: true,
      allowSubsections: true,
      defaultEnabled: true,
    },
    {
      id: 'external-interfaces',
      number: '4',
      title: 'External Interface Requirements',
      description: 'User interfaces, hardware interfaces, software interfaces, communications interfaces',
      promptKey: 'buildIEEE830ExternalInterfacesPrompt',
      required: false,
      allowSubsections: true,
      defaultEnabled: true,
    },
    {
      id: 'system-features',
      number: '5',
      title: 'System Features',
      description: 'Detailed feature descriptions organized by feature',
      promptKey: 'buildIEEE830SystemFeaturesPrompt',
      required: true,
      allowSubsections: true,
      defaultEnabled: true,
    },
    {
      id: 'performance',
      number: '6',
      title: 'Performance Requirements',
      description: 'Speed, capacity, throughput, reliability requirements',
      promptKey: 'buildIEEE830PerformancePrompt',
      required: false,
      allowSubsections: true,
      defaultEnabled: true,
    },
    {
      id: 'design-constraints',
      number: '7',
      title: 'Design Constraints',
      description: 'Standards compliance, hardware limitations, technology constraints',
      promptKey: 'buildIEEE830DesignConstraintsPrompt',
      required: false,
      allowSubsections: true,
      defaultEnabled: true,
    },
    {
      id: 'software-attributes',
      number: '8',
      title: 'Software System Attributes',
      description: 'Reliability, availability, security, maintainability, portability',
      promptKey: 'buildIEEE830SoftwareAttributesPrompt',
      required: false,
      allowSubsections: true,
      defaultEnabled: true,
    },
    {
      id: 'appendices',
      number: 'A',
      title: 'Appendices',
      description: 'Glossary, analysis models, supporting information',
      promptKey: 'buildIEEE830AppendicesPrompt',
      required: false,
      allowSubsections: true,
      defaultEnabled: true,
    },
  ],
  formatGuidance: `This is an IEEE 830-1998 Software Requirements Specification (SRS).

FORMATTING GUIDELINES:
- Requirements must be uniquely identified (e.g., REQ-FUNC-001, REQ-PERF-002)
- Use "shall" for mandatory requirements, "should" for desirable requirements
- Each requirement should be:
  * Correct (accurately states what's needed)
  * Unambiguous (single interpretation only)
  * Complete (all necessary info included)
  * Consistent (no conflicts with other requirements)
  * Ranked (by importance and/or stability)
  * Verifiable (testable)
  * Modifiable (easy to change)
  * Traceable (origins clear, referenced in other docs)

REQUIREMENT FORMAT:
[REQ-XXX-###] The system shall/should [action] [object] [qualifier]

Example: [REQ-FUNC-001] The system shall authenticate users within 3 seconds using OAuth 2.0.

TONE & STYLE:
- Formal, precise, unambiguous
- Use active voice ("The system shall...")
- Avoid vague terms (e.g., "fast", "user-friendly", "easy", "efficient")
- Use quantifiable metrics where possible

STRUCTURE:
- Requirements organized by functional area or by priority
- Use hierarchical numbering (1, 1.1, 1.1.1)
- Include use case diagrams, state diagrams, class diagrams as needed
- Cross-reference related requirements`,
  createdAt: new Date('2025-11-21'),
  modifiedAt: new Date('2025-11-21'),
  isBuiltIn: true,
};
