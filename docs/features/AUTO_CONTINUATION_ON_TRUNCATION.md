# Auto-Continuation on Token Limit Truncation

**Feature Status:** 📋 **PLANNED** (Future Enhancement)
**Priority:** High
**Complexity:** Low (~50 lines of code)
**Target Release:** Post-Phase 3

## Problem Statement

When AI generates large specification sections (e.g., Solution Architecture, Functional Specification), the output can exceed the model's `maxTokens` limit (currently 32,000 for reasoning models). When this happens:

- **Current Behavior**: Generation stops mid-sentence, section is marked as TRUNCATED
- **User Impact**: Incomplete sections require manual intervention (regeneration or manual completion)
- **Example**: Section 4 (Solution Architecture) hit 32k limit at 22,438 chars - content was cut off

## Proposed Solution: Automatic Continuation

Instead of stopping when `finish_reason === 'length'`, automatically:

1. **Detect truncation** immediately
2. **Pause** generation loop
3. **Send continuation prompt** to LLM: "Continue from where you left off..."
4. **Concatenate results**: `fullContent = part1 + part2 + part3...`
5. **Repeat** until `finish_reason === 'stop'` (section complete)

## Implementation Details

### Core Logic (AIService.ts)

**Location**: `src/services/ai/AIService.ts`, method `generateSpecificationFromTemplate()` (around lines 1618-1640)

**Current Code**:
```typescript
const sectionResult = await this.provider.generate(
  [{ role: 'user', content: sectionPrompt }],
  sectionConfig
);

// Warn if truncated
if ((sectionResult as any).finishReason === 'length' ||
    (sectionResult as any).finishReason === 'max_output_tokens') {
  console.warn(`⚠️ WARNING: Section "${sectionTitle}" was TRUNCATED due to token limit!`);
}

sections.push({ title: sectionTitle, content: sectionResult.content });
```

**Proposed Code**:
```typescript
let fullContent = '';
let continuationAttempts = 0;
const MAX_CONTINUATIONS = 5; // Safety limit

while (continuationAttempts < MAX_CONTINUATIONS) {
  const messages = continuationAttempts === 0
    ? [{ role: 'user', content: sectionPrompt }]
    : [
        { role: 'user', content: sectionPrompt },
        { role: 'assistant', content: fullContent },
        {
          role: 'user',
          content: 'Continue the section from where you left off. Start exactly where the previous output ended. Do not repeat any content from the previous response. Do not add meta-commentary like "[continuing from above]".'
        }
      ];

  const sectionResult = await this.provider.generate(messages, sectionConfig);

  fullContent += sectionResult.content;
  totalTokens += sectionResult.tokens?.total || 0;
  totalCost += sectionResult.cost || 0;

  const finishReason = (sectionResult as any).finishReason;

  if (finishReason === 'stop') {
    // Section complete
    console.log(`✅ Section complete (${continuationAttempts + 1} part${continuationAttempts > 0 ? 's' : ''}, ${fullContent.length} chars)`);
    break;
  } else if (finishReason === 'length' || finishReason === 'max_output_tokens') {
    // Truncated - continue automatically
    continuationAttempts++;
    console.log(`📝 Section truncated, continuing (attempt ${continuationAttempts}/${MAX_CONTINUATIONS})...`);

    // Update progress callback
    if (onProgress) {
      onProgress(i + 1, enabledSections.length, `${sectionTitle} (continuing... part ${continuationAttempts + 1})`);
    }
  } else {
    // Unknown finish reason - stop with warning
    console.warn(`⚠️ Unexpected finish_reason: ${finishReason}, stopping continuation`);
    break;
  }
}

if (continuationAttempts >= MAX_CONTINUATIONS) {
  console.warn(`⚠️ WARNING: Section "${sectionTitle}" reached MAX_CONTINUATIONS (${MAX_CONTINUATIONS}). May be incomplete.`);
}

sections.push({
  title: sectionTitle,
  content: fullContent,
  continuationAttempts: continuationAttempts + 1,
  wasTruncated: false // No longer truncated after continuation
});
```

### Enhanced Progress Display (GenerateSpecModal.tsx)

**Location**: `src/components/ai/GenerateSpecModal.tsx` (lines 294-318)

**Current**:
```typescript
<span className="text-gray-600 dark:text-gray-400">
  {progress.section}
</span>
```

**Enhanced**:
```typescript
<span className="text-gray-600 dark:text-gray-400">
  {progress.section}
  {progress.section.includes('continuing') && (
    <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
      (auto-continuation in progress)
    </span>
  )}
</span>
```

## Expected Behavior

### Before (Current)
```
🎯 Generating section 4/9: 4 Solution Architecture and Design (maxTokens: 32000)
OpenRouter response: finish_reason: 'length', content: 22438 chars
⚠️ WARNING: Section "4 Solution Architecture and Design" was TRUNCATED due to token limit!
📄 Generated section 4/9: {contentLength: 22438, tokens: 17789}
```

**Result**: Incomplete section, user must manually regenerate or complete

### After (With Auto-Continuation)
```
🎯 Generating section 4/9: 4 Solution Architecture and Design (maxTokens: 32000)
OpenRouter response (part 1): finish_reason: 'length', content: 22438 chars
📝 Section truncated, continuing (attempt 1/5)...
OpenRouter response (part 2): finish_reason: 'length', content: 18000 chars
📝 Section truncated, continuing (attempt 2/5)...
OpenRouter response (part 3): finish_reason: 'stop', content: 4562 chars
✅ Section complete (3 parts, 45000 total chars)
📄 Generated section 4/9: {contentLength: 45000, tokens: 35000, continuationAttempts: 3}
```

**Result**: Complete section, no user intervention required

## Safety Mechanisms

### 1. Max Continuation Limit
- **Constant**: `MAX_CONTINUATIONS = 5`
- **Purpose**: Prevent infinite loops if finish_reason never becomes 'stop'
- **Behavior**: If limit reached, use partial content and log warning

### 2. Continuation Prompt Engineering
- **Clear instruction**: "Continue from where you left off"
- **No repetition**: "Do not repeat any content from the previous response"
- **No meta-commentary**: "Do not add '[continuing from above]'"
- **Context**: Include last 200 chars of previous output for smooth transition

### 3. Finish Reason Validation
- **Expected**: 'stop' or 'length'/'max_output_tokens'
- **Unexpected**: Any other finish_reason triggers stop with warning
- **Logging**: All finish_reasons logged for debugging

## Alternative Approaches Considered

### Option A: Retry with Higher Limit (Rejected)
- **Approach**: When truncated, regenerate entire section with 2x maxTokens
- **Problem**: Wastes tokens, may still truncate, no guarantee of completion
- **Verdict**: ❌ Less efficient, less reliable

### Option B: Chunked Generation (Backup Plan)
- **Approach**: Split large sections into subsections (4.1, 4.2, 4.3), generate separately
- **Problem**: Requires section-specific logic, loses narrative flow
- **Verdict**: ⚠️ Use only if continuation doesn't work well

### Option C: Auto-Continuation (Recommended)
- **Approach**: Described above
- **Advantages**: Efficient, reliable, transparent, preserves flow
- **Verdict**: ✅ Best solution

## Benefits

✅ **Zero User Intervention**: Fully automatic, no manual retries
✅ **No Content Loss**: Sections are always complete
✅ **Cost Efficient**: Only uses extra tokens when needed (not pre-emptively)
✅ **Transparent**: User sees "continuing..." in progress UI
✅ **Preserves Flow**: LLM maintains narrative continuity across parts
✅ **Simple Implementation**: ~50 lines of code, no complex UI changes

## Risks & Mitigation

### Risk 1: Infinite Loop
- **Scenario**: Model never returns finish_reason='stop'
- **Mitigation**: MAX_CONTINUATIONS safety limit
- **Impact**: Low (would stop after 5 attempts)

### Risk 2: Repetitive Content
- **Scenario**: LLM repeats previous output instead of continuing
- **Mitigation**: Clear continuation prompt, include previous context
- **Impact**: Medium (manual review can catch this)

### Risk 3: Increased Cost
- **Scenario**: Large sections require multiple continuations
- **Mitigation**: Cost is still lower than pre-emptively using 64k maxTokens for all sections
- **Impact**: Low (only pay for tokens actually needed)

## Testing Strategy

### Test Case 1: Normal Section (No Truncation)
- **Input**: Section with 5,000 chars of content
- **Expected**: Single generation, finish_reason='stop', 0 continuations
- **Verify**: fullContent === sectionResult.content

### Test Case 2: Large Section (1 Continuation)
- **Input**: Section with 35,000 chars of content
- **Expected**: 2 generations (22k + 13k), finish_reason='length' then 'stop', 1 continuation
- **Verify**: fullContent === part1 + part2, no repeated content

### Test Case 3: Very Large Section (Multiple Continuations)
- **Input**: Section with 60,000 chars of content
- **Expected**: 3 generations, finish_reason='length' twice then 'stop', 2 continuations
- **Verify**: fullContent === part1 + part2 + part3, seamless narrative

### Test Case 4: Safety Limit Reached
- **Input**: Artificially force finish_reason='length' in loop
- **Expected**: Stop after MAX_CONTINUATIONS attempts, log warning
- **Verify**: continuationAttempts === 5, warning logged

## Documentation Updates Required

1. **CLAUDE.md**: Add to "Latest Enhancements" section
2. **README.md**: Mention in "What's Working Now" (when implemented)
3. **Phase Completion Report**: Document in appropriate phase report

## Related Issues

- Current maxTokens increase (16k → 32k) is a temporary mitigation
- This feature makes maxTokens limits less critical (can be set lower to reduce cost)
- Complements existing truncation detection in refinement (which throws error)

## Implementation Checklist

When implementing this feature:

- [ ] Add continuation loop to `generateSpecificationFromTemplate()` in AIService.ts
- [ ] Add `MAX_CONTINUATIONS` constant (value: 5)
- [ ] Update progress callback to show continuation status
- [ ] Add continuation prompt engineering
- [ ] Add logging for each continuation attempt
- [ ] Update return type to include `continuationAttempts` field
- [ ] (Optional) Enhance progress display in GenerateSpecModal.tsx
- [ ] Add tests for all 4 test cases above
- [ ] Update documentation (CLAUDE.md, README.md)
- [ ] Test with real large sections (Architecture, Procedures)

## Estimated Effort

- **Development**: 2-3 hours
- **Testing**: 1-2 hours
- **Documentation**: 1 hour
- **Total**: 4-6 hours

## Priority Justification

**High Priority** because:
- Directly impacts user experience (incomplete sections are frustrating)
- Simple implementation (low risk, high reward)
- Eliminates a known pain point (Section 4 truncation observed in testing)
- Makes token limit configuration less critical (more forgiving)

**Not Critical** because:
- Workaround exists (manual regeneration or completion)
- maxTokens increase (32k) mitigates most cases
- Users can review and edit truncated sections manually

---

**Document Created**: 2025-11-21
**Author**: Claude Code
**Status**: Planned for future release
**Related Features**: Template System, Specification Generation, Token Limit Handling
