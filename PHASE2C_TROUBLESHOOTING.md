# Phase 2C Troubleshooting Guide

## Issue 1: Review Button Not Visible

### Expected Behavior
- A "Review" button should appear in the Workspace header (next to AI Settings button)
- When there are pending approvals, a red badge with count should appear on the button

### Debugging Steps

1. **Check if Review button renders at all:**
   - Open browser dev console (F12)
   - Look for the "Review" button in the header
   - If not visible, check React component tree in React DevTools

2. **Check if pendingApprovals is populated:**
   ```javascript
   // In browser console:
   const store = JSON.parse(localStorage.getItem('tech-spec-project'));
   console.log('Pending Approvals:', store?.state?.pendingApprovals);
   ```

3. **Test creating a pending approval:**
   - Upload a BRS document
   - Configure AI
   - Click "Generate Spec" with "Require approval" checked
   - Wait for generation to complete
   - Check console: `localStorage.getItem('tech-spec-project')` and look for `pendingApprovals` array

### Possible Causes

**A. Component Not Rendering:**
- Check if Workspace.tsx is using the correct import:
  ```typescript
  import ReviewPanel from './ai/ReviewPanel';
  ```
- Verify button code exists in Workspace.tsx around line 108-119

**B. Store Not Persisting:**
- Clear localStorage and test again:
  ```javascript
  localStorage.clear();
  location.reload();
  ```

**C. Build Issue:**
- Restart dev server:
  ```bash
  # Kill existing server
  pkill -f "vite"
  # Start fresh
  npm run dev
  ```

---

## Issue 2: AI Chat Context Mismatch

### Problem Description
AI chat is referring to content that doesn't match what's visible in the Technical Specification editor.

### Root Cause Analysis

The AI chat gets its context from the Zustand store's `project.specification.markdown` field. If there's a mismatch, it could be:

1. **Old cached data** - localStorage has stale data
2. **Multiple project states** - User edited directly but changes didn't persist
3. **Store synchronization issue** - React state not updating properly

### Debugging Steps

1. **Check what's actually in the store:**
   ```javascript
   // Browser console
   const store = JSON.parse(localStorage.getItem('tech-spec-project'));
   console.log('Stored markdown:', store?.state?.project?.specification?.markdown);
   ```

2. **Check what's displayed in editor:**
   - Open Technical Specification tab
   - Select all text (Ctrl+A)
   - Copy to clipboard
   - Compare with store content above

3. **Check React DevTools:**
   - Install React DevTools extension
   - Open Components tab
   - Find `Workspace` or `MarkdownEditor` component
   - Inspect `project.specification.markdown` prop
   - Compare with what's rendered

### Solutions

**Solution A: Clear and Rebuild State**
```javascript
// Browser console
localStorage.removeItem('tech-spec-project');
location.reload();
// Then recreate project, upload BRS, regenerate
```

**Solution B: Manual State Fix**
```javascript
// Get current store
const store = JSON.parse(localStorage.getItem('tech-spec-project'));

// Update the markdown manually (example)
store.state.project.specification.markdown = `# Your actual content here...`;

// Save back
localStorage.setItem('tech-spec-project', JSON.stringify(store));

// Reload
location.reload();
```

**Solution C: Force Re-render**
1. Go to Technical Specification tab
2. Make a small edit (add a space)
3. This triggers `updateSpecification()` which updates the store
4. Now try chat again - it should see the updated content

### Prevention

To avoid this issue in the future:

1. **Always edit in the Technical Specification tab**, not by directly modifying localStorage
2. **Use the "Generate Section" or "Refine Selection" AI actions** in the editor, not just chat
3. **Verify changes** by checking the editor content after AI operations

---

## Issue 3: Approval Workflow Not Triggering

### Symptoms
- Spec/diagrams generated but no approval created
- No badge appears on Review button
- Content applied directly without review

### Check

1. **Verify checkbox is enabled:**
   - Open GenerateSpecModal or GenerateDiagramsModal
   - Look for yellow box with checkbox "Require approval before applying"
   - Ensure it's CHECKED

2. **Check modal code:**
   ```typescript
   // In GenerateSpecModal.tsx, there should be:
   const [requireApproval, setRequireApproval] = useState(true);

   // And in the generation logic:
   if (requireApproval) {
     createApproval({ ... });
   } else {
     updateSpecification(...);
   }
   ```

3. **Check if approval was created but not stored:**
   ```javascript
   // Browser console
   const store = JSON.parse(localStorage.getItem('tech-spec-project'));
   console.log('All pending approvals:', store?.state?.pendingApprovals);
   ```

### Solution A: Placeholder Text in AI Output

**Issue**: AI adds meta-commentary like "[Previous sections remain unchanged]" or "[Note: The remaining sections would be...]"

**Root Cause**: Some AI models try to be "efficient" by not repeating unchanged sections, even when the full document was provided and complete output is required.

**Fixes Applied**:

1. **Strengthened Prompts** in [src/services/ai/prompts/systemPrompts.ts](src/services/ai/prompts/systemPrompts.ts):
   - Updated `buildRefinementPrompt()` with extremely explicit requirements
   - Shows the AI how many lines it received and expects similar output length
   - Uses visual markers (❌ ✅) to emphasize forbidden/required patterns
   - Includes verification checklist for AI to check before responding
   - Example: "The user has provided you with 500 lines of content. Your output MUST contain approximately the same amount"

2. **Added Error Detection** in [src/services/ai/AIService.ts](src/services/ai/AIService.ts):
   - `refineContent()` now detects placeholder text in AI output
   - Throws clear error if placeholders found: "AI generated incomplete content with placeholders"
   - Suggests using Claude Opus for more reliable complete output
   - NO silent removal - if AI misbehaves, user is notified immediately

**Testing**:
1. Select entire document (Ctrl+A in editor)
2. Click "Refine Selection"
3. Enter refinement instructions
4. If AI generates placeholders, you'll see an error message
5. Try again (sometimes AI needs a second attempt)
6. Consider switching to Claude Opus if problem persists

**Why This Approach**:
- Placeholders indicate the AI didn't follow instructions
- Silently removing them would hide missing content
- Better to fail fast and let user retry than deliver incomplete output
- Stronger prompts should prevent the issue in most cases

**If You Still See Placeholders**:
1. The error will catch it and prevent incomplete content from being applied
2. Try clicking "Refine Selection" again - AI may succeed on retry
3. Switch to a more capable model (Claude Opus > Sonnet > Haiku)
4. Ensure you're selecting the full content you want refined (Ctrl+A)

**Approval Workflow for Editor Actions**:
- "Generate Section" → Creates approval, requires review
- "Refine Selection" → Creates approval, requires review
- Changes are NOT applied automatically - you must approve them in the Review Panel
- The Review Panel will show before/after diff for all editor-based AI actions

### Solution B: Approval Creation Issues

If approvals aren't being created:

1. **Check browser console for errors** during generation
2. **Verify createApproval function exists** in store:
   ```javascript
   // Browser console
   window.useProjectStore = require('/work/src/store/projectStore.ts').useProjectStore;
   console.log(typeof useProjectStore.getState().createApproval); // should be 'function'
   ```
3. **Re-import the modals** - there might be a stale bundle:
   ```bash
   # In terminal
   rm -rf node_modules/.vite
   npm run dev
   ```

---

## General Debugging Commands

### View Full Store State
```javascript
const store = JSON.parse(localStorage.getItem('tech-spec-project'));
console.log('Full Store:', store);
console.log('Project:', store?.state?.project);
console.log('AI Config:', store?.state?.aiConfig);
console.log('Pending Approvals:', store?.state?.pendingApprovals);
console.log('Version History:', store?.state?.versionHistory);
```

### Reset Everything
```javascript
localStorage.clear();
location.reload();
```

### Check If Components Loaded
```javascript
// These should not be undefined
console.log('DiffViewer:', typeof DiffViewer);
console.log('ReviewPanel:', typeof ReviewPanel);
```

### Manually Test Approval Creation
```javascript
// Get store
const { useProjectStore } = await import('/work/src/store/projectStore.ts');
const createApproval = useProjectStore.getState().createApproval;

// Create test approval
const id = createApproval({
  taskId: 'test-123',
  type: 'section',
  originalContent: 'Old content',
  generatedContent: 'New content',
});

console.log('Created approval ID:', id);

// Check if it appears
const approvals = useProjectStore.getState().pendingApprovals;
console.log('Pending approvals:', approvals);
```

---

## Quick Fix Checklist

If things aren't working:

- [ ] Clear browser cache and localStorage
- [ ] Restart dev server (kill and `npm run dev`)
- [ ] Check browser console for errors
- [ ] Verify all imports in Workspace.tsx
- [ ] Check if approval checkbox is present in modals
- [ ] Verify pendingApprovals state in React DevTools
- [ ] Try generating with approval checkbox both checked and unchecked
- [ ] Check network tab for AI API errors

---

## Contact Points for More Help

If issues persist:

1. **Check Implementation Files:**
   - [src/components/ai/ReviewPanel.tsx](src/components/ai/ReviewPanel.tsx)
   - [src/components/ai/GenerateSpecModal.tsx](src/components/ai/GenerateSpecModal.tsx)
   - [src/components/ai/GenerateDiagramsModal.tsx](src/components/ai/GenerateDiagramsModal.tsx)
   - [src/store/projectStore.ts](src/store/projectStore.ts)

2. **Review Documentation:**
   - [PHASE2C_COMPLETE.md](PHASE2C_COMPLETE.md) - Full Phase 2C documentation
   - [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - General troubleshooting

3. **Check for TypeScript Errors:**
   ```bash
   npm run build
   # Look for any compilation errors
   ```
