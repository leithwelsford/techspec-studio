/**
 * DiffViewer Component
 *
 * Displays before/after comparison of content (markdown or text)
 * Shows line-by-line changes with color coding:
 * - Red: Removed lines
 * - Green: Added lines
 * - Gray: Unchanged lines
 *
 * Uses the `diff` library for accurate diffing algorithms.
 */

import React, { useMemo } from 'react';
import * as Diff from 'diff';

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  lineNumber?: number;
  originalLineNumber?: number;
}

interface DiffViewerProps {
  original: string;
  modified: string;
  title?: string;
  language?: 'markdown' | 'mermaid' | 'text';
  viewMode?: 'unified' | 'split';
}

/**
 * Compute line-by-line diff using the `diff` library
 * This provides accurate diffing that handles repeated content correctly
 */
function computeLineDiff(original: string, modified: string): DiffLine[] {
  const result: DiffLine[] = [];
  let originalLineNum = 1;
  let modifiedLineNum = 1;

  // Use diff library's line diff algorithm
  const changes = Diff.diffLines(original, modified);

  for (const change of changes) {
    const lines = change.value.split('\n');
    // Remove last empty line if value ends with newline
    if (lines[lines.length - 1] === '') {
      lines.pop();
    }

    for (const line of lines) {
      if (change.added) {
        result.push({
          type: 'added',
          content: line,
          lineNumber: modifiedLineNum++,
        });
      } else if (change.removed) {
        result.push({
          type: 'removed',
          content: line,
          originalLineNumber: originalLineNum++,
        });
      } else {
        // Unchanged
        result.push({
          type: 'unchanged',
          content: line,
          lineNumber: modifiedLineNum++,
          originalLineNumber: originalLineNum++,
        });
      }
    }
  }

  return result;
}

/**
 * Compute diff statistics
 */
function computeStats(diff: DiffLine[]) {
  return {
    added: diff.filter(d => d.type === 'added').length,
    removed: diff.filter(d => d.type === 'removed').length,
    unchanged: diff.filter(d => d.type === 'unchanged').length,
  };
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  original,
  modified,
  title = 'Content Comparison',
  language = 'text',
  viewMode = 'unified',
}) => {
  const diffLines = useMemo(() => computeLineDiff(original, modified), [original, modified]);
  const stats = useMemo(() => computeStats(diffLines), [diffLines]);

  if (viewMode === 'split') {
    // Split view: Original on left, Modified on right
    return (
      <div className="diff-viewer border border-gray-200 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
          <div className="flex gap-4 text-xs text-gray-500 mt-1">
            <span className="text-green-600">+{stats.added} additions</span>
            <span className="text-red-600">-{stats.removed} deletions</span>
            <span>{stats.unchanged} unchanged</span>
          </div>
        </div>

        {/* Split view content */}
        <div className="grid grid-cols-2 divide-x divide-gray-200">
          {/* Original (left) */}
          <div className="bg-gray-50">
            <div className="bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200">
              Original
            </div>
            <div className="font-mono text-xs">
              {diffLines.filter(line => line.type !== 'added').map((line, idx) => (
                <div
                  key={`orig-${idx}`}
                  className={`px-4 py-1 ${
                    line.type === 'removed' ? 'bg-red-50 text-red-800' : 'text-gray-700'
                  }`}
                >
                  <span className="inline-block w-10 text-gray-400 select-none">
                    {line.originalLineNumber}
                  </span>
                  <span className={line.type === 'removed' ? 'line-through' : ''}>
                    {line.content || ' '}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Modified (right) */}
          <div className="bg-white">
            <div className="bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200">
              Modified
            </div>
            <div className="font-mono text-xs">
              {diffLines.filter(line => line.type !== 'removed').map((line, idx) => (
                <div
                  key={`mod-${idx}`}
                  className={`px-4 py-1 ${
                    line.type === 'added' ? 'bg-green-50 text-green-800' : 'text-gray-700'
                  }`}
                >
                  <span className="inline-block w-10 text-gray-400 select-none">
                    {line.lineNumber}
                  </span>
                  <span className={line.type === 'added' ? 'font-semibold' : ''}>
                    {line.content || ' '}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Unified view: Single column with +/- indicators
  return (
    <div className="diff-viewer border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <div className="flex gap-4 text-xs text-gray-500 mt-1">
          <span className="text-green-600">+{stats.added} additions</span>
          <span className="text-red-600">-{stats.removed} deletions</span>
          <span>{stats.unchanged} unchanged</span>
        </div>
      </div>

      {/* Unified view content */}
      <div className="font-mono text-xs bg-white max-h-[500px] overflow-y-auto">
        {diffLines.map((line, idx) => (
          <div
            key={idx}
            className={`px-4 py-1 ${
              line.type === 'added'
                ? 'bg-green-50 text-green-900'
                : line.type === 'removed'
                ? 'bg-red-50 text-red-900'
                : 'bg-white text-gray-700'
            }`}
          >
            <span
              className={`inline-block w-6 mr-2 select-none font-semibold ${
                line.type === 'added'
                  ? 'text-green-600'
                  : line.type === 'removed'
                  ? 'text-red-600'
                  : 'text-gray-400'
              }`}
            >
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
            </span>
            <span className="inline-block w-12 text-gray-400 select-none mr-2">
              {line.type === 'removed' ? line.originalLineNumber : line.lineNumber}
            </span>
            <span className={line.type === 'removed' ? 'line-through opacity-75' : ''}>
              {line.content || ' '}
            </span>
          </div>
        ))}
      </div>

      {/* Footer with legend */}
      <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 flex gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-green-100 border border-green-300 rounded"></span>
          <span>Added</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-red-100 border border-red-300 rounded"></span>
          <span>Removed</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-white border border-gray-300 rounded"></span>
          <span>Unchanged</span>
        </div>
      </div>
    </div>
  );
};

export default DiffViewer;
