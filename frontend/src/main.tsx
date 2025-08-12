import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'
import { bootstrapSession } from './lib/session'

// tiny SW debug helpers
async function unregisterSWIfNoSWParam() {
  if (location.search.includes('nosw')) {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
      if (caches) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
    }
  }
}

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

function BootstrapGate() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    (async () => {
      await unregisterSWIfNoSWParam()
      try {
        // Skip session probe on admin routes to avoid banner there
        if (!location.pathname.startsWith('/admin')) {
          await bootstrapSession(6000)
        }
      } catch (e: any) {
        setError(e?.message || 'failed')
      } finally {
        setReady(true)
      }
    })()
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center flex-col gap-3 text-white/80">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500" />
        <div className="text-xs opacity-70">Starting…</div>
      </div>
    )
  }

  return (
    <>
      {error && !location.pathname.startsWith('/admin') && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs px-3 py-2 rounded z-50">
          Couldn’t start session: {error}. <button onClick={()=>location.reload()} className="underline">Reload</button>
        </div>
      )}
      <PWAUpdatePrompt />
      <App />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BootstrapGate />
  </StrictMode>,
)
