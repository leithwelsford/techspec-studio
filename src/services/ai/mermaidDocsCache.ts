/**
 * Mermaid Documentation Cache Service
 *
 * Fetches and caches current Mermaid syntax documentation.
 * Falls back to embedded docs when network unavailable.
 */

// Note: MermaidDocEntry type is available from mermaidDocSearch if needed for extensions

const CACHE_KEY = 'mermaid-docs-cache';
const CACHE_VERSION_KEY = 'mermaid-docs-version';
const CACHE_TIMESTAMP_KEY = 'mermaid-docs-timestamp';
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Current bundled Mermaid version for comparison
const BUNDLED_MERMAID_VERSION = '11.12.1';

interface CachedDocs {
  version: string;
  timestamp: number;
  docs: MermaidSyntaxDocs;
}

export interface MermaidSyntaxDocs {
  sequenceDiagram: string;
  flowchart: string;
  stateDiagram: string;
  classDiagram: string;
  version: string;
  lastUpdated: string;
}

/**
 * Default embedded documentation (fallback)
 */
const EMBEDDED_DOCS: MermaidSyntaxDocs = {
  version: BUNDLED_MERMAID_VERSION,
  lastUpdated: '2024-12-01',

  sequenceDiagram: `
## Mermaid Sequence Diagram Syntax (v11)

### Declaration
\`\`\`
sequenceDiagram
\`\`\`

### Participants
- \`participant Alice\` - Declare participant
- \`participant A as Alice\` - With alias
- \`actor User\` - Actor (stick figure)
- \`participant A as Alice<br/>Smith\` - Multiline with <br/>

### Messages (Arrows)
| Syntax | Description |
|--------|-------------|
| \`A->>B: msg\` | Solid line with arrowhead |
| \`A-->>B: msg\` | Dotted line with arrowhead |
| \`A-)B: msg\` | Solid line with open arrow (async) |
| \`A--)B: msg\` | Dotted line with open arrow (async) |
| \`A-xB: msg\` | Solid line with cross (lost message) |
| \`A--xB: msg\` | Dotted line with cross |

### Activation
- \`A->>+B: msg\` - Activate B (+ after arrow)
- \`B-->>-A: msg\` - Deactivate B (- after arrow)
- Or use explicit: \`activate B\` / \`deactivate B\`

### Notes
- \`Note right of A: text\`
- \`Note left of A: text\`
- \`Note over A: text\`
- \`Note over A,B: text\` - Spanning participants

### Control Flow
\`\`\`
alt Condition
    A->>B: Message
else Other condition
    A->>B: Other message
end

opt Optional
    A->>B: Optional message
end

loop Every minute
    A->>B: Ping
end

par Parallel
    A->>B: Message 1
and
    A->>C: Message 2
end

critical Critical section
    A->>B: Important
option Timeout
    A->>B: Timeout handler
end

break When condition fails
    A->>B: Break out
end
\`\`\`

### Grouping
\`\`\`
rect rgb(200, 220, 240)
    A->>B: Grouped messages
end
\`\`\`

### Common Mistakes to Avoid
- ❌ \`A->B\` (single arrow - use \`A->>B\`)
- ❌ \`A-->B\` (use \`A-->>B\` for dotted)
- ❌ Spaces in participant names without quotes
- ❌ Unmatched activate/deactivate
- ❌ Using \\n in labels (use <br/> instead)
`,

  flowchart: `
## Mermaid Flowchart Syntax (v11)

### Declaration & Direction
\`\`\`
flowchart TD    %% Top to Down
flowchart LR    %% Left to Right
flowchart BT    %% Bottom to Top
flowchart RL    %% Right to Left
\`\`\`

### Node Shapes
| Syntax | Shape |
|--------|-------|
| \`id[text]\` | Rectangle |
| \`id(text)\` | Rounded rectangle |
| \`id([text])\` | Stadium (pill) |
| \`id[[text]]\` | Subroutine |
| \`id[(text)]\` | Cylinder (database) |
| \`id((text))\` | Circle |
| \`id{text}\` | Rhombus (decision) |
| \`id{{text}}\` | Hexagon |
| \`id[/text/]\` | Parallelogram |
| \`id[\\text\\]\` | Parallelogram alt |
| \`id[/text\\]\` | Trapezoid |
| \`id[\\text/]\` | Trapezoid alt |
| \`id>text]\` | Asymmetric |

### Links (Arrows)
| Syntax | Description |
|--------|-------------|
| \`A --> B\` | Arrow |
| \`A --- B\` | Line (no arrow) |
| \`A -.-> B\` | Dotted arrow |
| \`A ==> B\` | Thick arrow |
| \`A --text--> B\` | Arrow with text |
| \`A -->|text| B\` | Arrow with text (alt) |
| \`A <--> B\` | Bidirectional |

### Subgraphs
\`\`\`
subgraph Title
    A --> B
end

subgraph one [Title One]
    direction TB
    A --> B
end
\`\`\`

### Styling
\`\`\`
style id fill:#f9f,stroke:#333,stroke-width:2px
classDef className fill:#f9f,stroke:#333
class nodeId className
\`\`\`

### Common Mistakes to Avoid
- ❌ \`graph TD\` (deprecated, use \`flowchart TD\`)
- ❌ Missing spaces around arrows
- ❌ Unquoted special characters in labels
`,

  stateDiagram: `
## Mermaid State Diagram Syntax (v11)

### Declaration
\`\`\`
stateDiagram-v2
\`\`\`

### States
- \`state "Long name" as s1\` - State with alias
- \`[*]\` - Start/end state (pseudo-state)

### Transitions
\`\`\`
stateDiagram-v2
    [*] --> Still
    Still --> [*]
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]
\`\`\`

### Transition Labels
\`\`\`
s1 --> s2 : Event / Action
\`\`\`

### Composite States
\`\`\`
state First {
    [*] --> second
    second --> [*]
}
\`\`\`

### Choice (Conditional)
\`\`\`
state if_state <<choice>>
[*] --> if_state
if_state --> State1 : Condition 1
if_state --> State2 : Condition 2
\`\`\`

### Fork/Join (Parallel)
\`\`\`
state fork_state <<fork>>
state join_state <<join>>
[*] --> fork_state
fork_state --> State2
fork_state --> State3
State2 --> join_state
State3 --> join_state
join_state --> State4
\`\`\`

### Notes
\`\`\`
note right of State1
    Important information
end note

note left of State2 : Short note
\`\`\`

### Concurrency
\`\`\`
state Active {
    [*] --> Running
    --
    [*] --> Monitoring
}
\`\`\`

### Common Mistakes to Avoid
- ❌ \`stateDiagram\` without \`-v2\` (use v2 for features)
- ❌ Missing \`[*]\` for start state
- ❌ Forgetting \`end note\` for multiline notes
`,

  classDiagram: `
## Mermaid Class Diagram Syntax (v11)

### Declaration
\`\`\`
classDiagram
\`\`\`

### Class Definition
\`\`\`
class Animal {
    +String name
    +int age
    +makeSound() void
}

class Animal
Animal : +String name
Animal : +makeSound()
\`\`\`

### Visibility
- \`+\` Public
- \`-\` Private
- \`#\` Protected
- \`~\` Package/Internal

### Relationships
| Syntax | Type |
|--------|------|
| \`A <|-- B\` | Inheritance |
| \`A *-- B\` | Composition |
| \`A o-- B\` | Aggregation |
| \`A --> B\` | Association |
| \`A -- B\` | Link (solid) |
| \`A ..> B\` | Dependency |
| \`A ..|> B\` | Realization |

### Cardinality
\`\`\`
Customer "1" --> "*" Order
\`\`\`

### Annotations
\`\`\`
<<interface>> Shape
<<abstract>> Animal
<<enumeration>> Color
\`\`\`

### Common Mistakes to Avoid
- ❌ Missing class keyword
- ❌ Wrong relationship arrow direction
- ❌ Spaces in class names
`
};

/**
 * Get cached docs from localStorage
 */
function getCachedDocs(): CachedDocs | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as CachedDocs;
    return parsed;
  } catch (error) {
    console.warn('Failed to read cached Mermaid docs:', error);
    return null;
  }
}

/**
 * Save docs to cache
 */
function saveCachedDocs(docs: MermaidSyntaxDocs, version: string): void {
  try {
    const cached: CachedDocs = {
      version,
      timestamp: Date.now(),
      docs
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    localStorage.setItem(CACHE_VERSION_KEY, version);
    localStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()));
    console.log(`✅ Mermaid docs cached (version ${version})`);
  } catch (error) {
    console.warn('Failed to cache Mermaid docs:', error);
  }
}

/**
 * Check if cache is stale
 */
function isCacheStale(): boolean {
  try {
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (!timestamp) return true;

    const age = Date.now() - parseInt(timestamp, 10);
    return age > CACHE_MAX_AGE_MS;
  } catch {
    return true;
  }
}

/**
 * Fetch latest Mermaid version from npm registry
 */
async function fetchLatestMermaidVersion(): Promise<string | null> {
  try {
    const response = await fetch('https://registry.npmjs.org/mermaid/latest', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.version || null;
  } catch (error) {
    console.warn('Failed to fetch Mermaid version:', error);
    return null;
  }
}

/**
 * Fetch and parse documentation from Mermaid website
 */
async function fetchMermaidDocs(diagramType: string): Promise<string | null> {
  const urls: Record<string, string> = {
    sequenceDiagram: 'https://mermaid.js.org/syntax/sequenceDiagram.html',
    flowchart: 'https://mermaid.js.org/syntax/flowchart.html',
    stateDiagram: 'https://mermaid.js.org/syntax/stateDiagram.html',
    classDiagram: 'https://mermaid.js.org/syntax/classDiagram.html'
  };

  const url = urls[diagramType];
  if (!url) return null;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) return null;

    const html = await response.text();

    // Extract main content (basic extraction - could be improved)
    const contentMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                         html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);

    if (!contentMatch) return null;

    // Convert HTML to simplified markdown-like text
    let content = contentMatch[1]
      .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n')
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
      .replace(/<[^>]+>/g, '') // Remove remaining HTML tags
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
      .trim();

    return content;
  } catch (error) {
    console.warn(`Failed to fetch ${diagramType} docs:`, error);
    return null;
  }
}

/**
 * Check for updates and refresh cache if needed
 */
export async function refreshDocsIfNeeded(): Promise<boolean> {
  // Check if cache is stale
  if (!isCacheStale()) {
    console.log('📚 Mermaid docs cache is fresh');
    return false;
  }

  console.log('🔄 Checking for Mermaid docs updates...');

  // Check latest version
  const latestVersion = await fetchLatestMermaidVersion();
  const cachedVersion = localStorage.getItem(CACHE_VERSION_KEY);

  if (!latestVersion) {
    console.log('⚠️ Could not check Mermaid version (offline?)');
    return false;
  }

  if (cachedVersion === latestVersion) {
    // Update timestamp to prevent frequent checks
    localStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()));
    console.log(`📚 Mermaid docs up to date (v${latestVersion})`);
    return false;
  }

  console.log(`📥 Updating Mermaid docs: ${cachedVersion || 'none'} → ${latestVersion}`);

  // Fetch all diagram type docs
  const [seqDocs, flowDocs, stateDocs, classDocs] = await Promise.all([
    fetchMermaidDocs('sequenceDiagram'),
    fetchMermaidDocs('flowchart'),
    fetchMermaidDocs('stateDiagram'),
    fetchMermaidDocs('classDiagram')
  ]);

  // Only update if we got at least some docs
  if (seqDocs || flowDocs || stateDocs || classDocs) {
    const newDocs: MermaidSyntaxDocs = {
      version: latestVersion,
      lastUpdated: new Date().toISOString().split('T')[0],
      sequenceDiagram: seqDocs || EMBEDDED_DOCS.sequenceDiagram,
      flowchart: flowDocs || EMBEDDED_DOCS.flowchart,
      stateDiagram: stateDocs || EMBEDDED_DOCS.stateDiagram,
      classDiagram: classDocs || EMBEDDED_DOCS.classDiagram
    };

    saveCachedDocs(newDocs, latestVersion);
    return true;
  }

  console.log('⚠️ Could not fetch Mermaid docs, using embedded');
  return false;
}

/**
 * Get Mermaid syntax documentation
 * Uses cache if available, falls back to embedded docs
 */
export function getMermaidDocs(): MermaidSyntaxDocs {
  const cached = getCachedDocs();

  if (cached && cached.docs) {
    console.log(`📚 Using cached Mermaid docs (v${cached.version})`);
    return cached.docs;
  }

  console.log(`📚 Using embedded Mermaid docs (v${EMBEDDED_DOCS.version})`);
  return EMBEDDED_DOCS;
}

/**
 * Get documentation for a specific diagram type
 */
export function getDiagramTypeDocs(diagramType: 'sequence' | 'flow' | 'state' | 'class'): string {
  const docs = getMermaidDocs();

  switch (diagramType) {
    case 'sequence':
      return docs.sequenceDiagram;
    case 'flow':
      return docs.flowchart;
    case 'state':
      return docs.stateDiagram;
    case 'class':
      return docs.classDiagram;
    default:
      return '';
  }
}

/**
 * Get compact syntax reference for prompts (shorter version)
 */
export function getCompactSyntaxReference(diagramType: 'sequence' | 'flow' | 'state' | 'class'): string {
  const fullDocs = getDiagramTypeDocs(diagramType);

  // Extract just the essential syntax tables and examples
  // This is a shorter version suitable for inclusion in AI prompts
  const lines = fullDocs.split('\n');
  const essentialLines: string[] = [];
  let inCodeBlock = false;
  let inTable = false;
  let lineCount = 0;
  const maxLines = 60; // Limit to keep prompt size reasonable

  for (const line of lines) {
    if (lineCount >= maxLines) break;

    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      essentialLines.push(line);
      lineCount++;
      continue;
    }

    if (line.startsWith('|')) {
      inTable = true;
      essentialLines.push(line);
      lineCount++;
      continue;
    } else if (inTable && !line.startsWith('|')) {
      inTable = false;
    }

    // Include headers, code blocks, and tables
    if (line.startsWith('#') || inCodeBlock || inTable ||
        line.startsWith('- ❌') || line.startsWith('- `')) {
      essentialLines.push(line);
      lineCount++;
    }
  }

  return essentialLines.join('\n');
}

/**
 * Initialize docs cache (call on app startup)
 */
export async function initMermaidDocsCache(): Promise<void> {
  // Try to refresh in background, don't block startup
  refreshDocsIfNeeded().catch(err => {
    console.warn('Background Mermaid docs refresh failed:', err);
  });
}

/**
 * Force refresh docs from network
 */
export async function forceRefreshDocs(): Promise<boolean> {
  // Clear cache timestamp to force refresh
  localStorage.removeItem(CACHE_TIMESTAMP_KEY);
  return refreshDocsIfNeeded();
}

/**
 * Get cache status for debugging
 */
export function getCacheStatus(): {
  hasCache: boolean;
  version: string | null;
  age: number | null;
  isStale: boolean;
} {
  const cached = getCachedDocs();
  const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

  return {
    hasCache: !!cached,
    version: cached?.version || null,
    age: timestamp ? Date.now() - parseInt(timestamp, 10) : null,
    isStale: isCacheStale()
  };
}
