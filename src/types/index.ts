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
  subtitle?: string;      // Secondary title for title page
  abstract?: string;      // Brief summary for Pandoc YAML front matter
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
  sourceSection?: { id: string; title: string }; // Technical Specification section this diagram was generated from
}

export interface MermaidDiagram {
  id: string;
  type: 'sequence' | 'flow' | 'state' | 'class';
  title: string;
  description?: string;
  figureNumber?: string;
  mermaidCode: string;
  sourceSection?: { id: string; title: string }; // Technical Specification section this diagram was generated from
}

// ========== References ==========

export interface ReferenceDocument {
  id: string;
  title: string;
  type: '3GPP' | 'PDF' | 'DOCX' | 'TXT' | 'MD' | 'URL' | 'Other';
  source: string; // URL, file path, or base64
  metadata?: {
    spec?: string; // e.g., "TS 23.203"
    version?: string;
    section?: string;
    tags?: string[];
  };
  content?: string; // extracted text for search

  // Multimodal PDF support (Phase 1)
  filename?: string;              // Original filename
  mimeType?: string;              // e.g., "application/pdf"
  size?: number;                  // File size in bytes
  uploadedAt?: Date;              // Upload timestamp
  dataRef?: string;               // IndexedDB key for large file data
  extractedText?: string;         // Fallback text extraction for non-vision models
  tokenEstimate?: number;         // Estimated token usage
  pageCount?: number;             // PDF page count for token estimation
}

// ========== Multimodal Content Types ==========

/**
 * Multimodal content part for OpenRouter API
 * Supports text, images, and PDF files
 */
export type MultimodalContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
  | { type: 'file'; file: { filename: string; file_data: string } };

/**
 * Extended AI message supporting multimodal content
 * Compatible with OpenRouter's universal file support
 */
export interface AIMessageMultimodal {
  role: 'system' | 'user' | 'assistant';
  content: string | MultimodalContentPart[];
}

/**
 * PDF processing engine options for OpenRouter
 */
export type PDFEngine = 'auto' | 'mistral-ocr' | 'pdf-text';

/**
 * Multimodal generation options
 */
export interface MultimodalGenerationOptions {
  pdfEngine?: PDFEngine;
  referenceDocuments?: ReferenceDocument[];
  useMultimodal?: boolean;  // Force multimodal even if model detection says otherwise
}

/**
 * Reference document content prepared for AI generation
 * Used when passing documents to the AI service
 */
export interface ReferenceDocumentContent {
  id: string;
  title: string;              // Display title for the document
  filename: string;
  mimeType: string;
  base64Data?: string;        // For multimodal (vision models)
  extractedText?: string;     // For text-only models
  tokenEstimate: number;
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
  markdownGuidance?: MarkdownGenerationGuidance | null; // Template-specific formatting guidance
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

// ========== Template System ==========

/**
 * Template section definition (LEGACY - kept for backward compatibility)
 * @deprecated Use FlexibleSection instead for new implementations
 */
export interface TemplateSectionDefinition {
  id: string;                    // "scope", "architecture", "procedures"
  number: string;                // "1", "4", "4.1"
  title: string;                 // "Scope", "Solution Architecture"
  description: string;           // Help text for users
  promptKey: string;             // Maps to prompt builder function
  required: boolean;             // Cannot be disabled
  allowSubsections: boolean;     // Let LLM create hierarchy
  defaultEnabled: boolean;       // Enabled in new templates
}

// ========== Flexible Section System (NEW) ==========

/**
 * Domain configuration for AI generation
 * Allows prompts to adapt to different industries/domains
 */
export interface DomainConfig {
  domain: string;                           // Free-form: "telecommunications", "software", "automotive", "medical", etc.
  industry?: string;                        // More specific: "5G networks", "embedded systems", "aerospace"
  standards?: string[];                     // Referenced standards: ["3GPP TS 23.501", "ISO 26262", "DO-178C"]
  terminology?: Record<string, string>;     // Custom term definitions: { "UE": "User Equipment" }
  normativeLanguage?: 'RFC2119' | 'IEEE' | 'ISO' | 'custom';  // Requirements language style
  customNormativeTerms?: {
    shall: string;    // e.g., "SHALL", "shall", "must"
    should: string;   // e.g., "SHOULD", "should", "recommended"
    may: string;      // e.g., "MAY", "may", "optional"
  };
}

/**
 * Flexible section definition
 * User-editable section that adapts to any domain
 */
export interface FlexibleSection {
  id: string;                              // Unique ID: "scope", "architecture", "custom-1"
  title: string;                           // Editable: "Scope", "System Architecture"
  description: string;                     // What this section should contain (editable by user)
  isRequired: boolean;                     // Suggestion only, user can override
  suggestedSubsections?: string[];         // Optional hints: ["Purpose", "Applicability", "Assumptions"]
  contentGuidance?: string;                // User's custom guidance for THIS section
  order: number;                           // Position in document (for reordering)
}

/**
 * Token estimation result
 * For warning when context exceeds model limits
 */
export interface TokenEstimate {
  systemPrompt: number;
  brsDocument: number;
  references: number;
  existingSpec: number;
  userGuidance: number;
  webSearchResults?: number;
  total: number;
}

/**
 * Token budget result with model limit comparison
 */
export interface TokenBudgetResult {
  withinBudget: boolean;
  totalTokens: number;
  availableTokens: number;
  usageByComponent: Record<string, number>;
  recommendations?: Record<string, number>;  // Recommended token counts if over budget
  percentUsed: number;
  // Legacy fields for backward compatibility
  estimate?: TokenEstimate;
  modelLimit?: number;
  warningThreshold?: number;    // 80% of model limit
  exceedsLimit?: boolean;
  exceedsWarning?: boolean;
}

/**
 * Web search result from Brave API or model built-in search
 */
export interface WebSearchResult {
  title: string;
  url: string;
  description: string;
  publishedDate?: string;
  source?: string;  // Hostname of the source
}

/**
 * Reference excerpt extracted when full documents exceed token limit
 */
export interface ExtractedExcerpt {
  referenceId: string;
  referenceTitle: string;
  content: string;
  relevanceScore: number;       // 0-1 relevance score
  matchedKeywords?: string[];   // Optional: keywords that matched
  startPosition?: number;       // Optional: start position in original
  endPosition?: number;         // Optional: end position in original
  tokenCount?: number;          // Optional: token count
}

/**
 * Context manager configuration
 */
export interface ContextManagerConfig {
  maxTotalTokens: number;        // Model's context limit
  reserveForOutput: number;      // Tokens to reserve for generation
  maxTokensPerReference?: number; // Max tokens per reference document (legacy)
  maxReferenceTokens?: number;   // Max tokens for all references combined
  minReferenceTokens?: number;   // Min tokens per reference
  excerptStrategy?: 'keyword' | 'section' | 'semantic';
  excerptOverlap?: number;       // Token overlap for context continuity
  priorities?: {                 // Priority weights for each component
    brs: number;
    previousSections: number;
    references: number;
    webSearch: number;
    userGuidance: number;
  };
}

/**
 * Complete template definition
 * Defines entire specification structure and formatting guidance
 */
export interface SpecificationTemplate {
  id: string;                    // "3gpp-ts", "ieee-830", "custom-01"
  name: string;                  // "3GPP Technical Specification"
  description: string;           // "Standard telecom spec format"
  domain: string;                // "telecommunications", "software", "general"
  version: string;               // "1.0"
  sections: TemplateSectionDefinition[];  // Legacy rigid sections
  suggestedSections?: FlexibleSection[];  // NEW: Flexible sections (preferred)
  formatGuidance: string;        // LLM instructions for format/style
  domainConfig?: DomainConfig;   // NEW: Domain-specific configuration
  createdAt: Date;
  modifiedAt: Date;
  isBuiltIn: boolean;            // Cannot be deleted/modified
}

/**
 * Flexible template definition (NEW)
 * Preferred format for new templates - fully customizable
 */
export interface FlexibleTemplate {
  id: string;
  name: string;
  description: string;
  domainConfig: DomainConfig;
  suggestedSections: FlexibleSection[];
  formatGuidance?: MarkdownGenerationGuidance;
  createdAt: Date;
  modifiedAt: Date;
  isBuiltIn: boolean;
}

/**
 * Section override for customizing title and description
 * Allows users to modify template sections without changing the template itself
 */
export interface SectionOverride {
  customTitle?: string;          // If set, overrides template section title
  customDescription?: string;    // If set, overrides template section description (AI guidance)
}

/**
 * Custom section created by user (not from template)
 * These are stored separately and merged with template sections during generation
 */
export interface CustomSection {
  id: string;                    // Format: "custom-{timestamp}"
  title: string;                 // User-defined title
  description: string;           // User-defined AI guidance
  isCustom: true;                // Discriminator for type narrowing
}

/**
 * Active project template configuration
 * User's customization of a template for a specific project
 */
export interface ProjectTemplateConfig {
  templateId: string;            // Which template to use
  enabledSections: string[];     // Which sections are active
  sectionOrder: string[];        // Custom ordering (includes both template and custom section IDs)
  customGuidance: string;        // Additional LLM instructions

  // NEW: Per-section customizations
  sectionOverrides?: Record<string, SectionOverride>;  // Key is section ID

  // NEW: Custom sections added by user
  customSections?: CustomSection[];
}

/**
 * Generated section result (for tracking)
 */
export interface GeneratedSection {
  number: string;
  title: string;
  content: string;
  tokensUsed: number;
}

// ========== DOCX Template Analysis ==========

/**
 * Complete DOCX template analysis result
 * Extracted from Word template to guide markdown generation
 */
export interface DocxTemplateAnalysis {
  id: string;
  filename: string;
  uploadedAt: Date;

  // Style analysis
  headingStyles: HeadingStyleInfo[];
  paragraphStyles: ParagraphStyleInfo[];
  captionStyles: CaptionStyleInfo;

  // Numbering analysis
  sectionNumbering: NumberingSchemeInfo;
  listNumbering: ListNumberingInfo;

  // Structure analysis
  documentStructure: DocumentStructureInfo;

  // Compatibility analysis
  compatibility: TemplateCompatibility;

  // Warnings
  warnings: TemplateWarning[];

  // Raw XML (for debugging)
  rawXml?: {
    styles?: string;
    numbering?: string;
    document?: string;
  };
}

/**
 * Heading style information extracted from template
 */
export interface HeadingStyleInfo {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  styleId: string; // e.g., "Heading1"
  font: string;
  fontSize: number; // points
  color: string;
  bold: boolean;
  numbering: {
    enabled: boolean;
    format: string; // "1", "1.1", "I", "A", etc.
    separator: string;
  };
  spacing: {
    beforePt: number;
    afterPt: number;
  };
}

/**
 * Paragraph style information
 */
export interface ParagraphStyleInfo {
  styleId: string;
  name: string;
  font: string;
  fontSize: number;
  alignment: 'left' | 'right' | 'center' | 'justify';
  lineSpacing: number; // e.g., 1.0, 1.5, 2.0
}

/**
 * Caption style configuration
 */
export interface CaptionStyleInfo {
  figureCaption: {
    exists: boolean;
    styleId?: string;
    format?: string; // e.g., "Figure %s: %s"
    numbering?: 'continuous' | 'per-section';
  };
  tableCaption: {
    exists: boolean;
    styleId?: string;
    format?: string;
    numbering?: 'continuous' | 'per-section';
  };
}

/**
 * Section numbering scheme information
 */
export interface NumberingSchemeInfo {
  detectedPattern: 'decimal' | 'multi-level' | 'mixed' | 'none';
  levels: {
    level: number;
    format: string; // "1", "%1.%2", etc.
    example: string; // "1.2.3"
  }[];
  recommendation: string; // Markdown guidance
}

/**
 * List numbering information
 */
export interface ListNumberingInfo {
  bulletStyle: string; // "-", "*", "•", etc.
  orderedStyle: 'decimal' | 'alpha' | 'roman';
}

/**
 * Document structure information
 */
export interface DocumentStructureInfo {
  hasTitlePage: boolean;
  titlePageElements: {
    hasTitle: boolean;
    hasVersion: boolean;
    hasDate: boolean;
    hasAuthor: boolean;
    hasCompany: boolean;
  };
  hasTOC: boolean;
  tocLocation: 'before-content' | 'after-content' | 'separate-page' | 'none';
  sectionBreaks: number;
  pageOrientation: 'portrait' | 'landscape';
  pageSize: 'A4' | 'Letter' | 'Legal' | 'Custom';
}

/**
 * Template compatibility assessment
 */
export interface TemplateCompatibility {
  pandocCompatible: boolean;
  compatibilityScore: number; // 0-100
  issues: CompatibilityIssue[];
  recommendations: string[];
}

/**
 * Compatibility issue detected in template
 */
export interface CompatibilityIssue {
  severity: 'error' | 'warning' | 'info';
  type: 'missing-style' | 'incompatible-numbering' | 'complex-layout' | 'unsupported-feature';
  description: string;
  affectedElements: string[];
  suggestion: string;
}

/**
 * Template warning
 */
export interface TemplateWarning {
  type: 'missing-heading-style' | 'no-caption-style' | 'inconsistent-numbering' | 'complex-structure';
  severity: 'high' | 'medium' | 'low';
  message: string;
  recommendation: string;
}

/**
 * Markdown generation guidance
 * Derived from template analysis to guide LLM output
 */
export interface MarkdownGenerationGuidance {
  headingLevels: {
    maxDepth: number; // Max heading level to use (e.g., 4)
    numberingStyle: string; // "Use # for level 1, ## for level 2, etc."
  };
  figureFormat: {
    captionPlacement: 'above' | 'below';
    numberingPattern: string; // "Figure 1-1: Title" or "Figure 1: Title"
    syntax: string; // "![Caption](path)" or custom
  };
  tableFormat: {
    captionPlacement: 'above' | 'below';
    numberingPattern: string;
    useMarkdownTables: boolean;
  };
  listFormat: {
    bulletChar: '-' | '*' | '+';
    orderedStyle: '1.' | '1)' | 'a.' | 'i.';
  };
  codeBlockStyle: {
    fenced: boolean; // Use ```code``` or indented
    languageHints: boolean; // ```typescript vs ```
  };
  emphasis: {
    bold: '**' | '__';
    italic: '*' | '_';
  };
  sectionBreaks: {
    usePageBreaks: boolean; // Include \pagebreak in markdown
    pattern: string; // "\\pagebreak" or "---"
  };
}

// ========== AI Structure Discovery ==========

/**
 * AI-proposed document section
 * Contains rationale and confidence for transparency
 */
export interface ProposedSection {
  id: string;                      // Unique ID: "proposed-scope", "proposed-arch-1"
  title: string;                   // Section title: "Scope and Objectives"
  description: string;             // What this section should cover
  rationale: string;               // Why AI proposed this section
  suggestedSubsections?: string[]; // Optional subsection hints
  order: number;                   // Position in document
  confidence: number;              // 0-1: AI's confidence in this recommendation
  sourceHints?: string[];          // BRS sections/references that informed this
}

/**
 * AI-inferred domain configuration
 * Detected from BRS analysis with reasoning
 */
export interface DomainInference {
  domain: string;                  // Primary domain: "telecommunications", "software"
  industry: string;                // Specific industry: "5G mobile networks"
  confidence: number;              // 0-1: confidence in inference
  reasoning: string;               // Why AI inferred this domain
  detectedStandards: string[];     // Standards found: ["3GPP TS 23.501", "RFC 8200"]
  suggestedTerminology: Record<string, string>; // Key terms detected: { "UE": "User Equipment" }
}

/**
 * Complete proposed document structure
 * AI's recommendation for spec organization
 */
export interface ProposedStructure {
  id: string;
  sections: ProposedSection[];
  domainConfig: DomainConfig;
  formatGuidance: string;          // AI's formatting recommendations
  rationale: string;               // Overall rationale for structure
  version: number;                 // Increments with each refinement
  createdAt: Date;
  lastModifiedAt: Date;
  generationGuidance?: string;     // User-provided guidance for spec generation
}

/**
 * Structure change from chat refinement
 * Tracks what changed and why
 */
export interface StructureChange {
  type: 'add' | 'remove' | 'modify' | 'reorder';
  sectionId: string;
  previousState?: Partial<ProposedSection>;
  newState?: Partial<ProposedSection>;
  reason: string;                  // AI's explanation of the change
}

/**
 * Structure refinement result from AI
 * Response from processStructureRefinement()
 */
export interface StructureRefinementResult {
  updatedStructure: ProposedStructure | null;  // null if no structural changes
  response: string;                             // AI's conversational response
  structureChanges: StructureChange[];          // What changed
  tokensUsed: number;
  cost: number;
}

/**
 * Structure planning session state
 * Manages the workflow from input → proposal → refinement → approval
 */
export interface StructurePlanningState {
  // Session status
  isPlanning: boolean;             // Planning session active
  planningStep: 'input' | 'analyzing' | 'reviewing' | 'approved';

  // Proposed structure
  proposedStructure: ProposedStructure | null;
  structureVersions: ProposedStructure[];  // History for undo

  // Domain inference
  inferredDomain: DomainInference | null;
  domainOverride: DomainConfig | null;     // User's manual override

  // Chat history (separate from main chat)
  planningChatHistory: AIMessage[];

  // Approval status
  structureApproved: boolean;
  approvedAt?: Date;

  // Generation context
  userGuidance: string;            // User's initial guidance prompt
  selectedTemplateId?: string;     // Optional: template used as starting point
}

/**
 * Structure proposal request parameters
 */
export interface StructureProposalParams {
  brsContent: string;
  referenceDocuments?: ReferenceDocument[];
  userGuidance: string;
  startingTemplateId?: string;     // Optional template to base structure on
}

/**
 * Structure proposal result from AI
 */
export interface StructureProposalResult {
  proposedStructure: ProposedStructure;
  domainInference: DomainInference;
  tokensUsed: number;
  cost: number;
}

/**
 * Structure refinement request parameters
 */
export interface StructureRefinementParams {
  currentStructure: ProposedStructure;
  chatHistory: AIMessage[];
  userMessage: string;
  domainConfig?: DomainConfig;
}
