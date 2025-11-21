# TechSpec Studio Documentation

This directory contains comprehensive documentation for the TechSpec Studio project, organized by category for easy navigation.

## 📚 Documentation Structure

### 🏗️ Architecture (`architecture/`)
High-level system design and integration documentation:
- **AI_COPILOT_ARCHITECTURE.md** - Complete AI integration design and workflows
- **PROJECT_SUMMARY.md** - High-level project overview and capabilities
- **IMPLEMENTATION_PROGRESS.md** - Phase-by-phase roadmap with completion status
- **FUTURE_CASCADED_REFINEMENT.md** - Design doc for future cascading refinement feature

### 📊 Phases (`phases/`)
Phase completion reports and status documentation:
- **PHASE2A_COMPLETE.md** - Phase 2A: Core AI Experience (Chat, Config, Markdown Editor)
- **PHASE2B_STATUS.md** - Phase 2B: BRS-to-TechSpec Pipeline
- **PHASE2B_TASK2_COMPLETE.md** - Detailed Phase 2B Task 2 completion
- **PHASE2C_COMPLETE.md** - Phase 2C: Approval Workflow & Version History
- **PHASE2C_TROUBLESHOOTING.md** - Phase 2C-specific troubleshooting guide
- **PHASE2_PROGRESS.md** - Overall Phase 2 progress tracking
- **PHASE3_PROGRESS.md** - Phase 3: Diagram Editing & Integration (75% complete)

### ✨ Features (`features/`)
Documentation of specific features and enhancements:

**Diagram Features:**
- **DIAGRAM_GENERATION_GUIDANCE_FEATURE.md** - User guidance for diagram generation
- **DIAGRAM_REVIEW_ENHANCEMENT.md** - Diagram preview in Review Panel (2025-11-19)
- **INTELLIGENT_DIAGRAM_GENERATION.md** - Two-tier diagram generation system (2025-11-19)

**Mermaid Self-Healing:**
- **MERMAID_SELF_HEALING.md** - AI-powered Mermaid syntax error recovery
- **MERMAID_SELF_HEALING_COMPLETE.md** - Complete Mermaid healing system
- **MERMAID_SELF_HEALING_DEBUG.md** - Debugging notes
- **MERMAID_SELF_HEALING_QUICKSTART.md** - Quick start guide
- **MERMAID_HEALING_IMPROVEMENTS.md** - Improvements and optimizations
- **MERMAID_SELF_HEALING_REVISION_PLAN.md** - Revision and enhancement plan

**Refinement Features:**
- **REFINEMENT_FIX.md** - Partial selection refinement implementation
- **REFINEMENT_APPROVAL_FIX.md** - Bug fix for refinement approvals (2025-11-14)

**TODO Features:**
- **TODO_COMMENT_EXTRACTION_FEATURE.md** - Extract diagram requirements from TODO comments
- **TODO_PRIORITY_ENHANCEMENT.md** - Give absolute priority to TODO comments (2025-11-19)

**Other Features:**
- **LINK_RESOLUTION_IMPLEMENTATION.md** - {{fig:...}} and {{ref:...}} link resolution
- **CLEAR_DATA_FEATURE.md** - Clear storage/config data features
- **TESTING_GUIDE.md** - Testing strategy and guidelines

### 🐛 Bug Fixes (`bugs-and-fixes/`)
Documentation of bugs, investigations, and fixes:

**Critical Fixes:**
- **SECTION_CONTENT_TRUNCATION_FIX.md** - Root cause: subsection content missing (2025-11-19)

**Cascade Refinement Issues:**
- **CASCADE_REFINEMENT_BUG_INVESTIGATION.md** - Investigation of cascaded refinement bugs
- **CASCADE_REFINEMENT_BUG_INVESTIGATION_INDEX.md** - Index of bug investigations
- **CASCADE_REFINEMENT_HEADING_LOSS_ROOT_CAUSE.md** - Root cause: heading loss in cascading
- **CASCADE_REFINEMENT_DATA_LOSS_FIX.md** - Bug fix: data loss in cascading
- **CASCADED_REFINEMENT_IMPLEMENTATION.md** - Full implementation with bug fixes

**Other Investigations:**
- **DIFF_VIEWER_INVESTIGATION_SUMMARY.md** - Investigation into diff viewer behavior
- **INVESTIGATION_SUMMARY.md** - General investigation summary
- **SEQUENTIAL_WORKFLOW_IMPLEMENTATION.md** - Sequential workflow implementation

### 📅 Sessions (`sessions/`)
Daily development session summaries:
- **SESSION_2025-11-14_SUMMARY.md** - Session summary from 2025-11-14
- **SESSION_2025-11-19_SUMMARY.md** - **Latest session** with diagram preview, two-tier generation, TODO extraction, and section content aggregation

### 🛠️ Tools (`tools/`)
HTML utility tools for development and debugging:
- **clear-config.html** - Clear AI configuration from localStorage
- **clear-storage.html** - Clear all TechSpec Studio storage
- **emergency-storage-fix.html** - Emergency storage recovery tool
- **test.html** - Basic HTML test utility
- **test-darkmode.html** - Dark mode testing utility

See [tools/README.md](tools/README.md) for detailed tool descriptions.

## 🚀 Quick Links

### For New Developers
1. Start with [../QUICK_START.md](../QUICK_START.md) - 5-minute setup guide
2. Read [../CLAUDE.md](../CLAUDE.md) - Complete guidance for AI assistants
3. Check [architecture/IMPLEMENTATION_PROGRESS.md](architecture/IMPLEMENTATION_PROGRESS.md) - Roadmap and status

### For Troubleshooting
1. Check [../TROUBLESHOOTING.md](../TROUBLESHOOTING.md) - Common issues and solutions
2. Review [phases/PHASE2C_TROUBLESHOOTING.md](phases/PHASE2C_TROUBLESHOOTING.md) - Phase 2C specific issues

### Latest Features (November 2025)
- [features/DIAGRAM_REVIEW_ENHANCEMENT.md](features/DIAGRAM_REVIEW_ENHANCEMENT.md) - Preview diagrams before approving
- [features/INTELLIGENT_DIAGRAM_GENERATION.md](features/INTELLIGENT_DIAGRAM_GENERATION.md) - Mandatory vs suggested diagrams
- [features/TODO_PRIORITY_ENHANCEMENT.md](features/TODO_PRIORITY_ENHANCEMENT.md) - TODO comment priority
- [bugs-and-fixes/SECTION_CONTENT_TRUNCATION_FIX.md](bugs-and-fixes/SECTION_CONTENT_TRUNCATION_FIX.md) - Critical context fix

### Critical Architecture
- [architecture/AI_COPILOT_ARCHITECTURE.md](architecture/AI_COPILOT_ARCHITECTURE.md) - AI service design
- [architecture/PROJECT_SUMMARY.md](architecture/PROJECT_SUMMARY.md) - Project overview

## 📖 Documentation Standards

When adding new documentation:
- Place in appropriate subdirectory based on category
- Use descriptive filenames (FEATURE_NAME_TYPE.md)
- Include status (PLANNED, IN PROGRESS, COMPLETE) in content
- Add entry to this README.md
- Cross-reference related documents
- Include date stamps for time-sensitive content

## 🔍 Finding Documentation

**By Topic:**
- Architecture & Design → `architecture/`
- Phase status & completion → `phases/`
- Features & enhancements → `features/`
- Bugs & fixes → `bugs-and-fixes/`
- Historical sessions → `sessions/`
- Dev tools → `tools/`

**By Status:**
- ✅ Complete features → `features/` with "COMPLETE" in doc
- 🚧 In progress → `phases/` with percentage complete
- 📋 Planned → `architecture/FUTURE_*.md`
- 🐛 Fixed bugs → `bugs-and-fixes/` with "FIX" in filename

## 📝 Contributing to Documentation

When documenting new work:
1. Create markdown file in appropriate subdirectory
2. Follow naming convention: `FEATURE_NAME_TYPE.md`
3. Include metadata: Status, Date, Author
4. Add cross-references to related docs
5. Update this README.md with new entry
6. Update `../CLAUDE.md` if architecture-relevant

---

**Last Updated:** 2025-11-20
**Documentation Files:** 42 files across 6 categories
**Project Phase:** Phase 3 (75% complete)
