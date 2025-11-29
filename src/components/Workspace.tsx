import { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import AIConfigPanel from './ai/AIConfigPanel';
import ChatPanel from './ai/ChatPanel';
import ReviewPanel from './ai/ReviewPanel';
import { GenerateSpecModal } from './ai/GenerateSpecModal';
import { GenerateDiagramsModal } from './ai/GenerateDiagramsModal';
import MarkdownEditor from './editors/MarkdownEditor';
import { BRSUpload } from './BRSUpload';
import DiagramViewer from './DiagramViewer';
import ExportModal from './ExportModal';

export default function Workspace() {
  const [showAIConfig, setShowAIConfig] = useState(false);
  const [hasDismissedConfig, setHasDismissedConfig] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showGenerateDiagramsModal, setShowGenerateDiagramsModal] = useState(false);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Use Zustand store for activeTab instead of local state
  const activeTab = useProjectStore((state) => state.activeTab);
  const setActiveTab = useProjectStore((state) => state.setActiveTab);

  const project = useProjectStore((state) => state.project);
  const aiConfig = useProjectStore((state) => state.aiConfig);
  const chatPanelOpen = useProjectStore((state) => state.chatPanelOpen);
  const setChatPanelOpen = useProjectStore((state) => state.setChatPanelOpen);
  const brsDocument = useProjectStore((state) => state.project?.brsDocument);
  const darkMode = useProjectStore((state) => state.darkMode);
  const toggleDarkMode = useProjectStore((state) => state.toggleDarkMode);
  const pendingApprovals = useProjectStore((state) => state.pendingApprovals);
  const resetStore = useProjectStore((state) => state.resetStore);

  // Show AI config on first load if not configured (but allow dismissal)
  const needsConfig = (!aiConfig?.apiKey || !aiConfig.apiKey.trim()) && !hasDismissedConfig;

  const handleClearData = () => {
    if (confirm('⚠️ WARNING: This will permanently delete ALL data including:\n\n• Your project\n• All diagrams\n• Technical specification\n• BRS document\n• AI chat history\n• Version history\n\nThis action CANNOT be undone!\n\nAre you sure you want to continue?')) {
      resetStore();
      alert('✅ All data has been cleared. The page will now reload.');
      window.location.reload();
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {project?.name || 'TechSpec Writer'}
          </h1>
          {project && (
            <span className="text-sm text-gray-500 dark:text-gray-400">v{project.version}</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          {/* AI Status Indicator */}
          {aiConfig?.apiKey && aiConfig.apiKey.trim() ? (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>AI Ready</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              <span>AI Not Configured</span>
            </div>
          )}

          {/* Generate Spec Button */}
          {brsDocument && (
            <button
              onClick={() => setShowGenerateModal(true)}
              disabled={!aiConfig?.apiKey || !aiConfig.apiKey.trim()}
              className={`px-4 py-1.5 text-sm font-medium rounded-md ${
                aiConfig?.apiKey && aiConfig.apiKey.trim()
                  ? 'text-white bg-green-600 hover:bg-green-700'
                  : 'text-gray-400 bg-gray-100 cursor-not-allowed'
              }`}
              title={!aiConfig?.apiKey || !aiConfig.apiKey.trim() ? 'Configure AI first' : 'Generate technical specification from BRS'}
            >
              Generate Spec
            </button>
          )}

          {/* Generate Diagrams Button - requires specification */}
          {project?.specification && project.specification.markdown.trim().length > 0 && (
            <button
              onClick={() => setShowGenerateDiagramsModal(true)}
              disabled={!aiConfig?.apiKey || !aiConfig.apiKey.trim()}
              className={`px-4 py-1.5 text-sm font-medium rounded-md ${
                aiConfig?.apiKey && aiConfig.apiKey.trim()
                  ? 'text-white bg-purple-600 hover:bg-purple-700'
                  : 'text-gray-400 bg-gray-100 cursor-not-allowed'
              }`}
              title={!aiConfig?.apiKey || !aiConfig.apiKey.trim() ? 'Configure AI first' : 'Generate diagrams from Technical Specification'}
            >
              Generate Diagrams
            </button>
          )}

          {/* Export Button - requires specification or diagrams */}
          {project && (
            ((project.specification?.markdown?.trim().length ?? 0) > 0) ||
            ((project.blockDiagrams?.length ?? 0) > 0) ||
            ((project.sequenceDiagrams?.length ?? 0) > 0) ||
            ((project.flowDiagrams?.length ?? 0) > 0)
          ) ? (
            <button
              onClick={() => setShowExportModal(true)}
              className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
              title="Export specification and diagrams"
            >
              Export
            </button>
          ) : null}

          {/* Review Panel Button with Badge */}
          <button
            onClick={() => setShowReviewPanel(true)}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 relative"
          >
            Review
            {pendingApprovals.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {pendingApprovals.length}
              </span>
            )}
          </button>

          {/* AI Config Button */}
          <button
            onClick={() => setShowAIConfig(true)}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            {aiConfig?.apiKey ? 'AI Settings' : 'Setup AI'}
          </button>

          {/* Chat Toggle */}
          <button
            onClick={() => setChatPanelOpen(!chatPanelOpen)}
            disabled={!aiConfig?.apiKey || !aiConfig.apiKey.trim()}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              aiConfig?.apiKey && aiConfig.apiKey.trim()
                ? 'text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600'
                : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 cursor-not-allowed'
            }`}
          >
            {chatPanelOpen ? 'Hide Chat' : 'Show Chat'}
          </button>

          {/* Clear Data Button */}
          <button
            onClick={handleClearData}
            className="px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-400 bg-white dark:bg-gray-700 border border-red-300 dark:border-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
            title="Clear all data and start fresh"
          >
            <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear Data
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {!project ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Welcome to TechSpec Writer
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  AI-powered technical specification authoring
                </p>
                <button
                  onClick={() => {
                    const createProject = useProjectStore.getState().createProject;
                    createProject('My Technical Specification');
                  }}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 font-medium"
                >
                  Create New Project
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Tab Navigation */}
              <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6">
                <nav className="flex space-x-8">
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm relative ${
                      activeTab === 'preview'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    Business Requirements
                    {brsDocument && (
                      <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-green-700 bg-green-100 rounded-full">
                        ✓
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('document')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'document'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    Technical Specification
                  </button>
                  <button
                    onClick={() => setActiveTab('block-diagrams')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      (activeTab === 'block-diagrams' || activeTab === 'sequence-diagrams' || activeTab === 'flow-diagrams')
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    Diagrams
                  </button>
                  <button
                    onClick={() => setActiveTab('references')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'references'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    3GPP References
                  </button>
                </nav>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-hidden">
                {activeTab === 'preview' && <BRSUpload />}
                {activeTab === 'document' && <MarkdownEditor />}
                {(activeTab === 'block-diagrams' || activeTab === 'sequence-diagrams' || activeTab === 'flow-diagrams') && <DiagramViewer />}
                {activeTab === 'references' && (
                  <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                    3GPP reference management coming soon...
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        {/* Chat Panel */}
        {chatPanelOpen && aiConfig?.apiKey && aiConfig.apiKey.trim() && (
          <div className="w-96 border-l border-gray-200 dark:border-gray-700">
            <ChatPanel />
          </div>
        )}
      </div>

      {/* AI Configuration Modal */}
      {(showAIConfig || needsConfig) && (
        <AIConfigPanel onClose={() => {
          setShowAIConfig(false);
          setHasDismissedConfig(true);
        }} />
      )}

      {/* Generate Specification Modal */}
      <GenerateSpecModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
      />

      {/* Generate Diagrams Modal */}
      <GenerateDiagramsModal
        isOpen={showGenerateDiagramsModal}
        onClose={() => setShowGenerateDiagramsModal(false)}
      />

      {/* Review Panel Modal */}
      <ReviewPanel
        isOpen={showReviewPanel}
        onClose={() => setShowReviewPanel(false)}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
    </div>
  );
}
