import React from 'react'
import ReactDOM from 'react-dom/client'
import mermaid from 'mermaid'
import AppContainer from './AppContainer.tsx'
import './index.css'

// Initialize Mermaid globally with consistent settings
// Using 'base' theme with black & white colors for 3GPP-style technical diagrams
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    // Black & white theme for professional technical specifications
    primaryColor: '#ffffff',
    primaryBorderColor: '#000000',
    primaryTextColor: '#000000',
    secondaryColor: '#f5f5f5',
    secondaryBorderColor: '#000000',
    secondaryTextColor: '#000000',
    tertiaryColor: '#ffffff',
    tertiaryBorderColor: '#000000',
    tertiaryTextColor: '#000000',
    lineColor: '#000000',
    textColor: '#000000',
    // Notes
    noteBkgColor: '#f5f5f5',
    noteTextColor: '#000000',
    noteBorderColor: '#000000',
    // Sequence diagrams
    actorBkg: '#ffffff',
    actorBorder: '#000000',
    actorTextColor: '#000000',
    actorLineColor: '#000000',
    signalColor: '#000000',
    signalTextColor: '#000000',
    activationBkgColor: '#f5f5f5',
    activationBorderColor: '#000000',
    // State diagrams
    labelColor: '#000000',
    altBackground: '#f5f5f5',
    // Flowchart
    nodeBorder: '#000000',
    clusterBkg: '#ffffff',
    clusterBorder: '#000000',
    defaultLinkColor: '#000000',
    edgeLabelBackground: '#ffffff',
    // ER diagrams — without these the relationship labels render as
    // filled black rectangles with invisible text
    attributeBackgroundColorEven: '#ffffff',
    attributeBackgroundColorOdd: '#f5f5f5',
    // Font
    fontFamily: 'Arial, Helvetica, sans-serif',
  },
  // ER diagram config — fill/stroke for relationship labels
  er: {
    useMaxWidth: false,
    fill: '#ffffff',
    stroke: '#000000',
  },
  securityLevel: 'loose',
  fontFamily: 'Arial, Helvetica, sans-serif',
  suppressErrorRendering: true,
  // Flowchart layout — generous spacing avoids label overlap.
  // wrappingWidth: how wide a label can grow before Mermaid wraps it.
  // Default is ~200px; 500 gives labels plenty of room to breathe.
  flowchart: {
    nodeSpacing: 60,
    rankSpacing: 80,
    padding: 20,
    useMaxWidth: false,
    curve: 'basis',
    diagramPadding: 20,
    htmlLabels: false,
    wrappingWidth: 500,
  } as any,
  // State diagram layout — state diagrams with bi-directional transitions
  // (A→B and B→A) stack their labels in the same space, so we need very
  // generous rank spacing to separate them.
  // htmlLabels: true uses HTML <div> in <foreignObject> so text doesn't
  // get pre-wrapped into separate SVG tspans (casting to any because this
  // option isn't in Mermaid's TS types for state diagrams but is supported).
  state: {
    nodeSpacing: 120,
    rankSpacing: 200,
    padding: 30,
    useMaxWidth: false,
    defaultRenderer: 'dagre-wrapper',
    htmlLabels: true,
    wrappingWidth: 500,
  } as any,
  // Sequence diagram layout
  sequence: {
    actorMargin: 60,
    messageMargin: 45,
    boxMargin: 15,
    noteMargin: 15,
    useMaxWidth: false,
  },
})

// Initialize Mermaid docs cache in background (non-blocking)
import { initMermaidDocsCache } from './services/ai/mermaidDocsCache'
initMermaidDocsCache()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppContainer />
  </React.StrictMode>,
)
