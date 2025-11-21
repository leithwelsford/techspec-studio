/**
 * IEEE 830 Software Requirements Specification Template
 *
 * Standard template for software requirements specifications
 * following IEEE Std 830-1998 (Recommended Practice for Software Requirements Specifications).
 *
 * Used for: Software product requirements, system specifications, application requirements
 */

import type { SpecificationTemplate } from '../../types';

export const templateIEEE830: SpecificationTemplate = {
  id: 'ieee-830',
  name: 'IEEE 830 Software Requirements Specification',
  description: 'Standard template for software requirements specifications (IEEE 830-1998)',
  domain: 'software',
  version: '1.0',
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
