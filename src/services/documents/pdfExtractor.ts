/**
 * PDF Text Extraction Service
 *
 * Provides browser-based PDF text extraction for non-vision models.
 * Uses pdfjs-dist for reliable PDF parsing in the browser.
 *
 * This is a fallback for when:
 * - User uploads a PDF but uses a non-vision model
 * - Vision model processing fails
 * - User explicitly prefers text extraction
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
// In Vite, we need to set the worker path correctly
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface PDFExtractionResult {
  text: string;
  pageCount: number;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creationDate?: string;
    modificationDate?: string;
  };
  pageTexts: string[];
  tokenEstimate: number;
}

export interface PDFExtractionOptions {
  /** Maximum pages to extract (default: all) */
  maxPages?: number;
  /** Include page numbers in output (default: true) */
  includePageNumbers?: boolean;
  /** Separator between pages (default: '\n\n---\n\n') */
  pageSeparator?: string;
}

/**
 * Extract text from a PDF file
 *
 * @param file - PDF file to extract text from
 * @param options - Extraction options
 * @returns Extraction result with text and metadata
 */
export async function extractTextFromPDF(
  file: File,
  options: PDFExtractionOptions = {}
): Promise<PDFExtractionResult> {
  const {
    maxPages,
    includePageNumbers = true,
    pageSeparator = '\n\n---\n\n',
  } = options;

  try {
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
    });

    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    const pagesToExtract = maxPages ? Math.min(maxPages, pageCount) : pageCount;

    console.log(`📄 Extracting text from PDF: ${file.name} (${pagesToExtract}/${pageCount} pages)`);

    // Extract metadata
    const metadata = await pdf.getMetadata().catch(() => null);
    const info = metadata?.info as Record<string, unknown> | undefined;

    const extractedMetadata = {
      title: info?.Title as string | undefined,
      author: info?.Author as string | undefined,
      subject: info?.Subject as string | undefined,
      keywords: info?.Keywords as string | undefined,
      creationDate: info?.CreationDate as string | undefined,
      modificationDate: info?.ModDate as string | undefined,
    };

    // Extract text from each page
    const pageTexts: string[] = [];

    for (let i = 1; i <= pagesToExtract; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      // Combine text items with proper spacing
      let pageText = '';
      let lastY = -1;

      for (const item of textContent.items) {
        if ('str' in item) {
          const textItem = item as { str: string; transform: number[] };
          const y = textItem.transform[5];

          // Add newline if Y position changed significantly (new line)
          if (lastY !== -1 && Math.abs(y - lastY) > 5) {
            pageText += '\n';
          } else if (pageText && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
            pageText += ' ';
          }

          pageText += textItem.str;
          lastY = y;
        }
      }

      // Clean up the text
      pageText = pageText
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .replace(/\n\s+/g, '\n')  // Clean up line starts
        .trim();

      if (includePageNumbers && pagesToExtract > 1) {
        pageTexts.push(`[Page ${i}]\n${pageText}`);
      } else {
        pageTexts.push(pageText);
      }
    }

    // Combine all pages
    const fullText = pageTexts.join(pageSeparator);

    // Estimate tokens (approximately 4 chars per token)
    const tokenEstimate = Math.ceil(fullText.length / 4);

    console.log(`✅ Extracted ${fullText.length} characters (~${tokenEstimate} tokens) from ${pagesToExtract} pages`);

    return {
      text: fullText,
      pageCount,
      metadata: extractedMetadata,
      pageTexts,
      tokenEstimate,
    };
  } catch (error) {
    console.error('❌ PDF extraction failed:', error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from a PDF stored as base64
 *
 * @param base64Data - Base64-encoded PDF data (without data URI prefix)
 * @param filename - Filename for logging
 * @param options - Extraction options
 * @returns Extraction result with text and metadata
 */
export async function extractTextFromPDFBase64(
  base64Data: string,
  filename: string,
  options: PDFExtractionOptions = {}
): Promise<PDFExtractionResult> {
  const {
    maxPages,
    includePageNumbers = true,
    pageSeparator = '\n\n---\n\n',
  } = options;

  try {
    // Decode base64 to ArrayBuffer
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: bytes,
      useSystemFonts: true,
    });

    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    const pagesToExtract = maxPages ? Math.min(maxPages, pageCount) : pageCount;

    console.log(`📄 Extracting text from PDF: ${filename} (${pagesToExtract}/${pageCount} pages)`);

    // Extract metadata
    const metadata = await pdf.getMetadata().catch(() => null);
    const info = metadata?.info as Record<string, unknown> | undefined;

    const extractedMetadata = {
      title: info?.Title as string | undefined,
      author: info?.Author as string | undefined,
      subject: info?.Subject as string | undefined,
      keywords: info?.Keywords as string | undefined,
      creationDate: info?.CreationDate as string | undefined,
      modificationDate: info?.ModDate as string | undefined,
    };

    // Extract text from each page
    const pageTexts: string[] = [];

    for (let i = 1; i <= pagesToExtract; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      // Combine text items with proper spacing
      let pageText = '';
      let lastY = -1;

      for (const item of textContent.items) {
        if ('str' in item) {
          const textItem = item as { str: string; transform: number[] };
          const y = textItem.transform[5];

          // Add newline if Y position changed significantly (new line)
          if (lastY !== -1 && Math.abs(y - lastY) > 5) {
            pageText += '\n';
          } else if (pageText && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
            pageText += ' ';
          }

          pageText += textItem.str;
          lastY = y;
        }
      }

      // Clean up the text
      pageText = pageText
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .replace(/\n\s+/g, '\n')  // Clean up line starts
        .trim();

      if (includePageNumbers && pagesToExtract > 1) {
        pageTexts.push(`[Page ${i}]\n${pageText}`);
      } else {
        pageTexts.push(pageText);
      }
    }

    // Combine all pages
    const fullText = pageTexts.join(pageSeparator);

    // Estimate tokens (approximately 4 chars per token)
    const tokenEstimate = Math.ceil(fullText.length / 4);

    console.log(`✅ Extracted ${fullText.length} characters (~${tokenEstimate} tokens) from ${pagesToExtract} pages`);

    return {
      text: fullText,
      pageCount,
      metadata: extractedMetadata,
      pageTexts,
      tokenEstimate,
    };
  } catch (error) {
    console.error('❌ PDF extraction failed:', error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from a DOCX file using mammoth
 *
 * @param file - DOCX file to extract text from
 * @returns Extraction result with text
 */
export async function extractTextFromDOCX(file: File): Promise<{
  text: string;
  tokenEstimate: number;
}> {
  try {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();

    console.log(`📄 Extracting text from DOCX: ${file.name}`);

    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value;

    // Estimate tokens (approximately 4 chars per token)
    const tokenEstimate = Math.ceil(text.length / 4);

    console.log(`✅ Extracted ${text.length} characters (~${tokenEstimate} tokens) from DOCX`);

    return {
      text,
      tokenEstimate,
    };
  } catch (error) {
    console.error('❌ DOCX extraction failed:', error);
    throw new Error(`Failed to extract text from DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from a document based on its type
 * Supports PDF and DOCX files
 *
 * @param file - Document file to extract text from
 * @param options - Extraction options (for PDFs)
 * @returns Extracted text and metadata
 */
export async function extractTextFromDocument(
  file: File,
  options: PDFExtractionOptions = {}
): Promise<{
  text: string;
  tokenEstimate: number;
  pageCount?: number;
  metadata?: PDFExtractionResult['metadata'];
}> {
  const isPDF = file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf');

  const isDOCX = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.toLowerCase().endsWith('.docx');

  if (isPDF) {
    const result = await extractTextFromPDF(file, options);
    return {
      text: result.text,
      tokenEstimate: result.tokenEstimate,
      pageCount: result.pageCount,
      metadata: result.metadata,
    };
  }

  if (isDOCX) {
    const result = await extractTextFromDOCX(file);
    return {
      text: result.text,
      tokenEstimate: result.tokenEstimate,
    };
  }

  throw new Error(`Unsupported document type: ${file.type || file.name}`);
}

export default {
  extractTextFromPDF,
  extractTextFromPDFBase64,
  extractTextFromDOCX,
  extractTextFromDocument,
};
