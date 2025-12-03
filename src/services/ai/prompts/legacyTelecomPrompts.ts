/**
 * Legacy Telecom-Specific Prompts
 *
 * @deprecated These functions are retained for backward compatibility with existing
 * telecom-focused templates. For new development, use the domain-agnostic
 * buildFlexibleSectionPrompt() from sectionPrompts.ts instead.
 *
 * These prompts are specifically designed for 3GPP telecommunications specifications
 * and contain hardcoded telecom terminology (PCRF, PCEF, Gx, Diameter, etc.).
 */

import type { AIContext } from '../../../types';
import { DIAGRAM_PLACEHOLDER_REQUIREMENTS } from './systemPrompts';

/**
 * Helper function to append user guidance to prompts
 */
function appendUserGuidance(basePrompt: string, userGuidance?: string): string {
  if (!userGuidance) return basePrompt;

  return `${basePrompt}

---

**IMPORTANT USER GUIDANCE:**
${userGuidance}

Please take this guidance into account when generating this section. This may clarify ambiguities, specify deployment details, or provide additional context.`;
}

/**
 * @deprecated Use buildFlexibleSectionPrompt() instead
 * Build prompt for analyzing BRS and extracting structured requirements (telecom-specific)
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
   - List all network components/elements mentioned
   - Identify interfaces and reference points
   - Extract deployment requirements

2. **Functional Requirements** (REQ-* categories):
   - Policy control requirements
   - Session management requirements
   - Traffic management requirements
   - Interface requirements

3. **Non-Functional Requirements**:
   - Performance requirements (throughput, latency, capacity)
   - Availability requirements (uptime, redundancy)
   - Security requirements (authentication, encryption)

4. **Procedures** (REQ-PROC-*):
   - Session establishment flows
   - Policy update procedures
   - Handover procedures
   - Error handling procedures

5. **Referenced Standards**:
   - 3GPP specifications mentioned (e.g., TS 23.203, TS 23.401)
   - Other standards (RFCs, etc.)

Output the analysis in JSON format:
\`\`\`json
{
  "components": ["PCRF", "PCEF", "TDF", ...],
  "interfaces": [{"name": "Gx", "between": ["PCEF", "PCRF"], "standard": "TS 29.212"}, ...],
  "requirementCategories": {
    "architecture": ["REQ-ARCH-001: ...", ...],
    "policy": ["REQ-POL-001: ...", ...],
    "session": ["REQ-SES-001: ...", ...],
    "traffic": ["REQ-TRF-001: ...", ...],
    "performance": ["REQ-PERF-001: ...", ...],
    "availability": ["REQ-AVAIL-001: ...", ...],
    "security": ["REQ-SEC-001: ...", ...]
  },
  "procedures": [
    {
      "name": "Session Establishment",
      "steps": ["1. UE initiates...", "2. SMP authenticates...", ...],
      "participants": ["UE", "SMP", "PCEF", "PCRF", "TDF"]
    }
  ],
  "standards": [
    {"id": "TS 23.203", "title": "Policy and Charging Control"},
    {"id": "TS 29.212", "title": "Gx Interface"}
  ]
}
\`\`\``;
}

/**
 * @deprecated Use buildFlexibleSectionPrompt() instead
 * Build prompt for 3GPP-compliant Section 1: Scope
 */
export function build3GPPScopePrompt(
  specTitle: string,
  brsAnalysis: any,
  metadata: any,
  userGuidance?: string
): string {
  const basePrompt = `Generate Section 1 (Scope) for a 3GPP-style technical specification.

Document Title: ${specTitle}
Project: ${metadata.projectName || 'Not specified'}
Customer: ${metadata.customer || 'Not specified'}

Based on BRS Analysis:
- Components: ${brsAnalysis.components?.join(', ') || 'Not specified'}
- Key Standards: ${brsAnalysis.standards?.map((s: any) => s.id).join(', ') || 'None'}

Section Requirements:
1. **Section Heading**: # 1. Scope
2. **Subsections**:
   ## 1.1 Purpose and Overview
   - State the purpose of this specification
   - Brief overview of what the specification covers

   ## 1.2 Document Structure
   - Brief description of how the document is organized
   - Reference the major sections (2-8)

3. **Content Guidelines**:
   - Clear, concise language
   - Define the boundaries (what's in scope, what's out of scope)
   - Reference applicable 3GPP standards
   - Professional tone for technical audience

IMPORTANT: Generate ONLY the complete Section 1 content in markdown format. Do NOT add placeholder text like "[Other sections to follow]" or meta-commentary.`;

  return appendUserGuidance(basePrompt, userGuidance);
}

/**
 * @deprecated Use buildFlexibleSectionPrompt() instead
 * Build prompt for 3GPP-compliant Section 2: References
 */
export function build3GPPReferencesPrompt(
  standards: Array<{ id: string; title: string }>,
  context?: AIContext,
  userGuidance?: string
): string {
  const existingRefs = context?.availableReferences || [];

  const basePrompt = `Generate Section 2 (References) for a 3GPP-style technical specification.

Standards from BRS:
${standards.map(s => `- **${s.id}**: "${s.title}"`).join('\n')}

${existingRefs.length > 0
    ? `Additional Available References:\n${existingRefs.map(r => `- ${r.title}${r.metadata?.spec ? ` (${r.metadata.spec})` : ''}`).join('\n')}\n`
    : ''}

Section Structure:
# 2. References

## 2.1 Normative References
List standards that are REQUIRED for implementation. Format:
- **[X]** 3GPP TS XX.XXX: "Title"
  Brief description of relevance to this specification.

## 2.2 Informative References
List standards that are HELPFUL but not required. Format:
- **[X]** IETF RFC XXXX: "Title"
  Brief description of how this reference provides context.

Guidelines:
- Use proper 3GPP reference format
- Include brief descriptions of why each reference is relevant
- Organize by type (3GPP specs, IETF RFCs, ITU standards, etc.)
- Use standard reference IDs like [1], [2], etc.

Generate the complete Section 2 now in markdown format.`;

  return appendUserGuidance(basePrompt, userGuidance);
}

/**
 * @deprecated Use buildFlexibleSectionPrompt() instead
 * Build prompt for 3GPP-compliant Section 3: Definitions and Abbreviations
 */
export function build3GPPDefinitionsPrompt(
  components: string[],
  brsMarkdown: string,
  userGuidance?: string
): string {
  const basePrompt = `Generate Section 3 (Definitions, Symbols, and Abbreviations) for a 3GPP-style technical specification.

Key Components/Terms from BRS:
${components.join(', ')}

BRS Context (extract relevant terms):
${brsMarkdown.substring(0, 3000)}...

Section Structure:
# 3. Definitions, Symbols, and Abbreviations

## 3.1 Definitions
Define key terms used in this specification. Format:
- **Term**: Definition
  (Include any clarifications or examples)

## 3.2 Symbols
Mathematical symbols or notation (if applicable). Format:
- **Symbol** - Description

## 3.3 Abbreviations
Alphabetically sorted list. Format:
| Abbreviation | Full Form |
|--------------|-----------|
| 3GPP | 3rd Generation Partnership Project |
| AAA | Authentication, Authorization, Accounting |

Guidelines:
- Include all technical terms that might be unfamiliar
- Define acronyms used throughout the document
- Use standard 3GPP definitions where applicable
- Alphabetical order for abbreviations
- Be comprehensive but concise

Generate the complete Section 3 now in markdown format.`;

  return appendUserGuidance(basePrompt, userGuidance);
}

/**
 * @deprecated Use buildFlexibleSectionPrompt() instead
 * Build prompt for 3GPP-compliant Section 4: Architecture
 */
export function build3GPPArchitecturePrompt(
  brsAnalysis: any,
  context?: AIContext,
  userGuidance?: string
): string {
  const basePrompt = `Generate Section 4 (Architecture) for a 3GPP-style technical specification.

Architecture Requirements from BRS:
${JSON.stringify(brsAnalysis.requirementCategories?.architecture || [], null, 2)}

Components:
${brsAnalysis.components?.join(', ') || 'Not specified'}

Interfaces:
${JSON.stringify(brsAnalysis.interfaces || [], null, 2)}

${context?.availableDiagrams && context.availableDiagrams.length > 0
    ? `Available Diagrams:\n${context.availableDiagrams.map(d => `- {{fig:${d.id}}} - ${d.title}`).join('\n')}\n`
    : ''}

Section Structure:
# 4. Architecture

## 4.1 Overview
- High-level architecture description
- Key architectural principles
- **Suggest block diagram**: {{fig:architecture-overview}} <!-- TODO: High-level system architecture -->

## 4.2 Functional Elements
For each component (PCRF, PCEF, TDF, etc.):
### 4.2.X Component Name
- **Function**: What it does
- **Responsibilities**: Key responsibilities
- **Interfaces**: Reference points to other elements
- **Standards Compliance**: Relevant 3GPP specs

## 4.3 Reference Points and Interfaces
Table of interfaces:
| Interface | Between | Protocol | Reference |
|-----------|---------|----------|-----------|
| Gx | PCEF - PCRF | Diameter | TS 29.212 |

## 4.4 Deployment Architecture
- Typical deployment scenarios
- Scalability considerations
- Redundancy and high availability
- **Suggest deployment diagram**: {{fig:deployment-architecture}} <!-- TODO: Deployment topology -->

Guidelines:
- Use normative language (SHALL/MUST/MAY)
- Reference 3GPP standards for interfaces
- For diagram placeholders:
  * Use descriptive kebab-case IDs (e.g., {{fig:system-architecture-overview}})
  * DO NOT use random strings, timestamps, or numbers
  * Add TODO comments explaining what the diagram should show
  * Add caption line: *Figure 4.X-Y: Descriptive Title*
- Examples of GOOD figure IDs:
  * {{fig:network-architecture}}
  * {{fig:protocol-stack}}
  * {{fig:interface-diagram-gx}}
- Examples of BAD figure IDs (DO NOT USE):
  * {{fig:1234567890}}
  * {{fig:abc123xyz}}
- Professional technical writing style

IMPORTANT: Generate ONLY the complete Section 4 content in markdown format. Do NOT add placeholder text like "[Previous sections unchanged]" or meta-commentary.`;

  return appendUserGuidance(basePrompt, userGuidance);
}

/**
 * @deprecated Use buildFlexibleSectionPrompt() instead
 * Build prompt for 3GPP-compliant Section 5: Functional Requirements
 */
export function build3GPPFunctionalRequirementsPrompt(
  brsAnalysis: any,
  userGuidance?: string
): string {
  const basePrompt = `Generate Section 3 (Functional Specification) for a 3GPP-style technical specification.

Requirements from BRS:
${JSON.stringify({
    policy: brsAnalysis.requirementCategories?.policy || [],
    session: brsAnalysis.requirementCategories?.session || [],
    traffic: brsAnalysis.requirementCategories?.traffic || [],
    performance: brsAnalysis.requirementCategories?.performance || [],
    availability: brsAnalysis.requirementCategories?.availability || [],
    security: brsAnalysis.requirementCategories?.security || []
  }, null, 2)}

Section Structure:
# 3. Functional Specification

## 3.1 Policy Control
- Transform BRS policy requirements into technical specifications
- Use normative language (SHALL/MUST/SHOULD/MAY)
- Include specific parameters (QCI, ARP, MBR, GBR, etc.)

## 3.2 Session Management
- Session establishment requirements
- Session lifecycle management
- Session failover and recovery
- **For any call flows or procedures**: Use diagram placeholders like {{fig:mobile-session-establishment}} <!-- TODO: Mobile session establishment sequence -->
- **DO NOT create text-based ASCII diagrams** - use {{fig:...}} placeholders instead

## 3.3 Traffic Management
- Traffic classification
- QoS enforcement
- Traffic shaping and policing
- **For traffic flow diagrams**: Use {{fig:traffic-classification-flow}} <!-- TODO: Traffic classification flowchart -->

## 3.4 Performance Requirements
- Throughput specifications
- Latency requirements
- Capacity requirements
- Scalability targets

## 3.5 Availability and Reliability
- Uptime requirements (e.g., 99.999%)
- Redundancy requirements
- Failover procedures
- **For failover sequences**: Use {{fig:failover-procedure}} <!-- TODO: Failover procedure sequence -->

## 3.6 Security Requirements
- Authentication mechanisms
- Encryption protocols
- Access control
- Audit logging
- **For authentication flows**: Use {{fig:authentication-flow}} <!-- TODO: Authentication sequence diagram -->

Guidelines:
- Transform BRS requirements into formal technical specifications
- Use tables for requirement matrices
- Include specific numeric values from BRS
- Use normative language appropriately
- Make requirements testable and verifiable
- **CRITICAL**: For ANY procedures, call flows, sequences, or state transitions, use {{fig:diagram-id}} placeholders
- **NEVER create text-based ASCII diagrams** - always use figure placeholders instead
- Examples of when to use {{fig:...}}:
  * Session establishment/teardown flows
  * Authentication sequences
  * Failover procedures
  * Traffic classification flows
  * State transitions

Generate the complete Section 3 now in markdown format.`;

  return appendUserGuidance(basePrompt, userGuidance);
}

/**
 * @deprecated Use buildFlexibleSectionPrompt() instead
 * Build prompt for 3GPP-compliant Section 6: Procedures
 */
export function build3GPPProceduresPrompt(
  brsAnalysis: any,
  userGuidance?: string
): string {
  const basePrompt = `Generate Section 6 (Procedures) for a 3GPP-style technical specification.

Procedures from BRS:
${JSON.stringify(brsAnalysis.procedures || [], null, 2)}

Section Structure:
# 6. Procedures

For each procedure (Session Establishment, Policy Update, Handover, etc.):
## 6.X Procedure Name

### 6.X.1 Overview
- Brief description of the procedure
- When it is triggered
- Expected outcomes

### 6.X.2 Message Flow
- Step-by-step message exchange
- **Suggest sequence diagram**: {{fig:procedure-name-flow}} <!-- TODO: Sequence diagram showing message flow -->
- Use numbered steps with participants clearly identified

Example format:
1. UE sends Attach Request to MME
2. MME forwards authentication request to SMP
3. SMP validates subscriber via AAA interface (RADIUS)
4. PCEF sends CCR-I (Credit Control Request Initial) to PCRF via Gx
5. PCRF returns CCA-I with policy rules and QoS parameters
6. PCEF establishes bearer with specified QoS
7. Session is established

### 6.X.3 Information Elements
- Key parameters exchanged
- Message formats (table format)
- Mandatory vs. optional fields

### 6.X.4 Error Handling
- Possible failure scenarios
- Error recovery procedures
- Timeout handling

Guidelines:
- Clear, step-by-step procedure descriptions
- Suggest sequence diagram placeholders
- Include timing requirements
- Reference relevant standards
- Cover both success and failure paths

IMPORTANT: Generate ONLY the complete Section 6 content in markdown format. Do NOT add placeholder text or meta-commentary.`;

  return appendUserGuidance(basePrompt, userGuidance);
}

/**
 * @deprecated Use buildFlexibleSectionPrompt() instead
 * Build prompt for 3GPP-compliant Section 7: Information Elements
 */
export function build3GPPInformationElementsPrompt(
  brsAnalysis: any,
  userGuidance?: string
): string {
  const basePrompt = `Generate Section 7 (Information Elements) for a 3GPP-style technical specification.

Context from BRS:
- Interfaces: ${JSON.stringify(brsAnalysis.interfaces || [])}
- Requirements: Policy parameters (QCI, ARP, MBR, GBR)

Section Structure:
# 7. Information Elements

## 7.1 Overview
- Brief introduction to information elements
- How they are used in the system

## 7.2 Policy Information Elements
Table format:
| IE Name | Type | Description | Mandatory | Reference |
|---------|------|-------------|-----------|-----------|
| QCI | Integer (1-9) | QoS Class Identifier | M | TS 23.203 |
| ARP | Struct | Allocation/Retention Priority | M | TS 29.212 |

## 7.3 Session Information Elements
Table of session-related parameters

## 7.4 Subscriber Profile Information
Table of subscriber attributes

## 7.5 Encoding Rules
- Data type specifications
- Encoding format (if applicable)
- Value ranges and constraints

Guidelines:
- Use tables for structured information
- Specify data types, ranges, and constraints
- Mark mandatory (M) vs. optional (O) fields
- Reference relevant 3GPP specifications
- Include examples where helpful

Generate the complete Section 7 now in markdown format.`;

  return appendUserGuidance(basePrompt, userGuidance);
}

/**
 * @deprecated Use buildFlexibleSectionPrompt() instead
 * Build prompt for 3GPP-compliant Section 8: Error Handling
 */
export function build3GPPErrorHandlingPrompt(
  brsAnalysis: any,
  userGuidance?: string
): string {
  const basePrompt = `Generate Section 8 (Error Handling) for a 3GPP-style technical specification.

Context from BRS:
- Components: ${brsAnalysis.components?.join(', ') || 'Not specified'}
- Interfaces: ${brsAnalysis.interfaces?.map((i: any) => i.name).join(', ') || 'Not specified'}

Section Structure:
# 8. Error Handling

## 8.1 General Error Handling Principles
- Error detection mechanisms
- Error reporting procedures
- Recovery strategies

## 8.2 Interface Errors
For each interface (Gx, Rx, S5/S8, AAA):
#### 8.2.X Interface Name Errors
- Connection failures
- Message format errors
- Timeout handling
- Protocol errors

## 8.3 System Errors
- Component failures
- Resource exhaustion
- Configuration errors
- State inconsistencies

## 8.4 Error Codes and Messages
Table format:
| Error Code | Description | Cause | Recovery Action |
|------------|-------------|-------|-----------------|
| ERR-GX-001 | PCRF unreachable | Network failure | Use cached policy, retry connection |

## 8.5 Logging and Monitoring
- Error logging requirements
- Alarm generation
- Monitoring and diagnostics

Guidelines:
- Cover all major error scenarios
- Provide clear recovery procedures
- Use error code taxonomy
- Reference standards for protocol errors
- Include fallback behaviors

Generate the complete Section 8 now in markdown format.`;

  return appendUserGuidance(basePrompt, userGuidance);
}

/**
 * @deprecated Use buildFlexibleSectionPrompt() instead
 * Build prompt for Section 2: Service Overview (from BRS summary)
 */
export function buildServiceOverviewPrompt(
  specTitle: string,
  brsAnalysis: any,
  brsMetadata: any,
  userGuidance?: string
): string {
  const basePrompt = `Generate Section 2 (Service Overview) for the technical specification.

This section should provide a high-level summary of the service based on the BRS document.

Context:
- Project: ${specTitle}
- Customer: ${brsMetadata.customer || 'Not specified'}
- Service Type: ${brsAnalysis.serviceType || '5G telecommunications service'}

Section Structure:
# 2. Service Overview

## 2.1 Service Description
Brief overview of what the service provides and its primary purpose.
(Summarize from BRS Section 1 - make it concise, 2-3 paragraphs)

## 2.2 Objectives
- List the main objectives of the service
- Focus on business and technical goals
- Include commercialization goals

## 2.3 Target Customer
- Describe the target customer segment
- Enterprise vs consumer
- Use cases and scenarios

## 2.4 Architecture Context
High-level architecture context:
- **Access:** What access technologies (5G NR, Fixed, etc.)
- **Core:** What core network elements (EPC, IMS, etc.)
- **Control Plane:** Policy and control mechanisms
- **User Plane:** Data path and enforcement points

Guidelines:
- Keep it high-level and business-focused
- This section sets the stage for technical details to follow
- Avoid deep technical details (those go in later sections)
- Focus on WHAT the service does, not HOW it's implemented

Generate the complete Section 2 now in markdown format.`;

  return appendUserGuidance(basePrompt, userGuidance);
}

/**
 * @deprecated Use buildFlexibleSectionPrompt() instead
 * Build prompt for Section 5: Non-Functional Requirements
 */
export function buildNonFunctionalRequirementsPrompt(
  brsAnalysis: any,
  userGuidance?: string
): string {
  const basePrompt = `Generate Section 5 (Non-Functional Requirements) for a 3GPP-style technical specification.

Context from BRS:
- Performance requirements: ${brsAnalysis.performance || 'Extract from BRS'}
- Availability requirements: ${brsAnalysis.availability || 'Extract from BRS'}
- Security requirements: ${brsAnalysis.security || 'Extract from BRS'}

Section Structure:
# 5. Non-Functional Requirements

Present in table format:

| Parameter | Requirement | Source |
|-----------|-------------|--------|
| **Performance** | | |
| Throughput | X Mbps per session | BRS §Y.Z |
| Latency | < X ms end-to-end | BRS §Y.Z |
| Concurrent Sessions | X,000 sessions | BRS §Y.Z |
| **Availability** | | |
| Service Uptime | 99.X% | BRS §Y.Z |
| Redundancy | Active-standby/Active-active | BRS §Y.Z |
| MTTR | < X hours | BRS §Y.Z |
| **Security** | | |
| Authentication | Method (e.g., EAP-AKA) | BRS §Y.Z |
| Encryption | Algorithm (e.g., AES-256) | BRS §Y.Z |
| Access Control | RADIUS/Diameter AAA | BRS §Y.Z |
| **Scalability** | | |
| Growth Capacity | X% annual growth | BRS §Y.Z |
| Geographic Coverage | Nationwide/Regional | BRS §Y.Z |

Guidelines:
- Extract NFRs from functional requirements in BRS
- Use table format for clarity
- Reference BRS sections for traceability
- Group by category (Performance, Availability, Security, Scalability)
- Include specific measurable values
- Link to SLA requirements in Section 7

Generate the complete Section 5 now in markdown format.`;

  return appendUserGuidance(basePrompt, userGuidance);
}

/**
 * @deprecated Use buildFlexibleSectionPrompt() instead
 * Build prompt for Section 6: OSS/BSS and Service Management
 */
export function buildOSSBSSPrompt(
  _brsAnalysis: any,  // Reserved for future use
  userGuidance?: string
): string {
  const basePrompt = `Generate Section 6 (OSS/BSS and Service Management) for a 3GPP-style technical specification.

Section Structure:
# 6. OSS/BSS and Service Management

## 6.1 Provisioning & Identity Correlation (Fixed + Mobile)
- Service activation workflow
- Customer identity management
- Correlation between fixed and mobile identities (if applicable)
- SIM/IMSI provisioning
- CPE/UE registration
- Policy profile provisioning (PCRF/SPR)
- Subscriber data management

## 6.2 Assurance & Reporting (Fixed + Mobile)
- Service monitoring and KPIs
- Performance measurement
- Fault management
- Trouble ticketing integration
- Customer-facing dashboards
- SLA compliance reporting
- Usage reporting and billing integration

Guidelines:
- Focus on operational aspects
- Describe workflows and integration points
- Reference BSS/CRM systems if applicable
- Include provisioning sequence diagrams if helpful
- Cover both initial setup and ongoing management
- Address fixed and mobile service integration

${DIAGRAM_PLACEHOLDER_REQUIREMENTS}

Generate the complete Section 6 now in markdown format.`;

  return appendUserGuidance(basePrompt, userGuidance);
}

/**
 * @deprecated Use buildFlexibleSectionPrompt() instead
 * Build prompt for Section 7: SLA Summary
 */
export function buildSLASummaryPrompt(
  brsAnalysis: any,
  userGuidance?: string
): string {
  const basePrompt = `Generate Section 7 (SLA Summary) for a 3GPP-style technical specification.

Context from BRS:
- Service variants: ${brsAnalysis.variants?.join(', ') || 'Extract from BRS'}
- SLA commitments: ${brsAnalysis.sla || 'Extract from BRS'}

Section Structure:
# 7. SLA Summary

## 7.1 Measurement & Reporting

### 7.1.1 Measurement Point
- Define where SLA measurements are taken (e.g., SGi at P-GW/TDF)
- Specify measurement methodology
- Measurement window (e.g., 24-hour rolling average)

### 7.1.2 SLA Commitments by Variant
Table format:

| Service Variant | Speed | SLA Target | Measurement Criteria |
|-----------------|-------|------------|----------------------|
| Basic 50 Mbps | 50 Mbps | 80% of time | 95th percentile >= 40 Mbps |
| Basic 100 Mbps | 100 Mbps | 75% of time | 95th percentile >= 75 Mbps |
| Backup | As subscribed | Failover only | N/A during primary operation |
| On-the-Move | 10/20 Mbps | Conditional | Within NR coverage only |

### 7.1.3 Reporting
- Reporting frequency (daily, weekly, monthly)
- Reporting format and delivery method
- SLA breach notification procedures
- Remediation and credits

## 7.2 In-Scope Determination Profiles (if applicable)
For services with conditional SLAs (e.g., On-the-Move with NR detection):
- Define in-scope conditions (e.g., NR coverage, specific cell IDs)
- Out-of-scope conditions (no coverage, planned maintenance)
- Measurement exclusions

Guidelines:
- Be specific about measurement methodology
- Clarify what is and isn't covered by SLA
- Reference Section 5 (NFRs) for detailed requirements
- Use tables for clarity
- Address edge cases (handover, mobility, failover)

Generate the complete Section 7 now in markdown format.`;

  return appendUserGuidance(basePrompt, userGuidance);
}

/**
 * @deprecated Use buildFlexibleSectionPrompt() instead
 * Build prompt for Section 8: Open Items
 */
export function buildOpenItemsPrompt(
  _brsAnalysis: any,  // Reserved for future use
  userGuidance?: string
): string {
  const basePrompt = `Generate Section 8 (Open Items) for a 3GPP-style technical specification.

Section Structure:
# 8. Open Items

List any pending decisions, unresolved technical questions, or items requiring further clarification.

Format as numbered list:
1. **Item Title** - Brief description of the open item, impact, and what needs to be decided/clarified.
2. **Item Title** - Description...

Common open items to consider:
- Pending vendor confirmations (feature support, capacity)
- Architecture design choices not yet finalized
- Integration points requiring further definition
- Standards compliance requiring validation
- Testing and validation procedures
- Operational procedures requiring documentation
- Commercial terms pending agreement

Guidelines:
- Be specific about what needs to be resolved
- Indicate impact/priority if applicable
- Include owner or responsible party if known
- Mark items with section references where applicable
- Use this section for transparency about specification maturity
- Empty list is acceptable if all items are resolved

Generate the complete Section 8 now in markdown format. If there are no open items based on the BRS and context, state "No open items at this time." and provide a placeholder for future items.`;

  return appendUserGuidance(basePrompt, userGuidance);
}

/**
 * @deprecated Use buildFlexibleSectionPrompt() instead
 * Build prompt for Section 9: Appendices
 */
export function buildAppendicesPrompt(
  brsAnalysis: any,
  _brsMarkdown: string,  // Reserved for future use
  standards: any[],
  userGuidance?: string
): string {
  const basePrompt = `Generate Section 9 (Appendices) for a 3GPP-style technical specification.

Context:
- Components: ${brsAnalysis.components?.join(', ') || 'Extract from document'}
- Standards: ${standards.map(s => s.name || s).join(', ')}

Section Structure:
# 9. Appendices

## 9.1 Abbreviations
Two-column table format, alphabetically sorted:

| Term | Definition |
|------|------------|
| 3GPP | 3rd Generation Partnership Project |
| AAA | Authentication, Authorization, and Accounting |
| APN | Access Point Name |
| ARP | Allocation and Retention Priority |
| ...  | ... |

Guidelines for abbreviations:
- Include ALL technical terms used in the specification
- Alphabetical order
- Include 3GPP-standard abbreviations (EPC, LTE, NR, PCRF, etc.)
- Include vendor-specific terms if applicable
- Include business terms (SLA, KPI, BSS, OSS, etc.)

## 9.2 References
List of informative references (normative references already in earlier section):

**3GPP Specifications:**
- 3GPP TS 23.203: Policy and Charging Control Architecture
- 3GPP TS 23.401: GPRS Enhancements for E-UTRAN Access
- 3GPP TS 29.212: Policy and Charging Control (PCC) over Gx/Sd reference point
- (Add others as relevant)

**Industry Standards:**
- RFC 2119: Key words for use in RFCs to Indicate Requirement Levels
- (Add others as relevant)

**Operator Internal:**
- (Add operator-specific references if applicable)

## 9.3 Design Rationale (optional)
Narrative explaining key design decisions made in this specification.

For example:
- Why a Dedicated GBR Bearer was chosen over non-GBR
- Rationale for primary/backup coordination mechanism
- Design trade-offs and alternatives considered
- Operational implications of chosen approach

## 9.4 Other (as needed)
Additional appendices as relevant:
- Test procedures
- Configuration examples
- Sample policies
- Migration procedures

Guidelines:
- Comprehensive abbreviations list
- Complete reference list
- Design rationale adds value for maintainability
- Other appendices optional based on specification needs

Generate the complete Section 9 now in markdown format.`;

  return appendUserGuidance(basePrompt, userGuidance);
}

/**
 * Registry of legacy prompt builders for backward compatibility
 * Maps promptKey to function
 */
export const legacyPromptBuilders: Record<string, Function> = {
  build3GPPScopePrompt,
  build3GPPReferencesPrompt,
  build3GPPDefinitionsPrompt,
  build3GPPArchitecturePrompt,
  build3GPPFunctionalRequirementsPrompt,
  build3GPPProceduresPrompt,
  build3GPPInformationElementsPrompt,
  build3GPPErrorHandlingPrompt,
  buildServiceOverviewPrompt,
  buildNonFunctionalRequirementsPrompt,
  buildOSSBSSPrompt,
  buildSLASummaryPrompt,
  buildOpenItemsPrompt,
  buildAppendicesPrompt,
  buildBRSAnalysisPrompt,
};
