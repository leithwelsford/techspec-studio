import React from 'react'
import ReactDOM from 'react-dom/client'
import AppContainer from './AppContainer.tsx'
import './index.css'

// Initialize Mermaid docs cache in background (non-blocking)
import { initMermaidDocsCache } from './services/ai/mermaidDocsCache'
initMermaidDocsCache()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppContainer />
  </React.StrictMode>,
)
