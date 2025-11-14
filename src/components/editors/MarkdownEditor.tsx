import { useState, useRef } from 'react';
import { useProjectStore } from '../../store/projectStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { aiService } from '../../services/ai';
import type { AIContext, WorkspaceTab } from '../../types';
import { remarkLinkResolver } from '../../utils/remarkLinkResolver';

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
      '2 = Cascade Refinement (slower, 2-3x tokens)\n' +
      '   - Refines selection AND analyzes impact on other sections\n' +
      '   - Suggests related changes for consistency\n\n' +
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

        // Step 2: Extract section title from selected text (first heading)
        const headingMatch = selectedText.match(/^#{1,4}\s+(.+?)$/m);
        const sectionTitle = headingMatch ? headingMatch[1].trim() : 'Selected Section';

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
              sectionId: 'selected',
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
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          {markdown.length} characters • {markdown.split('\n').length} lines
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
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900`}>
            <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-sm rounded-lg p-8">
              <article className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown
                  remarkPlugins={[
                    remarkGfm,
                    [remarkLinkResolver, {
                      figures: getAllFigureReferences(),
                      citations: getAllCitationReferences(),
                      onNavigate: (type: 'figure' | 'reference', _id: string) => {
                        // Navigate to diagram or reference
                        if (type === 'figure') {
                          setActiveTab('diagrams' as WorkspaceTab);
                        } else {
                          setActiveTab('references' as WorkspaceTab);
                        }
                      }
                    }]
                  ]}
                  components={{
                    a: ({ node, className, children, href, ...props }) => {
                      // Check if this is a figure or citation reference link
                      const isFigureRef = className?.includes('figure-reference');
                      const isCitationRef = className?.includes('citation-reference');

                      if (isFigureRef || isCitationRef) {
                        return (
                          <a
                            href={href}
                            className={className}
                            onClick={(e) => {
                              e.preventDefault();
                              // Use correct WorkspaceTab values
                              const targetTab = isFigureRef ? 'block-diagrams' : 'references';
                              console.log('Link clicked:', {
                                className,
                                href,
                                targetTab,
                                navigating: true
                              });

                              setActiveTab(targetTab as WorkspaceTab);
                              console.log('setActiveTab called with:', targetTab);
                            }}
                            {...props}
                          >
                            {children}
                          </a>
                        );
                      }

                      // Regular links
                      return <a href={href} className={className} {...props}>{children}</a>;
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
    </div>
  );
}
