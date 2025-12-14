/**
 * Reference Document Upload Component
 *
 * Provides drag-and-drop PDF upload for reference documents.
 * Features:
 * - Drag-and-drop or click to upload
 * - File size validation (max 20MB)
 * - Multiple file support
 * - Upload progress indicator
 * - Token estimate display per document
 * - Remove document button
 */

import { useState, useRef, useCallback } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { validateFile, getMaxFileSizeMB } from '../../services/storage/documentStorage';
import { estimatePDFTokensFromSize, estimateDOCXTokensFromSize, formatTokenCount } from '../../services/ai/tokenCounter';
import type { ReferenceDocument } from '../../types';

interface ReferenceDocumentUploadProps {
  maxFiles?: number;
  onUploadComplete?: (documentId: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

export function ReferenceDocumentUpload({
  maxFiles = 5,
  onUploadComplete,
  onError,
  disabled = false,
}: ReferenceDocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const project = useProjectStore(state => state.project);
  const addPDFReference = useProjectStore(state => state.addPDFReference);
  const removePDFReference = useProjectStore(state => state.removePDFReference);

  // Get current PDF references
  const pdfReferences = project?.references.filter(
    r => r.dataRef && (r.type === 'PDF' || r.type === 'DOCX')
  ) || [];

  const canUploadMore = pdfReferences.length < maxFiles;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && canUploadMore) {
      setIsDragging(true);
    }
  }, [disabled, canUploadMore]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || !canUploadMore) return;

    const files = Array.from(e.dataTransfer.files);
    await handleFiles(files);
  }, [disabled, canUploadMore]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    await handleFiles(files);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setUploadError(null);
    setIsUploading(true);

    // Limit to remaining slots
    const remainingSlots = maxFiles - pdfReferences.length;
    const filesToUpload = files.slice(0, remainingSlots);

    try {
      for (const file of filesToUpload) {
        // Validate file
        const validation = validateFile(file);
        if (!validation.valid) {
          setUploadError(validation.error || 'Invalid file');
          onError?.(validation.error || 'Invalid file');
          continue;
        }

        // Upload file
        const documentId = await addPDFReference(file);
        onUploadComplete?.(documentId);
      }

      if (filesToUpload.length < files.length) {
        setUploadError(`Only ${filesToUpload.length} of ${files.length} files uploaded (max ${maxFiles} files)`);
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to upload file';
      setUploadError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removePDFReference(id);
    } catch (error: any) {
      setUploadError(error.message || 'Failed to remove document');
    }
  };

  const handleClick = () => {
    if (!disabled && canUploadMore && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-3">
      {/* Upload Area */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-4 text-center cursor-pointer
          transition-colors duration-200
          ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'}
          ${disabled || !canUploadMore ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || !canUploadMore}
        />

        {isUploading ? (
          <div className="flex items-center justify-center gap-2 py-2">
            <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm text-gray-600 dark:text-gray-300">Uploading...</span>
          </div>
        ) : (
          <div className="py-2">
            <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {canUploadMore ? (
                <>
                  <span className="font-medium text-blue-600 dark:text-blue-400">Click to upload</span>
                  {' '}or drag and drop
                </>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">Maximum files reached ({maxFiles})</span>
              )}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              PDF or DOCX up to {getMaxFileSizeMB()}MB
            </p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {uploadError && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
          {uploadError}
        </div>
      )}

      {/* Uploaded Documents List */}
      {pdfReferences.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Reference Documents ({pdfReferences.length}/{maxFiles})
          </p>
          <ul className="space-y-2">
            {pdfReferences.map((ref) => (
              <DocumentItem
                key={ref.id}
                document={ref}
                onRemove={() => handleRemove(ref.id)}
                disabled={disabled}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ========== Document Item Component ==========

interface DocumentItemProps {
  document: ReferenceDocument;
  onRemove: () => void;
  disabled?: boolean;
}

function DocumentItem({ document, onRemove, disabled }: DocumentItemProps) {
  const [isRemoving, setIsRemoving] = useState(false);

  // Estimate tokens from file size if not already stored
  // Use appropriate estimation based on file type
  const tokenInfo = document.tokenEstimate
    ? { estimatedTokens: document.tokenEstimate, confidence: 'stored' as const }
    : document.size
      ? (document.type === 'DOCX'
          ? estimateDOCXTokensFromSize(document.size)
          : estimatePDFTokensFromSize(document.size))
      : { estimatedTokens: 0, confidence: 'low' as const };

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await onRemove();
    } finally {
      setIsRemoving(false);
    }
  };

  const formatFileSize = (bytes: number | undefined): string => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type === 'PDF') {
      return (
        <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    }
    return (
      <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
    );
  };

  return (
    <li className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {getFileIcon(document.type)}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {document.filename || document.title}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{formatFileSize(document.size)}</span>
            <span>•</span>
            <span title={`Token estimate (${tokenInfo.confidence} confidence)`}>
              ~{formatTokenCount(tokenInfo.estimatedTokens)} tokens
            </span>
          </div>
        </div>
      </div>
      <button
        onClick={handleRemove}
        disabled={disabled || isRemoving}
        className={`
          ml-2 p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50
          dark:hover:text-red-400 dark:hover:bg-red-900/20
          transition-colors duration-200
          ${(disabled || isRemoving) ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        title="Remove document"
      >
        {isRemoving ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </button>
    </li>
  );
}

export default ReferenceDocumentUpload;
