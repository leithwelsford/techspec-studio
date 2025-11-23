/**
 * Global state management for Technical Specification projects
 */

import { create } from 'zustand';
import { indexedDBPersist } from '../utils/indexedDBMiddleware';
import type {
  Project,
  BlockDiagram,
  MermaidDiagram,
  ReferenceDocument,
  BRSDocument,
  WorkspaceTab,
  SpecDocument,
  AIConfig,
  AIMessage,
  AITask,
  PendingApproval,
  AIUsageStats,
  VersionSnapshot,
  VersionHistory,
  VersionChangeType,
  SpecificationTemplate,
  ProjectTemplateConfig,
} from '../types';
import { getEnvApiKey, getEnvModel, getEnvTemperature, getEnvMaxTokens, getEnvEnableStreaming } from '../utils/envConfig';
import { encrypt } from '../utils/encryption';

interface ProjectState {
  // Current project
  project: Project | null;

  // Workspace state
  activeTab: WorkspaceTab;
  activeBlockDiagramId: string | null;
  activeMermaidDiagramId: string | null;
  sidebarOpen: boolean;
  previewMode: 'split' | 'full';
  darkMode: boolean;

  // AI state
  aiConfig: AIConfig | null;
  chatHistory: AIMessage[];
  activeTasks: AITask[];
  pendingApprovals: PendingApproval[];
  isGenerating: boolean;
  currentTaskId: string | null;
  usageStats: AIUsageStats;
  chatPanelOpen: boolean;

  // Version history
  versionHistory: VersionHistory;

  // Template system
  availableTemplates: SpecificationTemplate[];
  activeTemplateConfig: ProjectTemplateConfig | null;

  // Actions - Project
  createProject: (name: string) => void;
  loadProject: (project: Project) => void;
  updateProjectMetadata: (updates: Partial<Project>) => void;

  // Actions - Specification Document
  updateSpecification: (markdown: string) => void;
  updateDocumentMetadata: (metadata: Partial<SpecDocument['metadata']>) => void;

  // Actions - Block Diagrams
  addBlockDiagram: (diagram: Omit<BlockDiagram, 'id'>) => string;
  updateBlockDiagram: (id: string, updates: Partial<BlockDiagram>) => void;
  deleteBlockDiagram: (id: string) => void;
  setActiveBlockDiagram: (id: string | null) => void;

  // Actions - Mermaid Diagrams (Sequence/Flow)
  addMermaidDiagram: (type: 'sequence' | 'flow', diagram: Omit<MermaidDiagram, 'id'>) => string;
  updateMermaidDiagram: (id: string, updates: Partial<MermaidDiagram>) => void;
  deleteMermaidDiagram: (id: string) => void;
  setActiveMermaidDiagram: (id: string | null) => void;

  // Actions - References
  addReference: (ref: Omit<ReferenceDocument, 'id'>) => string;
  updateReference: (id: string, updates: Partial<ReferenceDocument>) => void;
  deleteReference: (id: string) => void;

  // Actions - BRS Document
  setBRSDocument: (brs: Omit<BRSDocument, 'id' | 'uploadedAt'>) => void;
  updateBRSDocument: (updates: Partial<BRSDocument>) => void;
  clearBRSDocument: () => void;
  getBRSDocument: () => BRSDocument | undefined;

  // Actions - Workspace
  setActiveTab: (tab: WorkspaceTab) => void;
  setSidebarOpen: (open: boolean) => void;
  setPreviewMode: (mode: 'split' | 'full') => void;
  toggleDarkMode: () => void;

  // Actions - AI Configuration
  setAIConfig: (config: AIConfig) => void;
  updateAIConfig: (updates: Partial<AIConfig>) => void;
  clearAIConfig: () => void;

  // Actions - AI Chat
  addChatMessage: (message: Omit<AIMessage, 'id' | 'timestamp'>) => void;
  updateChatMessage: (id: string, updates: Partial<AIMessage>) => void;
  clearChatHistory: () => void;
  setChatPanelOpen: (open: boolean) => void;

  // Actions - AI Tasks
  createTask: (task: Omit<AITask, 'id' | 'createdAt'>) => string;
  updateTask: (id: string, updates: Partial<AITask>) => void;
  completeTask: (id: string, output: any) => void;
  failTask: (id: string, error: string) => void;
  removeTask: (id: string) => void;
  setCurrentTask: (taskId: string | null) => void;
  setGenerating: (isGenerating: boolean) => void;

  // Actions - Pending Approvals
  createApproval: (approval: Omit<PendingApproval, 'id' | 'createdAt'>) => string;
  approveContent: (id: string, feedback?: string) => void;
  rejectContent: (id: string, feedback: string) => void;
  removeApproval: (id: string) => void;

  // Actions - Usage Stats
  updateUsageStats: (tokens: number, cost: number) => void;
  resetUsageStats: () => void;

  // Actions - Version History
  createSnapshot: (changeType: VersionChangeType, description: string, author: 'user' | 'ai', metadata?: { tokensUsed?: number; costIncurred?: number; relatedTaskId?: string; relatedApprovalId?: string }) => string;
  restoreSnapshot: (snapshotId: string) => void;
  getSnapshot: (snapshotId: string) => VersionSnapshot | undefined;
  getAllSnapshots: () => VersionSnapshot[];
  deleteSnapshot: (snapshotId: string) => void;
  clearHistory: () => void;

  // Actions - Template System
  loadBuiltInTemplates: () => void;
  createCustomTemplate: (template: Omit<SpecificationTemplate, 'id' | 'createdAt' | 'modifiedAt' | 'isBuiltIn'>) => string;
  updateCustomTemplate: (id: string, updates: Partial<SpecificationTemplate>) => void;
  deleteCustomTemplate: (id: string) => void;
  setActiveTemplate: (config: ProjectTemplateConfig) => void;
  updateTemplateConfig: (updates: Partial<ProjectTemplateConfig>) => void;
  reorderSections: (sectionIds: string[]) => void;
  toggleSection: (sectionId: string, enabled: boolean) => void;

  // Utilities
  getAllDiagrams: () => Array<{ id: string; type: string; title: string; figureNumber?: string }>;
  autoNumberFigures: () => void;

  // Link Resolution utilities
  getDiagramById: (id: string) => (BlockDiagram | MermaidDiagram) & { type: 'block' | 'sequence' | 'flow' } | null;
  getDiagramNumber: (id: string) => string | null;
  getAllFigureReferences: () => Array<{ id: string; number: string; title: string; type: string }>;
  getAllCitationReferences: () => Array<{ id: string; number: string; title: string }>;
  getValidFigureIds: () => string[];
  getValidReferenceIds: () => string[];

  // Store management
  resetStore: () => void;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Create default AI config from environment variables
 * Returns null if no API key is available
 *
 * NOTE: We store the env API key UNENCRYPTED in the store because:
 * 1. It comes from a secure source (server-side .env.local file)
 * 2. AIConfigPanel expects to decrypt keys from localStorage, not from env vars
 * 3. The panel will handle encryption when user saves via UI
 */
const createDefaultAIConfig = (): AIConfig | null => {
  const envApiKey = getEnvApiKey();

  if (!envApiKey) {
    console.log('ℹ️ No API key found in environment variables');
    return null;
  }

  console.log('✅ Initializing AI config from environment variables (unencrypted)');

  return {
    provider: 'openrouter',
    apiKey: envApiKey, // Store unencrypted - AIConfigPanel will handle encryption on save
    model: (getEnvModel() as any) || 'anthropic/claude-3.5-sonnet',
    temperature: getEnvTemperature() ?? 0.7,
    maxTokens: getEnvMaxTokens() ?? 4096,
    enableStreaming: getEnvEnableStreaming() ?? true,
  };
};

const createDefaultProject = (name: string): Project => ({
  id: generateId(),
  name,
  version: '0.1',
  createdAt: new Date(),
  updatedAt: new Date(),
  specification: {
    id: generateId(),
    title: name,
    markdown: '# Technical Specification\n\n## 1. Introduction\n\nYour specification content here...\n',
    metadata: {
      version: '0.1',
      date: new Date().toISOString().split('T')[0],
    },
  },
  blockDiagrams: [],
  sequenceDiagrams: [],
  flowDiagrams: [],
  references: [],
});

export const useProjectStore = create<ProjectState>()(
  indexedDBPersist(
    (set, get) => ({
      // Initial state
      project: null,
      activeTab: 'document',
      activeBlockDiagramId: null,
      activeMermaidDiagramId: null,
      sidebarOpen: true,
      previewMode: 'split',
      darkMode: false,

      // AI initial state - Load from environment if available
      aiConfig: createDefaultAIConfig(),
      chatHistory: [],
      activeTasks: [],
      pendingApprovals: [],
      isGenerating: false,
      currentTaskId: null,
      chatPanelOpen: false,
      usageStats: {
        totalTokens: 0,
        totalCost: 0,
        requestCount: 0,
        lastReset: new Date(),
      },

      // Version history initial state
      versionHistory: {
        snapshots: [],
        currentSnapshotId: null,
      },

      // Template system initial state
      availableTemplates: [],
      activeTemplateConfig: null,

      // Project actions
      createProject: (name) => {
        const project = createDefaultProject(name);
        set({ project, activeTab: 'document' });
      },

      loadProject: (project) => {
        set({ project, activeTab: 'document' });
      },

      updateProjectMetadata: (updates) => {
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              ...updates,
              updatedAt: new Date(),
            },
          };
        });
      },

      // Specification actions
      updateSpecification: (markdown) => {
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              specification: {
                ...state.project.specification,
                markdown,
              },
              updatedAt: new Date(),
            },
          };
        });
      },

      updateDocumentMetadata: (metadata) => {
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              specification: {
                ...state.project.specification,
                metadata: {
                  ...state.project.specification.metadata,
                  ...metadata,
                },
              },
              updatedAt: new Date(),
            },
          };
        });
      },

      // Block diagram actions
      addBlockDiagram: (diagram) => {
        const id = generateId();
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              blockDiagrams: [
                ...state.project.blockDiagrams,
                { ...diagram, id },
              ],
              updatedAt: new Date(),
            },
            activeBlockDiagramId: id,
            activeTab: 'block-diagrams',
          };
        });
        return id;
      },

      updateBlockDiagram: (id, updates) => {
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              blockDiagrams: state.project.blockDiagrams.map((d) =>
                d.id === id ? { ...d, ...updates } : d
              ),
              updatedAt: new Date(),
            },
          };
        });
      },

      deleteBlockDiagram: (id) => {
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              blockDiagrams: state.project.blockDiagrams.filter((d) => d.id !== id),
              updatedAt: new Date(),
            },
            activeBlockDiagramId: state.activeBlockDiagramId === id ? null : state.activeBlockDiagramId,
          };
        });
      },

      setActiveBlockDiagram: (id) => {
        set({ activeBlockDiagramId: id, activeTab: 'block-diagrams' });
      },

      // Mermaid diagram actions
      addMermaidDiagram: (type, diagram) => {
        const id = generateId();
        const arrayKey = type === 'sequence' ? 'sequenceDiagrams' : 'flowDiagrams';
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              [arrayKey]: [
                ...state.project[arrayKey],
                { ...diagram, id },
              ],
              updatedAt: new Date(),
            },
            activeMermaidDiagramId: id,
            activeTab: type === 'sequence' ? 'sequence-diagrams' : 'flow-diagrams',
          };
        });
        return id;
      },

      updateMermaidDiagram: (id, updates) => {
        set((state) => {
          if (!state.project) return state;

          // Check both sequence and flow diagrams
          const isSequence = state.project.sequenceDiagrams.some((d) => d.id === id);
          const arrayKey = isSequence ? 'sequenceDiagrams' : 'flowDiagrams';

          return {
            project: {
              ...state.project,
              [arrayKey]: state.project[arrayKey].map((d: MermaidDiagram) =>
                d.id === id ? { ...d, ...updates } : d
              ),
              updatedAt: new Date(),
            },
          };
        });
      },

      deleteMermaidDiagram: (id) => {
        set((state) => {
          if (!state.project) return state;

          const isSequence = state.project.sequenceDiagrams.some((d) => d.id === id);
          const arrayKey = isSequence ? 'sequenceDiagrams' : 'flowDiagrams';

          return {
            project: {
              ...state.project,
              [arrayKey]: state.project[arrayKey].filter((d: MermaidDiagram) => d.id !== id),
              updatedAt: new Date(),
            },
            activeMermaidDiagramId: state.activeMermaidDiagramId === id ? null : state.activeMermaidDiagramId,
          };
        });
      },

      setActiveMermaidDiagram: (id) => {
        set({ activeMermaidDiagramId: id });
      },

      // Reference actions
      addReference: (ref) => {
        const id = generateId();
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              references: [...state.project.references, { ...ref, id }],
              updatedAt: new Date(),
            },
          };
        });
        return id;
      },

      updateReference: (id, updates) => {
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              references: state.project.references.map((r) =>
                r.id === id ? { ...r, ...updates } : r
              ),
              updatedAt: new Date(),
            },
          };
        });
      },

      deleteReference: (id) => {
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              references: state.project.references.filter((r) => r.id !== id),
              updatedAt: new Date(),
            },
          };
        });
      },

      // BRS Document actions
      setBRSDocument: (brs) => {
        const id = generateId();
        const uploadedAt = new Date();
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              brsDocument: { ...brs, id, uploadedAt },
              updatedAt: new Date(),
            },
          };
        });
      },

      updateBRSDocument: (updates) => {
        set((state) => {
          if (!state.project || !state.project.brsDocument) return state;
          return {
            project: {
              ...state.project,
              brsDocument: {
                ...state.project.brsDocument,
                ...updates,
              },
              updatedAt: new Date(),
            },
          };
        });
      },

      clearBRSDocument: () => {
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              brsDocument: undefined,
              updatedAt: new Date(),
            },
          };
        });
      },

      getBRSDocument: () => {
        return get().project?.brsDocument;
      },

      // Workspace actions
      setActiveTab: (tab) => set({ activeTab: tab }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setPreviewMode: (mode) => set({ previewMode: mode }),
      toggleDarkMode: () => {
        set({ darkMode: !get().darkMode });
      },

      // AI Configuration actions
      setAIConfig: (config) => set({ aiConfig: config }),

      updateAIConfig: (updates) => {
        set((state) => ({
          aiConfig: state.aiConfig ? { ...state.aiConfig, ...updates } : null,
        }));
      },

      clearAIConfig: () => set({
        aiConfig: null,
        chatHistory: [],
        activeTasks: [],
        pendingApprovals: [],
      }),

      // AI Chat actions
      addChatMessage: (message) => {
        const id = generateId();
        const timestamp = new Date();
        set((state) => ({
          chatHistory: [
            ...state.chatHistory,
            { ...message, id, timestamp },
          ],
        }));
      },

      updateChatMessage: (id, updates) => {
        set((state) => ({
          chatHistory: state.chatHistory.map((msg) =>
            msg.id === id ? { ...msg, ...updates } : msg
          ),
        }));
      },

      clearChatHistory: () => set({ chatHistory: [] }),

      setChatPanelOpen: (open) => set({ chatPanelOpen: open }),

      // AI Task actions
      createTask: (task) => {
        const id = generateId();
        const createdAt = new Date();
        set((state) => ({
          activeTasks: [
            ...state.activeTasks,
            { ...task, id, createdAt },
          ],
          currentTaskId: id,
        }));
        return id;
      },

      updateTask: (id, updates) => {
        set((state) => ({
          activeTasks: state.activeTasks.map((task) =>
            task.id === id ? { ...task, ...updates } : task
          ),
        }));
      },

      completeTask: (id, output) => {
        set((state) => ({
          activeTasks: state.activeTasks.map((task) =>
            task.id === id
              ? { ...task, status: 'complete', output, completedAt: new Date() }
              : task
          ),
          currentTaskId: state.currentTaskId === id ? null : state.currentTaskId,
          isGenerating: false,
        }));
      },

      failTask: (id, error) => {
        set((state) => ({
          activeTasks: state.activeTasks.map((task) =>
            task.id === id
              ? { ...task, status: 'error', error, completedAt: new Date() }
              : task
          ),
          currentTaskId: state.currentTaskId === id ? null : state.currentTaskId,
          isGenerating: false,
        }));
      },

      removeTask: (id) => {
        set((state) => ({
          activeTasks: state.activeTasks.filter((task) => task.id !== id),
          currentTaskId: state.currentTaskId === id ? null : state.currentTaskId,
        }));
      },

      setCurrentTask: (taskId) => set({ currentTaskId: taskId }),

      setGenerating: (isGenerating) => set({ isGenerating }),

      // Pending Approval actions
      createApproval: (approval) => {
        const id = generateId();
        const createdAt = new Date();
        set((state) => ({
          pendingApprovals: [
            ...state.pendingApprovals,
            { ...approval, id, createdAt, status: 'pending' },
          ],
        }));
        return id;
      },

      approveContent: (id, feedback) => {
        set((state) => ({
          pendingApprovals: state.pendingApprovals.map((approval) =>
            approval.id === id
              ? {
                  ...approval,
                  status: 'approved',
                  feedback,
                  reviewedAt: new Date()
                }
              : approval
          ),
        }));
      },

      rejectContent: (id, feedback) => {
        set((state) => ({
          pendingApprovals: state.pendingApprovals.map((approval) =>
            approval.id === id
              ? {
                  ...approval,
                  status: 'rejected',
                  feedback,
                  reviewedAt: new Date()
                }
              : approval
          ),
        }));
      },

      removeApproval: (id) => {
        set((state) => ({
          pendingApprovals: state.pendingApprovals.filter(
            (approval) => approval.id !== id
          ),
        }));
      },

      // Usage Stats actions
      updateUsageStats: (tokens, cost) => {
        set((state) => ({
          usageStats: {
            ...state.usageStats,
            totalTokens: state.usageStats.totalTokens + tokens,
            totalCost: state.usageStats.totalCost + cost,
            requestCount: state.usageStats.requestCount + 1,
          },
        }));
      },

      resetUsageStats: () => {
        set({
          usageStats: {
            totalTokens: 0,
            totalCost: 0,
            requestCount: 0,
            lastReset: new Date(),
          },
        });
      },

      // Utilities
      getAllDiagrams: () => {
        const state = get();
        if (!state.project) return [];

        return [
          ...state.project.blockDiagrams.map((d) => ({
            id: d.id,
            type: 'block',
            title: d.title,
            figureNumber: d.figureNumber,
          })),
          ...state.project.sequenceDiagrams.map((d) => ({
            id: d.id,
            type: 'sequence',
            title: d.title,
            figureNumber: d.figureNumber,
          })),
          ...state.project.flowDiagrams.map((d) => ({
            id: d.id,
            type: 'flow',
            title: d.title,
            figureNumber: d.figureNumber,
          })),
        ];
      },

      autoNumberFigures: () => {
        set((state) => {
          if (!state.project) return state;

          let counter = 1;

          const blockDiagrams = state.project.blockDiagrams.map((d) => ({
            ...d,
            figureNumber: `4-${counter++}`,
          }));

          const sequenceDiagrams = state.project.sequenceDiagrams.map((d) => ({
            ...d,
            figureNumber: `4-${counter++}`,
          }));

          const flowDiagrams = state.project.flowDiagrams.map((d) => ({
            ...d,
            figureNumber: `4-${counter++}`,
          }));

          return {
            project: {
              ...state.project,
              blockDiagrams,
              sequenceDiagrams,
              flowDiagrams,
              updatedAt: new Date(),
            },
          };
        });
      },

      // Version History actions
      createSnapshot: (changeType, description, author, metadata = {}) => {
        const state = get();
        if (!state.project) return '';

        const id = generateId();
        const snapshot: VersionSnapshot = {
          id,
          projectId: state.project.id,
          timestamp: new Date(),
          changeType,
          description,
          author,
          specification: {
            markdown: state.project.specification.markdown,
            metadata: state.project.specification.metadata,
          },
          blockDiagrams: [...state.project.blockDiagrams],
          sequenceDiagrams: [...state.project.sequenceDiagrams],
          flowDiagrams: [...state.project.flowDiagrams],
          ...metadata,
        };

        set((prevState) => ({
          versionHistory: {
            snapshots: [...prevState.versionHistory.snapshots, snapshot],
            currentSnapshotId: id,
          },
        }));

        return id;
      },

      restoreSnapshot: (snapshotId) => {
        const state = get();
        const snapshot = state.versionHistory.snapshots.find(s => s.id === snapshotId);

        if (!snapshot || !state.project) return;

        set((prevState) => {
          if (!prevState.project) return prevState;

          return {
            project: {
              ...prevState.project,
              specification: {
                ...prevState.project.specification,
                markdown: snapshot.specification?.markdown || '',
                metadata: snapshot.specification?.metadata || prevState.project.specification.metadata,
              },
              blockDiagrams: snapshot.blockDiagrams || [],
              sequenceDiagrams: snapshot.sequenceDiagrams || [],
              flowDiagrams: snapshot.flowDiagrams || [],
              updatedAt: new Date(),
            },
            versionHistory: {
              ...prevState.versionHistory,
              currentSnapshotId: snapshotId,
            },
          };
        });
      },

      getSnapshot: (snapshotId) => {
        return get().versionHistory.snapshots.find(s => s.id === snapshotId);
      },

      getAllSnapshots: () => {
        return get().versionHistory.snapshots;
      },

      deleteSnapshot: (snapshotId) => {
        set((state) => ({
          versionHistory: {
            snapshots: state.versionHistory.snapshots.filter(s => s.id !== snapshotId),
            currentSnapshotId: state.versionHistory.currentSnapshotId === snapshotId
              ? null
              : state.versionHistory.currentSnapshotId,
          },
        }));
      },

      clearHistory: () => {
        set({
          versionHistory: {
            snapshots: [],
            currentSnapshotId: null,
          },
        });
      },

      // Link Resolution utilities
      getDiagramById: (id) => {
        const state = get();
        if (!state.project) return null;

        const blockDiagram = state.project.blockDiagrams.find(d => d.id === id);
        if (blockDiagram) return { ...blockDiagram, type: 'block' as const };

        const sequenceDiagram = state.project.sequenceDiagrams.find(d => d.id === id);
        if (sequenceDiagram) return { ...sequenceDiagram, type: 'sequence' as const };

        const flowDiagram = state.project.flowDiagrams.find(d => d.id === id);
        if (flowDiagram) return { ...flowDiagram, type: 'flow' as const };

        return null;
      },

      getDiagramNumber: (id) => {
        const diagram = get().getDiagramById(id);
        return diagram?.figureNumber || null;
      },

      getAllFigureReferences: () => {
        const state = get();
        if (!state.project) return [];

        return state.getAllDiagrams().map(d => ({
          id: d.id,
          number: d.figureNumber || 'X-X',
          title: d.title,
          type: d.type,
        }));
      },

      getAllCitationReferences: () => {
        const state = get();
        if (!state.project) return [];

        return state.project.references.map((ref, index) => ({
          id: ref.id,
          number: String(index + 1),
          title: ref.title,
        }));
      },

      getValidFigureIds: () => {
        const state = get();
        if (!state.project) return [];
        return state.getAllDiagrams().map(d => d.id);
      },

      getValidReferenceIds: () => {
        const state = get();
        if (!state.project) return [];
        return state.project.references.map(r => r.id);
      },

      // Template System actions
      loadBuiltInTemplates: () => {
        // This will be called on app initialization to load built-in templates
        // Built-in templates will be defined in src/data/templates/ in Phase 2
        // For now, set empty array (will be populated in Phase 6)
        set({ availableTemplates: [] });
      },

      createCustomTemplate: (templateData) => {
        const id = generateId();
        const now = new Date();
        const newTemplate: SpecificationTemplate = {
          ...templateData,
          id,
          createdAt: now,
          modifiedAt: now,
          isBuiltIn: false,
        };

        set((state) => ({
          availableTemplates: [...state.availableTemplates, newTemplate],
        }));

        return id;
      },

      updateCustomTemplate: (id, updates) => {
        set((state) => ({
          availableTemplates: state.availableTemplates.map((template) =>
            template.id === id && !template.isBuiltIn
              ? { ...template, ...updates, modifiedAt: new Date() }
              : template
          ),
        }));
      },

      deleteCustomTemplate: (id) => {
        set((state) => ({
          availableTemplates: state.availableTemplates.filter(
            (template) => template.id !== id || template.isBuiltIn
          ),
        }));
      },

      setActiveTemplate: (config) => {
        set({ activeTemplateConfig: config });
      },

      updateTemplateConfig: (updates) => {
        set((state) => {
          if (!state.activeTemplateConfig) return state;
          return {
            activeTemplateConfig: {
              ...state.activeTemplateConfig,
              ...updates,
            },
          };
        });
      },

      reorderSections: (sectionIds) => {
        set((state) => {
          if (!state.activeTemplateConfig) return state;
          return {
            activeTemplateConfig: {
              ...state.activeTemplateConfig,
              sectionOrder: sectionIds,
            },
          };
        });
      },

      toggleSection: (sectionId, enabled) => {
        set((state) => {
          if (!state.activeTemplateConfig) return state;

          const enabledSections = enabled
            ? [...state.activeTemplateConfig.enabledSections, sectionId]
            : state.activeTemplateConfig.enabledSections.filter(id => id !== sectionId);

          return {
            activeTemplateConfig: {
              ...state.activeTemplateConfig,
              enabledSections,
            },
          };
        });
      },

      // Store management
      resetStore: () => {
        set({
          project: null,
          activeTab: 'document',
          activeBlockDiagramId: null,
          activeMermaidDiagramId: null,
          sidebarOpen: true,
          previewMode: 'split',
          darkMode: false,
          aiConfig: null,
          chatHistory: [],
          activeTasks: [],
          pendingApprovals: [],
          isGenerating: false,
          currentTaskId: null,
          chatPanelOpen: false,
          usageStats: {
            totalTokens: 0,
            totalCost: 0,
            requestCount: 0,
            lastReset: new Date(),
          },
          versionHistory: {
            snapshots: [],
            currentSnapshotId: null,
          },
          availableTemplates: [],
          activeTemplateConfig: null,
        });
      },
    }),
    {
      name: 'tech-spec-project',
      version: 1,
      migrate: (persistedState: any, currentState: ProjectState) => {
        // Merge persisted state with current state
        const merged = { ...currentState, ...persistedState };

        // If no AI config in persisted state, try to load from environment
        if (!merged.aiConfig || !merged.aiConfig.apiKey) {
          const envConfig = createDefaultAIConfig();
          if (envConfig) {
            console.log('✅ Using AI config from environment variables (no valid config in localStorage)');
            merged.aiConfig = envConfig;
          }
        }

        // Always reset isGenerating flag on page load (prevents stuck state)
        merged.isGenerating = false;
        merged.currentTaskId = null;

        return merged;
      },
    }
  )
);
