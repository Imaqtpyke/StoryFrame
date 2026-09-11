import { ActivePage } from '../types';

interface FooterProps {
  onNavigate: (page: ActivePage) => void;
}

export default function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="w-full border-t border-white/10 bg-[#0C0C0B] py-6 sm:py-10 mt-10 sm:mt-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-5 sm:gap-6 font-narrative">
        <div className="text-center sm:text-left space-y-1 sm:space-y-1.5">
          <p className="text-white font-medium text-base sm:text-lg lg:text-xl font-display tracking-tight">
            StoryFrame
          </p>
          <p className="text-[#C4C4BE] sm:text-[#9C9C96] text-xs sm:text-sm leading-relaxed max-w-sm sm:max-w-none">
            Cinematic story, shot taxonomy, and narrator script breakdowns.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-6 gap-y-1 font-editorial-meta">
          <button
            type="button"
            id="footer-nav-terms"
            onClick={() => {
              onNavigate('terms');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-[9px] sm:text-[11px] min-h-[24px] sm:min-h-[44px] inline-flex items-center text-[#70706A] sm:text-[#9C9C96] hover:text-white transition-colors py-0.5 sm:py-1 focus:outline-none tracking-wider sm:tracking-widest"
          >
            Terms &amp; Conditions
          </button>
          <span className="text-white/20 hidden sm:inline">•</span>
          <button
            type="button"
            id="footer-nav-privacy"
            onClick={() => {
              onNavigate('privacy');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-[9px] sm:text-[11px] min-h-[24px] sm:min-h-[44px] inline-flex items-center text-[#70706A] sm:text-[#9C9C96] hover:text-white transition-colors py-0.5 sm:py-1 focus:outline-none tracking-wider sm:tracking-widest"
          >
            Privacy Policy
          </button>
        </div>
      </div>
    </footer>
  );
}
