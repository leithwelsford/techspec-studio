/**
 * ISO/IEC/IEEE 29148 Requirements Specification Template
 *
 * Standard template for requirements specifications
 * following ISO/IEC/IEEE 29148:2018 (Systems and software engineering — Life cycle processes — Requirements engineering).
 *
 * Used for: Enterprise systems, safety-critical systems, government/defense projects
 */

import type { SpecificationTemplate } from '../../types';

export const templateISO29148: SpecificationTemplate = {
  id: 'iso-29148',
  name: 'ISO/IEC/IEEE 29148 Requirements Specification',
  description: 'Standard template for requirements specifications (ISO/IEC/IEEE 29148:2018)',
  domain: 'general',
  version: '1.0',
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
