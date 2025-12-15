/**
 * Structure Discovery Prompts
 *
 * Prompts for AI-assisted document structure analysis and proposal.
 * Used by the Structure Discovery workflow to analyze BRS content and
 * propose appropriate document sections.
 */

import type {
  ReferenceDocument,
  ProposedStructure,
  ProposedSection,
  DomainInference,
  AIMessage,
} from '../../../types';

// ========== Constants ==========

const STRUCTURE_OUTPUT_FORMAT = `
## Output Format

You MUST respond with valid JSON in the following format:

\`\`\`json
{
  "proposedStructure": {
    "sections": [
      {
        "id": "unique-section-id",
        "title": "Section Title",
        "description": "What this section should contain (2-4 sentences)",
        "rationale": "Why this section is needed based on the BRS",
        "suggestedSubsections": ["Subsection 1", "Subsection 2"],
        "order": 1,
        "confidence": 0.95,
        "sourceHints": ["BRS section or reference that informed this"]
      }
    ],
    "domainConfig": {
      "domain": "telecommunications",
      "industry": "5G mobile networks",
      "standards": ["3GPP TS 23.501", "3GPP TS 23.502"],
      "terminology": {
        "UE": "User Equipment",
        "AMF": "Access and Mobility Management Function"
      },
      "normativeLanguage": "RFC2119"
    },
    "formatGuidance": "Brief formatting recommendations",
    "rationale": "Overall rationale for this structure"
  },
  "domainInference": {
    "domain": "telecommunications",
    "industry": "5G mobile networks",
    "confidence": 0.9,
    "reasoning": "Explanation of why this domain was inferred",
    "detectedStandards": ["3GPP TS 23.501"],
    "suggestedTerminology": {
      "UE": "User Equipment"
    }
  }
}
\`\`\`

CRITICAL: Your response must be ONLY the JSON object, no markdown code blocks, no explanations before or after.
`;

// ========== Prompt Builders ==========

/**
 * Build the system prompt for structure proposal
 */
export function buildStructureProposalSystemPrompt(): string {
  return `You are an expert technical specification architect. Your task is to analyze business requirements and propose an optimal document structure.

## Your Expertise
- Deep knowledge of technical specification standards (3GPP, IEEE, ISO, IETF)
- Understanding of domain-specific documentation patterns
- Ability to infer document domain from content
- Experience structuring complex technical documents

## Your Responsibilities
1. Analyze the provided Business Requirements Specification (BRS)
2. Infer the domain, industry, and applicable standards
3. Propose a logical document structure with clear sections
4. Provide rationale for each proposed section
5. Suggest terminology and formatting guidance

## Guidelines
- Propose 6-12 sections typically (adjust based on complexity)
- Each section should map to content in the BRS
- Include standard sections (Introduction, Scope, References, etc.)
- Add domain-specific sections based on content analysis
- Assign confidence scores based on how clearly the BRS indicates the need
- Use descriptive section IDs (kebab-case)

${STRUCTURE_OUTPUT_FORMAT}`;
}

/**
 * Build the user prompt for structure proposal
 */
export function buildStructureProposalPrompt(params: {
  brsContent: string;
  referenceDocuments?: ReferenceDocument[];
  userGuidance: string;
}): string {
  const { brsContent, referenceDocuments, userGuidance } = params;

  let prompt = `# Analyze Requirements and Propose Document Structure

## Business Requirements Specification (BRS)

${brsContent}

`;

  // Add reference documents summary if available
  if (referenceDocuments && referenceDocuments.length > 0) {
    prompt += `## Reference Documents Available

The following reference documents are available for context:

`;
    for (const ref of referenceDocuments) {
      prompt += `- **${ref.title}** (${ref.type})`;
      if (ref.metadata?.spec) {
        prompt += ` - ${ref.metadata.spec}`;
      }
      prompt += '\n';
    }
    prompt += '\n';
  }

  // Add user guidance if provided
  if (userGuidance && userGuidance.trim()) {
    prompt += `## User Guidance

${userGuidance}

`;
  }

  prompt += `## Task

Based on the BRS content above:

1. **Infer the Domain**: Identify the primary domain, industry, and any referenced standards
2. **Propose Document Structure**: Create a logical section hierarchy that covers all requirements
3. **Provide Rationale**: Explain why each section is needed
4. **Suggest Formatting**: Recommend normative language style and key terminology

Consider:
- What are the main functional areas described?
- What technical architecture needs to be documented?
- What procedures or workflows are mentioned?
- What standards or specifications are referenced?
- What domain-specific terminology is used?

Respond with the JSON structure as specified.`;

  return prompt;
}

/**
 * Build the system prompt for structure refinement chat
 */
export function buildStructureRefinementSystemPrompt(): string {
  return `You are an expert technical specification architect helping refine a document structure through conversation.

## Context
The user has received an AI-proposed document structure and wants to refine it through chat. You can:
- Add new sections
- Remove sections
- Modify section titles, descriptions, or order
- Adjust domain configuration
- Answer questions about the proposed structure

## Response Format

For conversational responses (questions, explanations):
Respond naturally in markdown format.

For structural changes, include a JSON block:

\`\`\`json
{
  "action": "update_structure",
  "changes": [
    {
      "type": "add|remove|modify|reorder",
      "sectionId": "section-id",
      "updates": { /* partial section updates */ },
      "reason": "Why this change was made"
    }
  ],
  "updatedSections": [ /* full updated sections array if reordering */ ]
}
\`\`\`

If no structural changes are needed, respond conversationally without JSON.

## Guidelines
- Be helpful and explain your reasoning
- Make minimal changes to address the user's request
- Preserve sections that weren't mentioned
- Update order numbers when reordering
- Maintain consistent section IDs`;
}

/**
 * Build the user prompt for structure refinement
 */
export function buildStructureRefinementPrompt(params: {
  currentStructure: ProposedStructure;
  chatHistory: AIMessage[];
  userMessage: string;
}): string {
  const { currentStructure, chatHistory, userMessage } = params;

  let prompt = `## Current Document Structure

**Domain**: ${currentStructure.domainConfig.domain}
**Industry**: ${currentStructure.domainConfig.industry || 'Not specified'}

### Sections:
`;

  for (const section of currentStructure.sections.sort((a, b) => a.order - b.order)) {
    prompt += `
${section.order}. **${section.title}** (id: ${section.id})
   ${section.description}
`;
    if (section.suggestedSubsections && section.suggestedSubsections.length > 0) {
      prompt += `   Subsections: ${section.suggestedSubsections.join(', ')}\n`;
    }
  }

  // Add recent chat history for context
  if (chatHistory.length > 0) {
    prompt += `\n## Recent Conversation\n\n`;
    // Include last 6 messages for context
    const recentHistory = chatHistory.slice(-6);
    for (const msg of recentHistory) {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      prompt += `**${role}**: ${msg.content}\n\n`;
    }
  }

  prompt += `## User Request

${userMessage}

---

Please respond to the user's request. If structural changes are needed, include the JSON update block.`;

  return prompt;
}

/**
 * Parse structure proposal response from AI
 */
export function parseStructureProposalResponse(response: string): {
  proposedStructure: Omit<ProposedStructure, 'id' | 'createdAt' | 'lastModifiedAt' | 'version'>;
  domainInference: DomainInference;
} | null {
  try {
    // Try to extract JSON from the response
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    if (!parsed.proposedStructure || !parsed.domainInference) {
      console.error('Missing required fields in structure proposal response');
      return null;
    }

    return {
      proposedStructure: parsed.proposedStructure,
      domainInference: parsed.domainInference,
    };
  } catch (error) {
    console.error('Failed to parse structure proposal response:', error);
    return null;
  }
}

/**
 * Parse structure refinement response from AI
 */
export function parseStructureRefinementResponse(response: string): {
  conversationalResponse: string;
  structureChanges: Array<{
    type: 'add' | 'remove' | 'modify' | 'reorder';
    sectionId: string;
    updates?: Partial<ProposedSection>;
    reason: string;
  }>;
  updatedSections?: ProposedSection[];
} {
  // Default: just conversational response
  const result = {
    conversationalResponse: response,
    structureChanges: [] as Array<{
      type: 'add' | 'remove' | 'modify' | 'reorder';
      sectionId: string;
      updates?: Partial<ProposedSection>;
      reason: string;
    }>,
    updatedSections: undefined as ProposedSection[] | undefined,
  };

  try {
    // Try to extract JSON block
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1].trim());

      if (parsed.action === 'update_structure' && parsed.changes) {
        result.structureChanges = parsed.changes;
        result.updatedSections = parsed.updatedSections;

        // Remove the JSON block from the conversational response
        result.conversationalResponse = response
          .replace(/```(?:json)?\s*[\s\S]*?```/g, '')
          .trim();
      }
    }
  } catch (error) {
    // If JSON parsing fails, just return the full response as conversational
    console.warn('No valid JSON in refinement response, treating as conversational');
  }

  return result;
}

/**
 * Generate a default structure for a given domain
 * Used as fallback if AI proposal fails
 */
export function generateDefaultStructure(domain: string = 'general'): ProposedSection[] {
  const baseSections: ProposedSection[] = [
    {
      id: 'introduction',
      title: 'Introduction',
      description: 'Provide an overview of the document, its purpose, and intended audience.',
      rationale: 'Every technical specification needs context and orientation.',
      suggestedSubsections: ['Purpose', 'Document Structure', 'Intended Audience'],
      order: 1,
      confidence: 1.0,
    },
    {
      id: 'scope',
      title: 'Scope',
      description: 'Define what the specification covers and explicitly what it does not cover.',
      rationale: 'Clear boundaries prevent scope creep and set expectations.',
      suggestedSubsections: ['In Scope', 'Out of Scope', 'Assumptions'],
      order: 2,
      confidence: 1.0,
    },
    {
      id: 'references',
      title: 'References',
      description: 'List all normative and informative references used in this specification.',
      rationale: 'Technical documents require traceable references.',
      suggestedSubsections: ['Normative References', 'Informative References'],
      order: 3,
      confidence: 1.0,
    },
    {
      id: 'definitions',
      title: 'Definitions and Abbreviations',
      description: 'Define key terms and abbreviations used throughout the document.',
      rationale: 'Ensures consistent understanding of terminology.',
      suggestedSubsections: ['Definitions', 'Abbreviations'],
      order: 4,
      confidence: 1.0,
    },
    {
      id: 'architecture',
      title: 'Architecture Overview',
      description: 'Describe the high-level system architecture and key components.',
      rationale: 'Architecture provides the foundation for understanding the system.',
      suggestedSubsections: ['System Overview', 'Components', 'Interfaces'],
      order: 5,
      confidence: 0.9,
    },
    {
      id: 'requirements',
      title: 'Functional Requirements',
      description: 'Detail the functional requirements the system must satisfy.',
      rationale: 'Core specification content derived from business requirements.',
      suggestedSubsections: ['General Requirements', 'Feature Requirements'],
      order: 6,
      confidence: 0.9,
    },
    {
      id: 'procedures',
      title: 'Procedures',
      description: 'Document operational procedures and workflows.',
      rationale: 'Procedures describe how the system behaves.',
      suggestedSubsections: ['Initialization', 'Normal Operations', 'Error Handling'],
      order: 7,
      confidence: 0.8,
    },
  ];

  // Add domain-specific sections
  if (domain === 'telecommunications' || domain === '3gpp') {
    baseSections.push({
      id: 'protocol-stack',
      title: 'Protocol Stack',
      description: 'Define the protocol layers and their interactions.',
      rationale: 'Telecom systems require clear protocol definitions.',
      suggestedSubsections: ['Control Plane', 'User Plane'],
      order: 8,
      confidence: 0.85,
    });
  }

  return baseSections;
}
