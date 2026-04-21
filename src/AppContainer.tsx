import { useEffect } from 'react';
import Workspace from './components/Workspace';
import { useProjectStore } from './store/projectStore';

/**
 * AppContainer - Main entry point that renders the AI-powered workspace.
 */
export default function AppContainer() {
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
      <Workspace />
    </div>
  );
}
