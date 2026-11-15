import { useState, FormEvent, MouseEvent, useEffect } from 'react';
import CustomDropdown, { DropdownOption } from './CustomDropdown';
import { useApiKey } from '../context/ApiKeyContext';
import {
  StoryFormat,
  GenerateStoryRequest,
  GenerationMode,
  CustomSceneDefinition,
  ActivePage,
  AiProvider,
  StoryGenerationResult,
} from '../types';
import {
  Sliders,
  RefreshCw,
  AlertCircle,
  Dices,
  Eye,
  EyeOff,
  KeyRound,
  Trash2,
  CheckCircle2,
  Shield,
  Camera,
  Video,
  Sparkles,
  Scissors,
  ShieldCheck,
  Zap,
  Film,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { parseManuscriptMarkdown } from '../services/scriptParser';

interface GeneratorFormProps {
  onSubmit: (data: GenerateStoryRequest) => void;
  isLoading: boolean;
  errorMessage: string | null;
  onNavigate?: (page: ActivePage) => void;
  initialValues?: GenerateStoryRequest | null;
  openModelOptionsTrigger?: number;
  onDirectResult?: (result: StoryGenerationResult, request: GenerateStoryRequest) => void;
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
  { value: '4', label: '4 seconds', sublabel: 'Fast cut short-form clip' },
  { value: '5', label: '5 seconds', sublabel: 'Kling / Runway / Luma standard' },
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

const AI_PROVIDER_OPTIONS: DropdownOption[] = [
  {
    value: 'gemini',
    label: 'Google Gemini',
    badge: 'Standard & Pro',
    badgeColor: 'amber',
    description: 'Direct browser execution via Google Generative Language API.',
    icon: <Sparkles size={14} className="text-amber-400 shrink-0" />,
  },
  {
    value: 'groq',
    label: 'Groq Cloud',
    badge: 'Free Tier LPU',
    badgeColor: 'emerald',
    description: 'Ultra-fast inference via console.groq.com/keys with 120B and 27B models.',
    icon: <Zap size={14} className="text-emerald-400 shrink-0" />,
  },
];

const GEMINI_MODEL_OPTIONS: DropdownOption[] = [
  {
    value: 'standard',
    label: 'Gemini 4 Hydrogen',
    badge: 'Standard: Fast',
    badgeColor: 'default',
    description: 'Recommended: High-speed inference and precise narrative scene-to-beat partitioning.',
  },
  {
    value: 'high',
    label: 'Gemini 3.1 Pro Preview',
    badge: 'Pro Quality',
    badgeColor: 'amber',
    description: 'Deep cinematic reasoning for complex narratives and intricate character style sheets.',
  },
];

const GROQ_MODEL_OPTIONS: DropdownOption[] = [
  {
    value: 'openai/gpt-oss-120b',
    label: 'OpenAI GPT-OSS 120B',
    badge: 'Recommended: 120B',
    badgeColor: 'emerald',
    description: 'High-capacity 120B reasoning on Groq LPU hardware for full screenplay breakdowns.',
  },
  {
    value: 'qwen/qwen3.8-27b',
    label: 'Qwen 3.8 27B',
    badge: 'Alibaba Cloud',
    badgeColor: 'blue',
    description: 'Versatile 27B reasoning with rapid token generation and structured JSON output.',
  },
  {
    value: 'openai/gpt-oss-20b',
    label: 'OpenAI GPT-OSS 20B',
    badge: 'Ultra Fast',
    badgeColor: 'default',
    description: 'Low-latency 20B model for near-instant scene generation and rapid drafting.',
  },
  {
    value: 'custom',
    label: 'Custom Model ID...',
    badge: 'Custom',
    badgeColor: 'default',
    description: 'Manually specify any model ID from console.groq.com.',
  },
];

export default function GeneratorForm({
  onSubmit,
  isLoading,
  errorMessage,
  onNavigate,
  initialValues,
  openModelOptionsTrigger,
  onDirectResult,
}: GeneratorFormProps) {
  const {
    apiKey,
    hasCustomKey,
    rememberInSession,
    setCustomApiKey,
    clearCustomApiKey,
    modelQuality,
    setModelQuality,
    aiProvider,
    setAiProvider,
    geminiApiKey,
    groqApiKey,
    groqModel,
    setGroqModel,
  } = useApiKey();

  const [generationMode, setGenerationMode] = useState<GenerationMode>(initialValues?.generationMode || 'image');
  const [autoArchitectMode, setAutoArchitectMode] = useState<boolean>(initialValues?.autoArchitectMode || false);
  const [beatMode, setBeatMode] = useState<'automatic' | 'custom'>(initialValues?.beatMode || 'automatic');
  const [customScenes, setCustomScenes] = useState<CustomSceneDefinition[]>(initialValues?.customScenes || []);
  const [story, setStory] = useState(initialValues?.story || '');
  const [characterStyle, setCharacterStyle] = useState(initialValues?.characterStyle || '');
  const [format, setFormat] = useState<StoryFormat>(initialValues?.format || 'short');
  const [platform, setPlatform] = useState(initialValues?.platform || 'TikTok');
  const [durationValue, setDurationValue] = useState(
    initialValues?.durationMode === 'automatic'
      ? 'automatic'
      : initialValues?.durationSeconds
        ? String(initialValues.durationSeconds)
        : 'automatic'
  );
  const [videoDurationValue, setVideoDurationValue] = useState(
    initialValues?.targetVideoDuration ? String(initialValues.targetVideoDuration) : '5'
  );
  const [customNumeric, setCustomNumeric] = useState('');
  const [customVideoSeconds, setCustomVideoSeconds] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(!hasCustomKey);

  useEffect(() => {
    if (openModelOptionsTrigger && openModelOptionsTrigger > 0) {
      setShowAdvanced(true);
      setTimeout(() => {
        const el = document.getElementById('model-options-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [openModelOptionsTrigger]);

  useEffect(() => {
    if (initialValues) {
      if (initialValues.story !== undefined) setStory(initialValues.story);
      if (initialValues.characterStyle !== undefined) setCharacterStyle(initialValues.characterStyle);
      if (initialValues.format !== undefined) setFormat(initialValues.format);
      if (initialValues.platform !== undefined) setPlatform(initialValues.platform);
      if (initialValues.generationMode !== undefined) setGenerationMode(initialValues.generationMode);
      if (initialValues.autoArchitectMode !== undefined) setAutoArchitectMode(initialValues.autoArchitectMode);
      if (initialValues.beatMode !== undefined) setBeatMode(initialValues.beatMode);
      if (initialValues.customScenes !== undefined) setCustomScenes(initialValues.customScenes);
      if (initialValues.targetVideoDuration !== undefined) setVideoDurationValue(String(initialValues.targetVideoDuration));
      if (initialValues.durationMode === 'automatic') {
        setDurationValue('automatic');
      } else if (initialValues.durationSeconds) {
        setDurationValue(String(initialValues.durationSeconds));
      }
      if (initialValues.modelQuality !== undefined) setModelQuality(initialValues.modelQuality);
    }
  }, [initialValues]);

  // Bring Your Own Key (BYOK) State
  const [keyInput, setKeyInput] = useState(apiKey);
  const [showKeyText, setShowKeyText] = useState(false);
  const [rememberOptIn, setRememberOptIn] = useState(rememberInSession);
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
        const progressTarget = 96 * (1 - Math.exp(-elapsed / 4.5));
        const p = Math.min(95.8, Math.max(2, progressTarget));

        if (elapsed < 2.8) {
          setProgressPhase('Analyzing screenplay structure...');
        } else if (elapsed < 6.5) {
          setProgressPhase('Extracting character staging and locations...');
        } else if (elapsed < 11.0) {
          setProgressPhase('Directing camera angles and movement...');
        } else if (elapsed < 15.0) {
          setProgressPhase('Synthesizing visual prompts and anchors...');
        } else {
          setProgressPhase('Finalizing production storyboard...');
        }

        setProgress(p);
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
    setKeyInput(aiProvider === 'groq' ? groqApiKey : geminiApiKey);
    setRememberOptIn(rememberInSession);
  }, [aiProvider, geminiApiKey, groqApiKey, rememberInSession]);

  const isKnownGroqModel = GROQ_MODEL_OPTIONS.some((o) => o.value === groqModel && o.value !== 'custom');
  const [customGroqInput, setCustomGroqInput] = useState(isKnownGroqModel ? '' : groqModel);

  const handleSelectGroqModel = (val: string) => {
    if (val === 'custom') {
      const initial = customGroqInput.trim() || 'qwen/qwen3.8-27b';
      setCustomGroqInput(initial);
      setGroqModel(initial);
    } else {
      setGroqModel(val);
    }
  };

  const handleCustomGroqInputChange = (text: string) => {
    setCustomGroqInput(text);
    if (text.trim()) {
      setGroqModel(text.trim());
    }
  };

  const handleSwitchProvider = (newProvider: AiProvider) => {
    setAiProvider(newProvider);
    setKeyInput(newProvider === 'groq' ? groqApiKey : geminiApiKey);
    setKeyFeedback(null);
  };

  const handleApplyKey = (e: MouseEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) {
      setKeyFeedback('Please enter an API key before applying.');
      setTimeout(() => setKeyFeedback(null), 3000);
      return;
    }
    setCustomApiKey(keyInput.trim(), rememberOptIn, aiProvider);
    setKeyFeedback(
      aiProvider === 'groq'
        ? 'Groq API key applied for this session.'
        : 'Gemini API key applied for this session.'
    );
    setFormValidationNotice(null);
    setTimeout(() => setKeyFeedback(null), 4000);
  };

  const handleClearKey = (e: MouseEvent) => {
    e.preventDefault();
    clearCustomApiKey(aiProvider);
    setKeyInput('');
    setRememberOptIn(false);
    setShowKeyText(false);
    setKeyFeedback(aiProvider === 'groq' ? 'Groq key removed from session.' : 'Gemini key removed from session.');
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

    const rawSentences = cleaned
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const sentences = rawSentences.length > 0 ? rawSentences : [cleaned];

    return sentences.map((sentence, sIdx) => {
      const phrases = sentence
        .split(/(?<=[,;:])\s+|\s+(?=and\s+|but\s+|while\s+|as\s+|when\s+|because\s+|even\s+though\s+|so\s+next\s+time\s+|don't\s+just\s+ask\s+|ask\s+what\s+)/i)
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

  const isManuscriptFormat =
    /(?:###\s*Clip\s*\d+|Clip\s*\d+:)/i.test(story) &&
    /(?:\*\*Voice-over:\*\*|\*\*Visual:\*\*|Voice-over:|Visual:)/i.test(story);
  const detectedClipsCount = isManuscriptFormat
    ? (story.match(/(?:###\s*Clip\s*\d+|Clip\s*\d+:)/gi) || []).length
    : 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!story.trim() || isLoading) return;

    if (isManuscriptFormat) {
      try {
        const parsed = parseManuscriptMarkdown(story);
        if (onDirectResult) {
          const directRequest: GenerateStoryRequest = {
            story: story.trim(),
            characterStyle: characterStyle.trim() || parsed.storyResult.styleProfile.artStyle,
            format: parsed.format,
            platform,
            durationMode: 'preset',
            durationSeconds: parsed.totalDurationSeconds,
            generationMode: parsed.generationMode,
            targetVideoDuration: parsed.clips[0]?.durationSeconds || 4,
            beatMode: 'automatic',
            autoArchitectMode: false,
          };
          onDirectResult(parsed.storyResult, directRequest);
          return;
        }
      } catch (err: any) {
        setFormValidationNotice(err?.message || 'Failed to parse structured manuscript.');
        return;
      }
    }

    if (!apiKey || !apiKey.trim()) {
      setShowAdvanced(true);
      setFormValidationNotice(
        aiProvider === 'groq'
          ? 'Please enter and apply your Groq API key in the Model & API Settings panel before generating.'
          : 'Please enter and apply your Gemini API key in the Model & API Settings panel before generating.'
      );
      setTimeout(() => {
        const el = document.getElementById('model-options-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
      return;
    }

    setFormValidationNotice(null);

    let durationMode: 'automatic' | 'preset' | 'custom' = 'automatic';
    let durationSeconds: number | undefined;
    let targetVideoDuration: number | undefined;

    if (generationMode === 'video') {
      if (videoDurationValue === 'custom') {
        const num = parseFloat(customVideoSeconds);
        if (!num || isNaN(num) || num < 1 || num > 60) {
          setFormValidationNotice('Please enter a custom clip duration between 1 and 60 seconds.');
          return;
        }
        targetVideoDuration = Math.round(num);
      } else {
        targetVideoDuration = parseInt(videoDurationValue, 10) || 5;
      }
      durationMode = 'preset';
      durationSeconds = targetVideoDuration;
    } else if (!autoArchitectMode) {
      durationMode = 'automatic';
      durationSeconds = undefined;
    } else {
      if (durationValue === 'automatic') {
        durationMode = 'automatic';
      } else if (durationValue === 'custom') {
        durationMode = 'custom';
        const num = parseFloat(customNumeric);
        if (format === 'short') {
          if (!num || isNaN(num) || num < 1 || num > 600) {
            setFormValidationNotice('Please enter a custom target duration between 1 and 600 seconds.');
            return;
          }
          durationSeconds = Math.round(num);
        } else {
          if (!num || isNaN(num) || num < 1 || num > 120) {
            setFormValidationNotice('Please enter a custom target duration between 1 and 120 minutes.');
            return;
          }
          durationSeconds = Math.round(num * 60);
        }
      } else {
        durationMode = 'preset';
        durationSeconds = parseInt(durationValue, 10);
      }
    }

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

    const effectiveBeatMode = autoArchitectMode ? 'automatic' : (parsedCustomScenes ? 'custom' : beatMode);

    onSubmit({
      story: story.trim(),
      characterStyle: characterStyle.trim(),
      format,
      platform,
      durationMode,
      durationSeconds,
      aiProvider,
      modelQuality,
      groqModel,
      generationMode,
      targetVideoDuration,
      beatMode: effectiveBeatMode,
      customScenes: autoArchitectMode ? undefined : parsedCustomScenes,
      autoArchitectMode,
    });
  };

  const wordCount = story.trim().split(/\s+/).filter(Boolean).length;
  const activeModelSummary =
    aiProvider === 'groq'
      ? `Groq: ${groqModel}`
      : modelQuality === 'high'
        ? 'Gemini 3.1 Pro Preview'
        : 'Gemini 4 Hydrogen';

  return (
    <div className="w-full space-y-6 lg:space-y-8">
      {/* Compact Editorial Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-white/10">
        <div className="space-y-2 max-w-3xl">
          <h1
            className="text-2xl sm:text-3xl lg:text-4xl font-normal font-display tracking-tight text-white leading-tight"
          >
            {generationMode === 'video'
              ? 'Story to Video Prompt & Production Script Generator'
              : 'Story to Image Prompt and Narrator Script Generator'}
          </h1>
          <p className="text-sm sm:text-base text-[#9C9C96] leading-relaxed font-narrative">
            {generationMode === 'video'
              ? 'Convert any story into clip-timed video prompts with motion cues, locked characters, and narrator scripts.'
              : 'Convert any story into a scene-by-scene visual storyboard with camera framing and voiceover narration.'}
          </p>
        </div>

        {/* Generation Mode Segmented Switcher */}
        <div
          id="mode-toggle-group"
          className="inline-flex p-1 bg-[#121211] border border-white/15 rounded-[4px] w-full sm:w-auto lg:min-w-[300px] shrink-0"
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
            className={`flex-1 px-4 py-2 text-xs sm:text-sm transition-colors font-display flex items-center justify-center gap-2 whitespace-nowrap rounded-[3px] cursor-pointer ${
              generationMode === 'image'
                ? 'bg-white text-black font-semibold'
                : 'text-[#9C9C96] hover:text-white'
            }`}
          >
            <Camera size={14} className="shrink-0" />
            <span>Text to Image</span>
          </button>
          <button
            type="button"
            id="mode-video-btn"
            role="tab"
            aria-selected={generationMode === 'video'}
            onClick={() => setGenerationMode('video')}
            disabled={isLoading}
            className={`flex-1 px-4 py-2 text-xs sm:text-sm transition-colors font-display flex items-center justify-center gap-2 whitespace-nowrap rounded-[3px] cursor-pointer ${
              generationMode === 'video'
                ? 'bg-white text-black font-semibold'
                : 'text-[#9C9C96] hover:text-white'
            }`}
          >
            <Video size={14} className="shrink-0" />
            <span>Text to Video</span>
          </button>
        </div>
      </div>

      {formValidationNotice && (
        <div
          id="validation-alert-banner"
          className="p-4 bg-[#18140B] border border-amber-700/70 rounded-[3px] text-amber-200 flex items-start gap-3"
          role="alert"
        >
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm leading-relaxed">
            <p className="font-semibold mb-0.5 text-white font-display">Attention Required</p>
            <p className="text-amber-200/90 font-narrative">{formValidationNotice}</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div
          className="p-4 bg-red-950/30 border border-red-700/60 rounded-[3px] text-red-200 flex items-start gap-3"
          role="alert"
        >
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm leading-relaxed">
            <p className="font-semibold mb-0.5 text-white font-display">Generation Error</p>
            <p className="text-red-200/90 font-narrative">{errorMessage}</p>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        id="story-generator-form"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start font-narrative"
      >
        {/* LEFT COLUMN (7/12): Story Input, Style, Key Status & Primary Generate CTA */}
        <div className="lg:col-span-7 space-y-5">
          {/* Story Textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="story-input-box"
                className="block font-display text-sm font-medium text-white"
              >
                {autoArchitectMode ? 'Story Premise, Question, or Draft' : 'Exact Story or Script'}
              </label>

              <div className="flex items-center gap-2.5">
                <span className="font-mono tabular-nums text-[11px] text-[#8C8C86]">
                  {wordCount} {wordCount === 1 ? 'word' : 'words'}
                </span>
                {isManuscriptFormat && (
                  <span
                    id="manuscript-detected-badge"
                    className="inline-flex items-center gap-1 font-mono text-[10px] text-amber-300 bg-amber-950/60 border border-amber-700/60 px-2 py-0.5 rounded-[2px]"
                    title="Structured manuscript detected. Clicking Generate will ingest clips directly."
                  >
                    <Film size={11} className="text-amber-400 shrink-0" />
                    <span>Script Detected ({detectedClipsCount})</span>
                  </span>
                )}
                <button
                  type="button"
                  id="random-story-dice-btn"
                  onClick={handlePickRandomStory}
                  disabled={isLoading}
                  title="Insert a sample story idea"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#181816] hover:bg-[#242422] text-[#C4C4BE] hover:text-white border border-white/15 rounded-[3px] text-xs font-display transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white cursor-pointer"
                >
                  <Dices size={13} />
                  <span className="hidden sm:inline">Sample Idea</span>
                </button>
              </div>
            </div>

            <textarea
              id="story-input-box"
              rows={10}
              value={story}
              onChange={(e) => setStory(e.target.value)}
              disabled={isLoading}
              placeholder={
                autoArchitectMode
                  ? "Enter any premise, question, or rough draft (for example: 'What happens if you swallow a magnet?' or 'A deep-sea diver discovers a glowing hatch'). StoryFrame expands the narrative and directs every shot."
                  : beatMode === 'custom'
                    ? 'e.g. She fell (beat 1) two miles through open air (beat 2), strapped to three airplane seats, and survived (beat 3).'
                    : 'Paste your story or exact narrator script. Standard mode preserves every word as written without expanding it (enable Enhance Story to expand a short idea).'
              }
              className={`w-full p-4 bg-[#121211] hover:bg-[#151513] focus:bg-[#121211] text-[#F5F5F0] placeholder:text-[#666660] border rounded-[3px] transition-colors focus:outline-none text-sm sm:text-base leading-relaxed resize-y story-textarea-scroll ${
                autoArchitectMode
                  ? 'border-amber-500/40 focus:border-amber-400'
                  : beatMode === 'custom'
                    ? 'border-amber-500/50 focus:border-amber-400'
                    : 'border-white/15 focus:border-white'
              }`}
              required
            />

            {!autoArchitectMode && beatMode === 'custom' && (
              <div className="text-xs text-amber-200/90 flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#18150D] border border-amber-500/30 rounded-[3px]">
                <span>
                  Manual Beats: place <strong>(beat 1)</strong>, <strong>(beat 2)</strong>, <strong>(beat 3)</strong> after each phrase.
                </span>
                <span className="font-mono tabular-nums text-amber-400 font-semibold">
                  {(story.match(/\((?:beat\s*)?\d+\)|\[(?:beat\s*)?\d+\]/gi) || []).length} beats detected
                </span>
              </div>
            )}
          </div>

          {/* Character & Visual Style Input */}
          <div className="space-y-2">
            <label
              htmlFor="character-prompt-input"
              className="block font-display text-sm font-medium text-white"
            >
              Character &amp; Visual Style
            </label>
            <input
              type="text"
              id="character-prompt-input"
              value={characterStyle}
              onChange={(e) => setCharacterStyle(e.target.value)}
              disabled={isLoading}
              placeholder="e.g. cinematic hyperrealism, 90s anime cel animation, stop-motion felt, textured oil painting..."
              className="w-full px-4 py-2.5 bg-[#121211] hover:bg-[#151513] focus:bg-[#121211] text-[#F5F5F0] placeholder:text-[#666660] border border-white/15 rounded-[3px] transition-colors focus:outline-none focus:border-white text-sm sm:text-base"
            />
          </div>

          {/* Action Row: API Key Status + Generate CTA */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => {
                setShowAdvanced(true);
                setTimeout(() => {
                  const el = document.getElementById('model-options-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 60);
              }}
              className="inline-flex items-center gap-2.5 px-3 py-2 bg-[#141412] hover:bg-[#1B1B19] border border-white/10 rounded-[3px] text-left transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white cursor-pointer"
              title="Review or update your AI provider and API key"
            >
              <span
                className={`w-2 h-2 rounded-[1px] shrink-0 ${
                  hasCustomKey ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <div className="min-w-0">
                <div className="text-xs font-display text-white font-medium truncate">
                  {hasCustomKey ? activeModelSummary : 'API Key Required'}
                </div>
                <div className="text-[11px] font-mono text-[#8C8C86] truncate">
                  {hasCustomKey ? 'Ready for direct generation' : 'Click to add Gemini or Groq key'}
                </div>
              </div>
            </button>

            <button
              type="submit"
              id="generate-scenes-button"
              disabled={isLoading || !story.trim()}
              className={`relative w-full sm:w-auto min-w-[240px] min-h-[46px] font-display text-sm sm:text-base font-medium rounded-[3px] transition-colors flex items-center justify-center overflow-hidden shadow-lg cursor-pointer ${
                isLoading
                  ? 'p-0 bg-[#141413] border border-white/25 cursor-wait'
                  : autoArchitectMode
                    ? 'px-6 py-3 bg-amber-400 text-black hover:bg-amber-300 active:bg-amber-500 font-semibold disabled:opacity-40 disabled:cursor-not-allowed'
                    : 'px-6 py-3 bg-white text-black hover:bg-[#EAEAE6] active:bg-[#D4D4D0] font-semibold disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-full min-h-[46px] px-6 py-3 flex items-center justify-center gap-2 text-white select-none">
                    <RefreshCw size={15} className="animate-spin text-white/80 shrink-0" />
                    <span className="font-display text-sm font-medium text-white">
                      {autoArchitectMode
                        ? 'Architecting Story...'
                        : `Generating ${generationMode === 'video' ? 'Video' : 'Storyboard'}...`}
                    </span>
                  </div>
                  <div
                    className={`absolute inset-0 flex items-center justify-center gap-2 px-6 py-3 select-none pointer-events-none z-10 ${
                      autoArchitectMode ? 'bg-amber-400 text-black' : 'bg-white text-black'
                    }`}
                    style={{ clipPath: `inset(0 ${Math.max(0, 100 - progress)}% 0 0)` }}
                  >
                    <RefreshCw size={15} className="animate-spin text-black shrink-0" />
                    <span className="font-display text-sm font-bold text-black">
                      {autoArchitectMode
                        ? 'Architecting Story...'
                        : `Generating ${generationMode === 'video' ? 'Video' : 'Storyboard'}...`}
                    </span>
                  </div>
                </>
              ) : (
                <span className="flex items-center gap-2">
                  {autoArchitectMode && <Sparkles size={15} className="shrink-0" />}
                  <span>
                    {autoArchitectMode
                      ? generationMode === 'video'
                        ? 'Enhance & Generate Video Plan'
                        : 'Enhance & Generate Breakdown'
                      : generationMode === 'video'
                        ? 'Generate Video Breakdown'
                        : 'Generate Breakdown'}
                  </span>
                </span>
              )}
            </button>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 text-xs font-mono text-[#A0A09A]">
              <span
                className={`w-2 h-2 rounded-[1px] animate-pulse shrink-0 ${
                  autoArchitectMode ? 'bg-amber-400' : 'bg-white'
                }`}
              />
              <span>{progressPhase}</span>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (5/12): Flat Director Controls Card + Model & API Key Settings */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#121211] border border-white/15 rounded-[3px] p-4 sm:p-5 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="font-display text-sm font-medium text-white">
                Director Controls
              </span>
              <span className="font-mono text-[11px] text-[#8C8C86]">
                {generationMode === 'video' ? 'Video Mode' : 'Image Mode'}
              </span>
            </div>

            {/* Enhance Story Toggle */}
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className={autoArchitectMode ? 'text-amber-400' : 'text-[#8C8C86]'} />
                  <span className="font-display font-medium text-sm text-white">
                    Enhance Story
                  </span>
                </div>
                <p className="text-xs text-[#8C8C86] leading-snug">
                  Expands a short idea or 1-line premise into a structured hook and full narration.
                </p>
              </div>

              <button
                type="button"
                id="auto-architect-toggle-switch"
                role="switch"
                aria-checked={autoArchitectMode}
                disabled={isLoading}
                onClick={() => setAutoArchitectMode(!autoArchitectMode)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-[3px] border transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 ${
                  autoArchitectMode
                    ? 'bg-amber-500 border-amber-400'
                    : 'bg-[#1D1D1B] border-white/20'
                }`}
                title="Toggle Enhance Story"
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-[2px] transition-transform ${
                    autoArchitectMode ? 'translate-x-5.5 bg-black' : 'translate-x-1 bg-[#D4D4D0]'
                  }`}
                />
              </button>
            </div>

            <div className="border-t border-white/10" />

            {/* Beat Pacing */}
            <div className="space-y-2">
              <label className="block font-editorial-meta text-[10px] sm:text-[11px] text-[#9C9C96]">
                BEAT PACING
              </label>
              {autoArchitectMode ? (
                <div
                  id="auto-architect-pacing-indicator"
                  className="w-full flex items-center justify-between px-3 bg-[#15140F] border border-amber-500/40 h-[42px] rounded-[3px]"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Sparkles size={13} className="text-amber-400 shrink-0" />
                    <span className="text-xs font-display text-amber-300 font-medium truncate">
                      AI Auto-Pacing Active
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-amber-300 px-1.5 py-0.5 bg-amber-950/60 border border-amber-700/50 rounded-[2px] shrink-0">
                    1-Pass
                  </span>
                </div>
              ) : (
                <div
                  id="beat-mode-toggle-group"
                  className="w-full flex p-1 bg-[#0C0C0B] border border-white/15 h-[42px] items-center rounded-[3px]"
                  role="group"
                  aria-label="Beat pacing mode selection"
                >
                  <button
                    type="button"
                    id="beat-mode-auto-btn"
                    disabled={isLoading}
                    onClick={() => handleToggleBeatMode('automatic')}
                    className={`flex-1 h-full px-3 text-xs sm:text-sm transition-colors font-display text-center whitespace-nowrap flex items-center justify-center rounded-[2px] cursor-pointer ${
                      beatMode === 'automatic'
                        ? 'bg-white text-black font-semibold'
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
                    className={`flex-1 h-full px-3 text-xs sm:text-sm transition-colors font-display text-center whitespace-nowrap flex items-center justify-center gap-1.5 rounded-[2px] cursor-pointer ${
                      beatMode === 'custom'
                        ? 'bg-amber-400 text-black font-semibold'
                        : 'text-[#9C9C96] hover:text-white'
                    }`}
                  >
                    <Scissors size={12} className={beatMode === 'custom' ? 'text-black' : 'text-amber-400'} />
                    <span>Manual Beats</span>
                  </button>
                </div>
              )}
            </div>

            {/* Aspect Ratio Format */}
            <div className="space-y-2">
              <label className="block font-editorial-meta text-[10px] sm:text-[11px] text-[#9C9C96]">
                ASPECT RATIO FORMAT
              </label>
              <div
                id="format-toggle-group"
                className="w-full flex p-1 bg-[#0C0C0B] border border-white/15 h-[42px] items-center rounded-[3px]"
                role="group"
                aria-label="Aspect ratio format selection"
              >
                <button
                  type="button"
                  id="format-short-btn"
                  disabled={isLoading}
                  onClick={() => handleFormatChange('short')}
                  className={`flex-1 h-full px-3 text-xs sm:text-sm transition-colors font-display text-center whitespace-nowrap flex items-center justify-center rounded-[2px] cursor-pointer ${
                    format === 'short'
                      ? 'bg-white text-black font-semibold'
                      : 'text-[#9C9C96] hover:text-white'
                  }`}
                >
                  Short Form (9:16)
                </button>
                <button
                  type="button"
                  id="format-long-btn"
                  disabled={isLoading}
                  onClick={() => handleFormatChange('long')}
                  className={`flex-1 h-full px-3 text-xs sm:text-sm transition-colors font-display text-center whitespace-nowrap flex items-center justify-center rounded-[2px] cursor-pointer ${
                    format === 'long'
                      ? 'bg-white text-black font-semibold'
                      : 'text-[#9C9C96] hover:text-white'
                  }`}
                >
                  Long Form (16:9)
                </button>
              </div>
            </div>

            {/* Platform & Duration */}
            <div className="space-y-4">
              <CustomDropdown
                id="platform-select"
                label="Distribution Platform"
                options={format === 'short' ? SHORT_PLATFORMS : LONG_PLATFORMS}
                selectedValue={platform}
                onSelect={setPlatform}
                disabled={isLoading}
              />

              {generationMode === 'video' ? (
                <div className="space-y-2">
                  <CustomDropdown
                    id="video-duration-select"
                    label="Clip Duration"
                    options={VIDEO_DURATIONS}
                    selectedValue={videoDurationValue}
                    onSelect={setVideoDurationValue}
                    disabled={isLoading}
                    helperText="Aligns narration pacing and camera beats to your video generator clip length."
                  />
                  {videoDurationValue === 'custom' && (
                    <div className="pt-1 space-y-1.5">
                      <label
                        htmlFor="custom-video-numeric-input"
                        className="block font-editorial-meta text-[10px] text-[#9C9C96]"
                      >
                        CUSTOM CLIP DURATION (1 - 60 SECONDS)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        id="custom-video-numeric-input"
                        value={customVideoSeconds}
                        onChange={(e) => setCustomVideoSeconds(e.target.value)}
                        disabled={isLoading}
                        placeholder="e.g. 4"
                        className="w-full px-3.5 h-[42px] bg-[#0C0C0B] text-[#F5F5F0] placeholder:text-[#666660] border border-white/15 focus:border-white rounded-[3px] focus:outline-none text-xs sm:text-sm font-mono transition-colors"
                        required
                      />
                    </div>
                  )}
                </div>
              ) : autoArchitectMode ? (
                <div className="space-y-2">
                  <CustomDropdown
                    id="duration-select"
                    label="Target Duration"
                    options={format === 'short' ? SHORT_DURATIONS : LONG_DURATIONS}
                    selectedValue={durationValue}
                    onSelect={setDurationValue}
                    disabled={isLoading}
                    helperText="Controls how long Enhance Story expands your narration script."
                  />
                  {durationValue === 'custom' && (
                    <div className="pt-1 space-y-1.5">
                      <label
                        htmlFor="custom-numeric-input"
                        className="block font-editorial-meta text-[10px] text-[#9C9C96]"
                      >
                        {format === 'long' ? 'CUSTOM MINUTES (1 - 120)' : 'CUSTOM SECONDS (1 - 600)'}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={format === 'long' ? '120' : '600'}
                        id="custom-numeric-input"
                        value={customNumeric}
                        onChange={(e) => setCustomNumeric(e.target.value)}
                        disabled={isLoading}
                        placeholder={format === 'long' ? 'e.g. 7' : 'e.g. 35'}
                        className="w-full px-3.5 h-[42px] bg-[#0C0C0B] text-[#F5F5F0] placeholder:text-[#666660] border border-white/15 focus:border-white rounded-[3px] focus:outline-none text-xs sm:text-sm font-mono transition-colors"
                        required
                      />
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* Model & API Settings Collapsible Card */}
          <div
            id="model-options-section"
            className="bg-[#121211] border border-white/15 rounded-[3px] scroll-mt-24 overflow-hidden"
          >
            <button
              type="button"
              id="toggle-advanced-btn"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between text-left hover:bg-[#171715] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white cursor-pointer"
              aria-expanded={showAdvanced}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Sliders size={14} className="text-[#9C9C96] shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-display font-medium text-white">
                    Model &amp; API Settings
                  </div>
                  <div className="text-xs font-mono text-[#8C8C86] truncate">
                    {activeModelSummary} {hasCustomKey ? '(Key Connected)' : '(No Key Set)'}
                  </div>
                </div>
              </div>
              {showAdvanced ? (
                <ChevronUp size={16} className="text-[#9C9C96] shrink-0" />
              ) : (
                <ChevronDown size={16} className="text-[#9C9C96] shrink-0" />
              )}
            </button>

            {showAdvanced && (
              <div className="px-4 sm:px-5 pb-5 pt-4 border-t border-white/10 space-y-4">
                <CustomDropdown
                  id="ai-provider"
                  label="AI Provider"
                  options={AI_PROVIDER_OPTIONS}
                  selectedValue={aiProvider}
                  onSelect={(val) => handleSwitchProvider(val as AiProvider)}
                  headerBadge={aiProvider === 'groq' ? 'LPU ACCELERATED' : 'GOOGLE AI'}
                />

                {aiProvider === 'gemini' ? (
                  <CustomDropdown
                    id="gemini-model"
                    label="Gemini Model"
                    options={GEMINI_MODEL_OPTIONS}
                    selectedValue={modelQuality}
                    onSelect={(val) => setModelQuality(val as 'standard' | 'high')}
                    headerBadge={modelQuality === 'high' ? 'PRO REASONING' : 'HIGH SPEED'}
                  />
                ) : (
                  <div className="space-y-2">
                    <CustomDropdown
                      id="groq-model"
                      label="Groq Model"
                      options={GROQ_MODEL_OPTIONS}
                      selectedValue={
                        GROQ_MODEL_OPTIONS.some((o) => o.value === groqModel)
                          ? groqModel
                          : 'custom'
                      }
                      onSelect={handleSelectGroqModel}
                      headerBadge="FREE TIER SAFE"
                    />
                    {(groqModel === 'custom' || !GROQ_MODEL_OPTIONS.some((o) => o.value === groqModel)) && (
                      <div className="space-y-1.5">
                        <label
                          htmlFor="custom-groq-model-input"
                          className="block font-editorial-meta text-[10px] text-[#9C9C96]"
                        >
                          CUSTOM GROQ MODEL ID
                        </label>
                        <input
                          type="text"
                          id="custom-groq-model-input"
                          value={customGroqInput}
                          onChange={(e) => handleCustomGroqInputChange(e.target.value)}
                          placeholder="e.g. qwen/qwen3.8-27b"
                          className="w-full px-3 py-2 bg-[#0C0C0B] text-white border border-white/20 rounded-[3px] text-xs font-mono focus:outline-none focus:border-white placeholder:text-[#555550]"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Bring Your Own Key (BYOK) Input */}
                <div className="space-y-3 pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor={aiProvider === 'groq' ? 'groq-api-key-input' : 'gemini-api-key-input'}
                      className="inline-flex items-center gap-1.5 font-display text-xs font-medium text-white"
                    >
                      <KeyRound size={13} className="text-[#9C9C96]" />
                      <span>{aiProvider === 'groq' ? 'Groq API Key' : 'Gemini API Key'}</span>
                    </label>
                    {hasCustomKey && (
                      <span className="inline-flex items-center text-[11px] text-emerald-400 font-mono">
                        <CheckCircle2 size={12} className="mr-1" />
                        Active
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type={showKeyText ? 'text' : 'password'}
                      id={aiProvider === 'groq' ? 'groq-api-key-input' : 'gemini-api-key-input'}
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder={aiProvider === 'groq' ? 'gsk_...' : 'AIzaSy...'}
                      className="w-full pl-3.5 pr-10 py-2.5 bg-[#0C0C0B] text-[#F5F5F0] placeholder:text-[#555550] border border-white/15 rounded-[3px] focus:outline-none focus:border-white text-xs sm:text-sm font-mono"
                    />
                    <button
                      type="button"
                      id="toggle-key-visibility-btn"
                      onClick={() => setShowKeyText(!showKeyText)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#888884] hover:text-white transition-colors cursor-pointer"
                      title={showKeyText ? 'Hide API key' : 'Show API key'}
                      aria-label="Toggle API key visibility"
                    >
                      {showKeyText ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <label className="flex items-center gap-2 text-xs text-[#9C9C96] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        id="remember-key-checkbox"
                        checked={rememberOptIn}
                        onChange={(e) => setRememberOptIn(e.target.checked)}
                        className="rounded-[2px] border-white/25 bg-[#0C0C0B] text-white focus:ring-0 focus:ring-offset-0"
                      />
                      <span>Remember for this session</span>
                    </label>

                    <div className="flex items-center gap-2">
                      {hasCustomKey && (
                        <button
                          type="button"
                          id="clear-key-button"
                          onClick={handleClearKey}
                          className="inline-flex items-center font-display text-xs text-red-400 hover:text-red-300 transition-colors py-1.5 px-2.5 rounded-[3px] hover:bg-red-950/30 cursor-pointer"
                        >
                          <Trash2 size={12} className="mr-1" />
                          Remove
                        </button>
                      )}
                      <button
                        type="button"
                        id="apply-key-button"
                        onClick={handleApplyKey}
                        className="inline-flex items-center font-display text-xs px-3.5 py-1.5 bg-white text-black font-semibold hover:bg-[#EAEAE6] transition-colors rounded-[3px] cursor-pointer"
                      >
                        Apply Key
                      </button>
                    </div>
                  </div>

                  {keyFeedback && (
                    <p className="text-xs text-emerald-400 font-narrative">
                      {keyFeedback}
                    </p>
                  )}

                  <div className="p-3 bg-[#0C0C0B] border border-white/10 rounded-[3px] text-xs text-[#9C9C96] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-white font-display font-medium">
                        <Shield size={13} className="text-emerald-400 shrink-0" />
                        <span>Direct Browser-Only Key Storage</span>
                      </div>
                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => {
                            onNavigate('byok-security');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="text-xs text-amber-400 hover:text-amber-300 font-display inline-flex items-center gap-1 cursor-pointer"
                        >
                          <ShieldCheck size={12} />
                          <span>Security Guide</span>
                        </button>
                      )}
                    </div>
                    <p className="leading-relaxed">
                      {aiProvider === 'groq'
                        ? 'Your key calls api.groq.com directly from your browser and never passes through our servers.'
                        : 'Your key calls Google Generative Language API directly from your browser and never passes through our servers.'}
                    </p>
                    <a
                      href={aiProvider === 'groq' ? 'https://console.groq.com/keys' : 'https://aistudio.google.com/app/apikey'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-white hover:underline underline-offset-2 font-display font-medium"
                    >
                      {aiProvider === 'groq'
                        ? 'Get a free Groq API key at console.groq.com ->'
                        : 'Get a free Gemini key at Google AI Studio ->'}
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
