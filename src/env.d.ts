/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CATALOG_URL?: string
  readonly VITE_ASSET_BASE_URL?: string
  readonly VITE_MODEL_LOAD_TIMEOUT_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
