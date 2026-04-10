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

  // Phase 1: Local checks (no AI needed)
  checkDepthCompliance(sections, sectionDepths, issues);
  checkRequirementIdDuplication(sections, issues);
  checkCrossReferences(sections, markdown, issues);
  checkContentDuplication(sections, issues);

  // Phase 2: AI-powered holistic review (if provider available)
  let aiTokens = 0;
  let aiCost = 0;
  if (provider && config) {
    const aiResult = await runAIReview(markdown, sections, sectionDepths, provider, config);
    issues.push(...aiResult.issues);
    aiTokens = aiResult.tokensUsed;
    aiCost = aiResult.cost;
  }

  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const info = issues.filter(i => i.severity === 'info').length;

  return {
    totalIssues: issues.length,
    errors,
    warnings,
    info,
    issues,
    tokensUsed: aiTokens,
    cost: aiCost,
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
 * Check 1: Depth compliance
 * Sections marked 'brief' should be under ~1000 words
 * Sections marked 'standard' should be under ~3000 words
 */
function checkDepthCompliance(
  sections: SectionInfo[],
  sectionDepths: Record<string, SectionDepth>,
  issues: ReviewIssue[]
): void {
  const thresholds: Record<SectionDepth, { wordLimit: number; reqIdLimit: number }> = {
    brief: { wordLimit: 1000, reqIdLimit: 15 },
    standard: { wordLimit: 3500, reqIdLimit: 40 },
    detailed: { wordLimit: 999999, reqIdLimit: 999 },
  };

  for (const section of sections) {
    // Try to match depth by section ID or title
    const depth = findDepthForSection(section, sectionDepths);
    if (!depth || depth === 'detailed') continue;

    const limits = thresholds[depth];

    if (section.wordCount > limits.wordLimit) {
      issues.push({
        id: `depth-words-${section.number}`,
        severity: 'warning',
        category: 'depth-compliance',
        sectionTitle: section.title,
        sectionNumber: section.number,
        description: `Section ${section.number} "${section.title}" is marked as '${depth}' but contains ${section.wordCount} words (limit: ~${limits.wordLimit}).`,
        suggestion: `Reduce this section to ~${limits.wordLimit} words. Move detailed content (attribute tables, procedures, formulas) to the appropriate detailed section and add cross-references.`,
      });
    }

    if (section.requirementIds.length > limits.reqIdLimit) {
      issues.push({
        id: `depth-reqs-${section.number}`,
        severity: 'warning',
        category: 'depth-compliance',
        sectionTitle: section.title,
        sectionNumber: section.number,
        description: `Section ${section.number} "${section.title}" is marked as '${depth}' but contains ${section.requirementIds.length} requirement IDs (limit: ~${limits.reqIdLimit}).`,
        suggestion: `Consolidate requirement IDs. For '${depth}' sections, only create IDs for spec-specific design decisions, not for restating standards.`,
      });
    }
  }
}

/**
 * Check 2: Requirement ID duplication
 */
function checkRequirementIdDuplication(
  sections: SectionInfo[],
  issues: ReviewIssue[]
): void {
  const idToSections: Record<string, string[]> = {};

  for (const section of sections) {
    for (const reqId of section.requirementIds) {
      if (!idToSections[reqId]) idToSections[reqId] = [];
      idToSections[reqId].push(`${section.number} ${section.title}`);
    }
  }

  for (const [reqId, sectionList] of Object.entries(idToSections)) {
    if (sectionList.length > 1) {
      issues.push({
        id: `dup-req-${reqId}`,
        severity: 'error',
        category: 'requirement-id',
        sectionTitle: sectionList[0],
        sectionNumber: (sectionList[0] || '').split(' ')[0] || 'unknown',
        description: `Requirement ID ${reqId} appears in ${sectionList.length} sections: ${sectionList.join(', ')}.`,
        suggestion: `Each requirement ID must be unique. Keep the ID in the primary section and remove or renumber duplicates.`,
        relatedSection: sectionList[1],
      });
    }
  }
}

/**
 * Check 3: Cross-reference consistency
 */
function checkCrossReferences(
  sections: SectionInfo[],
  _markdown: string,
  issues: ReviewIssue[]
): void {
  // Find all "Section X" or "Section X.Y" references
  const refPattern = /Section\s+(\d+(?:\.\d+)*)/g;
  const sectionNumbers = new Set(sections.map(s => s.number));
  // Also add subsection numbers
  for (const section of sections) {
    const subHeadings = section.content.match(/^#{2,4}\s+(\d+(?:\.\d+)+)\s+/gm) || [];
    for (const heading of subHeadings) {
      const numMatch = heading.match(/(\d+(?:\.\d+)+)/);
      if (numMatch) sectionNumbers.add(numMatch[1]);
    }
  }

  for (const section of sections) {
    let match;
    const content = section.content;
    refPattern.lastIndex = 0;

    while ((match = refPattern.exec(content)) !== null) {
      const referencedNumber = match[1];
      // Check if the top-level section exists
      const topLevel = referencedNumber.split('.')[0];
      if (!sectionNumbers.has(topLevel) && !sectionNumbers.has(referencedNumber)) {
        issues.push({
          id: `xref-${section.number}-${referencedNumber}`,
          severity: 'error',
          category: 'cross-reference',
          sectionTitle: section.title,
          sectionNumber: section.number,
          description: `Section ${section.number} references "Section ${referencedNumber}" which does not exist in the document.`,
          suggestion: `Update the reference to point to the correct section number, or remove the reference.`,
          contentSnippet: content.substring(Math.max(0, match.index - 40), match.index + match[0].length + 40),
        });
      }
    }
  }
}

/**
 * Check 4: Content duplication detection
 * Finds paragraphs or significant text blocks that appear similar in multiple sections.
 */
function checkContentDuplication(
  sections: SectionInfo[],
  issues: ReviewIssue[]
): void {
  // Extract significant paragraphs (>50 words) from each section
  const sectionParagraphs: Array<{ section: SectionInfo; paragraph: string; normalized: string }> = [];

  for (const section of sections) {
    const paragraphs = section.content.split(/\n\n+/).filter(p => countWords(p) > 50);
    for (const para of paragraphs) {
      // Normalize: lowercase, remove requirement IDs, collapse whitespace
      const normalized = para
        .toLowerCase()
        .replace(/\*\*[a-z]+-[a-z]+-[a-z]+-\d{5}\*\*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      sectionParagraphs.push({ section, paragraph: para, normalized });
    }
  }

  // Compare each pair of paragraphs across different sections
  const reported = new Set<string>();
  for (let i = 0; i < sectionParagraphs.length; i++) {
    for (let j = i + 1; j < sectionParagraphs.length; j++) {
      const a = sectionParagraphs[i];
      const b = sectionParagraphs[j];
      if (a.section.number === b.section.number) continue;

      const similarity = calculateSimilarity(a.normalized, b.normalized);
      if (similarity > 0.6) {
        const key = `${a.section.number}-${b.section.number}`;
        if (reported.has(key)) continue;
        reported.add(key);

        issues.push({
          id: `dup-content-${a.section.number}-${b.section.number}`,
          severity: 'warning',
          category: 'duplication',
          sectionTitle: a.section.title,
          sectionNumber: a.section.number,
          description: `Similar content found in Section ${a.section.number} "${a.section.title}" and Section ${b.section.number} "${b.section.title}" (${Math.round(similarity * 100)}% similarity).`,
          suggestion: `Keep the content in the more appropriate section and replace the duplicate with a cross-reference: "as defined in Section X".`,
          contentSnippet: a.paragraph.substring(0, 150) + '...',
          relatedSection: `${b.section.number} ${b.section.title}`,
        });
      }
    }
  }
}

/**
 * Simple word-overlap similarity between two normalized strings.
 */
function calculateSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(' ').filter(w => w.length > 3));
  const wordsB = new Set(b.split(' ').filter(w => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }

  return overlap / Math.min(wordsA.size, wordsB.size);
}

/**
 * Match a section to its depth setting by ID or title keywords.
 */
function findDepthForSection(
  section: SectionInfo,
  sectionDepths: Record<string, SectionDepth>
): SectionDepth | null {
  // Try exact match by various key formats
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

2. **Content Duplication**: Identify topics, requirements, or procedures that are substantially repeated across sections. For each, state which section should own the content and which should cross-reference.

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

Limit your response to the top 20 most important issues. Prioritise errors over warnings, and warnings over info.

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
 * Extracts the affected section, sends it to the AI with the issue details,
 * and returns the corrected section content.
 */
export async function generateFixForIssue(
  markdown: string,
  issue: ReviewIssue,
  provider: any,
  config: Partial<AIConfig>
): Promise<ReviewFix | null> {
  // Extract the affected section
  const sectionContent = extractSectionByNumber(markdown, issue.sectionNumber);
  if (!sectionContent) {
    console.warn(`Could not extract section ${issue.sectionNumber} for fix`);
    return null;
  }

  // For duplication issues, also extract the related section
  let relatedContent = '';
  if (issue.relatedSection) {
    const relatedNumber = issue.relatedSection.split(' ')[0];
    const related = extractSectionByNumber(markdown, relatedNumber);
    if (related) {
      relatedContent = `\n\n## Related Section (for cross-reference context)\n\n${related}`;
    }
  }

  // Stable system context (cached across all fix calls for Anthropic models)
  // Contains the full spec so the AI can check cross-references and consistency
  const systemPrompt = `You are a technical specification editor. You fix issues found during review.
Output ONLY the corrected section content (including its heading). No explanation, no markdown fences.

## Full Specification (for cross-reference context)

${markdown.substring(0, 100000)}${markdown.length > 100000 ? '\n\n[... specification truncated ...]' : ''}`;

  // Issue-specific user prompt (changes per fix)
  const userPrompt = `Fix the following issue in Section ${issue.sectionNumber}: ${issue.sectionTitle}.

## Issue
- **Severity:** ${issue.severity}
- **Category:** ${issue.category}
- **Description:** ${issue.description}
- **Suggestion:** ${issue.suggestion}
${issue.contentSnippet ? `- **Problematic snippet:** "${issue.contentSnippet}"` : ''}
${issue.relatedSection ? `- **Related section:** ${issue.relatedSection}` : ''}

## Section to Fix

${sectionContent}
${relatedContent}

## Rules

1. Apply the suggested fix to the section content above.
2. Preserve ALL existing content that is not related to the issue.
3. Preserve the exact heading format (e.g., "# 4 Section Title" or "## 4.1 Subsection").
4. Preserve all {{fig:...}} and {{ref:...}} placeholders exactly as they are.
5. Preserve all requirement IDs (e.g., **PCC-CAPTIVE-REQ-00001**) unless the issue specifically asks to change them.
6. For duplication issues: You are fixing Section ${issue.sectionNumber} ONLY.${issue.relatedSection ? ` The related section is ${issue.relatedSection}.` : ''}
   - If this section (${issue.sectionNumber}) has a LOWER number than the related section, this is the PRIMARY section — keep the full content here. The related section will be fixed separately.
   - If this section (${issue.sectionNumber}) has a HIGHER number (or is an Appendix), replace the duplicated content with a cross-reference like "See Section X for details" or "As defined in Section X".
   - NEVER delete content from both sections. One must keep it, the other must reference it.
7. For depth-compliance issues: trim verbose content, move detail to cross-references.
8. For cross-reference issues: fix the section number to point to the correct section.
9. For consistency issues: align terminology with the rest of the document.

Respond with ONLY the corrected section content (including the heading).`;

  try {
    const result = await provider.generate(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        ...config,
        temperature: 0.2,
        maxTokens: 16000,
      }
    );

    const fixedContent = result.content.trim();

    // Basic validation: the fix should contain the section heading
    if (!fixedContent.includes(issue.sectionNumber)) {
      console.warn(`Fix for ${issue.id} may be invalid — doesn't contain section number`);
    }

    return {
      issueId: issue.id,
      sectionNumber: issue.sectionNumber,
      sectionTitle: issue.sectionTitle,
      originalContent: sectionContent,
      fixedContent,
      description: `Fix: ${issue.description}`,
    };
  } catch (error) {
    console.error(`Failed to generate fix for issue ${issue.id}:`, error);
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
