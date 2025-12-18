/**
 * Pandoc Export Service
 *
 * Backend service for converting markdown to DOCX using Pandoc with Word templates.
 * Provides REST API for TechSpec Studio frontend.
 */

import express from 'express';
import multer from 'multer';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Configuration
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const TEMP_DIR = path.join(__dirname, 'temp');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// CORS configuration
app.use(cors({
  origin: FRONTEND_URL,
  methods: ['GET', 'POST'],
  credentials: true
}));

// JSON body parser for small payloads
app.use(express.json());

// Multer configuration for file uploads
const upload = multer({
  dest: path.join(TEMP_DIR, 'uploads'),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 3 // markdown, template, and optional metadata
  },
  fileFilter: (req, file, cb) => {
    // Validate file types
    if (file.fieldname === 'markdown' && !file.originalname.endsWith('.md')) {
      return cb(new Error('Markdown file must have .md extension'));
    }
    if (file.fieldname === 'template' && !file.originalname.endsWith('.docx')) {
      return cb(new Error('Template file must have .docx extension'));
    }
    cb(null, true);
  }
});

// Ensure temp directory exists
await fs.mkdir(TEMP_DIR, { recursive: true });
await fs.mkdir(path.join(TEMP_DIR, 'uploads'), { recursive: true });

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  // Check if Pandoc is installed
  exec('pandoc --version', (error, stdout) => {
    if (error) {
      return res.status(503).json({
        status: 'unhealthy',
        service: 'pandoc-export',
        error: 'Pandoc not installed',
        message: 'Please install Pandoc: https://pandoc.org/installing.html'
      });
    }

    const version = stdout.split('\n')[0];
    res.json({
      status: 'ok',
      service: 'pandoc-export',
      pandoc: version,
      uptime: process.uptime()
    });
  });
});

/**
 * POST /api/export-pandoc
 *
 * Export markdown to DOCX using Pandoc with reference template.
 *
 * Request (multipart/form-data):
 *   - markdown: Markdown file (.md)
 *   - template: Word template file (.docx)
 *   - options: JSON string with export options
 *
 * Response:
 *   - DOCX file binary
 */
app.post('/api/export-pandoc', upload.fields([
  { name: 'markdown', maxCount: 1 },
  { name: 'template', maxCount: 1 }
]), async (req, res) => {
  const sessionId = crypto.randomBytes(16).toString('hex');
  const workDir = path.join(TEMP_DIR, sessionId);

  console.log(`[${sessionId}] New export request`);

  try {
    // Validate uploaded files
    if (!req.files || !req.files.markdown || !req.files.template) {
      return res.status(400).json({
        error: 'Missing required files',
        message: 'Both markdown and template files are required'
      });
    }

    const markdownFile = req.files.markdown[0];
    const templateFile = req.files.template[0];

    console.log(`[${sessionId}] Markdown: ${markdownFile.originalname} (${markdownFile.size} bytes)`);
    console.log(`[${sessionId}] Template: ${templateFile.originalname} (${templateFile.size} bytes)`);

    // Parse options
    const options = req.body.options ? JSON.parse(req.body.options) : {};
    console.log(`[${sessionId}] Options:`, options);

    // Create working directory
    await fs.mkdir(workDir, { recursive: true });

    // Define file paths
    const inputMd = path.join(workDir, 'input.md');
    const templateDocx = path.join(workDir, 'template.docx');
    const outputDocx = path.join(workDir, 'output.docx');

    // Copy uploaded files to working directory
    await fs.copyFile(markdownFile.path, inputMd);
    await fs.copyFile(templateFile.path, templateDocx);

    // Build pandoc command
    // Note: Using 'markdown' (not 'gfm') to support Pandoc fenced divs for custom styles
    // e.g., ::: {custom-style="Figure Caption"} ... :::
    const pandocArgs = [
      `"${inputMd}"`,
      `--reference-doc="${templateDocx}"`,
      `--output="${outputDocx}"`,
      '--from=markdown+fenced_divs+pipe_tables+strikeout+task_lists',
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

    // Add metadata if provided
    if (options.metadata) {
      const { title, author, date } = options.metadata;
      if (title) pandocArgs.push(`--metadata=title:"${title}"`);
      if (author) pandocArgs.push(`--metadata=author:"${author}"`);
      if (date) pandocArgs.push(`--metadata=date:"${date}"`);
    }

    const pandocCmd = `pandoc ${pandocArgs.join(' ')}`;
    console.log(`[${sessionId}] Executing: ${pandocCmd}`);

    // Execute pandoc
    await new Promise((resolve, reject) => {
      exec(pandocCmd, {
        timeout: 60000, // 60 second timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      }, (error, stdout, stderr) => {
        if (error) {
          console.error(`[${sessionId}] Pandoc error:`, stderr);
          reject(new Error(`Pandoc execution failed: ${stderr || error.message}`));
        } else {
          if (stdout) console.log(`[${sessionId}] Pandoc stdout:`, stdout);
          if (stderr) console.log(`[${sessionId}] Pandoc stderr:`, stderr);
          resolve();
        }
      });
    });

    // Check if output file was created
    try {
      await fs.access(outputDocx);
    } catch {
      throw new Error('Pandoc did not generate output file');
    }

    const stats = await fs.stat(outputDocx);
    console.log(`[${sessionId}] Export successful: ${stats.size} bytes`);

    // Send file back to client
    res.download(outputDocx, 'specification.docx', async (err) => {
      if (err) {
        console.error(`[${sessionId}] Download error:`, err);
      }

      // Cleanup: delete working directory and uploaded files
      console.log(`[${sessionId}] Cleaning up...`);
      await cleanupFiles(workDir, markdownFile.path, templateFile.path);
    });

  } catch (error) {
    console.error(`[${sessionId}] Error:`, error);

    // Cleanup on error
    await cleanupFiles(workDir);

    res.status(500).json({
      error: 'Export failed',
      message: error.message,
      sessionId
    });
  }
});

/**
 * Cleanup helper function
 */
async function cleanupFiles(workDir, ...uploadPaths) {
  try {
    // Delete working directory
    if (workDir) {
      await fs.rm(workDir, { recursive: true, force: true });
    }

    // Delete uploaded files
    for (const uploadPath of uploadPaths) {
      if (uploadPath) {
        await fs.unlink(uploadPath).catch(() => {});
      }
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

/**
 * Periodic cleanup of old temp files (every 1 hour)
 */
setInterval(async () => {
  console.log('[Cleanup] Running periodic cleanup...');
  try {
    const files = await fs.readdir(TEMP_DIR);
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const file of files) {
      if (file === 'uploads') continue; // Skip uploads directory itself

      const filePath = path.join(TEMP_DIR, file);
      const stats = await fs.stat(filePath);

      if (now - stats.mtimeMs > maxAge) {
        console.log(`[Cleanup] Deleting old file: ${file}`);
        await fs.rm(filePath, { recursive: true, force: true });
      }
    }
  } catch (error) {
    console.error('[Cleanup] Error:', error);
  }
}, 60 * 60 * 1000); // Run every hour

/**
 * Error handler
 */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: `Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
      });
    }
    return res.status(400).json({
      error: 'Upload error',
      message: err.message
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

/**
 * Start server
 */
app.listen(PORT, '0.0.0.0', () => {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║          TechSpec Studio - Pandoc Export Service          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Frontend URL: ${FRONTEND_URL}`);
  console.log(`✓ Health check: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('Ready to accept export requests...');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
