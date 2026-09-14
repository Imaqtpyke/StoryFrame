import { useState, FormEvent, MouseEvent, useEffect } from 'react';
import CustomDropdown, { DropdownOption } from './CustomDropdown';
import KeyConsentModal from './KeyConsentModal';
import { useApiKey } from '../context/ApiKeyContext';
import { StoryFormat, GenerateStoryRequest, GenerationMode } from '../types';
import { Sliders, RefreshCw, AlertCircle, Dices, Eye, EyeOff, KeyRound, Trash2, CheckCircle2, Shield, Camera, Video, Sparkles } from 'lucide-react';

interface GeneratorFormProps {
  onSubmit: (data: GenerateStoryRequest) => void;
  isLoading: boolean;
  errorMessage: string | null;
}

interface RandomStoryPreset {
  story: string;
  characterStyle: string;
}

const RANDOM_STORIES: RandomStoryPreset[] = [
  {
    story: "A lonely clockmaker discovers an ancient mechanical pocket watch that ticks backward, rewinding the room around him by thirty seconds whenever he presses the winding crown.",
    characterStyle: "Tactile stop-motion felt animation, dense wool textures, miniature studio lighting",
  },
  {
    story: "Two deep-sea marine biologists in a research submersible encounter an illuminated underwater metropolis buried inside the Mariana Trench that responds to sonar pulses with musical harmonics.",
    characterStyle: "Holographic glitch-glass, prismatic transparent sculptures, chromatic aberration",
  },
  {
    story: "A ramen chef operates a midnight street stall at a forgotten Tokyo crossroads that only spirits and wandering ghosts can see, serving warm broth that restores mortal memories.",
    characterStyle: "Celluloid Noir, high-contrast B&W ink, single hyper-saturated glowing accents",
  },
  {
    story: "An archivist in a grand subterranean library unearths an unwritten leather tome whose ink forms words only when illuminated by starlight, revealing the secret history of an extinct solar system.",
    characterStyle: "Porcelain and Kintsugi 3D render, smooth white ceramic, glowing gold filled cracks",
  },
  {
    story: "A solo astronaut stranded on a terraformed greenhouse asteroid tends to an alien bioluminescent flora that produces breathable oxygen and whispers echoes of Earth's radio broadcasts.",
    characterStyle: "Retro-futuristic risograph print, visible halftone dots, offset registration",
  },
  {
    story: "A young street photographer in 1980s Neo-Seoul develops black-and-white film that unexpectedly captures future headlines ten minutes before they happen.",
    characterStyle: "Gritty 90s anime VHS aesthetic, scanlines, hand-drawn cel animation style",
  },
  {
    story: "A silent desert nomad guides a caravan of solar-powered mechanical beasts across an endless dune sea, seeking an oasis made entirely of crystallized mirrors.",
    characterStyle: "Textured oil painting in motion, thick impasto brushstrokes, golden hour lighting",
  },
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
    const available = RANDOM_STORIES.filter((s) => s.story !== story);
    const pool = available.length > 0 ? available : RANDOM_STORIES;
    const randomPreset = pool[Math.floor(Math.random() * pool.length)];
    if (randomPreset) {
      setStory(randomPreset.story);
      setCharacterStyle(randomPreset.characterStyle);
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
            <span className="font-editorial-meta text-[9px] sm:text-[10px] text-[#7D7D76]">
              {story.trim().split(/\s+/).filter(Boolean).length} WORDS
            </span>
          </div>

          <div className="relative">
            <textarea
              id="story-input-box"
              rows={6}
              value={story}
              onChange={(e) => setStory(e.target.value)}
              disabled={isLoading}
              placeholder="Type your story, synopsis, or sequence of events here. Describe what happens from beginning to end."
              className="w-full p-3 sm:p-4 pb-10 sm:pb-10 bg-[#121211] hover:bg-[#161614] focus:bg-[#121211] text-[#F5F5F0] placeholder:text-[#666660] border border-white/10 transition-colors focus:outline-none focus:border-white text-sm sm:text-base leading-relaxed resize-y story-textarea-scroll"
              required
            />

            {/* Random story dice button positioned at bottom right of the container */}
            <div className="absolute right-2.5 bottom-3 flex items-center z-10">
              <button
                type="button"
                id="random-story-dice-btn"
                onClick={handlePickRandomStory}
                disabled={isLoading}
                title="Roll for a random story idea"
                aria-label="Pick random story idea"
                className="p-1 sm:p-1.5 bg-[#1C1C1A] hover:bg-[#282826] active:bg-[#333330] text-[#9C9C96] hover:text-white border border-white/15 transition-all shadow-sm group focus:outline-none focus:ring-1 focus:ring-white"
              >
                <Dices size={14} className="transition-transform duration-300 group-hover:rotate-45 sm:w-[15px] sm:h-[15px]" />
              </button>
            </div>
          </div>
        </div>

        {/* Character Prompt Box & DNA Carousel */}
        <div className="space-y-1.5 sm:space-y-2">
          <label
            htmlFor="character-prompt-input"
            className="block font-editorial-meta text-[10px] sm:text-[11px] text-[#9C9C96]"
          >
            CHARACTER STYLE DNA
          </label>
          <input
            type="text"
            id="character-prompt-input"
            value={characterStyle}
            onChange={(e) => setCharacterStyle(e.target.value)}
            disabled={isLoading}
            placeholder="e.g. realistic human, anime, or select a DNA strand below..."
            className="w-full px-3.5 sm:px-4 py-2 sm:py-3 bg-[#121211] hover:bg-[#161614] focus:bg-[#121211] text-[#F5F5F0] placeholder:text-[#666660] border border-white/10 transition-colors focus:outline-none focus:border-white text-sm sm:text-base"
          />

          {/* Horizontally Scrolling DNA Carousel */}
          <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide snap-x">
            {RANDOM_STORIES.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCharacterStyle(preset.characterStyle)}
                className="snap-start shrink-0 whitespace-nowrap px-3 py-1.5 bg-[#1C1C1A] hover:bg-[#282826] active:bg-[#333330] text-[#D4D4D0] hover:text-white border border-white/10 text-[10px] sm:text-xs font-editorial-meta transition-all flex items-center gap-1.5"
                title={preset.characterStyle}
              >
                <span className="text-emerald-400">🧬</span>
                <span className="truncate max-w-[120px] sm:max-w-[160px]">
                  {preset.characterStyle.split(',')[0]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Aspect Ratio Format, Distribution Platform & Target/Clip Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-5 items-start">
          {/* Format Toggle */}
          <div className="sm:col-span-2 md:col-span-1 space-y-1.5 sm:space-y-2">
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

          {/* Platform Dropdown */}
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

          {/* Duration Selector: Dynamic based on Generation Mode */}
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
        </div>

        {/* Generate Button: Primary scale ~38-42px mobile, ~46-48px desktop */}
        <div className="pt-1 sm:pt-2 flex justify-center">
          <button
            type="submit"
            id="generate-scenes-button"
            disabled={isLoading || !story.trim()}
            className="w-full sm:w-auto px-6 sm:px-10 py-2.5 sm:py-3.5 min-h-[42px] sm:min-h-[48px] bg-white text-black hover:bg-[#EAEAE6] active:bg-[#D4D4D0] disabled:opacity-40 disabled:cursor-not-allowed font-display text-sm sm:text-base font-medium tracking-tight rounded-[2px] transition-all flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
          >
            {isLoading ? (
              <>
                <RefreshCw size={16} className="animate-spin sm:w-[18px] sm:h-[18px]" />
                <span>Generating {generationMode === 'video' ? 'Video' : 'Storyboard'} Breakdown...</span>
              </>
            ) : (
              <span>{generationMode === 'video' ? 'Generate Video Breakdown' : 'Generate Breakdown'}</span>
            )}
          </button>
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
