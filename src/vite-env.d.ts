/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_3D_TILES_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
