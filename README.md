# TechSpec Studio

**AI-Powered Technical Specification Authoring System**

A sophisticated React-based tool for creating technical specifications with AI assistance, featuring interactive diagram editing, markdown authoring, and 3GPP standards compliance.

**GitHub Repository**: https://github.com/leithwelsford/techspec-studio

## Features

### Core Capabilities
- **Interactive Canvas**: Pan (spacebar/middle-click), zoom (scroll wheel), and drag nodes
- **Node Manipulation**:
  - Drag nodes to reposition
  - Resize nodes with corner handles
  - Edit labels via double-click
  - Two shapes: rectangles and cloud
- **Edge Connections**:
  - Three styles: bold, solid, dashed
  - Draggable labels
  - Straight or orthogonal routing
- **Persistence**: All changes saved to localStorage
- **Export Options**:
  - JSON layout (for backup/restore)
  - SVG export (vector graphics)
  - PNG export (raster images)
  - Mermaid diagram code
- **Grid System**: Optional snap-to-grid with visual grid overlay

### Advanced Features
- Migration system for legacy data formats
- Graceful export fallbacks (File System API → anchor → new tab → clipboard)
- Draggable horizontal separator between mobile/fixed sections
- Grouped service edge visualization (TDF/PCEF box)
- Test mode for validation

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

### Keyboard Shortcuts
- **Space + Drag**: Pan the canvas
- **Scroll Wheel**: Zoom in/out
- **Middle Mouse + Drag**: Pan the canvas

### Mouse Interactions
- **Double-click node**: Edit label
- **Double-click edge label**: Edit label text
- **Drag node**: Move position
- **Drag corner handles**: Resize node
- **Drag edge label**: Reposition label
- **Click background + drag**: Pan canvas

### Toolbar Controls
- **+ / −**: Zoom controls
- **Reset View**: Reset pan/zoom to default
- **Snap-to-grid**: Toggle grid snapping
- **Orthogonal connectors**: Toggle right-angle vs straight edges
- **Export layout**: Save JSON configuration
- **Import layout**: Restore from JSON
- **Export SVG/PNG**: Save as image
- **Run Tests**: Validate data integrity
- **Reset All**: Clear all data and start fresh

## Code Review Highlights

### Strengths ✓
1. **Clean Architecture**: Well-separated concerns with custom hooks
2. **Comprehensive State Management**: localStorage persistence with migrations
3. **Rich Interactions**: Pan, zoom, drag, resize with pointer events
4. **Export Flexibility**: Multiple formats with smart fallbacks
5. **Developer Experience**: TypeScript, hot reload, test mode

### Areas for Improvement ⚠️

#### 1. Type Safety
**Current Issue**: Heavy use of `any` defeats TypeScript benefits
```typescript
// ❌ Avoid
const meta = (nodeMeta as any)[id]

// ✅ Better
const meta = nodeMeta[id] ?? NODE_META_DEFAULT[id]
```

**Recommendation**: Define proper index signatures:
```typescript
type NodeMetaMap = Record<string, NodeMeta>;
type PositionMap = Record<string, Point>;
```

#### 2. Performance Optimization
**Issues**:
- `nodeCenter()` recalculates on every render (line 265)
- Grid lines render all 18,000+ elements on every pan/zoom
- `edges` useMemo dependencies could be more granular

**Solutions**:
```typescript
// Memoize node centers
const nodeCenters = useMemo(() => {
  const centers: Record<string, Point> = {};
  Object.keys(nodeMeta).forEach(id => {
    centers[id] = calculateCenter(id, nodeMeta, positions, sizes);
  });
  return centers;
}, [nodeMeta, positions, sizes]);

// Virtual grid rendering (only visible portion)
const visibleGridLines = useMemo(() => {
  const bounds = getVisibleBounds(offset, scale, viewportSize);
  return generateGridLines(bounds);
}, [offset, scale]);
```

#### 3. Error Handling
**Current**: Silent catches without feedback
```typescript
try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
```

**Better**:
```typescript
try {
  localStorage.setItem(key, JSON.stringify(v));
} catch (error) {
  console.error('Failed to persist state:', error);
  // Optionally notify user via status.err()
}
```

#### 4. Magic Numbers
**Issue**: Hardcoded values throughout
```typescript
const ny = sepY - 8; // What does -8 represent?
const scaleFactor = 2; // Why 2?
```

**Better**:
```typescript
const LABEL_OFFSET_Y = 8;
const PNG_SCALE_FACTOR = 2; // 2x for retina displays
const SEPARATOR_PADDING_TOP = 10;
```

#### 5. Component Size
**Issue**: 700+ line component is difficult to maintain

**Solution**: Split into modules:
```
src/
├── App.tsx (main orchestration)
├── components/
│   ├── Canvas.tsx
│   ├── Node.tsx
│   ├── Edge.tsx
│   ├── Toolbar.tsx
│   └── MermaidPanel.tsx
├── hooks/
│   ├── usePanZoom.ts
│   ├── useLocalValue.ts
│   └── useStatus.ts
├── utils/
│   ├── geometry.ts
│   ├── export.ts
│   └── mermaid.ts
└── types/
    └── index.ts
```

#### 6. Event Handling Consistency
**Issue**: Mixed pointer/mouse events
```typescript
onPointerDown={handlePointer}  // Line 280
onMouseDown={handleMouse}      // Line 695
```

**Solution**: Standardize on pointer events (better touch support):
```typescript
// Use pointer events everywhere
onPointerDown={...}
onPointerMove={...}
onPointerUp={...}
```

### Security Considerations
✓ No XSS vulnerabilities (no dangerouslySetInnerHTML)
✓ User input properly escaped in Mermaid export
✓ File size validation could be added to export functions
⚠️ Consider adding max canvas size to prevent memory exhaustion

### Testing Recommendations
Current `runTests()` is clever but basic. Consider:
```typescript
// Use Jest + React Testing Library
describe('Node component', () => {
  it('should drag to new position', () => {
    const onMove = jest.fn();
    const { container } = render(<Node {...props} onMove={onMove} />);
    fireEvent.pointerDown(container.firstChild);
    fireEvent.pointerMove(container.firstChild, { clientX: 100, clientY: 100 });
    expect(onMove).toHaveBeenCalledWith(expectedPosition);
  });
});
```

## Architecture Patterns

### State Management
Uses custom `useLocalValue` hook for automatic localStorage sync:
```typescript
const [positions, setPositions] = useLocalValue("pcc_positions_v14", INITIAL_POS);
```

### Migration System
Handles legacy data formats on mount:
```typescript
useEffect(() => {
  // Migrate AAA → SMP
  // Update old label formats
  // Coerce edges array from object
}, []);
```

### Export Strategy
Tries multiple methods with fallbacks:
1. File System Access API (Chrome 86+)
2. Anchor download (universal)
3. Open in new tab (user can Save As)
4. Copy to clipboard (last resort)

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

## Next Steps / Enhancements

1. **Undo/Redo**: Implement history stack with Ctrl+Z/Y
2. **Multi-select**: Select/move multiple nodes at once
3. **Connection Anchors**: Specify exact connection points on nodes
4. **Arrowheads**: Add directional arrows to edges
5. **Themes**: Dark mode support
6. **Collaboration**: Real-time multi-user editing
7. **Templates**: Predefined network topology templates
8. **Validation**: Check for disconnected nodes or invalid connections
9. **Search**: Find nodes by label or type
10. **Minimap**: Overview navigator for large diagrams

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

---

## Emulating ChatGPT Canvas in Claude Code

This project demonstrates canvas-like functionality that runs in a standard browser environment. Key patterns:

1. **SVG-based rendering** for infinite canvas
2. **CSS transforms** for performant pan/zoom
3. **Pointer events** for unified mouse/touch handling
4. **LocalStorage** for persistence
5. **React hooks** for state management
6. **Graceful degradation** for export features

To extend this pattern for other diagram types, modify:
- `NODE_META_DEFAULT`: Define your node types
- `EDGES_DEFAULT`: Define your connections
- `Node` component: Customize visual appearance
- Export functions: Add your target format (e.g., PlantUML, Graphviz)
