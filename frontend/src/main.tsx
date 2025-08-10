import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Register the service worker and show prompt when an update is available
const updateSW = registerSW({
  onNeedRefresh() {
    const el = document.getElementById('pwa-update')
    if (el) el.style.display = 'block'
  },
  onOfflineReady() {
    // Optional: could display a toast for offline readiness
  },
})

export function PWAUpdatePrompt() {
  return (
    <div
      id="pwa-update"
      style={{ display: 'none' }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-md px-3 py-2 shadow-lg bg-black/80 text-white text-sm z-50"
    >
      Update available —{' '}
      <button onClick={() => updateSW(true)} className="underline">
        Reload
      </button>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PWAUpdatePrompt />
    <App />
  </StrictMode>,
)
