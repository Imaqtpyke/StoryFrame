import { useState, FormEvent, MouseEvent, useEffect } from 'react';
import CustomDropdown, { DropdownOption } from './CustomDropdown';
import KeyConsentModal from './KeyConsentModal';
import { useApiKey } from '../context/ApiKeyContext';
import { StoryFormat, GenerateStoryRequest, GenerationMode, CustomSceneDefinition, CustomBeatDefinition } from '../types';
import { Sliders, RefreshCw, AlertCircle, Dices, Eye, EyeOff, KeyRound, Trash2, CheckCircle2, Shield, Camera, Video, Sparkles, Scissors } from 'lucide-react';

interface GeneratorFormProps {
  onSubmit: (data: GenerateStoryRequest) => void;
  isLoading: boolean;
  errorMessage: string | null;
}

const RANDOM_STORIES: string[] = [
  "A lonely clockmaker discovers an ancient mechanical pocket watch that ticks backward, rewinding the room around him by thirty seconds whenever he presses the winding crown.",
  "Two deep-sea marine biologists in a research submersible encounter an illuminated underwater metropolis buried inside the Mariana Trench that responds to sonar pulses with musical harmonics.",
  "A ramen chef operates a midnight street stall at a forgotten Tokyo crossroads that only spirits and wandering ghosts can see, serving warm broth that restores mortal memories.",
  "An archivist in a grand subterranean library unearths an unwritten leather tome whose ink forms words only when illuminated by starlight, revealing the secret history of an extinct solar system.",
  "A solo astronaut stranded on a terraformed greenhouse asteroid tends to an alien bioluminescent flora that produces breathable oxygen and whispers echoes of Earth's radio broadcasts.",
  "A young street photographer in 1980s Neo-Seoul develops black-and-white film that unexpectedly captures future headlines ten minutes before they happen.",
  "A silent desert nomad guides a caravan of solar-powered mechanical beasts across an endless dune sea, seeking an oasis made entirely of crystallized mirrors.",
];

const SHORT_PLATFORMS: DropdownOption[] = [
  { value: 'TikTok', label: 'TikTok', sublabel: '9:16 vertical' },
  { value: 'Instagram Reels', label: 'Instagram Reels', sublabel: '9:16 vertical' },
  { value: 'YouTube Shorts', label: 'YouTube Shorts', sublabel: '9:16 vertical' },
  { value: 'Facebook Reels', label: 'Facebook Reels', sublabel: '9:16 vertical' },
  { value: 'General/Any (9:16)', label: 'General / Any', sublabel: '9:16 vertical' },
];

const LONG_PLATFORMS: DropdownOption[] = [
  { value: 'YouTube', label: 'YouTube', sublabel: '16:9 widescreen' },
  { value: 'General/Any (16:9)', label: 'General / Any', sublabel: '16:9 widescreen' },
];

const SHORT_DURATIONS: DropdownOption[] = [
  { value: 'automatic', label: 'Automatic', sublabel: 'Story decides natural length' },
  { value: '15', label: '15 seconds' },
  { value: '30', label: '30 seconds' },
  { value: '45', label: '45 seconds' },
  { value: '60', label: '60 seconds' },
  { value: '90', label: '90 seconds' },
  { value: 'custom', label: 'Custom', sublabel: 'Specify exact seconds' },
];

const LONG_DURATIONS: DropdownOption[] = [
  { value: 'automatic', label: 'Automatic', sublabel: 'Story decides natural length' },
  { value: '60', label: '1 minute' },
  { value: '120', label: '2 minutes' },
  { value: '180', label: '3 minutes' },
  { value: '300', label: '5 minutes' },
  { value: '600', label: '10 minutes' },
  { value: '900', label: '15 minutes' },
  { value: '1200', label: '20 minutes' },
  { value: '1800', label: '30 minutes' },
  { value: 'custom', label: 'Custom', sublabel: 'Specify exact minutes' },
];

const VIDEO_DURATIONS: DropdownOption[] = [
  { value: '5', label: '5 seconds', sublabel: 'Kling / Runway / Luma / Haiper standard' },
  { value: '6', label: '6 seconds', sublabel: 'Standard AI clip duration' },
  { value: '7', label: '7 seconds', sublabel: 'Extended shot' },
  { value: '8', label: '8 seconds', sublabel: 'Extended shot' },
  { value: '9', label: '9 seconds', sublabel: 'Extended shot' },
  { value: '10', label: '10 seconds', sublabel: 'Sora / Kling 10s generation' },
  { value: '11', label: '11 seconds', sublabel: 'Long cinematic sequence' },
  { value: '12', label: '12 seconds', sublabel: 'Long cinematic sequence' },
  { value: '13', label: '13 seconds', sublabel: 'Long cinematic sequence' },
  { value: '14', label: '14 seconds', sublabel: 'Long cinematic sequence' },
  { value: '15', label: '15 seconds', sublabel: 'Maximum single-clip generation' },
  { value: 'custom', label: 'Custom seconds', sublabel: 'Specify exact seconds' },
];

export default function GeneratorForm({
  onSubmit,
  isLoading,
  errorMessage,
}: GeneratorFormProps) {
  const { apiKey, hasCustomKey, rememberInSession, setCustomApiKey, clearCustomApiKey } = useApiKey();
  const [generationMode, setGenerationMode] = useState<GenerationMode>('image');
  const [beatMode, setBeatMode] = useState<'automatic' | 'custom'>('automatic');
  const [customScenes, setCustomScenes] = useState<CustomSceneDefinition[]>([]);
  const [story, setStory] = useState('');
  const [characterStyle, setCharacterStyle] = useState('');
  const [format, setFormat] = useState<StoryFormat>('short');
  const [platform, setPlatform] = useState('TikTok');
  const [durationValue, setDurationValue] = useState('automatic');
  const [videoDurationValue, setVideoDurationValue] = useState('5');
  const [customNumeric, setCustomNumeric] = useState('');
  const [customVideoSeconds, setCustomVideoSeconds] = useState('');
  const [modelQuality, setModelQuality] = useState<'standard' | 'high'>('standard');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Bring Your Own Key (BYOK) State
  const [keyInput, setKeyInput] = useState(apiKey);
  const [showKeyText, setShowKeyText] = useState(false);
  const [rememberOptIn, setRememberOptIn] = useState(rememberInSession);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [keyFeedback, setKeyFeedback] = useState<string | null>(null);
  const [formValidationNotice, setFormValidationNotice] = useState<string | null>(null);

  // Progressive illumination and stage tracking for breakdown generation
  const [progress, setProgress] = useState(0);
  const [progressPhase, setProgressPhase] = useState('');

  useEffect(() => {
    let animationFrameId: number;
    if (isLoading) {
      setProgress(2);
      setProgressPhase('Analyzing screenplay structure...');
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = (currentTime - startTime) / 1000;

        let p = 0;
        if (elapsed < 2.0) {
          // Smooth ease-out entry: 2% to 28%
          const t = elapsed / 2.0;
          p = 2 + (1 - Math.pow(1 - t, 2)) * 26;
          setProgressPhase('Analyzing screenplay structure...');
        } else if (elapsed < 5.0) {
          // Steady cinematic cruise: 28% to 58%
          const t = (elapsed - 2.0) / 3.0;
          p = 28 + t * 30;
          setProgressPhase('Extracting character staging & locations...');
        } else if (elapsed < 9.0) {
          // Directing beats & camera staging: 58% to 82%
          const t = (elapsed - 5.0) / 4.0;
          p = 58 + t * 24;
          setProgressPhase('Directing camera angles & kinematic staging...');
        } else if (elapsed < 14.0) {
          // Visual prompts & anchors: 82% to 93%
          const t = (elapsed - 9.0) / 5.0;
          p = 82 + (1 - Math.pow(1 - t, 2)) * 11;
          setProgressPhase('Synthesizing visual prompts & anchors...');
        } else {
          // Asymptotic soft crawl approaching 96%
          const extra = (1 - Math.exp(-(elapsed - 14.0) / 5.0)) * 3;
          p = 93 + extra;
          setProgressPhase('Finalizing production storyboard...');
        }

        setProgress(Math.min(96, Math.max(2, p)));
        animationFrameId = requestAnimationFrame(animate);
      };

      animationFrameId = requestAnimationFrame(animate);
    } else {
      setProgress(0);
      setProgressPhase('');
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isLoading]);

  useEffect(() => {
    setKeyInput(apiKey);
    setRememberOptIn(rememberInSession);
  }, [apiKey, rememberInSession]);

  const handleApplyKey = (e: MouseEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) {
      setKeyFeedback('Please enter an API key before applying.');
      setTimeout(() => setKeyFeedback(null), 3000);
      return;
    }
    setIsConsentModalOpen(true);
  };

  const handleConfirmConsent = () => {
    setCustomApiKey(keyInput.trim(), rememberOptIn);
    setIsConsentModalOpen(false);
    setKeyFeedback('Gemini API key applied. Requests will be executed directly from your browser.');
    setFormValidationNotice(null);
    setTimeout(() => setKeyFeedback(null), 4000);
  };

  const handleClearKey = (e: MouseEvent) => {
    e.preventDefault();
    clearCustomApiKey();
    setKeyInput('');
    setRememberOptIn(false);
    setShowKeyText(false);
    setKeyFeedback('Key removed from session.');
    setTimeout(() => setKeyFeedback(null), 3000);
  };

  const handlePickRandomStory = () => {
    const available = RANDOM_STORIES.filter((s) => s !== story);
    const pool = available.length > 0 ? available : RANDOM_STORIES;
    const randomStory = pool[Math.floor(Math.random() * pool.length)];
    if (randomStory) {
      setStory(randomStory);
    }
  };

  const handleFormatChange = (newFormat: StoryFormat) => {
    setFormat(newFormat);
    if (newFormat === 'short') {
      setPlatform('TikTok');
      setDurationValue('automatic');
    } else {
      setPlatform('YouTube');
      setDurationValue('automatic');
    }
  };

  const partitionStoryIntoScenes = (sourceText: string): CustomSceneDefinition[] => {
    const cleaned = sourceText.trim();
    if (!cleaned) return [];

    // Split sentences using punctuation
    const rawSentences = cleaned
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const sentences = rawSentences.length > 0 ? rawSentences : [cleaned];

    return sentences.map((sentence, sIdx) => {
      // Split each sentence into phrase beats using commas, semicolons, conjunctions
      const phrases = sentence
        .split(/(?<=[,;])\s+|\s+(?=and\s+|but\s+|while\s+|as\s+|when\s+|strapped\s+to\s+)/i)
        .map((p) => p.trim())
        .filter(Boolean);

      const beatPhrases = phrases.length > 0 ? phrases : [sentence];

      return {
        id: `scene-${Date.now()}-${sIdx}`,
        sceneIndex: sIdx + 1,
        narratorLine: sentence,
        beats: beatPhrases.map((phrase, bIdx) => ({
          id: `beat-${Date.now()}-${sIdx}-${bIdx}`,
          textSpan: phrase,
          userGuidance: '',
          shotType: bIdx === 0 ? 'Wide Shot' : bIdx === 1 ? 'Medium Shot' : 'Close-Up',
        })),
      };
    });
  };

  const handleToggleBeatMode = (mode: 'automatic' | 'custom') => {
    setBeatMode(mode);
    if (mode === 'custom') {
      if (story.trim()) {
        setCustomScenes(partitionStoryIntoScenes(story));
      }
    } else {
      if (customScenes.length > 0) {
        const reconstructed = customScenes
          .map((s) => s.narratorLine || s.beats.map((b) => b.textSpan).join(' '))
          .filter(Boolean)
          .join(' ');
        if (reconstructed.trim()) {
          setStory(reconstructed.trim());
        }
      }
    }
  };

  const syncStoryFromCustomScenes = (scenes: CustomSceneDefinition[]) => {
    const text = scenes
      .map((s) => s.beats.map((b) => b.textSpan.trim()).filter(Boolean).join(' '))
      .filter(Boolean)
      .join(' ');
    if (text) {
      setStory(text);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!story.trim() || isLoading) return;

    if (!apiKey || !apiKey.trim()) {
      setShowAdvanced(true);
      setFormValidationNotice('Please provide and apply your Gemini API key in the Model Options panel below before generating a breakdown.');
      return;
    }

    setFormValidationNotice(null);

    let durationMode: 'automatic' | 'preset' | 'custom' = 'automatic';
    let durationSeconds: number | undefined;
    let targetVideoDuration: number | undefined;

    if (generationMode === 'video') {
      if (videoDurationValue === 'custom') {
        const num = parseFloat(customVideoSeconds);
        targetVideoDuration = num && num > 0 ? Math.round(num) : 5;
      } else {
        targetVideoDuration = parseInt(videoDurationValue, 10) || 5;
      }
      durationMode = 'preset';
      durationSeconds = targetVideoDuration;
    } else {
      if (durationValue === 'automatic') {
        durationMode = 'automatic';
      } else if (durationValue === 'custom') {
        durationMode = 'custom';
        const num = parseFloat(customNumeric);
        if (num && num > 0) {
          durationSeconds = format === 'long' ? Math.round(num * 60) : Math.round(num);
        }
      } else {
        durationMode = 'preset';
        durationSeconds = parseInt(durationValue, 10);
      }
    }

    // Extract manual parenthetical beats (e.g. She fell (beat 1) two miles (beat 2)...)
    let parsedCustomScenes: CustomSceneDefinition[] | undefined = undefined;
    const inlineMatches = story.match(/\((?:beat\s*)?\d+\)|\[(?:beat\s*)?\d+\]/gi);

    if (beatMode === 'custom' || (inlineMatches && inlineMatches.length > 0)) {
      const tokens = story.split(/(\((?:beat\s*)?\d+\)|\[(?:beat\s*)?\d+\])/gi);
      const parsedBeats: { text: string; beatIndex: number }[] = [];
      let currentText = '';
      let markerCount = 1;

      for (const token of tokens) {
        const match = token.match(/\((?:beat\s*)?(\d+)\)|\[(?:beat\s*)?(\d+)\]/i);
        if (match) {
          const beatNum = parseInt(match[1] || match[2] || String(markerCount), 10);
          if (currentText.trim()) {
            parsedBeats.push({ text: currentText.trim(), beatIndex: beatNum });
            currentText = '';
          }
          markerCount++;
        } else {
          currentText += token;
        }
      }
      if (currentText.trim()) {
        parsedBeats.push({ text: currentText.trim(), beatIndex: markerCount });
      }

      if (parsedBeats.length > 0) {
        parsedCustomScenes = [
          {
            id: 'scene-1',
            sceneIndex: 1,
            narratorLine: story.replace(/\((?:beat\s*)?\d+\)|\[(?:beat\s*)?\d+\]/gi, '').replace(/\s+/g, ' ').trim(),
            beats: parsedBeats.map((pb, idx) => ({
              id: `beat-${idx + 1}`,
              textSpan: pb.text,
              shotType: idx === 0 ? 'Establishing Shot' : idx % 2 === 0 ? 'Close-Up' : 'Medium Shot',
              userGuidance: `Camera shot dedicated exclusively to this clause: "${pb.text}"`,
            })),
          },
        ];
      }
    }

    const effectiveBeatMode = parsedCustomScenes ? 'custom' : beatMode;

    onSubmit({
      story: story.trim(),
      characterStyle: characterStyle.trim(),
      format,
      platform,
      durationMode,
      durationSeconds,
      modelQuality,
      generationMode,
      targetVideoDuration,
      beatMode: effectiveBeatMode,
      customScenes: parsedCustomScenes,
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Intro header centered */}
      <div className="mb-6 sm:mb-8 text-center px-1">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-normal font-display tracking-tight text-white mb-2.5 sm:mb-3 leading-tight" style={{ fontSize: 'clamp(1.85rem, 5.5vw, 3.35rem)' }}>
          {generationMode === 'video' ? 'Story to Video Prompt & Production Script Generator' : 'Story to Image Prompt and Narrator Script Generator'}
        </h1>
        <p className="text-sm sm:text-base md:text-lg text-[#9C9C96] leading-relaxed max-w-3xl mx-auto font-narrative">
          {generationMode === 'video'
            ? 'Convert any narrative idea into a scene by scene video generation plan. Receive structured 8-part video prompts with temporal actions, continuity anchors, and pacing beat analysis.'
            : 'Convert any narrative idea into a scene by scene production plan. Receive precise visual prompts formatted for your chosen platform alongside a complete, copyable narrator script.'}
        </p>
      </div>

      {formValidationNotice && (
        <div
          id="validation-alert-banner"
          className="mb-6 p-4 bg-[#18140B] border border-amber-800/80 text-amber-200 flex items-start space-x-3"
          role="alert"
        >
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm leading-relaxed">
            <p className="font-semibold mb-0.5 text-white font-display">Gemini API Key Required (BYOK)</p>
            <p className="text-amber-200/90 font-narrative">{formValidationNotice}</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div
          id="error-alert-banner"
          className="mb-8 p-4 bg-[#181111] border border-red-900/60 text-white flex items-start space-x-3"
          role="alert"
        >
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm leading-relaxed">
            <p className="font-semibold mb-0.5 font-display">Generation Error</p>
            <p className="text-[#F5F5F0] font-narrative">{errorMessage}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} id="story-generator-form" className="space-y-6 sm:space-y-8 font-narrative">
        {/* Prominent Mode Toggle: Text to Image vs Text to Video */}
        <div className="bg-[#121211] border border-white/15 p-2.5 sm:p-3 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-2 border-b border-white/10 pb-2.5 sm:pb-2">
            <div className="text-center sm:text-left">
              <span className="font-editorial-meta text-[10px] sm:text-[11px] text-[#C4C4C0] font-semibold block">
                GENERATION MODE
              </span>
            </div>

            <div
              id="mode-toggle-group"
              className="flex p-1 bg-[#0A0A09] border border-white/15 w-full sm:w-auto self-center sm:self-auto min-w-[280px] max-w-sm sm:max-w-none mx-auto sm:mx-0"
              role="tablist"
              aria-label="Story Generation Mode"
            >
              <button
                type="button"
                id="mode-image-btn"
                role="tab"
                aria-selected={generationMode === 'image'}
                onClick={() => setGenerationMode('image')}
                disabled={isLoading}
                className={`flex-1 px-3 py-1.5 sm:py-2 text-xs transition-all font-display flex items-center justify-center space-x-1.5 whitespace-nowrap min-h-[34px] ${
                  generationMode === 'image'
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-[#9C9C96] hover:text-white'
                }`}
              >
                <Camera size={13} className="shrink-0" />
                <span>Text to Image</span>
              </button>
              <button
                type="button"
                id="mode-video-btn"
                role="tab"
                aria-selected={generationMode === 'video'}
                onClick={() => setGenerationMode('video')}
                disabled={isLoading}
                className={`flex-1 px-3 py-1.5 sm:py-2 text-xs transition-all font-display flex items-center justify-center space-x-1.5 whitespace-nowrap min-h-[34px] ${
                  generationMode === 'video'
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-[#9C9C96] hover:text-white'
                }`}
              >
                <Video size={13} className="shrink-0" />
                <span>Text to Video</span>
              </button>
            </div>
          </div>
        </div>

        {/* Story Textarea Container */}
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="story-input-box"
              className="block font-editorial-meta text-[10px] sm:text-[11px] text-[#9C9C96]"
            >
              STORY IDEA
            </label>

            <div className="flex items-center space-x-2">
              <span className="font-editorial-meta text-[9px] sm:text-[10px] text-[#7D7D76]">
                {story.trim().split(/\s+/).filter(Boolean).length} WORDS
              </span>
              <button
                type="button"
                id="random-story-dice-btn"
                onClick={handlePickRandomStory}
                disabled={isLoading}
                title="Roll for a random story idea"
                aria-label="Pick random story idea"
                className="p-1 sm:p-1.5 bg-[#1C1C1A] hover:bg-[#282826] active:bg-[#333330] text-[#9C9C96] hover:text-white border border-white/15 transition-all shadow-sm group focus:outline-none focus:ring-1 focus:ring-white"
              >
                <Dices size={13} className="transition-transform duration-300 group-hover:rotate-45" />
              </button>
            </div>
          </div>

          {/* Exact, single Story Idea textarea with (beat 1), (beat 2) parenthetical syntax */}
          <div className="relative">
            <textarea
              id="story-input-box"
              rows={6}
              value={story}
              onChange={(e) => setStory(e.target.value)}
              disabled={isLoading}
              placeholder={
                beatMode === 'custom'
                  ? 'e.g. She fell (beat 1) two miles through open air (beat 2), strapped to three airplane seats, and survived (beat 3).'
                  : 'Type your story, synopsis, or sequence of events here. Describe what happens from beginning to end.'
              }
              className={`w-full p-3 sm:p-4 bg-[#121211] hover:bg-[#161614] focus:bg-[#121211] text-[#F5F5F0] placeholder:text-[#666660] border transition-colors focus:outline-none text-sm sm:text-base leading-relaxed resize-y story-textarea-scroll ${
                beatMode === 'custom' ? 'border-amber-400/50 focus:border-amber-400' : 'border-white/10 focus:border-white'
              }`}
              required
            />
          </div>

          {beatMode === 'custom' && (
            <div className="text-[11px] text-amber-300/90 flex flex-wrap items-center justify-between gap-1 px-1 py-1 bg-[#18160E] border border-amber-400/20">
              <span>
                Manual Beats: place <strong>(beat 1)</strong>, <strong>(beat 2)</strong>, <strong>(beat 3)</strong> right after each line or phrase.
              </span>
              <span className="font-mono text-amber-400 font-semibold">
                {(story.match(/\((?:beat\s*)?\d+\)|\[(?:beat\s*)?\d+\]/gi) || []).length} beats detected
              </span>
            </div>
          )}
        </div>

        {/* Character Style Input Box */}
        <div className="space-y-1.5 sm:space-y-2">
          <label
            htmlFor="character-prompt-input"
            className="block font-editorial-meta text-[10px] sm:text-[11px] text-[#9C9C96]"
          >
            CHARACTER STYLE DESCRIPTOR
          </label>
          <input
            type="text"
            id="character-prompt-input"
            value={characterStyle}
            onChange={(e) => setCharacterStyle(e.target.value)}
            disabled={isLoading}
            placeholder="e.g. cinematic hyperrealism, 90s anime cel animation, stop-motion felt, textured oil painting..."
            className="w-full px-3.5 sm:px-4 py-2 sm:py-3 bg-[#121211] hover:bg-[#161614] focus:bg-[#121211] text-[#F5F5F0] placeholder:text-[#666660] border border-white/10 transition-colors focus:outline-none focus:border-white text-sm sm:text-base"
          />
        </div>

        {/* Format, Distribution Platform, Target Duration, and Beat Pacing Controls */}
        <div className="space-y-3">
          {/* Aspect Ratio Format Full Width or Responsive Grid */}
          <div className="space-y-1.5 sm:space-y-2">
            <span className="block font-editorial-meta text-[10px] sm:text-[11px] text-[#9C9C96]">
              ASPECT RATIO FORMAT
            </span>
            <div
              id="format-toggle-group"
              className="w-full flex p-1 bg-[#121211] border border-white/10 h-[42px] sm:h-[46px] items-center"
              role="group"
              aria-label="Aspect ratio format selection"
            >
              <button
                type="button"
                id="format-short-btn"
                disabled={isLoading}
                onClick={() => handleFormatChange('short')}
                className={`flex-1 h-full px-2 sm:px-3 text-xs sm:text-sm transition-all font-display text-center whitespace-nowrap flex items-center justify-center ${
                  format === 'short'
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-[#9C9C96] hover:text-white'
                }`}
              >
                Short form (9:16)
              </button>
              <button
                type="button"
                id="format-long-btn"
                disabled={isLoading}
                onClick={() => handleFormatChange('long')}
                className={`flex-1 h-full px-2 sm:px-3 text-xs sm:text-sm transition-all font-display text-center whitespace-nowrap flex items-center justify-center ${
                  format === 'long'
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-[#9C9C96] hover:text-white'
                }`}
              >
                Long form (16:9)
              </button>
            </div>
          </div>

          {/* Responsive row: Distribution Platform | Target Duration | Automatic / Manual Beats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 items-start">
            {/* 1. Distribution Platform */}
            <div className="col-span-1">
              <CustomDropdown
                id="platform-select"
                label="Distribution Platform"
                options={format === 'short' ? SHORT_PLATFORMS : LONG_PLATFORMS}
                selectedValue={platform}
                onSelect={setPlatform}
                disabled={isLoading}
              />
            </div>

            {/* 2. Target / Clip Duration */}
            <div className="col-span-1 space-y-1.5 sm:space-y-2">
              {generationMode === 'video' ? (
                <>
                  <CustomDropdown
                    id="video-duration-select"
                    label="Clip Duration"
                    options={VIDEO_DURATIONS}
                    selectedValue={videoDurationValue}
                    onSelect={setVideoDurationValue}
                    disabled={isLoading}
                  />

                  {videoDurationValue === 'custom' && (
                    <div className="pt-1.5 sm:pt-2">
                      <label
                        htmlFor="custom-video-numeric-input"
                        className="block font-editorial-meta text-[10px] sm:text-[11px] text-[#9C9C96] mb-1.5"
                      >
                        CUSTOM CLIP DURATION (3 - 60 SECONDS)
                      </label>
                      <input
                        type="number"
                        min="3"
                        max="60"
                        id="custom-video-numeric-input"
                        value={customVideoSeconds}
                        onChange={(e) => setCustomVideoSeconds(e.target.value)}
                        disabled={isLoading}
                        placeholder="e.g. 8"
                        className="w-full px-3 sm:px-4 h-[42px] sm:h-[46px] bg-[#121211] text-[#F5F5F0] placeholder:text-[#666660] border border-white/10 focus:border-white rounded-[2px] focus:outline-none text-xs sm:text-sm font-mono transition-colors"
                        required
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <CustomDropdown
                    id="duration-select"
                    label="Target Duration"
                    options={format === 'short' ? SHORT_DURATIONS : LONG_DURATIONS}
                    selectedValue={durationValue}
                    onSelect={setDurationValue}
                    disabled={isLoading}
                  />

                  {durationValue === 'custom' && (
                    <div className="pt-1.5 sm:pt-2">
                      <label
                        htmlFor="custom-numeric-input"
                        className="block font-editorial-meta text-[10px] sm:text-[11px] text-[#9C9C96] mb-1.5"
                      >
                        {format === 'long' ? 'CUSTOM MINUTES (1 - 120)' : 'CUSTOM SECONDS (5 - 600)'}
                      </label>
                      <input
                        type="number"
                        min="5"
                        max={format === 'long' ? '120' : '600'}
                        id="custom-numeric-input"
                        value={customNumeric}
                        onChange={(e) => setCustomNumeric(e.target.value)}
                        disabled={isLoading}
                        placeholder={format === 'long' ? 'e.g. 7' : 'e.g. 35'}
                        className="w-full px-3 sm:px-4 h-[42px] sm:h-[46px] bg-[#121211] text-[#F5F5F0] placeholder:text-[#666660] border border-white/10 focus:border-white rounded-[2px] focus:outline-none text-xs sm:text-sm font-mono transition-colors"
                        required
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 3. Automatic vs Manual Beats (Right side of Target Duration) */}
            <div className="col-span-1 space-y-1.5 sm:space-y-2">
              <span className="block font-editorial-meta text-[10px] sm:text-[11px] text-[#9C9C96]">
                BEAT PACING MODE
              </span>
              <div
                id="beat-mode-toggle-group"
                className="w-full flex p-1 bg-[#121211] border border-white/10 h-[42px] sm:h-[46px] items-center"
                role="group"
                aria-label="Beat pacing mode selection"
              >
                <button
                  type="button"
                  id="beat-mode-auto-btn"
                  disabled={isLoading}
                  onClick={() => handleToggleBeatMode('automatic')}
                  className={`flex-1 h-full px-2 sm:px-3 text-xs sm:text-sm transition-all font-display text-center whitespace-nowrap flex items-center justify-center ${
                    beatMode === 'automatic'
                      ? 'bg-white text-black font-semibold shadow-sm'
                      : 'text-[#9C9C96] hover:text-white'
                  }`}
                >
                  Automatic
                </button>
                <button
                  type="button"
                  id="beat-mode-custom-btn"
                  disabled={isLoading}
                  onClick={() => handleToggleBeatMode('custom')}
                  className={`flex-1 h-full px-2 sm:px-3 text-xs sm:text-sm transition-all font-display text-center whitespace-nowrap flex items-center justify-center space-x-1.5 ${
                    beatMode === 'custom'
                      ? 'bg-amber-400 text-black font-semibold shadow-sm'
                      : 'text-[#9C9C96] hover:text-white'
                  }`}
                >
                  <Scissors size={12} className={beatMode === 'custom' ? 'text-black' : 'text-amber-400'} />
                  <span>Manual Beats</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Generate Button with progressive illumination bar */}
        <div className="pt-1 sm:pt-2 flex flex-col items-center justify-center">
          <button
            type="submit"
            id="generate-scenes-button"
            disabled={isLoading || !story.trim()}
            className={`relative w-full sm:w-auto min-w-[260px] sm:min-w-[340px] min-h-[44px] sm:min-h-[48px] font-display text-sm sm:text-base font-medium tracking-tight rounded-[2px] transition-all flex items-center justify-center overflow-hidden shadow-lg ${
              isLoading
                ? 'p-0 bg-[#141413] border border-white/25 cursor-wait shadow-[0_0_30px_rgba(0,0,0,0.85)]'
                : 'px-6 sm:px-10 py-2.5 sm:py-3.5 bg-white text-black hover:bg-[#EAEAE6] active:bg-[#D4D4D0] disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-xl'
            }`}
          >
            {isLoading ? (
              <>
                {/* 1. Base Dim Layer: dark obsidian background with crisp pure white text */}
                <div className="w-full min-h-[44px] sm:min-h-[48px] px-6 sm:px-10 py-2.5 sm:py-3.5 flex items-center justify-center space-x-2.5 text-white select-none">
                  <RefreshCw size={15} className="animate-spin text-white/80 shrink-0" />
                  <span className="font-display text-xs sm:text-sm font-medium tracking-tight text-white">
                    Generating {generationMode === 'video' ? 'Video' : 'Storyboard'} Breakdown...
                  </span>
                </div>

                {/* 2. Light Progress Fill Layer: bright white illumination with crisp black text clipped to progress */}
                <div
                  className="absolute inset-0 bg-white text-black flex items-center justify-center space-x-2.5 px-6 sm:px-10 py-2.5 sm:py-3.5 select-none pointer-events-none z-10"
                  style={{ clipPath: `inset(0 ${Math.max(0, 100 - progress)}% 0 0)` }}
                >
                  <RefreshCw size={15} className="animate-spin text-black shrink-0" />
                  <span className="font-display text-xs sm:text-sm font-bold tracking-tight text-black">
                    Generating {generationMode === 'video' ? 'Video' : 'Storyboard'} Breakdown...
                  </span>
                </div>

                {/* 3. Luminous Animated Leading Edge with Traveling Light Wave & Forward Flare */}
                {progress > 0.5 && progress < 99.5 && (
                  <>
                    {/* Primary pulsating vertical laser beam */}
                    <div
                      className="absolute top-0 bottom-0 w-[2.5px] bg-white animate-edge-beam pointer-events-none z-20"
                      style={{ left: `${progress}%` }}
                    >
                      {/* Vertical traveling light photon pulse scanning down the edge */}
                      <div className="absolute left-[-2px] right-[-2px] h-6 bg-gradient-to-b from-transparent via-white to-transparent shadow-[0_0_12px_4px_rgba(255,255,255,1)] animate-beam-scan pointer-events-none" />

                      {/* Top & bottom precision micro-points */}
                      <div className="absolute top-0 left-[-1.5px] w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white] pointer-events-none" />
                      <div className="absolute bottom-0 left-[-1.5px] w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white] pointer-events-none" />
                    </div>

                    {/* Forward-facing ambient projector flare casting into unlit dark area */}
                    <div
                      className="absolute top-0 bottom-0 w-8 bg-gradient-to-r from-white/30 via-white/10 to-transparent animate-forward-light pointer-events-none z-15"
                      style={{ left: `${progress}%` }}
                    />

                    {/* Subtle trailing light tail */}
                    <div
                      className="absolute top-0 bottom-0 w-4 -ml-4 bg-gradient-to-r from-transparent to-white/20 pointer-events-none z-15"
                      style={{ left: `${progress}%` }}
                    />
                  </>
                )}
              </>
            ) : (
              <span>{generationMode === 'video' ? 'Generate Video Breakdown' : 'Generate Breakdown'}</span>
            )}
          </button>

          {/* Real-time generation phase indicator while loading */}
          {isLoading && (
            <div className="mt-2.5 flex items-center justify-center space-x-2 text-[11px] font-editorial-meta text-[#A0A09A] tracking-wider animate-in fade-in duration-300">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0 shadow-[0_0_6px_white]" />
              <span className="truncate max-w-[300px] sm:max-w-none">{progressPhase}</span>
            </div>
          )}
        </div>

        {/* Configure Model Options Toggle */}
        <div className="pt-1 flex flex-col items-center">
          <button
            type="button"
            id="toggle-advanced-btn"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="inline-flex items-center justify-center font-editorial-meta text-[10px] sm:text-[11px] text-[#9C9C96] hover:text-white transition-colors min-h-[36px] sm:min-h-[40px] px-3 tracking-wider"
          >
            <Sliders size={13} className="mr-1.5 text-[#7D7D76] sm:w-3.5 sm:h-3.5" />
            {showAdvanced ? 'HIDE MODEL & API OPTIONS' : 'CONFIGURE MODEL & API OPTIONS'}
          </button>

          {showAdvanced && (
            <div className="mt-2 w-full p-4 sm:p-6 bg-[#121211] border border-white/10 corner-bracket-container shadow-2xl rounded-[2px] space-y-5 text-left animate-in fade-in duration-200">
              {/* Gemini Model Tier */}
              <div className="space-y-2">
                <span className="block font-editorial-meta text-[10px] sm:text-[11px] text-[#9C9C96]">
                  GEMINI MODEL SELECTION
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  <button
                    type="button"
                    id="model-standard-tier"
                    onClick={() => setModelQuality('standard')}
                    className={`p-3 sm:p-3.5 text-left border rounded-[2px] transition-all ${
                      modelQuality === 'standard'
                        ? 'border-white bg-[#1F1F1D] text-white shadow-sm'
                        : 'border-white/10 bg-[#161614] text-[#9C9C96] hover:border-white/30 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-display text-xs sm:text-sm font-medium text-white">Standard (Gemini 3.8 Flash)</p>
                      {modelQuality === 'standard' && <span className="stamp-chip bg-white text-black font-bold text-[8px]">ACTIVE</span>}
                    </div>
                    <p className="text-[11px] sm:text-xs text-[#9C9C96] mt-1 font-narrative leading-relaxed">
                      Recommended: High-speed inference and precise narrative scene-to-beat partitioning.
                    </p>
                  </button>

                  <button
                    type="button"
                    id="model-high-tier"
                    onClick={() => setModelQuality('high')}
                    className={`p-3 sm:p-3.5 text-left border rounded-[2px] transition-all ${
                      modelQuality === 'high'
                        ? 'border-white bg-[#1F1F1D] text-white shadow-sm'
                        : 'border-white/10 bg-[#161614] text-[#9C9C96] hover:border-white/30 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-display text-xs sm:text-sm font-medium text-white">Pro Quality (Gemini 3.1 Pro)</p>
                      {modelQuality === 'high' && <span className="stamp-chip bg-white text-black font-bold text-[8px]">ACTIVE</span>}
                    </div>
                    <p className="text-[11px] sm:text-xs text-[#9C9C96] mt-1 font-narrative leading-relaxed">
                      Deep cinematic reasoning for complex narratives and intricate character style sheets.
                    </p>
                  </button>
                </div>
              </div>

              {/* Bring Your Own Key (BYOK) Section */}
              <div className="space-y-3 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <KeyRound size={13} className="text-[#9C9C96]" />
                    <span className="font-editorial-meta text-[10px] sm:text-[11px] text-[#9C9C96]">
                      GEMINI API KEY (BYOK)
                    </span>
                  </div>
                  {hasCustomKey && (
                    <span className="inline-flex items-center text-[10px] text-emerald-400 font-editorial-meta font-medium">
                      <CheckCircle2 size={11} className="mr-1" />
                      KEY ACTIVE
                    </span>
                  )}
                </div>

                <div className="space-y-2.5">
                  <div className="relative">
                    <input
                      type={showKeyText ? 'text' : 'password'}
                      id="gemini-api-key-input"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full pl-3.5 pr-20 py-2.5 bg-[#0A0A09] text-[#F5F5F0] placeholder:text-[#555550] border border-white/15 rounded-[2px] focus:outline-none focus:border-white text-xs sm:text-sm font-mono"
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                      <button
                        type="button"
                        id="toggle-key-visibility-btn"
                        onClick={() => setShowKeyText(!showKeyText)}
                        className="p-1.5 text-[#888884] hover:text-white transition-colors"
                        title={showKeyText ? 'Hide API key' : 'Show API key'}
                        aria-label="Toggle API key visibility"
                      >
                        {showKeyText ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2.5 pt-0.5">
                    <label className="flex items-center space-x-2 text-[11px] sm:text-xs text-[#9C9C96] cursor-pointer select-none font-narrative">
                      <input
                        type="checkbox"
                        id="remember-key-checkbox"
                        checked={rememberOptIn}
                        onChange={(e) => setRememberOptIn(e.target.checked)}
                        className="rounded-[2px] border-white/20 bg-[#121211] text-white focus:ring-0 focus:ring-offset-0"
                      />
                      <span>Remember in this browser session (sessionStorage)</span>
                    </label>

                    <div className="flex items-center space-x-2">
                      {hasCustomKey && (
                        <button
                          type="button"
                          id="clear-key-button"
                          onClick={handleClearKey}
                          className="inline-flex items-center font-editorial-meta text-[10px] text-red-400 hover:text-red-300 transition-colors py-1 px-2"
                        >
                          <Trash2 size={11} className="mr-1" />
                          REMOVE
                        </button>
                      )}
                      <button
                        type="button"
                        id="apply-key-button"
                        onClick={handleApplyKey}
                        className="inline-flex items-center font-editorial-meta text-[10px] sm:text-[11px] px-3.5 py-1.5 bg-white text-black font-semibold hover:bg-[#EAEAE6] transition-colors rounded-[2px]"
                      >
                        APPLY KEY
                      </button>
                    </div>
                  </div>

                  {keyFeedback && (
                    <p className="text-[11px] text-emerald-400 font-narrative mt-1 animate-in fade-in duration-150">
                      {keyFeedback}
                    </p>
                  )}

                  <div className="p-3 bg-[#171715] border border-white/10 rounded-[2px] text-xs text-[#9C9C96] space-y-1 font-narrative">
                    <div className="flex items-center space-x-1.5 text-white font-medium">
                      <Shield size={12} className="text-emerald-400" />
                      <span className="font-editorial-meta text-[10px]">DIRECT BROWSER-TO-GOOGLE ARCHITECTURE</span>
                    </div>
                    <p className="leading-relaxed">
                      Your Gemini API key is kept exclusively within your local browser memory and used directly for Google Generative AI queries. Keys are never transmitted to or logged on third-party servers.
                    </p>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-white hover:underline underline-offset-2 pt-0.5 font-editorial-meta text-[10px]"
                    >
                      GET A FREE GEMINI API KEY AT GOOGLE AI STUDIO &rarr;
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </form>

      {/* BYOK Security & Consent Modal */}
      <KeyConsentModal
        isOpen={isConsentModalOpen}
        onClose={() => setIsConsentModalOpen(false)}
        onConfirm={handleConfirmConsent}
        pendingKeyPrefix={keyInput.trim().slice(0, 8)}
      />
    </div>
  );
}
