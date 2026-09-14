import { useState } from 'react';
import {
  ArrowLeft,
  Shield,
  FileText,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  Clapperboard,
  Image as ImageIcon,
  Volume2,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { ActivePage } from '../types';
import { FREE_IMAGE_TOOLS, FREE_VIDEO_TOOLS, FREE_TTS_TOOLS } from '../data/toolsData';

interface LegalViewProps {
  page: 'terms' | 'privacy' | 'guide';
  onBack: () => void;
  onNavigate?: (page: ActivePage) => void;
}

type GuideSubSection = 'workflow' | 'image-tools' | 'video-tools' | 'tts-tools';

export default function LegalView({ page, onBack, onNavigate }: LegalViewProps) {
  const [guideSubSection, setGuideSubSection] = useState<GuideSubSection>('workflow');

  const isTerms = page === 'terms';
  const isPrivacy = page === 'privacy';
  const isGuide = page === 'guide';

  const handleSwitchTab = (newPage: ActivePage) => {
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

        {/* Tab switch between Guide, Terms, and Privacy */}
        <div className="inline-flex items-stretch border border-white/10 bg-[#121211] p-0.5 text-[10px] sm:text-xs font-editorial-meta overflow-x-auto max-w-full">
          <button
            type="button"
            id="tab-guide-btn"
            onClick={() => handleSwitchTab('guide')}
            className={`px-2.5 sm:px-3 py-1.5 transition-all min-h-[34px] sm:min-h-[30px] flex items-center whitespace-nowrap ${
              isGuide
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'text-[#9C9C96] hover:text-white'
            }`}
          >
            <BookOpen size={12} className="mr-1.5 shrink-0" />
            DIRECTOR&apos;S GUIDE
          </button>
          <button
            type="button"
            id="tab-terms-btn"
            onClick={() => handleSwitchTab('terms')}
            className={`px-2.5 sm:px-3 py-1.5 transition-all min-h-[34px] sm:min-h-[30px] flex items-center whitespace-nowrap ${
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
            className={`px-2.5 sm:px-3 py-1.5 transition-all min-h-[34px] sm:min-h-[30px] flex items-center whitespace-nowrap ${
              isPrivacy
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
            {isGuide ? <BookOpen size={14} /> : isTerms ? <FileText size={14} /> : <Shield size={14} />}
          </div>
          <span className="font-editorial-meta text-[10px] sm:text-[11px] text-[#9C9C96]">
            {isGuide
              ? 'STORYFRAME PRODUCTION & DIRECTORY GUIDE'
              : 'STORYFRAME LEGAL DOCUMENTATION'}
          </span>
        </div>

        <h1
          className="font-normal text-white font-display tracking-tight"
          style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)' }}
        >
          {isGuide
            ? 'Director’s Guide & Verified Free Tools'
            : isTerms
            ? 'Terms & Conditions'
            : 'Privacy Policy'}
        </h1>

        <div className="flex flex-wrap items-center gap-2 font-editorial-meta text-[9px] sm:text-[10px] text-[#7D7D76]">
          <span>EFFECTIVE DATE: SEPTEMBER 2026</span>
          <span>•</span>
          <span>VERSION 3.0</span>
          <span>•</span>
          <span>
            {isGuide ? 'DIRECTORIAL PRODUCTION STANDARDS' : 'STANDARD OPERATING POLICY'}
          </span>
        </div>
      </div>

      {/* Key Highlights Summary Box with Corner Brackets */}
      <div className="bg-[#121211] border border-white/10 p-4 sm:p-6 space-y-3 corner-bracket-container shadow-xl">
        <span className="font-editorial-meta text-[11px] text-white font-semibold block">
          KEY HIGHLIGHTS &amp; SUMMARY
        </span>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-[#D4D4D0] font-narrative leading-relaxed">
          {isGuide ? (
            <>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>Zero-cost workflow from script to visual generation and speech.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>Micro-beat breakdown keeps narration synchronized to video cuts.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>Character consistency anchors prevent facial drift across scenes.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>Verified directory of zero-paywall image, video, and audio AI tools.</span>
              </li>
            </>
          ) : isTerms ? (
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

      {/* Main Full Content Container */}
      <div className="bg-[#121211] border border-white/10 p-4 sm:p-6 md:p-8 space-y-6 text-[#D4D4D0] text-sm leading-relaxed font-narrative">
        {isGuide ? (
          <>
            {/* Guide Sub-navigation switcher - Clean 4-column responsive grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-[#181816] border border-white/10 rounded-[2px] font-editorial-meta text-[10px] sm:text-xs">
              <button
                type="button"
                onClick={() => setGuideSubSection('workflow')}
                className={`py-2 px-2 transition-colors rounded-[1px] flex items-center justify-center gap-1.5 ${
                  guideSubSection === 'workflow'
                    ? 'bg-white text-black font-semibold'
                    : 'text-[#9C9C96] hover:text-white'
                }`}
              >
                <Zap size={11} className="shrink-0" />
                <span className="truncate">WORKFLOW</span>
              </button>
              <button
                type="button"
                onClick={() => setGuideSubSection('image-tools')}
                className={`py-2 px-2 transition-colors rounded-[1px] flex items-center justify-center gap-1.5 ${
                  guideSubSection === 'image-tools'
                    ? 'bg-white text-black font-semibold'
                    : 'text-[#9C9C96] hover:text-white'
                }`}
              >
                <ImageIcon size={11} className="shrink-0" />
                <span className="truncate">FREE IMAGE AI</span>
              </button>
              <button
                type="button"
                onClick={() => setGuideSubSection('video-tools')}
                className={`py-2 px-2 transition-colors rounded-[1px] flex items-center justify-center gap-1.5 ${
                  guideSubSection === 'video-tools'
                    ? 'bg-white text-black font-semibold'
                    : 'text-[#9C9C96] hover:text-white'
                }`}
              >
                <Clapperboard size={11} className="shrink-0" />
                <span className="truncate">FREE VIDEO AI</span>
              </button>
              <button
                type="button"
                onClick={() => setGuideSubSection('tts-tools')}
                className={`py-2 px-2 transition-colors rounded-[1px] flex items-center justify-center gap-1.5 ${
                  guideSubSection === 'tts-tools'
                    ? 'bg-white text-black font-semibold'
                    : 'text-[#9C9C96] hover:text-white'
                }`}
              >
                <Volume2 size={11} className="shrink-0" />
                <span className="truncate">FREE VOICE &amp; TTS</span>
              </button>
            </div>

            {/* Sub-section Contents */}
            {guideSubSection === 'workflow' && (
              <div className="space-y-5">
                <section className="space-y-1.5">
                  <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                    System Purpose &amp; Directorial Workflow
                  </h2>
                  <p className="text-xs sm:text-sm text-[#D4D4D0] leading-relaxed">
                    StoryFrame automates pre-production by breaking story drafts into scene-by-scene camera setups, timed narrator lines, and persistent character style anchors.
                  </p>
                </section>

                <div className="border-t border-white/10" />

                <section className="space-y-3">
                  <h3 className="text-xs sm:text-sm font-semibold font-editorial-meta text-[#9C9C96] uppercase tracking-wider">
                    4-Step Zero-Cost Production Cycle
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 bg-[#161614] border border-white/10 space-y-1 rounded-[2px]">
                      <span className="font-editorial-meta text-[10px] text-amber-400 font-semibold block">
                        STEP 01 • INPUT STORY &amp; FORMAT
                      </span>
                      <p className="text-xs text-[#B0B0A8] leading-relaxed">
                        Paste your story draft, select format (9:16 or 16:9), target platform, and character style.
                      </p>
                    </div>

                    <div className="p-3.5 bg-[#161614] border border-white/10 space-y-1 rounded-[2px]">
                      <span className="font-editorial-meta text-[10px] text-amber-400 font-semibold block">
                        STEP 02 • RUNTIME BREAKDOWN
                      </span>
                      <p className="text-xs text-[#B0B0A8] leading-relaxed">
                        Gemini analyzes pacing, locks character visual anchors, and generates synchronized shot prompts.
                      </p>
                    </div>

                    <div className="p-3.5 bg-[#161614] border border-white/10 space-y-1 rounded-[2px]">
                      <span className="font-editorial-meta text-[10px] text-amber-400 font-semibold block">
                        STEP 03 • GENERATE MEDIA FREE
                      </span>
                      <p className="text-xs text-[#B0B0A8] leading-relaxed">
                        Copy prompts into Imagen 3, Bing DALL-E 3, Vibes AI, Kling AI, or Kokoro TTS without subscriptions.
                      </p>
                    </div>

                    <div className="p-3.5 bg-[#161614] border border-white/10 space-y-1 rounded-[2px]">
                      <span className="font-editorial-meta text-[10px] text-amber-400 font-semibold block">
                        STEP 04 • EDIT &amp; ASSEMBLE
                      </span>
                      <p className="text-xs text-[#B0B0A8] leading-relaxed">
                        Export the shot list CSV and narrator script to assemble video cuts directly in CapCut or Premiere.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {guideSubSection === 'image-tools' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                    Verified Free Image Generation Engines
                  </h2>
                  <p className="text-xs text-[#9C9C96]">
                    Zero-cost image generators to process your StoryFrame prompts.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {FREE_IMAGE_TOOLS.map((tool) => (
                    <div
                      key={tool.name}
                      className="p-3.5 bg-[#161614] border border-white/10 hover:border-white/20 transition-all space-y-2 rounded-[2px]"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-1.5">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs sm:text-sm font-semibold text-white font-display truncate">
                            {tool.name}
                          </h3>
                          <span className="stamp-chip text-[8px] bg-[#1F1F1D] text-[#D4D4D0] border-white/10 mt-0.5 inline-block">
                            {tool.pricingTag}
                          </span>
                        </div>
                        <a
                          href={tool.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-[#9C9C96] hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-colors shrink-0"
                          title={`Open ${tool.name}`}
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>

                      <p className="text-xs text-[#B0B0A8] leading-relaxed font-narrative">
                        {tool.description}
                      </p>

                      <div className="pt-0.5 text-[10px] text-[#8C8C86] font-editorial-meta">
                        <span className="text-[#A8A8A2] font-medium">BEST FOR: </span>
                        {tool.bestFor}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {guideSubSection === 'video-tools' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                    Verified Free Video AI Platforms
                  </h2>
                  <p className="text-xs text-[#9C9C96]">
                    Free AI video engines for text-to-video and image-to-video motion.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {FREE_VIDEO_TOOLS.map((tool) => (
                    <div
                      key={tool.name}
                      className="p-3.5 bg-[#161614] border border-white/10 hover:border-white/20 transition-all space-y-2 rounded-[2px]"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-1.5">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs sm:text-sm font-semibold text-white font-display truncate">
                            {tool.name}
                          </h3>
                          <span className="stamp-chip text-[8px] bg-[#1F1F1D] text-[#D4D4D0] border-white/10 mt-0.5 inline-block">
                            {tool.pricingTag}
                          </span>
                        </div>
                        <a
                          href={tool.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-[#9C9C96] hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-colors shrink-0"
                          title={`Open ${tool.name}`}
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>

                      <p className="text-xs text-[#B0B0A8] leading-relaxed font-narrative">
                        {tool.description}
                      </p>

                      <div className="pt-0.5 text-[10px] text-[#8C8C86] font-editorial-meta">
                        <span className="text-[#A8A8A2] font-medium">BEST FOR: </span>
                        {tool.bestFor}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {guideSubSection === 'tts-tools' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                    Verified Free Voice &amp; Text-to-Speech (TTS) Tools
                  </h2>
                  <p className="text-xs text-[#9C9C96]">
                    Generate natural voiceovers and dialogue audio with zero cost.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {FREE_TTS_TOOLS.map((tool) => (
                    <div
                      key={tool.name}
                      className="p-3.5 bg-[#161614] border border-white/10 hover:border-white/20 transition-all space-y-2 rounded-[2px]"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-1.5">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs sm:text-sm font-semibold text-white font-display truncate">
                            {tool.name}
                          </h3>
                          <span className="stamp-chip text-[8px] bg-[#1F1F1D] text-[#D4D4D0] border-white/10 mt-0.5 inline-block">
                            {tool.pricingTag}
                          </span>
                        </div>
                        <a
                          href={tool.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-[#9C9C96] hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-colors shrink-0"
                          title={`Open ${tool.name}`}
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>

                      <p className="text-xs text-[#B0B0A8] leading-relaxed font-narrative">
                        {tool.description}
                      </p>

                      <div className="pt-0.5 text-[10px] text-[#8C8C86] font-editorial-meta">
                        <span className="text-[#A8A8A2] font-medium">BEST FOR: </span>
                        {tool.bestFor}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : isTerms ? (
          <>
            <section className="space-y-2">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                1. Acceptance of Terms
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                By accessing or using StoryFrame, you agree to comply with and be bound by these Terms and Conditions. If you do not agree to these terms, you must discontinue use of the application immediately.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                2. Scope of Service
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                StoryFrame provides automated narrative breakdown tools, visual beat prompt generation, and narrator script timing calculators. You are solely responsible for any story inputs or media generated through your use of the tool.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                3. Intellectual Property and Content Ownership
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                You retain all right, title, and interest in original story concepts provided to the platform. StoryFrame asserts no IP ownership over generated scripts or visual beats created from your inputs.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                4. API Usage &amp; Service Limits
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                StoryFrame connects directly to Google Gemini API endpoints. Usage is subject to rate limits and quotas established by Google Cloud.
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
                StoryFrame operates with a zero-storage, fully client-side privacy model. Generation requests are dispatched straight from your browser to Google Gemini API endpoints. We do not store your story manuscripts.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                2. Third-Party AI Processing
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                Story breakdowns and scene prompts are synthesized via Google Gemini API models in accordance with Google Cloud enterprise privacy standards.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                3. Key Isolation &amp; Session Storage
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                API keys remain isolated inside your browser memory or optional session storage. They are never sent to or stored on any external proxy server.
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

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isGuide ? (
            <button
              type="button"
              onClick={() => handleSwitchTab('terms')}
              className="w-full sm:w-auto px-4 py-2.5 text-[#9C9C96] hover:text-white bg-[#181816] hover:bg-[#242422] border border-white/10 text-xs font-editorial-meta transition-colors min-h-[44px] flex items-center justify-center space-x-1.5"
            >
              <span>READ TERMS OF SERVICE</span>
              <ArrowRight size={13} />
            </button>
          ) : isTerms ? (
            <button
              type="button"
              onClick={() => handleSwitchTab('privacy')}
              className="w-full sm:w-auto px-4 py-2.5 text-[#9C9C96] hover:text-white bg-[#181816] hover:bg-[#242422] border border-white/10 text-xs font-editorial-meta transition-colors min-h-[44px] flex items-center justify-center space-x-1.5"
            >
              <span>READ PRIVACY POLICY</span>
              <ArrowRight size={13} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSwitchTab('guide')}
              className="w-full sm:w-auto px-4 py-2.5 text-[#9C9C96] hover:text-white bg-[#181816] hover:bg-[#242422] border border-white/10 text-xs font-editorial-meta transition-colors min-h-[44px] flex items-center justify-center space-x-1.5"
            >
              <span>READ DIRECTOR’S GUIDE</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
