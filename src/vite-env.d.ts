/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE_API: string;
  readonly VITE_WEB_BASE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Fix asset imports
declare module "*.png" {
  const src: string;
  export default src;
}
declare module "*.jpeg" {
  const src: string;
  export default src;
}
declare module "*.jpg" {
  const src: string;
  export default src;
}
declare module "*.svg" {
  const src: string;
  export default src;
}
declare module "*.ico" {
  const src: string;
  export default src;
}
