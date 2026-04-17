import { useState, useRef, useEffect } from 'react';
import PizZip from 'pizzip';
import { useProjectStore } from '../store/projectStore';
import { exportToDocx, downloadDocx, type ExportOptions, DEFAULT_EXPORT_OPTIONS } from '../utils/docxExport';
import { exportWithTemplate, downloadTemplateDocx } from '../utils/templateDocxExport';
import { checkPandocService, exportWithPandoc, downloadPandocDocx } from '../utils/pandocExport';
import {
  generateReferencedDiagramImages,
  transformMarkdownWithImages,
} from '../utils/diagramImageExporter';
import { templateAnalyzer } from '../services/templateAnalyzer';
import DocumentMetadataEditor, { type LogoCandidate } from './DocumentMetadataEditor';

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
  const markdownGuidance = useProjectStore((state) => state.markdownGuidance);
  const clearTemplateAnalysis = useProjectStore((state) => state.clearTemplateAnalysis);

  // Tab state
  const [activeTab, setActiveTab] = useState<'template' | 'metadata' | 'export'>('template');

  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'markdown' | 'docx'>('docx');
  const [usePandoc, setUsePandoc] = useState(false);
  const [pandocAvailable, setPandocAvailable] = useState(false);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [includeImagesInMarkdown, setIncludeImagesInMarkdown] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Template analysis state
  const [analyzingTemplate, setAnalyzingTemplate] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [showAllStyles, setShowAllStyles] = useState(false);

  // Logo extraction state
  const [logoCandidates, setLogoCandidates] = useState<LogoCandidate[]>([]);
  const [vendorLogoFilename, setVendorLogoFilename] = useState<string | undefined>();
  const [customerLogoFilename, setCustomerLogoFilename] = useState<string | undefined>();
  // Logo binary data for export (kept in memory, not IndexedDB, for simplicity)
  const [logoBlobs, setLogoBlobs] = useState<Map<string, Blob>>(new Map());

  // Front matter options
  const [includeCoverPage, setIncludeCoverPage] = useState(true);
  const [includeDocControl, setIncludeDocControl] = useState(true);
  // Table style override (user-selected from template's table styles)
  const [selectedTableStyle, setSelectedTableStyle] = useState<string>('');
  // Paragraph style for table cell contents
  const [cellParagraphStyle, setCellParagraphStyle] = useState<string>('');
  // List style overrides (user-specified template style names)
  const [bulletListStyle, setBulletListStyle] = useState<string>('');
  const [numberedListStyle, setNumberedListStyle] = useState<string>('');

  // DOCX options
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  // Numbering mode: 'template' strips manual numbers (for templates with auto-numbering),
  // 'markdown' keeps manual numbers (for templates without auto-numbering)
  const [numberingMode, setNumberingMode] = useState<'template' | 'markdown'>('template');

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

      // Auto-populate cell paragraph style from detected template usage
      const detectedCellStyle = analysis.documentStructure?.detectedCellParagraphStyle;
      if (detectedCellStyle && !cellParagraphStyle) {
        setCellParagraphStyle(detectedCellStyle);
        console.log(`[Template] Auto-selected cell paragraph style: "${detectedCellStyle}"`);
      }

      // Auto-populate list styles — prefer document-usage detection over regex role map
      const detectedBullet = analysis.documentStructure?.detectedBulletListStyle
        || guidance.pandocStyleRoleMap?.listBullet;
      if (detectedBullet && !bulletListStyle) {
        setBulletListStyle(detectedBullet);
        console.log(`[Template] Auto-selected bullet list style: "${detectedBullet}"`);
      }
      const detectedNumber = analysis.documentStructure?.detectedNumberedListStyle
        || guidance.pandocStyleRoleMap?.listNumber;
      if (detectedNumber && !numberedListStyle) {
        setNumberedListStyle(detectedNumber);
        console.log(`[Template] Auto-selected numbered list style: "${detectedNumber}"`);
      }

      console.log('[Template] Analysis complete');

      // Extract logos from template
      try {
        const rawLogos = await templateAnalyzer.extractLogos(file);
        const candidates: LogoCandidate[] = rawLogos.map(logo => {
          const blob = new Blob([new Uint8Array(logo.data)], { type: logo.mimeType });
          const dataUrl = URL.createObjectURL(blob);
          return { filename: logo.filename, mimeType: logo.mimeType, dataUrl, size: logo.size };
        });
        setLogoCandidates(candidates);

        // Store blobs for export
        const blobMap = new Map<string, Blob>();
        rawLogos.forEach(logo => {
          blobMap.set(logo.filename, new Blob([new Uint8Array(logo.data)], { type: logo.mimeType }));
        });
        setLogoBlobs(blobMap);

        // Auto-assign: largest image as vendor logo, second as customer logo
        if (candidates.length >= 1) setVendorLogoFilename(candidates[0].filename);
        if (candidates.length >= 2) setCustomerLogoFilename(candidates[1].filename);
        console.log(`[Template] Extracted ${candidates.length} logo candidate(s)`);
      } catch (logoErr) {
        console.warn('[Template] Logo extraction failed:', logoErr);
      }

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
    setLogoCandidates([]);
    setVendorLogoFilename(undefined);
    setCustomerLogoFilename(undefined);
    setLogoBlobs(new Map());
    setCellParagraphStyle('');
    setSelectedTableStyle('');
    setBulletListStyle('');
    setNumberedListStyle('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    console.log('[Template] Cleared');
  };

  const handleExportDocx = async () => {
    if (!project) return;

    setExporting(true);
    try {
      // Include numberingMode in export options for all export paths
      const exportOpts: ExportOptions = { ...options, numberingMode };
      console.log('[Export] Export options:', exportOpts);
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

        // Build logo blobs array for front matter
        const exportLogoBlobs: Array<{ filename: string; blob: Blob }> = [];
        if (vendorLogoFilename && logoBlobs.has(vendorLogoFilename)) {
          exportLogoBlobs.push({ filename: vendorLogoFilename, blob: logoBlobs.get(vendorLogoFilename)! });
        }
        if (customerLogoFilename && logoBlobs.has(customerLogoFilename)) {
          exportLogoBlobs.push({ filename: customerLogoFilename, blob: logoBlobs.get(customerLogoFilename)! });
        }

        // Pass pandocStyles from template analysis for custom style mapping
        // Override table style if user selected one
        const roleMap = { ...markdownGuidance?.pandocStyleRoleMap };
        if (selectedTableStyle) {
          // Resolve display name to XML styleId if we have the mapping
          const styleIdMap = docxTemplateAnalysis?.specialStyles?.tableStyles?.styleIdMap;
          roleMap.tableStyle = styleIdMap?.[selectedTableStyle] || selectedTableStyle;
        }
        if (bulletListStyle) {
          roleMap.listBullet = bulletListStyle;
        }
        if (numberedListStyle) {
          roleMap.listNumber = numberedListStyle;
        }
        const pandocExportOpts = {
          ...exportOpts,
          pandocStyles: markdownGuidance?.pandocStyles,
          pandocStyleRoleMap: roleMap,
          numberingMode,
          includeCoverPage,
          includeDocControl,
          vendorLogoFilename,
          customerLogoFilename,
          logoBlobs: exportLogoBlobs,
          cellParagraphStyle: cellParagraphStyle || undefined,
          bulletListStyle: bulletListStyle || undefined,
          numberedListStyle: numberedListStyle || undefined,
        };
        console.log('[Export] Pandoc styles:', markdownGuidance?.pandocStyles);
        console.log('[Export] Numbering mode:', numberingMode);
        console.log('[Export] Front matter:', { includeCoverPage, includeDocControl, vendorLogoFilename, customerLogoFilename });

        blob = await exportWithPandoc(project, templateFileForPandoc, pandocExportOpts);
        downloadPandocDocx(blob, filename);

      } else if (docxTemplate && docxTemplateAnalysis) {
        // Use browser-based template export with detected styles
        console.log('[Export] Using browser-based template export...');
        blob = await exportWithTemplate(project, docxTemplate, exportOpts, docxTemplateAnalysis);
        downloadTemplateDocx(blob, filename);

      } else {
        // Use default export (no template)
        console.log('[Export] Using default export (no template)...');
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

  const handleExportMarkdown = async () => {
    if (!project) return;

    setExporting(true);
    try {
      const filename = project.specification.title || 'specification';

      if (includeImagesInMarkdown) {
        // Export as ZIP with markdown + images folder
        console.log('[Export] Generating markdown with images...');
        const images = await generateReferencedDiagramImages(project);

        if (images.length > 0) {
          // Transform markdown to use image references
          const markdownWithImages = transformMarkdownWithImages(
            project.specification.markdown,
            images,
            'images/'
          );

          // Create ZIP file
          const zip = new PizZip();
          zip.file('specification.md', markdownWithImages);

          // Add images folder
          const imagesFolder = zip.folder('images');
          if (imagesFolder) {
            for (const img of images) {
              const arrayBuffer = await img.blob.arrayBuffer();
              imagesFolder.file(img.filename, new Uint8Array(arrayBuffer));
            }
          }

          // Generate and download ZIP
          const content = zip.generate({ type: 'blob' });
          const url = URL.createObjectURL(content);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${filename}-with-diagrams.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          alert(`Exported markdown with ${images.length} diagram image(s) as ZIP!`);
        } else {
          // No images found, export plain markdown
          const blob = new Blob([project.specification.markdown], { type: 'text/markdown' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${filename}.md`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          alert('Markdown exported (no diagrams to include)');
        }
      } else {
        // Export plain markdown
        const blob = new Blob([project.specification.markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert('Markdown exported successfully!');
      }

      onClose();
    } catch (error) {
      console.error('[Export] Markdown export failed:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
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
              onClick={() => setActiveTab('metadata')}
              className={`py-4 px-4 text-sm font-medium border-b-2 flex items-center gap-2 ${
                activeTab === 'metadata'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <span>📋</span>
              Document Info
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
                  <h3 className="font-medium text-green-900 dark:text-green-300 mb-3 flex items-center gap-2">
                    <span>✓</span> Template Analysis Complete
                  </h3>

                  {/* Style Mapping Table */}
                  <div className="mb-3">
                    <div className="text-sm font-medium text-green-900 dark:text-green-300 mb-2">Style Mapping</div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-green-700 dark:text-green-400 border-b border-green-200 dark:border-green-700">
                          <th className="pb-1 pr-2 font-medium">Spec Element</th>
                          <th className="pb-1 pr-2 font-medium">Template Style</th>
                          <th className="pb-1 font-medium">Method</th>
                        </tr>
                      </thead>
                      <tbody className="text-green-800 dark:text-green-400">
                        {/* Headings */}
                        {docxTemplateAnalysis.headingStyles?.slice(0, 4).map((h, i) => (
                          <tr key={`h-${i}`} className="border-b border-green-100 dark:border-green-800/50">
                            <td className="py-0.5 pr-2">Heading {h.level}</td>
                            <td className="py-0.5 pr-2 font-mono">{h.styleId}</td>
                            <td className="py-0.5 text-green-600 dark:text-green-500">auto</td>
                          </tr>
                        ))}
                        {(docxTemplateAnalysis.headingStyles?.length || 0) > 4 && (
                          <tr className="border-b border-green-100 dark:border-green-800/50">
                            <td className="py-0.5 pr-2 text-green-600 dark:text-green-500" colSpan={3}>
                              +{(docxTemplateAnalysis.headingStyles?.length || 0) - 4} more heading levels
                            </td>
                          </tr>
                        )}

                        {/* Content styles from pandocStyles */}
                        {markdownGuidance?.pandocStyles?.figureCaption && (
                          <tr className="border-b border-green-100 dark:border-green-800/50">
                            <td className="py-0.5 pr-2">Figure captions</td>
                            <td className="py-0.5 pr-2 font-mono">{markdownGuidance.pandocStyles.figureCaption}</td>
                            <td className="py-0.5 text-green-600 dark:text-green-500">custom-style</td>
                          </tr>
                        )}
                        {markdownGuidance?.pandocStyles?.tableCaption && markdownGuidance.pandocStyles.tableCaption !== markdownGuidance.pandocStyles.figureCaption && (
                          <tr className="border-b border-green-100 dark:border-green-800/50">
                            <td className="py-0.5 pr-2">Table captions</td>
                            <td className="py-0.5 pr-2 font-mono">{markdownGuidance.pandocStyles.tableCaption}</td>
                            <td className="py-0.5 text-green-600 dark:text-green-500">custom-style</td>
                          </tr>
                        )}
                        {markdownGuidance?.pandocStyles?.codeStyle && (
                          <tr className="border-b border-green-100 dark:border-green-800/50">
                            <td className="py-0.5 pr-2">Code blocks</td>
                            <td className="py-0.5 pr-2 font-mono">{markdownGuidance.pandocStyles.codeStyle}</td>
                            <td className="py-0.5 text-green-600 dark:text-green-500">custom-style</td>
                          </tr>
                        )}
                        {markdownGuidance?.pandocStyles?.quoteStyle && (
                          <tr className="border-b border-green-100 dark:border-green-800/50">
                            <td className="py-0.5 pr-2">Blockquotes</td>
                            <td className="py-0.5 pr-2 font-mono">{markdownGuidance.pandocStyles.quoteStyle}</td>
                            <td className="py-0.5 text-green-600 dark:text-green-500">custom-style</td>
                          </tr>
                        )}
                        {markdownGuidance?.pandocStyles?.noteStyle && (
                          <tr className="border-b border-green-100 dark:border-green-800/50">
                            <td className="py-0.5 pr-2">Notes</td>
                            <td className="py-0.5 pr-2 font-mono">{markdownGuidance.pandocStyles.noteStyle}</td>
                            <td className="py-0.5 text-green-600 dark:text-green-500">custom-style</td>
                          </tr>
                        )}
                        {markdownGuidance?.pandocStyles?.warningStyle && (
                          <tr className="border-b border-green-100 dark:border-green-800/50">
                            <td className="py-0.5 pr-2">Warnings</td>
                            <td className="py-0.5 pr-2 font-mono">{markdownGuidance.pandocStyles.warningStyle}</td>
                            <td className="py-0.5 text-green-600 dark:text-green-500">custom-style</td>
                          </tr>
                        )}

                        {/* Lua filter remappings */}
                        {markdownGuidance?.pandocStyleRoleMap?.listBullet && (
                          <tr className="border-b border-green-100 dark:border-green-800/50">
                            <td className="py-0.5 pr-2">Bullet lists</td>
                            <td className="py-0.5 pr-2 font-mono">{markdownGuidance.pandocStyleRoleMap.listBullet}</td>
                            <td className="py-0.5 text-blue-600 dark:text-blue-400">lua filter</td>
                          </tr>
                        )}
                        {markdownGuidance?.pandocStyleRoleMap?.listNumber && (
                          <tr className="border-b border-green-100 dark:border-green-800/50">
                            <td className="py-0.5 pr-2">Numbered lists</td>
                            <td className="py-0.5 pr-2 font-mono">{markdownGuidance.pandocStyleRoleMap.listNumber}</td>
                            <td className="py-0.5 text-blue-600 dark:text-blue-400">lua filter</td>
                          </tr>
                        )}
                        {markdownGuidance?.pandocStyleRoleMap?.tableStyle && (
                          <tr className="border-b border-green-100 dark:border-green-800/50">
                            <td className="py-0.5 pr-2">Tables</td>
                            <td className="py-0.5 pr-2 font-mono">{markdownGuidance.pandocStyleRoleMap.tableStyle}</td>
                            <td className="py-0.5 text-blue-600 dark:text-blue-400">lua filter</td>
                          </tr>
                        )}
                        {markdownGuidance?.pandocStyleRoleMap?.bodyText && (
                          <tr className="border-b border-green-100 dark:border-green-800/50">
                            <td className="py-0.5 pr-2">Body text</td>
                            <td className="py-0.5 pr-2 font-mono">{markdownGuidance.pandocStyleRoleMap.bodyText}</td>
                            <td className="py-0.5 text-blue-600 dark:text-blue-400">lua filter</td>
                          </tr>
                        )}
                        {markdownGuidance?.pandocStyleRoleMap?.sourceCode && (
                          <tr className="border-b border-green-100 dark:border-green-800/50">
                            <td className="py-0.5 pr-2">Source code</td>
                            <td className="py-0.5 pr-2 font-mono">{markdownGuidance.pandocStyleRoleMap.sourceCode}</td>
                            <td className="py-0.5 text-blue-600 dark:text-blue-400">lua filter</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Status Summary */}
                  <div className="text-xs text-green-700 dark:text-green-400 pt-2 border-t border-green-200 dark:border-green-700 flex flex-wrap gap-x-2">
                    <span>✓ {docxTemplateAnalysis.headingStyles?.length || 0} heading levels</span>
                    <span>•</span>
                    <span>✓ {docxTemplateAnalysis.paragraphStyles?.length || 0} paragraph styles</span>
                    <span>•</span>
                    <span>✓ {docxTemplateAnalysis.specialStyles?.tableStyles?.styleIds?.length || 0} table styles</span>
                    {markdownGuidance?.pandocStyleRoleMap && Object.keys(markdownGuidance.pandocStyleRoleMap).length > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-blue-600 dark:text-blue-400">
                          ✓ {Object.keys(markdownGuidance.pandocStyleRoleMap).length} lua filter remap(s)
                        </span>
                      </>
                    )}
                  </div>

                  {/* All Template Styles (collapsible) */}
                  <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-700">
                    <button
                      onClick={() => setShowAllStyles(!showAllStyles)}
                      className="text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 flex items-center gap-1"
                    >
                      <svg className={`w-3 h-3 transition-transform ${showAllStyles ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Show all {docxTemplateAnalysis.paragraphStyles?.length || 0} paragraph styles in template
                    </button>
                    {showAllStyles && (
                      <div className="mt-2 max-h-48 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-green-700 dark:text-green-400 border-b border-green-200 dark:border-green-700 sticky top-0 bg-green-50 dark:bg-green-900/20">
                              <th className="pb-1 pr-2 font-medium">Style Name</th>
                              <th className="pb-1 pr-2 font-medium">Style ID</th>
                              <th className="pb-1 pr-2 font-medium">Font</th>
                              <th className="pb-1 font-medium">Size</th>
                            </tr>
                          </thead>
                          <tbody className="text-green-800 dark:text-green-400">
                            {docxTemplateAnalysis.paragraphStyles?.map((s, i) => (
                              <tr key={i} className="border-b border-green-100 dark:border-green-800/50">
                                <td className="py-0.5 pr-2">{s.name}</td>
                                <td className="py-0.5 pr-2 font-mono">{s.styleId}</td>
                                <td className="py-0.5 pr-2">{s.font || '—'}</td>
                                <td className="py-0.5">{s.fontSize ? `${s.fontSize}pt` : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {/* Table styles */}
                        {docxTemplateAnalysis.specialStyles?.tableStyles?.styleIds?.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-700">
                            <div className="font-medium text-green-700 dark:text-green-400 mb-1">Table Styles</div>
                            <ul className="space-y-0.5">
                              {docxTemplateAnalysis.specialStyles.tableStyles.styleIds.map((id, i) => (
                                <li key={i} className="font-mono">
                                  {id}
                                  {id === docxTemplateAnalysis.specialStyles?.tableStyles?.defaultStyle && (
                                    <span className="ml-1 text-green-600 dark:text-green-500">(default)</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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

          {/* Document Info Tab */}
          {activeTab === 'metadata' && (
            <div className="p-6">
              <DocumentMetadataEditor
                logoCandidates={logoCandidates}
                onLogoAssigned={(role, candidate) => {
                  if (role === 'vendor') {
                    setVendorLogoFilename(candidate?.filename);
                  } else {
                    setCustomerLogoFilename(candidate?.filename);
                  }
                }}
                vendorLogoFilename={vendorLogoFilename}
                customerLogoFilename={customerLogoFilename}
                tableStyleNames={docxTemplateAnalysis?.specialStyles?.tableStyles?.styleIds || []}
                selectedTableStyle={selectedTableStyle}
                onTableStyleChanged={setSelectedTableStyle}
                cellParagraphStyle={cellParagraphStyle}
                onCellParagraphStyleChanged={setCellParagraphStyle}
                bulletListStyle={bulletListStyle}
                onBulletListStyleChanged={setBulletListStyle}
                numberedListStyle={numberedListStyle}
                onNumberedListStyleChanged={setNumberedListStyle}
              />
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
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">Markdown (.md)</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Plain text format, version control friendly</div>
                    </div>
                  </label>
                  {exportFormat === 'markdown' && (
                    <div className="ml-6 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={includeImagesInMarkdown}
                          onChange={(e) => setIncludeImagesInMarkdown(e.target.checked)}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Include diagram images (exports as ZIP with images folder)
                        </span>
                      </label>
                    </div>
                  )}
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
                          checked={includeCoverPage}
                          onChange={(e) => setIncludeCoverPage(e.target.checked)}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Include Cover Page</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={includeDocControl}
                          onChange={(e) => setIncludeDocControl(e.target.checked)}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Include Document Control</span>
                      </label>
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
                          checked={options.includeFigureList ?? options.includeListOfFigures}
                          onChange={(e) => setOptions({ ...options, includeFigureList: e.target.checked, includeListOfFigures: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Include List of Figures</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={options.includeTableList ?? false}
                          onChange={(e) => setOptions({ ...options, includeTableList: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Include List of Tables</span>
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

                      {/* Numbering Mode - only show when template is uploaded */}
                      {docxTemplateAnalysis && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Heading Numbers
                          </label>
                          <div className="space-y-1">
                            <label className="flex items-start">
                              <input
                                type="radio"
                                name="numberingMode"
                                value="template"
                                checked={numberingMode === 'template'}
                                onChange={() => setNumberingMode('template')}
                                className="mt-0.5 mr-2"
                              />
                              <div>
                                <span className="text-sm text-gray-700 dark:text-gray-300">Use template numbering</span>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Strips manual numbers from markdown; template's auto-numbering applies
                                </p>
                              </div>
                            </label>
                            <label className="flex items-start">
                              <input
                                type="radio"
                                name="numberingMode"
                                value="markdown"
                                checked={numberingMode === 'markdown'}
                                onChange={() => setNumberingMode('markdown')}
                                className="mt-0.5 mr-2"
                              />
                              <div>
                                <span className="text-sm text-gray-700 dark:text-gray-300">Use markdown numbering</span>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Keeps manual numbers; requires template without auto-numbering
                                </p>
                              </div>
                            </label>
                          </div>
                        </div>
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
