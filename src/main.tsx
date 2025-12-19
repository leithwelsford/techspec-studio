import React from 'react'
import ReactDOM from 'react-dom/client'
import mermaid from 'mermaid'
import AppContainer from './AppContainer.tsx'
import './index.css'

// Initialize Mermaid globally with consistent settings
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'system-ui, -apple-system, sans-serif',
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
