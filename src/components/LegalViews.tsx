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
  KeyRound,
  Lock,
  ShieldAlert,
  Trash2,
  Check,
  Layers,
  Clock,
  Film,
  Sparkles,
  ShieldCheck,
  Scale,
  HelpCircle,
} from 'lucide-react';
import { ActivePage } from '../types';
import { FREE_IMAGE_TOOLS, FREE_VIDEO_TOOLS, FREE_TTS_TOOLS } from '../data/toolsData';
import { useApiKey } from '../context/ApiKeyContext';

interface LegalViewProps {
  page: 'terms' | 'privacy' | 'guide' | 'byok-security';
  onBack: () => void;
  onNavigate?: (page: ActivePage) => void;
}

type GuideSubSection = 'workflow' | 'pipeline' | 'image-tools' | 'video-tools' | 'tts-tools' | 'faq';

export default function LegalView({ page, onBack, onNavigate }: LegalViewProps) {
  const [guideSubSection, setGuideSubSection] = useState<GuideSubSection>('workflow');
  const { apiKey, hasCustomKey, rememberInSession, setCustomApiKey, clearCustomApiKey } = useApiKey();

  // Local key form inside security page
  const [keyDraft, setKeyDraft] = useState(apiKey);
  const [rememberDraft, setRememberDraft] = useState(rememberInSession);
  const [keyActionNotice, setKeyActionNotice] = useState<string | null>(null);

  const isTerms = page === 'terms';
  const isPrivacy = page === 'privacy';
  const isGuide = page === 'guide';
  const isSecurity = page === 'byok-security';

  const currentDomain = typeof window !== 'undefined' ? window.location.origin : 'this domain';

  const handleSwitchTab = (newPage: ActivePage) => {
    if (onNavigate) {
      onNavigate(newPage);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveKey = () => {
    if (!keyDraft.trim()) {
      setKeyActionNotice('Please provide a valid Gemini API key.');
      setTimeout(() => setKeyActionNotice(null), 3000);
      return;
    }
    setCustomApiKey(keyDraft.trim(), rememberDraft);
    setKeyActionNotice('Gemini API key applied successfully for this browser session!');
    setTimeout(() => setKeyActionNotice(null), 4000);
  };

  const handleClearCurrentKey = () => {
    clearCustomApiKey();
    setKeyDraft('');
    setRememberDraft(false);
    setKeyActionNotice('API key cleared from local browser memory.');
    setTimeout(() => setKeyActionNotice(null), 3000);
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

        {/* Tab switcher between Security, Guide, Terms, and Privacy */}
        <div className="inline-flex items-stretch border border-white/10 bg-[#121211] p-0.5 text-[10px] sm:text-xs font-editorial-meta overflow-x-auto max-w-full">
          <button
            type="button"
            id="tab-security-btn"
            onClick={() => handleSwitchTab('byok-security')}
            className={`px-2.5 sm:px-3 py-1.5 transition-all min-h-[34px] sm:min-h-[30px] flex items-center whitespace-nowrap ${
              isSecurity
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'text-[#9C9C96] hover:text-white'
            }`}
          >
            <KeyRound size={12} className="mr-1.5 shrink-0" />
            BYOK SECURITY
          </button>
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
            DIRECTOR&apos;S GUIDE &amp; HELP
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
            TERMS &amp; CONDITIONS
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
            {isSecurity ? (
              <KeyRound size={14} className="text-amber-400" />
            ) : isGuide ? (
              <BookOpen size={14} />
            ) : isTerms ? (
              <Scale size={14} />
            ) : (
              <ShieldCheck size={14} />
            )}
          </div>
          <span className="font-editorial-meta text-[10px] sm:text-[11px] text-[#9C9C96] tracking-wider">
            {isSecurity
              ? 'DIRECT BROWSER EXECUTION & CLIENT-SIDE KEY ARCHITECTURE'
              : isGuide
              ? 'DIRECTOR’S PRODUCTION WORKFLOW & VERIFIED TOOL DIRECTORY'
              : isTerms
              ? 'STORYFRAME MASTER TERMS OF SERVICE & COMMERCIAL RIGHTS'
              : 'STORYFRAME GLOBAL CLIENT-SIDE PRIVACY POLICY'}
          </span>
        </div>

        <h1
          className="font-normal text-white font-display tracking-tight"
          style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)' }}
        >
          {isSecurity
            ? 'Direct Browser Execution & BYOK Consent'
            : isGuide
            ? 'Director’s Guide & Production Manual'
            : isTerms
            ? 'Terms & Conditions of Service'
            : 'Privacy & Data Protection Policy'}
        </h1>

        <div className="flex flex-wrap items-center gap-2 font-editorial-meta text-[9px] sm:text-[10px] text-[#7D7D76]">
          <span>EFFECTIVE DATE: SEPTEMBER 2026</span>
          <span>•</span>
          <span className="text-white font-semibold">VERSION 3.5 (PRODUCTION BUILD)</span>
          <span>•</span>
          <span>
            {isSecurity
              ? 'ZERO-STORAGE CLIENT ARCHITECTURE'
              : isGuide
              ? 'DIRECTORIAL PRODUCTION SPECIFICATIONS'
              : isTerms
              ? 'STANDARD COMMERCIAL CREATOR TERMS'
              : 'STRICT CLIENT-ISOLATED PRIVACY STANDARDS'}
          </span>
        </div>
      </div>

      {/* Key Highlights Summary Box with Corner Brackets */}
      <div className="bg-[#121211] border border-white/10 p-4 sm:p-6 space-y-3 corner-bracket-container shadow-xl">
        <span className="font-editorial-meta text-[11px] text-white font-semibold block tracking-wider">
          KEY HIGHLIGHTS &amp; OPERATIONAL SUMMARY
        </span>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-[#D4D4D0] font-narrative leading-relaxed">
          {isSecurity ? (
            <>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-amber-400 shrink-0 mt-0.5" />
                <span>Zero Server Transmission: Key lives solely inside your local browser memory.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-amber-400 shrink-0 mt-0.5" />
                <span>Direct-to-Google: Requests travel straight from browser to Google endpoints.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-amber-400 shrink-0 mt-0.5" />
                <span>Zero Storage Backend: We operate no database, server logs, or proxy relay.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-amber-400 shrink-0 mt-0.5" />
                <span>Direct Quota Control: Rate limits and cloud tiers apply strictly to your own key.</span>
              </li>
            </>
          ) : isGuide ? (
            <>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>End-to-End Directorial Pipeline: From raw script to frame cuts and voiceover audio.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>Character Blueprint Anchors: Prevents facial and wardrobe morphing across scenes.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>Micro-Beat Breakdown: Synchronizes voiceover pacing (130-150 WPM) to visual cuts.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>Verified Zero-Cost Directory: Curated free-tier Image, Video, and TTS tools.</span>
              </li>
            </>
          ) : isTerms ? (
            <>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>100% User Ownership: You retain full copyright over story concepts and prompts.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>Royalty-Free Commercial Rights: Clear for YouTube, TikTok, film, and client work.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>Direct Client BYOK: No markups, hidden subscriptions, or platform token fees.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>Responsible AI Use: Adherence to Google Generative AI Prohibited Use Policies.</span>
              </li>
            </>
          ) : (
            <>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>Zero Server Storage: Manuscripts and prompt breakdowns are never saved on our servers.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>Ephemeral Key Isolation: API keys remain isolated in browser memory or local storage.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>Zero Third-Party Trackers: No advertising cookies, tracking pixels, or telemetry.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 size={13} className="text-white shrink-0 mt-0.5" />
                <span>Full Client Autonomy: Complete one-click local cache deletion and key revocation.</span>
              </li>
            </>
          )}
        </ul>
      </div>

      {/* Main Full Content Container */}
      <div className="bg-[#121211] border border-white/10 p-4 sm:p-6 md:p-8 space-y-6 text-[#D4D4D0] text-sm leading-relaxed font-narrative">
        {isSecurity ? (
          <>
            {/* Interactive Key Management Form Block */}
            <div className="p-4 sm:p-6 bg-[#161615] border border-white/10 corner-bracket-container space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-editorial-meta text-[11px] text-white font-semibold flex items-center gap-1.5">
                  <KeyRound size={13} className="text-amber-400" />
                  CURRENT KEY CONFIGURATION &amp; STATUS
                </span>
                {hasCustomKey && (
                  <span className="stamp-chip text-[9px] bg-emerald-950/40 text-emerald-400 border-emerald-500/30">
                    ACTIVE IN SESSION
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="byok-key-input" className="block text-xs text-[#9C9C96]">
                  Google Gemini API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    id="byok-key-input"
                    value={keyDraft}
                    onChange={(e) => setKeyDraft(e.target.value)}
                    placeholder="AIzaSy..."
                    className="flex-1 px-3 py-2.5 bg-[#0D0D0C] border border-white/15 text-white font-mono text-xs focus:outline-none focus:border-amber-400/80 rounded-[2px]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="flex items-center space-x-2 text-xs text-[#9C9C96] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberDraft}
                    onChange={(e) => setRememberDraft(e.target.checked)}
                    className="rounded-[2px] border-white/20 bg-[#121211] text-amber-400 focus:ring-0 focus:ring-offset-0"
                  />
                  <span>Persist in sessionStorage across tab refreshes</span>
                </label>

                <div className="flex items-center gap-2">
                  {hasCustomKey && (
                    <button
                      type="button"
                      onClick={handleClearCurrentKey}
                      className="px-3 py-2 text-red-400 hover:text-red-300 font-editorial-meta text-[10.5px] tracking-wider transition-colors inline-flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                      <span>REMOVE KEY</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    className="px-4 py-2 bg-white text-black font-semibold hover:bg-neutral-200 font-editorial-meta text-[11px] tracking-wider transition-colors rounded-[2px] inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <Check size={13} />
                    <span>APPLY KEY &amp; CONSENT</span>
                  </button>
                </div>
              </div>

              {keyActionNotice && (
                <p className="text-xs text-emerald-400 font-editorial-meta tracking-wider pt-1 animate-in fade-in duration-200">
                  ✓ {keyActionNotice}
                </p>
              )}
            </div>

            {/* Architecture Explanations */}
            <section className="space-y-3 pt-2">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide flex items-center gap-2">
                <Lock size={15} className="text-amber-400" />
                1. Direct Client-Side Execution Architecture
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                StoryFrame operates under a strict <strong>Bring Your Own Key (BYOK)</strong> client-side paradigm. When you trigger a generation breakdown, the request payload is constructed and dispatched directly from your browser&apos;s network layer to Google&apos;s official endpoint:
              </p>
              <div className="p-3 bg-[#181816] border border-white/10 font-mono text-xs text-amber-300/90 rounded-[2px]">
                https://generativelanguage.googleapis.com/v1beta/models/...
              </div>
              <p className="text-[#9C9C96] text-xs leading-relaxed">
                At no point does your API key, story manuscript, character descriptors, or generated prompt sheets pass through any intermediate proxy server, database, or cloud relay maintained by StoryFrame.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-3">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide flex items-center gap-2">
                <Zap size={15} className="text-amber-400" />
                2. Key Storage &amp; Lifecycle Controls
              </h2>
              <ul className="space-y-2 text-xs text-[#D4D4D0]">
                <li className="flex items-start space-x-2">
                  <span className="text-white font-mono">•</span>
                  <span><strong>Volatile Browser Memory:</strong> If you leave &ldquo;Persist in sessionStorage&rdquo; unchecked, the key exists only in active JavaScript state and vanishes immediately when the tab is closed.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-white font-mono">•</span>
                  <span><strong>Local Session Isolation:</strong> If opted in, the key is saved in standard browser <code className="text-white bg-white/10 px-1 py-0.5">sessionStorage</code>. It is restricted strictly to the current origin domain and cannot be accessed by other tabs or domains.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-white font-mono">•</span>
                  <span><strong>Instant Revocation:</strong> Clicking &ldquo;Remove Key&rdquo; immediately purges all key traces from active memory and storage.</span>
                </li>
              </ul>
            </section>

            <div className="border-t border-white/10" />

            {/* Recommended Restrictions in Google Cloud */}
            <section className="p-4 sm:p-5 bg-amber-950/20 border border-amber-500/30 rounded-[2px] space-y-3">
              <div className="flex items-center gap-2 text-amber-300 font-medium">
                <ShieldAlert size={16} className="shrink-0" />
                <span className="font-editorial-meta text-[11px] tracking-wider uppercase">
                  Security Best Practice: Restricting Your Key in Google Cloud
                </span>
              </div>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                To guarantee absolute peace of mind when using client-side API keys, Google Cloud lets you lock down your key so it can only be used on this specific website:
              </p>
              <div className="space-y-2 text-xs text-[#D4D4D0]">
                <div className="p-2.5 bg-black/60 border border-amber-500/20 space-y-1">
                  <span className="text-amber-300 font-editorial-meta text-[10px] block">1. API RESTRICTIONS</span>
                  <span>Restrict the key solely to: <code className="text-white font-mono">Generative Language API</code></span>
                </div>
                <div className="p-2.5 bg-black/60 border border-amber-500/20 space-y-1">
                  <span className="text-amber-300 font-editorial-meta text-[10px] block">2. APPLICATION RESTRICTIONS (HTTP REFERRERS)</span>
                  <span>Add this exact website referrer pattern:</span>
                  <code className="block text-white font-mono text-[11px] bg-black/80 px-2 py-1 border border-white/10 break-all">
                    {currentDomain}/*
                  </code>
                </div>
              </div>
              <div className="pt-1">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-amber-400 hover:text-amber-300 underline font-editorial-meta text-[11px] tracking-wider"
                >
                  <span>OPEN GOOGLE AI STUDIO KEY MANAGEMENT</span>
                  <ExternalLink size={11} className="ml-1.5 shrink-0" />
                </a>
              </div>
            </section>
          </>
        ) : isGuide ? (
          <>
            {/* Guide Sub-navigation switcher */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 p-1 bg-[#181816] border border-white/10 rounded-[2px] font-editorial-meta text-[10px]">
              <button
                type="button"
                onClick={() => setGuideSubSection('workflow')}
                className={`py-2 px-1.5 transition-colors rounded-[1px] flex items-center justify-center gap-1 ${
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
                onClick={() => setGuideSubSection('pipeline')}
                className={`py-2 px-1.5 transition-colors rounded-[1px] flex items-center justify-center gap-1 ${
                  guideSubSection === 'pipeline'
                    ? 'bg-white text-black font-semibold'
                    : 'text-[#9C9C96] hover:text-white'
                }`}
              >
                <Film size={11} className="shrink-0" />
                <span className="truncate">PIPELINE</span>
              </button>
              <button
                type="button"
                onClick={() => setGuideSubSection('image-tools')}
                className={`py-2 px-1.5 transition-colors rounded-[1px] flex items-center justify-center gap-1 ${
                  guideSubSection === 'image-tools'
                    ? 'bg-white text-black font-semibold'
                    : 'text-[#9C9C96] hover:text-white'
                }`}
              >
                <ImageIcon size={11} className="shrink-0" />
                <span className="truncate">IMAGE AI</span>
              </button>
              <button
                type="button"
                onClick={() => setGuideSubSection('video-tools')}
                className={`py-2 px-1.5 transition-colors rounded-[1px] flex items-center justify-center gap-1 ${
                  guideSubSection === 'video-tools'
                    ? 'bg-white text-black font-semibold'
                    : 'text-[#9C9C96] hover:text-white'
                }`}
              >
                <Clapperboard size={11} className="shrink-0" />
                <span className="truncate">VIDEO AI</span>
              </button>
              <button
                type="button"
                onClick={() => setGuideSubSection('tts-tools')}
                className={`py-2 px-1.5 transition-colors rounded-[1px] flex items-center justify-center gap-1 ${
                  guideSubSection === 'tts-tools'
                    ? 'bg-white text-black font-semibold'
                    : 'text-[#9C9C96] hover:text-white'
                }`}
              >
                <Volume2 size={11} className="shrink-0" />
                <span className="truncate">TTS AUDIO</span>
              </button>
              <button
                type="button"
                onClick={() => setGuideSubSection('faq')}
                className={`py-2 px-1.5 transition-colors rounded-[1px] flex items-center justify-center gap-1 ${
                  guideSubSection === 'faq'
                    ? 'bg-white text-black font-semibold'
                    : 'text-[#9C9C96] hover:text-white'
                }`}
              >
                <HelpCircle size={11} className="shrink-0" />
                <span className="truncate">FAQ &amp; TIPS</span>
              </button>
            </div>

            {/* Sub-section 1: The Production Workflow */}
            {guideSubSection === 'workflow' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-white text-black font-bold font-mono text-[10px] flex items-center justify-center shrink-0">1</span>
                    <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                      Narrative Architecture &amp; Custom Beat Markup
                    </h2>
                  </div>
                  <p className="text-[#D4D4D0] leading-relaxed">
                    Paste your screenplay outline, YouTube documentary script, or creative synopsis. For surgical director-level control over shot cuts, insert inline beat markers like <code className="text-white font-mono bg-white/10 px-1 py-0.5 text-xs">(beat 1)</code>, <code className="text-white font-mono bg-white/10 px-1 py-0.5 text-xs">(beat 2)</code> directly inside your narrative paragraphs. StoryFrame will honor these exact cut points, generating distinct visual frames synchronized to each beat.
                  </p>
                </div>

                <div className="border-t border-white/10" />

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-white text-black font-bold font-mono text-[10px] flex items-center justify-center shrink-0">2</span>
                    <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                      Aspect Ratio &amp; Target Format Selection
                    </h2>
                  </div>
                  <p className="text-[#D4D4D0] leading-relaxed">
                    Select <strong>Short-form (9:16 Vertical)</strong> for TikTok, Instagram Reels, and YouTube Shorts to ensure compositions keep critical character actions in the center safe-zone. Choose <strong>Long-form (16:9 Cinematic)</strong> for YouTube video essays, documentaries, and widescreen narrative film. Set your scene count target (Auto, 4, 6, 8, 10, or 12 scenes).
                  </p>
                </div>

                <div className="border-t border-white/10" />

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-white text-black font-bold font-mono text-center justify-center shrink-0">3</span>
                    <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                      AI Model Tier: Gemini 2.5 Flash vs. Pro
                    </h2>
                  </div>
                  <p className="text-[#D4D4D0] leading-relaxed">
                    <strong>Gemini 2.5 Flash</strong> provides sub-second generation speeds ideal for fast ideation and rapid storyboard passes. <strong>Gemini 2.5 Pro</strong> delivers enhanced cinematic nuance, complex multi-character spatial blocking, subtle emotional acting cues, and mathematically synchronized voiceover cadence calculations.
                  </p>
                </div>

                <div className="border-t border-white/10" />

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-white text-black font-bold font-mono text-[10px] flex items-center justify-center shrink-0">4</span>
                    <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                      Character Anchors &amp; Aesthetic Continuity
                    </h2>
                  </div>
                  <p className="text-[#D4D4D0] leading-relaxed">
                    StoryFrame automatically synthesizes a master <strong>Character Sheet</strong> containing immutable facial geometry, hairstyle, wardrobe textures, and lighting anchors. Each subsequent prompt explicitly injects these anchors so downstream image and video models preserve character recognition without facial drift.
                  </p>
                </div>

                <div className="border-t border-white/10" />

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-white text-black font-bold font-mono text-[10px] flex items-center justify-center shrink-0">5</span>
                    <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide">
                      Export, Copy &amp; Post-Production Assembly
                    </h2>
                  </div>
                  <p className="text-[#D4D4D0] leading-relaxed">
                    Use 1-click prompt copying to feed tools like Midjourney, Flux, Kling, and Luma. Click <strong>EXPORT CSV</strong> to generate a ready-to-import EDL/shot-list for CapCut, DaVinci Resolve, or Premiere Pro, keeping your voiceover timing and cut durations locked in perfect sync.
                  </p>
                </div>
              </div>
            )}

            {/* Sub-section 2: Production Pipeline */}
            {guideSubSection === 'pipeline' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="p-4 bg-[#181816] border border-white/10 rounded-[2px] space-y-2">
                  <span className="font-editorial-meta text-[11px] text-white font-semibold block">
                    RECOMMENDED 4-STAGE PRODUCTION PIPELINE
                  </span>
                  <p className="text-xs text-[#9C9C96] leading-relaxed">
                    Follow this professional workflow used by leading AI filmmakers to produce studio-grade cinematic content with zero software subscription overhead.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-4 bg-[#141412] border border-white/10 rounded-[2px] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-display font-medium text-white text-sm">Phase 1: Story Framing</span>
                      <span className="stamp-chip text-[8px] bg-white/10 text-white border-white/20">STORYFRAME</span>
                    </div>
                    <p className="text-xs text-[#B0B0A8] leading-relaxed">
                      Generate the Roman-numeral scene taxonomy, camera taxonomy (lens focal length, angles, movement vectors), and calibrate narration script word count.
                    </p>
                  </div>

                  <div className="p-4 bg-[#141412] border border-white/10 rounded-[2px] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-display font-medium text-white text-sm">Phase 2: Visual Plates</span>
                      <span className="stamp-chip text-[8px] bg-sky-950/40 text-sky-300 border-sky-800/30">FLUX / MIDJOURNEY</span>
                    </div>
                    <p className="text-xs text-[#B0B0A8] leading-relaxed">
                      Paste each scene&apos;s visual prompt into Flux or Midjourney. Lock seed numbers or character reference images to maintain strict aesthetic consistency across shots.
                    </p>
                  </div>

                  <div className="p-4 bg-[#141412] border border-white/10 rounded-[2px] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-display font-medium text-white text-sm">Phase 3: Motion Synthesis</span>
                      <span className="stamp-chip text-[8px] bg-amber-950/40 text-amber-300 border-amber-800/30">KLING / LUMA</span>
                    </div>
                    <p className="text-xs text-[#B0B0A8] leading-relaxed">
                      Upload your still image plate as the starting frame in Kling, Luma Dream Machine, or Runway Gen-3. Paste StoryFrame&apos;s camera motion prompt (e.g., <em>slow dolly forward, subtle hair movement</em>).
                    </p>
                  </div>

                  <div className="p-4 bg-[#141412] border border-white/10 rounded-[2px] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-display font-medium text-white text-sm">Phase 4: Audio &amp; Timeline</span>
                      <span className="stamp-chip text-[8px] bg-emerald-950/40 text-emerald-300 border-emerald-800/30">KOKORO / CAPCUT</span>
                    </div>
                    <p className="text-xs text-[#B0B0A8] leading-relaxed">
                      Render the narrator script in Kokoro TTS or ElevenLabs. Drop the audio and video clips into CapCut or DaVinci Resolve. The timing calculations match clip lengths seamlessly.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-section 3: Free Image AI Directory */}
            {guideSubSection === 'image-tools' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="font-editorial-meta text-[11px] text-white">
                    VERIFIED ZERO-COST &amp; GENEROUS TIER IMAGE GENERATORS
                  </span>
                  <span className="text-[10px] text-[#9C9C96] font-editorial-meta">
                    {FREE_IMAGE_TOOLS.length} VERIFIED TOOLS
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {FREE_IMAGE_TOOLS.map((tool) => (
                    <div
                      key={tool.name}
                      className="p-3.5 bg-[#181816] border border-white/10 rounded-[2px] space-y-2 flex flex-col justify-between hover:border-white/20 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-display font-medium text-white text-sm">
                            {tool.name}
                          </span>
                          <span className="stamp-chip text-[8px] bg-white/5 text-emerald-400 border-emerald-500/30">
                            {tool.pricingTag}
                          </span>
                        </div>
                        <p className="text-xs text-[#9C9C96] leading-relaxed">
                          {tool.description}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] font-editorial-meta text-[#7D7D76]">
                          BEST FOR: {tool.bestFor.toUpperCase()}
                        </span>
                        <a
                          href={tool.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-[10px] font-editorial-meta text-white hover:underline underline-offset-2"
                        >
                          OPEN <ExternalLink size={10} className="ml-1" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-section 4: Free Video AI Directory */}
            {guideSubSection === 'video-tools' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="font-editorial-meta text-[11px] text-white">
                    VERIFIED ZERO-COST &amp; DAILY TIER VIDEO GENERATORS
                  </span>
                  <span className="text-[10px] text-[#9C9C96] font-editorial-meta">
                    {FREE_VIDEO_TOOLS.length} VERIFIED TOOLS
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {FREE_VIDEO_TOOLS.map((tool) => (
                    <div
                      key={tool.name}
                      className="p-3.5 bg-[#181816] border border-white/10 rounded-[2px] space-y-2 flex flex-col justify-between hover:border-white/20 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-display font-medium text-white text-sm">
                            {tool.name}
                          </span>
                          <span className="stamp-chip text-[8px] bg-white/5 text-emerald-400 border-emerald-500/30">
                            {tool.pricingTag}
                          </span>
                        </div>
                        <p className="text-xs text-[#9C9C96] leading-relaxed">
                          {tool.description}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] font-editorial-meta text-[#7D7D76]">
                          BEST FOR: {tool.bestFor.toUpperCase()}
                        </span>
                        <a
                          href={tool.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-[10px] font-editorial-meta text-white hover:underline underline-offset-2"
                        >
                          OPEN <ExternalLink size={10} className="ml-1" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-section 5: Free TTS AI Directory */}
            {guideSubSection === 'tts-tools' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="font-editorial-meta text-[11px] text-white">
                    VERIFIED ZERO-COST &amp; OPEN-SOURCE TEXT-TO-SPEECH
                  </span>
                  <span className="text-[10px] text-[#9C9C96] font-editorial-meta">
                    {FREE_TTS_TOOLS.length} VERIFIED TOOLS
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {FREE_TTS_TOOLS.map((tool) => (
                    <div
                      key={tool.name}
                      className="p-3.5 bg-[#181816] border border-white/10 rounded-[2px] space-y-2 flex flex-col justify-between hover:border-white/20 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-display font-medium text-white text-sm">
                            {tool.name}
                          </span>
                          <span className="stamp-chip text-[8px] bg-white/5 text-emerald-400 border-emerald-500/30">
                            {tool.pricingTag}
                          </span>
                        </div>
                        <p className="text-xs text-[#9C9C96] leading-relaxed">
                          {tool.description}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] font-editorial-meta text-[#7D7D76]">
                          BEST FOR: {tool.bestFor.toUpperCase()}
                        </span>
                        <a
                          href={tool.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-[10px] font-editorial-meta text-white hover:underline underline-offset-2"
                        >
                          OPEN <ExternalLink size={10} className="ml-1" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-section 6: FAQ & Directorial Pro Tips */}
            {guideSubSection === 'faq' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="p-4 bg-[#161615] border border-white/10 rounded-[2px] space-y-2">
                  <h3 className="font-display text-white text-sm font-medium">How do I prevent characters from changing faces across scene cuts?</h3>
                  <p className="text-xs text-[#A0A098] leading-relaxed">
                    Always include StoryFrame&apos;s master character visual anchors in every prompt. When generating video with Kling, Luma, or Runway, use <strong>Image-to-Video</strong> mode with your rendered hero shot as the starting image plate rather than generating video from raw text.
                  </p>
                </div>

                <div className="p-4 bg-[#161615] border border-white/10 rounded-[2px] space-y-2">
                  <h3 className="font-display text-white text-sm font-medium">Why does my voiceover feel too fast or too slow?</h3>
                  <p className="text-xs text-[#A0A098] leading-relaxed">
                    StoryFrame calibrates narration pacing using an industry-standard 130 to 150 words-per-minute (WPM) baseline for conversational storytelling. If your voiceover pace feels rushed, reduce paragraph length in the scene breakdown or choose longer target clip durations.
                  </p>
                </div>

                <div className="p-4 bg-[#161615] border border-white/10 rounded-[2px] space-y-2">
                  <h3 className="font-display text-white text-sm font-medium">What is Video Suitability Scoring?</h3>
                  <p className="text-xs text-[#A0A098] leading-relaxed">
                    StoryFrame automatically inspects narrative action complexity. Scenes with high physical dynamism (e.g., foot chases, explosions) receive high motion scores; scenes with intimate internal monologues receive low motion scores, signaling that subtle camera drift or parallax zooms are better suited than intense AI motion.
                  </p>
                </div>

                <div className="p-4 bg-[#161615] border border-white/10 rounded-[2px] space-y-2">
                  <h3 className="font-display text-white text-sm font-medium">What happens if I hit Google Gemini API rate limits?</h3>
                  <p className="text-xs text-[#A0A098] leading-relaxed">
                    Free tier Google AI Studio keys have a 15 requests-per-minute (RPM) quota on Flash models. If you encounter a rate limit notice, wait 60 seconds before submitting or enable billing in your Google Cloud console for pay-as-you-go high throughput.
                  </p>
                </div>
              </div>
            )}
          </>
        ) : isTerms ? (
          <>
            <section className="space-y-2.5">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-white">1</span>
                Acceptance of Terms &amp; Eligibility
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                By accessing, browsing, or utilizing the StoryFrame web application (&ldquo;Service&rdquo;), you acknowledge that you have read, understood, and agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms in their entirety, you must immediately discontinue use of the platform. You represent that you are at least 13 years of age (or the legal age of digital consent in your jurisdiction) and possess full legal capacity to enter into these binding terms.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2.5">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-white">2</span>
                User Content Ownership &amp; Intellectual Property
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                You retain complete, exclusive, and unencumbered ownership of all original stories, creative synopses, scripts, characters, and textual inputs submitted to StoryFrame. StoryFrame asserts zero intellectual property ownership, copyright claim, or licensing interest in your narrative inputs or in the resulting prompt breakdowns, shot taxonomy sheets, or narration timings synthesized from your content. You are the sole author and owner of your creative projects.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2.5">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-white">3</span>
                Commercial Production &amp; Royalty-Free Rights
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                All prompt sequences, Roman-numeral scene structures, narrator scripts, and camera directions generated through StoryFrame are 100% royalty-free for commercial use. You are expressly authorized to monetize, broadcast, distribute, publish, and license any media created using these breakdowns across any commercial platform, including YouTube (AdSense and partner programs), TikTok, Instagram, streaming services, television broadcasts, film festivals, and client commercial deliverables.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2.5">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-white">4</span>
                Bring-Your-Own-Key (BYOK) &amp; Third-Party API Terms
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                StoryFrame operates as an open, client-side directorial utility connecting directly to Google&apos;s Generative AI infrastructure via personal user API keys. By supplying a Gemini API key, you acknowledge and agree that:
              </p>
              <ul className="space-y-1.5 pl-4 list-disc text-xs text-[#B0B0A8]">
                <li>All generation requests are dispatched under your personal Google Cloud / AI Studio agreement and quota allocations.</li>
                <li>You are solely responsible for compliance with Google Cloud Terms of Service and the Google Generative AI Prohibited Use Policy.</li>
                <li>StoryFrame charges no subscription markups, commissions, or token fees, and makes no representations regarding Google Cloud API uptime or rate limit thresholds.</li>
              </ul>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2.5">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-white">5</span>
                Acceptable Use Policy &amp; Safety Guardrails
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                You agree not to use StoryFrame to generate, facilitate, or distribute content that violates applicable laws or ethical safety standards, including but not limited to: (a) non-consensual sexually explicit depictions or deepfakes; (b) violent extremism, terroristic propaganda, or harassment; (c) instructions for manufacturing dangerous weapons or illicit narcotics; (d) defamatory or fraudulent misrepresentations; or (e) automated denial-of-service or query flood attacks intended to disrupt platform infrastructure.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2.5">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-white">6</span>
                As-Is Software Warranty &amp; AI Output Disclaimer
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                StoryFrame is provided strictly on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis without warranties of any kind, whether express or implied. While StoryFrame employs advanced cinematic taxonomies, generative artificial intelligence models may occasionally produce unpredictable artistic interpretations, historical hallucinations, or timing variances. You are solely responsible for reviewing and validating all outputs before rendering final productions.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2.5">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-white">7</span>
                Limitation of Liability &amp; Indemnification
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                To the maximum extent permitted by applicable law, StoryFrame, its creators, and contributors shall not be liable for any indirect, incidental, consequential, special, or punitive damages, including loss of profits, data corruption, or business interruption arising from your use of the Service. You agree to defend, indemnify, and hold harmless StoryFrame from any claims or liabilities resulting from your violation of these Terms or misuse of generated content.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2.5">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-white">8</span>
                Amendments &amp; Governing Law
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                We reserve the right to revise these Terms periodically to reflect evolving platform capabilities or regulatory requirements. Continued use of StoryFrame following posted revisions constitutes acceptance. These Terms shall be interpreted under standard international commercial conventions and applicable software licensing laws.
              </p>
            </section>
          </>
        ) : (
          <>
            <section className="space-y-2.5">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-white">1</span>
                Zero-Server-Storage Architecture &amp; Privacy Philosophy
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                StoryFrame was architected with a fundamental privacy commitment: <strong>zero remote server data storage</strong>. Unlike conventional SaaS applications that store scripts, account profiles, and generation logs in central cloud databases, StoryFrame runs entirely within your browser&apos;s client execution sandbox. We do not operate remote databases, proxy interceptors, or analytics harvesting servers.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2.5">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-white">2</span>
                Information We Never Collect or Store
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                To guarantee absolute confidentiality of your creative intellectual property:
              </p>
              <ul className="space-y-1.5 pl-4 list-disc text-xs text-[#B0B0A8]">
                <li><strong>No Creative Manuscripts:</strong> We never log, cache, or store your story synopses, scripts, characters, or prompts on any remote server.</li>
                <li><strong>No Personal Identifiers:</strong> We do not require account registration, usernames, email addresses, phone numbers, or passwords.</li>
                <li><strong>No Financial Data:</strong> We process zero payments, credit cards, or billing info because StoryFrame is completely free with BYOK.</li>
                <li><strong>No Remote Generation History:</strong> Breakdowns exist solely inside your active browser session or local device cache.</li>
              </ul>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2.5">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-white">3</span>
                Client-Side API Key Handling &amp; Session Isolation
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                When you input a Google Gemini API key:
              </p>
              <ul className="space-y-1.5 pl-4 list-disc text-xs text-[#B0B0A8]">
                <li><strong>Volatile Memory Mode:</strong> By default, keys exist only in ephemeral JavaScript variables and are purged the instant the browser tab is closed.</li>
                <li><strong>Optional Session Persistence:</strong> If you explicitly opt in, the key is saved in standard browser <code className="text-white bg-white/10 px-1 py-0.5 font-mono">sessionStorage</code>, which is strictly sandboxed to the current origin domain and tab.</li>
                <li><strong>Immediate Local Revocation:</strong> You can purge your key at any second by clicking &ldquo;Remove Key&rdquo; in the configuration bar.</li>
              </ul>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2.5">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-white">4</span>
                Direct Encrypted HTTPS Communications with Google
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                When a story breakdown is initiated, your browser executes a secure HTTPS POST request directly to Google&apos;s official API endpoint (<code className="text-white font-mono bg-white/10 px-1 py-0.5">generativelanguage.googleapis.com</code>). Communication is encrypted in transit using industry-standard TLS. Your data is handled in strict compliance with Google Cloud&apos;s Enterprise Privacy Policy, which ensures your API prompts are not used to train foundational AI models.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2.5">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-white">5</span>
                Local Browser Storage (LocalStorage History)
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                For creator convenience, recent story generation records are stored locally inside your browser&apos;s <code className="text-white font-mono bg-white/10 px-1 py-0.5">localStorage</code> so you can revisit previous breakdowns across sessions. This data never touches an external server. You can inspect, delete individual entries, or completely wipe the local history cache at any time using the &ldquo;Clear All History&rdquo; action.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2.5">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-white">6</span>
                Zero Cookies, Tracking Pixels &amp; Third-Party Telemetry
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                StoryFrame enforces a strict zero-surveillance standard:
              </p>
              <ul className="space-y-1.5 pl-4 list-disc text-xs text-[#B0B0A8]">
                <li>ZERO third-party advertising cookies or cross-site tracking beacons.</li>
                <li>ZERO social media tracking pixels (no Meta Pixel, no TikTok Pixel).</li>
                <li>ZERO intrusive behavioral heatmaps or fingerprinting telemetry scripts.</li>
              </ul>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2.5">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-white">7</span>
                Global User Rights (GDPR &amp; CCPA / CPRA Compliant by Design)
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                Because StoryFrame does not maintain user accounts or centralized data stores, you enjoy instantaneous, self-service data autonomy. You have the complete right to access, export, or erase all local generation data at will directly through your web browser without filing requests or waiting for manual administrative review.
              </p>
            </section>

            <div className="border-t border-white/10" />

            <section className="space-y-2.5">
              <h2 className="text-sm sm:text-base font-medium font-display text-white tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-white">8</span>
                Children’s Online Privacy Protection (COPPA)
              </h2>
              <p className="text-[#D4D4D0] leading-relaxed">
                StoryFrame is directed at professional content creators, filmmakers, and adult storytellers. We do not knowingly collect personal information from children under 13 years of age (or under 16 in the European Union). If we become aware that personal information of a child has been collected, we will take immediate steps to ensure it is deleted.
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
          {isSecurity ? (
            <button
              type="button"
              onClick={() => handleSwitchTab('guide')}
              className="w-full sm:w-auto px-4 py-2.5 text-[#9C9C96] hover:text-white bg-[#181816] hover:bg-[#242422] border border-white/10 text-xs font-editorial-meta transition-colors min-h-[44px] flex items-center justify-center space-x-1.5"
            >
              <span>EXPLORE DIRECTOR&apos;S GUIDE</span>
              <ArrowRight size={13} />
            </button>
          ) : isGuide ? (
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
              onClick={() => handleSwitchTab('byok-security')}
              className="w-full sm:w-auto px-4 py-2.5 text-[#9C9C96] hover:text-white bg-[#181816] hover:bg-[#242422] border border-white/10 text-xs font-editorial-meta transition-colors min-h-[44px] flex items-center justify-center space-x-1.5"
            >
              <span>VIEW BYOK SECURITY</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
