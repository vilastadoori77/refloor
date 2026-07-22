/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Inventory Service base URL, injected at build time in Azure (AZ-012). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
