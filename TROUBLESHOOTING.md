# Troubleshooting Guide

## Fixed Issues

### ✅ Issue: "AI service not initialized"

**Symptom:** Chat or editor actions throw "AI service not initialized" error.

**Root Cause:** The AI service needs to be initialized with decrypted API key before each use. The API key is stored encrypted in the Zustand store.

**Fix Applied:** Before calling any AI service methods, we now:
1. Decrypt the API key from config
2. Initialize the AI service with decrypted key
3. Then call the AI method

**Code Pattern:**
```typescript
// Decrypt API key
const { decrypt } = await import('../../utils/encryption');
const decryptedKey = decrypt(aiConfig.apiKey);

// Initialize AI service
await aiService.initialize({
  provider: aiConfig.provider,
  apiKey: decryptedKey,
  model: aiConfig.model,
  temperature: aiConfig.temperature,
  maxTokens: aiConfig.maxTokens,
  enableStreaming: aiConfig.enableStreaming,
});

// Now safe to use AI service
await aiService.generateSection(...);
```

**Files Modified:**
- `/work/src/components/ai/ChatPanel.tsx` (line 56-67)
- `/work/src/components/editors/MarkdownEditor.tsx` (lines 57-68, 129-140)

---

### ✅ Issue: "history.map is not a function"

**Symptom:** Chat panel throws error when sending a message.

**Root Cause:** The `aiService.chat()` and `aiService.chatStream()` methods have the signature:
```typescript
chat(message: string, history: AIMessage[], context?: AIContext, options?: GenerationOptions)
chatStream(message: string, history: AIMessage[], context?: AIContext, options?: GenerationOptions)
```

But the ChatPanel was calling them with:
```typescript
aiService.chat(message, context) // ❌ Wrong - context passed as history
```

**Fix Applied:** Updated ChatPanel to pass parameters in correct order:
```typescript
// Get chat history (exclude the user message we just added)
const history = chatHistory.slice(0, -1);

// Streaming
await aiService.chatStream(message, history, context);

// Non-streaming
await aiService.chat(message, history, context);
```

**Files Modified:**
- `/work/src/components/ai/ChatPanel.tsx` (lines 73, 110-111)

---

## How to Test the Fix

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Create a project:**
   - Click "Create New Project"

3. **Configure AI:**
   - Enter your OpenRouter API key
   - Test connection
   - Save

4. **Chat with AI:**
   - Click "Show Chat"
   - Type a message or use a quick action
   - Should see streaming response (no errors!)

---

## Common Issues & Solutions

### Issue: Persisted Data from Previous Session

**Symptom:** After deleting diagrams/specification through the UI, errors or old data still appear when starting fresh (e.g., Mermaid syntax errors, old diagrams appearing).

**Root Cause:** The application uses Zustand with localStorage persistence. Deleting items through the UI doesn't clear the underlying localStorage storage, so data persists across browser sessions.

**Solutions:**

**Method 1: Use the "Clear Data" Button (Recommended)**
1. Click the red "Clear Data" button in the header (top-right, trash icon)
2. Confirm the warning dialog
3. Page will automatically reload with a clean slate

**Method 2: Browser DevTools Console**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Run: `localStorage.removeItem('tech-spec-project')`
4. Run: `location.reload()`

**Method 3: Clear All localStorage**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Run: `localStorage.clear()`
4. Run: `location.reload()`

**Method 4: Browser Settings**
1. Open browser settings
2. Clear browsing data → Select "Cookies and site data"
3. Reload the page

**Note:** The "Clear Data" button (Method 1) is the safest approach as it properly resets the store state before clearing localStorage.

---

### Issue: AI Config doesn't save

**Check:**
- Browser localStorage is enabled
- API key is valid (starts with `sk-or-`)
- No console errors about encryption

**Solution:**
- Clear browser cache and try again
- Check browser console for detailed errors

---

### Issue: Streaming doesn't work

**Check:**
- OpenRouter API key has proper permissions
- Model supports streaming (all listed models do)
- Network connection is stable

**Solution:**
- Try disabling streaming in AI config temporarily
- Check browser network tab for failed requests

---

### Issue: Chat shows wrong costs

**Note:** Current implementation uses rough estimates:
- ~4 characters per token
- $10 per 1M tokens (average)

For accurate pricing, the OpenRouter provider should return actual token counts and costs from the API response.

**Future Enhancement:**
- Parse actual usage from OpenRouter response headers
- Use model-specific pricing from OpenRouter API

---

### Issue: Context not passed to AI

**Check:**
- Project is created
- Document has content
- Diagrams/references are added

**Verify:**
The `buildContext()` function in ChatPanel should return:
```typescript
{
  currentDocument: string,
  availableDiagrams: DiagramReference[],
  availableReferences: ReferenceDocument[]
}
```

---

## Dev Server Issues

### Port 3000 already in use

**Normal behavior:** Vite automatically tries port 3001, 3002, etc.

### HMR not working

**Solution:**
1. Stop dev server (Ctrl+C)
2. Delete `node_modules/.vite`
3. Restart: `npm run dev`

---

## TypeScript Errors

### Legacy App.tsx errors

**Status:** Expected. These are from the original block diagram editor.

**Safe to ignore:**
- `'label' is declared but never used`
- `Element implicitly has 'any' type`
- `'e' is declared but never used`

### AI Service unused imports

**Status:** Expected. These imports are for future features.

**Safe to ignore:**
- Unused type imports in `AIService.ts`
- Unused functions in prompt files

---

## Browser Console Errors

### "Failed to decrypt API key"

**Cause:** API key was encrypted on different device/browser

**Solution:**
- Clear AI config
- Re-enter API key

### "AI service not initialized"

**Cause:** Trying to use AI before configuration

**Solution:**
- Ensure "AI Ready" indicator shows green
- Re-open AI config and test connection

---

## Performance Issues

### Chat panel laggy during streaming

**Potential causes:**
- Too many messages in history
- Complex document context

**Solutions:**
- Use "Clear" button to reset history
- Reduce max tokens in AI config
- Consider pagination for message history

---

## API Key Security

### Where is the API key stored?

- Encrypted in localStorage under key: `tech-spec-project`
- Uses AES encryption with device fingerprint
- Cannot be decrypted on different devices

### Is it safe?

- ✅ Encrypted at rest
- ✅ Not sent to any server except OpenRouter
- ✅ Not visible in UI (masked)
- ⚠️ Still in browser memory during use
- ⚠️ Can be extracted if user has dev tools access

**Best practice:** Don't use production API keys in development environments.

---

## Need More Help?

1. Check browser console for errors
2. Check network tab for failed API requests
3. Review `PHASE2_PROGRESS.md` for feature status
4. Review `CLAUDE.md` for architecture details
