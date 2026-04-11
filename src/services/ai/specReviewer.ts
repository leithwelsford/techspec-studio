/**
 * Specification Reviewer
 *
 * Post-generation review pass that evaluates the full specification
 * holistically and produces a report of issues with suggested fixes.
 * Issues are surfaced through the PendingApproval workflow so the
 * user retains editorial control.
 *
 * Checks performed:
 * 1. Depth compliance — sections marked 'brief' that are too verbose
 * 2. Content duplication — similar content appearing in multiple sections
 * 3. Cross-reference consistency — "as defined in Section X" references exist
 * 4. Requirement ID duplication — same ID used in multiple places
 * 5. Section boundary violations — content that belongs in a different section
 */

import type { AIConfig, SectionDepth } from '../../types';

export interface ReviewIssue {
  /** Unique issue identifier */
  id: string;
  /** Issue severity */
  severity: 'error' | 'warning' | 'info';
  /** Issue category */
  category: 'depth-compliance' | 'duplication' | 'cross-reference' | 'requirement-id' | 'boundary-violation' | 'consistency';
  /** Section where the issue was found */
  sectionTitle: string;
  /** Section number (e.g., "4") */
  sectionNumber: string;
  /** Human-readable description of the issue */
  description: string;
  /** Suggested fix */
  suggestion: string;
  /** The problematic content snippet (for context) */
  contentSnippet?: string;
  /** If applicable, the other section involved in the duplication */
  relatedSection?: string;
  /** Proposed replacement content (if auto-fixable) */
  proposedFix?: string;
}

export interface ReviewReport {
  /** Total issues found */
  totalIssues: number;
  /** Issues by severity */
  errors: number;
  warnings: number;
  info: number;
  /** All issues */
  issues: ReviewIssue[];
  /** Token usage for the review */
  tokensUsed: number;
  /** Cost of the review */
  cost: number;
  /** Summary text */
  summary: string;
}

interface SectionInfo {
  number: string;
  title: string;
  content: string;
  depth?: SectionDepth;
  wordCount: number;
  requirementIds: string[];
}

/**
 * Run a comprehensive review of the generated specification.
 * This performs local (non-AI) checks first, then optionally
 * sends the full spec to the AI for holistic review.
 */
export async function reviewSpecification(
  markdown: string,
  sectionDepths: Record<string, SectionDepth>,
  provider?: any,
  config?: Partial<AIConfig>
): Promise<ReviewReport> {
  const sections = parseSections(markdown);
  const issues: ReviewIssue[] = [];

  if (!provider || !config) {
    // No AI provider — can't review
    return {
      totalIssues: 0, errors: 0, warnings: 0, info: 0,
      issues: [], tokensUsed: 0, cost: 0,
      summary: 'No AI provider available for review.',
    };
  }

  // AI-powered holistic review — the AI understands context, cross-references,
  // and document structure far better than local pattern matching
  const aiResult = await runAIReview(markdown, sections, sectionDepths, provider, config);
  issues.push(...aiResult.issues);

  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const info = issues.filter(i => i.severity === 'info').length;

  return {
    totalIssues: issues.length,
    errors,
    warnings,
    info,
    issues,
    tokensUsed: aiResult.tokensUsed,
    cost: aiResult.cost,
    summary: `Review complete: ${errors} errors, ${warnings} warnings, ${info} info items across ${sections.length} sections.`,
  };
}

/**
 * Parse markdown into sections with metadata.
 */
function parseSections(markdown: string): SectionInfo[] {
  const sections: SectionInfo[] = [];
  const lines = markdown.split('\n');
  let currentSection: SectionInfo | null = null;
  const contentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#\s+(\d+)\s+(.+)/);
    if (headingMatch) {
      if (currentSection) {
        currentSection.content = contentLines.join('\n');
        currentSection.wordCount = countWords(currentSection.content);
        currentSection.requirementIds = extractRequirementIds(currentSection.content);
        sections.push(currentSection);
        contentLines.length = 0;
      }
      currentSection = {
        number: headingMatch[1],
        title: headingMatch[2].trim(),
        content: '',
        wordCount: 0,
        requirementIds: [],
      };
    } else if (currentSection) {
      contentLines.push(line);
    }
  }

  if (currentSection) {
    currentSection.content = contentLines.join('\n');
    currentSection.wordCount = countWords(currentSection.content);
    currentSection.requirementIds = extractRequirementIds(currentSection.content);
    sections.push(currentSection);
  }

  return sections;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

function extractRequirementIds(text: string): string[] {
  const matches = text.match(/\*\*[A-Z]+-[A-Z]+-[A-Z]+-\d{5}\*\*/g) || [];
  return matches.map(m => m.replace(/\*\*/g, ''));
}

/**
 * Match a section to its depth setting by ID or title keywords.
 */
function findDepthForSection(
  section: SectionInfo,
  sectionDepths: Record<string, SectionDepth>
): SectionDepth | null {
  for (const [key, depth] of Object.entries(sectionDepths)) {
    if (key === section.number) return depth;
    if (section.title.toLowerCase().includes(key.toLowerCase())) return depth;
    if (key.toLowerCase().includes(section.title.toLowerCase())) return depth;
  }
  return null;
}

/**
 * AI-powered holistic review of the full specification.
 */
async function runAIReview(
  markdown: string,
  sections: SectionInfo[],
  sectionDepths: Record<string, SectionDepth>,
  provider: any,
  config: Partial<AIConfig>
): Promise<{ issues: ReviewIssue[]; tokensUsed: number; cost: number }> {
  const depthSummary = sections.map(s => {
    const depth = findDepthForSection(s, sectionDepths) || 'detailed';
    return `- Section ${s.number} "${s.title}": depth=${depth}, ${s.wordCount} words, ${s.requirementIds.length} requirement IDs`;
  }).join('\n');

  const prompt = `You are a technical specification reviewer. Analyse the following specification and identify issues.

## Section Depth Assignments
${depthSummary}

## Review Criteria

1. **Depth Compliance**: Sections marked 'brief' should be ~1-2 pages (under 1000 words). Sections marked 'standard' should be ~3-5 pages (under 3000 words). Flag any that significantly exceed their depth budget.

2. **Content Duplication**: Identify procedures, requirement text, or technical descriptions that are copy-pasted or substantially restated across sections. Only flag TRUE duplication — the same substantive content appearing in full in two places. Do NOT flag:
   - A section cross-referencing another ("See Section X", "As defined in Appendix A") — this is the correct fix for duplication, not a new instance of it.
   - Shared terminology, standard numbers, or protocol names appearing in multiple sections — that is normal technical writing.
   - A dedicated section (References, Abbreviations, Terminology, Appendix) containing items also mentioned in body sections — that is their purpose.

3. **Cross-Section Consistency**: Check that terminology, acronyms, and interface names are used consistently. Flag contradictions.

4. **Boundary Violations**: Identify content that is in the wrong section based on the section descriptions and depth assignments. For example, detailed signalling flows in a 'brief' authentication section.

5. **Requirement Quality**: Flag requirement IDs that are not testable, that restate a standard without adding spec-specific value, or that are redundant with other requirements.

## Output Format

Respond with a JSON array of issues:
\`\`\`json
[
  {
    "severity": "error|warning|info",
    "category": "depth-compliance|duplication|cross-reference|requirement-id|boundary-violation|consistency",
    "sectionNumber": "4",
    "sectionTitle": "Authentication and AAA",
    "description": "Concise description of the issue",
    "suggestion": "Specific actionable fix"
  }
]
\`\`\`

Only report GENUINE issues — do not pad the list to reach a target count. If you find 3 real issues, return 3. If you find none, return an empty array. Prioritise errors over warnings, and warnings over info. Maximum 20 if there are truly that many.

## Specification Content

${markdown.substring(0, 80000)}
${markdown.length > 80000 ? '\n\n[... specification truncated for review ...]' : ''}`;

  try {
    const result = await provider.generate(
      [
        { role: 'system', content: 'You are a technical specification quality reviewer. Respond only with the JSON array of issues as specified.' },
        { role: 'user', content: prompt },
      ],
      {
        ...config,
        temperature: 0.2,
        maxTokens: 8000,
      }
    );

    const issues: ReviewIssue[] = [];
    try {
      // Extract JSON from response
      const jsonMatch = result.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        for (const item of parsed) {
          issues.push({
            id: `ai-${item.category}-${item.sectionNumber}-${issues.length}`,
            severity: item.severity || 'warning',
            category: item.category || 'consistency',
            sectionTitle: item.sectionTitle || '',
            sectionNumber: item.sectionNumber || '',
            description: item.description || '',
            suggestion: item.suggestion || '',
            relatedSection: item.relatedSection,
          });
        }
      }
    } catch (parseError) {
      console.warn('Failed to parse AI review response as JSON:', parseError);
      issues.push({
        id: 'ai-parse-failure',
        severity: 'warning',
        category: 'consistency',
        sectionTitle: '',
        sectionNumber: '',
        description: 'AI review completed but returned unparseable results. The review may need to be re-run.',
        suggestion: 'Re-generate the specification or manually review for consistency issues.',
      });
    }

    return {
      issues,
      tokensUsed: result.tokens?.total || 0,
      cost: result.cost || 0,
    };
  } catch (error) {
    console.error('AI review failed:', error);
    return { issues: [], tokensUsed: 0, cost: 0 };
  }
}

// ========== Fix Generation ==========

export interface ReviewFix {
  issueId: string;
  sectionNumber: string;
  sectionTitle: string;
  originalContent: string;
  fixedContent: string;
  description: string;
}

/**
 * Generate a fix for a single review issue.
 * For duplication issues, fixes BOTH sections in one call and returns two fixes.
 * For other issues, fixes the affected section only.
 */
export async function generateFixForIssue(
  markdown: string,
  issue: ReviewIssue,
  provider: any,
  config: Partial<AIConfig>,
  stableMarkdown?: string
): Promise<ReviewFix | ReviewFix[] | null> {
  // Use frozen spec for system prompt (stable cache key), current markdown for section extraction
  const specForPrompt = stableMarkdown || markdown;

  // Duplication issues need special handling — fix both sections together
  if (issue.category === 'duplication' && issue.relatedSection) {
    return generateDuplicationFix(markdown, issue, provider, config, specForPrompt);
  }

  // Extract the affected section
  const sectionContent = extractSectionByNumber(markdown, issue.sectionNumber);
  if (!sectionContent) {
    console.warn(`Could not extract section ${issue.sectionNumber} for fix`);
    return null;
  }

  // Stable system context (cached across all fix calls for Anthropic models)
  // Uses frozen spec so the cache key stays identical across all requests
  const systemPrompt = `You are a technical specification editor. You fix issues found during review.
Output ONLY the corrected section content (including its heading). No explanation, no markdown fences.

## Full Specification (for cross-reference context)

${specForPrompt.substring(0, 100000)}${specForPrompt.length > 100000 ? '\n\n[... specification truncated ...]' : ''}`;

  const userPrompt = `Fix the following issue in Section ${issue.sectionNumber}: ${issue.sectionTitle}.

## Issue
- **Severity:** ${issue.severity}
- **Category:** ${issue.category}
- **Description:** ${issue.description}
- **Suggestion:** ${issue.suggestion}
${issue.contentSnippet ? `- **Problematic snippet:** "${issue.contentSnippet}"` : ''}

## Section to Fix

${sectionContent}

## Rules

1. Apply the suggested fix to the section content above.
2. Preserve ALL existing content that is not related to the issue.
3. Preserve the exact heading format (e.g., "# 4 Section Title" or "## 4.1 Subsection").
4. Preserve all {{fig:...}} and {{ref:...}} placeholders exactly as they are.
5. Preserve all requirement IDs (e.g., **PCC-CAPTIVE-REQ-00001**) unless the issue specifically asks to change them.
6. For depth-compliance issues: trim verbose content, move detail to cross-references.
7. For cross-reference issues: fix the section number to point to the correct section.
8. For consistency issues: align terminology with the rest of the document.

Respond with ONLY the corrected section content (including the heading).`;

  try {
    const result = await provider.generate(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { ...config, temperature: 0.2, maxTokens: 16000 }
    );

    return {
      issueId: issue.id,
      sectionNumber: issue.sectionNumber,
      sectionTitle: issue.sectionTitle,
      originalContent: sectionContent,
      fixedContent: result.content.trim(),
      description: `Fix: ${issue.description}`,
    };
  } catch (error) {
    console.error(`Failed to generate fix for issue ${issue.id}:`, error);
    return null;
  }
}

/**
 * Fix multiple issues in the same section with a single AI call.
 * More efficient than fixing one at a time — avoids redundant near-identical fixes.
 */
export async function generateGroupedFix(
  markdown: string,
  sectionNumber: string,
  sectionTitle: string,
  issues: ReviewIssue[],
  provider: any,
  config: Partial<AIConfig>,
  stableMarkdown?: string
): Promise<ReviewFix | null> {
  const specForPrompt = stableMarkdown || markdown;

  const sectionContent = extractSectionByNumber(markdown, sectionNumber);
  if (!sectionContent) {
    console.warn(`Could not extract section ${sectionNumber} for grouped fix`);
    return null;
  }

  const systemPrompt = `You are a technical specification editor. You fix issues found during review.
Output ONLY the corrected section content (including its heading). No explanation, no markdown fences.

## Full Specification (for cross-reference context)

${specForPrompt.substring(0, 100000)}${specForPrompt.length > 100000 ? '\n\n[... specification truncated ...]' : ''}`;

  const issueList = issues.map((issue, idx) =>
    `### Issue ${idx + 1}
- **Severity:** ${issue.severity}
- **Category:** ${issue.category}
- **Description:** ${issue.description}
- **Suggestion:** ${issue.suggestion}${issue.contentSnippet ? `\n- **Snippet:** "${issue.contentSnippet}"` : ''}`
  ).join('\n\n');

  const userPrompt = `Fix ALL of the following ${issues.length} issues in Section ${sectionNumber}: ${sectionTitle}.

${issueList}

## Section to Fix

${sectionContent}

## Rules

1. Apply ALL fixes above in a single pass. Do not address them separately.
2. Preserve ALL existing content that is not related to the issues.
3. Preserve the exact heading format (e.g., "# 4 Section Title" or "## 4.1 Subsection").
4. Preserve all {{fig:...}} and {{ref:...}} placeholders exactly as they are.
5. Preserve all requirement IDs unless an issue specifically asks to change them.
6. For depth-compliance issues: trim verbose content, move detail to cross-references.
7. For cross-reference issues: fix the section number to point to the correct section.
8. For consistency issues: align terminology with the rest of the document.

Respond with ONLY the corrected section content (including the heading).`;

  try {
    const result = await provider.generate(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { ...config, temperature: 0.2, maxTokens: 16000 }
    );

    const descriptions = issues.map(i => i.description).join('; ');
    return {
      issueId: issues.map(i => i.id).join('+'),
      sectionNumber,
      sectionTitle,
      originalContent: sectionContent,
      fixedContent: result.content.trim(),
      description: `Fix ${issues.length} issues: ${descriptions}`,
    };
  } catch (error) {
    console.error(`Failed to generate grouped fix for section ${sectionNumber}:`, error);
    return null;
  }
}

/**
 * Fix a duplication issue by analysing both sections together.
 * The AI decides which section is the natural home for the content
 * and returns fixes for both: one keeps the content, the other gets a cross-reference.
 */
async function generateDuplicationFix(
  markdown: string,
  issue: ReviewIssue,
  provider: any,
  config: Partial<AIConfig>,
  specForPrompt?: string
): Promise<ReviewFix[] | null> {
  const sectionA = extractSectionByNumber(markdown, issue.sectionNumber);
  const relatedNumber = (issue.relatedSection || '').split(' ')[0];
  const relatedTitle = (issue.relatedSection || '').replace(/^\S+\s*/, '');
  const sectionB = extractSectionByNumber(markdown, relatedNumber);

  if (!sectionA || !sectionB) {
    console.warn(`Could not extract both sections for duplication fix: ${issue.sectionNumber} / ${relatedNumber}`);
    return null;
  }

  const stableSpec = specForPrompt || markdown;
  const systemPrompt = `You are a technical specification editor. You resolve content duplication between two sections.

## Full Specification (for cross-reference context)

${stableSpec.substring(0, 100000)}${stableSpec.length > 100000 ? '\n\n[... specification truncated ...]' : ''}`;

  const userPrompt = `Resolve the following duplication issue between two sections.

## Issue
- **Description:** ${issue.description}
- **Content snippet:** ${issue.contentSnippet || 'N/A'}

## Section A (${issue.sectionNumber}: ${issue.sectionTitle})

${sectionA}

## Section B (${relatedNumber}: ${relatedTitle})

${sectionB}

## Instructions

Determine which section is the NATURAL HOME for the duplicated content:
- A section whose title/purpose is specifically about that content type is the natural home.
  Examples: "References" sections own references, "Abbreviations" sections own abbreviations,
  "Terminology" sections own definitions, Appendices for definitions own glossaries.
- A "Scope" or "Introduction" section should only briefly mention these and cross-reference.
- If neither is clearly the natural home, keep content in the more detailed/comprehensive section.

Then produce corrected versions of BOTH sections:
- The NATURAL HOME section: keeps the full content (may consolidate/improve it).
- The OTHER section: replaces the duplicated content with a cross-reference like
  "For references, see Section X" or "Refer to Appendix A for terminology definitions."

## Output Format

Respond with EXACTLY this format (including the separator):

<<<SECTION_A>>>
(corrected full content of Section ${issue.sectionNumber}, including heading)
<<<SECTION_B>>>
(corrected full content of Section ${relatedNumber}, including heading)`;

  try {
    const result = await provider.generate(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { ...config, temperature: 0.2, maxTokens: 24000 }
    );

    const response = result.content.trim();

    // Parse the two sections from the response
    const splitA = response.indexOf('<<<SECTION_A>>>');
    const splitB = response.indexOf('<<<SECTION_B>>>');

    if (splitA === -1 || splitB === -1) {
      console.warn('Duplication fix response did not contain expected separators');
      return null;
    }

    const fixedA = response.substring(splitA + '<<<SECTION_A>>>'.length, splitB).trim();
    const fixedB = response.substring(splitB + '<<<SECTION_B>>>'.length).trim();

    if (!fixedA || !fixedB) {
      console.warn('Duplication fix produced empty section content');
      return null;
    }

    return [
      {
        issueId: `${issue.id}-a`,
        sectionNumber: issue.sectionNumber,
        sectionTitle: issue.sectionTitle,
        originalContent: sectionA,
        fixedContent: fixedA,
        description: `Duplication fix (Section ${issue.sectionNumber}): ${issue.description}`,
      },
      {
        issueId: `${issue.id}-b`,
        sectionNumber: relatedNumber,
        sectionTitle: relatedTitle,
        originalContent: sectionB,
        fixedContent: fixedB,
        description: `Duplication fix (Section ${relatedNumber}): ${issue.description}`,
      },
    ];
  } catch (error) {
    console.error(`Failed to generate duplication fix for issue ${issue.id}:`, error);
    return null;
  }
}

/**
 * Extract a section from markdown by its number (e.g., "4" or "4.1").
 */
function extractSectionByNumber(markdown: string, sectionNumber: string): string | null {
  const escaped = sectionNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lines = markdown.split('\n');
  let startIdx = -1;
  let headingLevel = 0;

  // Find the section heading
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(new RegExp(`^(#{1,4})\\s+${escaped}\\s+`));
    if (match) {
      startIdx = i;
      headingLevel = match[1].length;
      break;
    }
  }

  if (startIdx === -1) return null;

  // Find the end (next heading of same or higher level)
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^(#{1,4})\s+/);
    if (headingMatch && headingMatch[1].length <= headingLevel) {
      endIdx = i;
      break;
    }
  }

  return lines.slice(startIdx, endIdx).join('\n');
}
