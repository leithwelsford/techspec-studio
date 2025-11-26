# Outstanding Development Work

**Last Updated**: 2025-11-26
**Current Phase**: Phase 4 Complete ✅

---

## 🎉 What's Already Complete

### Core Application (Phases 1-4) ✅
- ✅ **Phase 1**: Foundation (types, store, dependencies, persistence)
- ✅ **Phase 1.5**: AI Service Layer (OpenRouter, prompts, parsers, encryption)
- ✅ **Phase 2A**: Core AI Experience (Workspace, ChatPanel, MarkdownEditor, AIConfig)
- ✅ **Phase 2B**: BRS-to-TechSpec Pipeline (upload, generation, diagrams)
- ✅ **Phase 2C**: Approval Workflow & Version History (ReviewPanel, DiffViewer, snapshots)
- ✅ **Phase 3**: Diagram Editing & Integration (editors, link resolution, auto-numbering, autocomplete)
- ✅ **Phase 4**: Export & Finalization (DOCX export, diagram export, TOC/figures/bibliography)
- ✅ **Pandoc Export**: Professional DOCX export with Word templates (backend service)

**Total Implementation**: ~15,000+ lines of code across 50+ files

---

## 🚧 Outstanding Development Work

### 1. Pandoc Export - Double Numbering Issue (HIGH PRIORITY)

**Status**: Implementation complete, formatting issue identified, awaiting solution selection

**Problem**: DOCX output shows double numbering (e.g., "1 1 Ethio Telecom" instead of "1 Ethio Telecom")

**Root Cause**: Word template has automatic numbering in heading styles that conflicts with manual markdown numbering

**Investigation**: Complete analysis in [docs/features/PANDOC_DOUBLE_NUMBERING_INVESTIGATION.md](features/PANDOC_DOUBLE_NUMBERING_INVESTIGATION.md)

**Solution Options**:

1. **Option 1: Modify Word Template** (RECOMMENDED)
   - Remove automatic numbering from Heading 1-6 styles in template
   - Preserves all other template formatting (fonts, colors, headers, footers)
   - No code changes required
   - **Action**: Edit `SPD_Customer_ProjectName_2018_BFP.docx` in Microsoft Word

2. **Option 2: Strip Manual Numbering from Markdown**
   - Remove manual numbering from markdown before export
   - Let template handle numbering automatically
   - **Action**: Add `stripManualNumbering()` function to `pandocExport.ts`

3. **Option 3: Create Two Template Versions**
   - Provide template with numbering and template without numbering
   - User chooses at export time
   - **Action**: Create duplicate template, add UI option

4. **Option 4: Add UI Controls for Numbering Mode**
   - Radio buttons: "Use markdown numbering" vs "Use template numbering"
   - Conditional markdown stripping based on user choice
   - **Action**: Modify ExportModal.tsx and pandocExport.ts

**Estimated Effort**:
- Option 1: 15-30 minutes (template modification)
- Option 2: 2-4 hours (code implementation + testing)
- Option 3: 1-2 hours (template + UI)
- Option 4: 3-5 hours (full implementation)

**Files to Modify** (if code solution chosen):
- `src/utils/pandocExport.ts` - Add numbering strip logic
- `src/components/ExportModal.tsx` - Add UI controls (Options 3 or 4)

---

### 2. Reference Document Management (MEDIUM PRIORITY)

**Status**: Type system defined, store actions created, UI not implemented

**What Exists**:
- ✅ `ReferenceDocument` type in `src/types/index.ts`
- ✅ Store actions: `addReference()`, `updateReference()`, `deleteReference()`
- ✅ DOCX parsing library installed (`mammoth`)

**What's Missing**:
- [ ] References tab UI in Workspace
- [ ] Upload 3GPP DOCX files
- [ ] Parse DOCX content with `mammoth`
- [ ] Display reference list
- [ ] Search/filter references
- [ ] Show reference details
- [ ] Link resolution for `{{ref:...}}` in preview (partially implemented)

**User Story**:
```
As a technical writer, I want to upload 3GPP specification documents
so that I can reference them in my technical specification
and the AI can use them for context when generating content.
```

**Estimated Effort**: 8-12 hours

**Files to Create**:
- `src/components/ReferencesPanel.tsx` - References tab UI
- `src/components/ReferenceUpload.tsx` - DOCX file upload
- `src/components/ReferenceViewer.tsx` - Display reference content
- `src/utils/docxParser.ts` - Parse DOCX with mammoth

**Files to Modify**:
- `src/components/Workspace.tsx` - Add References tab
- `src/utils/remarkLinkResolver.ts` - Complete reference resolution

---

### 3. Change Propagation (LOW PRIORITY)

**Status**: Planned feature, design documented, not implemented

**Purpose**: Automatically detect when changes in one part of the specification affect other parts

**Use Cases**:
- Rename component in spec → AI suggests updating all diagrams
- Add new component to block diagram → AI suggests spec update
- Change procedure flow → AI suggests sequence diagram update
- Remove architecture element → AI suggests removing related sections

**Design Document**: [docs/architecture/FUTURE_CASCADED_REFINEMENT.md](architecture/FUTURE_CASCADED_REFINEMENT.md)

**What's Needed**:
- [ ] AI service: `detectRelatedChanges()` method
- [ ] "Check Consistency" button in Workspace header
- [ ] "Related Changes Detected" banner
- [ ] Review suggested changes via approval workflow
- [ ] Apply changes atomically

**Estimated Effort**: 16-24 hours (complex AI integration)

**Files to Create**:
- `src/services/ai/changeDetector.ts` - Change detection logic
- `src/components/ConsistencyChecker.tsx` - UI for reviewing changes

**Files to Modify**:
- `src/services/ai/AIService.ts` - Add `detectRelatedChanges()` method
- `src/services/ai/prompts/systemPrompts.ts` - Add change detection prompt
- `src/components/Workspace.tsx` - Add "Check Consistency" button

---

### 4. 3GPP Reference URL Fetching (LOW PRIORITY)

**Status**: Planned feature, not implemented

**Purpose**: Fetch 3GPP specifications directly from 3gpp.org instead of requiring manual upload

**Current**: User must manually download DOCX, then upload to TechSpec Studio

**Desired**: User enters 3GPP spec number (e.g., "TS 23.203"), app fetches automatically

**Challenges**:
- 3GPP website structure may change
- CORS restrictions on direct browser fetch
- May require backend proxy service
- Authentication/rate limiting considerations

**Estimated Effort**: 6-10 hours (with backend proxy)

**Files to Create**:
- `server/3gpp-proxy.js` - Backend proxy for fetching 3GPP docs
- `src/services/3gppFetcher.ts` - Frontend API client

**Files to Modify**:
- `src/components/ReferencesPanel.tsx` - Add "Fetch from 3GPP" option
- `docker-compose.yml` - Add 3GPP proxy service

---

### 5. Multi-Document Projects (FUTURE)

**Status**: Conceptual, no implementation

**Purpose**: Manage multiple related specifications in a single project

**Use Cases**:
- System Specification + Interface Specifications
- Parent Spec + Child Specs (modular approach)
- Specification Suite (multiple related documents)

**What's Needed**:
- [ ] Project type system (single vs multi-document)
- [ ] Document tree navigation
- [ ] Cross-document references
- [ ] Export all documents
- [ ] Import/export project bundles

**Estimated Effort**: 40-60 hours (major feature)

---

### 6. Collaboration Features (FUTURE)

**Status**: Conceptual, no implementation

**Purpose**: Enable team collaboration on specifications

**Features**:
- [ ] Real-time co-editing (using WebSockets or OT/CRDT)
- [ ] Comments and annotations
- [ ] Review assignments
- [ ] Change tracking (beyond current version history)
- [ ] Role-based permissions (author, reviewer, approver)
- [ ] Conflict resolution

**Estimated Effort**: 100+ hours (requires backend infrastructure)

---

### 7. Version Control Integration (FUTURE)

**Status**: Conceptual, no implementation

**Purpose**: Git integration for specification versioning

**Features**:
- [ ] Initialize Git repo for project
- [ ] Commit changes with messages
- [ ] Branch management
- [ ] Diff visualization between branches
- [ ] Merge conflict resolution
- [ ] Push/pull from remote (GitHub, GitLab)

**Estimated Effort**: 30-50 hours

---

### 8. Template Customization (LOW PRIORITY)

**Status**: Built-in templates exist, custom template creation not fully implemented

**Current**:
- ✅ 3 built-in templates (3GPP, IEEE 830, ISO 29148)
- ✅ Template selection and section customization
- ❌ Create custom templates from scratch
- ❌ Edit existing templates
- ❌ Import/export templates

**What's Needed**:
- [ ] Template editor UI
- [ ] Custom section definition
- [ ] Template validation
- [ ] Template library/marketplace
- [ ] Import/export template files

**Estimated Effort**: 12-20 hours

**Files to Create**:
- `src/components/TemplateEditor.tsx` - Template creation UI
- `src/components/TemplateSectionBuilder.tsx` - Section definition UI

**Files to Modify**:
- `src/store/projectStore.ts` - Template CRUD operations
- `src/data/templates/index.ts` - Template import/export utilities

---

### 9. Advanced Diagram Features (FUTURE)

**Status**: Basic diagram editing complete, advanced features planned

**Block Diagrams**:
- [ ] Auto-layout algorithms (force-directed, hierarchical)
- [ ] Edge routing improvements (orthogonal with automatic waypoints)
- [ ] Grouping and nesting (containers, swimlanes)
- [ ] Export to other formats (PlantUML, DrawIO)
- [ ] Import from other tools

**Sequence Diagrams**:
- [ ] Live collaboration on diagrams
- [ ] Diagram versioning and diff
- [ ] Complex interactions (loops, alternatives, parallel)
- [ ] Timing constraints visualization

**Flow Diagrams**:
- [ ] Dedicated FlowDiagramEditor (currently reusing SequenceDiagramEditor)
- [ ] Flowchart-specific templates
- [ ] State machine validation
- [ ] Simulation/walkthrough mode

**Estimated Effort**: 50+ hours

---

### 10. AI Model Improvements (ONGOING)

**Status**: Basic AI integration complete, enhancements ongoing

**Current**:
- ✅ OpenRouter integration (50+ models)
- ✅ Streaming responses
- ✅ Token tracking and cost estimation
- ✅ Context building from spec + diagrams
- ✅ Placeholder detection

**Enhancements Needed**:
- [ ] Model-specific prompt optimization
- [ ] Fine-tuning for telecom domain
- [ ] Custom model hosting (local LLM support)
- [ ] Multi-model ensemble (best of N)
- [ ] Caching and response reuse
- [ ] Prompt template versioning
- [ ] A/B testing different prompts

**Estimated Effort**: Ongoing (continuous improvement)

---

### 11. Export Format Enhancements (MEDIUM PRIORITY)

**Status**: DOCX and diagram export complete, additional formats desired

**Current**:
- ✅ DOCX export with template support
- ✅ Pandoc backend for professional DOCX
- ✅ SVG/PNG diagram export

**Desired Formats**:
- [ ] PDF export (direct, not via DOCX)
- [ ] HTML export (styled, self-contained)
- [ ] LaTeX export (for academic/scientific use)
- [ ] Markdown export (with embedded diagrams)
- [ ] EPUB export (for e-readers)
- [ ] Confluence/Notion export (wiki formats)

**Estimated Effort**: 8-16 hours per format

**Files to Create**:
- `src/utils/pdfExport.ts` - PDF generation (using jsPDF or similar)
- `src/utils/htmlExport.ts` - Styled HTML export
- `src/utils/latexExport.ts` - LaTeX conversion
- `src/utils/markdownExport.ts` - Markdown bundle export

---

### 12. Performance Optimization (LOW PRIORITY)

**Status**: App is performant for typical use, optimization opportunities exist

**Known Issues**:
- Large specifications (100+ pages) may slow down editor
- Multiple diagrams rendering simultaneously can lag
- localStorage has size limits (mitigated by IndexedDB)

**Optimization Opportunities**:
- [ ] Virtualize long markdown editor (only render visible lines)
- [ ] Lazy load diagrams (render on-demand)
- [ ] Web Worker for AI calls (non-blocking)
- [ ] Service Worker for offline support
- [ ] Code splitting and dynamic imports
- [ ] Memoization for expensive computations

**Estimated Effort**: 10-15 hours

---

### 13. Testing & Quality Assurance (MEDIUM PRIORITY)

**Status**: Manual testing only, automated tests not implemented

**What Exists**:
- ✅ TypeScript type checking
- ✅ ESLint for code quality
- ✅ Manual testing during development

**What's Needed**:
- [ ] Unit tests for utilities (Jest)
- [ ] Component tests (React Testing Library)
- [ ] Integration tests for workflows
- [ ] E2E tests (Playwright or Cypress)
- [ ] Visual regression tests
- [ ] Performance benchmarks
- [ ] Accessibility testing (WCAG compliance)

**Estimated Effort**: 30-50 hours (ongoing)

**Files to Create**:
- `src/**/*.test.ts` - Unit tests for all utilities
- `src/**/*.test.tsx` - Component tests
- `tests/e2e/` - End-to-end test suites
- `tests/integration/` - Integration tests

---

### 14. Documentation & Onboarding (ONGOING)

**Status**: Developer documentation excellent, user documentation minimal

**Current**:
- ✅ CLAUDE.md (AI assistant guidance)
- ✅ README.md (project overview)
- ✅ QUICK_START.md (5-minute setup)
- ✅ TROUBLESHOOTING.md (common issues)
- ✅ Comprehensive docs/ folder (42+ files)

**User Documentation Needed**:
- [ ] User guide (step-by-step tutorials)
- [ ] Video tutorials (screen recordings)
- [ ] In-app help system (tooltips, hints)
- [ ] Sample projects/templates
- [ ] Best practices guide
- [ ] FAQ section
- [ ] Migration guide (from other tools)

**Estimated Effort**: 20-30 hours

---

### 15. Deployment & DevOps (MEDIUM PRIORITY)

**Status**: Docker Compose setup exists, production deployment not configured

**Current**:
- ✅ Development Docker setup (docker-compose.yml)
- ✅ Vite build system
- ✅ Node.js backend (Pandoc service)

**Production Deployment Needs**:
- [ ] Production Dockerfile (optimized builds)
- [ ] CI/CD pipeline (GitHub Actions, GitLab CI)
- [ ] Deployment to cloud (AWS, GCP, Azure, Vercel, Netlify)
- [ ] Environment configuration (staging, production)
- [ ] Monitoring and logging (Sentry, LogRocket)
- [ ] Database setup (if moving away from localStorage)
- [ ] Backup and restore procedures
- [ ] SSL/TLS certificates
- [ ] CDN for static assets

**Estimated Effort**: 15-25 hours

---

## 📊 Priority Summary

### High Priority (Do First)
1. ✅ **Pandoc Double Numbering** - Choose solution and implement (0.5-5 hours)

### Medium Priority (Do Next)
2. **Reference Document Management** - Upload and parse 3GPP specs (8-12 hours)
3. **Export Format Enhancements** - PDF, HTML export (8-16 hours per format)
4. **Testing & QA** - Unit and integration tests (30-50 hours)
5. **Deployment** - Production setup and CI/CD (15-25 hours)

### Low Priority (Nice to Have)
6. **Change Propagation** - AI-powered consistency checking (16-24 hours)
7. **Template Customization** - Custom template creation (12-20 hours)
8. **3GPP URL Fetching** - Auto-fetch specs from 3gpp.org (6-10 hours)
9. **Performance Optimization** - Virtualization, lazy loading (10-15 hours)

### Future (Deferred)
10. **Multi-Document Projects** - Project management (40-60 hours)
11. **Collaboration Features** - Real-time co-editing (100+ hours)
12. **Version Control Integration** - Git integration (30-50 hours)
13. **Advanced Diagrams** - Auto-layout, complex interactions (50+ hours)

### Ongoing
14. **AI Model Improvements** - Continuous optimization
15. **Documentation** - User guides and tutorials (20-30 hours)

---

## 🎯 Recommended Next Steps

1. **Immediate (Today)**:
   - Decide on Pandoc numbering solution (Option 1 recommended)
   - Implement chosen solution
   - Test with real Word template
   - Mark Pandoc implementation as 100% complete

2. **This Week**:
   - Implement References tab UI
   - Add 3GPP DOCX upload and parsing
   - Test reference linking in preview

3. **This Month**:
   - Add PDF export functionality
   - Set up CI/CD pipeline
   - Write unit tests for utilities
   - Create user documentation

4. **This Quarter**:
   - Implement change propagation
   - Add template customization
   - Performance optimization
   - Deploy to production

---

## 📈 Project Maturity Assessment

**Current Maturity**: **Beta** (80-90%)

**Why Beta**:
- ✅ Core features complete and working
- ✅ Major workflows tested and functional
- ✅ Professional export capabilities
- ✅ AI integration robust and reliable
- ❌ Some polish features missing (references, advanced export)
- ❌ Limited automated testing
- ❌ Production deployment not configured
- ❌ User documentation minimal

**Path to v1.0 Release**:
1. Fix Pandoc numbering issue ✅ (Ready)
2. Add References management (Medium)
3. Add automated tests (Medium)
4. Production deployment (Medium)
5. User documentation (Medium)
6. Beta user testing (1-2 weeks)
7. Bug fixes from beta testing
8. **v1.0 Release** 🎉

**Estimated Time to v1.0**: 4-8 weeks (with dedicated development)

---

**Last Updated**: 2025-11-26
**Next Review**: After Pandoc issue resolution
