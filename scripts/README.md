# Utility Scripts

This directory contains utility scripts for development, debugging, and maintenance.

## Current Scripts

### check-approval-data.js
**Purpose**: Inspect pending approval data in localStorage/IndexedDB.

**Usage**:
```bash
node scripts/check-approval-data.js
```

**Output**: Displays approval workflow state, pending approvals, and version history.

---

### check_document.js
**Purpose**: Validate and inspect document structure.

**Usage**:
```bash
node scripts/check_document.js
```

**Output**: Document metadata, section structure, and validation results.

---

### test_extract.js
**Purpose**: Test content extraction utilities.

**Usage**:
```bash
node scripts/test_extract.js
```

---

## Legacy Scripts

### legacy/app.py
**Purpose**: Legacy Python development server (no longer used).

**Status**: Replaced by Vite dev server (`npm run dev`).

---

### legacy/main.py
**Purpose**: Legacy Python utility (no longer used).

**Status**: Archived for reference.

---

## Adding New Scripts

When creating new utility scripts:
1. Use descriptive filenames (e.g., `validate-diagrams.js`)
2. Add shebang for executability: `#!/usr/bin/env node`
3. Include usage instructions in script header
4. Document the script in this README
5. Add error handling and help text

**Example Script Header**:
```javascript
#!/usr/bin/env node
/**
 * Script Name
 *
 * Purpose: Brief description
 *
 * Usage:
 *   node scripts/script-name.js [options]
 *
 * Options:
 *   --help    Show this help text
 */
```

---

**Last Updated**: 2025-11-26
