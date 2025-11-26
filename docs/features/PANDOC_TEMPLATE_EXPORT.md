# Pandoc Template Export Implementation

**Feature**: Export specifications using Pandoc with corporate Word templates
**Status**: ✅ **COMPLETE** - Implemented 2025-11-25
**Priority**: High
**Implementation Time**: ~3 hours

---

## ✅ Implementation Complete

This feature has been fully implemented. See [PANDOC_IMPLEMENTATION_COMPLETE.md](../../PANDOC_IMPLEMENTATION_COMPLETE.md) for complete implementation report.

**What was built:**
- Node.js + Express backend service with Pandoc integration
- Frontend API client and UI integration
- Docker deployment configuration
- Complete documentation

**Files created:**
- `server/pandoc-service.js` - Backend API (280 lines)
- `src/utils/pandocExport.ts` - Frontend client (180 lines)
- `server/Dockerfile` - Docker configuration
- `docker-compose.yml` - Dual-service orchestration

**Files modified:**
- `src/components/ExportModal.tsx` - Added Pandoc UI option
- `CLAUDE.md` - Added Pandoc export section
- `README.md` - Added Pandoc setup instructions

---

## Original Requirements (Below)

---

## Problem Statement

The current template export system (`src/utils/templateDocxExport.ts`) only supports **text-based placeholder replacement** using `{{PLACEHOLDER}}` syntax. This approach has severe limitations:

### Current Limitations:
❌ **Placeholders must be plain text** in document body (not in headers, footers, text boxes, or shapes)
❌ **No support for complex layouts** (multi-column, sections, advanced formatting)
❌ **Fragile**: Word splits placeholders across XML tags (`<w:t>{{</w:t><w:t>TITLE</w:t><w:t>}}</w:t>`)
❌ **Cannot use corporate templates as-is** (templates with only headers/footers/logos don't work)

### User Requirement:
✅ Upload **existing corporate Word template** (with headers, footers, logos, branding)
✅ System applies template styles/formatting to generated specification
✅ **No template modification required**
✅ Professional output matching corporate standards

---

## Solution: Pandoc Backend Integration

**Pandoc** is the industry-standard document converter with native support for Word templates via the `--reference-doc` flag.

### Why Pandoc?

| Feature | Current System | Pandoc |
|---------|---------------|--------|
| **Template Support** | Text placeholders only | Full Word template support |
| **Preserves Formatting** | ❌ No | ✅ Yes (headers, footers, styles) |
| **Complex Layouts** | ❌ No | ✅ Yes (multi-column, sections) |
| **Template Modification** | Required | ✅ Not required |
| **Output Quality** | Basic | ✅ Professional |
| **Industry Adoption** | Custom | ✅ Academic/Publishing standard |
| **Runs In Browser** | ✅ Yes | ❌ No (requires server) |

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (React)                       │
│                                                              │
│  1. User uploads Word template (.docx)                      │
│  2. User generates specification                            │
│  3. User clicks "Export with Pandoc"                        │
│                                                              │
│  4. Frontend sends to backend:                              │
│     - Markdown content (specification)                      │
│     - Template file (base64 or multipart)                   │
│     - Options (TOC, figures, etc.)                          │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │ HTTP POST /api/export-pandoc
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js/Python)                  │
│                                                              │
│  5. Receive markdown + template                             │
│  6. Write markdown to temp file                             │
│  7. Write template to temp file                             │
│  8. Execute: pandoc input.md                                │
│              --reference-doc=template.docx                   │
│              --output=output.docx                            │
│  9. Read output.docx                                        │
│ 10. Send DOCX binary back to browser                        │
│ 11. Cleanup temp files                                      │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │ DOCX Binary
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                        Browser (React)                       │
│                                                              │
│ 12. Receive DOCX file                                       │
│ 13. Download to user                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Backend Service (3-4 hours)

#### Option A: Node.js + Express

**File**: `server/pandoc-service.js`

```javascript
const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const app = express();
const upload = multer({ dest: 'uploads/' });

// CORS configuration (adjust for production)
const cors = require('cors');
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000'
}));

/**
 * POST /api/export-pandoc
 *
 * Body (multipart/form-data):
 *   - markdown: text file containing markdown content
 *   - template: .docx file (Word template)
 *   - options: JSON string with export options
 */
app.post('/api/export-pandoc', upload.fields([
  { name: 'markdown', maxCount: 1 },
  { name: 'template', maxCount: 1 },
  { name: 'options', maxCount: 1 }
]), async (req, res) => {
  const sessionId = crypto.randomBytes(16).toString('hex');
  const workDir = path.join('temp', sessionId);

  try {
    // Create working directory
    await fs.mkdir(workDir, { recursive: true });

    // Get uploaded files
    const markdownFile = req.files.markdown[0];
    const templateFile = req.files.template[0];

    // Parse options
    const options = JSON.parse(req.body.options || '{}');

    // Define file paths
    const inputMd = path.join(workDir, 'input.md');
    const templateDocx = path.join(workDir, 'template.docx');
    const outputDocx = path.join(workDir, 'output.docx');

    // Move uploaded files to working directory
    await fs.copyFile(markdownFile.path, inputMd);
    await fs.copyFile(templateFile.path, templateDocx);

    // Build pandoc command
    let pandocArgs = [
      inputMd,
      '--reference-doc=' + templateDocx,
      '--output=' + outputDocx,
      '--from=markdown+gfm',  // GitHub-flavored markdown
      '--standalone'
    ];

    // Add optional features
    if (options.includeTOC) {
      pandocArgs.push('--toc');
      pandocArgs.push('--toc-depth=3');
    }

    if (options.includeNumberSections) {
      pandocArgs.push('--number-sections');
    }

    const pandocCmd = 'pandoc ' + pandocArgs.join(' ');

    console.log(`[Pandoc Export] Executing: ${pandocCmd}`);

    // Execute pandoc
    await new Promise((resolve, reject) => {
      exec(pandocCmd, { cwd: workDir }, (error, stdout, stderr) => {
        if (error) {
          console.error('[Pandoc Export] Error:', stderr);
          reject(new Error(`Pandoc execution failed: ${stderr}`));
        } else {
          console.log('[Pandoc Export] Success:', stdout);
          resolve();
        }
      });
    });

    // Check if output file was created
    const outputExists = await fs.access(outputDocx).then(() => true).catch(() => false);
    if (!outputExists) {
      throw new Error('Pandoc did not generate output file');
    }

    // Send file back to client
    res.download(outputDocx, 'specification.docx', async (err) => {
      if (err) {
        console.error('[Pandoc Export] Download error:', err);
      }

      // Cleanup: delete working directory
      await fs.rm(workDir, { recursive: true, force: true });
      await fs.unlink(markdownFile.path).catch(() => {});
      await fs.unlink(templateFile.path).catch(() => {});
    });

  } catch (error) {
    console.error('[Pandoc Export] Error:', error);

    // Cleanup on error
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});

    res.status(500).json({
      error: 'Export failed',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'pandoc-export' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Pandoc export service running on port ${PORT}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});
```

**Dependencies** (`server/package.json`):
```json
{
  "name": "techspec-pandoc-service",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1",
    "cors": "^2.8.5"
  },
  "scripts": {
    "start": "node pandoc-service.js",
    "dev": "nodemon pandoc-service.js"
  }
}
```

**Installation**:
```bash
# Install Pandoc (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install pandoc

# Or macOS
brew install pandoc

# Or download from: https://pandoc.org/installing.html

# Install Node.js dependencies
cd server
npm install

# Start service
npm start
```

#### Option B: Python + Flask (Alternative)

**File**: `server/pandoc_service.py`

```python
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import pypandoc
import tempfile
import os
import uuid
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/api/export-pandoc', methods=['POST'])
def export_pandoc():
    session_id = str(uuid.uuid4())
    work_dir = os.path.join(tempfile.gettempdir(), f'pandoc_{session_id}')
    os.makedirs(work_dir, exist_ok=True)

    try:
        # Get uploaded files
        markdown_file = request.files['markdown']
        template_file = request.files['template']
        options = request.form.get('options', '{}')

        # Save files
        md_path = os.path.join(work_dir, 'input.md')
        template_path = os.path.join(work_dir, 'template.docx')
        output_path = os.path.join(work_dir, 'output.docx')

        markdown_file.save(md_path)
        template_file.save(template_path)

        # Read markdown content
        with open(md_path, 'r', encoding='utf-8') as f:
            markdown_content = f.read()

        # Build pandoc arguments
        extra_args = [
            f'--reference-doc={template_path}',
            '--from=markdown+gfm',
            '--standalone'
        ]

        # Parse options (if needed)
        import json
        opts = json.loads(options)
        if opts.get('includeTOC'):
            extra_args.extend(['--toc', '--toc-depth=3'])
        if opts.get('includeNumberSections'):
            extra_args.append('--number-sections')

        # Convert using pypandoc
        pypandoc.convert_text(
            markdown_content,
            'docx',
            format='md',
            outputfile=output_path,
            extra_args=extra_args
        )

        # Send file
        return send_file(
            output_path,
            as_attachment=True,
            download_name='specification.docx',
            mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )

    except Exception as e:
        return jsonify({'error': str(e)}), 500

    finally:
        # Cleanup
        import shutil
        shutil.rmtree(work_dir, ignore_errors=True)

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'pandoc-export'})

if __name__ == '__main__':
    app.run(port=3001, debug=True)
```

**Dependencies** (`server/requirements.txt`):
```
Flask==3.0.0
flask-cors==4.0.0
pypandoc==1.12
```

**Installation**:
```bash
# Install Pandoc
# See: https://pandoc.org/installing.html

# Install Python dependencies
cd server
pip install -r requirements.txt

# Start service
python pandoc_service.py
```

---

### Phase 2: Frontend Integration (2-3 hours)

#### 2.1 Add Pandoc Export Function

**File**: `src/utils/pandocExport.ts` (new file)

```typescript
/**
 * Pandoc Export Utilities
 *
 * Export specifications using Pandoc backend service with Word templates.
 */

import type { Project } from '../types';
import type { ExportOptions } from './docxExport';
import { resolveAllLinks } from './linkResolver';

const PANDOC_API_URL = import.meta.env.VITE_PANDOC_API_URL || 'http://localhost:3001/api';

export interface PandocExportOptions extends ExportOptions {
  includeNumberSections?: boolean;
}

/**
 * Check if Pandoc service is available
 */
export async function checkPandocService(): Promise<boolean> {
  try {
    const response = await fetch(`${PANDOC_API_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok;
  } catch (error) {
    console.error('[Pandoc Export] Service not available:', error);
    return false;
  }
}

/**
 * Export project using Pandoc with template
 */
export async function exportWithPandoc(
  project: Project,
  templateBase64: string,
  options: PandocExportOptions
): Promise<Blob> {
  console.log('[Pandoc Export] Starting export...');

  // Resolve all links in markdown
  const allFigures = [
    ...project.blockDiagrams.map(d => ({
      id: d.id,
      number: d.figureNumber || 'X-X',
      title: d.title,
      type: 'block' as const
    })),
    ...project.sequenceDiagrams.map(d => ({
      id: d.id,
      number: d.figureNumber || 'X-X',
      title: d.title,
      type: 'sequence' as const
    })),
    ...project.flowDiagrams.map(d => ({
      id: d.id,
      number: d.figureNumber || 'X-X',
      title: d.title,
      type: 'flow' as const
    })),
  ];

  const citations = project.references.map((ref, index) => ({
    id: ref.id,
    number: String(index + 1),
    title: ref.title,
  }));

  const resolvedMarkdown = resolveAllLinks(
    project.specification.markdown,
    allFigures,
    citations
  );

  // Create form data
  const formData = new FormData();

  // Add markdown file
  const markdownBlob = new Blob([resolvedMarkdown], { type: 'text/markdown' });
  formData.append('markdown', markdownBlob, 'input.md');

  // Add template file (decode from base64)
  const templateBlob = base64ToBlob(templateBase64, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  formData.append('template', templateBlob, 'template.docx');

  // Add options
  formData.append('options', JSON.stringify({
    includeTOC: options.includeTOC,
    includeNumberSections: options.includeNumberSections,
  }));

  try {
    console.log('[Pandoc Export] Sending request to backend...');

    const response = await fetch(`${PANDOC_API_URL}/export-pandoc`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Pandoc export failed');
    }

    console.log('[Pandoc Export] Export successful');
    return await response.blob();

  } catch (error) {
    console.error('[Pandoc Export] Error:', error);
    throw new Error(`Failed to export with Pandoc: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert base64 string to Blob
 */
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Download helper
 */
export function downloadPandocDocx(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

#### 2.2 Update ExportModal Component

**File**: `src/components/ExportModal.tsx` (modifications)

```typescript
// Add imports
import { checkPandocService, exportWithPandoc, downloadPandocDocx } from '../utils/pandocExport';

// Add state
const [usePandoc, setUsePandoc] = useState(false);
const [pandocAvailable, setPandocAvailable] = useState(false);

// Check Pandoc availability on mount
useEffect(() => {
  checkPandocService().then(setPandocAvailable);
}, []);

// Modify handleExportDocx function
const handleExportDocx = async () => {
  if (!project) return;

  setExporting(true);
  try {
    const exportOpts: ExportOptions = {
      ...options,
      author: author || undefined,
      company: company || undefined,
    };

    let blob: Blob;
    const filename = project.specification.title || 'technical-specification';

    // Use Pandoc if enabled and template is uploaded
    if (usePandoc && useTemplate && docxTemplate) {
      if (!pandocAvailable) {
        throw new Error('Pandoc service is not available. Please start the backend service.');
      }

      console.log('[Export] Using Pandoc export...');
      blob = await exportWithPandoc(project, docxTemplate, exportOpts);
      downloadPandocDocx(blob, filename);

    } else if (useTemplate && docxTemplate) {
      // Use template-based export (browser-side)
      console.log('[Export] Using template export...');
      blob = await exportWithTemplate(project, docxTemplate, exportOpts);
      downloadTemplateDocx(blob, filename);

    } else {
      // Use default export (browser-side)
      console.log('[Export] Using default export...');
      blob = await exportToDocx(project, exportOpts);
      downloadDocx(blob, filename);
    }

    alert('Export successful!');
    onClose();

  } catch (error) {
    console.error('Export error:', error);
    alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    setExporting(false);
  }
};

// Add UI toggle for Pandoc (in the template section)
{docxTemplate && (
  <div className="mt-3 space-y-2">
    <label className="flex items-center space-x-2">
      <input
        type="checkbox"
        checked={useTemplate}
        onChange={(e) => setUseTemplate(e.target.checked)}
        className="rounded"
      />
      <span className="text-sm text-gray-700 dark:text-gray-300">
        Use uploaded template for export
      </span>
    </label>

    {useTemplate && (
      <label className="flex items-center space-x-2 ml-6">
        <input
          type="checkbox"
          checked={usePandoc}
          onChange={(e) => setUsePandoc(e.target.checked)}
          disabled={!pandocAvailable}
          className="rounded"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Use Pandoc (professional output)
          {!pandocAvailable && (
            <span className="text-red-500 ml-2">⚠️ Backend service not available</span>
          )}
        </span>
      </label>
    )}
  </div>
)}
```

#### 2.3 Add Environment Variable

**File**: `.env.local.example`

```bash
# Pandoc Export Service
# URL of the Pandoc backend service
VITE_PANDOC_API_URL=http://localhost:3001/api
```

---

## Deployment

### Development

```bash
# Terminal 1: Start frontend
npm run dev

# Terminal 2: Start Pandoc service
cd server
npm start   # or: python pandoc_service.py
```

### Production

#### Docker Compose

**File**: `docker-compose.yml`

```yaml
version: '3.8'

services:
  frontend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - VITE_PANDOC_API_URL=http://pandoc-service:3001/api

  pandoc-service:
    build: ./server
    ports:
      - "3001:3001"
    environment:
      - FRONTEND_URL=http://localhost:3000
```

**File**: `server/Dockerfile`

```dockerfile
FROM node:18-alpine

# Install Pandoc
RUN apk add --no-cache pandoc

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application
COPY . .

# Expose port
EXPOSE 3001

# Start service
CMD ["npm", "start"]
```

---

## Testing

### Manual Test Plan

1. **Setup**:
   - Start frontend: `npm run dev`
   - Start Pandoc service: `cd server && npm start`

2. **Create Test Template**:
   - Open Word
   - Add company logo in header
   - Add "Page X of Y" in footer
   - Apply custom styles (fonts, colors)
   - Save as `test-template.docx`

3. **Test Export**:
   - Load project with specification
   - Click "Export" button
   - Upload `test-template.docx`
   - Check "Use uploaded template"
   - Check "Use Pandoc (professional output)"
   - Click "Export"

4. **Verify Output**:
   - Open exported DOCX in Word
   - ✅ Header with logo present
   - ✅ Footer with page numbers present
   - ✅ Template styles applied to content
   - ✅ Content is complete (not just template)
   - ✅ Table of contents generated (if enabled)

### Automated Tests

**File**: `server/__tests__/pandoc.test.js`

```javascript
const request = require('supertest');
const fs = require('fs');
const app = require('../pandoc-service');

describe('Pandoc Export API', () => {
  it('should return health check', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('should export markdown with template', async () => {
    const markdown = fs.readFileSync('test/fixtures/sample.md');
    const template = fs.readFileSync('test/fixtures/template.docx');

    const response = await request(app)
      .post('/api/export-pandoc')
      .attach('markdown', Buffer.from(markdown), 'input.md')
      .attach('template', template, 'template.docx')
      .field('options', JSON.stringify({ includeTOC: true }));

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/vnd.openxmlformats');
  });
});
```

---

## Security Considerations

### 1. Input Validation

```javascript
// Validate file types
if (!templateFile.originalname.endsWith('.docx')) {
  return res.status(400).json({ error: 'Invalid template file type' });
}

// Validate file sizes (10MB max)
const MAX_FILE_SIZE = 10 * 1024 * 1024;
if (markdownFile.size > MAX_FILE_SIZE || templateFile.size > MAX_FILE_SIZE) {
  return res.status(400).json({ error: 'File too large' });
}
```

### 2. Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many export requests, please try again later.'
});

app.use('/api/export-pandoc', limiter);
```

### 3. Sanitization

```javascript
// Sanitize filenames
const sanitizeFilename = (filename) => {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
};
```

### 4. Timeout Protection

```javascript
// Set timeout for Pandoc execution
const TIMEOUT_MS = 60000; // 60 seconds

exec(pandocCmd, {
  cwd: workDir,
  timeout: TIMEOUT_MS
}, (error, stdout, stderr) => {
  // ...
});
```

---

## Troubleshooting

### Pandoc Service Not Available

**Error**: `⚠️ Backend service not available`

**Solutions**:
1. Check if service is running: `curl http://localhost:3001/api/health`
2. Check Pandoc is installed: `pandoc --version`
3. Check logs: `cd server && npm start` (look for errors)
4. Check CORS settings in backend

### Export Fails with "Command not found"

**Error**: `pandoc: command not found`

**Solution**: Install Pandoc on server:
```bash
# Ubuntu/Debian
sudo apt-get install pandoc

# macOS
brew install pandoc

# Windows
# Download from https://pandoc.org/installing.html
```

### Template Not Applied

**Error**: Output looks like plain document, not using template

**Possible Causes**:
1. Template file corrupted
2. Pandoc version too old (need 2.10+)
3. Template has unsupported features

**Solution**: Test template with command line:
```bash
echo "# Test" > test.md
pandoc test.md --reference-doc=template.docx -o output.docx
```

### CORS Errors

**Error**: `Access to fetch blocked by CORS policy`

**Solution**: Update CORS configuration in backend:
```javascript
app.use(cors({
  origin: ['http://localhost:3000', 'https://yourdomain.com']
}));
```

---

## Future Enhancements

### 1. Diagram Embedding

Currently, diagrams are not embedded in Pandoc export. To add:

```markdown
![Figure 4-1: Architecture](data:image/png;base64,...)
```

Convert diagrams to base64 and embed in markdown before sending to Pandoc.

### 2. Multiple Output Formats

Pandoc supports many formats:
- PDF (via LaTeX)
- HTML
- EPUB
- ODT (OpenDocument)

Add format selector in UI:
```typescript
<select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)}>
  <option value="docx">Word (DOCX)</option>
  <option value="pdf">PDF</option>
  <option value="html">HTML</option>
</select>
```

### 3. Template Gallery

Provide built-in templates:
- 3GPP Technical Specification
- IEEE 830 SRS
- ISO/IEC 29148

Store in `server/templates/` directory.

### 4. Batch Export

Export multiple specifications in parallel.

### 5. Email Delivery

Instead of download, email the exported document:
```javascript
const nodemailer = require('nodemailer');

// After Pandoc export
await transporter.sendMail({
  to: user.email,
  subject: 'Your specification export',
  attachments: [{ filename: 'spec.docx', path: outputDocx }]
});
```

---

## Acceptance Criteria

- [ ] Pandoc backend service starts successfully
- [ ] Frontend detects when Pandoc service is available
- [ ] User can upload Word template with corporate branding
- [ ] "Use Pandoc" checkbox appears when template is uploaded
- [ ] Export with Pandoc preserves all template formatting
- [ ] Exported document includes:
  - [ ] Template headers and footers
  - [ ] Template styles applied to content
  - [ ] Complete specification content
  - [ ] Table of contents (if enabled)
  - [ ] Proper page numbering
- [ ] Error handling displays helpful messages
- [ ] Service handles concurrent exports safely
- [ ] Temp files are cleaned up after export

---

## Documentation

After implementation, update:

1. **CLAUDE.md**:
   - Add "Pandoc Export" section
   - Update "Export Pipeline" status to ✅ COMPLETE
   - Add Pandoc to "Libraries used"

2. **README.md**:
   - Add setup instructions for Pandoc service
   - Document environment variables
   - Add deployment guide

3. **PHASE4_COMPLETE.md**:
   - Mark Pandoc export as implemented
   - Add usage examples

4. **docs/features/TEMPLATE_DOCX_EXPORT.md**:
   - Add Pandoc section
   - Compare Pandoc vs browser-based export
   - Add troubleshooting guide

---

## References

- Pandoc Documentation: https://pandoc.org/MANUAL.html
- Pandoc Reference Document: https://pandoc.org/MANUAL.html#option--reference-doc
- pypandoc Documentation: https://github.com/JessicaTegner/pypandoc
- Express.js Documentation: https://expressjs.com/
- Flask Documentation: https://flask.palletsprojects.com/

---

## Questions for Implementation Team

1. **Backend Language Preference**: Node.js or Python?
2. **Deployment Platform**: Docker, VM, serverless (Lambda/Cloud Functions)?
3. **File Storage**: Local disk or cloud storage (S3/GCS)?
4. **Authentication**: Do exports need user authentication?
5. **Monitoring**: What logging/monitoring tools should we integrate?
6. **Pandoc Version**: Which version will be installed? (recommend 2.19+)

---

**Status**: Ready for implementation
**Next Steps**: Review with development team, choose backend stack, begin Phase 1
