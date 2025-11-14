/**
 * Document Diagnostic Tool
 *
 * Checks localStorage and shows document sections
 */

import React, { useEffect, useState } from 'react';

export const DocumentDiagnostic: React.FC = () => {
  const [diagnosticData, setDiagnosticData] = useState<any>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('tech-spec-project');
      if (!stored) {
        setDiagnosticData({ error: 'No data in localStorage' });
        return;
      }

      const parsed = JSON.parse(stored);
      const markdown = parsed.state?.project?.specification?.markdown || '';

      // Extract section headings
      const sections = markdown.match(/^#{1,4}\s+\d+(\.\d+)*\s+.+$/gm) || [];

      setDiagnosticData({
        hasData: true,
        projectName: parsed.state?.project?.name,
        documentLength: markdown.length,
        sectionsCount: sections.length,
        firstSections: sections.slice(0, 15),
        allSections: sections,
        first500Chars: markdown.substring(0, 500),
        snapshotsCount: parsed.state?.project?.versionHistory?.snapshots?.length || 0,
      });
    } catch (error) {
      setDiagnosticData({ error: String(error) });
    }
  }, []);

  if (!diagnosticData) {
    return <div className="p-4">Loading diagnostic...</div>;
  }

  if (diagnosticData.error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded">
        <p className="text-red-800 dark:text-red-200">Error: {diagnosticData.error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg space-y-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Document Diagnostic
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
          <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Project Name</div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">
            {diagnosticData.projectName}
          </div>
        </div>
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded">
          <div className="text-sm text-green-600 dark:text-green-400 mb-1">Document Length</div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">
            {diagnosticData.documentLength.toLocaleString()} chars
          </div>
        </div>
        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded">
          <div className="text-sm text-purple-600 dark:text-purple-400 mb-1">Sections Found</div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">
            {diagnosticData.sectionsCount}
          </div>
        </div>
        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded">
          <div className="text-sm text-orange-600 dark:text-orange-400 mb-1">Version Snapshots</div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">
            {diagnosticData.snapshotsCount}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
          All Sections in Document ({diagnosticData.sectionsCount})
        </h3>
        <div className="bg-gray-50 dark:bg-gray-900 rounded p-4 max-h-96 overflow-y-auto">
          {diagnosticData.allSections.length === 0 ? (
            <p className="text-red-600">⚠️ NO SECTIONS FOUND!</p>
          ) : (
            <ol className="list-decimal list-inside space-y-1 text-sm font-mono">
              {diagnosticData.allSections.map((section: string, idx: number) => (
                <li key={idx} className="text-gray-700 dark:text-gray-300">
                  {section}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
          First 500 Characters
        </h3>
        <pre className="bg-gray-50 dark:bg-gray-900 rounded p-4 text-xs overflow-x-auto text-gray-700 dark:text-gray-300">
          {diagnosticData.first500Chars}
        </pre>
      </div>
    </div>
  );
};

export default DocumentDiagnostic;
