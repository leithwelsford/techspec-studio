# TechSpec Studio

**AI-Powered Technical Specification Authoring System**

A sophisticated React-based tool for creating technical specifications with AI assistance, featuring interactive diagram editing, markdown authoring, and 3GPP standards compliance.

**GitHub Repository**: https://github.com/leithwelsford/techspec-studio

## Features

### AI-Powered Authoring
- **BRS-to-TechSpec Pipeline**: Upload business requirements, AI generates complete technical specification
- **Section Generation**: Generate individual sections with AI assistance
- **Content Refinement**: Select text and ask AI to improve, expand, or make more technical
- **Streaming Responses**: Real-time AI response streaming with token/cost tracking
- **Template Support**: Built-in templates for 3GPP, IEEE 830, and ISO 29148 standards

### Diagram Editing
- **Block Diagrams**: Interactive canvas with pan, zoom, drag nodes, resize, and multiple edge styles
- **Sequence Diagrams**: Mermaid-based editor with live preview and AI-powered self-healing
- **Flow Diagrams**: State and flow visualization with Mermaid syntax
- **Auto-linking**: `{{fig:diagram-id}}` syntax with automatic figure numbering

### Document Management
- **Markdown Editor**: Split view with live preview, syntax highlighting
- **Version History**: Automatic snapshots on significant changes with restore capability
- **Approval Workflow**: Review AI-generated content before applying changes
- **Reference Documents**: Upload PDFs and DOCX for AI context

### Export Options
- **DOCX Export**: Professional documents with Table of Contents, List of Figures, Bibliography
- **Pandoc Backend**: Optional server for Word template preservation (headers, footers, logos)
- **Diagram Export**: SVG (vector) and PNG (raster) formats
- **Persistence**: Auto-save to localStorage/IndexedDB

## Installation

### Clone the Repository

```bash
# HTTPS (recommended)
git clone https://github.com/leithwelsford/techspec-studio.git
cd techspec-studio

# SSH (if you have SSH keys configured)
git clone git@github.com:leithwelsford/techspec-studio.git
cd techspec-studio
```

### Install Dependencies

```bash
# Install all dependencies (Tailwind CSS already included)
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Optional: Pandoc Export Service

For professional DOCX export with full corporate Word template support, install the Pandoc backend service:

```bash
# 1. Install Pandoc (choose your OS)

# Ubuntu/Debian
sudo apt-get update && sudo apt-get install pandoc

# macOS
brew install pandoc

# Windows - Download from: https://pandoc.org/installing.html

# Verify installation
pandoc --version

# 2. Install backend dependencies
cd server
npm install

# 3. Start backend service
npm start
# Service runs on http://localhost:3001

# 4. Start frontend (in another terminal)
cd ..
npm run dev
```

**OR use Docker Compose (recommended):**

```bash
# Start both frontend and backend services
docker-compose up

# Frontend: http://localhost:3000
# Backend: http://localhost:3001
```

**What is Pandoc Export?**
- Preserves all Word template formatting (headers, footers, logos, styles)
- No template modification required (no placeholder tags)
- Professional corporate-compliant output
- Optional: Use browser-based export if Pandoc service unavailable

### Git Configuration (for contributors)

```bash
# Set your Git identity
git config user.name "Your Name"
git config user.email "your.email@example.com"

# Verify configuration
git config --list
```

## Usage

### Quick Start
1. Run `npm run dev` to start the development server
2. Create a new project
3. Configure AI (OpenRouter API key required)
4. Upload BRS document or write requirements
5. Click "Generate Spec" to create technical specification
6. Review and approve AI-generated content
7. Export to DOCX

### Editor Shortcuts
- **Split View**: Edit markdown with live preview
- **Ctrl/Cmd + S**: Auto-saves (built-in)
- **Enter**: Send chat message
- **Shift + Enter**: New line in chat

### Diagram Editor
- **Space + Drag**: Pan the canvas
- **Scroll Wheel**: Zoom in/out
- **Double-click**: Edit node/edge labels
- **Drag corners**: Resize nodes

## Architecture

### Technology Stack
- **React 18** + **Vite 5** + **TypeScript 5**
- **Zustand 5** - State management with IndexedDB persistence
- **Tailwind CSS 3.4** - Styling
- **Mermaid 11** - Sequence/flow diagrams
- **OpenRouter** - AI provider (Claude, GPT-4, Gemini, etc.)

### Key Patterns
- **Zustand Store**: Single source of truth in `src/store/projectStore.ts`
- **AI Service Layer**: Singleton pattern in `src/services/ai/AIService.ts`
- **Approval Workflow**: AI content reviewed before applying via `PendingApproval`
- **Encrypted Storage**: API keys encrypted with AES before storage

For detailed architecture, see [CLAUDE.md](CLAUDE.md).

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Core editor | ✅ | ✅ | ✅ | ✅ |
| File System API | ✅ | ❌ | ❌ | ✅ |
| Clipboard API | ✅ | ✅ | ✅ | ✅ |
| Pointer Events | ✅ | ✅ | ✅ | ✅ |

## Performance Metrics

- Initial load: ~50ms (after bundle)
- Node drag: 60fps (optimized pointer events)
- Canvas pan: 60fps (CSS transform)
- Export SVG: ~100ms (1800×900px)
- Export PNG: ~300ms (3600×1800px @2x)

## License

Educational/demo code - adapt as needed for your project.

## Roadmap

See [docs/OUTSTANDING_DEVELOPMENT.md](docs/OUTSTANDING_DEVELOPMENT.md) for complete roadmap including:
- Reference document management
- Additional export formats (PDF, HTML)
- Collaboration features
- Performance optimizations

## Contributing

### Development Workflow

1. **Fork and clone** the repository
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Make your changes** and commit regularly
4. **Push your branch**: `git push -u origin feature/your-feature-name`
5. **Open a Pull Request** on GitHub

### Commit Guidelines

Follow conventional commit format:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

**Example**: `feat: add SequenceDiagramEditor with live preview`

### Code Style

- Use TypeScript for all new code
- Follow existing patterns (Zustand store, relative imports)
- Add types to [src/types/index.ts](src/types/index.ts)
- Never mutate Zustand state directly
- Test your changes before committing

### Getting Help

- Check [CLAUDE.md](CLAUDE.md) for development guidance
- Review [docs/architecture/IMPLEMENTATION_PROGRESS.md](docs/architecture/IMPLEMENTATION_PROGRESS.md) for roadmap
- See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues

