# Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Start the Dev Server
```bash
npm run dev
```
Opens at http://localhost:3000

### Step 2: Create Your First Project
1. Click **"Create New Project"**
2. Project appears with default content

### Step 3: Configure AI
1. AI Config modal opens automatically
2. Get API key: https://openrouter.ai/keys
3. Paste key → Click **"Test Connection"**
4. Click **"Save Configuration"**

✅ You're ready to use AI!

---

## 💡 Key Features

### AI Chat
1. Click **"Show Chat"** in header
2. Type a message or use quick actions:
   - "Generate Intro"
   - "Create Diagram"
   - "Review Document"
3. Watch streaming responses appear
4. See token usage and cost

### AI-Powered Editing

#### Generate a Section
1. In editor, click **"Generate Section"**
2. Enter section title: "Architecture Overview"
3. AI generates content
4. Content added to document

#### Refine Your Text
1. Select text in editor
2. Click **"Refine Selection"**
3. Describe changes: "make it more technical"
4. AI improves the text

#### Insert Figure References
1. Click **"Insert Figure Ref"**
2. Pick from available diagrams
3. `{{fig:diagram-id}}` inserted

### View Modes
- **Edit**: Code editor only
- **Split**: Editor + live preview (recommended)
- **Preview**: Preview only

---

## 🎨 UI Overview

```
┌─────────────────────────────────────────────┐
│ Header                                      │
│ [Project] [AI Status] [Setup] [Show Chat]  │
├──────────┬──────────────────────────────────┤
│ Sidebar  │ Markdown Editor                  │
│          │ [Toolbar: Edit|Split|Preview]    │
│          │ [AI Actions: Generate|Refine]    │
│          │                                  │
│          │ Split View:                      │
│          │ ┌────────┬────────┐             │
│          │ │ Editor │Preview │             │
│          │ └────────┴────────┘             │
├──────────┴──────────────────────────────────┤
│ Chat Panel (when open)                      │
│ [Messages] [Input] [Quick Actions]          │
└─────────────────────────────────────────────┘
```

---

## 🔑 Keyboard Shortcuts

### Chat Panel
- `Enter` - Send message
- `Shift + Enter` - New line

### Editor
- `Ctrl/Cmd + S` - Auto-saves (built-in)

---

## 💰 Cost Tracking

Every AI response shows:
- **Token count** - e.g., "2,341 tokens"
- **Cost estimate** - e.g., "$0.023"

Usage stats tracked in store and shown in AI config panel.

---

## 🛠️ Troubleshooting

### "AI Not Configured" warning
→ Click "Setup AI" and enter your API key

### Chat not working
→ Check that API key is valid (test connection)

### Streaming responses stuck
→ Refresh page, re-enter API key

### Can't see preview
→ Click "Split" or "Preview" button in toolbar

---

## 📖 Example Workflow

### Generate a Complete Specification

1. **Create project** → "5G Private Line Spec"

2. **Chat with AI** → Plan structure:
   ```
   "Create an outline for a 5G Private Line technical specification"
   ```

3. **Generate sections** one by one:
   - Click "Generate Section" → "Introduction"
   - Click "Generate Section" → "Service Definition"
   - Click "Generate Section" → "Architecture"

4. **Refine content**:
   - Select paragraph
   - Click "Refine" → "Add more technical details"

5. **Add diagrams**:
   - Click "Generate Spec" and select diagram options
   - Or use chat: "Create a block diagram of the architecture"
   - Diagrams appear in Block Diagrams / Sequence Diagrams tabs

6. **Export**:
   - Click "Export" in header
   - Choose DOCX (with optional Pandoc backend) or diagram export
   - Download professional document

---

## 🎯 Best Practices

### For Better AI Output

1. **Be specific** in prompts:
   - ❌ "Write about architecture"
   - ✅ "Write a 3-paragraph section about 5G network architecture focusing on CUPS separation"

2. **Use context**:
   - Add diagrams first
   - Reference them in prompts
   - Upload BRS documents for AI context

3. **Iterate**:
   - Generate rough draft
   - Refine specific parts
   - Review in chat

### For Better Documents

1. **Use Split View**:
   - See changes live
   - Catch formatting issues

2. **Add References Early**:
   - Create diagrams first
   - Use {{fig:...}} syntax
   - Auto-numbered in preview and export

3. **Save Often**:
   - Auto-saves to localStorage/IndexedDB
   - Export regularly as backup

---

## 🔒 Security Notes

- API keys encrypted in browser (AES)
- Device-specific (can't decrypt on other devices)
- Not sent to any server except OpenRouter
- Use "Clear Data" button to reset all data

---

## 📱 Browser Support

✅ Chrome 90+
✅ Firefox 88+
✅ Safari 14+
✅ Edge 90+

---

## 🆘 Need Help?

1. Check **TROUBLESHOOTING.md** for common issues
2. Check **docs/OUTSTANDING_DEVELOPMENT.md** for feature status
3. Check browser console for errors
4. Review **CLAUDE.md** for architecture details

---

## 🚀 You're Ready!

The app is fully functional. Start creating professional technical specifications with AI assistance!

**Happy Writing! ✨**
