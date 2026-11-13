import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Shield,
  FileText,
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
  Film,
  ShieldCheck,
  Scale,
  HelpCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { ActivePage, AiProvider } from '../types';
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
  const {
    aiProvider,
    setAiProvider,
    geminiApiKey,
    groqApiKey,
    rememberInSession,
    setCustomApiKey,
    clearCustomApiKey,
  } = useApiKey();

  const [selectedProviderTab, setSelectedProviderTab] = useState<AiProvider>(aiProvider);
  const [keyDraft, setKeyDraft] = useState(aiProvider === 'groq' ? groqApiKey : geminiApiKey);
  const [showKeyText, setShowKeyText] = useState(false);
  const [rememberDraft, setRememberDraft] = useState(rememberInSession);
  const [keyActionNotice, setKeyActionNotice] = useState<string | null>(null);

  useEffect(() => {
    setSelectedProviderTab(aiProvider);
  }, [aiProvider]);

  useEffect(() => {
    setKeyDraft(selectedProviderTab === 'groq' ? groqApiKey : geminiApiKey);
    setRememberDraft(rememberInSession);
  }, [selectedProviderTab, geminiApiKey, groqApiKey, rememberInSession]);

  const isTerms = page === 'terms';
  const isPrivacy = page === 'privacy';
  const isGuide = page === 'guide';
  const isSecurity = page === 'byok-security';

  const currentDomain = typeof window !== 'undefined' ? window.location.origin : 'this domain';
  const hasSelectedProviderKey = Boolean(
    (selectedProviderTab === 'groq' ? groqApiKey : geminiApiKey).trim().length > 0
  );

  const handleSwitchTab = (newPage: ActivePage) => {
    if (onNavigate) {
      onNavigate(newPage);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveKey = () => {
    if (!keyDraft.trim()) {
      setKeyActionNotice(
        selectedProviderTab === 'groq'
          ? 'Please enter a Groq API key before applying.'
          : 'Please enter a Google Gemini API key before applying.'
      );
      setTimeout(() => setKeyActionNotice(null), 3000);
      return;
    }
    setAiProvider(selectedProviderTab);
    setCustomApiKey(keyDraft.trim(), rememberDraft, selectedProviderTab);
    setKeyActionNotice(
      selectedProviderTab === 'groq'
        ? 'Groq API key saved for this browser session.'
        : 'Google Gemini API key saved for this browser session.'
    );
    setTimeout(() => setKeyActionNotice(null), 4000);
  };

  const handleClearCurrentKey = () => {
    clearCustomApiKey(selectedProviderTab);
    setKeyDraft('');
    setShowKeyText(false);
    setKeyActionNotice(
      selectedProviderTab === 'groq'
        ? 'Groq API key removed from local browser memory.'
        : 'Gemini API key removed from local browser memory.'
    );
    setTimeout(() => setKeyActionNotice(null), 3000);
  };

  const pageMeta = isSecurity
    ? {
        icon: <KeyRound size={15} className="text-amber-400" />,
        eyebrow: 'Direct Browser Execution',
        title: 'BYOK Security & API Keys',
        subtitle: 'Manage Google Gemini or Groq Cloud keys safely inside your browser session.',
      }
    : isGuide
      ? {
          icon: <BookOpen size={15} className="text-white" />,
          eyebrow: 'Documentation',
          title: 'Help & Production Guide',
          subtitle: 'Learn beat syntax, Image vs Video workflows, and compatible free external tools.',
        }
      : isTerms
        ? {
            icon: <Scale size={15} className="text-white" />,
            eyebrow: 'Legal & Usage',
            title: 'Terms & Conditions',
            subtitle: 'Clear ownership of generated storyboards and direct BYOK usage terms.',
          }
        : {
            icon: <ShieldCheck size={15} className="text-white" />,
            eyebrow: 'Data & Storage',
            title: 'Privacy Policy',
            subtitle: 'Zero server storage. Keys, scripts, and history stay inside your browser.',
          };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200 font-narrative text-[#F5F5F0]">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
        <button
          type="button"
          id="legal-back-button"
          onClick={onBack}
          className="inline-flex items-center text-xs sm:text-sm text-[#A0A09A] hover:text-white transition-colors py-1 font-display cursor-pointer"
        >
          <ArrowLeft size={14} className="mr-1.5 shrink-0" />
          <span>Back to Story Generator</span>
        </button>

        <span className="font-mono text-xs text-[#8C8C86]">
          StoryFrame v3.7 · Updated November 2026
        </span>
      </div>

      {/* Desktop 2-Column Layout: Sticky Left Sidebar (4/12) + Reading Workspace (8/12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* LEFT NAVIGATION COLUMN */}
        <aside className="lg:col-span-4 lg:sticky lg:top-20 space-y-4">
          <div className="bg-[#121211] border border-white/15 rounded-[3px] p-4 space-y-3">
            <span className="font-editorial-meta text-[10px] text-[#8C8C86] block">
              DOCUMENTATION &amp; POLICIES
            </span>
            <nav className="flex flex-col gap-1 font-display text-sm" aria-label="Documentation sections">
              <button
                type="button"
                id="tab-security-btn"
                onClick={() => handleSwitchTab('byok-security')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[3px] text-left transition-colors cursor-pointer ${
                  isSecurity
                    ? 'bg-white text-black font-semibold'
                    : 'text-[#C4C4BE] hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <KeyRound size={14} className={isSecurity ? 'text-black' : 'text-amber-400'} />
                <span>BYOK Security &amp; API Keys</span>
              </button>

              <button
                type="button"
                id="tab-guide-btn"
                onClick={() => handleSwitchTab('guide')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[3px] text-left transition-colors cursor-pointer ${
                  isGuide
                    ? 'bg-white text-black font-semibold'
                    : 'text-[#C4C4BE] hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <BookOpen size={14} />
                <span>Help &amp; Guide</span>
              </button>

              <button
                type="button"
                id="tab-terms-btn"
                onClick={() => handleSwitchTab('terms')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[3px] text-left transition-colors cursor-pointer ${
                  isTerms
                    ? 'bg-white text-black font-semibold'
                    : 'text-[#C4C4BE] hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <FileText size={14} />
                <span>Terms &amp; Conditions</span>
              </button>

              <button
                type="button"
                id="tab-privacy-btn"
                onClick={() => handleSwitchTab('privacy')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[3px] text-left transition-colors cursor-pointer ${
                  isPrivacy
                    ? 'bg-white text-black font-semibold'
                    : 'text-[#C4C4BE] hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <Shield size={14} />
                <span>Privacy Policy</span>
              </button>
            </nav>
          </div>

          {isGuide && (
            <div className="bg-[#121211] border border-white/15 rounded-[3px] p-4 space-y-2.5">
              <span className="font-editorial-meta text-[10px] text-[#8C8C86] block">
                GUIDE TOPICS
              </span>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-1 font-display text-xs sm:text-sm">
                {(
                  [
                    { id: 'workflow', label: 'Core Workflow', icon: <Zap size={13} /> },
                    { id: 'pipeline', label: 'Production Pipeline', icon: <Film size={13} /> },
                    { id: 'image-tools', label: 'Free Image AI Tools', icon: <ImageIcon size={13} /> },
                    { id: 'video-tools', label: 'Free Video AI Tools', icon: <Clapperboard size={13} /> },
                    { id: 'tts-tools', label: 'Free Voice / TTS Tools', icon: <Volume2 size={13} /> },
                    { id: 'faq', label: 'FAQ & Tips', icon: <HelpCircle size={13} /> },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setGuideSubSection(item.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-[3px] text-left transition-colors cursor-pointer ${
                      guideSubSection === item.id
                        ? 'bg-white/12 text-white font-medium border border-white/20'
                        : 'text-[#9C9C96] hover:text-white hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* RIGHT CONTENT COLUMN */}
        <div className="lg:col-span-8 space-y-6">
          {/* Header Block */}
          <div className="space-y-2 pb-2 border-b border-white/10">
            <div className="flex items-center gap-2 text-xs font-mono text-[#9C9C96]">
              {pageMeta.icon}
              <span>{pageMeta.eyebrow}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-normal text-white font-display tracking-tight">
              {pageMeta.title}
            </h1>
            <p className="text-sm sm:text-base text-[#A0A09A] leading-relaxed">
              {pageMeta.subtitle}
            </p>
          </div>

          {/* Main Content Panel */}
          <div className="bg-[#121211] border border-white/15 rounded-[3px] p-5 sm:p-7 space-y-6 text-[#D4D4D0] text-sm sm:text-base leading-relaxed font-narrative">
            {isSecurity ? (
              <>
                {/* Multi-Provider Interactive Key Management Block */}
                <div className="p-4 sm:p-5 bg-[#0C0C0B] border border-white/15 rounded-[3px] space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display text-sm font-medium text-white flex items-center gap-2">
                      <KeyRound size={15} className="text-amber-400" />
                      <span>Manage Your API Key (BYOK)</span>
                    </span>
                    {hasSelectedProviderKey && (
                      <span className="stamp-chip text-[9px] bg-emerald-950/50 text-emerald-400 border-emerald-500/40">
                        KEY ACTIVE IN SESSION
                      </span>
                    )}
                  </div>

                  {/* Provider Switcher Tabs */}
                  <div className="inline-flex w-full sm:w-auto p-1 bg-[#161614] border border-white/15 rounded-[3px]">
                    <button
                      type="button"
                      onClick={() => setSelectedProviderTab('gemini')}
                      className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-display rounded-[2px] transition-colors cursor-pointer ${
                        selectedProviderTab === 'gemini'
                          ? 'bg-white text-black font-semibold'
                          : 'text-[#9C9C96] hover:text-white'
                      }`}
                    >
                      Google Gemini {geminiApiKey.trim() ? '(Saved)' : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedProviderTab('groq')}
                      className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-display rounded-[2px] transition-colors cursor-pointer ${
                        selectedProviderTab === 'groq'
                          ? 'bg-white text-black font-semibold'
                          : 'text-[#9C9C96] hover:text-white'
                      }`}
                    >
                      Groq Cloud {groqApiKey.trim() ? '(Saved)' : ''}
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="byok-key-input" className="block font-display text-xs text-[#C4C4BE]">
                      {selectedProviderTab === 'groq' ? 'Groq API Key' : 'Google Gemini API Key'}
                    </label>
                    <div className="relative">
                      <input
                        type={showKeyText ? 'text' : 'password'}
                        id="byok-key-input"
                        value={keyDraft}
                        onChange={(e) => setKeyDraft(e.target.value)}
                        placeholder={selectedProviderTab === 'groq' ? 'gsk_...' : 'AIzaSy...'}
                        className="w-full pl-3.5 pr-10 py-2.5 bg-[#141412] border border-white/15 text-white font-mono text-xs sm:text-sm focus:outline-none focus:border-white rounded-[3px]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeyText(!showKeyText)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#8C8C86] hover:text-white cursor-pointer"
                        aria-label={showKeyText ? 'Hide API key' : 'Show API key'}
                      >
                        {showKeyText ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center space-x-2 text-xs text-[#9C9C96] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberDraft}
                        onChange={(e) => setRememberDraft(e.target.checked)}
                        className="rounded-[2px] border-white/25 bg-[#121211] text-white focus:ring-0 focus:ring-offset-0"
                      />
                      <span>Remember in this browser session (sessionStorage)</span>
                    </label>

                    <div className="flex items-center gap-2">
                      {hasSelectedProviderKey && (
                        <button
                          type="button"
                          onClick={handleClearCurrentKey}
                          className="px-3 py-1.5 text-red-400 hover:text-red-300 font-display text-xs rounded-[3px] hover:bg-red-950/30 transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={12} />
                          <span>Remove Key</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveKey}
                        className="px-4 py-1.5 bg-white text-black font-semibold hover:bg-[#EAEAE5] font-display text-xs transition-colors rounded-[3px] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check size={13} />
                        <span>Apply Key</span>
                      </button>
                    </div>
                  </div>

                  {keyActionNotice && (
                    <p className="text-xs text-emerald-400 font-display">
                      {keyActionNotice}
                    </p>
                  )}
                </div>

                {/* Architecture Explanations */}
                <section className="space-y-3">
                  <h2 className="text-base font-medium font-display text-white flex items-center gap-2">
                    <Lock size={15} className="text-amber-400" />
                    <span>1. Direct Browser-to-Provider Execution</span>
                  </h2>
                  <p className="text-sm text-[#D4D4D0] leading-relaxed">
                    StoryFrame uses a strict client-side Bring Your Own Key (BYOK) design. Your API key and story drafts never touch any server operated by StoryFrame. Requests go straight from your browser to the AI provider you selected:
                  </p>
                  <div className="space-y-2 font-mono text-xs">
                    <div className="p-3 bg-[#0C0C0B] border border-white/10 text-amber-300/90 rounded-[3px]">
                      Google Gemini: https://generativelanguage.googleapis.com/v1beta/models/...
                    </div>
                    <div className="p-3 bg-[#0C0C0B] border border-white/10 text-emerald-300/90 rounded-[3px]">
                      Groq Cloud: https://api.groq.com/openai/v1/chat/completions
                    </div>
                  </div>
                </section>

                <div className="border-t border-white/10" />

                <section className="space-y-3">
                  <h2 className="text-base font-medium font-display text-white flex items-center gap-2">
                    <Zap size={15} className="text-amber-400" />
                    <span>2. Key Storage &amp; Revocation</span>
                  </h2>
                  <ul className="space-y-2 text-sm text-[#C4C4BE] list-disc pl-5">
                    <li>
                      <strong className="text-white">Volatile Memory:</strong> Unchecking &ldquo;Remember in this browser session&rdquo; keeps your key only in active memory until you close or refresh the tab.
                    </li>
                    <li>
                      <strong className="text-white">Browser Session Storage:</strong> When enabled, your key is stored inside your browser&apos;s <code className="text-white bg-white/10 px-1 py-0.5 rounded-[2px] text-xs">sessionStorage</code>, scoped strictly to this origin.
                    </li>
                    <li>
                      <strong className="text-white">One-Click Removal:</strong> Clicking &ldquo;Remove Key&rdquo; deletes the key immediately from both memory and storage.
                    </li>
                  </ul>
                </section>

                <div className="border-t border-white/10" />

                <section className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-[3px] space-y-3">
                  <div className="flex items-center gap-2 text-amber-300 font-display font-medium text-sm">
                    <ShieldAlert size={16} className="shrink-0" />
                    <span>Recommended Key Restrictions</span>
                  </div>
                  <p className="text-xs sm:text-sm text-amber-100/85 leading-relaxed">
                    In Google Cloud, you can restrict your Gemini key to the <code className="text-white font-mono">Generative Language API</code> and limit HTTP referrers to your workspace URL:
                  </p>
                  <code className="block text-white font-mono text-xs bg-black/60 px-3 py-2 border border-white/10 rounded-[3px] break-all">
                    {currentDomain}/*
                  </code>
                  <div className="flex flex-wrap gap-4 pt-1 text-xs font-display">
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-amber-300 hover:text-amber-200 underline underline-offset-2"
                    >
                      <span>Google AI Studio Keys</span>
                      <ExternalLink size={12} className="ml-1" />
                    </a>
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
                    >
                      <span>Groq Cloud Keys</span>
                      <ExternalLink size={12} className="ml-1" />
                    </a>
                  </div>
                </section>
              </>
            ) : isGuide ? (
              <>
                {guideSubSection === 'workflow' && (
                  <div className="space-y-6">
                    {[
                      {
                        num: '01',
                        title: 'Write or Paste Your Story (Optional Beat Tags)',
                        body: 'Enter a story idea, script, or structured clip outline. If you want exact shot cuts, select Manual Beats and insert tags such as (beat 1) and (beat 2) directly in your text.',
                      },
                      {
                        num: '02',
                        title: 'Choose Text to Image or Text to Video Mode',
                        body: 'Use Text to Image for still storyboard frames (for Flux or Midjourney) or Text to Video for motion clips. In Video Mode, setting a clip length like 4s or 5s automatically scales narration and visual actions so they never exceed your chosen generator window.',
                      },
                      {
                        num: '03',
                        title: 'Select AI Provider & Model',
                        body: 'StoryFrame supports Google Gemini (4 Hydrogen for speed and 3.1 Pro for complex scenes) as well as Groq Cloud (GPT-OSS 120B, Qwen 3.8 27B, and GPT-OSS 20B) for fast LPU inference.',
                      },
                      {
                        num: '04',
                        title: 'Character & Style Continuity',
                        body: 'A master Style Profile and Character Sheet are generated once and carried across every scene and beat prompt, preventing wardrobe or appearance drift across cuts.',
                      },
                      {
                        num: '05',
                        title: 'Inspect Beats & Export to Your Editor',
                        body: 'Click any beat card to copy its prompt, view transition editing notes, or copy the continuous voiceover script. Export ready-to-import files as EDL, SRT subtitles, CSV shot lists, Markdown, or JSON.',
                      },
                    ].map((step, idx) => (
                      <div key={step.num}>
                        {idx > 0 && <div className="border-t border-white/10 mb-5" />}
                        <div className="flex items-start gap-3">
                          <span className="px-2 py-0.5 rounded-[3px] bg-white/10 text-white font-mono text-xs shrink-0 mt-0.5 tabular-nums">
                            {step.num}
                          </span>
                          <div className="space-y-1.5">
                            <h2 className="text-base font-medium font-display text-white">
                              {step.title}
                            </h2>
                            <p className="text-sm text-[#C4C4BE] leading-relaxed">
                              {step.body}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {guideSubSection === 'pipeline' && (
                  <div className="space-y-5">
                    <div className="p-4 bg-[#0C0C0B] border border-white/10 rounded-[3px] space-y-1.5">
                      <span className="font-display text-sm text-white font-medium block">
                        4-Stage Creator Production Pipeline
                      </span>
                      <p className="text-xs sm:text-sm text-[#9C9C96] leading-relaxed">
                        Use StoryFrame alongside external image, video, and voice tools to assemble a complete project.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-[#0C0C0B] border border-white/10 rounded-[3px] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-display font-medium text-white text-sm">1. Story Framing</span>
                          <span className="stamp-chip text-[9px]">STORYFRAME</span>
                        </div>
                        <p className="text-xs sm:text-sm text-[#B0B0A8] leading-relaxed">
                          Break your narrative into timed scenes, camera framing beats, and calibrated narrator lines.
                        </p>
                      </div>

                      <div className="p-4 bg-[#0C0C0B] border border-white/10 rounded-[3px] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-display font-medium text-white text-sm">2. Visual Plates</span>
                          <span className="stamp-chip text-[9px]">FLUX / MIDJOURNEY</span>
                        </div>
                        <p className="text-xs sm:text-sm text-[#B0B0A8] leading-relaxed">
                          Render still frames or start-frame keyframe plates using StoryFrame&apos;s locked character descriptions.
                        </p>
                      </div>

                      <div className="p-4 bg-[#0C0C0B] border border-white/10 rounded-[3px] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-display font-medium text-white text-sm">3. Motion Synthesis</span>
                          <span className="stamp-chip text-[9px] bg-amber-950/50 text-amber-300 border-amber-700/60">KLING / LUMA</span>
                        </div>
                        <p className="text-xs sm:text-sm text-[#B0B0A8] leading-relaxed">
                          Animate clips using Text to Video prompts or pair Start Frame plates with Image-to-Video tools.
                        </p>
                      </div>

                      <div className="p-4 bg-[#0C0C0B] border border-white/10 rounded-[3px] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-display font-medium text-white text-sm">4. Audio &amp; Edit</span>
                          <span className="stamp-chip text-[9px] bg-emerald-950/50 text-emerald-300 border-emerald-700/60">KOKORO / CAPCUT</span>
                        </div>
                        <p className="text-xs sm:text-sm text-[#B0B0A8] leading-relaxed">
                          Record voiceover from the Clean Script and import the SRT or EDL timing files into your video editor.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {guideSubSection === 'image-tools' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <span className="font-display text-sm text-white font-medium">
                        Compatible Free &amp; Open Image Generators
                      </span>
                      <span className="text-xs font-mono text-[#8C8C86]">
                        {FREE_IMAGE_TOOLS.length} tools
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {FREE_IMAGE_TOOLS.map((tool) => (
                        <div
                          key={tool.name}
                          className="p-4 bg-[#0C0C0B] border border-white/10 rounded-[3px] space-y-2.5 flex flex-col justify-between"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-display font-medium text-white text-sm">{tool.name}</span>
                              <span className="stamp-chip text-[9px] text-emerald-400 border-emerald-500/30">
                                {tool.pricingTag}
                              </span>
                            </div>
                            <p className="text-xs text-[#9C9C96] leading-relaxed">{tool.description}</p>
                          </div>
                          <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                            <span className="text-[11px] text-[#7D7D76] truncate pr-2">{tool.bestFor}</span>
                            <a
                              href={tool.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-xs font-display text-white hover:underline shrink-0"
                            >
                              <span>Open</span>
                              <ExternalLink size={11} className="ml-1" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {guideSubSection === 'video-tools' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <span className="font-display text-sm text-white font-medium">
                        Compatible Free &amp; Daily-Tier Video Generators
                      </span>
                      <span className="text-xs font-mono text-[#8C8C86]">
                        {FREE_VIDEO_TOOLS.length} tools
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {FREE_VIDEO_TOOLS.map((tool) => (
                        <div
                          key={tool.name}
                          className="p-4 bg-[#0C0C0B] border border-white/10 rounded-[3px] space-y-2.5 flex flex-col justify-between"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-display font-medium text-white text-sm">{tool.name}</span>
                              <span className="stamp-chip text-[9px] text-emerald-400 border-emerald-500/30">
                                {tool.pricingTag}
                              </span>
                            </div>
                            <p className="text-xs text-[#9C9C96] leading-relaxed">{tool.description}</p>
                          </div>
                          <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                            <span className="text-[11px] text-[#7D7D76] truncate pr-2">{tool.bestFor}</span>
                            <a
                              href={tool.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-xs font-display text-white hover:underline shrink-0"
                            >
                              <span>Open</span>
                              <ExternalLink size={11} className="ml-1" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {guideSubSection === 'tts-tools' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <span className="font-display text-sm text-white font-medium">
                        Compatible Voiceover &amp; TTS Tools
                      </span>
                      <span className="text-xs font-mono text-[#8C8C86]">
                        {FREE_TTS_TOOLS.length} tools
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {FREE_TTS_TOOLS.map((tool) => (
                        <div
                          key={tool.name}
                          className="p-4 bg-[#0C0C0B] border border-white/10 rounded-[3px] space-y-2.5 flex flex-col justify-between"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-display font-medium text-white text-sm">{tool.name}</span>
                              <span className="stamp-chip text-[9px] text-emerald-400 border-emerald-500/30">
                                {tool.pricingTag}
                              </span>
                            </div>
                            <p className="text-xs text-[#9C9C96] leading-relaxed">{tool.description}</p>
                          </div>
                          <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                            <span className="text-[11px] text-[#7D7D76] truncate pr-2">{tool.bestFor}</span>
                            <a
                              href={tool.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-xs font-display text-white hover:underline shrink-0"
                            >
                              <span>Open</span>
                              <ExternalLink size={11} className="ml-1" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {guideSubSection === 'faq' && (
                  <div className="space-y-4">
                    {[
                      {
                        q: 'How do I keep characters consistent across every clip?',
                        a: 'StoryFrame injects locked facial, hair, and wardrobe descriptions into each beat prompt. For video models like Kling or Runway, use the Character Reference Packets or Start Frame Keyframe prompts as Image-to-Video starting plates.',
                      },
                      {
                        q: 'How does Clip Duration work in Text to Video mode?',
                        a: 'If you choose a 4s or 5s clip duration, StoryFrame aligns the spoken words, timing, and action beats to fit comfortably within each clip window and notes multi-clip spillovers cleanly when a moment takes longer.',
                      },
                      {
                        q: 'Why did I hit a rate limit error?',
                        a: 'Both Google AI Studio and Groq Cloud free tiers enforce requests-per-minute quotas. If a limit is reached, wait briefly before retrying or switch providers inside Model & API Settings.',
                      },
                      {
                        q: 'How is narration duration calculated?',
                        a: 'Narration speed uses an average conversational pacing of 130 to 150 words per minute, ensuring spoken script lengths match your planned scene and beat durations.',
                      },
                    ].map((item) => (
                      <div key={item.q} className="p-4 bg-[#0C0C0B] border border-white/10 rounded-[3px] space-y-1.5">
                        <h3 className="font-display text-white text-sm sm:text-base font-medium">{item.q}</h3>
                        <p className="text-xs sm:text-sm text-[#B0B0A8] leading-relaxed">{item.a}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : isTerms ? (
              <div className="space-y-6">
                {[
                  {
                    num: '01',
                    title: 'Acceptance of Terms',
                    body: 'By using StoryFrame, you agree to these Terms of Service. You confirm that you are at least 13 years of age (or the minimum age required in your country) and authorized to use the service.',
                  },
                  {
                    num: '02',
                    title: 'User Ownership & Intellectual Property',
                    body: 'You retain 100% ownership and copyright over every story idea, script, character description, and generated storyboard created using StoryFrame. StoryFrame claims zero ownership over your inputs or outputs.',
                  },
                  {
                    num: '03',
                    title: 'Commercial & Royalty-Free Usage Rights',
                    body: 'All storyboards, narrator scripts, and prompts generated through StoryFrame may be used royalty-free for personal or commercial projects across YouTube, TikTok, Instagram, film production, and client deliverables.',
                  },
                  {
                    num: '04',
                    title: 'Bring Your Own Key (BYOK) & Provider Terms',
                    body: 'StoryFrame connects directly from your browser to Google Gemini or Groq Cloud using your personal API key. Requests are governed by the respective terms, quotas, and acceptable-use policies of Google Cloud or Groq. StoryFrame adds no commissions or token markups.',
                  },
                  {
                    num: '05',
                    title: 'Acceptable Use',
                    body: 'You agree not to use StoryFrame to create unlawful, abusive, non-consensual, or deceptive content, or to attempt automated abuse against third-party AI APIs.',
                  },
                  {
                    num: '06',
                    title: 'As-Is Warranty & Limitation of Liability',
                    body: 'StoryFrame is provided on an as-is basis. You are responsible for reviewing generated prompts, dialogue, and timings prior to publishing final media. StoryFrame is not liable for indirect or consequential damages arising from third-party API downtime or AI model outputs.',
                  },
                ].map((sec, idx) => (
                  <section key={sec.num}>
                    {idx > 0 && <div className="border-t border-white/10 mb-5" />}
                    <div className="flex items-start gap-3">
                      <span className="px-2 py-0.5 rounded-[3px] bg-white/10 text-white font-mono text-xs shrink-0 mt-0.5 tabular-nums">
                        {sec.num}
                      </span>
                      <div className="space-y-1.5">
                        <h2 className="text-base font-medium font-display text-white">{sec.title}</h2>
                        <p className="text-sm text-[#C4C4BE] leading-relaxed">{sec.body}</p>
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {[
                  {
                    num: '01',
                    title: 'Zero Server Storage',
                    body: 'StoryFrame does not operate a remote database for your stories, scripts, prompts, or API keys. All application state runs locally in your web browser.',
                  },
                  {
                    num: '02',
                    title: 'API Key Isolation',
                    body: 'Your Google Gemini or Groq Cloud key stays in volatile memory or optional browser sessionStorage strictly scoped to this site origin. You can delete stored keys at any time with Remove Key.',
                  },
                  {
                    num: '03',
                    title: 'Direct Provider Requests',
                    body: 'When generating a breakdown, your browser sends requests directly over HTTPS to generativelanguage.googleapis.com (Google Gemini) or api.groq.com (Groq Cloud) without intermediary relays.',
                  },
                  {
                    num: '04',
                    title: 'Local History Storage',
                    body: 'Generated storyboards and series continuity snapshots are saved only in your browser localStorage so you can reopen past work. You can remove any item or clear all history at any time.',
                  },
                  {
                    num: '05',
                    title: 'Zero Tracking Pixels or Ad Cookies',
                    body: 'StoryFrame does not embed third-party advertising trackers, behavioral fingerprinting scripts, or social tracking pixels.',
                  },
                ].map((sec, idx) => (
                  <section key={sec.num}>
                    {idx > 0 && <div className="border-t border-white/10 mb-5" />}
                    <div className="flex items-start gap-3">
                      <span className="px-2 py-0.5 rounded-[3px] bg-white/10 text-white font-mono text-xs shrink-0 mt-0.5 tabular-nums">
                        {sec.num}
                      </span>
                      <div className="space-y-1.5">
                        <h2 className="text-base font-medium font-display text-white">{sec.title}</h2>
                        <p className="text-sm text-[#C4C4BE] leading-relaxed">{sec.body}</p>
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Footer Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={onBack}
              className="w-full sm:w-auto px-5 py-2.5 bg-white text-black hover:bg-[#EAEAE5] text-xs sm:text-sm font-display font-semibold rounded-[3px] transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Return to Story Generator</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleSwitchTab(
                  isSecurity ? 'guide' : isGuide ? 'terms' : isTerms ? 'privacy' : 'byok-security'
                )
              }
              className="w-full sm:w-auto px-4 py-2.5 text-[#C4C4BE] hover:text-white bg-[#181816] hover:bg-[#242422] border border-white/15 text-xs sm:text-sm font-display rounded-[3px] transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                {isSecurity
                  ? 'Explore Help & Guide'
                  : isGuide
                    ? 'Read Terms & Conditions'
                    : isTerms
                      ? 'Read Privacy Policy'
                      : 'View BYOK Security'}
              </span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
