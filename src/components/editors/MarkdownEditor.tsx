import { useState, useRef, useEffect, useCallback } from 'react';
import { useProjectStore } from '../../store/projectStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { aiService } from '../../services/ai';
import type { AIContext, WorkspaceTab } from '../../types';
import { remarkLinkResolver } from '../../utils/remarkLinkResolver';
import { LinkAutocomplete } from '../LinkAutocomplete';
import InlineDiagramPreview from '../InlineDiagramPreview';

export default function MarkdownEditor() {
  const project = useProjectStore((state) => state.project);
  const updateSpecification = useProjectStore((state) => state.updateSpecification);
  const aiConfig = useProjectStore((state) => state.aiConfig);
  const setGenerating = useProjectStore((state) => state.setGenerating);
  const isGenerating = useProjectStore((state) => state.isGenerating);
  const createApproval = useProjectStore((state) => state.createApproval);
  const getAllFigureReferences = useProjectStore((state) => state.getAllFigureReferences);
  const getAllCitationReferences = useProjectStore((state) => state.getAllCitationReferences);
  const setActiveTab = useProjectStore((state) => state.setActiveTab);

  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [generatingSection, setGeneratingSection] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(true);
  const isScrollingSyncRef = useRef(false); // Prevents infinite scroll loops
  const [currentHeadingId, setCurrentHeadingId] = useState<string | null>(null); // Track cursor position heading
  const [currentHeadingText, setCurrentHeadingText] = useState<string | null>(null); // Display name for current heading

  // Enable autocomplete when textarea is available
  useEffect(() => {
    if (textareaRef.current) {
      setShowAutocomplete(true);
    }
  }, [textareaRef.current]);

  // Restore scroll position when returning to this tab
  useEffect(() => {
    const savedPosition = sessionStorage.getItem('techspec-scroll-position');
    if (savedPosition && previewRef.current) {
      // Small delay to ensure content is rendered
      const timer = setTimeout(() => {
        if (previewRef.current) {
          previewRef.current.scrollTop = parseInt(savedPosition, 10);
          sessionStorage.removeItem('techspec-scroll-position');
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  // Find the heading at cursor position and create a unique ID for it
  const findCurrentHeading = useCallback((cursorPos: number, text: string): { id: string; text: string } | null => {
    // Find all headings with their positions
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings: { level: number; text: string; start: number; end: number }[] = [];

    let match;
    while ((match = headingRegex.exec(text)) !== null) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    // Find the nearest heading before cursor position
    let currentHeading: { level: number; text: string } | null = null;
    for (const heading of headings) {
      if (heading.start <= cursorPos) {
        currentHeading = heading;
      } else {
        break;
      }
    }

    if (!currentHeading) return null;

    // Create a unique ID from level and text (slug-like)
    const slug = currentHeading.text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    return {
      id: `h${currentHeading.level}-${slug}`,
      text: currentHeading.text,
    };
  }, []);

  // Track cursor position and update current heading
  const handleCursorChange = useCallback(() => {
    if (!textareaRef.current || viewMode === 'preview') return;

    const editor = textareaRef.current;
    const cursorPos = editor.selectionStart;
    const heading = findCurrentHeading(cursorPos, editor.value);

    const newId = heading?.id || null;
    const newText = heading?.text || null;

    if (newId !== currentHeadingId) {
      setCurrentHeadingId(newId);
      setCurrentHeadingText(newText);
    }
  }, [findCurrentHeading, currentHeadingId, viewMode]);

  // Debounced cursor tracking
  useEffect(() => {
    if (viewMode === 'preview') return;

    const editor = textareaRef.current;
    if (!editor) return;

    // Track cursor on various events
    const events = ['click', 'keyup', 'select'];

    events.forEach(event => {
      editor.addEventListener(event, handleCursorChange);
    });

    // Initial check
    handleCursorChange();

    return () => {
      events.forEach(event => {
        editor.removeEventListener(event, handleCursorChange);
      });
    };
  }, [handleCursorChange, viewMode]);

  // Highlight current heading in preview
  useEffect(() => {
    if (!previewRef.current || !currentHeadingId || viewMode === 'edit') return;

    const preview = previewRef.current;

    // Remove previous highlight
    preview.querySelectorAll('.current-heading-highlight').forEach(el => {
      el.classList.remove('current-heading-highlight', 'bg-blue-50', 'dark:bg-blue-900/30', 'rounded', '-mx-2', 'px-2');
    });

    // Find and highlight the matching heading
    const headings = preview.querySelectorAll('h1, h2, h3, h4, h5, h6');
    for (const heading of headings) {
      const level = parseInt(heading.tagName.replace('H', ''));
      const text = heading.textContent?.trim() || '';
      const slug = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);
      const headingId = `h${level}-${slug}`;

      if (headingId === currentHeadingId) {
        heading.classList.add('current-heading-highlight', 'bg-blue-50', 'dark:bg-blue-900/30', 'rounded', '-mx-2', 'px-2');
        break;
      }
    }
  }, [currentHeadingId, viewMode]);

  // Scroll sync: editor → preview
  const handleEditorScroll = useCallback(() => {
    if (!scrollSyncEnabled || isScrollingSyncRef.current || !textareaRef.current || !previewRef.current) return;

    const editor = textareaRef.current;
    const preview = previewRef.current;

    // Calculate scroll percentage
    const editorScrollPercent = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
    const previewMaxScroll = preview.scrollHeight - preview.clientHeight;

    isScrollingSyncRef.current = true;
    preview.scrollTop = editorScrollPercent * previewMaxScroll;

    // Reset the flag after a short delay
    setTimeout(() => {
      isScrollingSyncRef.current = false;
    }, 50);
  }, [scrollSyncEnabled]);

  // Scroll sync: preview → editor
  const handlePreviewScroll = useCallback(() => {
    if (!scrollSyncEnabled || isScrollingSyncRef.current || !textareaRef.current || !previewRef.current) return;

    const editor = textareaRef.current;
    const preview = previewRef.current;

    // Calculate scroll percentage
    const previewScrollPercent = preview.scrollTop / (preview.scrollHeight - preview.clientHeight);
    const editorMaxScroll = editor.scrollHeight - editor.clientHeight;

    isScrollingSyncRef.current = true;
    editor.scrollTop = previewScrollPercent * editorMaxScroll;

    // Reset the flag after a short delay
    setTimeout(() => {
      isScrollingSyncRef.current = false;
    }, 50);
  }, [scrollSyncEnabled]);

  // Click on preview heading → scroll editor to that heading
  const handlePreviewClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const heading = target.closest('h1, h2, h3, h4, h5, h6');

    if (heading && textareaRef.current) {
      const headingText = heading.textContent?.trim();
      if (!headingText) return;

      const editor = textareaRef.current;
      const markdown = editor.value;

      // Find the heading in markdown (handles #, ##, ###, etc.)
      // Match heading pattern: # Heading Text or ## 1.2 Heading Text
      const headingLevel = heading.tagName.toLowerCase();
      const hashCount = parseInt(headingLevel.replace('h', ''));

      // Escape special regex characters in heading text
      const escapedText = headingText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Try to find exact match first, then looser match
      const patterns = [
        new RegExp(`^#{${hashCount}}\\s+${escapedText}\\s*$`, 'mi'),
        new RegExp(`^#{${hashCount}}\\s+[\\d.]*\\s*${escapedText}\\s*$`, 'mi'),
        new RegExp(`^#+\\s+.*${escapedText}.*$`, 'mi'),
      ];

      for (const pattern of patterns) {
        const match = markdown.match(pattern);
        if (match && match.index !== undefined) {
          // Calculate line number
          const textBefore = markdown.substring(0, match.index);
          const lineNumber = textBefore.split('\n').length - 1;

          // Calculate scroll position based on line
          const lines = markdown.split('\n');
          const avgLineHeight = editor.scrollHeight / lines.length;
          const targetScroll = lineNumber * avgLineHeight;

          // Scroll and optionally select the heading
          editor.scrollTop = Math.max(0, targetScroll - 50); // 50px offset from top

          // Set cursor to the heading line
          editor.setSelectionRange(match.index, match.index + match[0].length);
          editor.focus();

          break;
        }
      }
    }
  }, []);

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800">
        <p>Create a project to start editing</p>
      </div>
    );
  }

  const markdown = project.specification.markdown;

  const handleChange = (value: string) => {
    updateSpecification(value);
  };

  const buildContext = (): AIContext => {
    return {
      currentDocument: markdown,
      availableDiagrams: project.blockDiagrams.map((d) => ({
        id: d.id,
        type: 'block' as const,
        title: d.title,
        figureNumber: d.figureNumber || '',
      })),
      availableReferences: project.references,
    };
  };

  const handleGenerateSection = async () => {
    if (!aiConfig || isGenerating) return;

    const sectionTitle = prompt('Enter section title (e.g., "Architecture Overview"):');
    if (!sectionTitle) return;

    setGeneratingSection(true);
    setGenerating(true);

    try {
      // Initialize AI service with decrypted config
      const { decrypt } = await import('../../utils/encryption');
      const decryptedKey = decrypt(aiConfig.apiKey);

      await aiService.initialize({
        provider: aiConfig.provider,
        apiKey: decryptedKey,
        model: aiConfig.model,
        temperature: aiConfig.temperature,
        maxTokens: aiConfig.maxTokens,
        enableStreaming: aiConfig.enableStreaming,
      });

      const context = buildContext();

      // Get chat history for context
      const chatHistory = useProjectStore.getState().chatHistory;

      const result = await aiService.generateSection({
        sectionTitle,
        context,
        requirements: [
          'Use professional technical writing style',
          'Include normative language where appropriate (SHALL, MUST, MAY)',
          'Reference diagrams using {{fig:diagram-id}} format',
          'Keep sections concise and well-structured',
        ],
      });

      // Create the new content (section appended to existing)
      const newContent = markdown + '\n\n' + result.content;

      // Create approval for review workflow
      const approvalId = createApproval({
        taskId: `section-${Date.now()}`,
        type: 'section',
        status: 'pending',
        originalContent: markdown,
        generatedContent: newContent, // Full document with new section
      });

      alert(
        `Section "${sectionTitle}" generated! ${result.tokens?.total || 0} tokens used.\n\n` +
        `Please review the new section in the Review Panel before applying.`
      );
    } catch (error) {
      alert(`Error generating section: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGeneratingSection(false);
      setGenerating(false);
    }
  };

  const handleRefineSelection = async () => {
    if (!aiConfig || isGenerating || !textareaRef.current) return;

    const textarea = textareaRef.current;
    const selectedText = textarea.value.substring(
      textarea.selectionStart,
      textarea.selectionEnd
    );

    if (!selectedText) {
      alert('Please select text to refine');
      return;
    }

    const instructions = prompt('How should I refine this text? (e.g., "make it more technical", "simplify", "add examples")');
    if (!instructions) return;

    // Ask user which refinement type they want
    const refinementType = prompt(
      'Choose refinement type:\n\n' +
      '1 = Simple Refinement (faster, fewer tokens)\n' +
      '   - Only refines the selected text\n\n' +
      '2 = Cascade Refinement (slower, 2-3x tokens) ⚠️  BETA\n' +
      '   - Refines selection AND analyzes impact on other sections\n' +
      '   - Suggests related changes for consistency\n' +
      '   - ⚠️  IMPORTANT: Carefully review ALL changes before approving\n' +
      '   - Cascade changes are shown in the Review Panel\n\n' +
      'Enter 1 for Simple, 2 for Cascade:',
      '1'
    );

    if (!refinementType) return;

    const useCascade = refinementType.trim() === '2';

    setGeneratingSection(true);
    setGenerating(true);

    try {
      // Initialize AI service with decrypted config
      const { decrypt } = await import('../../utils/encryption');
      const decryptedKey = decrypt(aiConfig.apiKey);

      await aiService.initialize({
        provider: aiConfig.provider,
        apiKey: decryptedKey,
        model: aiConfig.model,
        temperature: aiConfig.temperature,
        maxTokens: aiConfig.maxTokens,
        enableStreaming: aiConfig.enableStreaming,
      });

      const context = buildContext();

      if (useCascade) {
        // Cascade refinement workflow
        console.log('🔄 Starting cascade refinement workflow...');

        // Step 1: First refine the selected text
        const refinementResult = await aiService.refineContent(selectedText, instructions, context);
        const refinedSection = refinementResult.content;

        // Step 2: Extract section ID and title from selected text (first heading)
        // Heading format: "## 6.3 Title" or "### 6.3.1 Subtitle"
        const headingMatch = selectedText.match(/^#{1,4}\s+(\d+(?:\.\d+)*)\s+(.+?)$/m);
        const sectionId = headingMatch ? headingMatch[1] : 'unknown';
        const sectionTitle = headingMatch ? headingMatch[2].trim() : 'Selected Section';

        // Step 3: Perform cascaded refinement analysis
        const cascadeResult = await aiService.performCascadedRefinement(
          selectedText,           // originalSection
          refinedSection,         // refinedSection
          sectionTitle,           // sectionTitle
          textarea.value,         // fullDocument
          instructions            // instruction
        );

        // Create cascaded refinement approval with combined data
        const createApproval = useProjectStore.getState().createApproval;
        const approvalId = createApproval({
          taskId: `cascade-refine-${Date.now()}`,
          type: 'cascaded-refinement',
          status: 'pending',
          originalContent: textarea.value,
          generatedContent: {
            primaryChange: {
              sectionId: sectionId,
              sectionTitle: sectionTitle,
              originalContent: selectedText,
              refinedContent: refinedSection,
            },
            propagatedChanges: cascadeResult.propagatedChanges,
            validation: cascadeResult.validation,
            impactAnalysis: cascadeResult.impactAnalysis,
            instruction: instructions,
            tokensUsed: refinementResult.tokens?.total + cascadeResult.totalTokens,
            costIncurred: (refinementResult.cost || 0) + cascadeResult.totalCost,
          },
        });

        alert(
          `Cascade refinement complete!\n\n` +
          `✅ Primary change generated\n` +
          `📊 ${cascadeResult.propagatedChanges?.length || 0} related sections analyzed\n` +
          `⚠️ ${cascadeResult.validation?.issues?.length || 0} validation issues found\n\n` +
          `Tokens used: ${refinementResult.tokens?.total + cascadeResult.totalTokens}\n` +
          `Cost: $${((refinementResult.cost || 0) + cascadeResult.totalCost).toFixed(3)}\n\n` +
          `Please review the changes in the Review Panel.`
        );
      } else {
        // Simple refinement workflow
        const result = await aiService.refineContent(selectedText, instructions, context);

        // Replace selected text
        const before = textarea.value.substring(0, textarea.selectionStart);
        const after = textarea.value.substring(textarea.selectionEnd);
        const newContent = before + result.content + after;

        // Create approval for review
        const createApproval = useProjectStore.getState().createApproval;
        const approvalId = createApproval({
          taskId: `refine-${Date.now()}`,
          type: 'refinement',
          status: 'pending',
          originalContent: textarea.value, // Full document before change
          generatedContent: newContent, // Full document after change
        });

        alert(
          `Content refined! ${result.tokens?.total || 0} tokens used.\n\n` +
          `Please review the changes in the Review Panel before applying.`
        );
      }
    } catch (error) {
      alert(`Error refining content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGeneratingSection(false);
      setGenerating(false);
    }
  };

  const handleInsertReference = () => {
    if (!textareaRef.current) return;

    const diagrams = useProjectStore.getState().getAllDiagrams();

    if (diagrams.length === 0) {
      alert('No diagrams available. Create diagrams first.');
      return;
    }

    const diagramList = diagrams.map((d, i) => `${i + 1}. ${d.title} ({{fig:${d.id}}})`).join('\n');
    const choice = prompt(`Select diagram to reference:\n\n${diagramList}\n\nEnter number:`);

    if (!choice) return;

    const index = parseInt(choice) - 1;
    if (index >= 0 && index < diagrams.length) {
      const diagram = diagrams[index];
      const reference = `{{fig:${diagram.id}}}`;

      // Insert at cursor position
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = textarea.value.substring(0, start);
      const after = textarea.value.substring(end);

      updateSpecification(before + reference + after);

      // Move cursor after inserted text
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + reference.length;
        textarea.focus();
      }, 0);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      {/* Toolbar */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">
            <button
              onClick={() => setViewMode('edit')}
              className={`px-3 py-1 text-sm ${
                viewMode === 'edit' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
              } rounded-l-md`}
            >
              Edit
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1 text-sm ${
                viewMode === 'split' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              Split
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1 text-sm ${
                viewMode === 'preview' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
              } rounded-r-md`}
            >
              Preview
            </button>
          </div>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>

          {/* AI Actions */}
          <button
            onClick={handleGenerateSection}
            disabled={!aiConfig || isGenerating}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {generatingSection ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Generate Section</span>
              </>
            )}
          </button>

          <button
            onClick={handleRefineSelection}
            disabled={!aiConfig || isGenerating}
            className="px-3 py-1 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Refine Selection</span>
          </button>

          <button
            onClick={handleInsertReference}
            className="px-3 py-1 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Insert Figure Ref</span>
          </button>

          {/* Scroll Sync Toggle - only show in split mode */}
          {viewMode === 'split' && (
            <>
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
              <button
                onClick={() => setScrollSyncEnabled(!scrollSyncEnabled)}
                className={`px-3 py-1 text-sm rounded-md flex items-center gap-2 ${
                  scrollSyncEnabled
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
                title={scrollSyncEnabled ? 'Scroll sync enabled - click to disable' : 'Scroll sync disabled - click to enable'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <span>Sync</span>
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          {/* Current section indicator */}
          {currentHeadingText && viewMode !== 'preview' && (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400 max-w-[200px] truncate" title={`Current section: ${currentHeadingText}`}>
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="truncate">{currentHeadingText}</span>
            </span>
          )}
          {viewMode === 'split' && (
            <span className="text-blue-600 dark:text-blue-400" title="Click headings in preview to jump to them in editor">
              Click headings to navigate
            </span>
          )}
          <span>{markdown.length} characters • {markdown.split('\n').length} lines</span>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Edit Pane */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} border-r border-gray-200 dark:border-gray-700`}>
            <textarea
              ref={textareaRef}
              value={markdown}
              onChange={(e) => handleChange(e.target.value)}
              onScroll={handleEditorScroll}
              className="w-full h-full p-4 font-mono text-sm resize-none focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="# My Technical Specification

## 1. Introduction

Start writing your specification here...

Use **AI Generate Section** to create content automatically.
Select text and use **AI Refine** to improve it.
Use {{fig:diagram-id}} to reference diagrams."
              spellCheck={false}
            />
          </div>
        )}

        {/* Preview Pane */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div
            ref={previewRef}
            onScroll={handlePreviewScroll}
            onClick={handlePreviewClick}
            className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900`}
          >
            <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-sm rounded-lg p-8">
              <article className="prose prose-sm max-w-none dark:prose-invert dark:text-gray-100 [&_h1]:cursor-pointer [&_h2]:cursor-pointer [&_h3]:cursor-pointer [&_h4]:cursor-pointer [&_h5]:cursor-pointer [&_h6]:cursor-pointer [&_h1]:transition-all [&_h2]:transition-all [&_h3]:transition-all [&_h4]:transition-all [&_h5]:transition-all [&_h6]:transition-all [&_h1]:duration-200 [&_h2]:duration-200 [&_h3]:duration-200 [&_h4]:duration-200 [&_h5]:duration-200 [&_h6]:duration-200 [&_h1:hover]:text-blue-600 [&_h2:hover]:text-blue-600 [&_h3:hover]:text-blue-600 [&_h4:hover]:text-blue-600 [&_h5:hover]:text-blue-600 [&_h6:hover]:text-blue-600 dark:[&_h1:hover]:text-blue-400 dark:[&_h2:hover]:text-blue-400 dark:[&_h3:hover]:text-blue-400 dark:[&_h4:hover]:text-blue-400 dark:[&_h5:hover]:text-blue-400 dark:[&_h6:hover]:text-blue-400">
                <ReactMarkdown
                  remarkPlugins={[
                    remarkGfm,
                    [remarkLinkResolver, {
                      figures: getAllFigureReferences(),
                      citations: getAllCitationReferences(),
                    }]
                  ]}
                  components={{
                    a: ({ children, href, node, ...props }) => {
                      // Detect figure/reference links by href pattern
                      const isFigureRef = typeof href === 'string' && href.startsWith('#figure-');
                      const isReferenceRef = typeof href === 'string' && href.startsWith('#reference-');

                      if (isFigureRef) {
                        // Extract figure ID/slug from href (e.g., "#figure-abc123" -> "abc123")
                        const figureIdOrSlug = href.replace('#figure-', '');

                        // Render the actual diagram inline
                        return (
                          <InlineDiagramPreview
                            diagramId={figureIdOrSlug}
                            maxWidth={700}
                            showCaption={true}
                          />
                        );
                      }

                      if (isReferenceRef) {
                        // Keep citation references as clickable links
                        return (
                          <a
                            href={href}
                            className="citation-reference"
                            onClick={(e) => {
                              e.preventDefault();
                              setActiveTab('references' as WorkspaceTab);
                            }}
                            style={{ cursor: 'pointer' }}
                            {...props}
                          >
                            {children}
                          </a>
                        );
                      }

                      // Regular links
                      return <a href={href} {...props}>{children}</a>;
                    }
                  }}
                >
                  {markdown}
                </ReactMarkdown>
              </article>
            </div>
          </div>
        )}
      </div>

      {/* Link Autocomplete */}
      {showAutocomplete && textareaRef.current && (
        <LinkAutocomplete
          textarea={textareaRef.current}
          figures={getAllFigureReferences()}
          citations={getAllCitationReferences()}
          onInsert={(text) => handleChange(text)}
        />
      )}
    </div>
  );
}
