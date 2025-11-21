/**
 * 3GPP Technical Specification Template
 *
 * Standard template for telecommunications technical specifications
 * following 3GPP (3rd Generation Partnership Project) formatting conventions.
 *
 * Used for: Network equipment specs, protocol implementations, service descriptions
 */

import type { SpecificationTemplate } from '../../types';

export const template3GPP: SpecificationTemplate = {
  id: '3gpp-ts',
  name: '3GPP Technical Specification',
  description: 'Standard template for telecommunications technical specifications (3GPP format)',
  domain: 'telecommunications',
  version: '1.0',
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
- Each major section starts with ### (h3)
- Subsections use #### (h4) and ##### (h5)
- Keep hierarchy depth reasonable (typically max 3 levels)
- Use numbered lists for procedures, bulleted lists for features`,
  createdAt: new Date('2025-11-21'),
  modifiedAt: new Date('2025-11-21'),
  isBuiltIn: true,
};
