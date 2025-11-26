# Pandoc Export Service

Backend service for TechSpec Studio that provides professional DOCX export using Pandoc with Word templates.

## Features

- Export markdown to DOCX using Pandoc
- Support for Word templates with `--reference-doc` flag
- Preserve headers, footers, logos, and styles from templates
- Table of contents generation (`--toc`)
- Section numbering (`--number-sections`)
- GitHub-flavored markdown support
- Automatic cleanup of temp files

## Requirements

- Node.js 18+
- Pandoc 2.10+ (for template support)

## Installation

### Option 1: Local Development

```bash
# Install Pandoc (choose your OS)

# Ubuntu/Debian
sudo apt-get update && sudo apt-get install pandoc

# macOS
brew install pandoc

# Windows
# Download from: https://pandoc.org/installing.html

# Install Node.js dependencies
cd server
npm install

# Start service
npm start
```

### Option 2: Docker

```bash
# Build and run with Docker
cd server
docker build -t techspec-pandoc-service .
docker run -p 3001:3001 techspec-pandoc-service
```

### Option 3: Docker Compose (Recommended)

```bash
# From project root
docker-compose up
```

## Usage

### Health Check

```bash
curl http://localhost:3001/api/health
```

Response:
```json
{
  "status": "ok",
  "service": "pandoc-export",
  "pandoc": "pandoc 2.19.2",
  "uptime": 42.5
}
```

### Export Markdown with Template

```bash
curl -X POST http://localhost:3001/api/export-pandoc \
  -F "markdown=@input.md" \
  -F "template=@template.docx" \
  -F 'options={"includeTOC":true,"includeNumberSections":true}' \
  -o output.docx
```

## API Reference

### POST /api/export-pandoc

Export markdown to DOCX using Pandoc with reference template.

**Request** (multipart/form-data):
- `markdown` (file): Markdown file (.md)
- `template` (file): Word template file (.docx)
- `options` (string): JSON with export options

**Options**:
```typescript
{
  includeTOC?: boolean;              // Generate table of contents
  includeNumberSections?: boolean;   // Number sections automatically
  metadata?: {
    title?: string;
    author?: string;
    date?: string;
  }
}
```

**Response**:
- Success: DOCX file binary
- Error: JSON with error details

## Environment Variables

Create `.env` file:

```bash
PORT=3001
FRONTEND_URL=http://localhost:3000
```

## Development

```bash
# Start with auto-reload
npm run dev

# Or with nodemon (if installed)
npx nodemon pandoc-service.js
```

## Troubleshooting

### "Pandoc not installed"

**Error**: Service returns 503 with "Pandoc not installed"

**Solution**: Install Pandoc using the commands above, then restart service.

### "CORS error"

**Error**: Frontend cannot connect due to CORS

**Solution**: Check `FRONTEND_URL` environment variable matches your frontend URL.

### "File too large"

**Error**: Upload rejected with "File too large"

**Solution**: Files are limited to 10MB. Increase `MAX_FILE_SIZE` in `pandoc-service.js`.

### "Command not found"

**Error**: Pandoc command fails

**Solution**: Verify Pandoc is in PATH: `which pandoc` or `where pandoc` (Windows)

## Security

- File size limits: 10MB
- File type validation: .md and .docx only
- Timeout protection: 60 seconds max per export
- Automatic temp file cleanup
- No shell injection vulnerabilities (uses exec with validated inputs)

## Performance

- Typical export time: 1-3 seconds (50-page document with template)
- Memory usage: ~50-100MB per export
- Concurrent requests: Supports multiple simultaneous exports
- Cleanup: Old temp files deleted after 1 hour

## License

MIT
