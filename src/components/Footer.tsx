import { ActivePage } from '../types';

interface FooterProps {
  onNavigate: (page: ActivePage) => void;
}

export default function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="w-full border-t border-white/10 bg-[#0C0C0B] py-6 sm:py-8 mt-12 sm:mt-16 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 font-narrative">
        <div className="text-center sm:text-left space-y-1">
          <div className="flex items-center justify-center sm:justify-start gap-2">
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

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-display text-xs sm:text-sm">
          <button
            type="button"
            id="footer-nav-security"
            onClick={() => {
              onNavigate('byok-security');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="min-h-[32px] inline-flex items-center text-[#9C9C96] hover:text-white transition-colors py-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-white rounded-[2px] cursor-pointer"
          >
            BYOK Security
          </button>
          <span className="text-white/20 hidden sm:inline">/</span>
          <button
            type="button"
            id="footer-nav-help"
            onClick={() => {
              onNavigate('guide');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="min-h-[32px] inline-flex items-center text-[#9C9C96] hover:text-white transition-colors py-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-white rounded-[2px] cursor-pointer"
          >
            Help &amp; Guide
          </button>
          <span className="text-white/20 hidden sm:inline">/</span>
          <button
            type="button"
            id="footer-nav-terms"
            onClick={() => {
              onNavigate('terms');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="min-h-[32px] inline-flex items-center text-[#9C9C96] hover:text-white transition-colors py-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-white rounded-[2px] cursor-pointer"
          >
            Terms &amp; Conditions
          </button>
          <span className="text-white/20 hidden sm:inline">/</span>
          <button
            type="button"
            id="footer-nav-privacy"
            onClick={() => {
              onNavigate('privacy');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="min-h-[32px] inline-flex items-center text-[#9C9C96] hover:text-white transition-colors py-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-white rounded-[2px] cursor-pointer"
          >
            Privacy Policy
          </button>
        </div>
      </div>
    </footer>
  );
}
