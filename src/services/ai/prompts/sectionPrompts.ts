/**
 * Flexible Section Prompts
 *
 * Domain-agnostic prompt builders that adapt to any technical specification type.
 * Replaces the rigid template-specific prompts (build3GPPScopePrompt, etc.)
 */

import type {
  FlexibleSection,
  DomainConfig,
  ExtractedExcerpt,
  MarkdownGenerationGuidance,
  RequirementCounterState,
} from '../../../types';
import type { WebSearchResult } from '../webSearch';

// ========== Constants ==========

/**
 * Diagram placeholder requirements - included in all section prompts
 */
export const DIAGRAM_PLACEHOLDER_REQUIREMENTS = `
## Diagram Placeholders

When visual aids would help explain concepts, use figure placeholders:

✅ USE: \`{{fig:X-Y-description}}\` format where:
   - X-Y = figure number matching the caption (e.g., 5-1 for Figure 5-1)
   - description = short kebab-case description

❌ NEVER use ASCII art or text-based diagrams

**IMPORTANT**: The figure number in the ID MUST match the caption below:
- ID: \`{{fig:5-1-system-architecture}}\` → Caption: \`*Figure 5-1: System Architecture*\`
- ID: \`{{fig:3-2-call-flow}}\` → Caption: \`*Figure 3-2: Call Flow*\`

**REQUIRED**: Include a TODO comment with EXPLICIT DIAGRAM TYPE after each placeholder:

Format: \`<!-- TODO: [DIAGRAM TYPE] Description of what the diagram should show -->\`

### Available Diagram Types (use exact bracketed text):

**Architecture & Structure:**
- \`[BLOCK DIAGRAM]\` - Architecture, components, interfaces, network topology (custom JSON format)
- \`[CLASS DIAGRAM]\` - OOP class structures, relationships, inheritance
- \`[C4 DIAGRAM]\` - Software architecture (Context, Container, Component levels)
- \`[ARCHITECTURE DIAGRAM]\` - System architecture with services, databases, queues

**Flows & Sequences:**
- \`[SEQUENCE DIAGRAM]\` - Call flows, message exchanges, protocol interactions, signaling
- \`[FLOW DIAGRAM]\` - Algorithms, decision trees, conditional logic, process flows
- \`[STATE DIAGRAM]\` - State machines, state transitions, modes, lifecycle states
- \`[USER JOURNEY]\` - User experience flows, satisfaction scores, touchpoints
- \`[ZENUML]\` - Alternative sequence diagrams with method-call syntax

**Data & Relationships:**
- \`[ER DIAGRAM]\` - Entity relationships, data models, database schemas
- \`[REQUIREMENT DIAGRAM]\` - Requirements traceability, SysML requirements

**Planning & Timelines:**
- \`[GANTT CHART]\` - Project timelines, implementation phases, schedules
- \`[TIMELINE]\` - Sequential events, milestones, evolution
- \`[KANBAN]\` - Task boards, sprint boards, workflow stages

**Analysis & Visualization:**
- \`[PIE CHART]\` - Proportional data, distribution, percentages
- \`[QUADRANT CHART]\` - Priority matrices, risk assessment, 2D comparisons
- \`[XY CHART]\` - Line charts, bar charts, scatter plots
- \`[SANKEY DIAGRAM]\` - Flow distributions, energy/resource flows
- \`[RADAR CHART]\` - Spider charts, competency comparisons
- \`[TREEMAP]\` - Hierarchical proportional areas

**Hierarchies & Concepts:**
- \`[MINDMAP]\` - Concept hierarchies, feature breakdowns, brainstorming

**Development & Version Control:**
- \`[GIT GRAPH]\` - Commit history, branches, merges

**Network & Protocol:**
- \`[PACKET DIAGRAM]\` - Network packet structures, protocol headers

### Examples:

\`\`\`markdown
{{fig:5-1-system-architecture}}
<!-- TODO: [BLOCK DIAGRAM] Show main components (AMF, SMF, UPF) and N-interfaces -->
*Figure 5-1: System Architecture Overview*

{{fig:5-2-user-session-entity}}
<!-- TODO: [ER DIAGRAM] Show User, Session, and Subscription entities with relationships -->
*Figure 5-2: User Session Entity Relationships*

{{fig:6-1-implementation-timeline}}
<!-- TODO: [GANTT CHART] Show Phase 1 (months 1-3), Phase 2 (months 4-6), Phase 3 (months 7-9) -->
*Figure 6-1: Implementation Timeline*

{{fig:4-1-feature-hierarchy}}
<!-- TODO: [MINDMAP] Show main features branching into sub-features and capabilities -->
*Figure 4-1: Feature Hierarchy*

{{fig:7-1-risk-matrix}}
<!-- TODO: [QUADRANT CHART] Plot risks by likelihood (x) vs impact (y) -->
*Figure 7-1: Risk Assessment Matrix*
\`\`\`

## Shared Diagrams Across Sub-Sections

When a diagram conceptually applies to multiple sub-sections:

1. **Place the diagram in the FIRST sub-section that uses it**
   - Include the {{fig:...}} placeholder and caption in that first sub-section
   - The diagram should show the complete view needed by all related sub-sections

2. **Reference with prose in subsequent sub-sections**
   - Do NOT create new diagram placeholders for the same conceptual content
   - Use phrases like:
     - "As shown in Figure X-Y, ..."
     - "The architecture illustrated in Figure X-Y ..."
     - "Referring to Figure X-Y, the [specific aspect] ..."

3. **Figure numbering remains section-level**
   - All diagrams in section 5 are numbered 5-1, 5-2, 5-3
   - NOT 5.1-1, 5.2-1 (sub-section level)

### Example: Section 5 with shared and unique diagrams

\`\`\`markdown
### 5.1 Logical Components
{{fig:5-1-system-architecture}}
<!-- TODO: [BLOCK DIAGRAM] Show all major components (AMF, SMF, UPF)
     and interfaces. FOCUS ON NODES. This diagram covers 5.1, 5.2, 5.3 -->
*Figure 5-1: System Architecture Overview*

The system comprises five logical components...

### 5.2 Control Plane Functions
As shown in Figure 5-1, the control plane encompasses the Policy Controller
and Session Manager components. This section details their responsibilities...
[No new diagram - uses prose reference to Figure 5-1]

### 5.3 User Plane Functions
The user plane data path, illustrated in Figure 5-1, flows through the
Access Gateway and Traffic Processor...
[No new diagram - uses prose reference to Figure 5-1]

### 5.4 Session Management
{{fig:5-2-session-states}}
<!-- TODO: [STATE DIAGRAM] Show session lifecycle: IDLE → INITIATING →
     ACTIVE → TERMINATING → CLOSED with transition triggers -->
*Figure 5-2: Session State Machine*

This section requires its own diagram showing state transitions...
\`\`\`

### Indicators in TODO Comments

When a diagram covers multiple sub-sections, indicate this in the TODO:

\`\`\`markdown
<!-- TODO: [BLOCK DIAGRAM] ... This diagram covers 5.1, 5.2, 5.3 -->
\`\`\`

This helps:
- Document authors understand the diagram's scope
- Future AI refinements know not to duplicate
- Reviewers verify appropriate coverage
`;

/**
 * Requirement numbering guidance - instructs AI to add requirement IDs
 */
export const REQUIREMENT_NUMBERING_GUIDANCE = `
## Requirement Numbering

**CRITICAL**: Every normative statement MUST have a unique requirement ID - no exceptions.

**Normative keywords** (per RFC 2119):
- **Absolute requirements**: SHALL, SHALL NOT, MUST, MUST NOT, REQUIRED
- **Recommendations**: SHOULD, SHOULD NOT, RECOMMENDED
- **Optional**: MAY, OPTIONAL

**Format**: \`<SUBSYSTEM>-<FEATURE>-<ARTEFACT>-<NNNNN>\`

**Components** (infer from BRS and section context):
- **SUBSYSTEM**: Major system block (e.g., PCC, AAA, WLAN, BNG, PCRF, OCS, CORE, EDGE)
- **FEATURE**: Functional slice (e.g., CAPTIVE, EAPSIM, ACCOUNTING, QOS, CHARGING, AUTH)
- **ARTEFACT**: Requirement type:
  - \`REQ\` - General requirement
  - \`FR\` - Functional requirement
  - \`NFR\` - Non-functional requirement
  - \`INT\` - Interface requirement
  - \`SEC\` - Security requirement
  - \`CFG\` - Configuration requirement
  - \`TST\` - Test requirement
  - \`RISK\` - Risk item
- **NNNNN**: 5-digit zero-padded counter (00001, 00002, etc.)

**Rules**:
1. Infer SUBSYSTEM and FEATURE from the BRS document and section context
2. Keep SUBSYSTEM and FEATURE consistent within related sections
3. Use appropriate ARTEFACT type based on requirement nature
4. Start counter at 00001 for each unique SUBSYSTEM-FEATURE-ARTEFACT combination
5. Format each requirement as: **ID**: The system SHALL/MUST/SHOULD/MAY...
6. **Lists with normative statements**: Each list item containing a normative keyword MUST have its own ID

**Examples**:

Simple requirements:
\`\`\`markdown
**PCC-CAPTIVE-REQ-00001**: The system SHALL authenticate users via RADIUS protocol.

**PCC-CAPTIVE-SEC-00001**: The system MUST encrypt all authentication credentials using TLS 1.3.
\`\`\`

Requirements with lists (each normative item gets an ID):
\`\`\`markdown
The operator SHALL configure the following parameters:

- **AAA-CONFIG-CFG-00001**: The operator SHALL configure primary/secondary AAA endpoints.
- **AAA-CONFIG-CFG-00002**: The operator SHALL configure request timeout and retry counts.
- **AAA-CONFIG-CFG-00003**: The operator MAY configure accounting interim interval (if used).
\`\`\`

Numbered list example:
\`\`\`markdown
The authentication flow SHALL proceed as follows:

1. **PCC-AUTH-REQ-00001**: The system SHALL receive the initial connection request.
2. **PCC-AUTH-REQ-00002**: The system SHALL validate the subscriber identity.
3. **PCC-AUTH-REQ-00003**: The system SHALL apply the appropriate policy profile.
\`\`\`

Nested lists (each level with normative keywords gets an ID):
\`\`\`markdown
**AAA-RADIUS-REQ-00001**: The AAA system SHALL support RADIUS authentication with the following capabilities:

- **AAA-RADIUS-REQ-00002**: The system SHALL support EAP-SIM authentication:
  - **AAA-RADIUS-REQ-00003**: The system SHALL validate IMSI against the HLR/HSS.
  - **AAA-RADIUS-REQ-00004**: The system SHALL support triplet and quintuplet vectors.
  - **AAA-RADIUS-CFG-00001**: The operator MAY configure vector pre-fetching.
- **AAA-RADIUS-REQ-00005**: The system SHALL support EAP-AKA authentication:
  - **AAA-RADIUS-REQ-00006**: The system MUST validate AUTN before generating RES.
  - **AAA-RADIUS-SEC-00001**: The system SHALL reject replayed authentication vectors.
\`\`\`
`;

/**
 * Instruction when requirement numbering is disabled for a section
 */
export const REQUIREMENT_NUMBERING_DISABLED = `
## Requirement Numbering

**IMPORTANT: Do NOT include requirement IDs in this section.**
Write normative statements (SHALL, MUST, SHOULD, MAY, etc.) without ID prefixes.
`;

/**
 * Build requirement numbering guidance with counter state
 */
export function buildRequirementNumberingSection(
  enabled: boolean,
  counters?: RequirementCounterState
): string {
  if (!enabled) {
    return REQUIREMENT_NUMBERING_DISABLED;
  }

  let guidance = REQUIREMENT_NUMBERING_GUIDANCE;

  // Add counter state if we have existing counters
  if (counters && Object.keys(counters.counters).length > 0) {
    guidance += `\n**Continue from these counters (use next number in sequence):**\n`;
    for (const [prefix, count] of Object.entries(counters.counters)) {
      guidance += `- ${prefix}: last used ${String(count).padStart(5, '0')}, next is ${String(count + 1).padStart(5, '0')}\n`;
    }
    guidance += `\n`;
  }

  return guidance;
}

// ========== Interface Protocol Terminology ==========

/**
 * Maps known protocol interfaces to their standard command/message names.
 * Used to inject terminology hints when interfaces are mentioned but
 * reference documents may not be included.
 */
const INTERFACE_PROTOCOL_MAP: Record<string, { description: string; commands: string }> = {
  // ==================== 3GPP Diameter Interfaces ====================
  'Gx': {
    description: 'Policy and Charging Control (PCRF)',
    commands: 'CCR-I/CCA-I (Initial), CCR-U/CCA-U (Update), CCR-T/CCA-T (Terminate), RAR/RAA (Re-Auth)'
  },
  'Gy': {
    description: 'Online Charging (OCS)',
    commands: 'CCR/CCA with CC-Request-Type (INITIAL/UPDATE/TERMINATE), multiple-services-credit-control AVPs'
  },
  'Gz': {
    description: 'Offline Charging (OFCS)',
    commands: 'ACR/ACA (Accounting), with Accounting-Record-Type (START/INTERIM/STOP)'
  },
  'Rx': {
    description: 'Application Function to PCRF',
    commands: 'AAR/AAA (Auth-App), STR/STA (Session-Terminate), ASR/ASA (Abort-Session)'
  },
  'Sd': {
    description: 'TDF to PCRF',
    commands: 'TSR/TSA (TDF-Session), CCR-I/CCA-I for TDF session establishment'
  },
  'Sy': {
    description: 'Spending Limit (OCS to PCRF)',
    commands: 'SLR/SLA (Spending-Limit), SNR/SNA (Spending-Status-Notification)'
  },
  'S6a': {
    description: 'MME to HSS',
    commands: 'ULR/ULA (Update-Location), AIR/AIA (Auth-Info), CLR/CLA (Cancel-Location), PUR/PUA (Purge)'
  },
  'S6b': {
    description: 'PDN GW to 3GPP AAA',
    commands: 'AAR/AAA, STR/STA, ASR/ASA for trusted non-3GPP access'
  },

  // ==================== 3GPP GTP/S1-AP Interfaces ====================
  'S5': {
    description: 'SGW to PGW (GTP)',
    commands: 'Create-Session-Request/Response, Modify-Bearer-Request/Response, Delete-Session-Request/Response, Create-Bearer-Request/Response'
  },
  'S8': {
    description: 'SGW to PGW roaming (GTP)',
    commands: 'Same as S5: Create-Session, Modify-Bearer, Delete-Session, Create-Bearer Request/Response'
  },
  'S11': {
    description: 'MME to SGW (GTP-C)',
    commands: 'Create-Session-Request/Response, Modify-Bearer-Request/Response, Delete-Session-Request/Response, Release-Access-Bearers'
  },
  'S1-MME': {
    description: 'eNB to MME (S1-AP)',
    commands: 'Initial-UE-Message, UE-Context-Release, Handover-Required/Command, Paging, E-RAB-Setup/Modify/Release'
  },
  'GTP': {
    description: 'GPRS Tunneling Protocol (3GPP TS 29.274)',
    commands: 'Create-Session-Request/Response, Modify-Bearer-Request/Response, Delete-Session-Request/Response, Create-Bearer-Request/Response, Delete-Bearer-Request/Response'
  },

  // ==================== AAA Protocols ====================
  'RADIUS': {
    description: 'AAA Protocol (RFC 2865/2866/5176)',
    commands: 'Access-Request/Accept/Reject/Challenge, Accounting-Request (Start/Interim/Stop), Disconnect-Request/ACK/NAK, CoA-Request/ACK/NAK'
  },
  'TACACS': {
    description: 'Device AAA (RFC 8907)',
    commands: 'Authentication START/REPLY/CONTINUE, Authorization REQUEST/RESPONSE, Accounting REQUEST/RESPONSE'
  },
  'Diameter': {
    description: 'AAA Protocol (RFC 6733)',
    commands: 'CER/CEA (Capabilities-Exchange), DWR/DWA (Device-Watchdog), DPR/DPA (Disconnect-Peer), application-specific: CCR/CCA, AAR/AAA, ASR/ASA, RAR/RAA, STR/STA'
  },

  // ==================== VoIP/Telephony ====================
  'SIP': {
    description: 'Session Initiation Protocol (RFC 3261)',
    commands: 'INVITE, ACK, BYE, CANCEL, REGISTER, OPTIONS, PRACK, UPDATE, INFO, SUBSCRIBE, NOTIFY, REFER, MESSAGE; Responses: 1xx/2xx/3xx/4xx/5xx/6xx'
  },
  'RTP': {
    description: 'Real-time Transport Protocol (RFC 3550)',
    commands: 'RTP packets (PT, SSRC, sequence, timestamp), RTCP: SR (Sender Report), RR (Receiver Report), SDES, BYE, APP'
  },
  'MGCP': {
    description: 'Media Gateway Control Protocol (RFC 3435)',
    commands: 'CRCX (CreateConnection), MDCX (ModifyConnection), DLCX (DeleteConnection), RQNT (NotificationRequest), NTFY (Notify), AUEP (AuditEndpoint), AUCX (AuditConnection)'
  },

  // ==================== HTTP/Web APIs ====================
  'HTTP': {
    description: 'REST API (RFC 7231)',
    commands: 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS; Status: 200 OK, 201 Created, 204 No Content, 301/302 Redirect, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 500 Internal Server Error'
  },
  'WebSocket': {
    description: 'Full-duplex communication (RFC 6455)',
    commands: 'HTTP Upgrade handshake, then frames: TEXT, BINARY, PING, PONG, CLOSE; Opcodes 0x0-0xF'
  },
  'gRPC': {
    description: 'Google RPC over HTTP/2',
    commands: 'Unary RPC, Server streaming, Client streaming, Bidirectional streaming; Status: OK, CANCELLED, INVALID_ARGUMENT, NOT_FOUND, ALREADY_EXISTS, PERMISSION_DENIED, UNAUTHENTICATED'
  },
  'GraphQL': {
    description: 'Query language for APIs',
    commands: 'query, mutation, subscription; Response: data, errors, extensions'
  },

  // ==================== Routing Protocols ====================
  'BGP': {
    description: 'Border Gateway Protocol (RFC 4271)',
    commands: 'OPEN, UPDATE (with NLRI, Path Attributes: AS_PATH, NEXT_HOP, MED, LOCAL_PREF), KEEPALIVE, NOTIFICATION, ROUTE-REFRESH'
  },
  'OSPF': {
    description: 'Open Shortest Path First (RFC 2328)',
    commands: 'Hello, Database Description (DBD), Link State Request (LSR), Link State Update (LSU), Link State Acknowledgment (LSAck); LSA Types 1-7'
  },
  'IS-IS': {
    description: 'Intermediate System to Intermediate System (ISO 10589)',
    commands: 'IIH (IS-IS Hello), LSP (Link State PDU), CSNP (Complete Sequence Numbers PDU), PSNP (Partial Sequence Numbers PDU)'
  },
  'MPLS': {
    description: 'Multiprotocol Label Switching',
    commands: 'Label operations: PUSH, POP, SWAP; LDP: Hello, Initialization, KeepAlive, Address, Label Mapping/Request/Release/Withdraw'
  },
  'LDP': {
    description: 'Label Distribution Protocol (RFC 5036)',
    commands: 'Hello, Initialization, KeepAlive, Address, Address Withdraw, Label Mapping, Label Request, Label Withdraw, Label Release, Notification'
  },

  // ==================== Network Infrastructure ====================
  'DHCP': {
    description: 'Dynamic Host Configuration (RFC 2131)',
    commands: 'DHCPDISCOVER, DHCPOFFER, DHCPREQUEST, DHCPACK, DHCPNAK, DHCPRELEASE, DHCPDECLINE, DHCPINFORM; DHCPv6: SOLICIT, ADVERTISE, REQUEST, REPLY, RENEW, REBIND'
  },
  'DNS': {
    description: 'Domain Name System (RFC 1035)',
    commands: 'Query/Response with OPCODE (QUERY, IQUERY, STATUS, NOTIFY, UPDATE); RCODE: NOERROR, FORMERR, SERVFAIL, NXDOMAIN, REFUSED; Record types: A, AAAA, CNAME, MX, NS, PTR, SOA, SRV, TXT'
  },
  'NTP': {
    description: 'Network Time Protocol (RFC 5905)',
    commands: 'Mode: Client, Server, Broadcast, Symmetric Active/Passive; Kiss codes: DENY, RSTR, RATE; Stratum 0-15'
  },
  'ARP': {
    description: 'Address Resolution Protocol (RFC 826)',
    commands: 'ARP Request, ARP Reply, RARP Request, RARP Reply; Gratuitous ARP'
  },

  // ==================== Network Management ====================
  'SNMP': {
    description: 'Simple Network Management Protocol (RFC 3411-3418)',
    commands: 'GetRequest, GetNextRequest, GetBulkRequest, SetRequest, Response, Trap, InformRequest; Error: noError, tooBig, noSuchName, badValue, readOnly, genErr'
  },
  'Syslog': {
    description: 'System Logging Protocol (RFC 5424)',
    commands: 'Facility (0-23), Severity (0-7: Emergency, Alert, Critical, Error, Warning, Notice, Informational, Debug); PRI = Facility*8 + Severity'
  },
  'NetFlow': {
    description: 'Cisco NetFlow / IPFIX (RFC 7011)',
    commands: 'Template FlowSet, Data FlowSet, Options Template; Export: source/dest IP, ports, protocol, bytes, packets, timestamps'
  },
  'NETCONF': {
    description: 'Network Configuration Protocol (RFC 6241)',
    commands: 'get, get-config, edit-config, copy-config, delete-config, lock, unlock, close-session, kill-session; Operations: merge, replace, create, delete, remove'
  },
  'RESTCONF': {
    description: 'REST-like NETCONF (RFC 8040)',
    commands: 'GET, POST, PUT, PATCH, DELETE on YANG-modeled resources; Media: application/yang-data+json, application/yang-data+xml'
  },

  // ==================== Security Protocols ====================
  'TLS': {
    description: 'Transport Layer Security (RFC 8446)',
    commands: 'ClientHello, ServerHello, Certificate, CertificateVerify, Finished, NewSessionTicket, KeyUpdate, Alert; TLS 1.3: single RTT handshake'
  },
  'IKE': {
    description: 'Internet Key Exchange (RFC 7296)',
    commands: 'IKE_SA_INIT, IKE_AUTH, CREATE_CHILD_SA, INFORMATIONAL; Payloads: SA, KE, Ni/Nr, ID, AUTH, CERT, CERTREQ, TS'
  },
  'IPsec': {
    description: 'IP Security (RFC 4301)',
    commands: 'AH (Authentication Header), ESP (Encapsulating Security Payload); Modes: Transport, Tunnel; SA (Security Association)'
  },
  '802.1X': {
    description: 'Port-Based Network Access Control (IEEE 802.1X)',
    commands: 'EAP over LAN (EAPOL): Start, Logoff, Key, Encapsulated-ASF-Alert; EAP: Request, Response, Success, Failure; Methods: EAP-TLS, EAP-TTLS, PEAP, EAP-SIM, EAP-AKA'
  },
  'LDAP': {
    description: 'Lightweight Directory Access Protocol (RFC 4511)',
    commands: 'BindRequest/Response, SearchRequest/ResultEntry/ResultDone, ModifyRequest/Response, AddRequest/Response, DeleteRequest/Response, ModifyDNRequest/Response, CompareRequest/Response, AbandonRequest, ExtendedRequest/Response'
  },
  'Kerberos': {
    description: 'Network Authentication Protocol (RFC 4120)',
    commands: 'AS-REQ/AS-REP (Authentication Service), TGS-REQ/TGS-REP (Ticket-Granting Service), AP-REQ/AP-REP (Application), KRB-ERROR'
  },
  'OAuth': {
    description: 'Authorization Framework (RFC 6749)',
    commands: 'Authorization Request/Response, Access Token Request/Response; Grant types: authorization_code, client_credentials, refresh_token, implicit (deprecated); Token: Bearer, MAC'
  },

  // ==================== Messaging / IoT ====================
  'MQTT': {
    description: 'Message Queuing Telemetry Transport (ISO/IEC 20922)',
    commands: 'CONNECT, CONNACK, PUBLISH, PUBACK, PUBREC, PUBREL, PUBCOMP, SUBSCRIBE, SUBACK, UNSUBSCRIBE, UNSUBACK, PINGREQ, PINGRESP, DISCONNECT, AUTH'
  },
  'AMQP': {
    description: 'Advanced Message Queuing Protocol (ISO/IEC 19464)',
    commands: 'connection.open/close, session.begin/end, attach/detach, transfer, disposition, flow; Outcomes: accepted, rejected, released, modified'
  },
  'CoAP': {
    description: 'Constrained Application Protocol (RFC 7252)',
    commands: 'GET, POST, PUT, DELETE; Response codes: 2.xx Success, 4.xx Client Error, 5.xx Server Error; Observe option for subscriptions'
  },

  // ==================== Storage / Data ====================
  'iSCSI': {
    description: 'Internet SCSI (RFC 7143)',
    commands: 'Login Request/Response, SCSI Command/Response/Data-Out/Data-In, Task Management, Text Request/Response, Logout Request/Response, NOP-Out/NOP-In'
  },
  'NFS': {
    description: 'Network File System (RFC 7530 for NFSv4)',
    commands: 'COMPOUND procedure with operations: ACCESS, CLOSE, COMMIT, CREATE, GETATTR, GETFH, LINK, LOCK, LOOKUP, OPEN, READ, READDIR, REMOVE, RENAME, SETATTR, WRITE'
  },
  'SMB': {
    description: 'Server Message Block / CIFS',
    commands: 'Negotiate, Session Setup, Tree Connect/Disconnect, Create, Close, Read, Write, Lock, Ioctl, Query Directory, Query/Set Info, Change Notify'
  },

  // ==================== Database ====================
  'SQL': {
    description: 'Structured Query Language',
    commands: 'SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, GRANT, REVOKE; Transaction: BEGIN, COMMIT, ROLLBACK, SAVEPOINT'
  },
  'JDBC': {
    description: 'Java Database Connectivity',
    commands: 'getConnection, createStatement, prepareStatement, executeQuery, executeUpdate, commit, rollback, close; ResultSet navigation'
  },

  // ==================== Virtualization / Cloud ====================
  'VXLAN': {
    description: 'Virtual Extensible LAN (RFC 7348)',
    commands: 'Encapsulation: Outer UDP (port 4789), VXLAN Header (VNI 24-bit), Inner Ethernet frame; VTEP learning via data plane or control plane (EVPN)'
  },
  'OpenFlow': {
    description: 'SDN Protocol (ONF)',
    commands: 'HELLO, FEATURES_REQUEST/REPLY, PACKET_IN/OUT, FLOW_MOD, PORT_MOD, STATS_REQUEST/REPLY, BARRIER_REQUEST/REPLY, ERROR'
  },
};

/**
 * Detect interfaces mentioned in content and return terminology guidance
 */
export function buildInterfaceTerminologyHints(content: string): string {
  if (!content) return '';

  const contentUpper = content.toUpperCase();
  const detectedInterfaces: string[] = [];

  // Check for each known interface in the content
  for (const iface of Object.keys(INTERFACE_PROTOCOL_MAP)) {
    // Create patterns that match the interface name with word boundaries
    const patterns = [
      new RegExp(`\\b${iface}\\b`, 'i'),           // Exact match
      new RegExp(`\\b${iface}[/-]`, 'i'),          // e.g., "Gx/Sd", "S5/S8"
      new RegExp(`over\\s+${iface}\\b`, 'i'),      // e.g., "over Gx"
      new RegExp(`via\\s+${iface}\\b`, 'i'),       // e.g., "via Gx"
      new RegExp(`${iface}\\s+interface`, 'i'),    // e.g., "Gx interface"
    ];

    if (patterns.some(p => p.test(content))) {
      detectedInterfaces.push(iface);
    }
  }

  // Also detect by keywords and related terms
  const keywordMap: Record<string, string[]> = {
    // 3GPP
    'Gx': ['PCRF', 'POLICY AND CHARGING RULES'],
    'Gy': ['OCS', 'ONLINE CHARGING SYSTEM', 'CREDIT CONTROL'],
    'Gz': ['OFCS', 'OFFLINE CHARGING'],
    'Diameter': ['DIAMETER BASE', 'RFC 6733', 'RFC 3588'],
    'GTP': ['GPRS TUNNEL', 'GTP-C', 'GTP-U', 'TS 29.274'],
    // AAA
    'RADIUS': ['RFC 2865', 'RFC 2866', 'RFC 5176', 'RADIUS ACCOUNTING', 'RADIUS AUTH'],
    'TACACS': ['TACACS+', 'RFC 8907', 'DEVICE AAA'],
    // VoIP
    'SIP': ['RFC 3261', 'SESSION INITIATION', 'SIP TRUNK', 'SIP INVITE'],
    'RTP': ['RFC 3550', 'REAL-TIME TRANSPORT', 'MEDIA STREAM', 'RTCP'],
    'MGCP': ['RFC 3435', 'MEDIA GATEWAY CONTROL'],
    // Routing
    'BGP': ['RFC 4271', 'BORDER GATEWAY', 'EBGP', 'IBGP', 'AS PATH'],
    'OSPF': ['RFC 2328', 'OPEN SHORTEST PATH', 'LINK STATE', 'LSA'],
    'IS-IS': ['ISO 10589', 'INTERMEDIATE SYSTEM'],
    'MPLS': ['LABEL SWITCHING', 'LABEL STACK', 'LDP', 'RSVP-TE'],
    // Infrastructure
    'DHCP': ['RFC 2131', 'DYNAMIC HOST', 'DHCP RELAY', 'DHCP SERVER', 'DHCPDISCOVER'],
    'DNS': ['RFC 1035', 'DOMAIN NAME', 'DNS QUERY', 'DNS RESOLVER', 'NXDOMAIN'],
    'NTP': ['RFC 5905', 'NETWORK TIME', 'TIME SYNC', 'STRATUM'],
    'SNMP': ['RFC 3411', 'SIMPLE NETWORK MANAGEMENT', 'MIB', 'OID', 'TRAP'],
    'Syslog': ['RFC 5424', 'SYSTEM LOG', 'LOG SERVER', 'FACILITY', 'SEVERITY'],
    'NetFlow': ['RFC 7011', 'IPFIX', 'FLOW EXPORT', 'NETFLOW COLLECTOR'],
    'NETCONF': ['RFC 6241', 'NETWORK CONFIGURATION', 'YANG MODEL'],
    // Security
    'TLS': ['RFC 8446', 'TRANSPORT LAYER SECURITY', 'SSL', 'CERTIFICATE', 'HANDSHAKE'],
    'IKE': ['RFC 7296', 'INTERNET KEY EXCHANGE', 'IKEV2', 'IKE NEGOTIATION'],
    'IPsec': ['RFC 4301', 'IP SECURITY', 'ESP', 'AH HEADER', 'SECURITY ASSOCIATION'],
    '802.1X': ['PORT-BASED', 'NETWORK ACCESS CONTROL', 'EAPOL', 'EAP-TLS', 'EAP-TTLS', 'PEAP'],
    'LDAP': ['RFC 4511', 'LIGHTWEIGHT DIRECTORY', 'DIRECTORY SERVICE', 'LDAP BIND'],
    'Kerberos': ['RFC 4120', 'KDC', 'TICKET GRANTING', 'TGT', 'SERVICE TICKET'],
    'OAuth': ['RFC 6749', 'OAUTH2', 'AUTHORIZATION CODE', 'ACCESS TOKEN', 'BEARER TOKEN'],
    // Messaging/IoT
    'MQTT': ['MESSAGE QUEUE TELEMETRY', 'IOT MESSAGING', 'MQTT BROKER', 'PUBLISH SUBSCRIBE'],
    'AMQP': ['ADVANCED MESSAGE QUEUING', 'MESSAGE BROKER', 'RABBITMQ'],
    'CoAP': ['RFC 7252', 'CONSTRAINED APPLICATION', 'IOT PROTOCOL'],
    // Storage
    'iSCSI': ['RFC 7143', 'INTERNET SCSI', 'ISCSI TARGET', 'ISCSI INITIATOR'],
    'NFS': ['RFC 7530', 'NETWORK FILE SYSTEM', 'NFS MOUNT', 'NFS EXPORT'],
    'SMB': ['CIFS', 'SERVER MESSAGE BLOCK', 'FILE SHARE', 'SAMBA'],
    // Web/API
    'HTTP': ['REST API', 'HTTP REQUEST', 'HTTP RESPONSE', 'STATUS CODE'],
    'WebSocket': ['RFC 6455', 'WEBSOCKET', 'WS://', 'WSS://'],
    'gRPC': ['GRPC', 'PROTOBUF', 'PROTOCOL BUFFERS'],
    'GraphQL': ['GRAPHQL', 'QUERY LANGUAGE'],
    // Cloud/SDN
    'VXLAN': ['RFC 7348', 'VIRTUAL EXTENSIBLE', 'VNI', 'VTEP'],
    'OpenFlow': ['SDN PROTOCOL', 'OPENFLOW', 'FLOW TABLE'],
  };

  for (const [iface, keywords] of Object.entries(keywordMap)) {
    if (!detectedInterfaces.includes(iface)) {
      if (keywords.some(kw => contentUpper.includes(kw))) {
        detectedInterfaces.push(iface);
      }
    }
  }

  if (detectedInterfaces.length === 0) return '';

  let hints = `
## Protocol Terminology for Detected Interfaces

The following interfaces are mentioned in this section. Use the **exact protocol command names** shown below, NOT generic descriptions like "send request" or "policy update":

`;

  for (const iface of detectedInterfaces) {
    const info = INTERFACE_PROTOCOL_MAP[iface];
    if (info) {
      hints += `**${iface}** (${info.description}):
- Commands/Messages: ${info.commands}

`;
    }
  }

  hints += `**IMPORTANT**: When writing about these interfaces, use the specific command names above. For example:

**3GPP/Telecom:**
- WRONG: "The PCEF sends a policy request to the PCRF over Gx"
- CORRECT: "The PCEF sends a CCR-I (Credit-Control-Request-Initial) to the PCRF over Gx"

**AAA:**
- WRONG: "The AAA system sends accounting information"
- CORRECT: "The AAA server sends Accounting-Request (Acct-Status-Type=Start) per RFC 2866"

**Routing:**
- WRONG: "The router sends route updates to its peer"
- CORRECT: "The router sends a BGP UPDATE message with NLRI and AS_PATH attributes"

**Network Management:**
- WRONG: "The NMS queries the device for data"
- CORRECT: "The NMS sends SNMP GetRequest for OID 1.3.6.1.2.1.1.1.0 (sysDescr)"

**Security:**
- WRONG: "The client establishes a secure connection"
- CORRECT: "The client sends TLS ClientHello; server responds with ServerHello and Certificate"

**VoIP:**
- WRONG: "User A calls User B"
- CORRECT: "UAC sends SIP INVITE to UAS; receives 100 Trying, 180 Ringing, then 200 OK"
`;

  return hints;
}

// ========== Context Builders ==========

export interface FlexibleSectionContext {
  brsContent?: string;
  previousSections?: string;
  domainConfig?: DomainConfig;
  userGuidance?: string;
  referenceExcerpts?: ExtractedExcerpt[];
  webSearchResults?: WebSearchResult[];
  markdownGuidance?: MarkdownGenerationGuidance | null;
  sectionNumber?: string;  // e.g., "1", "2.1"
  includeDiagrams?: boolean;  // Whether to include diagram placeholder instructions (default: true)
  requirementCounters?: RequirementCounterState;  // Counter state from previous sections
  enableRequirementNumbering?: boolean;  // Whether to include requirement IDs
}

/**
 * Build domain expertise section based on configuration
 */
function buildDomainExpertise(domainConfig?: DomainConfig): string {
  if (!domainConfig?.domain) {
    return `
## Domain Expertise
You are an expert technical specification writer. Adapt your writing style, terminology,
and level of detail to match the subject matter provided in the requirements.

**Terminology Precision:**

When reference documents are provided, they define the **authoritative vocabulary** for this specification:

- **Protocol commands:** Use exact command names (CCR-I, UPDATE, INVITE), not generic verbs (request, send, notify)
- **Message types:** Use defined message names (Credit-Control-Answer, 200 OK), not descriptions (success response)
- **Procedures:** Use procedure names from standards (EPS Bearer Modification, TCP Three-Way Handshake)
- **Interfaces:** Use exact interface designations (Gx, S1-U, eth0), with protocol details where defined

Generic paraphrasing reduces specification precision and implementability. When in doubt, prefer the terminology found in reference documents.
`;
  }

  const { domain, industry, standards, terminology } = domainConfig;

  let expertise = `
## Domain Expertise
You are an expert technical specification writer specializing in **${domain}**`;

  if (industry) {
    expertise += ` with focus on **${industry}**`;
  }
  expertise += '.\n\n';

  if (standards && standards.length > 0) {
    expertise += `**Reference Standards:** ${standards.join(', ')}\n\n`;
    expertise += `Ensure alignment with these standards where applicable. Use standard terminology and reference formats.\n\n`;
  }

  if (terminology && Object.keys(terminology).length > 0) {
    expertise += `**Key Terminology:**\n`;
    for (const [term, definition] of Object.entries(terminology)) {
      expertise += `- **${term}**: ${definition}\n`;
    }
    expertise += '\n';
  }

  // Add terminology authority instruction
  expertise += `
**Terminology Precision:**

When reference documents are provided, they define the **authoritative vocabulary** for this specification:

- **Protocol commands:** Use exact command names (CCR-I, UPDATE, INVITE), not generic verbs (request, send, notify)
- **Message types:** Use defined message names (Credit-Control-Answer, 200 OK), not descriptions (success response)
- **Procedures:** Use procedure names from standards (EPS Bearer Modification, TCP Three-Way Handshake)
- **Interfaces:** Use exact interface designations (Gx, S1-U, eth0), with protocol details where defined

Generic paraphrasing reduces specification precision and implementability. When in doubt, prefer the terminology found in reference documents.
`;

  return expertise;
}

/**
 * Build normative language guidance based on domain configuration
 */
function buildNormativeLanguageGuidance(domainConfig?: DomainConfig): string {
  const style = domainConfig?.normativeLanguage || 'RFC2119';
  const custom = domainConfig?.customNormativeTerms;

  if (custom) {
    return `
## Requirements Language
Use the following terms for requirements:
- **${custom.shall}** - Absolute requirement (mandatory)
- **${custom.should}** - Recommendation (deviations must be justified)
- **${custom.may}** - Optional feature
`;
  }

  switch (style) {
    case 'RFC2119':
      return `
## Requirements Language (RFC 2119)
Use standard normative language:
- **SHALL / SHALL NOT** - Absolute requirement/prohibition
- **SHOULD / SHOULD NOT** - Recommended (deviations require justification)
- **MAY** - Optional
`;
    case 'IEEE':
      return `
## Requirements Language (IEEE Style)
Use lowercase normative language:
- **shall** - Mandatory requirement
- **should** - Recommended
- **may** - Optional/permitted
`;
    case 'ISO':
      return `
## Requirements Language (ISO Style)
Use title case normative language:
- **Must** - Mandatory requirement
- **Should** - Recommended
- **May** - Optional
`;
    default:
      return `
## Requirements Language
Use clear requirements language:
- Use "shall" or "must" for mandatory requirements
- Use "should" for recommendations
- Use "may" for optional features
`;
  }
}

/**
 * Build reference context from extracted excerpts
 */
function buildReferenceContext(excerpts?: ExtractedExcerpt[]): string {
  if (!excerpts || excerpts.length === 0) return '';

  let context = `
## Reference Documents

The following excerpts from reference documents are relevant to this section:

`;

  for (const excerpt of excerpts) {
    context += `### From: ${excerpt.referenceTitle}
${excerpt.content}

---

`;
  }

  // Add terminology extraction instruction
  context += `
## IMPORTANT: Reference Terminology Requirements

The reference documents above define the **authoritative terminology** for this specification. You MUST:

1. **Extract and use exact protocol/command names** from references:
   - Telecom/Diameter: "CCR-I", "CCA-U", "RAR" (not "policy request", "charging update")
   - Networking/BGP: "UPDATE", "KEEPALIVE", "NOTIFICATION" (not "route change", "heartbeat")
   - WiFi/802.11: "Association Request", "Beacon", "Probe Response" (not "connect request", "broadcast")
   - SIP: "INVITE", "BYE", "REGISTER" (not "call request", "hangup", "login")
   - HTTP/REST: "GET", "POST 201 Created", "PUT" (not "fetch", "create", "update")

2. **Do NOT paraphrase protocol terminology** with generic descriptions:
   - WRONG: "send a policy request to the PCRF"
   - CORRECT: "send a CCR-I (Credit-Control-Request-Initial) to the PCRF"
   - WRONG: "route update message"
   - CORRECT: "BGP UPDATE message with NLRI and Path Attributes"
   - WRONG: "device connects to WiFi"
   - CORRECT: "STA transmits Association Request frame; AP responds with Association Response"

3. **Use abbreviated forms with full expansion on first use:**
   - First use: "Credit-Control-Request-Initial (CCR-I)"
   - Subsequent uses: "CCR-I"

4. **Include procedure/command sequences** where references define them:
   - If reference defines "session establishment uses CCR-I/CCA-I exchange", include that detail
   - If reference defines "state machine transitions", include those states and triggers

The goal is an **implementable specification** where engineers can trace requirements directly to protocol commands.
`;

  return context;
}

/**
 * Build web search context from results
 */
function buildWebSearchContext(results?: WebSearchResult[]): string {
  if (!results || results.length === 0) return '';

  let context = `
## Web Search Results

The following information was found via web search and may be relevant:

`;

  for (const result of results) {
    context += `### ${result.title}
Source: ${result.url}

${result.description}

---

`;
  }

  context += `
**Note:** Use web search results for supplementary information. Cite sources when using specific facts.
`;

  return context;
}

/**
 * Build markdown formatting instructions
 *
 * These instructions ensure generated markdown aligns with DOCX export requirements.
 * Heading levels in markdown map directly to Word heading styles:
 * - # (H1) → Heading 1 in Word
 * - ## (H2) → Heading 2 in Word
 * - ### (H3) → Heading 3 in Word, etc.
 */
function buildFormattingInstructions(guidance?: MarkdownGenerationGuidance | null): string {
  if (!guidance) {
    // Default formatting guidance when no template is provided
    return `
## Output Format (DOCX-Aligned)

**Heading Levels** (will map to Word heading styles):
- \`#\` (H1) for main sections (1, 2, 3...) → Heading 1 in Word
- \`##\` (H2) for subsections (1.1, 2.1...) → Heading 2 in Word
- \`###\` (H3) for sub-subsections (1.1.1...) → Heading 3 in Word
- Maximum depth: 6 levels (H6)

**Numbering**: Decimal style (1, 1.1, 1.1.1) - include numbers in your headings

**Figures**: Use \`{{fig:diagram-id}}\` syntax. Caption placement: below the figure.
- **IMPORTANT**: ALWAYS add a caption line after each figure reference:
\`\`\`
{{fig:diagram-id}}

*Figure X-Y: Descriptive caption explaining the diagram*
\`\`\`

**Tables**: Use standard markdown tables. Caption placement: above the table.

**Lists**:
- Use \`-\` for bullet lists
- Use \`1.\` for ordered/numbered lists

**Emphasis**:
- Use \`**bold**\` for emphasis
- Use \`*italic*\` for technical terms on first use
`;
  }

  // Template-specific formatting guidance
  let instructions = `
## Output Format (DOCX-Aligned)

**Heading Levels** (will map to Word heading styles):
- \`#\` (H1) for main sections → Heading 1 in Word
- \`##\` (H2) for subsections → Heading 2 in Word
- \`###\` (H3) for sub-subsections → Heading 3 in Word
`;

  if (guidance.headingLevels) {
    instructions += `- Maximum depth: ${guidance.headingLevels.maxDepth} levels\n`;
    if (guidance.headingLevels.numberingStyle === 'decimal') {
      instructions += `- **Numbering**: Decimal style (1, 1.1, 1.1.1) - include numbers in headings\n`;
    } else {
      instructions += `- **Numbering**: ${guidance.headingLevels.numberingStyle}\n`;
    }
    instructions += '\n';
  }

  if (guidance.figureFormat) {
    instructions += `**Figures**:
- Pattern: ${guidance.figureFormat.numberingPattern}
- Caption placement: ${guidance.figureFormat.captionPlacement}
- Syntax: Use \`${guidance.figureFormat.syntax}\` for figure references
- **IMPORTANT**: ALWAYS add a caption line after each figure reference:

\`\`\`markdown
{{fig:diagram-id}}

*Figure X-Y: Descriptive caption explaining the diagram*
\`\`\`

`;
  }

  if (guidance.tableFormat) {
    instructions += `**Tables**:
- Pattern: ${guidance.tableFormat.numberingPattern}
- Caption placement: ${guidance.tableFormat.captionPlacement}
- Use ${guidance.tableFormat.useMarkdownTables ? 'standard markdown tables' : 'HTML tables if complex'}

`;
  }

  if (guidance.listFormat) {
    instructions += `**Lists**:
- Bullets: Use \`${guidance.listFormat.bulletChar}\`
- Numbered: Use \`${guidance.listFormat.orderedStyle}\`

`;
  }

  if (guidance.emphasis) {
    instructions += `**Emphasis**:
- Bold: Use \`${guidance.emphasis.bold}text${guidance.emphasis.bold}\`
- Italic: Use \`${guidance.emphasis.italic}text${guidance.emphasis.italic}\`

`;
  }

  if (guidance.codeBlockStyle) {
    instructions += `**Code Blocks**: Use ${guidance.codeBlockStyle.fenced ? 'fenced (```)' : 'indented'} code blocks${guidance.codeBlockStyle.languageHints ? ' with language hints' : ''}\n\n`;
  }

  // Add Pandoc custom-style instructions when enabled
  if (guidance.pandocStyles?.enabled) {
    instructions += `
**Pandoc Custom Styles** (for professional DOCX export):

Use fenced divs with \`custom-style\` attribute to apply Word styles from the template:

`;

    if (guidance.pandocStyles.figureCaption) {
      instructions += `**Figure Captions**:
\`\`\`markdown
{{fig:diagram-id}}

::: {custom-style="${guidance.pandocStyles.figureCaption}"}
Figure 1: Diagram Title
:::
\`\`\`

`;
    }

    if (guidance.pandocStyles.tableCaption) {
      instructions += `**Table Captions**:
\`\`\`markdown
::: {custom-style="${guidance.pandocStyles.tableCaption}"}
Table 1: Data Summary
:::

| Column 1 | Column 2 |
|----------|----------|
| Data     | Data     |
\`\`\`

`;
    }

    if (guidance.pandocStyles.appendixHeading) {
      instructions += `**Appendix Headings** (use instead of # for appendices):
\`\`\`markdown
::: {custom-style="${guidance.pandocStyles.appendixHeading}"}
Appendix A: Glossary
:::
\`\`\`

`;
    }

    if (guidance.pandocStyles.noteStyle) {
      instructions += `**Notes/Warnings**:
\`\`\`markdown
::: {custom-style="${guidance.pandocStyles.noteStyle}"}
Note: Important information here.
:::
\`\`\`

`;
    }

    instructions += `**Important**: The \`::: {custom-style="StyleName"}\` syntax maps directly to Word paragraph styles in the template. Use these for captions and special formatting to ensure consistent professional output.

`;
  }

  return instructions;
}

// ========== Main Prompt Builder ==========

/**
 * Build a flexible section prompt that adapts to any domain
 *
 * This is the main prompt builder that replaces all the rigid template-specific
 * builders (build3GPPScopePrompt, build3GPPArchitecturePrompt, etc.)
 *
 * @param section - The section definition with user-editable description
 * @param context - All available context (BRS, references, search results, etc.)
 * @returns Complete prompt for generating the section
 */
export function buildFlexibleSectionPrompt(
  section: FlexibleSection,
  context: FlexibleSectionContext
): string {
  const {
    brsContent,
    previousSections,
    domainConfig,
    userGuidance,
    referenceExcerpts,
    webSearchResults,
    markdownGuidance,
    sectionNumber,
    includeDiagrams,
    requirementCounters,
    enableRequirementNumbering,
  } = context;

  // Build the heading - determine level from section number depth
  // "1" → # (H1), "1.1" → ## (H2), "1.1.1" → ### (H3), etc.
  const getHeadingLevel = (num?: string): string => {
    if (!num) return '##'; // Default to H2 if no number
    const depth = num.split('.').length;
    return '#'.repeat(Math.min(depth, 6)); // Max H6
  };

  const headingPrefix = getHeadingLevel(sectionNumber);
  const heading = sectionNumber
    ? `${headingPrefix} ${sectionNumber} ${section.title}`
    : `## ${section.title}`;

  // Compose the prompt
  let prompt = `# Generate Section: ${section.title}

${buildDomainExpertise(domainConfig)}

${buildNormativeLanguageGuidance(domainConfig)}

---

## Section Requirements

**Section:** ${heading}

**What This Section Should Cover:**
${section.description}

`;

  // Add suggested subsections if provided
  if (section.suggestedSubsections && section.suggestedSubsections.length > 0) {
    prompt += `**Suggested Subsections:**
${section.suggestedSubsections.map((s, i) => `${sectionNumber ? `${sectionNumber}.${i + 1}` : `${i + 1}.`} ${s}`).join('\n')}

These are suggestions - you may adapt the structure based on the content requirements.

`;
  }

  // Add user's custom guidance for this section
  if (section.contentGuidance) {
    prompt += `**Specific Requirements for This Section:**
${section.contentGuidance}

`;
  }

  // Add diagram placeholder requirements (only if not explicitly disabled)
  // Default is true - diagrams are included unless user unchecks the option
  if (includeDiagrams !== false && section.includeDiagrams !== false) {
    prompt += DIAGRAM_PLACEHOLDER_REQUIREMENTS;
  } else {
    prompt += `
## Diagram Placeholders

**IMPORTANT: Do NOT include any diagram placeholders in this section.**
The user has explicitly disabled diagram generation for this section.
Do not use \`{{fig:...}}\` syntax or include any TODO comments for diagrams.
`;
  }

  // Add requirement numbering guidance
  // Check both context-level and section-level settings (default to enabled)
  const enableReqNumbering = enableRequirementNumbering !== false && section.enableRequirementNumbering !== false;
  prompt += buildRequirementNumberingSection(enableReqNumbering, requirementCounters);

  // Add context sections
  prompt += `
---

## Available Context

`;

  // BRS content
  if (brsContent) {
    // Include more content for single section generation
    const maxBrsChars = 5000;
    const truncatedBrs = brsContent.length > maxBrsChars
      ? brsContent.slice(0, maxBrsChars) + '\n\n[... truncated for length ...]'
      : brsContent;

    prompt += `### Business Requirements Specification

${truncatedBrs}

`;
  }

  // Previous sections for consistency
  if (previousSections) {
    const maxPrevChars = 3000;
    const truncatedPrev = previousSections.length > maxPrevChars
      ? '...' + previousSections.slice(-maxPrevChars)
      : previousSections;

    prompt += `### Previous Sections (for consistency)

${truncatedPrev}

`;
  }

  // Reference documents
  prompt += buildReferenceContext(referenceExcerpts);

  // Web search results
  prompt += buildWebSearchContext(webSearchResults);

  // Global user guidance
  if (userGuidance) {
    prompt += `
---

## User Guidance

${userGuidance}

`;
  }

  // Interface terminology hints - detect interfaces from all available context
  // and provide exact protocol command names to use
  const contextForInterfaceDetection = [
    brsContent || '',
    previousSections || '',
    section.description || '',
    section.contentGuidance || '',
    userGuidance || '',
  ].join('\n');
  prompt += buildInterfaceTerminologyHints(contextForInterfaceDetection);

  // Formatting instructions
  prompt += buildFormattingInstructions(markdownGuidance);

  // Output requirements
  prompt += `
---

## Output Requirements

Generate the complete section content in markdown format.

**CRITICAL:**
- Start with the section heading: \`${heading}\`
- Include all relevant content from the requirements
- Adapt terminology and formality to match the domain
- Use diagram placeholders where visual aids would help
- Maintain consistency with previous sections (if provided)
- Output ONLY the section content - no explanations or meta-commentary

**DO NOT:**
- Include placeholder text like "[Content to be added]"
- Add sections beyond what was requested
- Include document title, author, date, or version
- Use ASCII art or text-based diagrams
`;

  return prompt;
}

// ========== Specialized Section Helpers ==========

/**
 * Build prompt for an introduction/scope section
 */
export function buildIntroductionSectionPrompt(
  section: FlexibleSection,
  context: FlexibleSectionContext
): string {
  // Enhance the section description for introduction-type sections
  const enhancedSection: FlexibleSection = {
    ...section,
    description: section.description || `
Define the scope, purpose, and boundaries of this specification.
Include:
- What the specification covers
- What is explicitly out of scope
- Target audience
- Document structure overview
`,
    suggestedSubsections: section.suggestedSubsections || [
      'Purpose',
      'Scope',
      'Audience',
      'Document Organization',
    ],
  };

  return buildFlexibleSectionPrompt(enhancedSection, context);
}

/**
 * Build prompt for an architecture section
 */
export function buildArchitectureSectionPrompt(
  section: FlexibleSection,
  context: FlexibleSectionContext
): string {
  const enhancedSection: FlexibleSection = {
    ...section,
    description: section.description || `
Describe the system architecture and design.
Include:
- High-level architecture overview
- Key components and their responsibilities
- Interfaces and integration points, with specific protocol commands/messages used on each interface
  (e.g., "Gx interface: CCR-I/CCR-U/CCR-T commands", not just "Gx interface: policy control")
- Data flows and communication patterns with exact message names from reference documents
`,
    suggestedSubsections: section.suggestedSubsections || [
      'Architecture Overview',
      'Components',
      'Interfaces',
      'Data Flow',
    ],
  };

  return buildFlexibleSectionPrompt(enhancedSection, context);
}

/**
 * Build prompt for a requirements section
 */
export function buildRequirementsSectionPrompt(
  section: FlexibleSection,
  context: FlexibleSectionContext
): string {
  const enhancedSection: FlexibleSection = {
    ...section,
    description: section.description || `
Define the functional and non-functional requirements.
Include:
- Functional requirements with unique IDs
- Performance requirements
- Security requirements
- Reliability and availability requirements
`,
    suggestedSubsections: section.suggestedSubsections || [
      'Functional Requirements',
      'Performance Requirements',
      'Security Requirements',
      'Reliability Requirements',
    ],
  };

  return buildFlexibleSectionPrompt(enhancedSection, context);
}

/**
 * Build prompt for a procedures section
 */
export function buildProceduresSectionPrompt(
  section: FlexibleSection,
  context: FlexibleSectionContext
): string {
  const enhancedSection: FlexibleSection = {
    ...section,
    description: section.description || `
Document operational procedures and workflows.
Include:
- Step-by-step procedures with exact protocol command sequences from reference documents
- Include specific message names, not generic descriptions (e.g., "UE sends Attach Request" not "UE requests attachment")
- Sequence diagrams for complex flows showing actual protocol messages
- Error handling procedures with specific error codes and responses
- State transitions using terminology from standards
`,
    suggestedSubsections: section.suggestedSubsections || [
      'Standard Procedures',
      'Error Handling',
      'Recovery Procedures',
    ],
  };

  // Add emphasis on sequence diagrams for procedures
  const enhancedContext: FlexibleSectionContext = {
    ...context,
    userGuidance: `${context.userGuidance || ''}

For each significant procedure:
1. Provide a step-by-step description
2. Include a sequence diagram placeholder: {{fig:procedure-name-flow}}
3. Document success and failure scenarios
`,
  };

  return buildFlexibleSectionPrompt(enhancedSection, enhancedContext);
}
