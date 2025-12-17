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
import { extractRelevantExcerpts } from '../contextManager';
import { countTokens } from '../tokenCounter';

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
        "description": "Brief description (1-2 sentences max)",
        "rationale": "Brief rationale (1 sentence)",
        "suggestedSubsections": ["Subsection 1", "Subsection 2"],
        "order": 1,
        "confidence": 0.95,
        "sourceHints": ["BRS section reference"]
      }
    ],
    "domainConfig": {
      "domain": "telecommunications",
      "industry": "5G mobile networks",
      "standards": ["3GPP TS 23.501"],
      "terminology": {
        "UE": "User Equipment"
      },
      "normativeLanguage": "RFC2119"
    },
    "formatGuidance": "Brief formatting note",
    "rationale": "Overall rationale (1-2 sentences)"
  },
  "domainInference": {
    "domain": "telecommunications",
    "industry": "5G mobile networks",
    "confidence": 0.9,
    "reasoning": "Brief explanation (1-2 sentences)",
    "detectedStandards": ["3GPP TS 23.501"],
    "suggestedTerminology": {
      "UE": "User Equipment"
    }
  }
}
\`\`\`

## CRITICAL CONSTRAINTS
- Respond with ONLY the JSON object wrapped in a markdown code block
- No explanations or text before or after the JSON
- Keep descriptions and rationales BRIEF (1-2 sentences max)
- Limit terminology to 5-10 most important terms
- Limit suggestedSubsections to 3-5 per section
- Limit standards to the most relevant ones (max 5)
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
  technicalGuidance?: string;
}): string {
  const { brsContent, referenceDocuments, userGuidance, technicalGuidance } = params;

  let prompt = `# Analyze Requirements and Propose Document Structure

## Business Requirements Specification (BRS)

${brsContent}

`;

  // Add reference documents with content if available
  if (referenceDocuments && referenceDocuments.length > 0) {
    // Check if references have content
    const refsWithContent = referenceDocuments.filter(ref => ref.content && ref.content.trim().length > 0);

    if (refsWithContent.length > 0) {
      // Calculate token budget for references (generous allocation for structure planning)
      const brsTokens = countTokens(brsContent);
      const maxRefTokens = Math.min(50000, Math.max(10000, 100000 - brsTokens)); // Leave room for BRS

      // Extract relevant excerpts based on BRS content
      const excerpts = extractRelevantExcerpts(refsWithContent, brsContent, maxRefTokens);

      if (excerpts.length > 0) {
        prompt += `## Reference Documents

The following reference documents provide context for structure decisions:

`;
        // Group excerpts by reference
        const byRef = new Map<string, typeof excerpts>();
        for (const excerpt of excerpts) {
          const existing = byRef.get(excerpt.referenceId) || [];
          existing.push(excerpt);
          byRef.set(excerpt.referenceId, existing);
        }

        Array.from(byRef.entries()).forEach(([refId, refExcerpts]) => {
          const ref = refsWithContent.find(r => r.id === refId);
          if (!ref) return;

          prompt += `### ${ref.title}`;
          if (ref.metadata?.spec) {
            prompt += ` (${ref.metadata.spec})`;
          }
          prompt += '\n\n';

          for (const excerpt of refExcerpts) {
            prompt += excerpt.content + '\n\n';
          }
        });
      }
    } else {
      // Fallback to just listing reference titles if no content available
      prompt += `## Reference Documents Available

The following reference documents are available (content not yet extracted):

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
  }

  // Add user guidance if provided
  if (userGuidance && userGuidance.trim()) {
    prompt += `## User Guidance

${userGuidance}

`;
  }

  // Add technical guidance if provided (helps inform structure decisions)
  if (technicalGuidance && technicalGuidance.trim()) {
    prompt += `## Technical Context

The following technical constraints, design decisions, or system context should inform the document structure:

${technicalGuidance}

Consider these technical aspects when deciding which sections to include (e.g., if there are integration requirements, ensure architecture sections cover interfaces; if there are security requirements, include security-focused sections).

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
  console.log('📄 Parsing structure proposal response, length:', response.length);

  // Try multiple extraction strategies
  const extractionStrategies = [
    // Strategy 1: Extract from markdown code blocks (```json ... ``` or ``` ... ```)
    () => {
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      return jsonMatch ? jsonMatch[1].trim() : null;
    },
    // Strategy 2: Find JSON object starting with { "proposedStructure"
    () => {
      const match = response.match(/\{\s*"proposedStructure"[\s\S]*\}/);
      return match ? match[0] : null;
    },
    // Strategy 3: Find any JSON object that spans most of the response
    () => {
      const firstBrace = response.indexOf('{');
      const lastBrace = response.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        return response.slice(firstBrace, lastBrace + 1);
      }
      return null;
    },
    // Strategy 4: Try the entire response as-is
    () => response.trim(),
  ];

  for (let i = 0; i < extractionStrategies.length; i++) {
    const jsonStr = extractionStrategies[i]();
    if (!jsonStr) continue;

    try {
      // Try to fix common JSON issues before parsing
      let fixedJson = jsonStr;

      // Remove trailing commas before } or ]
      fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');

      // Try parsing
      const parsed = JSON.parse(fixedJson);

      // Validate required fields
      if (!parsed.proposedStructure || !parsed.domainInference) {
        console.warn(`Strategy ${i + 1}: Parsed JSON but missing required fields. Keys found:`, Object.keys(parsed));
        continue;
      }

      // Validate sections array exists
      if (!Array.isArray(parsed.proposedStructure.sections)) {
        console.warn(`Strategy ${i + 1}: proposedStructure.sections is not an array`);
        continue;
      }

      // Ensure domainConfig exists with defaults
      if (!parsed.proposedStructure.domainConfig) {
        parsed.proposedStructure.domainConfig = {
          domain: parsed.domainInference?.domain || 'general',
          normativeLanguage: 'RFC2119',
        };
      }

      console.log(`✅ Successfully parsed with strategy ${i + 1}`);
      return {
        proposedStructure: parsed.proposedStructure,
        domainInference: parsed.domainInference,
      };
    } catch (error) {
      console.warn(`Strategy ${i + 1} failed:`, error instanceof Error ? error.message : error);
      // Log a snippet of what we tried to parse
      if (jsonStr.length > 0) {
        console.warn(`Strategy ${i + 1} attempted to parse (first 200 chars):`, jsonStr.slice(0, 200));
      }
    }
  }

  // Log more context for debugging
  console.error('❌ All parsing strategies failed.');
  console.error('Response preview (first 500 chars):', response.slice(0, 500));
  console.error('Response preview (last 500 chars):', response.slice(-500));
  return null;
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
