/**
 * SequenceDiagramEditor Component
 * Mermaid code editor with live preview for sequence diagrams
 */

import { useState, useEffect, useRef } from 'react';
import { useProjectStore } from '../../store/projectStore';
import mermaid from 'mermaid';

interface SequenceDiagramEditorProps {
  diagramId: string;
}

// Common sequence diagram templates for telecom call flows
const TEMPLATES = {
  basicCallFlow: `sequenceDiagram
    participant UE as User Equipment
    participant eNB as eNodeB
    participant MME as MME
    participant SGW as S-GW
    participant PGW as P-GW

    UE->>eNB: Attach Request
    eNB->>MME: Initial UE Message
    MME->>SGW: Create Session Request
    SGW->>PGW: Create Session Request
    PGW-->>SGW: Create Session Response
    SGW-->>MME: Create Session Response
    MME-->>eNB: Initial Context Setup
    eNB-->>UE: Attach Accept`,

  errorHandling: `sequenceDiagram
    participant UE
    participant Network
    participant Server

    UE->>Network: Request
    Network->>Server: Forward Request
    alt Success Case
        Server-->>Network: Success Response
        Network-->>UE: Success
    else Error Case
        Server-->>Network: Error Response
        Network-->>UE: Error
        UE->>Network: Retry Request
    end`,

  authentication: `sequenceDiagram
    participant UE
    participant HSS
    participant MME

    Note over UE,HSS: Authentication Procedure
    UE->>MME: Authentication Request
    MME->>HSS: Authentication Info Request
    HSS-->>MME: Authentication Vectors
    MME-->>UE: Authentication Challenge
    UE->>MME: Authentication Response
    MME->>HSS: Update Location Request
    HSS-->>MME: Update Location Ack`,

  handover: `sequenceDiagram
    participant UE
    participant Source_eNB
    participant Target_eNB
    participant MME

    Source_eNB->>Target_eNB: Handover Request
    Target_eNB-->>Source_eNB: Handover Request Ack
    Source_eNB->>UE: RRC Reconfiguration
    UE->>Target_eNB: RRC Reconfiguration Complete
    Target_eNB->>MME: Path Switch Request
    MME-->>Target_eNB: Path Switch Request Ack`
};

export default function SequenceDiagramEditor({ diagramId }: SequenceDiagramEditorProps) {
  const diagram = useProjectStore(state => {
    const diagrams = [
      ...(state.project?.sequenceDiagrams || []),
      ...(state.project?.flowDiagrams || [])
    ];
    return diagrams.find(d => d.id === diagramId);
  });
  const updateMermaidDiagram = useProjectStore(state => state.updateMermaidDiagram);

  const [code, setCode] = useState(diagram?.mermaidCode || '');
  const [previewSvg, setPreviewSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Debounce timer for live preview
  const debounceTimer = useRef<NodeJS.Timeout>();

  // Initialize code from diagram
  useEffect(() => {
    if (diagram) {
      setCode(diagram.mermaidCode);
      setIsDirty(false);
    }
  }, [diagram?.id]);

  // Live preview with debouncing
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      renderPreview(code);
    }, 500); // 500ms debounce

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [code]);

  const renderPreview = async (mermaidCode: string) => {
    if (!mermaidCode.trim()) {
      setPreviewSvg('');
      setError('');
      return;
    }

    try {
      setError('');
      const uniqueId = `mermaid-preview-${Date.now()}`;
      const { svg } = await mermaid.render(uniqueId, mermaidCode);
      setPreviewSvg(svg);
    } catch (err) {
      console.error('Mermaid rendering error:', err);
      setError(err instanceof Error ? err.message : 'Failed to render diagram');
      setPreviewSvg('');
    }
  };

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    setIsDirty(true);
  };

  const handleSave = () => {
    if (!diagram) return;

    updateMermaidDiagram(diagramId, {
      mermaidCode: code,
      title: diagram.title,
      description: diagram.description,
    });

    setIsDirty(false);
  };

  const handleInsertTemplate = (templateKey: keyof typeof TEMPLATES) => {
    const template = TEMPLATES[templateKey];
    setCode(template);
    setIsDirty(true);
    setShowTemplates(false);

    // Focus textarea after inserting template
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }

    // Tab key: insert 2 spaces instead of changing focus
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newCode = code.substring(0, start) + '  ' + code.substring(end);

      setCode(newCode);
      setIsDirty(true);

      // Set cursor position after the inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  if (!diagram) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800">
        <p>Diagram not found</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {diagram.title}
          </h2>
          {isDirty && (
            <span className="text-xs text-orange-600 dark:text-orange-400">
              • Unsaved changes
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Template dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Templates ▾
            </button>

            {showTemplates && (
              <div className="absolute top-full right-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                <div className="py-1">
                  <button
                    onClick={() => handleInsertTemplate('basicCallFlow')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Basic Call Flow
                  </button>
                  <button
                    onClick={() => handleInsertTemplate('errorHandling')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Error Handling
                  </button>
                  <button
                    onClick={() => handleInsertTemplate('authentication')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Authentication
                  </button>
                  <button
                    onClick={() => handleInsertTemplate('handover')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Handover Procedure
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={!isDirty}
            className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              isDirty
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            Save {isDirty && '(Ctrl+S)'}
          </button>
        </div>
      </div>

      {/* Split pane: Code editor + Preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* Code Editor */}
        <div className="w-1/2 flex flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Mermaid Code
            </span>
          </div>

          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 p-4 font-mono text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 resize-none focus:outline-none"
            placeholder="Enter Mermaid sequence diagram code here..."
            spellCheck={false}
          />

          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex justify-between">
              <span>Syntax: Mermaid sequence diagram</span>
              <span>{code.split('\n').length} lines</span>
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div className="w-1/2 flex flex-col bg-gray-50 dark:bg-gray-900">
          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Live Preview
            </span>
          </div>

          <div className="flex-1 overflow-auto p-6">
            {error ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                      Syntax Error
                    </h3>
                    <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            ) : previewSvg ? (
              <div
                className="flex justify-center items-center"
                dangerouslySetInnerHTML={{ __html: previewSvg }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                <p className="text-center">
                  Enter Mermaid code to see live preview<br />
                  <span className="text-xs">or choose a template to get started</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Help footer */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex justify-between">
          <span>
            Learn more: <a href="https://mermaid.js.org/syntax/sequenceDiagram.html" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Mermaid Sequence Diagram Syntax</a>
          </span>
          <span>
            Press Tab for indent • Ctrl/Cmd+S to save
          </span>
        </div>
      </div>
    </div>
  );
}
