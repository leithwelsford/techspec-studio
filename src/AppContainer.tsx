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
  const availableTemplates = useProjectStore((state) => state.availableTemplates);
  const project = useProjectStore((state) => state.project);
  const setActiveTemplate = useProjectStore((state) => state.setActiveTemplate);

  // Sync dark mode state with DOM
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Initialize built-in templates on first load
  useEffect(() => {
    const initializeTemplates = async () => {
      // Only load if templates haven't been loaded yet
      if (availableTemplates.length === 0) {
        console.log('📚 Loading built-in templates...');
        const { builtInTemplates } = await import('./data/templates');

        // Use the store action which will trigger persistence
        useProjectStore.setState({ availableTemplates: builtInTemplates });

        console.log(`✅ Loaded ${builtInTemplates.length} built-in templates:`,
          builtInTemplates.map(t => t.name));

        // If there's an existing project without a template config, assign default (3GPP)
        if (project && !useProjectStore.getState().activeTemplateConfig) {
          const defaultTemplate = builtInTemplates.find(t => t.id === '3gpp-ts');
          if (defaultTemplate) {
            console.log('🔧 Migrating existing project to default template (3GPP)');
            setActiveTemplate({
              templateId: defaultTemplate.id,
              enabledSections: defaultTemplate.sections.filter(s => s.defaultEnabled).map(s => s.id),
              sectionOrder: defaultTemplate.sections.map(s => s.id),
              customGuidance: ''
            });
          }
        }
      }
    };

    initializeTemplates();
  }, []); // Run only once on mount

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
