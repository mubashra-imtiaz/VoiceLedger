import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const handler = (e: Event) => {
      e.preventDefault();

      // Defer state updates slightly to ensure component is fully mounted
      setTimeout(() => {
        if (isMounted) {
          setDeferredPrompt(e as BeforeInstallPromptEvent);
          setShowPrompt(true);
        }
      }, 0);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      isMounted = false;
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 rounded-xl bg-slate-900 p-4 text-white shadow-2xl flex items-center justify-between border border-slate-700 md:hidden">
      <div>
        <p className="font-semibold text-sm">Add VoiceLedger to Home Screen</p>
        <p className="text-xs text-slate-300">Access your orders and debts anytime offline.</p>
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={handleInstallClick}
          className="ml-3 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors"
        >
          Install
        </button>

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
