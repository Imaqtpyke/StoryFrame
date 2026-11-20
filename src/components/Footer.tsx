import { useEffect, useState } from 'react';
import { ActivePage } from '../types';
import {
  AiUsageSnapshot,
  formatCompactTokenCount,
  getAiUsageSnapshot,
  subscribeAiUsage,
} from '../services/aiUsageStorage';

interface FooterProps {
  onNavigate: (page: ActivePage) => void;
}

export default function Footer({ onNavigate }: FooterProps) {
  const [usage, setUsage] = useState<AiUsageSnapshot>(() => getAiUsageSnapshot());

  useEffect(() => {
    setUsage(getAiUsageSnapshot());
    return subscribeAiUsage((next) => setUsage(next));
  }, []);

  const hasUsage = usage.allTime.requests > 0 || usage.session.requests > 0;

  const handleOpenPage = (page: ActivePage) => {
    onNavigate(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="w-full border-t border-white/10 bg-[#0C0C0B] py-6 sm:py-8 mt-12 sm:mt-16 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 font-narrative">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
          <div className="text-center md:text-left space-y-1">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <p className="text-white font-medium text-base sm:text-lg font-display tracking-tight">
                StoryFrame
              </p>
              <span className="stamp-chip text-[9px] bg-[#171715] text-[#A8A8A2] border-white/10">
                v3.7
              </span>
            </div>
            <p className="text-[#9C9C96] text-xs sm:text-sm leading-relaxed">
              Cinematic story, shot taxonomy, and narrator script breakdowns.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 font-display text-xs sm:text-sm">
            <button
              type="button"
              id="footer-ai-usage-btn"
              onClick={() => handleOpenPage('ai-usage')}
              className="min-h-[32px] inline-flex items-center gap-1.5 text-[#9C9C96] hover:text-white transition-colors py-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-white rounded-[2px] whitespace-nowrap shrink-0 cursor-pointer"
              title="Open AI Token and Request Usage page"
            >
              <span>AI Usage</span>
              {hasUsage && (
                <span className="text-[11px] font-mono tabular-nums text-[#7C7C76]">
                  · {formatCompactTokenCount(usage.session.totalTokens)} tok
                </span>
              )}
            </button>

            <span className="text-white/20 hidden sm:inline">/</span>
            <button
              type="button"
              id="footer-nav-security"
              onClick={() => handleOpenPage('byok-security')}
              className="min-h-[32px] inline-flex items-center text-[#9C9C96] hover:text-white transition-colors py-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-white rounded-[2px] whitespace-nowrap shrink-0 cursor-pointer"
            >
              BYOK Security
            </button>
            <span className="text-white/20 hidden sm:inline">/</span>
            <button
              type="button"
              id="footer-nav-help"
              onClick={() => handleOpenPage('guide')}
              className="min-h-[32px] inline-flex items-center text-[#9C9C96] hover:text-white transition-colors py-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-white rounded-[2px] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Help &amp; Guide
            </button>
            <span className="text-white/20 hidden sm:inline">/</span>
            <button
              type="button"
              id="footer-nav-terms"
              onClick={() => handleOpenPage('terms')}
              className="min-h-[32px] inline-flex items-center text-[#9C9C96] hover:text-white transition-colors py-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-white rounded-[2px] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Terms &amp; Conditions
            </button>
            <span className="text-white/20 hidden sm:inline">/</span>
            <button
              type="button"
              id="footer-nav-privacy"
              onClick={() => handleOpenPage('privacy')}
              className="min-h-[32px] inline-flex items-center text-[#9C9C96] hover:text-white transition-colors py-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-white rounded-[2px] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
