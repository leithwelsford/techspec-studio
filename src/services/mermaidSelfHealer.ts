/**
 * Mermaid Self-Healing Service
 *
 * Proposes fixes for invalid Mermaid syntax using AI with documentation context.
 * Does NOT auto-apply fixes - returns proposed changes for user review.
 */

import { aiService } from './ai';
import {
  validateMermaidCode,
  MermaidSyntaxError,
  MermaidErrorType,
  quickValidateArrowSyntax
} from '../utils/mermaidValidator';
import {
  buildHealingContext,
  getValidExamples,
  getCommonMistakes
} from '../utils/mermaidDocSearch';

export interface HealingProposal {
  proposedCode: string;
  originalCode: string;
  error: MermaidSyntaxError;
  validExamples: string[];
  commonMistakes: string[];
  explanation: string;
  iteration: number;
}

export interface HealingValidation {
  isValid: boolean;
  stillHasErrors: boolean;
  errors: string[];
  newErrorType?: MermaidErrorType;
}

/**
 * Mermaid Self-Healing Service
 * Proposes fixes using AI with Mermaid documentation context
 */
export class MermaidSelfHealer {
  private maxIterations = 3;

  /**
   * Propose a healing iteration for invalid Mermaid code
   * @param mermaidCode Invalid Mermaid diagram code
   * @param iteration Current iteration (1-3)
   * @returns HealingProposal with proposed fix
   */
  async proposeHealingIteration(
    mermaidCode: string,
    iteration: number
  ): Promise<HealingProposal> {
    if (iteration > this.maxIterations) {
      throw new Error(`Maximum iterations (${this.maxIterations}) exceeded`);
    }

    console.log(`\n🔧 Starting healing iteration ${iteration}/${this.maxIterations}`);

    // Validate and get error details
    const validation = await validateMermaidCode(mermaidCode);
    if (validation.isValid) {
      throw new Error('Code is already valid, no healing needed');
    }

    if (validation.errors.length === 0) {
      throw new Error('No errors detected, but code is invalid');
    }

    // Get the first error (focus on one at a time)
    const error = validation.errors[0];
    console.log(`   Error type: ${error.errorType}`);
    console.log(`   Error line ${error.line}: ${error.context}`);

    // Get documentation context for this error type
    const docContext = buildHealingContext(error.errorType);
    const validExamples = getValidExamples(error.errorType);
    const commonMistakes = getCommonMistakes(error.errorType);

    // Build healing prompt
    const prompt = this.buildHealingPrompt(
      mermaidCode,
      error,
      docContext,
      iteration
    );

    console.log(`   Calling AI with healing prompt (temperature: 0.1)`);

    // Call AI with low temperature for precise fixes
    const response = await aiService.chat(prompt, [], {
      temperature: 0.1, // Very precise, no creativity
      maxTokens: 4000,
      systemPrompt: 'You are a Mermaid syntax expert. Your task is to fix ONLY the syntax error indicated, making minimal changes to preserve the original intent.'
    });

    // Extract proposed code from response
    console.log(`   📝 Raw AI response length: ${response.content.length} chars`);
    const proposedCode = this.extractCodeFromResponse(response.content);

    // Build explanation
    const explanation = this.extractExplanationFromResponse(response.content);

    // Debug logging
    const originalLines = mermaidCode.split('\n').length;
    const proposedLines = proposedCode.split('\n').length;
    console.log(`   ✅ Healing proposal generated`);
    console.log(`   📊 Code comparison: Original ${originalLines} lines → Proposed ${proposedLines} lines`);
    console.log(`   🔍 Original line ${error.line}: "${mermaidCode.split('\n')[error.line - 1]?.trim() || '(not found)'}"`);
    console.log(`   ✏️  Proposed line ${error.line}: "${proposedCode.split('\n')[error.line - 1]?.trim() || '(not found)'}"`);

    // Validate that AI didn't restructure the diagram
    if (originalLines !== proposedLines) {
      console.log(`   ⚠️ WARNING: Line count changed! AI may have restructured the diagram.`);
      throw new Error(
        `AI changed the number of lines (${originalLines} → ${proposedLines}). ` +
        `This suggests the AI restructured the diagram instead of fixing it in place. ` +
        `Please try again or edit manually.`
      );
    }

    return {
      proposedCode,
      originalCode: mermaidCode,
      error,
      validExamples,
      commonMistakes,
      explanation,
      iteration
    };
  }

  /**
   * Validate a proposed fix
   * @param code Proposed fixed code
   * @returns Validation result
   */
  async validateProposedFix(code: string): Promise<HealingValidation> {
    console.log('\n🔍 Validating proposed fix...');

    // First quick validation check
    const quickCheck = quickValidateArrowSyntax(code);
    if (!quickCheck.isValid) {
      console.log('   ❌ Quick validation failed - invalid arrow syntax detected');
      console.log(`   📍 Found ${quickCheck.invalidLines.length} invalid line(s):`);
      quickCheck.invalidLines.forEach(line => {
        console.log(`      Line ${line.line}: ${line.content.substring(0, 50)}...`);
        console.log(`      Reason: ${line.reason}`);
      });
      return {
        isValid: false,
        stillHasErrors: true,
        errors: quickCheck.invalidLines.map(line => `Line ${line.line}: ${line.reason}`)
      };
    }

    // Full Mermaid validation
    const validation = await validateMermaidCode(code);

    if (validation.isValid) {
      console.log('   ✅ Validation passed - diagram is now valid!');
      return {
        isValid: true,
        stillHasErrors: false,
        errors: []
      };
    } else {
      console.log(`   ⚠️ Validation failed - ${validation.errors.length} error(s) remaining`);
      return {
        isValid: false,
        stillHasErrors: true,
        errors: validation.errors.map(err => err.message),
        newErrorType: validation.errors[0]?.errorType
      };
    }
  }

  /**
   * Build healing prompt for AI
   */
  private buildHealingPrompt(
    code: string,
    error: MermaidSyntaxError,
    docContext: string,
    iteration: number
  ): string {
    const lines = code.split('\n');
    const errorLine = lines[error.line - 1] || '';

    return `You are fixing a Mermaid syntax error. This is iteration ${iteration}/${this.maxIterations}.

ERROR DETAILS:
- Line ${error.line}: ${error.message}
- Problematic code: ${errorLine.trim()}
- Error type: ${error.errorType}

${docContext}

ORIGINAL MERMAID CODE:
\`\`\`mermaid
${code}
\`\`\`

CRITICAL RULES - FOLLOW EXACTLY:
1. Fix ONLY the syntax error on line ${error.line}
2. Do NOT remove, reorder, or restructure ANY lines
3. Do NOT delete the problematic line - FIX IT IN PLACE
4. Change ONLY the invalid syntax (e.g., change "-)>" to "->>" or "-)" as needed)
5. Keep ALL other lines EXACTLY as they are - same order, same content
6. The output must have the SAME NUMBER OF LINES as the input (${lines.length} lines)

EXAMPLE OF CORRECT FIX:
If line says: "UE-)>UE: Enter RRC Idle"
CORRECT: Change it to "UE->>UE: Enter RRC Idle" (fixed arrow, kept message)
WRONG: Delete the line entirely
WRONG: Move the line to a different position
WRONG: Change the message content

Use the correct Mermaid syntax from the reference documentation above.

REQUIRED OUTPUT FORMAT:
First, explain what's wrong and how you're fixing it (1 sentence).

Then provide the complete fixed code in a code block:
\`\`\`mermaid
[complete fixed diagram here - must have exactly ${lines.length} lines]
\`\`\`

Your response:`;
  }

  /**
   * Extract code from AI response (looks for ```mermaid code blocks)
   */
  private extractCodeFromResponse(response: string): string {
    // Look for code blocks with ```mermaid
    const codeBlockMatch = response.match(/```mermaid\s*\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      console.log('   🎯 Extracted from ```mermaid code block (' + codeBlockMatch[1].length + ' chars)');
      return codeBlockMatch[1].trim();
    }

    // Fallback: look for any code block
    const anyCodeBlockMatch = response.match(/```\s*\n([\s\S]*?)\n```/);
    if (anyCodeBlockMatch) {
      console.log('   🎯 Extracted from generic ``` code block (' + anyCodeBlockMatch[1].length + ' chars)');
      return anyCodeBlockMatch[1].trim();
    }

    // If no code block found, return the whole response (might be just the code)
    // Remove any leading/trailing explanation text
    const lines = response.split('\n');
    const mermaidStartIndex = lines.findIndex(line => line.trim() === 'sequenceDiagram' || line.trim().startsWith('flowchart'));
    if (mermaidStartIndex !== -1) {
      const extracted = lines.slice(mermaidStartIndex).join('\n').trim();
      console.log(`   🎯 Extracted from sequenceDiagram/flowchart start (${extracted.length} chars, ${lines.length - mermaidStartIndex} lines)`);
      return extracted;
    }

    throw new Error('Could not extract Mermaid code from AI response');
  }

  /**
   * Extract explanation from AI response (text before code block)
   */
  private extractExplanationFromResponse(response: string): string {
    // Get text before the first code block
    const codeBlockIndex = response.indexOf('```');
    if (codeBlockIndex === -1) {
      // No code block, maybe explanation is the whole thing?
      return response.trim();
    }

    const explanation = response.substring(0, codeBlockIndex).trim();
    return explanation || 'AI proposed a syntax fix based on Mermaid documentation.';
  }

  /**
   * Get max iterations
   */
  getMaxIterations(): number {
    return this.maxIterations;
  }

  /**
   * Set max iterations
   */
  setMaxIterations(max: number): void {
    if (max < 1 || max > 10) {
      throw new Error('Max iterations must be between 1 and 10');
    }
    this.maxIterations = max;
  }
}

// Export singleton instance
export const mermaidSelfHealer = new MermaidSelfHealer();
