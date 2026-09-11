import { useEffect } from 'react';
import { ShieldCheck, ExternalLink, X, AlertTriangle, KeyRound } from 'lucide-react';

interface KeyConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pendingKeyPrefix: string;
}

export default function KeyConsentModal({
  isOpen,
  onClose,
  onConfirm,
  pendingKeyPrefix,
}: KeyConsentModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentDomain = typeof window !== 'undefined' ? window.location.origin : 'this domain';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200 font-narrative"
    >
      <div
        className="bg-[#121211] border border-white/20 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col corner-bracket-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#141412] z-10">
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 border border-white bg-white text-black flex items-center justify-center shrink-0">
              <ShieldCheck size={16} />
            </div>
            <div>
              <h3 id="consent-modal-title" className="font-display text-sm sm:text-base font-medium text-white">
                Direct Browser Execution Consent
              </h3>
              <p className="font-editorial-meta text-[10px] text-[#9C9C96]">
                BRING YOUR OWN KEY (BYOK) SECURITY NOTICE
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-consent-modal-btn"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-[#9C9C96] hover:text-white hover:bg-white/5 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 text-xs sm:text-sm text-[#D4D4D0] font-narrative leading-relaxed">
          <p className="text-[#F5F5F0]">
            Please review how your custom Gemini API key is handled prior to applying it:
          </p>

          <div className="space-y-3 bg-[#181816] border border-white/10 p-3.5 sm:p-4 text-xs text-[#C4C4C0]">
            <div className="flex items-start space-x-2.5">
              <span className="text-white font-bold font-editorial-meta">1.</span>
              <p>
                <strong className="text-white">Stays in this browser only:</strong> Your key is held only in this active browser session. Our backend servers never see, receive, or store your key.
              </p>
            </div>

            <div className="flex items-start space-x-2.5">
              <span className="text-white font-bold font-editorial-meta">2.</span>
              <p>
                <strong className="text-white">Direct browser network calls:</strong> API requests for story breakdowns will be sent directly from your browser to Google&apos;s API endpoints (<code className="text-[#F5F5F0] bg-black/60 px-1 py-0.5 border border-white/10 font-editorial-meta text-[10px]">generativelanguage.googleapis.com</code>). The key is visible in network requests in browser DevTools while the app runs.
              </p>
            </div>

            <div className="flex items-start space-x-2.5">
              <span className="text-white font-bold font-editorial-meta">3.</span>
              <p>
                <strong className="text-white">Your billing &amp; quota apply:</strong> Generation counts and token usage are billed directly to your own Google Cloud / Google AI Studio account and governed by your quota tiers.
              </p>
            </div>
          </div>

          {/* Security Recommendation */}
          <div className="p-3.5 sm:p-4 bg-[#18140B] border border-amber-800/80 space-y-2 text-xs">
            <div className="flex items-center space-x-2 text-amber-300 font-medium">
              <AlertTriangle size={14} className="shrink-0" />
              <span className="font-editorial-meta text-[11px]">RECOMMENDED KEY RESTRICTIONS ON GOOGLE CLOUD</span>
            </div>
            <p className="text-amber-200/90 leading-relaxed font-narrative">
              For best security before pasting your key, restrict it in the Google Cloud Console:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-amber-200/80 font-narrative">
              <li>
                <strong>HTTP Referrer Restriction:</strong> Limit allowed referrers to this application domain: <code className="bg-black/50 px-1 py-0.5 border border-amber-900/40 font-editorial-meta text-[10px] text-white break-all">{currentDomain}/*</code>
              </li>
              <li>
                <strong>API Restriction:</strong> Restrict key usage exclusively to the <strong>Generative Language API</strong>.
              </li>
            </ul>
            <div className="pt-1">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                id="google-api-key-mgmt-link"
                className="inline-flex items-center text-amber-400 hover:text-amber-300 underline font-editorial-meta text-[11px]"
              >
                <span>MANAGE AND RESTRICT YOUR API KEYS ON GOOGLE AI STUDIO</span>
                <ExternalLink size={11} className="ml-1 shrink-0" />
              </a>
            </div>
          </div>

          {pendingKeyPrefix && (
            <div className="flex items-center space-x-2 font-editorial-meta text-[10px] text-[#9C9C96]">
              <KeyRound size={12} className="shrink-0 text-[#7D7D76]" />
              <span>KEY TO APPLY: <code className="text-white">{pendingKeyPrefix}••••••••</code></span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-[#141412] flex flex-col sm:flex-row items-center justify-end gap-2.5 sticky bottom-0">
          <button
            type="button"
            id="cancel-consent-btn"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-[#9C9C96] hover:text-white bg-transparent hover:bg-white/5 font-editorial-meta text-xs transition-colors min-h-[40px] flex items-center justify-center"
          >
            CANCEL
          </button>
          <button
            type="button"
            id="confirm-consent-btn"
            onClick={onConfirm}
            className="w-full sm:w-auto px-5 py-2 bg-white text-black hover:bg-neutral-200 active:bg-neutral-300 font-editorial-meta text-xs font-semibold transition-colors min-h-[40px] flex items-center justify-center space-x-1.5 shadow-sm"
          >
            <ShieldCheck size={13} />
            <span>I UNDERSTAND &amp; APPLY KEY</span>
          </button>
        </div>
      </div>
    </div>
  );
}
