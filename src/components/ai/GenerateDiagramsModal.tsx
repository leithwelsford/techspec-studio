/**
 * GenerateDiagramsModal Component
 * Modal dialog for auto-generating diagrams from BRS analysis
 */

import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { aiService } from '../../services/ai';
import { decrypt } from '../../utils/encryption';

interface GenerateDiagramsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GenerateDiagramsModal: React.FC<GenerateDiagramsModalProps> = ({ isOpen, onClose }) => {
  const aiConfig = useProjectStore(state => state.aiConfig);
  const brsDocument = useProjectStore(state => state.getBRSDocument());
  const addBlockDiagram = useProjectStore(state => state.addBlockDiagram);
  const addMermaidDiagram = useProjectStore(state => state.addMermaidDiagram);
  const updateUsageStats = useProjectStore(state => state.updateUsageStats);
  const createApproval = useProjectStore(state => state.createApproval);
  const createSnapshot = useProjectStore(state => state.createSnapshot);

  // Debug logging
  console.log('=== MODAL STATE ===');
  console.log('isOpen:', isOpen);
  console.log('brsDocument:', brsDocument ? `Loaded: ${brsDocument.title}` : 'NULL');
  console.log('aiConfig:', aiConfig ? 'Configured' : 'NULL');
  console.log('==================');

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 1, diagram: '' });
  const [error, setError] = useState<string | null>(null);
  const [brsAnalysis, setBrsAnalysis] = useState<any>(null);
  const [requireApproval, setRequireApproval] = useState(true); // Default: require approval
  const [generationResults, setGenerationResults] = useState<{
    blockDiagrams: number;
    sequenceDiagrams: number;
    errors: string[];
    warnings: string[];
  } | null>(null);
  const [modelWarning, setModelWarning] = useState<string | null>(null);

  // Check if we need to analyze BRS first
  const needsAnalysis = brsDocument && !brsDocument.structuredData;

  // Validation
  const canGenerate = brsDocument && aiConfig && aiConfig.apiKey;

  // Auto-analyze BRS when modal opens if needed
  useEffect(() => {
    if (isOpen && brsDocument && aiConfig && !brsAnalysis) {
      console.log('=== MODAL OPENED - AUTO-ANALYZING BRS ===');
      analyzeBRS();
    }
  }, [isOpen, brsDocument, aiConfig]);

  const analyzeBRS = async () => {
    console.log('=== ANALYZE BRS FUNCTION CALLED ===');
    console.log('brsDocument exists:', !!brsDocument);
    console.log('aiConfig exists:', !!aiConfig);

    if (!brsDocument || !aiConfig) {
      console.log('Early return: missing brsDocument or aiConfig');
      return;
    }

    console.log('Starting BRS analysis...');
    setIsGenerating(true);
    setError(null);
    setProgress({ current: 0, total: 1, diagram: 'Analyzing BRS document...' });

    try {
      console.log('Decrypting API key...');
      // Decrypt API key and initialize AI service
      const decryptedKey = decrypt(aiConfig.apiKey);
      console.log('API key decrypted, initializing AI service...');

      await aiService.initialize({
        ...aiConfig,
        apiKey: decryptedKey
      });
      console.log('AI service initialized');

      // Build BRS analysis prompt
      console.log('Building BRS analysis prompt...');
      const { buildBRSAnalysisPrompt } = await import('../../services/ai/prompts/documentPrompts');
      const analysisPrompt = buildBRSAnalysisPrompt(brsDocument.markdown);
      console.log('Prompt built, length:', analysisPrompt.length);
      console.log('BRS markdown length:', brsDocument.markdown.length);

      // Check if current model is a reasoning model
      const { isReasoningModel, formatModelName } = await import('../../utils/aiModels');
      const currentModel = aiConfig.model || 'anthropic/claude-3.5-sonnet';
      const isReasoning = isReasoningModel(currentModel);

      // Reasoning models use internal reasoning before generating output
      // Set appropriate token limit based on benchmarking: ~9k reasoning + ~3.6k output = ~12.6k total
      const maxTokens = isReasoning ? 32000 : 4000;

      const chatOptions: any = { maxTokens };

      if (isReasoning) {
        chatOptions.reasoning = { effort: 'high' };
        setModelWarning(`${formatModelName(currentModel)} uses reasoning mode for enhanced analysis quality.`);
      } else {
        setModelWarning(null);
      }

      // Get AI analysis with appropriate token limit
      // Pass undefined for context (3rd param), chatOptions as 4th param (options)
      const result = await aiService.chat(analysisPrompt, [], undefined, chatOptions);
      console.log('AI service returned result');

      // Parse JSON response
      let analysis: any = {};
      try {
        console.log('=== MODAL: RAW BRS ANALYSIS RESPONSE ===');
        console.log(result.content);
        console.log('=== END RAW RESPONSE ===');

        const jsonMatch = result.content.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          console.log('Found JSON in code block');
          analysis = JSON.parse(jsonMatch[1]);
        } else {
          console.log('Trying to parse entire response as JSON');
          analysis = JSON.parse(result.content);
        }

        console.log('=== MODAL: PARSED BRS ANALYSIS ===');
        console.log(JSON.stringify(analysis, null, 2));
        console.log('Components:', analysis.components?.length || 0);
        console.log('Interfaces:', analysis.interfaces?.length || 0);
        console.log('Procedures:', analysis.procedures?.length || 0);
        console.log('Standards:', analysis.standards?.length || 0);
        console.log('=== END PARSED ANALYSIS ===');
      } catch (parseError) {
        console.warn('Failed to parse BRS analysis JSON:', parseError);
        console.error('Parse error details:', parseError);
        analysis = {
          components: [],
          interfaces: [],
          requirementCategories: {},
          procedures: [],
          standards: []
        };
      }

      setBrsAnalysis(analysis);

      // Update usage stats
      if (result.tokens) {
        updateUsageStats(result.tokens.total, result.cost || 0);
      }
    } catch (err: any) {
      console.error('Failed to analyze BRS:', err);
      setError(err.message || 'Failed to analyze BRS document.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = async () => {
    if (!canGenerate || !brsDocument || !aiConfig) {
      return;
    }

    // Use existing analysis or the one we just created
    const analysis = brsAnalysis || brsDocument.structuredData;
    if (!analysis) {
      setError('No BRS analysis available. Please try closing and reopening this dialog.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGenerationResults(null);
    setProgress({ current: 0, total: 1, diagram: 'Preparing to generate diagrams...' });

    try {
      // Decrypt API key and initialize AI service
      const decryptedKey = decrypt(aiConfig.apiKey);
      await aiService.initialize({
        ...aiConfig,
        apiKey: decryptedKey
      });

      // Generate diagrams from BRS analysis
      const result = await aiService.generateDiagramsFromBRS(
        analysis,
        (current, total, diagramTitle) => {
          setProgress({ current, total, diagram: diagramTitle });
        }
      );

      if (requireApproval) {
        // Create approvals for each diagram
        for (const diagram of result.blockDiagrams) {
          createApproval({
            taskId: `diagram-gen-${Date.now()}`,
            type: 'diagram',
            status: 'pending',
            generatedContent: diagram,
          });
        }

        for (const diagram of result.sequenceDiagrams) {
          createApproval({
            taskId: `diagram-gen-${Date.now()}`,
            type: 'diagram',
            status: 'pending',
            generatedContent: diagram,
          });
        }

        alert(`Generated ${result.blockDiagrams.length + result.sequenceDiagrams.length} diagram(s)! Please review them in the Review Panel before applying.`);
      } else {
        // Directly add generated diagrams to store
        for (const diagram of result.blockDiagrams) {
          addBlockDiagram(diagram);
        }

        for (const diagram of result.sequenceDiagrams) {
          addMermaidDiagram('sequence', diagram);
        }

        // Create snapshot
        createSnapshot(
          'diagram-add',
          `AI-generated ${result.blockDiagrams.length} block diagram(s) and ${result.sequenceDiagrams.length} sequence diagram(s) from BRS`,
          'ai'
        );
      }

      // Set results for display
      setGenerationResults({
        blockDiagrams: result.blockDiagrams.length,
        sequenceDiagrams: result.sequenceDiagrams.length,
        errors: result.errors,
        warnings: result.warnings
      });

      // If successful and no errors, auto-close after 2 seconds
      if (result.errors.length === 0) {
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      console.error('Failed to generate diagrams:', err);
      setError(err.message || 'Failed to generate diagrams. Please check your AI configuration.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Generate Diagrams from BRS
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            AI-powered diagram generation from Business Requirements
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Model Warning */}
          {modelWarning && (
            <div className="bg-amber-50 border border-amber-300 rounded-md p-3">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-amber-800">{modelWarning}</p>
              </div>
            </div>
          )}

          {/* BRS Info */}
          {brsDocument && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Source BRS Document</h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p><strong>Title:</strong> {brsDocument.title}</p>
                <p><strong>Customer:</strong> {brsDocument.metadata.customer || 'Not specified'}</p>
                <p><strong>Project:</strong> {brsDocument.metadata.projectName || 'Not specified'}</p>
              </div>
            </div>
          )}

          {/* Approval Option */}
          {!generationResults && (
            <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <input
                id="require-approval"
                type="checkbox"
                checked={requireApproval}
                onChange={(e) => setRequireApproval(e.target.checked)}
                disabled={isGenerating}
                className="mt-0.5"
              />
              <div>
                <label htmlFor="require-approval" className="text-sm font-medium text-yellow-900 cursor-pointer">
                  Require approval before applying diagrams
                </label>
                <p className="text-xs text-yellow-700 mt-1">
                  {requireApproval
                    ? 'Generated diagrams will be sent to Review Panel for your approval.'
                    : 'Generated diagrams will be added immediately without review.'}
                </p>
              </div>
            </div>
          )}

          {/* BRS Analysis Status */}
          {brsAnalysis && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-green-900 mb-2">BRS Analysis Complete</h3>
              <div className="text-sm text-green-800 space-y-1">
                <p><strong>Components:</strong> {brsAnalysis.components?.length || 0} identified</p>
                <p><strong>Interfaces:</strong> {brsAnalysis.interfaces?.length || 0} identified</p>
                <p><strong>Procedures:</strong> {brsAnalysis.procedures?.length || 0} identified</p>
                <p><strong>Standards:</strong> {brsAnalysis.standards?.length || 0} referenced</p>
              </div>
            </div>
          )}

          {/* What will be generated */}
          {brsAnalysis && !generationResults && (
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Diagrams to be generated</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                {brsAnalysis.components && brsAnalysis.interfaces && (
                  <li>✓ <strong>Block Diagram:</strong> System Architecture Overview (components & interfaces)</li>
                )}
                {brsAnalysis.procedures?.map((proc: any, idx: number) => (
                  <li key={idx}>
                    ✓ <strong>Sequence Diagram:</strong> {proc.name || `Procedure ${idx + 1}`}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                Estimated time: 30-60 seconds per diagram
              </p>
            </div>
          )}

          {/* Generation Results */}
          {generationResults && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-green-900 mb-2">Generation Complete!</h3>
              <div className="text-sm text-green-800 space-y-1">
                <p>✓ <strong>{generationResults.blockDiagrams}</strong> block diagram(s) created</p>
                <p>✓ <strong>{generationResults.sequenceDiagrams}</strong> sequence diagram(s) created</p>
                {generationResults.warnings.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium">Warnings:</p>
                    <ul className="list-disc list-inside">
                      {generationResults.warnings.map((warning, idx) => (
                        <li key={idx} className="text-xs">{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-green-700">
                Closing automatically in 2 seconds...
              </p>
            </div>
          )}

          {/* Progress */}
          {isGenerating && !generationResults && (
            <div className="bg-purple-50 border border-purple-200 rounded-md p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-purple-900">
                  {progress.current === 0 ? 'Analyzing...' : 'Generating...'}
                </span>
                <span className="text-sm text-purple-700">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-purple-200 rounded-full h-2 mb-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-sm text-purple-800">{progress.diagram}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-red-900 mb-1">Error</h3>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Warnings */}
          {!canGenerate && !brsDocument && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <p className="text-sm text-yellow-800">
                <strong>No BRS document loaded.</strong> Please upload a BRS document first from the BRS tab.
              </p>
            </div>
          )}

          {!canGenerate && brsDocument && !aiConfig?.apiKey && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <p className="text-sm text-yellow-800">
                <strong>AI not configured.</strong> Please configure your AI provider and API key in Settings.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isGenerating && !generationResults}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generationResults ? 'Close' : 'Cancel'}
          </button>
          {!generationResults && (
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating || !brsAnalysis}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating...' : 'Generate Diagrams'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
