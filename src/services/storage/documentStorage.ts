/**
 * Document Storage Service
 *
 * IndexedDB storage for large reference documents (PDFs, DOCX)
 * Keeps binary data out of localStorage/Zustand to avoid quota limits
 *
 * Features:
 * - Store documents up to 100MB+ (browser-dependent)
 * - Retrieve documents as ArrayBuffer or base64
 * - Automatic cleanup when documents are removed
 * - Storage statistics tracking
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// ========== Database Schema ==========

interface DocumentStorageDB extends DBSchema {
  'reference-documents': {
    key: string;  // Document ID
    value: {
      id: string;
      filename: string;
      mimeType: string;
      size: number;
      data: ArrayBuffer;
      uploadedAt: number;  // Unix timestamp
    };
    indexes: {
      'by-filename': string;
      'by-uploadedAt': number;
    };
  };
}

// ========== Constants ==========

const DB_NAME = 'techspec-documents';
const DB_VERSION = 1;
const STORE_NAME = 'reference-documents';

// Max file size: 20MB (as per plan)
const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ========== Singleton Instance ==========

let dbInstance: IDBPDatabase<DocumentStorageDB> | null = null;

/**
 * Initialize the IndexedDB database for document storage
 */
async function initDB(): Promise<IDBPDatabase<DocumentStorageDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<DocumentStorageDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create object store with indexes
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by-filename', 'filename');
        store.createIndex('by-uploadedAt', 'uploadedAt');
        console.log('✅ Created document storage IndexedDB:', STORE_NAME);
      }
    },
  });

  console.log('✅ Document storage initialized:', DB_NAME);
  return dbInstance;
}

// ========== Storage Interface ==========

export interface StoredDocument {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
}

export interface DocumentStorageStats {
  documentCount: number;
  totalSizeBytes: number;
  totalSizeMB: string;
  documents: StoredDocument[];
}

// ========== Public API ==========

/**
 * Store a document in IndexedDB
 *
 * @param id Unique document ID
 * @param data Document data as ArrayBuffer or File
 * @param filename Original filename
 * @param mimeType MIME type (e.g., "application/pdf")
 * @throws Error if file exceeds max size
 */
export async function storeDocument(
  id: string,
  data: ArrayBuffer | File,
  filename: string,
  mimeType: string
): Promise<StoredDocument> {
  const db = await initDB();

  // Convert File to ArrayBuffer if needed
  let arrayBuffer: ArrayBuffer;
  if (data instanceof File) {
    arrayBuffer = await data.arrayBuffer();
  } else {
    arrayBuffer = data;
  }

  // Validate file size
  if (arrayBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File size (${(arrayBuffer.byteLength / (1024 * 1024)).toFixed(2)}MB) ` +
      `exceeds maximum allowed size (${MAX_FILE_SIZE_MB}MB)`
    );
  }

  const uploadedAt = Date.now();

  await db.put(STORE_NAME, {
    id,
    filename,
    mimeType,
    size: arrayBuffer.byteLength,
    data: arrayBuffer,
    uploadedAt,
  });

  console.log('📁 Stored document:', {
    id,
    filename,
    mimeType,
    sizeMB: (arrayBuffer.byteLength / (1024 * 1024)).toFixed(2),
  });

  return {
    id,
    filename,
    mimeType,
    size: arrayBuffer.byteLength,
    uploadedAt: new Date(uploadedAt),
  };
}

/**
 * Get a document from IndexedDB as ArrayBuffer
 *
 * @param id Document ID
 * @returns ArrayBuffer or null if not found
 */
export async function getDocument(id: string): Promise<ArrayBuffer | null> {
  const db = await initDB();
  const doc = await db.get(STORE_NAME, id);

  if (!doc) {
    console.log('⚠️ Document not found:', id);
    return null;
  }

  return doc.data;
}

/**
 * Get a document from IndexedDB as base64 string
 * Useful for sending to OpenRouter API
 *
 * @param id Document ID
 * @returns Base64 string (without data URI prefix) or null if not found
 */
export async function getDocumentAsBase64(id: string): Promise<string | null> {
  const arrayBuffer = await getDocument(id);
  if (!arrayBuffer) return null;

  // Convert ArrayBuffer to base64
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Get document metadata without loading the full data
 *
 * @param id Document ID
 * @returns Document metadata or null if not found
 */
export async function getDocumentMetadata(id: string): Promise<StoredDocument | null> {
  const db = await initDB();
  const doc = await db.get(STORE_NAME, id);

  if (!doc) return null;

  return {
    id: doc.id,
    filename: doc.filename,
    mimeType: doc.mimeType,
    size: doc.size,
    uploadedAt: new Date(doc.uploadedAt),
  };
}

/**
 * Delete a document from IndexedDB
 *
 * @param id Document ID
 */
export async function deleteDocument(id: string): Promise<void> {
  const db = await initDB();
  await db.delete(STORE_NAME, id);
  console.log('🗑️ Deleted document:', id);
}

/**
 * Delete multiple documents from IndexedDB
 *
 * @param ids Array of document IDs
 */
export async function deleteDocuments(ids: string[]): Promise<void> {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');

  await Promise.all([
    ...ids.map(id => tx.store.delete(id)),
    tx.done,
  ]);

  console.log('🗑️ Deleted documents:', ids.length);
}

/**
 * Clear all documents from IndexedDB
 */
export async function clearAllDocuments(): Promise<void> {
  const db = await initDB();
  await db.clear(STORE_NAME);
  console.log('🗑️ Cleared all documents');
}

/**
 * List all stored documents (metadata only)
 *
 * @returns Array of document metadata
 */
export async function listDocuments(): Promise<StoredDocument[]> {
  const db = await initDB();
  const docs = await db.getAll(STORE_NAME);

  return docs.map(doc => ({
    id: doc.id,
    filename: doc.filename,
    mimeType: doc.mimeType,
    size: doc.size,
    uploadedAt: new Date(doc.uploadedAt),
  }));
}

/**
 * Get storage statistics
 *
 * @returns Storage usage statistics
 */
export async function getStorageStats(): Promise<DocumentStorageStats> {
  const documents = await listDocuments();

  const totalSizeBytes = documents.reduce((sum, doc) => sum + doc.size, 0);

  return {
    documentCount: documents.length,
    totalSizeBytes,
    totalSizeMB: (totalSizeBytes / (1024 * 1024)).toFixed(2),
    documents,
  };
}

/**
 * Check if a document exists
 *
 * @param id Document ID
 * @returns true if document exists
 */
export async function documentExists(id: string): Promise<boolean> {
  const db = await initDB();
  const key = await db.getKey(STORE_NAME, id);
  return key !== undefined;
}

// ========== Utility Functions ==========

/**
 * Get the maximum allowed file size in bytes
 */
export function getMaxFileSizeBytes(): number {
  return MAX_FILE_SIZE_BYTES;
}

/**
 * Get the maximum allowed file size in MB
 */
export function getMaxFileSizeMB(): number {
  return MAX_FILE_SIZE_MB;
}

/**
 * Validate a file before upload
 *
 * @param file File to validate
 * @returns Validation result with any error message
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds maximum (${MAX_FILE_SIZE_MB}MB)`,
    };
  }

  // Check file type
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    'text/plain', // .txt
    'text/markdown', // .md
    'text/x-markdown', // .md (alternative)
  ];

  const allowedExtensions = ['.pdf', '.docx', '.doc', '.txt', '.md'];

  const hasValidType = allowedTypes.includes(file.type);
  const hasValidExtension = allowedExtensions.some(ext =>
    file.name.toLowerCase().endsWith(ext)
  );

  if (!hasValidType && !hasValidExtension) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: PDF, DOCX, TXT, MD`,
    };
  }

  return { valid: true };
}

/**
 * Extract text from a stored document
 * Uses pdfjs-dist for PDFs and mammoth for DOCX
 *
 * @param id Document ID
 * @returns Extracted text or null if extraction fails
 */
export async function extractTextFromStoredDocument(id: string): Promise<{
  text: string;
  tokenEstimate: number;
  pageCount?: number;
} | null> {
  const db = await initDB();
  const doc = await db.get(STORE_NAME, id);

  if (!doc) {
    console.warn('⚠️ Document not found for text extraction:', id);
    return null;
  }

  const isPDF = doc.mimeType === 'application/pdf' ||
    doc.filename.toLowerCase().endsWith('.pdf');

  const isDOCX = doc.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    doc.filename.toLowerCase().endsWith('.docx');

  try {
    if (isPDF) {
      // Convert ArrayBuffer to base64 and use pdfExtractor
      const bytes = new Uint8Array(doc.data);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const { extractTextFromPDFBase64 } = await import('../documents/pdfExtractor');
      const result = await extractTextFromPDFBase64(base64, doc.filename);

      return {
        text: result.text,
        tokenEstimate: result.tokenEstimate,
        pageCount: result.pageCount,
      };
    }

    if (isDOCX) {
      // Use mammoth for DOCX
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ arrayBuffer: doc.data });
      const tokenEstimate = Math.ceil(result.value.length / 4);

      return {
        text: result.value,
        tokenEstimate,
      };
    }

    // Check for plain text files (.txt, .md)
    const isTextFile = doc.mimeType === 'text/plain' ||
      doc.mimeType === 'text/markdown' ||
      doc.mimeType === 'text/x-markdown' ||
      doc.filename.toLowerCase().endsWith('.txt') ||
      doc.filename.toLowerCase().endsWith('.md');

    if (isTextFile) {
      // Decode ArrayBuffer as UTF-8 text
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(doc.data);
      const tokenEstimate = Math.ceil(text.length / 4);

      return {
        text,
        tokenEstimate,
      };
    }

    console.warn('⚠️ Unsupported document type for text extraction:', doc.mimeType);
    return null;
  } catch (error) {
    console.error('❌ Text extraction failed:', error);
    return null;
  }
}

/**
 * Convert a File object to a storable document
 * Helper for file uploads
 *
 * @param file File from file input
 * @param id Optional custom ID (auto-generated if not provided)
 * @returns Stored document metadata
 */
export async function storeFile(file: File, id?: string): Promise<StoredDocument> {
  // Validate first
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Generate ID if not provided
  const documentId = id || crypto.randomUUID();

  // Determine MIME type (prefer file.type, fallback to extension-based)
  let mimeType = file.type;
  if (!mimeType) {
    const ext = file.name.toLowerCase().split('.').pop();
    switch (ext) {
      case 'pdf':
        mimeType = 'application/pdf';
        break;
      case 'docx':
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      case 'doc':
        mimeType = 'application/msword';
        break;
      default:
        mimeType = 'application/octet-stream';
    }
  }

  return storeDocument(documentId, file, file.name, mimeType);
}
