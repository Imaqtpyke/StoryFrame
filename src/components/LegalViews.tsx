import { ArrowLeft, Shield, FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import { ActivePage } from '../types';

interface LegalViewProps {
  page: 'terms' | 'privacy';
  onBack: () => void;
  onNavigate?: (page: ActivePage) => void;
}

export default function LegalView({ page, onBack, onNavigate }: LegalViewProps) {
  const isTerms = page === 'terms';

  const handleSwitchTab = (newPage: 'terms' | 'privacy') => {
    if (onNavigate) {
      onNavigate(newPage);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-200 font-narrative text-[#F5F5F0]">
      {/* Top action and page navigation bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-6 border-b border-white/10">
        <button
          type="button"
          id="legal-back-button"
          onClick={onBack}
          className="inline-flex items-center text-xs sm:text-sm text-[#9C9C96] hover:text-white transition-colors min-h-[44px] py-1 font-display"
        >
          <ArrowLeft size={14} className="mr-1.5 shrink-0" />
          Back to Generator
        </button>

        {/* Tab switch between Terms and Privacy */}
        <div className="inline-flex items-stretch border border-white/10 bg-[#121211] p-0.5 text-[10px] sm:text-xs font-editorial-meta">
          <button
            type="button"
            id="tab-terms-btn"
            onClick={() => handleSwitchTab('terms')}
            className={`px-2.5 sm:px-3 py-1.5 transition-all min-h-[34px] sm:min-h-[30px] flex items-center ${
              isTerms
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'text-[#9C9C96] hover:text-white'
            }`}
          >
            <FileText size={12} className="mr-1.5 shrink-0" />
            TERMS OF SERVICE
          </button>
          <button
            type="button"
            id="tab-privacy-btn"
            onClick={() => handleSwitchTab('privacy')}
            className={`px-2.5 sm:px-3 py-1.5 transition-all min-h-[34px] sm:min-h-[30px] flex items-center ${
              !isTerms
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'text-[#9C9C96] hover:text-white'
            }`}
          >
            <Shield size={12} className="mr-1.5 shrink-0" />
            PRIVACY POLICY
          </button>
        </div>
      </div>

      {/* Header Block */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 bg-[#181816] border border-white/10 flex items-center justify-center text-white shrink-0">
            {isTerms ? <FileText size={14} /> : <Shield size={14} />}
          </div>
          <span className="font-editorial-meta text-[10px] sm:text-[11px] text-[#9C9C96]">
            STORYFRAME LEGAL DOCUMENTATION
          </span>
        </div>

        <h1
          className="font-normal text-white font-display tracking-tight"
          style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)' }}
        >
          {isTerms ? 'Terms & Conditions' : 'Privacy Policy'}
        </h1>

        <div className="flex flex-wrap items-center gap-2 font-editorial-meta text-[9px] sm:text-[10px] text-[#7D7D76]">
          <span>EFFECTIVE DATE: SEPTEMBER 2026</span>
          <span>•</span>
          <span>VERSION 1.2</span>
          <span>•</span>
          <span>STANDARD OPERATING POLICY</span>
        </div>
      </div>

      {/* Key Highlights Summary Box with Corner Brackets */}
      <div className="bg-[#121211] border border-white/10 p-4 sm:p-6 space-y-3 corner-bracket-container shadow-xl">
        <span className="font-editorial-meta text-[11px] text-white font-semibold block">
          KEY HIGHLIGHTS &amp; SUMMARY
        </span>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-[#D4D4D0] font-narrative leading-relaxed">
          {isTerms ? (
            <>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>You retain full ownership of all story ideas you submit.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>Generated prompts and scripts are free for commercial production.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>No automated scraping or abusive query flooding.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>Outputs are subject to standard Google Gemini API terms.</span>
              </li>
            </>
          ) : (
            <>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>Story manuscripts are never stored on any remote server.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>API keys remain in your browser and are never sent to our backend.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>Zero third-party tracking cookies or advertising pixels.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>Active generations exist solely within your active browser session.</span>
              </li>
            </>
          )}
        </ul>
      </div>

      {/* Main Full Legal Text Container */}
      <div className="bg-[#121211] border border-white/10 p-5 sm:p-7 md:p-8 space-y-7 text-[#D4D4D0] text-sm leading-relaxed font-narrative">
        {isTerms ? (
          <>
            <section className="space-y-2">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                1. Acceptance of Terms
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                By accessing or using StoryFrame, you agree to comply with and be bound by these Terms and Conditions. If you do not agree to these terms, you must discontinue use of the application immediately. Continued use constitutes acceptance of all terms herein.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                2. Scope of Service
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                StoryFrame provides automated narrative breakdown tools, visual beat image prompt generation, and narrator script timing calculators. You are solely responsible for any inputs, story concepts, character prompts, or media generated through your use of the tool.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                3. Intellectual Property and Content Ownership
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                You retain all right, title, and interest in original story concepts and narrative materials provided to the platform. StoryFrame asserts no intellectual property ownership over generated scripts, visual beats, or storyboard breakdowns created from your inputs.
              </p>
              <p className="text-[#9C9C96] text-xs mt-2 leading-relaxed">
                You agree not to submit material that knowingly infringes upon third-party copyrights, registered trademarks, or proprietary trade secrets.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                4. API Usage and Platform Limits
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                StoryFrame connects to the official Google Gemini API to process story data. Usage is subject to platform rate limits, quotas, and service terms established by Google Cloud. Service availability is subject to upstream API uptime and capacity.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                5. Disclaimer of Warranties and Limitation of Liability
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                The service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis without warranties of any kind, whether express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, or non-infringement.
              </p>
            </section>
          </>
        ) : (
          <>
            <section className="space-y-2">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                1. Information We Collect
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                StoryFrame operates with a zero-storage, fully client-side privacy model. When you submit a story idea, generation requests are dispatched straight from your browser to the Google Gemini API endpoints using your provided API key. We do not operate an intermediate logging server or store your story manuscripts.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                2. Third-Party AI Processing
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                Story breakdown, scene prompts, and narrator lines are synthesized via official Google Gemini API models. Story and character style inputs are transmitted securely to Google servers for the sole purpose of generating the requested outputs in accordance with Google Cloud enterprise privacy standards.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                3. Local Storage and Client Sessions
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                Your generated scenes, temporary storyboard state, and exported files are retained inside your active browser session only. We do not place persistent tracking cookies, fingerprinting scripts, or third-party advertising pixels on your device.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                4. Data Security &amp; Key Isolation
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                All API keys provided in Bring Your Own Key (BYOK) mode remain isolated inside browser memory or optional session storage. They are never sent to or stored on any external proxy server. All communications with Google Gemini API endpoints occur over encrypted TLS/HTTPS connections.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                5. Inquiries &amp; Policy Updates
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                For questions regarding this Privacy Policy or data handling procedures, please contact the administrator via the application settings interface.
              </p>
            </section>
          </>
        )}
      </div>

      {/* Bottom Footer Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="w-full sm:w-auto px-5 py-2.5 bg-white text-black hover:bg-neutral-200 active:bg-neutral-300 text-xs font-editorial-meta font-semibold transition-colors min-h-[44px] flex items-center justify-center space-x-1.5"
        >
          <ArrowLeft size={13} />
          <span>RETURN TO STORY GENERATOR</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab(isTerms ? 'privacy' : 'terms')}
          className="w-full sm:w-auto px-4 py-2.5 text-[#9C9C96] hover:text-white bg-[#181816] hover:bg-[#242422] border border-white/10 text-xs font-editorial-meta transition-colors min-h-[44px] flex items-center justify-center space-x-1.5"
        >
          <span>{isTerms ? 'READ PRIVACY POLICY' : 'READ TERMS & CONDITIONS'}</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
