import { useState, useEffect } from 'react';
import Workspace from './components/Workspace';
import LegacyBlockDiagramEditor from './App'; // The existing block diagram editor
import { useProjectStore } from './store/projectStore';

/**
 * AppContainer - Main entry point that routes between:
 * - New AI-powered workspace
 * - Legacy block diagram editor (for reference/migration)
 */
export default function AppContainer() {
  const [mode, setMode] = useState<'workspace' | 'legacy'>('workspace');
  const darkMode = useProjectStore((state) => state.darkMode);

  // Sync dark mode state with DOM
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className="h-screen">
      {mode === 'workspace' ? (
        <>
          <Workspace />
          {/* Debug toggle - remove later */}
          <button
            onClick={() => setMode('legacy')}
            className="fixed bottom-4 left-4 px-3 py-1 text-xs bg-gray-800 text-white rounded shadow-lg hover:bg-gray-700 z-50"
          >
            Switch to Legacy Editor
          </button>
        </>
      ) : (
        <>
          <LegacyBlockDiagramEditor />
          <button
            onClick={() => setMode('workspace')}
            className="fixed bottom-4 left-4 px-3 py-1 text-xs bg-blue-600 text-white rounded shadow-lg hover:bg-blue-700 z-50"
          >
            Switch to New Workspace
          </button>
        </>
      )}
    </div>
  );
}
