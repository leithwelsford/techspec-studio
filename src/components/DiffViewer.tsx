/**
 * DiffViewer Component
 *
 * Displays before/after comparison of content (markdown or text)
 * Shows line-by-line changes with color coding:
 * - Red: Removed lines
 * - Green: Added lines
 * - Gray: Unchanged lines
 */

import React, { useMemo } from 'react';

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
 * Simple line-by-line diff algorithm
 * For Phase 2C - basic implementation. Can be replaced with more sophisticated
 * libraries like `diff` or `react-diff-viewer-continued` in future phases.
 */
function computeLineDiff(original: string, modified: string): DiffLine[] {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  const result: DiffLine[] = [];

  // Simple LCS-based diff (Longest Common Subsequence approach)
  // This is a basic implementation - for production, consider using `diff` library

  const lcs = getLCS(originalLines, modifiedLines);
  let origIdx = 0;
  let modIdx = 0;
  let lcsIdx = 0;

  while (origIdx < originalLines.length || modIdx < modifiedLines.length) {
    if (lcsIdx < lcs.length && origIdx < originalLines.length && originalLines[origIdx] === lcs[lcsIdx]) {
      // Line is unchanged
      result.push({
        type: 'unchanged',
        content: originalLines[origIdx],
        lineNumber: modIdx + 1,
        originalLineNumber: origIdx + 1,
      });
      origIdx++;
      modIdx++;
      lcsIdx++;
    } else if (origIdx < originalLines.length && (lcsIdx >= lcs.length || originalLines[origIdx] !== lcs[lcsIdx])) {
      // Line was removed
      result.push({
        type: 'removed',
        content: originalLines[origIdx],
        originalLineNumber: origIdx + 1,
      });
      origIdx++;
    } else {
      // Line was added
      result.push({
        type: 'added',
        content: modifiedLines[modIdx],
        lineNumber: modIdx + 1,
      });
      modIdx++;
    }
  }

  return result;
}

/**
 * Longest Common Subsequence (LCS) for diff computation
 */
function getLCS(arr1: string[], arr2: string[]): string[] {
  const m = arr1.length;
  const n = arr2.length;
  const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const lcs: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (arr1[i - 1] === arr2[j - 1]) {
      lcs.unshift(arr1[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
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
