/**
 * Document Generation Prompts
 * Specialized prompts for creating and refining specification documents
 */

import type { AIContext } from '../../../types';
import { DIAGRAM_PLACEHOLDER_REQUIREMENTS, SHARED_DIAGRAM_GUIDANCE } from './systemPrompts';
import { buildInterfaceTerminologyHints } from './sectionPrompts';

/**
 * Diagram scope guidance for document planning
 * Helps AI identify shared vs unique diagrams before generating content
 */
const DIAGRAM_SCOPE_GUIDANCE = `
## Diagram Planning

When planning diagrams for the document:

1. **Identify shared diagrams first**
   - Architecture overview → likely shared across multiple sub-sections
   - Component diagrams → may apply to related sub-sections
   - Sequence diagrams → usually specific to one sub-section

2. **Plan diagram placement**
   - Place each shared diagram in the earliest relevant sub-section
   - Plan prose references for subsequent sub-sections

3. **Avoid diagram proliferation**
   - Don't create separate diagrams that show the same topology
   - Use prose references liberally
   - A document with 10 sections shouldn't have 10 similar architecture diagrams
`;

export interface DocumentGenerationRequest {
  title: string;
  sections?: string[];
  domain?: string;
  audience?: string;
  requirements?: string;
  context?: AIContext;
}

/**
 * Generate complete technical specification document
 *
 * This function is domain-agnostic - it adapts to any technical specification type
 * based on the domain and sections provided.
 */
export function buildDocumentGenerationPrompt(request: DocumentGenerationRequest): string {
  const {
    title,
    sections = [],
    domain,  // Optional - if not provided, remains generic
    audience = 'technical stakeholders',
    requirements = '',
    context
  } = request;

  // Generic default sections that work across domains
  const defaultSections = [
    '1. Introduction',
    '2. Requirements Overview',
    '3. System Architecture',
    '4. Detailed Requirements',
    '5. Implementation Guidelines',
    '6. Testing and Verification',
    '7. Appendices'
  ];

  const sectionList = sections.length > 0 ? sections : defaultSections;

  return `Generate a complete technical specification document with the following parameters:

Title: ${title}
${domain ? `Domain: ${domain}` : ''}
Target Audience: ${audience}

Document Structure:
${sectionList.map(s => `- ${s}`).join('\n')}

${requirements ? `Specific Requirements:\n${requirements}\n` : ''}

${context?.availableReferences && context.availableReferences.length > 0
  ? `Available Reference Documents:\n${context.availableReferences.map(r => `- ${r.title}${r.metadata?.spec ? ` (${r.metadata.spec})` : ''}`).join('\n')}\n`
  : ''}

${context?.userInstructions ? `Additional Instructions:\n${context.userInstructions}\n` : ''}

CRITICAL FORMATTING RULES:
- DO NOT include title, subtitle, author, date, or version in the markdown
- DO NOT create a "Title Page" or "Document Control" section
- START DIRECTLY with the first content section
- Use # (single hash) for main sections (e.g., "# 1. Scope")
- Use ## (double hash) for subsections (e.g., "## 1.1 Overview")
- Use ### (triple hash) for sub-subsections (e.g., "### 1.1.1 Purpose")
- **IMPORTANT**: Subsections ALWAYS start at .1, never .0 (e.g., 5.1, 5.2, NOT 5.0)

For each section:
1. Start with a clear section heading using proper markdown hierarchy
2. Provide a brief introduction to the section's purpose
3. Include detailed technical content with:
   - Definitions and terminology (use EXACT terms from reference documents)
   - Technical requirements using normative language
   - Specific parameters, values, and constraints
   - Protocol flows and procedures where applicable, using specific command/message names
     from references (e.g., "CCR-I/CCA-I exchange" not "policy request/response")
   - State machines and transitions using terminology from standards
4. Reference standards and specifications using:
   {{ref:reference-id}} when citing external documents
5. Use tables for complex data structures
6. Include examples or use cases where appropriate

${DIAGRAM_PLACEHOLDER_REQUIREMENTS}

${DIAGRAM_SCOPE_GUIDANCE}

${SHARED_DIAGRAM_GUIDANCE}

${buildInterfaceTerminologyHints(requirements + (context?.userInstructions || ''))}

Output Format:
- Clean markdown starting with # for top-level sections
- Proper heading hierarchy (# → ## → ###)
- Well-organized with clear logical flow
- Technical accuracy is paramount
- NO title page elements (handled separately by export system)
- Professional tone suitable for ${audience}

Generate the complete document now.`;
}

/**
 * Generate a specific section of a document
 */
export function buildSectionGenerationPrompt(
  sectionTitle: string,
  sectionNumber: string,
  requirements: string = '',
  context?: AIContext
): string {
  return `Generate content for the following section of a technical specification:

Section: ${sectionNumber} ${sectionTitle}

${requirements ? `Requirements:\n${requirements}\n` : ''}

${context?.currentDocument
  ? `Document Context:\nThis section is part of a larger specification. Here's the existing content for context:\n${context.currentDocument.substring(0, 2000)}...\n`
  : ''}

${context?.selectedSection
  ? `Related Content:\n${context.selectedSection}\n`
  : ''}

${context?.availableDiagrams && context.availableDiagrams.length > 0
  ? `Available Diagrams (reference these where relevant):\n${context.availableDiagrams.map(d => `- {{fig:${d.id}}} - ${d.title}`).join('\n')}\n`
  : ''}

${context?.availableReferences && context.availableReferences.length > 0
  ? `Available References:\n${context.availableReferences.map(r => `- {{ref:${r.id}}} - ${r.title}`).join('\n')}\n`
  : ''}

Section Requirements:
1. Start with heading: ## ${sectionNumber} ${sectionTitle}
2. Provide comprehensive coverage of the topic
3. Use subsections (###) to organize complex content
4. Include:
   - Clear definitions of key concepts
   - Technical requirements with normative language
   - Specific parameters and constraints
   - Relevant protocol flows or procedures
   - References to diagrams and external documents
5. Use tables for structured data
6. Maintain professional technical writing style
7. Suggest diagrams with TODO placeholders if needed

Output only the section content in markdown format.`;
}

/**
 * Refine existing section based on feedback
 */
export function buildSectionRefinementPrompt(
  sectionTitle: string,
  currentContent: string,
  refinementRequest: string
): string {
  return `Refine the following section based on the user's request:

Section: ${sectionTitle}

Current Content:
${currentContent}

Refinement Request:
${refinementRequest}

Instructions:
1. Carefully analyze what the user wants changed
2. Make the requested improvements while preserving what works
3. Maintain the technical accuracy and professionalism
4. Keep the same overall structure unless the request implies otherwise
5. For diagram references:
   - Preserve existing {{fig:...}} references unless they need updating
   - When suggesting NEW diagrams, use descriptive kebab-case IDs like:
     {{fig:system-architecture-overview}}
     {{fig:call-flow-registration}}
     {{fig:protocol-stack}}
   - DO NOT use random IDs or timestamps
   - Add a caption line after the reference: *Figure X.Y: Descriptive Title*
6. Preserve all citations {{ref:...}} unless they need updating
7. Ensure the refined content flows naturally

Common refinement types:
- "More technical": Add deeper technical details, specifications, parameters
- "More normative": Strengthen language with SHALL/MUST requirements
- "Simplify": Make more accessible, reduce complexity
- "Expand": Add more detail, examples, or coverage
- "Add examples": Include concrete use cases or scenarios
- "More formal": Increase professional tone, reduce casual language

CRITICAL OUTPUT REQUIREMENTS:
- Output ONLY the actual refined section content
- DO NOT add placeholder text like "[Previous sections remain unchanged]" or "[Section 1-3 unchanged]"
- DO NOT add meta-commentary, explanations, or notes about what you changed
- DO NOT add markdown comments or TODO notes about sections you're not changing
- The output must be clean, production-ready markdown that can be directly inserted
- If you're only refining one section, output ONLY that section's content`;
}

/**
 * Generate introduction section
 */
export function buildIntroductionPrompt(
  documentTitle: string,
  scope: string = '',
  context?: AIContext
): string {
  return `Generate an Introduction section for a technical specification document.

Document Title: ${documentTitle}

${scope ? `Scope:\n${scope}\n` : ''}

The introduction should include:

## 1.1 Purpose
- Clearly state the purpose of this specification
- Identify the target audience
- Explain how this document should be used

## 1.2 Scope
- Define what is covered in this specification
- Explicitly state what is out of scope
- Identify any prerequisites or dependencies

## 1.3 Document Structure
- Provide a brief overview of how the document is organized
- Summarize what each major section covers

## 1.4 References
- List key reference documents (link using {{ref:...}} syntax)
- Identify relevant standards and specifications

${context?.availableReferences && context.availableReferences.length > 0
  ? `Available References:\n${context.availableReferences.map(r => `- {{ref:${r.id}}} - ${r.title}`).join('\n')}\n`
  : ''}

## 1.5 Definitions and Acronyms
- Define key terms used throughout the document
- List acronyms with full expansions
- Include only the most critical terms here (detailed glossary may be in an appendix)

Format: Use proper markdown with heading hierarchy (# for main sections, ## for subsections, ### for sub-subsections).
Tone: Professional, clear, and welcoming to the target audience.

Generate the complete Introduction section now.`;
}

/**
 * Generate technical requirements section
 */
export function buildRequirementsPrompt(
  category: string,
  requirements: string = '',
  context?: AIContext
): string {
  return `Generate a Technical Requirements section for: ${category}

${requirements ? `Specific Requirements:\n${requirements}\n` : ''}

${context?.availableReferences && context.availableReferences.length > 0
  ? `Reference Documents Available:\n${context.availableReferences.map(r => `- {{ref:${r.id}}} - ${r.title}`).join('\n')}\n`
  : ''}

The requirements section should:

1. **Functional Requirements**
   - List specific capabilities the system SHALL provide
   - Use clear, testable requirement statements
   - Format: REQ-[CATEGORY]-### for traceability
   - Example: "REQ-FUNC-001: The system SHALL support [specific capability]..."

2. **Performance Requirements**
   - Specify quantitative performance criteria
   - Include thresholds, limits, and targets
   - Cover relevant metrics (latency, throughput, capacity, response time, etc.)

3. **Interface Requirements**
   - Define required interfaces and APIs
   - Specify data formats and parameters
   - Reference relevant standards or specifications

4. **Quality Requirements**
   - Define quality attributes and service levels
   - Specify reliability, availability, and maintainability targets
   - Include any service level agreement (SLA) parameters

5. **Conformance Requirements**
   - Specify compliance with applicable standards
   - Identify mandatory vs. optional features
   - Define acceptance and testing criteria

Format:
- Use numbered requirement statements
- Include requirement IDs for traceability
- Use normative language (SHALL/MUST/SHOULD/MAY) appropriately
- Add notes or rationale where helpful
- Use tables for complex requirement matrices

Ensure all requirements are:
- Clear and unambiguous
- Testable and verifiable
- Complete and consistent
- Properly referenced to standards

Generate the requirements section now.`;
}

/**
 * Generate architecture description
 */
export function buildArchitecturePrompt(
  systemName: string,
  components: string[] = [],
  context?: AIContext
): string {
  return `Generate a Reference Architecture section for: ${systemName}

${components.length > 0 ? `Key Components:\n${components.map(c => `- ${c}`).join('\n')}\n` : ''}

${context?.availableDiagrams && context.availableDiagrams.length > 0
  ? `Available Diagrams:\n${context.availableDiagrams.map(d => `- {{fig:${d.id}}} - ${d.title}`).join('\n')}\n`
  : ''}

The architecture section should include:

### Architecture Overview
- High-level description of the system architecture
- Key architectural principles and design decisions
- Reference to architecture diagrams (use {{fig:...}} syntax or suggest new diagrams)

### Functional Components
For each major component:
- **Component Name**: Brief description
- **Responsibilities**: What this component does
- **Interfaces**: How it connects to other components
- **Protocols/APIs**: Communication methods used

Example format:
#### X.Y.Z [Component Name]
[Brief description of the component's purpose]
- **Responsibilities**: [Key responsibilities]
- **Interfaces**: [Connections to other components]
- **Protocols/APIs**: [Communication protocols or APIs used]

### Interfaces
- Define interfaces and integration points between components
- Specify protocols, APIs, or data formats used
- Include interface requirements and constraints

### Deployment Architecture
- Describe typical deployment scenarios
- Address redundancy and scalability
- Include network topology considerations

### Data Flows
- Describe major data flows through the system
- Reference sequence diagrams where available
- Distinguish between different flow types (control, data, management) if applicable

Suggest diagrams using TODO placeholders:
{{fig:suggested-high-level-architecture}} <!-- TODO: Create high-level architecture diagram -->
{{fig:suggested-interface-overview}} <!-- TODO: Create interface diagram -->

Generate the complete architecture section now.`;
}

/**
 * Generate full technical specification from BRS
 * 3GPP-compliant structure with section-by-section generation
 */
export interface FullSpecificationRequest {
  brsDocument: {
    title: string;
    markdown: string;
    metadata: {
      customer?: string;
      version?: string;
      projectName?: string;
    };
  };
  specTitle: string;
  includeReferences?: boolean;
  context?: AIContext;
}


/**
 * Build prompt for analyzing BRS and extracting structured requirements
 *
 * Domain-agnostic version that extracts requirements from any type of
 * Business Requirements Specification document.
 */
export function buildBRSAnalysisPrompt(brsMarkdown: string, userGuidance?: string): string {
  return `Analyze the following Business Requirements Specification (BRS) document and extract structured information.

BRS Document:
${brsMarkdown}

${userGuidance ? `**IMPORTANT USER GUIDANCE:**
${userGuidance}

Please take the above guidance into account when analyzing the BRS. This may clarify ambiguities, specify deployment details, or provide additional context not explicit in the BRS document.

---

` : ''}Extract and categorize the following information:

1. **Architecture Requirements** (REQ-ARCH-*):
   - List all system components/elements mentioned
   - Identify interfaces and integration points
   - Extract deployment requirements

2. **Functional Requirements** (REQ-FUNC-*):
   - Core functionality requirements
   - Feature requirements
   - Integration requirements
   - Interface requirements

3. **Non-Functional Requirements** (REQ-NFR-*):
   - Performance requirements (throughput, latency, capacity)
   - Availability requirements (uptime, redundancy)
   - Security requirements (authentication, encryption)
   - Scalability requirements

4. **Procedures** (REQ-PROC-*):
   - Key operational workflows
   - State transition procedures
   - Error handling procedures
   - Recovery procedures

5. **Referenced Standards**:
   - Industry standards mentioned
   - Regulatory requirements
   - Other specifications (RFCs, ISO, IEEE, etc.)

Output the analysis in JSON format:
\`\`\`json
{
  "domain": "detected domain (e.g., telecommunications, software, healthcare, etc.)",
  "components": ["Component1", "Component2", ...],
  "interfaces": [{"name": "InterfaceName", "between": ["Component1", "Component2"], "protocol": "Protocol"}, ...],
  "requirementCategories": {
    "architecture": ["REQ-ARCH-001: ...", ...],
    "functional": ["REQ-FUNC-001: ...", ...],
    "performance": ["REQ-PERF-001: ...", ...],
    "availability": ["REQ-AVAIL-001: ...", ...],
    "security": ["REQ-SEC-001: ...", ...],
    "scalability": ["REQ-SCALE-001: ...", ...]
  },
  "procedures": [
    {
      "name": "Procedure Name",
      "steps": ["1. Step one...", "2. Step two...", ...],
      "participants": ["Actor1", "Actor2", ...]
    }
  ],
  "standards": [
    {"id": "StandardID", "title": "Standard Title", "relevance": "Why it's relevant"}
  ]
}
\`\`\``;
}

// =============================================================================
// LEGACY 3GPP/TELECOM PROMPT BUILDERS
// =============================================================================
//
// The 3GPP-specific prompt builders (build3GPPScopePrompt, build3GPPArchitecturePrompt,
// etc.) have been moved to ./legacyTelecomPrompts.ts to support the transition to
// domain-agnostic specifications.
//
// For new development, use the flexible section prompts in ./sectionPrompts.ts
// which work with any technical specification domain.
//
// For backward compatibility, the legacy functions are re-exported below.
// These are DEPRECATED and will be removed in a future version.
// =============================================================================

export {
  // 3GPP Section Builders (DEPRECATED - use sectionPrompts.ts instead)
  build3GPPScopePrompt,
  build3GPPReferencesPrompt,
  build3GPPDefinitionsPrompt,
  build3GPPArchitecturePrompt,
  build3GPPFunctionalRequirementsPrompt,
  build3GPPProceduresPrompt,
  build3GPPInformationElementsPrompt,
  build3GPPErrorHandlingPrompt,
  // Other Legacy Builders (DEPRECATED)
  buildServiceOverviewPrompt,
  buildNonFunctionalRequirementsPrompt,
  buildOSSBSSPrompt,
  buildSLASummaryPrompt,
  buildOpenItemsPrompt,
  buildAppendicesPrompt,
  // Legacy prompt registry
  legacyPromptBuilders,
} from './legacyTelecomPrompts';
