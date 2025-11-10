/**
 * BRS Upload Component
 *
 * Handles uploading Business Requirement Specification (BRS) markdown files.
 * Input: .md file (customer PDF already converted to Markdown externally)
 */

import React, { useRef, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import type { BRSMetadata } from '../types';

export function BRSUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [metadata, setMetadata] = useState<BRSMetadata>({});

  const setBRSDocument = useProjectStore((state) => state.setBRSDocument);
  const brsDocument = useProjectStore((state) => state.project?.brsDocument);

  const handleFileSelect = async (file: File) => {
    setError(null);
    setIsUploading(true);

    try {
      // Validate file type
      if (!file.name.endsWith('.md')) {
        throw new Error('Please upload a Markdown (.md) file');
      }

      // Read file content
      const content = await file.text();

      // Extract metadata from frontmatter if present
      const extractedMetadata = extractFrontmatter(content);
      const cleanMarkdown = removeFrontmatter(content);

      // Set preview
      setPreviewContent(cleanMarkdown.substring(0, 1000) + (cleanMarkdown.length > 1000 ? '...' : ''));

      // Populate metadata with defaults
      setMetadata({
        customer: extractedMetadata.customer || '',
        version: extractedMetadata.version || '1.0',
        date: extractedMetadata.date || new Date().toISOString().split('T')[0],
        author: extractedMetadata.author || '',
        projectName: extractedMetadata.projectName || file.name.replace('.md', ''),
        tags: extractedMetadata.tags || [],
      });

      // Store the markdown for later save
      (window as any).__pendingBRS = {
        filename: file.name,
        markdown: cleanMarkdown,
        metadata: metadata,
      };

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file');
      console.error('Error reading BRS file:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleSave = () => {
    const pending = (window as any).__pendingBRS;
    if (!pending) return;

    const title = metadata.projectName || pending.filename.replace('.md', '');

    setBRSDocument({
      title,
      filename: pending.filename,
      markdown: pending.markdown,
      metadata: {
        ...metadata,
        projectName: title,
      },
    });

    // Clear preview
    setPreviewContent('');
    delete (window as any).__pendingBRS;
    setMetadata({});
  };

  const handleClear = () => {
    setPreviewContent('');
    setMetadata({});
    setError(null);
    delete (window as any).__pendingBRS;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Business Requirements Specification</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Upload your BRS markdown file (converted from customer PDF)
        </p>
      </div>

      {/* Current BRS Status */}
      {brsDocument && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-green-900 dark:text-green-300">✓ BRS Loaded</p>
              <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                <strong>{brsDocument.title}</strong>
              </p>
              <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                File: {brsDocument.filename} | Uploaded: {new Date(brsDocument.uploadedAt).toLocaleString()}
              </p>
              {brsDocument.metadata.customer && (
                <p className="text-xs text-green-600 dark:text-green-500">Customer: {brsDocument.metadata.customer}</p>
              )}
            </div>
            <button
              onClick={() => useProjectStore.getState().clearBRSDocument()}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 px-3 py-1 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Upload Area */}
      {!previewContent && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            flex-1 border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
            transition-colors duration-200
            ${isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500'}
          `}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".md"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <svg
            className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {isUploading ? 'Reading file...' : 'Drop your BRS markdown file here'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">or click to browse</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">Accepts .md files only</p>

          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Preview and Metadata Form */}
      {previewContent && (
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Metadata Form */}
          <div className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-3">Document Metadata</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={metadata.projectName || ''}
                  onChange={(e) => setMetadata({ ...metadata, projectName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="e.g., 5G Service Edge Enhancement"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Customer
                </label>
                <input
                  type="text"
                  value={metadata.customer || ''}
                  onChange={(e) => setMetadata({ ...metadata, customer: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="e.g., Acme Telecom"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Version
                </label>
                <input
                  type="text"
                  value={metadata.version || ''}
                  onChange={(e) => setMetadata({ ...metadata, version: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="1.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={metadata.date || ''}
                  onChange={(e) => setMetadata({ ...metadata, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-2">Content Preview</h3>
            <div className="flex-1 overflow-y-auto">
              <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                {previewContent}
              </pre>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={!metadata.projectName}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed font-medium"
            >
              Save BRS Document
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions
function extractFrontmatter(markdown: string): Partial<BRSMetadata> {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = markdown.match(frontmatterRegex);

  if (!match) return {};

  const frontmatter = match[1];
  const metadata: Partial<BRSMetadata> = {};

  // Simple YAML parsing (basic key: value pairs)
  frontmatter.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      const value = valueParts.join(':').trim();
      const cleanKey = key.trim();

      if (cleanKey === 'customer') metadata.customer = value;
      else if (cleanKey === 'version') metadata.version = value;
      else if (cleanKey === 'date') metadata.date = value;
      else if (cleanKey === 'author') metadata.author = value;
      else if (cleanKey === 'project' || cleanKey === 'projectName') metadata.projectName = value;
    }
  });

  return metadata;
}

function removeFrontmatter(markdown: string): string {
  const frontmatterRegex = /^---\n[\s\S]*?\n---\n/;
  return markdown.replace(frontmatterRegex, '').trim();
}
