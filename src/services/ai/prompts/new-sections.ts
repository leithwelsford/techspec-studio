/**
 * NEW Section Builder Functions for Updated Template Structure
 * To be merged into documentPrompts.ts
 */

import { appendUserGuidance } from './documentPrompts';

/**
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
## 2 Service Overview

### 2.1 Service Description
Brief overview of what the service provides and its primary purpose.
(Summarize from BRS Section 1 - make it concise, 2-3 paragraphs)

### 2.2 Objectives
- List the main objectives of the service
- Focus on business and technical goals
- Include commercialization goals

### 2.3 Target Customer
- Describe the target customer segment
- Enterprise vs consumer
- Use cases and scenarios

### 2.4 Architecture Context
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
## 5 Non-Functional Requirements

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
 * Build prompt for Section 6: OSS/BSS and Service Management
 */
export function buildOSSBSSPrompt(
  brsAnalysis: any,
  userGuidance?: string
): string {
  const basePrompt = `Generate Section 6 (OSS/BSS and Service Management) for a 3GPP-style technical specification.

Section Structure:
## 6 OSS/BSS and Service Management

### 6.1 Provisioning & Identity Correlation (Fixed + Mobile)
- Service activation workflow
- Customer identity management
- Correlation between fixed and mobile identities (if applicable)
- SIM/IMSI provisioning
- CPE/UE registration
- Policy profile provisioning (PCRF/SPR)
- Subscriber data management

### 6.2 Assurance & Reporting (Fixed + Mobile)
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

Generate the complete Section 6 now in markdown format.`;

  return appendUserGuidance(basePrompt, userGuidance);
}

/**
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
## 7 SLA Summary

### 7.1 Measurement & Reporting

#### 7.1.1 Measurement Point
- Define where SLA measurements are taken (e.g., SGi at P-GW/TDF)
- Specify measurement methodology
- Measurement window (e.g., 24-hour rolling average)

#### 7.1.2 SLA Commitments by Variant
Table format:

| Service Variant | Speed | SLA Target | Measurement Criteria |
|-----------------|-------|------------|----------------------|
| Basic 50 Mbps | 50 Mbps | 80% of time | 95th percentile >= 40 Mbps |
| Basic 100 Mbps | 100 Mbps | 75% of time | 95th percentile >= 75 Mbps |
| Backup | As subscribed | Failover only | N/A during primary operation |
| On-the-Move | 10/20 Mbps | Conditional | Within NR coverage only |

#### 7.1.3 Reporting
- Reporting frequency (daily, weekly, monthly)
- Reporting format and delivery method
- SLA breach notification procedures
- Remediation and credits

### 7.2 In-Scope Determination Profiles (if applicable)
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
 * Build prompt for Section 8: Open Items
 */
export function buildOpenItemsPrompt(
  brsAnalysis: any,
  userGuidance?: string
): string {
  const basePrompt = `Generate Section 8 (Open Items) for a 3GPP-style technical specification.

Section Structure:
## 8 Open Items

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
 * Build prompt for Section 9: Appendices
 */
export function buildAppendicesPrompt(
  brsAnalysis: any,
  brsMarkdown: string,
  standards: any[],
  userGuidance?: string
): string {
  const basePrompt = `Generate Section 9 (Appendices) for a 3GPP-style technical specification.

Context:
- Components: ${brsAnalysis.components?.join(', ') || 'Extract from document'}
- Standards: ${standards.map(s => s.name || s).join(', ')}

Section Structure:
## 9 Appendices

### 9.1 Abbreviations
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

### 9.2 References
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

### 9.3 Design Rationale (optional)
Narrative explaining key design decisions made in this specification.

For example:
- Why a Dedicated GBR Bearer was chosen over non-GBR
- Rationale for primary/backup coordination mechanism
- Design trade-offs and alternatives considered
- Operational implications of chosen approach

### 9.4 Other (as needed)
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
