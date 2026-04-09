/**
 * Diagram Context Extractor
 *
 * Pre-processes reference documents to extract descriptions of diagrams and visual content.
 * Runs once per document upload, stores descriptions as text that gets cached across all
 * generation calls.
 *
 * Supported formats:
 * - PDF: Pages sent to vision model (Gemini Flash) to identify and describe diagrams
 * - DOCX: Images extracted from word/media/ via PizZip, sent to vision model
 * - TXT/MD: ASCII/pseudo-diagrams detected via heuristics, sent to LLM for interpretation
 *
 * The extracted descriptions become part of the stable cached context, so every section
 * generation call benefits from understanding the diagrams without re-processing.
 */

import type { AIConfig } from '../../types';

export interface DiagramDescription {
  /** Source: page number (PDF), image filename (DOCX), or line range (TXT) */
  source: string;
  /** What the diagram shows — architecture, call flow, state machine, etc. */
  type: string;
  /** Detailed text description of the diagram content */
  description: string;
}

export interface DiagramExtractionResult {
  /** Document title/filename */
  documentTitle: string;
  /** All diagrams found and described */
  diagrams: DiagramDescription[];
  /** Combined text summary for context injection */
  contextSummary: string;
  /** Tokens used for extraction */
  tokensUsed: number;
  /** Cost of extraction */
  cost: number;
}

/**
 * Extract diagram context from a PDF document using a vision model.
 * Sends each page as an image and asks the model to identify and describe any diagrams.
 */
export async function extractDiagramsFromPDF(
  base64Data: string,
  filename: string,
  provider: any,
  config: Partial<AIConfig>
): Promise<DiagramExtractionResult> {
  const prompt = buildDiagramExtractionPrompt(filename);

  // Send the full PDF to the vision model
  const messages = [
    {
      role: 'user' as const,
      content: [
        { type: 'text' as const, text: prompt },
        {
          type: 'file' as const,
          file: {
            filename,
            file_data: `data:application/pdf;base64,${base64Data}`,
          },
        },
      ],
    },
  ];

  const result = await provider.generateMultimodal(messages, {
    ...config,
    temperature: 0.2, // Low temperature for factual descriptions
    maxTokens: 8000,
  });

  return parseExtractionResponse(filename, result);
}

/**
 * Extract diagram context from DOCX images.
 * Uses PizZip to extract images from word/media/, then sends them to a vision model.
 */
export async function extractDiagramsFromDOCX(
  base64Data: string,
  filename: string,
  provider: any,
  config: Partial<AIConfig>
): Promise<DiagramExtractionResult> {
  // Decode base64 to binary for PizZip
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Extract images from DOCX (which is a ZIP)
  const PizZip = (await import('pizzip')).default;
  const zip = new PizZip(bytes.buffer);

  const imageFiles: Array<{ name: string; base64: string; mimeType: string }> = [];

  const mimeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    emf: 'image/emf',
    wmf: 'image/wmf',
    tiff: 'image/tiff',
    tif: 'image/tiff',
  };

  // Iterate over all files in the ZIP looking for word/media/ images
  const allFiles = zip.files;
  for (const filePath of Object.keys(allFiles)) {
    if (!filePath.startsWith('word/media/')) continue;
    const file = allFiles[filePath];
    if (file.dir) continue;

    const ext = filePath.toLowerCase().split('.').pop();
    const mimeType = mimeMap[ext || ''];
    if (!mimeType) continue;

    // Skip very small images (likely icons/bullets, < 5KB)
    const fileContent = file.asUint8Array();
    if (fileContent.length < 5000) continue;

    // Convert to base64 — use chunked approach to avoid O(n²) string concat
    const chunkSize = 8192;
    const chunks: string[] = [];
    for (let j = 0; j < fileContent.length; j += chunkSize) {
      const slice = fileContent.subarray(j, Math.min(j + chunkSize, fileContent.length));
      chunks.push(String.fromCharCode.apply(null, Array.from(slice)));
    }
    const b64 = btoa(chunks.join(''));

    imageFiles.push({ name: filePath.replace('word/media/', ''), base64: b64, mimeType });
  }

  if (imageFiles.length === 0) {
    return {
      documentTitle: filename,
      diagrams: [],
      contextSummary: '',
      tokensUsed: 0,
      cost: 0,
    };
  }

  console.log(`📸 Found ${imageFiles.length} images in ${filename}`);

  // Build multimodal message with all images
  const content: any[] = [
    { type: 'text', text: buildDiagramExtractionPrompt(filename) },
  ];

  for (const img of imageFiles) {
    // Skip EMF/WMF — vision models can't process these
    if (img.mimeType === 'image/emf' || img.mimeType === 'image/wmf') {
      continue;
    }
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`,
      },
    });
  }

  // If no processable images remain, return empty
  if (content.length <= 1) {
    return {
      documentTitle: filename,
      diagrams: [],
      contextSummary: '',
      tokensUsed: 0,
      cost: 0,
    };
  }

  const messages = [{ role: 'user' as const, content }];

  const result = await provider.generateMultimodal(messages, {
    ...config,
    temperature: 0.2,
    maxTokens: 8000,
  });

  return parseExtractionResponse(filename, result);
}

/**
 * Extract diagram context from TXT/MD files by detecting pseudo-diagrams.
 * Looks for ASCII art, box-drawing characters, arrow patterns, etc.
 */
export async function extractDiagramsFromText(
  text: string,
  filename: string,
  provider: any,
  config: Partial<AIConfig>
): Promise<DiagramExtractionResult> {
  // Detect pseudo-diagram sections
  const pseudoDiagrams = detectPseudoDiagrams(text);

  if (pseudoDiagrams.length === 0) {
    return {
      documentTitle: filename,
      diagrams: [],
      contextSummary: '',
      tokensUsed: 0,
      cost: 0,
    };
  }

  console.log(`📊 Found ${pseudoDiagrams.length} pseudo-diagram(s) in ${filename}`);

  const prompt = `You are analyzing a text document "${filename}" that contains ASCII/text-based diagrams.

For each diagram below, provide:
1. What type of diagram it is (architecture, flow, sequence, state machine, network topology, etc.)
2. A clear description of what the diagram shows — entities, relationships, data flows, protocols

Respond in this format for each diagram:
DIAGRAM: [source location]
TYPE: [diagram type]
DESCRIPTION: [detailed description]
---

Here are the text diagrams found:

${pseudoDiagrams.map((d, i) => `--- Diagram ${i + 1} (lines ${d.startLine}-${d.endLine}) ---\n${d.content}\n`).join('\n')}`;

  const messages = [{ role: 'user' as const, content: prompt }];

  const result = await provider.generate(messages, {
    ...config,
    temperature: 0.2,
    maxTokens: 4000,
  });

  return parseExtractionResponse(filename, result);
}

/**
 * Detect pseudo-diagrams in plain text.
 * Looks for ASCII art patterns: box-drawing chars, arrows, alignment patterns.
 */
function detectPseudoDiagrams(text: string): Array<{ content: string; startLine: number; endLine: number }> {
  const lines = text.split('\n');
  const diagrams: Array<{ content: string; startLine: number; endLine: number }> = [];

  // Patterns that suggest a diagram
  const diagramPatterns = [
    /[│┌┐└┘├┤┬┴┼─]/,           // Box-drawing characters
    /[+\-|]{3,}.*[+\-|]{3,}/,   // ASCII box patterns (+---+)
    /[-=]{2,}>|<[-=]{2,}/,      // ASCII arrows (-->, <--, ==>, <==)
    /\|.*\|.*\|/,               // Table/grid patterns
    /[╔╗╚╝═║╠╣╦╩╬]/,           // Double box-drawing
    /\[.*\].*(?:-->|->|<--|<-).*\[.*\]/, // Box-arrow-box patterns
  ];

  let inDiagram = false;
  let diagramStart = 0;
  let diagramLines: string[] = [];
  let nonDiagramCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isDiagramLine = diagramPatterns.some(p => p.test(line));

    if (isDiagramLine) {
      if (!inDiagram) {
        inDiagram = true;
        diagramStart = i;
        diagramLines = [];
        nonDiagramCount = 0;
      }
      diagramLines.push(line);
      nonDiagramCount = 0;
    } else if (inDiagram) {
      diagramLines.push(line);
      nonDiagramCount++;
      // End diagram after 3 consecutive non-diagram lines
      if (nonDiagramCount >= 3) {
        // Remove trailing non-diagram lines
        while (diagramLines.length > 0 && !diagramPatterns.some(p => p.test(diagramLines[diagramLines.length - 1]))) {
          diagramLines.pop();
        }
        // Only include if at least 3 diagram lines (avoid false positives)
        if (diagramLines.length >= 3) {
          diagrams.push({
            content: diagramLines.join('\n'),
            startLine: diagramStart + 1,
            endLine: diagramStart + diagramLines.length,
          });
        }
        inDiagram = false;
        diagramLines = [];
      }
    }
  }

  // Handle diagram at end of file
  if (inDiagram && diagramLines.length >= 3) {
    while (diagramLines.length > 0 && !diagramPatterns.some(p => p.test(diagramLines[diagramLines.length - 1]))) {
      diagramLines.pop();
    }
    if (diagramLines.length >= 3) {
      diagrams.push({
        content: diagramLines.join('\n'),
        startLine: diagramStart + 1,
        endLine: diagramStart + diagramLines.length,
      });
    }
  }

  return diagrams;
}

/**
 * Build the prompt for diagram extraction from visual content.
 */
function buildDiagramExtractionPrompt(filename: string): string {
  return `You are analyzing the document "${filename}" for diagrams and visual content.

Identify ALL diagrams, figures, charts, and visual elements in this document. For each one, provide:
1. Where it appears (page number, figure number, or position)
2. What type of diagram it is (network architecture, call flow, sequence diagram, state machine, protocol stack, entity relationship, topology, data flow, etc.)
3. A detailed technical description of what the diagram shows — include all entities, connections, protocols, interfaces, data flows, and labels visible

Be thorough and precise. These descriptions will be used as context for generating technical specifications, so include exact terminology, protocol names, interface names, and node identifiers.

Respond in this format for each diagram found:
DIAGRAM: [location/figure reference]
TYPE: [diagram type]
DESCRIPTION: [detailed technical description including all entities, relationships, and labels]
---

If no diagrams are found, respond with: NO_DIAGRAMS_FOUND`;
}

/**
 * Parse the LLM response into structured diagram descriptions.
 */
function parseExtractionResponse(
  filename: string,
  result: { content: string; tokens?: any; cost?: number }
): DiagramExtractionResult {
  const content = result.content || '';
  const diagrams: DiagramDescription[] = [];

  if (content.includes('NO_DIAGRAMS_FOUND')) {
    return {
      documentTitle: filename,
      diagrams: [],
      contextSummary: '',
      tokensUsed: result.tokens?.total || 0,
      cost: result.cost || 0,
    };
  }

  // Parse DIAGRAM/TYPE/DESCRIPTION blocks
  const blocks = content.split(/---+/).filter(b => b.trim());

  for (const block of blocks) {
    const sourceMatch = block.match(/DIAGRAM:\s*(.+)/i);
    const typeMatch = block.match(/TYPE:\s*(.+)/i);
    const descMatch = block.match(/DESCRIPTION:\s*([\s\S]*?)(?=(?:DIAGRAM:|TYPE:|$))/i);

    if (descMatch) {
      diagrams.push({
        source: sourceMatch?.[1]?.trim() || 'Unknown location',
        type: typeMatch?.[1]?.trim() || 'Unknown type',
        description: descMatch[1].trim(),
      });
    }
  }

  // Build context summary
  const contextSummary = diagrams.length > 0
    ? `### Diagrams in "${filename}"\n\n` +
      diagrams.map((d) =>
        `**${d.source}** (${d.type}):\n${d.description}`
      ).join('\n\n')
    : '';

  return {
    documentTitle: filename,
    diagrams,
    contextSummary,
    tokensUsed: result.tokens?.total || 0,
    cost: result.cost || 0,
  };
}

/**
 * Extract diagram context from any supported document format.
 * Dispatches to the appropriate extractor based on file type.
 */
export async function extractDiagramContext(
  documentType: 'PDF' | 'DOCX' | 'TXT' | 'MD',
  base64Data: string | undefined,
  extractedText: string | undefined,
  filename: string,
  provider: any,
  config: Partial<AIConfig>
): Promise<DiagramExtractionResult> {
  try {
    switch (documentType) {
      case 'PDF':
        if (!base64Data) {
          console.warn(`⚠️ No base64 data for PDF ${filename}, skipping diagram extraction`);
          return emptyResult(filename);
        }
        return await extractDiagramsFromPDF(base64Data, filename, provider, config);

      case 'DOCX':
        if (!base64Data) {
          console.warn(`⚠️ No base64 data for DOCX ${filename}, skipping diagram extraction`);
          return emptyResult(filename);
        }
        return await extractDiagramsFromDOCX(base64Data, filename, provider, config);

      case 'TXT':
      case 'MD':
        if (!extractedText) {
          console.warn(`⚠️ No text content for ${filename}, skipping diagram extraction`);
          return emptyResult(filename);
        }
        return await extractDiagramsFromText(extractedText, filename, provider, config);

      default:
        return emptyResult(filename);
    }
  } catch (error) {
    console.error(`❌ Diagram extraction failed for ${filename}:`, error);
    return emptyResult(filename);
  }
}

function emptyResult(filename: string): DiagramExtractionResult {
  return {
    documentTitle: filename,
    diagrams: [],
    contextSummary: '',
    tokensUsed: 0,
    cost: 0,
  };
}
