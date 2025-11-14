/**
 * Technical Specification Authoring System - Type Definitions
 */

// ========== Core Types ==========

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

// ========== Project & Document ==========

export interface Project {
  id: string;
  name: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  brsDocument?: BRSDocument; // Source requirements (markdown from customer PDF)
  specification: SpecDocument;
  blockDiagrams: BlockDiagram[];
  sequenceDiagrams: MermaidDiagram[];
  flowDiagrams: MermaidDiagram[];
  references: ReferenceDocument[];
  docxTemplate?: string; // base64 or path
}

export interface SpecDocument {
  id: string;
  title: string;
  markdown: string;
  metadata: DocumentMetadata;
}

export interface DocumentMetadata {
  author?: string;
  date?: string;
  version?: string;
  customer?: string;
  approvers?: Approver[];
  revisions?: Revision[];
}

export interface Approver {
  name: string;
  title: string;
  date?: string;
}

export interface Revision {
  version: string;
  author: string;
  changes: string;
  date: string;
}

// ========== Diagrams ==========

export type NodeShape = "rect" | "cloud";

export interface NodeMeta {
  label: string;
  shape: NodeShape;
}

export type EdgeStyle = "bold" | "solid" | "dashed";

export interface EdgeDef {
  from: string;
  to: string;
  label?: string;
  style?: EdgeStyle;
}

export interface BlockDiagram {
  id: string;
  title: string;
  description?: string;
  figureNumber?: string; // e.g., "4-1"

  // Visual layout
  nodes: Record<string, NodeMeta>;
  edges: EdgeDef[];
  positions: Record<string, Point>;
  sizes: Record<string, Size>;

  // Additional metadata
  sepY?: number; // horizontal separator position
  labelOffsets?: Record<string, { dx: number; dy: number }>;
}

export interface MermaidDiagram {
  id: string;
  type: 'sequence' | 'flow' | 'state' | 'class';
  title: string;
  description?: string;
  figureNumber?: string;
  mermaidCode: string;
}

// ========== References ==========

export interface ReferenceDocument {
  id: string;
  title: string;
  type: '3GPP' | 'PDF' | 'DOCX' | 'URL' | 'Other';
  source: string; // URL, file path, or base64
  metadata?: {
    spec?: string; // e.g., "TS 23.203"
    version?: string;
    section?: string;
    tags?: string[];
  };
  content?: string; // extracted text for search
}

// ========== Business Requirements ==========

/**
 * BRSDocument - Business Requirement Specification
 *
 * Input format: Markdown (.md) file converted from customer-provided PDF (often scanned)
 * Workflow: Customer PDF → External conversion → Markdown → Upload to tool
 */
export interface BRSDocument {
  id: string;
  title: string;
  filename: string; // Original filename (e.g., "Customer_BRS_v2.md")
  markdown: string; // Full markdown content
  uploadedAt: Date;
  metadata: BRSMetadata;
  structuredData?: BRSStructuredData; // Optional AI-extracted structure
}

export interface BRSMetadata {
  customer?: string;
  version?: string;
  date?: string;
  author?: string;
  projectName?: string;
  tags?: string[];
}

/**
 * BRSStructuredData - AI-extracted structure from markdown
 * Used to generate technical specification sections
 */
export interface BRSStructuredData {
  requirements: BRSRequirement[];
  architectureDescriptions: string[];
  procedureDescriptions: string[];
  referencedStandards: string[]; // e.g., ["TS 23.401", "TS 23.203"]
  keyComponents: string[]; // Network elements mentioned
  interfaces: string[]; // Reference points mentioned
}

export interface BRSRequirement {
  id: string;
  type: 'functional' | 'architecture' | 'procedure' | 'performance' | 'security' | 'other';
  text: string;
  priority?: 'must' | 'should' | 'may';
  section?: string; // Section in BRS where it appears
  relatedRequirements?: string[]; // IDs of related requirements
}

// ========== Workspace ==========

export type WorkspaceTab = 'document' | 'block-diagrams' | 'sequence-diagrams' | 'flow-diagrams' | 'references' | 'preview' | 'export';

export interface WorkspaceState {
  activeTab: WorkspaceTab;
  activeBlockDiagram?: string; // ID of currently editing block diagram
  activeMermaidDiagram?: string; // ID of currently editing mermaid diagram
  previewMode: 'split' | 'full';
  sidebarOpen: boolean;
}

// ========== Export ==========

export interface ExportOptions {
  format: 'markdown' | 'html' | 'pdf' | 'docx';
  includeImages: boolean;
  autoNumberFigures: boolean;
  generateTOC: boolean;
  embedReferences: boolean;
  imageFormat?: 'svg' | 'png';
  docxTemplate?: string;
}

// ========== Linking ==========

export interface DiagramReference {
  id: string;
  type: 'block' | 'sequence' | 'flow';
  figureNumber: string;
  title: string;
}

export interface DocumentLink {
  type: 'figure' | 'reference' | 'section';
  target: string; // diagram ID or reference ID
  text: string; // display text
  position: { line: number; column: number };
}

// ========== AI Co-Pilot ==========

export type AIProvider = 'openrouter';

export type AIModel =
  | 'anthropic/claude-3.5-sonnet'
  | 'anthropic/claude-3-opus'
  | 'anthropic/claude-3-haiku'
  | 'openai/gpt-4-turbo'
  | 'openai/gpt-4'
  | 'openai/gpt-3.5-turbo'
  | 'google/gemini-pro'
  | 'meta-llama/llama-3-70b-instruct'
  | string; // Allow custom models

export interface AIConfig {
  provider: AIProvider;
  apiKey: string; // Encrypted when stored
  model: AIModel;
  temperature: number;
  maxTokens: number;
  enableStreaming: boolean;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost?: number; // USD
  attachments?: AIAttachment[];
}

export interface AIAttachment {
  type: 'reference' | 'diagram' | 'section';
  id: string;
  title: string;
  preview?: string;
}

export type AITaskType =
  | 'generate-document'
  | 'generate-section'
  | 'refine-section'
  | 'generate-block-diagram'
  | 'generate-sequence-diagram'
  | 'generate-flow-diagram'
  | 'review-content'
  | 'suggest-improvements'
  | 'extract-references';

export interface AITask {
  id: string;
  type: AITaskType;
  status: 'pending' | 'generating' | 'complete' | 'error';
  prompt: string;
  context?: AIContext;
  output?: AITaskOutput;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface AIContext {
  brsDocument?: BRSDocument; // Source requirements for spec generation
  currentDocument?: string;
  selectedSection?: string;
  availableDiagrams?: DiagramReference[];
  availableReferences?: ReferenceDocument[];
  userInstructions?: string;
}

export type AITaskOutput =
  | string // Markdown content
  | BlockDiagram
  | MermaidDiagram
  | { suggestions: string[] };

export interface PendingApproval {
  id: string;
  taskId: string;
  type: 'document' | 'section' | 'diagram' | 'refinement' | 'cascaded-refinement';
  status: 'pending' | 'approved' | 'rejected';
  originalContent?: string;
  generatedContent: any;
  diff?: string;
  feedback?: string;
  createdAt: Date;
  reviewedAt?: Date;
}

// ========== Cascaded Refinement Types ==========

export interface ImpactAnalysis {
  affectedSections: AffectedSection[];
  totalImpact: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  reasoning: string;
}

export interface AffectedSection {
  sectionId: string;
  sectionTitle: string;
  impactLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  impactType: 'REMOVE' | 'MODIFY' | 'NONE';
  reasoning: string;
}

export interface PropagatedChange {
  sectionId: string;
  sectionTitle: string;
  actionType: 'REMOVE_SECTION' | 'MODIFY_SECTION' | 'NONE';
  originalContent: string;
  proposedContent: string;
  reasoning: string;
  impactLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number; // 0-1, AI's confidence in this change
  isSelected: boolean; // User can deselect changes they don't want
}

export interface CascadedRefinementApproval extends PendingApproval {
  type: 'cascaded-refinement';
  primaryChange: {
    sectionId: string;
    sectionTitle: string;
    originalContent: string;
    refinedContent: string;
  };
  propagatedChanges: PropagatedChange[];
  instruction: string;
  tokensUsed: number;
  costIncurred: number;
}

export interface ValidationResult {
  isConsistent: boolean;
  issues: ValidationIssue[];
  warnings: string[];
}

export interface ValidationIssue {
  type: 'CONTRADICTION' | 'ORPHANED_REFERENCE' | 'TERMINOLOGY_MISMATCH';
  description: string;
  affectedSections: string[];
  severity: 'ERROR' | 'WARNING';
}

export interface AIUsageStats {
  totalTokens: number;
  totalCost: number;
  requestCount: number;
  lastReset: Date;
}

// ========== AI State ==========

export interface AIState {
  config: AIConfig | null;
  chatHistory: AIMessage[];
  activeTasks: AITask[];
  pendingApprovals: PendingApproval[];
  isGenerating: boolean;
  currentTaskId: string | null;
  usageStats: AIUsageStats;
}

// ========== Version History ==========

export type VersionChangeType =
  | 'specification-edit'
  | 'specification-generation'
  | 'diagram-add'
  | 'diagram-edit'
  | 'diagram-delete'
  | 'ai-refinement'
  | 'manual-edit'
  | 'approval-applied';

export interface VersionSnapshot {
  id: string;
  projectId: string;
  timestamp: Date;
  changeType: VersionChangeType;
  description: string;
  author: 'user' | 'ai';

  // Snapshot data
  specification?: {
    markdown: string;
    metadata: DocumentMetadata;
  };
  blockDiagrams?: BlockDiagram[];
  sequenceDiagrams?: MermaidDiagram[];
  flowDiagrams?: MermaidDiagram[];

  // Metadata
  tokensUsed?: number;
  costIncurred?: number;
  relatedTaskId?: string;
  relatedApprovalId?: string;
}

export interface VersionHistory {
  snapshots: VersionSnapshot[];
  currentSnapshotId: string | null;
}
