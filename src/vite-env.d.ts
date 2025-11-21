/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENROUTER_API_KEY?: string;
  readonly VITE_OPENROUTER_MODEL?: string;
  readonly VITE_AI_TEMPERATURE?: string;
  readonly VITE_AI_MAX_TOKENS?: string;
  readonly VITE_AI_ENABLE_STREAMING?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
