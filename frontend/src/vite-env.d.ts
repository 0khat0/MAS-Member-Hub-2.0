/// <reference types="vite/client" />

// types for vite-plugin-pwa virtual module
declare module 'virtual:pwa-register' {
  export type RegisterSWOptions = {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
  }
  export function registerSW(options?: RegisterSWOptions): (reload?: boolean) => Promise<void>
  export default function registerSW(options?: RegisterSWOptions): (reload?: boolean) => Promise<void>
}
