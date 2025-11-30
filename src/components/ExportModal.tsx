import { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import { exportToDocx, downloadDocx, type ExportOptions, DEFAULT_EXPORT_OPTIONS } from '../utils/docxExport';
import { exportWithTemplate, downloadTemplateDocx } from '../utils/templateDocxExport';
import { checkPandocService, exportWithPandoc, downloadPandocDocx } from '../utils/pandocExport';
import {
  exportBlockDiagramAsSVG,
  exportBlockDiagramAsPNG,
  exportMermaidDiagramAsSVG,
  exportMermaidDiagramAsPNG,
  downloadSVG,
  downloadPNG,
} from '../utils/diagramExport';
import { templateAnalyzer } from '../services/templateAnalyzer';
import type { DocxTemplateAnalysis } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const project = useProjectStore((state) => state.project);
  const docxTemplate = useProjectStore((state) => state.getDocxTemplate());
  const setDocxTemplate = useProjectStore((state) => state.setDocxTemplate);
  const clearDocxTemplate = useProjectStore((state) => state.clearDocxTemplate);
  const docxTemplateAnalysis = useProjectStore((state) => state.docxTemplateAnalysis);
  const setTemplateAnalysis = useProjectStore((state) => state.setTemplateAnalysis);
  const setMarkdownGuidance = useProjectStore((state) => state.setMarkdownGuidance);
  const clearTemplateAnalysis = useProjectStore((state) => state.clearTemplateAnalysis);

  // Tab state
  const [activeTab, setActiveTab] = useState<'template' | 'export'>('template');

  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'markdown' | 'docx'>('docx');
  const [usePandoc, setUsePandoc] = useState(false);
  const [pandocAvailable, setPandocAvailable] = useState(false);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Template analysis state
  const [analyzingTemplate, setAnalyzingTemplate] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // DOCX options
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);

  // Check Pandoc availability on mount
  useEffect(() => {
    checkPandocService().then(setPandocAvailable);
  }, []);

  if (!isOpen || !project) return null;

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.docx')) {
      alert('Please upload a .docx file');
      return;
    }

    setTemplateFile(file);
    setAnalysisError(null);

    // Auto-analyze on upload
    try {
      setAnalyzingTemplate(true);
      console.log('[Template] Analyzing uploaded template...');

      const analysis = await templateAnalyzer.analyzeTemplate(file);
      setTemplateAnalysis(analysis);

      const guidance = templateAnalyzer.generateMarkdownGuidance(analysis);
      setMarkdownGuidance(guidance);

      console.log('[Template] Analysis complete');

      // Store as base64 for browser-based export
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        setDocxTemplate(base64Data);
      };
      reader.readAsDataURL(file);

    } catch (error) {
      console.error('[Template] Analysis failed:', error);
      setAnalysisError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setAnalyzingTemplate(false);
    }
  };

  const handleClearTemplate = () => {
    if (!confirm('Clear template? This will remove formatting guidance for AI generation.')) {
      return;
    }

    clearDocxTemplate();
    clearTemplateAnalysis();
    setTemplateFile(null);
    setAnalysisError(null);
    setUsePandoc(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    console.log('[Template] Cleared');
  };

  const handleExportDocx = async () => {
    if (!project) return;

    setExporting(true);
    try {
      const exportOpts: ExportOptions = { ...options };
      let blob: Blob;
      const filename = project.specification.title || 'technical-specification';

      // Convert base64 template to File object if using Pandoc and no file uploaded this session
      let templateFileForPandoc: File | null = templateFile;
      if (usePandoc && !templateFile && docxTemplate) {
        console.log('[Export] Converting stored template to File for Pandoc...');
        const binary = atob(docxTemplate);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const templateBlob = new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        templateFileForPandoc = new File([templateBlob], 'template.docx', {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        console.log('[Export] Template File created, size:', templateFileForPandoc.size);
      }

      // Use Pandoc if enabled and template is available (uploaded or from store)
      if (usePandoc && templateFileForPandoc) {
        if (!pandocAvailable) {
          throw new Error('Pandoc service is not available');
        }
        console.log('[Export] Using Pandoc...');
        blob = await exportWithPandoc(project, templateFileForPandoc, exportOpts);
        downloadPandocDocx(blob, filename);

      } else if (docxTemplate) {
        // Use browser-based template export
        console.log('[Export] Using template...');
        blob = await exportWithTemplate(project, docxTemplate, exportOpts);
        downloadTemplateDocx(blob, filename);

      } else {
        // Use default export
        console.log('[Export] Using default...');
        blob = await exportToDocx(project, exportOpts);
        downloadDocx(blob, filename);
      }

      alert('Document exported successfully!');
      onClose();
    } catch (error) {
      console.error('[Export] Failed:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!project) return;

    const markdown = project.specification.markdown;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.specification.title || 'specification'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('Markdown exported successfully!');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Template & Export Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <nav className="flex -mb-px px-6">
            <button
              onClick={() => setActiveTab('template')}
              className={`py-4 px-4 text-sm font-medium border-b-2 flex items-center gap-2 ${
                activeTab === 'template'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <span>📄</span>
              Template Setup
              {docxTemplateAnalysis && (
                <span className="text-green-500 dark:text-green-400">✓</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`py-4 px-4 text-sm font-medium border-b-2 flex items-center gap-2 ${
                activeTab === 'export'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <span>📤</span>
              Export Document
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Template Setup Tab */}
          {activeTab === 'template' && (
            <div className="p-6 space-y-6">
              {/* File Upload Section */}
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 bg-gray-50 dark:bg-gray-900">
                <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2">
                  📄 Upload DOCX Template
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Upload a Word template to guide AI specification formatting and export styling
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx"
                  onChange={handleTemplateUpload}
                  className="block w-full text-sm text-gray-500 dark:text-gray-400
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-medium
                    file:bg-blue-600 file:text-white
                    hover:file:bg-blue-700 file:cursor-pointer"
                />

                {templateFile && (
                  <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Selected:</span> {templateFile.name}
                  </div>
                )}
              </div>

              {/* Analysis Status */}
              {analyzingTemplate && (
                <div className="flex items-center justify-center py-4">
                  <svg className="animate-spin h-5 w-5 mr-2 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-blue-600 dark:text-blue-400">Analyzing template...</span>
                </div>
              )}

              {/* Analysis Error */}
              {analysisError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm text-red-800 dark:text-red-400">
                    <strong>Analysis Error:</strong> {analysisError}
                  </p>
                </div>
              )}

              {/* Analysis Results */}
              {docxTemplateAnalysis && !analyzingTemplate && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <h3 className="font-medium text-green-900 dark:text-green-300 mb-2 flex items-center gap-2">
                    <span>✓</span> Template Analysis Complete
                  </h3>
                  <ul className="text-sm text-green-800 dark:text-green-400 space-y-1">
                    <li>✓ Styles detected: {docxTemplateAnalysis.styles?.length || 0} heading levels</li>
                    <li>✓ Formatting guidance generated for AI</li>
                    <li>✓ Template ready for export</li>
                  </ul>
                </div>
              )}

              {/* Info Box */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-400">
                  <strong>💡 How it works:</strong> The template analysis extracts your organization's
                  style standards and guides the AI to format the specification accordingly. This ensures
                  consistency with your corporate branding and document standards.
                </p>
              </div>

              {/* Actions */}
              {docxTemplateAnalysis && (
                <div className="flex gap-3">
                  <button
                    onClick={handleClearTemplate}
                    className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-gray-800 border border-red-300 dark:border-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Clear Template
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Export Document Tab */}
          {activeTab === 'export' && (
            <div className="p-6 space-y-6">
              {/* Template Status Banner */}
              {docxTemplateAnalysis ? (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <p className="text-sm text-green-800 dark:text-green-400 flex items-center gap-2">
                    <span>✓</span>
                    <span>Template loaded: Export will use your organization's formatting</span>
                  </p>
                </div>
              ) : (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 dark:text-yellow-400">
                    <span>⚠️ No template loaded:</span> Export will use default formatting.{' '}
                    <button
                      onClick={() => setActiveTab('template')}
                      className="underline font-medium hover:no-underline"
                    >
                      Upload template
                    </button>
                  </p>
                </div>
              )}

              {/* Export Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Export Format
                </label>
                <div className="space-y-2">
                  <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value="markdown"
                      checked={exportFormat === 'markdown'}
                      onChange={() => setExportFormat('markdown')}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Markdown (.md)</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Plain text format, version control friendly</div>
                    </div>
                  </label>
                  <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value="docx"
                      checked={exportFormat === 'docx'}
                      onChange={() => setExportFormat('docx')}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Word Document (.docx)</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Professional format with full styling</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* DOCX Export Options */}
              {exportFormat === 'docx' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Options
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={options.includeTOC}
                          onChange={(e) => setOptions({ ...options, includeTOC: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Include Table of Contents</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={options.includeFigureList}
                          onChange={(e) => setOptions({ ...options, includeFigureList: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Include List of Figures</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={options.embedDiagrams}
                          onChange={(e) => setOptions({ ...options, embedDiagrams: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Embed diagrams as images</span>
                      </label>
                      {docxTemplateAnalysis && (
                        <label className={`flex items-center ${!pandocAvailable ? 'opacity-50' : ''}`}>
                          <input
                            type="checkbox"
                            checked={usePandoc}
                            onChange={(e) => setUsePandoc(e.target.checked)}
                            disabled={!pandocAvailable}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            Use Pandoc (professional output, preserves all template formatting)
                            {!pandocAvailable && (
                              <span className="ml-2 text-xs text-red-500">
                                ⚠️ Backend service not available
                              </span>
                            )}
                            {pandocAvailable && (
                              <span className="ml-2 text-xs text-green-500">
                                ✓ Service ready
                              </span>
                            )}
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Export Button */}
              <button
                onClick={exportFormat === 'markdown' ? handleExportMarkdown : handleExportDocx}
                disabled={exporting}
                className="w-full px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {exporting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Exporting...
                  </>
                ) : (
                  <>Export {exportFormat === 'markdown' ? 'Markdown' : 'Word Document'}</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
