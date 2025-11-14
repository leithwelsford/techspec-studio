/**
 * Version History Debug Panel
 *
 * Allows viewing and restoring from version snapshots
 */

import React from 'react';
import { useProjectStore } from '../store/projectStore';

export const VersionHistoryDebug: React.FC = () => {
  const project = useProjectStore(state => state.project);
  const restoreSnapshot = useProjectStore(state => state.restoreSnapshot);
  const getAllSnapshots = useProjectStore(state => state.getAllSnapshots);

  // Debug log to see what's in the store
  console.log('🔍 Store State Check:', {
    hasProject: !!project,
    projectName: project?.name,
    specLength: project?.specification?.markdown?.length || 0,
  });

  if (!project) {
    return (
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No project loaded.</p>
          <p className="text-sm text-gray-400">
            This shouldn't happen if you can see documents in other tabs.
            Check the browser console for debug info.
          </p>
        </div>
      </div>
    );
  }

  // Safely get snapshots and version history
  const snapshots = getAllSnapshots() || [];
  const currentDoc = project.specification?.markdown || '';
  const versionHistory = project.versionHistory || { snapshots: [], currentSnapshotId: null };

  console.log('🕒 Version History Debug:', {
    snapshotsCount: snapshots.length,
    currentDocLength: currentDoc.length,
    currentSnapshotId: versionHistory?.currentSnapshotId || null
  });

  const handleRestore = (snapshotId: string) => {
    if (confirm('Restore this version? Current changes will be saved as a new snapshot.')) {
      restoreSnapshot(snapshotId);
      alert('Version restored successfully!');
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Version History Debug
      </h2>

      {/* Current Document Info */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Current Document</h3>
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <div>Length: {currentDoc.length.toLocaleString()} characters</div>
          <div>Sections: {(currentDoc.match(/^#{2,4}\s+\d+/gm) || []).length}</div>
          <div>
            First sections: {currentDoc.length > 0 ? (currentDoc.match(/^#{2,4}\s+\d+[^\n]*/gm) || []).slice(0, 5).join(', ') : 'No content'}
          </div>
        </div>
      </div>

      {/* Snapshots List */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Available Snapshots ({snapshots.length})
        </h3>
        {snapshots.length === 0 ? (
          <p className="text-gray-500 text-sm">No snapshots available</p>
        ) : (
          snapshots.reverse().map((snapshot, index) => {
            const docLength = snapshot.projectState?.specification?.markdown?.length || 0;
            const sections = (snapshot.projectState?.specification?.markdown?.match(/^#{2,4}\s+\d+/gm) || []).length;
            const isCurrent = snapshot.id === versionHistory.currentSnapshotId;

            return (
              <div
                key={snapshot.id}
                className={`p-4 border rounded-lg ${
                  isCurrent
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-500">
                        #{snapshots.length - index}
                      </span>
                      {isCurrent && (
                        <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded">
                          CURRENT
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                        {snapshot.author}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 rounded">
                        {snapshot.changeType}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {snapshot.description}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                      <div>{new Date(snapshot.timestamp).toLocaleString()}</div>
                      <div>
                        Document: {docLength.toLocaleString()} chars, {sections} sections
                      </div>
                      {snapshot.metadata.tokensUsed && (
                        <div>
                          Tokens: {snapshot.metadata.tokensUsed.toLocaleString()}
                          {snapshot.metadata.costIncurred && (
                            <> (${snapshot.metadata.costIncurred.toFixed(3)})</>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {!isCurrent && (
                    <button
                      onClick={() => handleRestore(snapshot.id)}
                      className="ml-4 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
                    >
                      Restore
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default VersionHistoryDebug;
