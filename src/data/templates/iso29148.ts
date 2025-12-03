/**
 * ISO/IEC/IEEE 29148 Requirements Specification Template
 *
 * Standard template for requirements specifications
 * following ISO/IEC/IEEE 29148:2018 (Systems and software engineering — Life cycle processes — Requirements engineering).
 *
 * Used for: Enterprise systems, safety-critical systems, government/defense projects
 *
 * UPDATED: Now uses flexible sections that can be modified, reordered, or customized.
 * These are suggestions - users can adapt, add, remove, or completely restructure.
 */

import type { SpecificationTemplate, FlexibleSection, DomainConfig } from '../../types';

/**
 * Domain configuration for ISO 29148 general specifications
 */
export const generalDomainConfig: DomainConfig = {
  domain: 'systems engineering',
  industry: 'general',
  standards: ['ISO/IEC/IEEE 29148:2018', 'ISO/IEC/IEEE 15288', 'ISO/IEC 25010'],
  normativeLanguage: 'ISO',
  terminology: {
    'Stakeholder': 'Individual or organization having a right, share, claim, or interest in a system',
    'Requirement': 'Statement that translates or expresses a need and its associated constraints and conditions',
    'System': 'Combination of interacting elements organized to achieve one or more stated purposes',
    'Verification': 'Confirmation that specified requirements have been fulfilled',
    'Validation': 'Confirmation that the stakeholder requirements have been met',
    'Traceability': 'Ability to follow the life of a requirement in both a forward and backward direction',
  },
};

/**
 * Suggested sections for ISO/IEC/IEEE 29148 Requirements Specification
 * These are starting points - users can modify titles, descriptions, and order
 */
export const suggestedSectionsISO29148: FlexibleSection[] = [
  {
    id: 'introduction',
    title: 'Introduction',
    description: `System overview, document purpose, intended audience, and document conventions.

Include:
- System purpose and objectives
- System scope and boundaries
- Intended audience for this document
- Document conventions and terminology
- Overview of document organization`,
    isRequired: false,
    suggestedSubsections: ['System Purpose', 'System Scope', 'Intended Audience', 'Document Conventions', 'Overview'],
    order: 1,
  },
  {
    id: 'references',
    title: 'References',
    description: `Normative and informative references.

Include:
- Normative references (standards that must be followed)
- Informative references (standards for background information)
- Related documents and specifications
- External standards and regulations`,
    isRequired: false,
    order: 2,
  },
  {
    id: 'definitions',
    title: 'Definitions and Acronyms',
    description: `Terms, definitions, abbreviations, and acronyms used in this document.

Include:
- Domain-specific terminology
- Abbreviations and their expansions
- Technical terms and their definitions
- Cross-references to standard glossaries`,
    isRequired: false,
    suggestedSubsections: ['Terms and Definitions', 'Abbreviations'],
    order: 3,
  },
  {
    id: 'stakeholder-requirements',
    title: 'Stakeholder Requirements',
    description: `Business, user, and operational requirements from stakeholder perspective.

Include:
- Business requirements (organizational goals and objectives)
- User requirements (what users need to accomplish)
- Operational requirements (how the system will be operated)
- Constraints from stakeholders
- Priority and rationale for each requirement

Format: [STK-XXX-###] with priority, source, and verification method.`,
    isRequired: false,
    suggestedSubsections: ['Business Requirements', 'User Requirements', 'Operational Requirements', 'Constraints'],
    order: 4,
  },
  {
    id: 'system-requirements',
    title: 'System Requirements',
    description: `Functional and non-functional requirements for the system.

Include:
- Functional requirements (what the system must do)
- Performance requirements (how well it must perform)
- Interface requirements (how it connects to other systems)
- Design constraints (limitations on design choices)
- Quality requirements (reliability, security, etc.)

Each requirement must be:
- Necessary, Implementation-free, Unambiguous, Consistent
- Complete, Singular, Feasible, Verifiable, Correct

Format: [SYS-XXX-###] with attributes (priority, risk, verification method, source).`,
    isRequired: false,
    suggestedSubsections: ['Functional Requirements', 'Performance Requirements', 'Interface Requirements', 'Design Constraints', 'Quality Requirements'],
    order: 5,
  },
  {
    id: 'verification',
    title: 'Verification',
    description: `Verification methods, acceptance criteria, and test requirements.

Include:
- Verification approach (test, analysis, demonstration, inspection)
- Verification matrix (requirements to verification methods)
- Acceptance criteria for each requirement
- Test environment requirements
- Test data requirements`,
    isRequired: false,
    suggestedSubsections: ['Verification Approach', 'Verification Matrix', 'Acceptance Criteria', 'Test Environment'],
    order: 6,
  },
  {
    id: 'appendices',
    title: 'Appendices',
    description: `Supporting information, models, and analysis results.

Include:
- Context diagrams (use {{fig:system-context}})
- Use case diagrams
- Data models
- Analysis results
- Traceability matrix`,
    isRequired: false,
    suggestedSubsections: ['Context Diagrams', 'Use Case Diagrams', 'Data Models', 'Traceability Matrix'],
    order: 7,
  },
];

export const templateISO29148: SpecificationTemplate = {
  id: 'iso-29148',
  name: 'ISO/IEC/IEEE 29148 Requirements Specification',
  description: 'Template for requirements specifications. Sections can be customized, reordered, or removed.',
  domain: 'general',
  version: '2.0',
  domainConfig: generalDomainConfig,
  suggestedSections: suggestedSectionsISO29148,
  // Legacy sections array for backward compatibility
  sections: [
    {
      id: 'introduction',
      number: '1',
      title: 'Introduction',
      description: 'System overview, document purpose, intended audience, document conventions',
      promptKey: 'buildISO29148IntroductionPrompt',
      required: true,
      allowSubsections: true,
      defaultEnabled: true,
    },
    {
      id: 'references',
      number: '2',
      title: 'References',
      description: 'Normative and informative references',
      promptKey: 'buildISO29148ReferencesPrompt',
      required: true,
      allowSubsections: false,
      defaultEnabled: true,
    },
    {
      id: 'definitions',
      number: '3',
      title: 'Definitions and Acronyms',
      description: 'Terms, definitions, abbreviations, and acronyms',
      promptKey: 'buildISO29148DefinitionsPrompt',
      required: true,
      allowSubsections: true,
      defaultEnabled: true,
    },
    {
      id: 'stakeholder-requirements',
      number: '4',
      title: 'Stakeholder Requirements',
      description: 'Business, user, and operational requirements from stakeholder perspective',
      promptKey: 'buildISO29148StakeholderRequirementsPrompt',
      required: true,
      allowSubsections: true,
      defaultEnabled: true,
    },
    {
      id: 'system-requirements',
      number: '5',
      title: 'System Requirements',
      description: 'Functional and non-functional requirements for the system',
      promptKey: 'buildISO29148SystemRequirementsPrompt',
      required: true,
      allowSubsections: true,
      defaultEnabled: true,
    },
    {
      id: 'verification',
      number: '6',
      title: 'Verification',
      description: 'Verification methods, acceptance criteria, test requirements',
      promptKey: 'buildISO29148VerificationPrompt',
      required: false,
      allowSubsections: true,
      defaultEnabled: true,
    },
    {
      id: 'appendices',
      number: 'A',
      title: 'Appendices',
      description: 'Supporting information, models, analysis results',
      promptKey: 'buildISO29148AppendicesPrompt',
      required: false,
      allowSubsections: true,
      defaultEnabled: true,
    },
  ],
  formatGuidance: `This is an ISO/IEC/IEEE 29148:2018 Requirements Specification.

FORMATTING GUIDELINES:
- Requirements must be:
  * Necessary (essential to meet stakeholder needs)
  * Implementation-free (avoid design solutions)
  * Unambiguous (single interpretation)
  * Consistent (no conflicts)
  * Complete (all information present)
  * Singular (one requirement per statement)
  * Feasible (technically and economically achievable)
  * Verifiable (can be confirmed by test, inspection, demonstration, or analysis)
  * Correct (accurately stated)
  * Conforming (follows standards and regulations)

REQUIREMENT CLASSIFICATION:
- Functional Requirements: What the system shall do
- Performance Requirements: How well the system shall perform
- Interface Requirements: How the system shall interact
- Operational Requirements: Where and how the system shall operate
- Resource Requirements: Materials, personnel, facilities needed
- Verification Requirements: How requirements shall be verified
- Acceptance Requirements: Criteria for system acceptance
- Quality Requirements: Reliability, maintainability, safety, security
- Regulatory Requirements: Legal and compliance obligations

REQUIREMENT ATTRIBUTES:
Each requirement should have:
- Unique identifier (e.g., SRS-FUNC-001)
- Priority (essential, desirable, optional)
- Risk (high, medium, low)
- Verification method (test, analysis, demonstration, inspection)
- Source/rationale (stakeholder need or regulation)

TONE & STYLE:
- Formal, precise, objective
- Use "shall" for mandatory requirements
- Use "should" for goals or objectives
- Use "may" for permissible actions
- Avoid ambiguous terms (e.g., "adequate", "flexible", "normal", "typical")

STRUCTURE:
- Requirements organized by category (functional, performance, etc.)
- Clear traceability to stakeholder needs
- Include context diagrams, use cases, state models as needed
- Cross-reference related requirements and verification methods`,
  createdAt: new Date('2025-11-21'),
  modifiedAt: new Date('2025-11-21'),
  isBuiltIn: true,
};
