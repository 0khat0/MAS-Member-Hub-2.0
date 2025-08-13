// InstallPWA.tsx
// One-drop React component to show an "Add to Home Screen" button/prompt.
// - Android/Chrome (and desktop Chrome): uses the native beforeinstallprompt flow.
// - iOS Safari/Chrome: shows a tiny, friendly instruction sheet (since iOS has no API).
// - Hides itself if already installed or user dismissed recently.
// Usage: import and render <InstallPWA appName="MAS Hub" /> somewhere visible (e.g., Profile page).

import React from "react";

type Props = {
  appName?: string;           // Shown in the instructions
  dismissDays?: number;       // Hide after dismiss for N days (default 7)
  className?: string;         // Optional wrapper class
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed"; platform: string[] }>;
};

const LS_DISMISSED_AT = "pwa_install_dismissed_at";
const LS_INSTALLED = "pwa_installed";

// --- Helpers ---
function isStandalone(): boolean {
  // iOS Safari: navigator.standalone; Everywhere else: display-mode
  // Some browsers support both; either being true means "installed".
  const mql = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  const iosStandalone = (navigator as any).standalone === true;
  return mql || iosStandalone;
}

function isiOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform ?? "").toLowerCase().includes("mac") && "ontouchend" in document;
}

function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

function dismissedRecently(days: number): boolean {
  const v = localStorage.getItem(LS_DISMISSED_AT);
  if (!v) return false;
  const ts = Number(v);
  if (!Number.isFinite(ts)) return false;
  const ms = days * 24 * 60 * 60 * 1000;
  return Date.now() - ts < ms;
}

function rememberDismiss() {
  localStorage.setItem(LS_DISMISSED_AT, String(Date.now()));
}

function rememberInstalled() {
  localStorage.setItem(LS_INSTALLED, "1");
}

// --- Component ---
export default function InstallPWA({ appName = "MAS Hub", dismissDays = 7, className }: Props) {
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = React.useState(false);
  const [showIOSHelp, setShowIOSHelp] = React.useState(false);
  const [installed, setInstalled] = React.useState(isStandalone() || localStorage.getItem(LS_INSTALLED) === "1");

  React.useEffect(() => {
    if (installed) return; // already installed
    if (dismissedRecently(dismissDays)) return; // dismissed lately
    // Listen for native prompt (Android/Chrome)
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    // If no native prompt will arrive (e.g., iOS), still show button after a tiny delay
    const t = window.setTimeout(() => {
      if (!isStandalone() && !dismissedRecently(dismissDays)) {
        // Show prompt if either Android (will have deferred) or iOS (no API).
        setShow(true);
      }
    }, 500);

    window.addEventListener("beforeinstallprompt", onBIP as any);
    const onInstalled = () => {
      rememberInstalled();
      setInstalled(true);
      setShow(false);
      setShowIOSHelp(false);
    };
    window.addEventListener("appinstalled", onInstalled);

    // Also re-check standalone on visibility changes (iOS quirk)
    const onVis = () => {
      if (isStandalone()) {
        rememberInstalled();
        setInstalled(true);
        setShow(false);
        setShowIOSHelp(false);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP as any);
      window.removeEventListener("appinstalled", onInstalled);
      document.removeEventListener("visibilitychange", onVis);
      clearTimeout(t);
    };
  }, [installed, dismissDays]);

  if (installed || !show) return null;

  // Handlers
  async function handleInstallClick() {
    if (deferred) {
      try {
        await deferred.prompt();
        if (deferred.userChoice) {
          const res = await deferred.userChoice;
          if (res.outcome === "accepted") {
            rememberInstalled();
            setInstalled(true);
          } else {
            // User canceled
            rememberDismiss();
            setShow(false);
          }
        } else {
          // Some browsers don't expose userChoice; assume handled.
          rememberDismiss();
          setShow(false);
        }
      } catch {
        // Prompt failed; just hide for now.
        rememberDismiss();
        setShow(false);
      }
    } else if (isiOS()) {
      // Show iOS instruction sheet
      setShowIOSHelp(true);
    } else {
      // No prompt available and not iOS; hide
      rememberDismiss();
      setShow(false);
    }
  }

  function handleDismiss() {
    rememberDismiss();
    setShow(false);
    setShowIOSHelp(false);
  }

  // Minimal inline styles so it looks fine without a CSS framework
  const cardStyle: React.CSSProperties = {
    position: "fixed",
    bottom: 16,
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(0,0,0,0.85)",
    color: "#fff",
    borderRadius: 12,
    padding: "12px 14px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
    maxWidth: 420,
    width: "calc(100% - 24px)",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    zIndex: 9999,
  };

  const btnStyle: React.CSSProperties = {
    background: "#10b981",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "10px 12px",
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
  };

  const ghostBtn: React.CSSProperties = {
    background: "transparent",
    color: "#ddd",
    border: "1px solid #444",
    borderRadius: 10,
    padding: "8px 10px",
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
  };

  return (
    <div className={className}>
      {/* Compact banner */}
      {!showIOSHelp && (
        <div style={cardStyle} role="dialog" aria-live="polite" aria-label="Install app">
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>📲</span>
            <div style={{ fontSize: 14, lineHeight: 1.2 }}>
              <strong>Add {appName} to your home screen</strong>
              <div style={{ opacity: 0.8, marginTop: 2, fontSize: 12 }}>
                Quick access, full-screen, and faster loads.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleInstallClick} style={btnStyle}>
              {isiOS() ? "Show how" : "Install app"}
            </button>
            <button onClick={handleDismiss} style={ghostBtn}>
              Not now
            </button>
          </div>
        </div>
      )}

      {/* iOS help sheet */}
      {showIOSHelp && (
        <div style={cardStyle} role="dialog" aria-live="polite" aria-label="Add to Home Screen instructions">
          <div style={{ fontSize: 14, lineHeight: 1.4, marginBottom: 8 }}>
            <strong>iPhone / iPad</strong>
            <ol style={{ margin: "6px 0 0 16px", padding: 0 }}>
              <li style={{ marginBottom: 4 }}>
                Tap the <span aria-label="Share">🔗</span> <em>Share</em> button in Safari.
              </li>
              <li style={{ marginBottom: 4 }}>
                Scroll and choose <em>Add to Home Screen</em>.
              </li>
              <li>Tap <em>Add</em> to install {appName}.</li>
            </ol>
            <div style={{ opacity: 0.8, marginTop: 8 }}>
              Tip: If you're using Chrome on iOS, open this site in Safari to add it.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                // Hide the iOS help sheet and show the main install prompt again
                setShowIOSHelp(false);
              }}
              style={btnStyle}
            >
              Okay
            </button>
            <button onClick={handleDismiss} style={ghostBtn}>
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
