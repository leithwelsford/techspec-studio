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

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const project = useProjectStore((state) => state.project);
  const docxTemplate = useProjectStore((state) => state.getDocxTemplate());
  const setDocxTemplate = useProjectStore((state) => state.setDocxTemplate);
  const clearDocxTemplate = useProjectStore((state) => state.clearDocxTemplate);

  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState<'docx' | 'diagrams'>('docx');
  const [useTemplate, setUseTemplate] = useState(false);
  const [usePandoc, setUsePandoc] = useState(false);
  const [pandocAvailable, setPandocAvailable] = useState(false);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // DOCX options
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [author, setAuthor] = useState('');
  const [company, setCompany] = useState('');

  // Check Pandoc availability on mount
  useEffect(() => {
    checkPandocService().then(setPandocAvailable);
  }, []);

  // Diagram export options
  const [diagramFormat, setDiagramFormat] = useState<'svg' | 'png'>('png');
  const [selectedDiagrams, setSelectedDiagrams] = useState<string[]>([]);

  if (!isOpen || !project) return null;

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.docx')) {
      alert('Please upload a .docx file');
      return;
    }

    try {
      // Store the File object for Pandoc export
      setTemplateFile(file);

      // Also store as base64 for browser-based export
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        // Remove data URL prefix if present
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        setDocxTemplate(base64Data);
        setUseTemplate(true);
        alert('Template uploaded successfully!');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Template upload error:', error);
      alert(`Failed to upload template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleClearTemplate = () => {
    if (confirm('Remove uploaded template? You can upload a new one anytime.')) {
      clearDocxTemplate();
      setTemplateFile(null);
      setUseTemplate(false);
      setUsePandoc(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExportDocx = async () => {
    if (!project) return;

    setExporting(true);
    try {
      const exportOpts: ExportOptions = {
        ...options,
        author: author || undefined,
        company: company || undefined,
      };

      let blob: Blob;
      const filename = project.specification.title || 'technical-specification';

      // Use Pandoc if enabled and template is uploaded
      if (usePandoc && useTemplate && templateFile) {
        if (!pandocAvailable) {
          throw new Error('Pandoc service is not available. Please start the backend service or uncheck "Use Pandoc".');
        }

        console.log('[Export] Using Pandoc export...');
        blob = await exportWithPandoc(project, templateFile, exportOpts);
        downloadPandocDocx(blob, filename);

      } else if (useTemplate && docxTemplate) {
        // Use browser-based template export
        console.log('[Export] Using browser-based template export...');
        blob = await exportWithTemplate(project, docxTemplate, exportOpts);
        downloadTemplateDocx(blob, filename);

      } else {
        // Use default export
        console.log('[Export] Using default export...');
        blob = await exportToDocx(project, exportOpts);
        downloadDocx(blob, filename);
      }

      alert('Document exported successfully!');
      onClose();
    } catch (error) {
      console.error('Export error:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
  };

  const handleExportDiagrams = async () => {
    if (!project) return;

    setExporting(true);
    try {
      // Determine which diagrams to export
      const blockDiagsToExport = selectedDiagrams.length > 0
        ? project.blockDiagrams.filter(d => selectedDiagrams.includes(d.id))
        : project.blockDiagrams;

      const sequenceDiagsToExport = selectedDiagrams.length > 0
        ? project.sequenceDiagrams.filter(d => selectedDiagrams.includes(d.id))
        : project.sequenceDiagrams;

      const flowDiagsToExport = selectedDiagrams.length > 0
        ? project.flowDiagrams.filter(d => selectedDiagrams.includes(d.id))
        : project.flowDiagrams;

      // Export block diagrams
      for (const diagram of blockDiagsToExport) {
        if (diagramFormat === 'svg') {
          const svg = await exportBlockDiagramAsSVG(diagram);
          downloadSVG(svg, diagram.title);
        } else {
          const png = await exportBlockDiagramAsPNG(diagram);
          downloadPNG(png, diagram.title);
        }
      }

      // Export sequence diagrams
      for (const diagram of sequenceDiagsToExport) {
        if (diagramFormat === 'svg') {
          const svg = await exportMermaidDiagramAsSVG(diagram);
          downloadSVG(svg, diagram.title);
        } else {
          const png = await exportMermaidDiagramAsPNG(diagram);
          downloadPNG(png, diagram.title);
        }
      }

      // Export flow diagrams
      for (const diagram of flowDiagsToExport) {
        if (diagramFormat === 'svg') {
          const svg = await exportMermaidDiagramAsSVG(diagram);
          downloadSVG(svg, diagram.title);
        } else {
          const png = await exportMermaidDiagramAsPNG(diagram);
          downloadPNG(png, diagram.title);
        }
      }

      const totalExported = blockDiagsToExport.length + sequenceDiagsToExport.length + flowDiagsToExport.length;

      alert(`Exported ${totalExported} diagram(s) successfully!`);
      onClose();
    } catch (error) {
      console.error('Diagram export error:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
  };

  const allDiagrams = [
    ...project.blockDiagrams.map(d => ({ id: d.id, title: d.title, type: 'Block' })),
    ...project.sequenceDiagrams.map(d => ({ id: d.id, title: d.title, type: 'Sequence' })),
    ...project.flowDiagrams.map(d => ({ id: d.id, title: d.title, type: 'Flow' })),
  ];

  const toggleDiagram = (id: string) => {
    setSelectedDiagrams(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Export Specification</h2>
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

        {/* Content */}
        <div className="px-6 py-4">
          {/* Export Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Export Type
            </label>
            <div className="flex gap-4">
              <button
                onClick={() => setExportType('docx')}
                className={`flex-1 px-4 py-2 rounded-md border ${
                  exportType === 'docx'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                }`}
              >
                DOCX Document
              </button>
              <button
                onClick={() => setExportType('diagrams')}
                className={`flex-1 px-4 py-2 rounded-md border ${
                  exportType === 'diagrams'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                }`}
              >
                Diagrams Only
              </button>
            </div>
          </div>

          {/* DOCX Options */}
          {exportType === 'docx' && (
            <div className="space-y-4">
              {/* Template Upload Section */}
              <div className="border border-gray-300 dark:border-gray-600 rounded-md p-4 bg-gray-50 dark:bg-gray-800">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  DOCX Template (Optional)
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Upload a .docx template with placeholders like: TITLE, CONTENT, TOC, FIGURES, BIBLIOGRAPHY, AUTHOR, COMPANY, DATE, VERSION (wrapped in double curly braces)
                </p>

                <div className="flex gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx"
                    onChange={handleTemplateUpload}
                    className="hidden"
                    id="template-upload"
                  />
                  <label
                    htmlFor="template-upload"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md cursor-pointer"
                  >
                    {docxTemplate ? 'Replace Template' : 'Upload Template'}
                  </label>

                  {docxTemplate && (
                    <>
                      <button
                        onClick={handleClearTemplate}
                        className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-gray-700 border border-red-300 dark:border-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        Clear Template
                      </button>
                      <span className="flex items-center text-sm text-green-600 dark:text-green-400">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Template loaded
                      </span>
                    </>
                  )}
                </div>

                {docxTemplate && (
                  <div className="mt-3 space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={useTemplate}
                        onChange={(e) => setUseTemplate(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Use uploaded template for export</span>
                    </label>

                    {useTemplate && (
                      <label className="flex items-center gap-2 ml-6">
                        <input
                          type="checkbox"
                          checked={usePandoc}
                          onChange={(e) => setUsePandoc(e.target.checked)}
                          disabled={!pandocAvailable}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Use Pandoc (professional output, preserves all template formatting)
                          {!pandocAvailable && (
                            <span className="ml-2 text-xs text-red-500 dark:text-red-400">
                              ⚠️ Backend service not available
                            </span>
                          )}
                          {pandocAvailable && (
                            <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                              ✓ Service ready
                            </span>
                          )}
                        </span>
                      </label>
                    )}

                    {useTemplate && usePandoc && (
                      <div className="ml-6 mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                        <p className="text-xs text-blue-800 dark:text-blue-300">
                          <strong>Pandoc Mode:</strong> Your template's headers, footers, logos, and styles will be preserved exactly.
                          No placeholder tags needed in the template.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.includeTOC}
                    onChange={(e) => setOptions({ ...options, includeTOC: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Include Table of Contents</span>
                </label>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.includeListOfFigures}
                    onChange={(e) => setOptions({ ...options, includeListOfFigures: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Include List of Figures</span>
                </label>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.includeBibliography}
                    onChange={(e) => setOptions({ ...options, includeBibliography: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Include Bibliography</span>
                </label>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.embedDiagrams}
                    onChange={(e) => setOptions({ ...options, embedDiagrams: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Embed Diagrams (as PNG images)</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Author (optional)
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Company (optional)
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Company name"
                />
              </div>
            </div>
          )}

          {/* Diagram Export Options */}
          {exportType === 'diagrams' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Format
                </label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setDiagramFormat('svg')}
                    className={`flex-1 px-4 py-2 rounded-md border ${
                      diagramFormat === 'svg'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    SVG (Vector)
                  </button>
                  <button
                    onClick={() => setDiagramFormat('png')}
                    className={`flex-1 px-4 py-2 rounded-md border ${
                      diagramFormat === 'png'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    PNG (Raster)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Diagrams ({selectedDiagrams.length} of {allDiagrams.length} selected)
                </label>
                <div className="max-h-60 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md">
                  {allDiagrams.map((diagram) => (
                    <label key={diagram.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <input
                        type="checkbox"
                        checked={selectedDiagrams.includes(diagram.id)}
                        onChange={() => toggleDiagram(diagram.id)}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {diagram.title} <span className="text-gray-500">({diagram.type})</span>
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={() =>
                    setSelectedDiagrams(
                      selectedDiagrams.length === allDiagrams.length ? [] : allDiagrams.map(d => d.id)
                    )
                  }
                  className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {selectedDiagrams.length === allDiagrams.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={exporting}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={exportType === 'docx' ? handleExportDocx : handleExportDiagrams}
            disabled={exporting || (exportType === 'diagrams' && selectedDiagrams.length === 0)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {exporting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Export</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
