import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  HelpCircle,
  Clapperboard,
  Image as ImageIcon,
  Volume2,
  ExternalLink,
  Workflow,
  CheckCircle2,
  Layers,
  Compass,
  Film,
  Copy,
  Check,
  ChevronRight,
  Shield,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { FREE_IMAGE_TOOLS, FREE_VIDEO_TOOLS, FREE_TTS_TOOLS, ToolItem } from '../data/toolsData';

interface HelpGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'purpose' | 'workflow' | 'image-tools' | 'video-tools' | 'tts-tools';

export default function HelpGuideModal({ isOpen, onClose }: HelpGuideModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('purpose');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopyLink = (url: string, name: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(name);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  if (!isOpen) return null;

  const NAV_ITEMS: { id: TabType; label: string; icon: React.ReactNode; badge?: string; badgeColor?: string }[] = [
    {
      id: 'purpose',
      label: 'Purpose & Value',
      icon: <Compass size={16} />,
    },
    {
      id: 'workflow',
      label: '3-Step Workflow',
      icon: <Workflow size={16} />,
    },
    {
      id: 'image-tools',
      label: 'Free Image AI Tools',
      icon: <ImageIcon size={16} className="text-sky-400/60" />,
      badge: `${FREE_IMAGE_TOOLS.length}`,
      badgeColor: 'bg-sky-950/25 text-sky-200/70 border-sky-800/25',
    },
    {
      id: 'video-tools',
      label: 'Free Video AI Tools',
      icon: <Clapperboard size={16} className="text-amber-400" />,
      badge: `${FREE_VIDEO_TOOLS.length}`,
      badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
    },
    {
      id: 'tts-tools',
      label: 'Free Voice & TTS Tools',
      icon: <Volume2 size={16} className="text-emerald-400" />,
      badge: `${FREE_TTS_TOOLS.length}`,
      badgeColor: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/70',
    },
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end md:items-center md:justify-center md:p-6 lg:p-8">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Sidebar on Mobile, Modal on Desktop */}
      <div
        id="help-guide-modal"
        className="relative bg-[#0E0E0D] border-l md:border border-white/15 w-full max-w-full md:max-w-5xl h-full md:h-[86vh] flex flex-col shadow-2xl z-10 font-narrative text-[#F5F5F0] overflow-hidden md:rounded-[2px] animate-in slide-in-from-right md:slide-in-from-bottom-4 duration-200"
      >
        {/* Spacious Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-8 py-3.5 sm:py-5 border-b border-white/10 bg-[#141412] shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 border border-white/20 bg-white/5 flex items-center justify-center rounded-[1px] text-white shrink-0">
              <HelpCircle size={17} />
            </div>
            <div>
              <h2 className="text-sm sm:text-xl font-display font-medium text-white tracking-tight">
                Director’s Guide &amp; Free AI Directory
              </h2>
              <p className="hidden md:block text-xs text-[#9C9C96] font-editorial-meta mt-0.5 tracking-wider">
                PRODUCTION WORKFLOW • CHARACTER CONTINUITY • FREE GENERATION PLATFORMS • VERSION 3.5
              </p>
            </div>
          </div>

          <button
            type="button"
            id="close-help-modal-btn"
            onClick={onClose}
            className="p-2 text-[#9C9C96] hover:text-white hover:bg-white/10 transition-colors rounded-[1px] min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Close Guide"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mobile Horizontal Category Selector */}
        <div className="flex md:hidden items-center gap-1.5 px-3.5 py-2.5 border-b border-white/10 bg-[#121210] overflow-x-auto no-scrollbar shrink-0">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1.5 text-xs font-editorial-meta tracking-wider whitespace-nowrap rounded-[2px] transition-all flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'bg-white/5 text-[#A0A098] hover:text-white hover:bg-white/10'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${item.badgeColor || 'bg-white/20 text-white'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Main Body: Desktop 2-Column Sidebar + Content Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Desktop Left Navigation Sidebar */}
          <aside className="hidden md:flex flex-col justify-between w-64 lg:w-72 border-r border-white/10 bg-[#111110] p-4 shrink-0">
            <div className="space-y-1.5">
              <div className="px-3 py-2">
                <span className="font-editorial-meta text-[10px] text-[#70706A] uppercase tracking-widest block font-medium">
                  Directory Sections
                </span>
              </div>

              {NAV_ITEMS.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-[2px] text-xs font-editorial-meta tracking-wider transition-all text-left ${
                      isActive
                        ? 'bg-white text-black font-semibold shadow-md'
                        : 'text-[#B0B0A8] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className={isActive ? 'text-black' : ''}>{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge ? (
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                          isActive ? 'bg-black text-white border-black' : item.badgeColor
                        }`}
                      >
                        {item.badge}
                      </span>
                    ) : (
                      <ChevronRight size={14} className={isActive ? 'text-black' : 'text-[#50504A]'} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Sidebar Footer Info */}
            <div className="p-3.5 border border-white/10 bg-[#0A0A09] space-y-1.5 rounded-[2px]">
              <div className="flex items-center space-x-1.5 text-white">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span className="font-editorial-meta text-[10px] uppercase font-semibold">
                  Zero Subscriptions
                </span>
              </div>
              <p className="text-[10px] text-[#8C8C86] leading-relaxed">
                StoryFrame is 100% free with BYOK. Use the directory tools to render your prompts at zero cost.
              </p>
            </div>
          </aside>

          {/* Right Main Content Scroll Pane */}
          <main className="flex-1 overflow-y-auto p-5 sm:p-8 lg:p-10 space-y-6 text-sm leading-relaxed">
            
            {/* TAB 1: PURPOSE & VALUE */}
            {activeTab === 'purpose' && (
              <div className="space-y-6 max-w-3xl animate-in fade-in duration-200">
                <div className="border border-white/10 bg-[#131311] p-5 sm:p-7 space-y-3.5 rounded-[2px]">
                  <span className="stamp-chip stamp-chip-primary font-bold text-[9px]">
                    THE PROBLEM STORYFRAME SOLVES
                  </span>
                  <h3 className="text-lg sm:text-2xl font-display text-white tracking-tight">
                    Why Generative AI Needs a Director of Photography
                  </h3>
                  <p className="text-[#D8D8D2] leading-relaxed">
                    AI generative tools (Midjourney, Imagen 3, Kling, Luma) are incredible at producing individual images, but they struggle with <strong>visual continuity</strong>: characters change faces between shots, lighting fluctuates wildly, and spoken narration paces are completely mismatched.
                  </p>
                  <p className="text-[#B0B0A8] leading-relaxed">
                    <strong>StoryFrame eliminates these bottlenecks:</strong> It dissects any story, article, or voiceover script into frame-by-frame Roman-numeral scenes. It locks a continuous Character Sheet, preserves camera angles, and calibrates duration to prevent voiceover rushing.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="border border-white/10 bg-[#121210] p-4 sm:p-5 space-y-2.5 rounded-[2px]">
                    <div className="flex items-center space-x-2 text-white">
                      <ShieldCheck size={18} className="text-emerald-400" />
                      <span className="font-editorial-meta text-xs font-semibold uppercase">
                        100% Free &amp; Private
                      </span>
                    </div>
                    <p className="text-xs text-[#A0A098] leading-relaxed">
                      No monthly fees or watermarks. Uses private Gemini API keys with local browser persistence.
                    </p>
                  </div>

                  <div className="border border-white/10 bg-[#121210] p-4 sm:p-5 space-y-2.5 rounded-[2px]">
                    <div className="flex items-center space-x-2 text-white">
                      <Layers size={18} className="text-purple-400" />
                      <span className="font-editorial-meta text-xs font-semibold uppercase">
                        Locked Characters
                      </span>
                    </div>
                    <p className="text-xs text-[#A0A098] leading-relaxed">
                      Master character visual blueprints are carried into all subsequent shot prompts to prevent face drift.
                    </p>
                  </div>

                  <div className="border border-white/10 bg-[#121210] p-4 sm:p-5 space-y-2.5 rounded-[2px]">
                    <div className="flex items-center space-x-2 text-white">
                      <Clock size={18} className="text-amber-400" />
                      <span className="font-editorial-meta text-xs font-semibold uppercase">
                        Duration Calibrated
                      </span>
                    </div>
                    <p className="text-xs text-[#A0A098] leading-relaxed">
                      Calibrated for 5s, 10s, or 15s video clips, or rapid sub-2.0s image storyboards.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: WORKFLOW */}
            {activeTab === 'workflow' && (
              <div className="space-y-6 max-w-3xl animate-in fade-in duration-200">
                <div className="space-y-1.5 border-b border-white/10 pb-4">
                  <h3 className="text-lg sm:text-2xl font-display text-white tracking-tight">
                    The 4-Step Directorial Workflow
                  </h3>
                  <p className="text-[#9C9C96] text-xs sm:text-sm">
                    From a raw concept or voiceover script to a fully synchronized cinematic timeline in minutes.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4 p-5 border border-white/10 bg-[#131311] rounded-[2px]">
                    <div className="w-8 h-8 bg-white text-black font-bold font-mono text-sm flex items-center justify-center shrink-0 rounded-[1px]">
                      1
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <h4 className="font-display font-medium text-white text-base">
                        Input Script with Optional Beat Markup
                      </h4>
                      <p className="text-[#B0B0A8] text-xs sm:text-sm leading-relaxed">
                        Enter your narrative, paste a YouTube voiceover transcript, or use one-click presets. For precise director control over where visual cuts occur, embed inline beat markers like <code className="text-white font-mono bg-white/10 px-1 py-0.5 text-xs">(beat 1)</code>, <code className="text-white font-mono bg-white/10 px-1 py-0.5 text-xs">(beat 2)</code> into your paragraphs.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-5 border border-white/10 bg-[#131311] rounded-[2px]">
                    <div className="w-8 h-8 bg-white text-black font-bold font-mono text-sm flex items-center justify-center shrink-0 rounded-[1px]">
                      2
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <h4 className="font-display font-medium text-white text-base">
                        Configure Format, Scene Count &amp; Model Tier
                      </h4>
                      <p className="text-[#B0B0A8] text-xs sm:text-sm leading-relaxed">
                        Choose <strong>Short-form (9:16 Vertical)</strong> for TikTok/Reels or <strong>Long-form (16:9 Widescreen)</strong> for YouTube. Pick <strong>Flash 2.5</strong> for rapid drafting or <strong>Pro 2.5</strong> for nuanced spatial blocking and subtle camera choreography.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-5 border border-white/10 bg-[#131311] rounded-[2px]">
                    <div className="w-8 h-8 bg-white text-black font-bold font-mono text-sm flex items-center justify-center shrink-0 rounded-[1px]">
                      3
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <h4 className="font-display font-medium text-white text-base">
                        Character Sheet &amp; Continuity Anchors
                      </h4>
                      <p className="text-[#B0B0A8] text-xs sm:text-sm leading-relaxed">
                        Review the locked Character Blueprint synthesized by StoryFrame. Facial structure, hair, distinctive wardrobe tokens, and color palettes are carried into every scene prompt, preventing character face drift across cuts in Flux, Midjourney, Kling, and Luma.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-5 border border-white/10 bg-[#131311] rounded-[2px]">
                    <div className="w-8 h-8 bg-white text-black font-bold font-mono text-sm flex items-center justify-center shrink-0 rounded-[1px]">
                      4
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <h4 className="font-display font-medium text-white text-base">
                        1-Click Copy, Narration TTS &amp; Timeline Sync
                      </h4>
                      <p className="text-[#B0B0A8] text-xs sm:text-sm leading-relaxed">
                        Copy the narrator script directly into Kokoro TTS or ElevenLabs (calibrated to a natural 130-150 WPM cadence). Click <strong>EXPORT CSV</strong> to download a frame-accurate shot list ready to drop into CapCut, DaVinci Resolve, or Premiere Pro.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: FREE IMAGE GENERATION TOOLS (SUBTLE BLUE ACCENT THEME) */}
            {activeTab === 'image-tools' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-900/20 pb-4">
                  <div>
                    <h3 className="text-lg sm:text-2xl font-display text-white tracking-tight flex items-center gap-2">
                      <ImageIcon size={20} className="text-sky-400/60" />
                      <span>Free AI Image Generation Tools Directory</span>
                    </h3>
                    <p className="text-[#9C9C96] text-xs sm:text-sm mt-0.5">
                      Paste StoryFrame structured visual prompts into these verified free image platforms.
                    </p>
                  </div>
                  <span className="stamp-chip bg-sky-950/25 text-sky-200/70 border-sky-800/25 text-[9px] self-start sm:self-auto font-semibold">
                    {FREE_IMAGE_TOOLS.length} VERIFIED FREE TIERS
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {FREE_IMAGE_TOOLS.map((tool) => (
                    <div
                      key={tool.name}
                      className="border border-sky-900/20 bg-[#080D14] hover:border-sky-500/30 p-5 space-y-3.5 flex flex-col justify-between transition-all rounded-[2px] shadow-sm hover:shadow-sky-950/10"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-display font-medium text-white text-base">
                            {tool.name}
                          </h4>
                          <span className="stamp-chip bg-sky-950/40 text-sky-200/70 border-sky-800/30 text-[8px] shrink-0 font-semibold">
                            {tool.pricingTag}
                          </span>
                        </div>
                        <span className="font-editorial-meta text-[10px] text-sky-400/60 block">
                          Engine: {tool.highlight}
                        </span>
                        <p className="text-[#BAC7D5] text-xs sm:text-sm leading-relaxed font-narrative">
                          {tool.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-sky-900/15 space-y-2.5">
                        <p className="text-[11px] text-[#7E8F9F]">
                          <strong className="text-sky-200/80">Best for:</strong> {tool.bestFor}
                        </p>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <a
                            href={tool.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-editorial-meta text-sky-300/70 hover:text-white underline underline-offset-4 tracking-wider font-medium"
                          >
                            <span>Open Tool</span>
                            <ExternalLink size={12} />
                          </a>

                          <button
                            type="button"
                            onClick={() => handleCopyLink(tool.url, tool.name)}
                            className="text-[10px] font-editorial-meta text-sky-300/70 hover:text-white px-2.5 py-1 border border-sky-800/30 hover:border-sky-600/50 bg-sky-950/20 transition-colors"
                          >
                            {copiedLink === tool.name ? 'COPIED LINK' : 'COPY URL'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: FREE VIDEO GENERATION TOOLS (AMBER ACCENT THEME) */}
            {activeTab === 'video-tools' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-900/40 pb-4">
                  <div>
                    <h3 className="text-lg sm:text-2xl font-display text-white tracking-tight flex items-center gap-2">
                      <Clapperboard size={20} className="text-amber-400" />
                      <span>Free AI Video Generation Tools Directory</span>
                    </h3>
                    <p className="text-[#9C9C96] text-xs sm:text-sm mt-0.5">
                      Paste StoryFrame Text-to-Video prompts into these leading free video models.
                    </p>
                  </div>
                  <span className="stamp-chip bg-amber-950/70 text-amber-300 border-amber-800/80 text-[9px] self-start sm:self-auto font-semibold">
                    {FREE_VIDEO_TOOLS.length} VERIFIED PLATFORMS
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {FREE_VIDEO_TOOLS.map((tool) => (
                    <div
                      key={tool.name}
                      className="border border-amber-900/40 bg-[#141310] hover:border-amber-500/60 p-5 space-y-3.5 flex flex-col justify-between transition-all rounded-[2px] shadow-sm hover:shadow-amber-950/30"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-display font-medium text-white text-base">
                            {tool.name}
                          </h4>
                          <span className="stamp-chip bg-amber-950/90 text-amber-300 border-amber-800/90 text-[8px] shrink-0 font-semibold">
                            {tool.pricingTag}
                          </span>
                        </div>
                        <span className="font-editorial-meta text-[10px] text-amber-400/90 block">
                          Feature: {tool.highlight}
                        </span>
                        <p className="text-[#D8D5CD] text-xs sm:text-sm leading-relaxed font-narrative">
                          {tool.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-amber-900/30 space-y-2.5">
                        <p className="text-[11px] text-[#A6A296]">
                          <strong className="text-amber-200">Best for:</strong> {tool.bestFor}
                        </p>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <a
                            href={tool.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-editorial-meta text-amber-300 hover:text-white underline underline-offset-4 tracking-wider font-medium"
                          >
                            <span>Open Tool</span>
                            <ExternalLink size={12} />
                          </a>

                          <button
                            type="button"
                            onClick={() => handleCopyLink(tool.url, tool.name)}
                            className="text-[10px] font-editorial-meta text-amber-300 hover:text-white px-2.5 py-1 border border-amber-800/50 hover:border-amber-600 bg-amber-950/40 transition-colors"
                          >
                            {copiedLink === tool.name ? 'COPIED LINK' : 'COPY URL'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: FREE VOICE & TEXT TO SPEECH (TTS) TOOLS */}
            {activeTab === 'tts-tools' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-900/40 pb-4">
                  <div>
                    <h3 className="text-lg sm:text-2xl font-display text-white tracking-tight flex items-center gap-2">
                      <Volume2 size={20} className="text-emerald-400" />
                      <span>Free AI Voice &amp; Text-to-Speech (TTS) Tools</span>
                    </h3>
                    <p className="text-[#9C9C96] text-xs sm:text-sm mt-0.5">
                      Generate realistic character voices, dialogue, and cinematic narrations from your story script.
                    </p>
                  </div>
                  <span className="stamp-chip bg-emerald-950/70 text-emerald-300 border-emerald-800/70 text-[9px] self-start sm:self-auto font-semibold">
                    {FREE_TTS_TOOLS.length} VERIFIED VOICE ENGINES
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {FREE_TTS_TOOLS.map((tool) => (
                    <div
                      key={tool.name}
                      className="border border-emerald-900/30 bg-[#0B1511] hover:border-emerald-500/50 p-5 space-y-3.5 flex flex-col justify-between transition-all rounded-[2px] shadow-sm hover:shadow-emerald-950/30"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-display font-medium text-white text-base">
                            {tool.name}
                          </h4>
                          <span className="stamp-chip bg-emerald-950/90 text-emerald-300 border-emerald-800/80 text-[8px] shrink-0 font-semibold">
                            {tool.pricingTag}
                          </span>
                        </div>
                        <span className="font-editorial-meta text-[10px] text-emerald-400/90 block">
                          Engine: {tool.highlight}
                        </span>
                        <p className="text-[#C6D8D0] text-xs sm:text-sm leading-relaxed font-narrative">
                          {tool.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-emerald-900/30 space-y-2.5">
                        <p className="text-[11px] text-[#8EA399]">
                          <strong className="text-emerald-200">Best for:</strong> {tool.bestFor}
                        </p>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <a
                            href={tool.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-editorial-meta text-emerald-300 hover:text-white underline underline-offset-4 tracking-wider font-medium"
                          >
                            <span>Open Tool</span>
                            <ExternalLink size={12} />
                          </a>

                          <button
                            type="button"
                            onClick={() => handleCopyLink(tool.url, tool.name)}
                            className="text-[10px] font-editorial-meta text-emerald-300 hover:text-white px-2.5 py-1 border border-emerald-800/50 hover:border-emerald-600 bg-emerald-950/40 transition-colors"
                          >
                            {copiedLink === tool.name ? 'COPIED LINK' : 'COPY URL'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Spacious Footer */}
        <div className="px-5 sm:px-8 py-3.5 border-t border-white/10 bg-[#111110] flex items-center justify-between gap-4 shrink-0">
          <span className="font-editorial-meta text-[10px] sm:text-xs text-[#70706A] tracking-wider">
            STORYFRAME • 100% FREE AI DIRECTOR SUITE
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-white text-black hover:bg-neutral-200 font-editorial-meta text-xs font-semibold tracking-wider uppercase transition-colors rounded-[1px]"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
