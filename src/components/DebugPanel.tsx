/**
 * Temporary Debug Panel - Add to Workspace to diagnose issues
 *
 * Usage in Workspace.tsx:
 * import DebugPanel from './DebugPanel';
 *
 * Then add somewhere visible:
 * <DebugPanel />
 */

import { useProjectStore } from '../store/projectStore';

export default function DebugPanel() {
  const project = useProjectStore((state) => state.project);
  const pendingApprovals = useProjectStore((state) => state.pendingApprovals);
  const aiConfig = useProjectStore((state) => state.aiConfig);
  const versionHistory = useProjectStore((state) => state.versionHistory);

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-100 border-2 border-yellow-500 rounded-lg p-4 max-w-md shadow-lg z-50">
      <h3 className="font-bold text-yellow-900 mb-2">🐛 Debug Info</h3>

      <div className="text-xs space-y-2 text-yellow-900">
        <div>
          <strong>Project:</strong> {project ? '✅ Loaded' : '❌ No Project'}
        </div>

        {project && (
          <>
            <div>
              <strong>Project Name:</strong> {project.name}
            </div>

            <div>
              <strong>Spec Length:</strong> {project.specification.markdown.length} chars
            </div>

            <div>
              <strong>First 100 chars:</strong>
              <pre className="mt-1 p-2 bg-yellow-50 rounded text-xs overflow-auto max-h-20">
                {project.specification.markdown.substring(0, 100)}...
              </pre>
            </div>

            <div>
              <strong>Block Diagrams:</strong> {project.blockDiagrams.length}
            </div>

            <div>
              <strong>Sequence Diagrams:</strong> {project.sequenceDiagrams.length}
            </div>

            <div>
              <strong>BRS Document:</strong> {project.brsDocument ? '✅ Loaded' : '❌ None'}
            </div>
          </>
        )}

        <div>
          <strong>AI Config:</strong> {aiConfig?.apiKey ? '✅ Configured' : '❌ Not Set'}
        </div>

        <div className="border-t border-yellow-400 pt-2 mt-2">
          <strong>Pending Approvals:</strong> {pendingApprovals.length}
          {pendingApprovals.length > 0 && (
            <ul className="ml-4 mt-1">
              {pendingApprovals.map((approval) => (
                <li key={approval.id}>
                  • {approval.type} (ID: {approval.id.substring(0, 8)})
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <strong>Version Snapshots:</strong> {versionHistory.snapshots.length}
        </div>

        <div className="border-t border-yellow-400 pt-2 mt-2">
          <strong>LocalStorage Size:</strong>
          {(() => {
            try {
              const data = localStorage.getItem('tech-spec-project');
              return data ? `${(data.length / 1024).toFixed(2)} KB` : 'Empty';
            } catch {
              return 'Error reading';
            }
          })()}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => {
            console.log('=== FULL STORE STATE ===');
            console.log(useProjectStore.getState());
          }}
          className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
        >
          Log to Console
        </button>

        <button
          onClick={() => {
            if (confirm('Clear all data and reload?')) {
              localStorage.clear();
              window.location.reload();
            }
          }}
          className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
        >
          Reset All
        </button>
      </div>
    </div>
  );
}
