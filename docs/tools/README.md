# TechSpec Studio Development Tools

This directory contains standalone HTML utility tools for development, debugging, and emergency recovery. These tools operate directly on browser localStorage and can be opened in any web browser.

## 🛠️ Available Tools

### clear-config.html
**Purpose:** Clear AI configuration from localStorage

**Use When:**
- Resetting AI provider/model settings
- Clearing encrypted API keys
- Troubleshooting AI configuration issues
- Testing fresh configuration setup

**What It Clears:**
- `tech-spec-project` → `aiConfig` object
  - Provider settings
  - Model selection
  - Encrypted API key
  - Temperature/token settings
  - Streaming configuration

**What It Preserves:**
- Project data (specification, diagrams)
- BRS document
- Version history
- Pending approvals
- Usage statistics

**How to Use:**
1. Open `clear-config.html` in your browser
2. Click "Clear AI Configuration"
3. Refresh TechSpec Studio app
4. Reconfigure AI settings in Settings panel

---

### clear-storage.html
**Purpose:** Clear ALL TechSpec Studio data from localStorage

**⚠️ WARNING:** This is a **destructive operation** that removes all project data!

**Use When:**
- Starting completely fresh
- Resolving severe data corruption
- Testing from clean slate
- Clearing test/demo data

**What It Clears:**
- `tech-spec-project` - Entire project state
  - Specification document
  - All diagrams (block, sequence, flow)
  - BRS document
  - References
  - AI configuration
  - Chat history
  - Pending approvals
  - Version history
  - Usage statistics

**How to Use:**
1. **BACKUP FIRST** if you have important data
2. Open `clear-storage.html` in your browser
3. Read the warning carefully
4. Click "Clear All Storage"
5. Refresh TechSpec Studio app
6. App will start with empty project

---

### emergency-storage-fix.html
**Purpose:** Emergency recovery tool for corrupted or malformed localStorage data

**Use When:**
- App won't load due to storage errors
- "JSON parse error" or "Cannot read property" errors
- Data structure migration failures
- Unexpected app crashes on startup

**What It Does:**
1. **Validates** localStorage data structure
2. **Reports** issues found (missing fields, invalid JSON, type mismatches)
3. **Offers repair options**:
   - Fix specific issues (e.g., reset aiConfig to defaults)
   - Restore from backup (if available)
   - Clear corrupted sections only
   - Full reset as last resort

**Safety Features:**
- Creates automatic backup before any changes
- Shows diff of what will change
- Requires confirmation for destructive operations
- Detailed logging of all actions

**How to Use:**
1. Open `emergency-storage-fix.html` in your browser
2. Click "Diagnose Storage"
3. Review reported issues
4. Choose repair action:
   - **Recommended:** Fix specific issues only
   - **Safe:** Restore from backup
   - **Moderate:** Clear corrupted sections
   - **Last Resort:** Full reset
5. Refresh TechSpec Studio app

---

### test.html
**Purpose:** Basic HTML/JavaScript test utility

**Use When:**
- Testing browser compatibility
- Verifying localStorage access
- Quick JavaScript experiments
- Debugging browser-specific issues

**Features:**
- Console logging utilities
- localStorage read/write tests
- Browser capability detection
- Basic DOM manipulation tests

**How to Use:**
1. Open `test.html` in your browser
2. Open browser DevTools console (F12)
3. Use provided test functions
4. Inspect console output

**Common Test Functions:**
```javascript
// Check localStorage access
testLocalStorage();

// Log browser info
logBrowserInfo();

// Test JSON serialization
testJSONOperations();
```

---

### test-darkmode.html
**Purpose:** Dark mode CSS testing utility

**Use When:**
- Testing dark mode styles
- Verifying color contrast
- Debugging dark mode issues
- Previewing dark mode components

**Features:**
- Toggle between light/dark modes
- Preview common UI components
- Color palette visualization
- Contrast ratio checking

**How to Use:**
1. Open `test-darkmode.html` in your browser
2. Click "Toggle Dark Mode" button
3. Inspect component rendering
4. Verify colors and contrast

---

## 💡 Best Practices

### Before Using Tools
1. **Backup your data** if using destructive tools
2. **Close TechSpec Studio** app before running tools
3. **Use browser DevTools** to monitor console for errors

### After Using Tools
1. **Refresh the app** to see changes
2. **Verify expected behavior** after recovery
3. **Document issues** if tool didn't resolve problem

### Emergency Workflow
If TechSpec Studio won't load:
1. Open `emergency-storage-fix.html`
2. Run diagnostics
3. Choose minimal fix (don't clear everything)
4. If still broken, try `clear-config.html`
5. Last resort: `clear-storage.html` (loses all data)

## 🔒 Security Notes

- These tools operate **locally only** (no network requests)
- All data stays in browser localStorage
- No data is sent to external servers
- Tools are safe to use on sensitive projects

## 🐛 Troubleshooting Tools

### Tool Won't Load
- Check browser console for errors
- Verify file is in correct directory
- Ensure browser allows localStorage access
- Try different browser

### Changes Not Applied
- Hard refresh the app (Ctrl+Shift+R)
- Clear browser cache
- Check localStorage quota limits
- Verify correct localStorage key

### Data Lost After Tool Use
- Check browser DevTools → Application → Local Storage
- Look for `tech-spec-project` key
- If present, data wasn't deleted (app may need refresh)
- If absent, data was cleared (restore from backup if available)

---

## 📚 Related Documentation

- [../TROUBLESHOOTING.md](../../TROUBLESHOOTING.md) - App-level troubleshooting
- [../CLAUDE.md](../../CLAUDE.md) - Development guide
- [../features/CLEAR_DATA_FEATURE.md](../features/CLEAR_DATA_FEATURE.md) - Clear data feature docs

---

**Last Updated:** 2025-11-20
**Tools:** 5 HTML utilities
**Safety Level:** All tools are safe for local development use
