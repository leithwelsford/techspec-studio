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
    // Font
    fontFamily: 'Arial, Helvetica, sans-serif',
  },
  securityLevel: 'loose',
  fontFamily: 'Arial, Helvetica, sans-serif',
  suppressErrorRendering: true,
})

// Initialize Mermaid docs cache in background (non-blocking)
import { initMermaidDocsCache } from './services/ai/mermaidDocsCache'
initMermaidDocsCache()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppContainer />
  </React.StrictMode>,
)
