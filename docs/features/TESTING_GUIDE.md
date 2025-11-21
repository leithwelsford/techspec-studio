# Testing Guide: BRS-to-TechSpec Generation

## Quick Start (5 minutes)

### Prerequisites
- OpenRouter API key (get at https://openrouter.ai)
- Development server running on http://localhost:3000

### Step-by-Step Test

**1. Start the Application**
```bash
npm run dev
# Opens http://localhost:3000 automatically
```

**2. Create a New Project**
- Click **"Create New Project"** button
- Default name is fine (or customize)

**3. Upload the Sample BRS**
- Click **"Business Requirements"** tab
- Drag and drop **`sample-brs.md`** file OR click to browse
- Verify metadata is extracted:
  - Customer: Acme Telecommunications
  - Project: 5G Service Edge Enhancement
  - Version: 2.1
- Click **"Save BRS Document"**
- Green checkmark (✓) appears on tab

**4. Configure AI**
- Click **"Setup AI"** button in header
- Enter configuration:
  - **Provider**: OpenRouter (default)
  - **Model**: `anthropic/claude-3.5-sonnet` (recommended)
  - **API Key**: Your OpenRouter key
  - **Temperature**: 0.7 (default)
  - **Max Tokens**: 4000 (default)
- Click **"Test Connection"** to verify
- Click **"Save Configuration"**
- Header shows **"AI Ready"** (green indicator)

**5. Generate Technical Specification**
- Click **"Generate Spec"** button (green, in header)
- Modal opens showing:
  - BRS source information
  - Specification title (editable)
  - What will be generated (8 sections)
- Click **"Generate Specification"**
- Watch progress bar update:
  - "Analyzing BRS..."
  - "1 Scope" (1/8)
  - "2 References" (2/8)
  - ... continues through 8/8
- Wait **2-5 minutes** (9 AI API calls)
- Modal closes automatically on success

**6. Review Generated Document**
- Go to **"Technical Specification"** tab
- Scroll through generated document
- Verify all sections present:
  - ✓ Document header with metadata
  - ✓ Section 1: Scope
  - ✓ Section 2: References
  - ✓ Section 3: Definitions, Symbols, and Abbreviations
  - ✓ Section 4: Architecture
  - ✓ Section 5: Functional Requirements
  - ✓ Section 6: Procedures
  - ✓ Section 7: Information Elements
  - ✓ Section 8: Error Handling

**7. Check Usage Statistics**
- Click **"AI Settings"** button
- Scroll to **"Usage Statistics"**
- Verify:
  - Total tokens used: ~10,000-30,000
  - Estimated cost: ~$0.30-$1.00
  - Cost per 1M tokens shown

## What to Look For

### Document Quality Checks

**✓ Section 1 (Scope)**
- Clear purpose statement
- "In Scope" and "Out of Scope" sections
- Document structure overview
- References to 3GPP standards from BRS

**✓ Section 2 (References)**
- Normative references (required standards)
- Informative references (helpful context)
- Proper 3GPP citation format: "TS 23.203", "TS 29.212"
- Reference IDs like [1], [2], [3]

**✓ Section 3 (Definitions)**
- Definitions of technical terms
- Abbreviations table (alphabetically sorted)
- All acronyms from BRS explained (PCRF, PCEF, TDF, SMP, QCI, ARP, etc.)

**✓ Section 4 (Architecture)**
- High-level architecture description
- Component descriptions:
  - PCRF (Policy and Charging Rules Function)
  - PCEF (Policy and Charging Enforcement Function)
  - TDF (Traffic Detection Function)
  - SMP (Session Management Platform)
- Interface table showing Gx, Rx, S5/S8, AAA
- Diagram placeholders: `{{fig:architecture-overview}}`
- TODO comments for diagrams to be created

**✓ Section 5 (Functional Requirements)**
- Policy control requirements (QCI, ARP, MBR, GBR)
- Session management requirements
- Traffic management requirements
- Performance requirements (100 Gbps, 10ms latency, etc.)
- Security requirements (TLS 1.3, IPsec, MFA)
- **Normative language**: SHALL, MUST, SHOULD, MAY

**✓ Section 6 (Procedures)**
- Session establishment procedure (7+ steps)
- Policy update procedure
- Step-by-step message flows
- Participants clearly identified (UE, SMP, PCEF, PCRF)
- Sequence diagram placeholders: `{{fig:session-establishment-flow}}`
- Error handling subsections

**✓ Section 7 (Information Elements)**
- Policy information elements (QCI, ARP, MBR, GBR)
- Session information elements
- Tables with IE name, type, description, mandatory/optional, reference
- Data type specifications

**✓ Section 8 (Error Handling)**
- General error handling principles
- Interface-specific errors (Gx, Rx, S5/S8, AAA)
- System errors (component failures, resource exhaustion)
- Error code table
- Logging and monitoring requirements

### Formatting Checks

**✓ Markdown Structure**
- Proper heading hierarchy (# title, ## sections, ### subsections)
- Tables formatted correctly with pipes |
- Lists use bullets or numbers
- Code blocks for technical content (if any)

**✓ Professional Tone**
- Formal technical writing
- Clear and concise language
- No casual or conversational tone
- Industry-standard terminology

**✓ 3GPP Compliance**
- Follows 3GPP technical specification format
- Uses normative language appropriately
- References standards correctly
- Includes required sections

## Expected Output Size

- **Total document**: ~5,000-15,000 words
- **Approximate pages**: 15-50 pages (depends on complexity)
- **Sections**: 8 main sections + document header
- **Diagram placeholders**: 5-10 suggested diagrams
- **Reference citations**: 5-15 standards referenced

## Common Issues & Solutions

### Issue: "No BRS document loaded"
**Solution**: Upload a BRS file first from the "Business Requirements" tab

### Issue: "AI not configured"
**Solution**: Click "Setup AI" and enter your OpenRouter API key

### Issue: Generation fails with "AI service not initialized"
**Solution**: Verify API key is correct, test connection in AI Settings

### Issue: Generation takes longer than 5 minutes
**Solution**:
- Check network connection
- Verify OpenRouter service status
- Try a different AI model (e.g., GPT-4)

### Issue: Generated sections are incomplete
**Solution**:
- Increase "Max Tokens" in AI Settings (try 8000)
- Use a more capable model (Claude 3.5 Sonnet recommended)

### Issue: Cost is higher than expected
**Solution**:
- Check token usage in AI Settings
- Use lower-cost model for testing (e.g., GPT-3.5 Turbo)
- Temperature doesn't affect cost, only quality

## Cost Estimation

**Using Claude 3.5 Sonnet via OpenRouter:**
- Input: ~$3 per 1M tokens
- Output: ~$15 per 1M tokens
- Typical generation: ~25,000 total tokens
- **Estimated cost**: $0.50-$1.00 per full specification

**Budget-Friendly Option (GPT-3.5 Turbo):**
- Input/Output: ~$0.50-$1.50 per 1M tokens
- **Estimated cost**: $0.01-$0.05 per full specification
- Quality may be lower than Claude

## Advanced Testing

### Test Different BRS Files
1. Create your own BRS markdown file
2. Include YAML frontmatter:
   ```yaml
   ---
   customer: Your Company
   project: Your Project
   version: 1.0
   date: 2025-11-06
   ---
   ```
3. Include requirement IDs: REQ-ARCH-001, REQ-POL-001, etc.
4. Upload and generate

### Test Error Handling
1. Try generating without BRS (should show warning)
2. Try generating without AI config (should disable button)
3. Enter invalid API key (should fail gracefully)
4. Cancel generation mid-progress (modal should close)

### Test Multiple Generations
1. Generate once
2. Edit BRS or change title
3. Generate again (overwrites previous)
4. Check that token usage accumulates

## Verification Checklist

Before reporting success, verify:

- [ ] Application loads at http://localhost:3000
- [ ] Can create new project
- [ ] Can upload BRS file (sample-brs.md)
- [ ] BRS metadata displays correctly
- [ ] Can configure AI with OpenRouter key
- [ ] "AI Ready" indicator shows when configured
- [ ] "Generate Spec" button appears after BRS upload
- [ ] Modal opens with correct BRS information
- [ ] Can edit specification title
- [ ] Generation starts when clicking "Generate Specification"
- [ ] Progress bar updates through all 8 sections
- [ ] Modal closes automatically on success
- [ ] Generated document appears in "Technical Specification" tab
- [ ] All 8 sections are present and properly formatted
- [ ] Diagram placeholders exist ({{fig:...}})
- [ ] Normative language used (SHALL/MUST/MAY)
- [ ] Usage statistics update correctly
- [ ] Cost estimation shown in AI Settings

## Sample Output Preview

**Document Header:**
```markdown
# 5G Service Edge Enhancement - Technical Specification

**Technical Specification**

---

**Document Information**
- **Customer**: Acme Telecommunications
- **Project**: 5G Service Edge Enhancement
- **Version**: 2.1
- **Date**: 2025-11-06

---
```

**Section 4 Example:**
```markdown
## 4 Architecture

### 4.1 Overview
The 5G Service Edge Enhancement architecture integrates with existing 3GPP-compliant
PCRF infrastructure while providing enhanced policy control capabilities...

{{fig:architecture-overview}} <!-- TODO: High-level architecture diagram showing PCRF, PCEF, TDF, SMP -->

### 4.2 Functional Elements

#### 4.2.1 Policy and Charging Rules Function (PCRF)
The PCRF is the policy decision point for the system.

- **Function**: Policy decision making and charging control
- **Responsibilities**:
  - Generate policy rules based on subscriber profile and network conditions
  - Provision QoS parameters (QCI, ARP, MBR, GBR)
  - Coordinate with application functions via Rx interface
- **Interfaces**: Gx (to PCEF), Rx (to AF)
- **Standards Compliance**: TS 23.203, TS 29.212

...
```

## Success Criteria

Generation is successful if:
1. ✅ Complete document generated in 2-5 minutes
2. ✅ All 8 sections present and properly formatted
3. ✅ Content is relevant to BRS requirements
4. ✅ Professional technical writing quality
5. ✅ 3GPP standards compliance
6. ✅ Normative language used appropriately
7. ✅ Diagram placeholders created
8. ✅ No critical errors or exceptions
9. ✅ Token/cost tracking accurate
10. ✅ Document persists after page reload

## Getting Help

If you encounter issues:
1. Check browser console for errors (F12)
2. Verify API key is valid at https://openrouter.ai
3. Try test connection in AI Settings
4. Review [../../TROUBLESHOOTING.md](../../TROUBLESHOOTING.md)
5. Check [../phases/PHASE2B_TASK2_COMPLETE.md](../phases/PHASE2B_TASK2_COMPLETE.md) for implementation details

## Next Steps

After successful testing:
1. Try generating specs from different BRS files
2. Explore Phase 2B Task 3: Diagram Auto-Generation (coming next)
3. Experiment with different AI models for quality/cost trade-offs
4. Provide feedback on generated content quality
