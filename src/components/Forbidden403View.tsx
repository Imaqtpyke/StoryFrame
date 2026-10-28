import React from 'react';
import { ShieldAlert, ArrowLeft, Sliders, ExternalLink, Key, CheckCircle2 } from 'lucide-react';

interface Forbidden403ViewProps {
  errorMessage?: string;
  onBackToEdit: () => void;
  onOpenModelOptions?: () => void;
}

export default function Forbidden403View({
  errorMessage,
  onBackToEdit,
  onOpenModelOptions,
}: Forbidden403ViewProps) {
  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 font-narrative text-[#F5F5F0] py-6 sm:py-10 animate-in fade-in duration-200">
      {/* Top Back Navigation */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <button
          type="button"
          onClick={onBackToEdit}
          className="inline-flex items-center text-xs sm:text-sm text-[#9C9C96] hover:text-white transition-colors py-1 font-display cursor-pointer"
        >
          <ArrowLeft size={13} className="mr-1.5 shrink-0 sm:w-3.5 sm:h-3.5" />
          <span>Return to Story Generator</span>
        </button>
        <span className="font-editorial-meta text-[10px] text-amber-400/90 uppercase tracking-widest">
          HTTP 403 Forbidden
        </span>
      </div>

      {/* Main 403 Card */}
      <div className="p-6 sm:p-8 bg-[#121211] border border-amber-500/40 rounded-[2px] shadow-2xl space-y-6">
        <div className="flex items-start space-x-3.5 sm:space-x-4">
          <div className="p-2.5 bg-amber-950/40 border border-amber-500/40 rounded-[2px] shrink-0 text-amber-400 mt-0.5">
            <ShieldAlert size={22} />
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="stamp-chip bg-amber-950/80 text-amber-300 border-amber-700/80 text-[8px] sm:text-[9px] font-bold">
                ACCESS RESTRICTED
              </span>
              <span className="font-editorial-meta text-[9px] text-[#A0A09A]">
                Google Generative Language API
              </span>
            </div>
            <h2 className="text-base sm:text-xl font-display font-medium text-white tracking-tight">
              API Key Permission Denied (403 Forbidden)
            </h2>
            <p className="text-xs sm:text-sm text-[#C4C4BE] leading-relaxed">
              {errorMessage || 'The API server recognized your credentials, but rejected the request due to restricted permissions or missing API scopes.'}
            </p>
          </div>
        </div>

        {/* Self-Service Troubleshooting Checklist */}
        <div className="p-4 bg-[#171715] border border-white/10 rounded-[2px] space-y-3">
          <span className="font-editorial-meta text-[9px] sm:text-[10px] text-white uppercase tracking-wider block">
            Self-Service Authorization Checklist:
          </span>
          <ul className="space-y-2 text-xs text-[#C4C4BE] font-narrative">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={13} className="text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Enable Generative Language API:</strong> In your Google Cloud / Google AI Studio project, ensure that the <em>Generative Language API</em> is active and enabled for this API key.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={13} className="text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Check HTTP Referrer Restrictions:</strong> If your key has HTTP website restrictions, verify that this application URL is whitelisted, or set website restrictions to <em>None</em> in the Google Cloud console for testing.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={13} className="text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Verify Active AI Studio Key:</strong> Keys generated directly in Google AI Studio have automatic permissions for Gemini models.
              </span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-white/10">
          {onOpenModelOptions && (
            <button
              type="button"
              id="open-model-options-403-btn"
              onClick={onOpenModelOptions}
              className="inline-flex items-center px-3.5 py-2 bg-white text-black font-semibold text-xs rounded-[2px] hover:bg-[#EAEAE5] transition-colors cursor-pointer"
            >
              <Key size={13} className="mr-1.5" />
              <span>Update API Key in Settings</span>
            </button>
          )}

          <button
            type="button"
            id="back-to-generator-403-btn"
            onClick={onBackToEdit}
            className="inline-flex items-center px-3.5 py-2 bg-[#1C1C1A] text-white border border-white/20 hover:border-white text-xs rounded-[2px] transition-colors cursor-pointer"
          >
            <span>Return to Story Form</span>
          </button>

          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-3 py-2 text-[#A0A09A] hover:text-white text-xs font-editorial-meta transition-colors ml-auto gap-1"
          >
            <span>Google AI Studio Console</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}
