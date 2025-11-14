/**
 * Cascaded Refinement Prompts
 *
 * Prompts for analyzing impact and generating propagated changes
 * when refining sections of technical specifications.
 */

import type { AffectedSection, PropagatedChange } from '../../../types';

/**
 * Build prompt for analyzing impact of a section refinement
 */
export function buildImpactAnalysisPrompt(
  originalSection: string,
  refinedSection: string,
  sectionTitle: string,
  fullDocument: string,
  instruction: string
): string {
  return `You are analyzing the impact of a section refinement on a technical specification document.

**ORIGINAL SECTION (${sectionTitle}):**
\`\`\`markdown
${originalSection}
\`\`\`

**REFINED SECTION (${sectionTitle}):**
\`\`\`markdown
${refinedSection}
\`\`\`

**USER INSTRUCTION:**
"${instruction}"

**FULL DOCUMENT (for context):**
\`\`\`markdown
${fullDocument.substring(0, 15000)}...
[Document truncated for context - full document is ${fullDocument.length} characters]
\`\`\`

**TASK:**
Analyze what changed in the refined section and identify which other sections of the document may need corresponding changes.

For each potentially affected section, determine:
1. **Section ID and Title**: Which section is affected (e.g., "6.3 HSS Authentication Procedure")
2. **Impact Level**:
   - HIGH: Section directly references removed/changed components or procedures
   - MEDIUM: Section describes procedures/data related to changed components
   - LOW: Section mentions changed components in passing
3. **Impact Type**:
   - REMOVE: Entire section should be removed
   - MODIFY: Section needs specific changes
   - NONE: No changes needed
4. **Reasoning**: Explain why this section is affected and what changes might be needed

**GUIDELINES:**
- Look for references to removed components, interfaces, or procedures
- Check for data structures that depend on removed elements
- Identify procedures that reference modified architecture
- Consider error handling and edge cases
- Be conservative - only suggest HIGH impact if changes are truly necessary

**OUTPUT FORMAT (JSON):**
{
  "affectedSections": [
    {
      "sectionId": "6.3",
      "sectionTitle": "HSS Authentication Procedure",
      "impactLevel": "HIGH",
      "impactType": "REMOVE",
      "reasoning": "This entire procedure depends on the HSS/AuC component which was removed from the architecture."
    },
    {
      "sectionId": "6.1",
      "sectionTitle": "Attach Procedure",
      "impactLevel": "MEDIUM",
      "impactType": "MODIFY",
      "reasoning": "This procedure includes HSS authentication steps that need to be removed or modified."
    }
  ],
  "totalImpact": "HIGH",
  "reasoning": "The removal of HSS/AuC affects authentication procedures and related data structures throughout the document."
}

**IMPORTANT**: Output ONLY valid JSON, no explanations or markdown code blocks.`;
}

/**
 * Build prompt for generating a specific propagated change
 */
export function buildPropagationPrompt(
  affectedSection: AffectedSection,
  sectionContent: string,
  primaryChangeContext: string,
  fullDocument: string
): string {
  if (affectedSection.impactType === 'REMOVE') {
    return `You are analyzing whether a section should be removed due to a refinement.

**PRIMARY CHANGE:**
${primaryChangeContext}

**SECTION TO EVALUATE:**
${affectedSection.sectionTitle} (${affectedSection.sectionId})

**CURRENT CONTENT:**
\`\`\`markdown
${sectionContent}
\`\`\`

**IMPACT ANALYSIS:**
- Impact Level: ${affectedSection.impactLevel}
- Action Type: REMOVE
- Initial Reasoning: ${affectedSection.reasoning}

**TASK:**
Confirm whether this section should be removed and provide detailed reasoning.

**OUTPUT FORMAT (JSON):**
{
  "action": "REMOVE",
  "confidence": 0.95,
  "reasoning": "This section describes the HSS Authentication Procedure which is no longer applicable since the HSS/AuC component was removed from the architecture. Removing this section maintains document consistency."
}

Output ONLY valid JSON, no explanations.`;
  }

  return `You are generating a specific change for a section affected by a refinement.

**PRIMARY CHANGE:**
${primaryChangeContext}

**SECTION TO UPDATE:**
${affectedSection.sectionTitle} (${affectedSection.sectionId})

**CURRENT CONTENT:**
\`\`\`markdown
${sectionContent}
\`\`\`

**IMPACT ANALYSIS:**
- Impact Level: ${affectedSection.impactLevel}
- Action Type: ${affectedSection.impactType}
- Reasoning: ${affectedSection.reasoning}

**TASK:**
Generate the updated content for this section that reflects the primary change.

**REQUIREMENTS:**
✅ Maintain the section structure and formatting
✅ Remove references to removed components
✅ Update procedures that depend on changed components
✅ Keep the same writing style and tone
✅ Preserve content that is NOT affected by the change
❌ Do NOT use placeholders like "[Previous content unchanged]"
❌ Do NOT summarize - provide the COMPLETE modified section

**OUTPUT:**
Provide the complete modified section in markdown format, ready to replace the current content.

Begin your response with the section heading and include all content:`;
}

/**
 * Build prompt for validating consistency across cascaded changes
 */
export function buildConsistencyValidationPrompt(
  primaryChange: {
    sectionTitle: string;
    originalContent: string;
    refinedContent: string;
  },
  propagatedChanges: PropagatedChange[],
  fullDocument: string
): string {
  const changesDescription = propagatedChanges
    .map((c, i) => `${i + 1}. ${c.sectionTitle} (${c.sectionId}): ${c.actionType}`)
    .join('\n');

  return `You are validating the consistency of a cascaded refinement across a technical specification.

**PRIMARY CHANGE:**
Section: ${primaryChange.sectionTitle}
Change Summary: Modified section (${primaryChange.refinedContent.length} chars → ${primaryChange.refinedContent.length} chars)

**PROPAGATED CHANGES:**
${changesDescription}

**FULL DOCUMENT CONTEXT:**
${fullDocument.substring(0, 10000)}...
[Document truncated - full length: ${fullDocument.length} characters]

**TASK:**
Check for consistency issues across all proposed changes:

1. **Contradictions**: Do any changes contradict each other?
   - Example: One section adds a component while another removes references to it

2. **Orphaned References**: Are there references to removed content in unchanged sections?
   - Example: Section 5 still references HSS parameters after HSS removal

3. **Terminology Mismatches**: Is terminology consistent across all changes?
   - Example: One section uses "eNB" while another uses "eNodeB"

**OUTPUT FORMAT (JSON):**
{
  "isConsistent": true,
  "issues": [
    {
      "type": "ORPHANED_REFERENCE",
      "description": "Section 5.2 still references HSS authentication parameters",
      "affectedSections": ["5.2"],
      "severity": "ERROR"
    }
  ],
  "warnings": [
    "Section 6.5 mentions authentication but doesn't specify which mechanism to use"
  ]
}

**SEVERITY LEVELS:**
- ERROR: Must be fixed before applying changes
- WARNING: Should be reviewed but not blocking

Output ONLY valid JSON, no explanations.`;
}

/**
 * Extract section content from markdown document
 * Attempts to identify section boundaries using markdown headers
 */
export function extractSection(
  fullDocument: string,
  sectionId: string,
  sectionTitle: string
): string | null {
  // Escape special regex characters in section ID
  const escapedId = sectionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Try different patterns to find the section, from most specific to most general
  const patterns = [
    // "## 6.3 HSS Authentication Procedure" (exact match)
    new RegExp(`^##\\s*${escapedId}\\s+${sectionTitle}.*?$`, 'im'),
    // "### 6.3 HSS Authentication Procedure" (exact match with ###)
    new RegExp(`^###\\s*${escapedId}\\s+${sectionTitle}.*?$`, 'im'),
    // "#### 6.3 HSS Authentication Procedure" (exact match with ####)
    new RegExp(`^####\\s*${escapedId}\\s+${sectionTitle}.*?$`, 'im'),
    // "## 6.3: HSS Authentication Procedure" (with colon)
    new RegExp(`^##\\s*${escapedId}:\\s+${sectionTitle}.*?$`, 'im'),
    // Just section number with ## (most lenient - matches any title)
    new RegExp(`^##\\s*${escapedId}\\s+.*?$`, 'im'),
    // Just section number with ### (subsection)
    new RegExp(`^###\\s*${escapedId}\\s+.*?$`, 'im'),
    // Just section number with #### (sub-subsection)
    new RegExp(`^####\\s*${escapedId}\\s+.*?$`, 'im'),
  ];

  for (const pattern of patterns) {
    const match = fullDocument.match(pattern);
    if (match && match.index !== undefined) {
      const startIndex = match.index;

      // Determine the heading level of the matched section
      const headingLevel = (match[0].match(/^#+/)?.[0].length) || 2;

      // Find the end of this section (next same-level or higher-level heading)
      const afterStart = fullDocument.substring(startIndex + match[0].length);
      // Match headings of same or higher level (fewer #'s)
      const endPattern = new RegExp(`^#{1,${headingLevel}}[^#]`, 'm');
      const endMatch = afterStart.match(endPattern);

      if (endMatch && endMatch.index !== undefined) {
        return fullDocument.substring(startIndex, startIndex + match[0].length + endMatch.index);
      } else {
        // No next section found, take to end of document
        return fullDocument.substring(startIndex);
      }
    }
  }

  return null; // Section not found
}

/**
 * Parse markdown to identify all sections
 * Returns array of {id, title, startIndex, endIndex}
 */
export function parseMarkdownSections(markdown: string): Array<{
  id: string;
  title: string;
  level: number;
  startIndex: number;
  endIndex: number;
  content: string;
}> {
  const sections: Array<{
    id: string;
    title: string;
    level: number;
    startIndex: number;
    endIndex: number;
    content: string;
  }> = [];

  // Match headings: ## 6.3 Title or ### 6.3.1 Subtitle
  const headingRegex = /^(#{2,4})\s+(\d+(?:\.\d+)*)\s+(.+?)$/gm;
  let match;

  const matches: Array<{
    level: number;
    id: string;
    title: string;
    index: number;
  }> = [];

  while ((match = headingRegex.exec(markdown)) !== null) {
    matches.push({
      level: match[1].length,
      id: match[2],
      title: match[3].trim(),
      index: match.index,
    });
  }

  // Calculate section boundaries
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];

    const startIndex = current.index;
    const endIndex = next ? next.index : markdown.length;

    sections.push({
      id: current.id,
      title: current.title,
      level: current.level,
      startIndex,
      endIndex,
      content: markdown.substring(startIndex, endIndex),
    });
  }

  return sections;
}

/**
 * Replace a section in markdown document safely using section boundaries
 *
 * This function uses proper section parsing instead of naive string replacement
 * to avoid data loss when multiple sections have similar content.
 *
 * @param fullDocument - The complete markdown document
 * @param sectionId - Section ID to replace (e.g., "2", "3.1", "6.3")
 * @param newContent - New content for the section (including heading)
 * @returns Updated document, or null if section not found
 */
export function replaceSectionById(
  fullDocument: string,
  sectionId: string,
  newContent: string
): string | null {
  const sections = parseMarkdownSections(fullDocument);
  const sectionToReplace = sections.find(s => s.id === sectionId);

  if (!sectionToReplace) {
    console.error(`[replaceSectionById] Section ${sectionId} not found in document`);
    return null;
  }

  // Replace the section content using index-based replacement (safe)
  const before = fullDocument.substring(0, sectionToReplace.startIndex);
  const after = fullDocument.substring(sectionToReplace.endIndex);

  return before + newContent + after;
}

/**
 * Remove a section from markdown document safely using section boundaries
 *
 * @param fullDocument - The complete markdown document
 * @param sectionId - Section ID to remove (e.g., "2", "3.1", "6.3")
 * @returns Updated document, or null if section not found
 */
export function removeSectionById(
  fullDocument: string,
  sectionId: string
): string | null {
  const sections = parseMarkdownSections(fullDocument);
  const sectionToRemove = sections.find(s => s.id === sectionId);

  if (!sectionToRemove) {
    console.error(`[removeSectionById] Section ${sectionId} not found in document`);
    return null;
  }

  // Remove the section using index-based replacement (safe)
  const before = fullDocument.substring(0, sectionToRemove.startIndex);
  const after = fullDocument.substring(sectionToRemove.endIndex);

  return before + after;
}
