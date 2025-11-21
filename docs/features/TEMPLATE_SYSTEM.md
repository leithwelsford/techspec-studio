# Template System for Flexible Specification Generation

**Feature Status:** ✅ **COMPLETE** (2025-11-21)
**Phase:** Post-Phase 3 Enhancement
**Completion:** 100% (16/16 tasks)

## Overview

The Template System enables users to generate technical specifications using customizable, industry-standard templates. Users can select from built-in templates (3GPP, IEEE 830, ISO 29148) or create custom templates, then customize which sections to include, their order, and provide generation guidance.

## Key Features

### 1. Multi-Template Support
- **3GPP Technical Specification** - Telecommunications (9 sections)
- **IEEE 830 SRS** - Software requirements (9 sections)
- **ISO/IEC/IEEE 29148** - General requirements (7 sections)
- Extensible architecture for custom templates

### 2. Section Customization
- **Enable/Disable** individual sections (with required section protection)
- **Drag-and-Drop Reordering** using @dnd-kit library
- **Custom Guidance** per template configuration
- **Real-time Preview** of enabled sections

### 3. Sequential Generation
- Each section receives previous sections as context
- Maintains consistency across entire document
- Progress tracking with section-by-section feedback
- Proper token management for reasoning models

### 4. Template Inheritance
- Default templates are marked as `isBuiltIn: true` (read-only)
- Custom templates can extend or modify built-in templates
- Per-project template configurations
- Automatic migration for existing projects

## Implementation

### File Structure

```
src/
├── types/index.ts                              # 4 new interfaces (lines 425-478)
│   ├── TemplateSectionDefinition
│   ├── SpecificationTemplate
│   ├── ProjectTemplateConfig
│   └── GeneratedSection
│
├── store/projectStore.ts                       # Template state + 8 actions
│   ├── availableTemplates: SpecificationTemplate[]
│   ├── activeTemplateConfig: ProjectTemplateConfig | null
│   └── Actions:
│       ├── loadBuiltInTemplates()
│       ├── createCustomTemplate(data)
│       ├── updateCustomTemplate(id, updates)
│       ├── deleteCustomTemplate(id)
│       ├── setActiveTemplate(config)
│       ├── updateTemplateConfig(updates)
│       ├── reorderSections(ids)
│       └── toggleSection(id, enabled)
│
├── data/templates/                             # Template definitions
│   ├── 3gpp.ts                                # 3GPP Technical Specification
│   ├── ieee830.ts                             # IEEE 830 SRS
│   ├── iso29148.ts                            # ISO/IEC/IEEE 29148
│   └── index.ts                               # Unified exports + helpers
│
├── services/ai/
│   ├── AIService.ts                           # New method (lines 1474-1682)
│   │   └── generateSpecificationFromTemplate()
│   └── prompts/
│       └── templatePrompts.ts                 # Generic prompt system
│           ├── buildSectionPrompt()           # Main entry point
│           ├── PromptBuilderContext           # Unified context
│           └── promptBuilders{}               # Registry (20+ builders)
│
├── components/ai/
│   ├── TemplateSelectionModal.tsx             # Template chooser (220 lines)
│   ├── SectionComposer.tsx                    # Section manager (313 lines)
│   └── GenerateSpecModal.tsx                  # Multi-step workflow (382 lines)
│
└── AppContainer.tsx                            # Template initialization on load
```

### Type Definitions

```typescript
// Template section definition
interface TemplateSectionDefinition {
  id: string;                    // "scope", "architecture"
  number: string;                // "1", "4", "4.1"
  title: string;                 // "Scope", "Solution Architecture"
  description: string;           // Help text for users
  promptKey: string;             // Maps to prompt builder function
  required: boolean;             // Cannot be disabled
  allowSubsections: boolean;     // Let LLM create hierarchy
  defaultEnabled: boolean;       // Enabled in new templates
}

// Complete template definition
interface SpecificationTemplate {
  id: string;                    // "3gpp-ts", "ieee-830"
  name: string;                  // "3GPP Technical Specification"
  description: string;           // "Standard telecom spec format"
  domain: string;                // "telecommunications", "software"
  version: string;               // "1.0"
  sections: TemplateSectionDefinition[];
  formatGuidance: string;        // LLM instructions for format/style
  createdAt: Date;
  modifiedAt: Date;
  isBuiltIn: boolean;            // Cannot be deleted/modified
}

// Active project template configuration
interface ProjectTemplateConfig {
  templateId: string;            // Which template to use
  enabledSections: string[];     // Which sections are active
  sectionOrder: string[];        // Custom ordering
  customGuidance: string;        // Additional LLM instructions
}
```

### Template Structure Example

```typescript
// src/data/templates/3gpp.ts
export const template3GPP: SpecificationTemplate = {
  id: '3gpp-ts',
  name: '3GPP Technical Specification',
  description: 'Standard template for telecommunications technical specifications',
  domain: 'telecommunications',
  version: '1.0',
  sections: [
    {
      id: 'scope',
      number: '1',
      title: 'Scope',
      description: 'Define the boundaries and coverage of this specification',
      promptKey: 'build3GPPScopePrompt',
      required: true,
      allowSubsections: false,
      defaultEnabled: true,
    },
    // ... 8 more sections
  ],
  formatGuidance: `This is a 3GPP-style Technical Specification Document (TSD).

  FORMATTING GUIDELINES:
  - Use normative language (SHALL, MUST, SHOULD, MAY) per RFC 2119
  - Reference 3GPP specifications using standard notation
  - Use standard 3GPP terminology (UE, eNB, MME, PCRF, etc.)
  // ... more guidance
  `,
  createdAt: new Date('2025-11-21'),
  modifiedAt: new Date('2025-11-21'),
  isBuiltIn: true,
};
```

## User Workflow

### Step 1: Template Selection

1. User clicks **"Generate Specification"** in Workspace
2. `TemplateSelectionModal` appears with available templates
3. User can filter by domain (telecommunications, software, general)
4. Clicking a template shows:
   - Template name and description
   - Number of sections
   - Version and domain
   - Preview of all sections

### Step 2: Section Customization

1. After template selection, `SectionComposer` appears
2. User sees all sections with:
   - Checkbox to enable/disable (required sections are locked)
   - Drag handle for reordering
   - Section metadata (number, title, description, promptKey)
3. Quick actions:
   - **Enable All** - Enable all optional sections
   - **Disable All Optional** - Disable all non-required sections
   - **Reset Order** - Return to default template order
4. Custom Guidance textarea for additional LLM instructions
5. **Require approval** checkbox (default: checked)

### Step 3: Generation

1. User clicks **"Generate Specification"**
2. Progress bar shows:
   - Current section being generated
   - Percentage complete
   - Estimated time remaining
3. Upon completion:
   - If approval required: Creates `PendingApproval` for ReviewPanel
   - If direct apply: Updates specification and creates version snapshot

## Technical Details

### Prompt System

The prompt system maps template `promptKey` fields to specific prompt builder functions:

```typescript
// src/services/ai/prompts/templatePrompts.ts
const promptBuilders: Record<string, PromptBuilder> = {
  'build3GPPScopePrompt': (section, context) => {
    return build3GPPScopePrompt(
      context.specTitle,
      context.brsAnalysis,
      context.brsDocument.metadata,
      context.userGuidance
    );
  },
  'buildIEEE830IntroductionPrompt': (section, context) => {
    return buildGenericIntroductionPrompt(section, context);
  },
  // ... 20+ prompt builders
};

// Generic fallback for extensibility
function buildGenericSectionPrompt(
  section: TemplateSectionDefinition,
  context: PromptBuilderContext
): string {
  // Uses template formatGuidance + BRS analysis + previous sections
}
```

### Sequential Generation with Context

```typescript
// Each section receives all previous sections as context
for (let i = 0; i < enabledSections.length; i++) {
  const section = enabledSections[i];

  const promptContext = {
    specTitle,
    brsDocument,
    brsAnalysis,
    previousSections: sections.map(s => ({ title: s.title, content: s.content })),
    template: {
      name: template.name,
      formatGuidance: template.formatGuidance
    },
    userGuidance: config.customGuidance,
    availableDiagrams: context?.availableDiagrams
  };

  const sectionPrompt = buildSectionPrompt(section, promptContext);
  const sectionResult = await this.provider.generate([{ role: 'user', content: sectionPrompt }], config);

  sections.push({ title: sectionTitle, content: sectionResult.content });
}
```

### Token Management

The system intelligently adjusts token limits based on model type:

```typescript
// Reasoning models (o1, GPT-5) need much higher output token limits
const isReasoningModel = this.config.model.toLowerCase().includes('o1') ||
                         this.config.model.toLowerCase().includes('gpt-5');

// BRS Analysis: 32k for reasoning, 4k for standard
const analysisMaxTokens = isReasoningModel ? 32000 : 4000;

// Section Generation: 16k for reasoning, 4k for standard
const sectionMaxTokens = isReasoningModel ? 16000 : (this.config.maxTokens || 4000);

// For reasoning models, enable high reasoning effort
if (isReasoningModel) {
  config.reasoning = { effort: 'high' };
}
```

### Migration for Existing Projects

On app initialization, existing projects without template configs are automatically migrated to the 3GPP template:

```typescript
// src/AppContainer.tsx
useEffect(() => {
  const initializeTemplates = async () => {
    if (availableTemplates.length === 0) {
      const { builtInTemplates } = await import('./data/templates');
      useProjectStore.setState({ availableTemplates: builtInTemplates });

      // Migrate existing projects
      if (project && !activeTemplateConfig) {
        const defaultTemplate = builtInTemplates.find(t => t.id === '3gpp-ts');
        if (defaultTemplate) {
          setActiveTemplate({
            templateId: defaultTemplate.id,
            enabledSections: defaultTemplate.sections.filter(s => s.defaultEnabled).map(s => s.id),
            sectionOrder: defaultTemplate.sections.map(s => s.id),
            customGuidance: ''
          });
        }
      }
    }
  };

  initializeTemplates();
}, []);
```

## UI Components

### TemplateSelectionModal

**Purpose:** Allow users to choose a template from available options

**Features:**
- Grid layout showing all available templates
- Domain filtering (telecommunications, software, general, all)
- Template metadata display (sections count, version, domain)
- Built-in vs custom template indicators
- Section preview in footer when template selected

**File:** [src/components/ai/TemplateSelectionModal.tsx](../../src/components/ai/TemplateSelectionModal.tsx) (220 lines)

### SectionComposer

**Purpose:** Customize sections before generation

**Features:**
- Drag-and-drop reordering using @dnd-kit
- Enable/disable checkboxes with required section protection
- Section metadata display (number, title, description, promptKey)
- Custom guidance textarea
- Quick actions (Enable All, Disable All Optional, Reset Order)
- Real-time section count display

**File:** [src/components/ai/SectionComposer.tsx](../../src/components/ai/SectionComposer.tsx) (313 lines)

**Dependencies:**
- `@dnd-kit/core` - Core drag-and-drop functionality
- `@dnd-kit/sortable` - Sortable list utilities
- `@dnd-kit/utilities` - CSS transform utilities

### GenerateSpecModal

**Purpose:** Multi-step workflow for specification generation

**Steps:**
1. **Template Selection** - Shows TemplateSelectionModal
2. **Customization** - Shows SectionComposer with title input
3. **Generation** - Shows progress bar with real-time updates

**Features:**
- Step-by-step navigation
- "Change Template" button to go back
- "Require approval" checkbox
- Validation messages (missing BRS, missing API key)
- Progress tracking with percentage and section name
- Success/error messaging

**File:** [src/components/ai/GenerateSpecModal.tsx](../../src/components/ai/GenerateSpecModal.tsx) (382 lines)

## Built-in Templates

### 1. 3GPP Technical Specification

**Domain:** Telecommunications
**Sections:** 9
**Use Case:** Network equipment specs, protocol implementations, service descriptions

**Sections:**
1. Scope
2. Service Overview
3. Functional Specification
4. Solution Architecture and Design
5. Non-Functional Requirements
6. OSS/BSS and Service Management
7. SLA Summary
8. Open Items
9. Appendices

**Format Guidance:**
- Normative language (SHALL, MUST, SHOULD, MAY)
- 3GPP specification references (TS 23.203, TS 23.401, etc.)
- Standard 3GPP terminology (UE, eNB, MME, PCRF, PDN-GW)
- Reference points/interfaces (Gx, Sd, Gy, Gz, RADIUS)

### 2. IEEE 830 Software Requirements Specification

**Domain:** Software
**Sections:** 9
**Use Case:** Software product requirements, system specifications

**Sections:**
1. Introduction
2. Overall Description
3. Specific Requirements
4. External Interface Requirements
5. System Features
6. Performance Requirements
7. Design Constraints
8. Software System Attributes
9. Appendices

**Format Guidance:**
- Requirements uniquely identified (REQ-FUNC-001, etc.)
- "Shall" for mandatory, "should" for desirable
- SMART requirements (Specific, Measurable, Achievable, Relevant, Testable)
- Traceability to stakeholder needs

### 3. ISO/IEC/IEEE 29148 Requirements Specification

**Domain:** General
**Sections:** 7
**Use Case:** Enterprise systems, safety-critical systems, government/defense

**Sections:**
1. Introduction
2. References
3. Definitions and Acronyms
4. Stakeholder Requirements
5. System Requirements
6. Verification
7. Appendices

**Format Guidance:**
- Requirements classification (functional, performance, interface, etc.)
- Requirement attributes (priority, risk, verification method, source)
- Clear traceability and verification methods
- Stakeholder vs system requirements distinction

## Extending the System

### Adding a New Template

1. **Create template file:**

```typescript
// src/data/templates/mytemplate.ts
import type { SpecificationTemplate } from '../../types';

export const templateMyTemplate: SpecificationTemplate = {
  id: 'my-template',
  name: 'My Custom Template',
  description: 'Custom template for my domain',
  domain: 'custom',
  version: '1.0',
  sections: [
    {
      id: 'intro',
      number: '1',
      title: 'Introduction',
      description: 'Overview of the document',
      promptKey: 'buildMyIntroPrompt',
      required: true,
      allowSubsections: true,
      defaultEnabled: true,
    },
    // ... more sections
  ],
  formatGuidance: `Custom formatting guidelines...`,
  createdAt: new Date(),
  modifiedAt: new Date(),
  isBuiltIn: false, // Custom template
};
```

2. **Add prompt builders:**

```typescript
// src/services/ai/prompts/templatePrompts.ts
const promptBuilders: Record<string, PromptBuilder> = {
  // ... existing builders

  'buildMyIntroPrompt': (section, context) => {
    return `Generate introduction section for my custom template...`;
  },
};
```

3. **Export from index:**

```typescript
// src/data/templates/index.ts
import { templateMyTemplate } from './mytemplate';

export const builtInTemplates: SpecificationTemplate[] = [
  template3GPP,
  templateIEEE830,
  templateISO29148,
  templateMyTemplate, // Add here
];

export { templateMyTemplate };
```

### Creating Custom Templates at Runtime

Users can create custom templates via the store:

```typescript
const createCustomTemplate = useProjectStore(state => state.createCustomTemplate);

const customTemplateId = createCustomTemplate({
  name: 'My Project Template',
  description: 'Customized for my specific project',
  domain: 'software',
  version: '1.0',
  sections: [
    // Custom section definitions
  ],
  formatGuidance: 'Custom formatting rules...'
});
```

## Performance Considerations

### Token Usage

- **BRS Analysis:** ~3,000-12,000 tokens (depending on BRS size)
- **Per Section:** ~2,000-8,000 tokens (standard models), ~10,000-20,000 (reasoning models)
- **Total for 9 sections:** ~20,000-80,000 tokens

### Cost Estimates

Using Claude 3.5 Sonnet via OpenRouter (~$3 per 1M tokens):
- **BRS Analysis:** $0.01-0.04
- **Full 9-section spec:** $0.06-0.24
- **Total:** ~$0.10-0.30 per specification

### Generation Time

- **BRS Analysis:** 10-30 seconds
- **Per Section:** 15-45 seconds
- **Total for 9 sections:** 3-8 minutes

## Testing

### Manual Testing Checklist

- [ ] Template Selection
  - [ ] All 3 templates appear
  - [ ] Domain filtering works
  - [ ] Template details show correctly
- [ ] Section Customization
  - [ ] Drag-and-drop reordering works
  - [ ] Required sections cannot be disabled
  - [ ] Optional sections can be toggled
  - [ ] Custom guidance persists
  - [ ] Quick actions work
- [ ] Generation
  - [ ] Progress bar updates correctly
  - [ ] All enabled sections generate
  - [ ] Approval workflow creates PendingApproval
  - [ ] Direct apply updates specification
  - [ ] Error handling works
- [ ] Migration
  - [ ] Existing projects get default template
  - [ ] Template config persists in localStorage

### Automated Testing (Future)

```typescript
// Example test suite
describe('Template System', () => {
  describe('TemplateSelectionModal', () => {
    it('should display all available templates', () => {});
    it('should filter templates by domain', () => {});
    it('should call onSelect when template is chosen', () => {});
  });

  describe('SectionComposer', () => {
    it('should allow reordering sections via drag-and-drop', () => {});
    it('should prevent disabling required sections', () => {});
    it('should update custom guidance', () => {});
  });

  describe('generateSpecificationFromTemplate', () => {
    it('should generate sections in correct order', () => {});
    it('should include previous sections in context', () => {});
    it('should respect enabled sections only', () => {});
  });
});
```

## Troubleshooting

### Templates Not Loading

**Problem:** TemplateSelectionModal shows "No templates available"

**Solutions:**
1. Check browser console for template loading errors
2. Verify `builtInTemplates` is exported from `src/data/templates/index.ts`
3. Check localStorage: `tech-spec-project` key should contain `availableTemplates` array
4. Clear localStorage and reload: Templates will reinitialize on next load

### Drag-and-Drop Not Working

**Problem:** Cannot reorder sections in SectionComposer

**Solutions:**
1. Verify @dnd-kit packages are installed: `npm list @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
2. Check browser console for React errors
3. Ensure sections have unique `id` fields
4. Try using keyboard navigation (Tab + Space + Arrow keys)

### Generation Fails with "Empty Content"

**Problem:** Some sections generate empty or very short content

**Solutions:**
1. Check token limits are sufficient (especially for reasoning models)
2. Verify prompt builder exists for section's `promptKey`
3. Check BRS analysis succeeded (should contain structured data)
4. Try increasing `maxTokens` in AI config
5. Switch to Claude Opus or GPT-4 for more reliable output

### Template Config Not Persisting

**Problem:** Section customization resets after page reload

**Solutions:**
1. Check Zustand persist middleware is working (console logs on save)
2. Verify localStorage quota isn't exceeded
3. Check browser localStorage is enabled
4. Ensure `setActiveTemplate` or `updateTemplateConfig` actions are called

## Future Enhancements

### Template Management UI

- **Template Library** - Browse, search, import/export templates
- **Template Editor** - Visual editor for creating custom templates
- **Template Sharing** - Export templates as JSON, import from community

### Advanced Customization

- **Conditional Sections** - Show/hide sections based on BRS content
- **Section Dependencies** - Automatically enable dependent sections
- **Section Variables** - Parameterized section titles/content

### Multi-Document Support

- **Template Collections** - Group related templates (e.g., "5G Suite")
- **Cross-Document References** - Link sections across multiple specs
- **Batch Generation** - Generate multiple specs from one BRS

### AI Enhancements

- **Smart Section Suggestions** - AI recommends sections based on BRS
- **Section Quality Scoring** - Rate generated sections for completeness
- **Iterative Refinement** - Multi-pass generation for higher quality

## References

- **Implementation PR:** [Link to PR when merged]
- **Design Doc:** This document
- **Related Features:**
  - [Approval Workflow](../phases/PHASE2C_COMPLETE.md)
  - [BRS-to-TechSpec Pipeline](../phases/PHASE2B_STATUS.md)
  - [AI Service Architecture](../architecture/AI_COPILOT_ARCHITECTURE.md)

## Change Log

- **2025-11-21:** Initial implementation complete (Phases 1-6, 16/16 tasks)
  - Added 4 type interfaces
  - Implemented 8 Zustand store actions
  - Created 3 built-in templates (3GPP, IEEE 830, ISO 29148)
  - Built generic prompt system with 20+ prompt builders
  - Developed 3 UI components (TemplateSelectionModal, SectionComposer, GenerateSpecModal)
  - Integrated @dnd-kit for drag-and-drop
  - Added template initialization and migration
  - Created comprehensive documentation

---

**Status:** ✅ Production Ready
**Maintainer:** TechSpec Studio Team
**Last Updated:** 2025-11-21
