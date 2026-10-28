import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Send, 
  Trash2, 
  Sparkles, 
  Check, 
  Copy, 
  Key, 
  MessageSquare,
  ArrowRight,
  Pencil,
  RotateCcw,
  Layers,
  Image as ImageIcon
} from 'lucide-react';
import { AssistantChatMessage, StoryGenerationResult, StoryFormat } from '../types';
import { 
  getStoredChatHistory, 
  saveStoredChatHistory, 
  clearStoredChatHistory, 
  sendChatMessage 
} from '../services/assistantChatService';
import { useApiKey } from '../context/ApiKeyContext';

interface AssistantChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyStoryIdea?: (idea: string) => void;
  onOpenModelOptions?: () => void;
  currentResult?: StoryGenerationResult | null;
  format?: StoryFormat;
  onUpdateBeatPrompt?: (sceneIndex: number, beatIndex: number, newPrompt: string) => void;
  onUpdateThumbnailPrompt?: (newPrompt: string) => void;
  onUpdateCtaPrompt?: (newPrompt: string) => void;
}

interface TextSegment {
  type: 'text';
  content: string;
}

interface ReviseBeatSegment {
  type: 'revise_beat';
  scene: number;
  beat: number;
  prompt: string;
  tagId: string;
}

interface ReviseThumbnailSegment {
  type: 'revise_thumbnail';
  prompt: string;
  tagId: string;
}

interface ReviseCtaSegment {
  type: 'revise_cta';
  prompt: string;
  tagId: string;
}

type MessageSegment = TextSegment | ReviseBeatSegment | ReviseThumbnailSegment | ReviseCtaSegment;

function parseMessageSegments(content: string, messageId: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const regex = /\[(REVISE_BEAT\s+scene=(\d+)\s+beat=(\d+)|REVISE_THUMBNAIL|REVISE_CTA)\]([\s\S]*?)\[\/(?:REVISE_BEAT|REVISE_THUMBNAIL|REVISE_CTA)\]/gi;
  
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let indexCounter = 0;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textChunk = content.slice(lastIndex, match.index).trim();
      if (textChunk) {
        segments.push({ type: 'text', content: textChunk });
      }
    }

    const fullTag = match[1];
    const promptBody = (match[4] || '').trim();
    const tagId = `${messageId}-rev-${indexCounter++}`;

    if (fullTag.toUpperCase().startsWith('REVISE_BEAT')) {
      const sceneNum = parseInt(match[2], 10);
      const beatNum = parseInt(match[3], 10);
      segments.push({
        type: 'revise_beat',
        scene: sceneNum,
        beat: beatNum,
        prompt: promptBody,
        tagId,
      });
    } else if (fullTag.toUpperCase() === 'REVISE_THUMBNAIL') {
      segments.push({
        type: 'revise_thumbnail',
        prompt: promptBody,
        tagId,
      });
    } else if (fullTag.toUpperCase() === 'REVISE_CTA') {
      segments.push({
        type: 'revise_cta',
        prompt: promptBody,
        tagId,
      });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    const trailing = content.slice(lastIndex).trim();
    if (trailing) {
      segments.push({ type: 'text', content: trailing });
    }
  }

  if (segments.length === 0 && content.trim().length > 0) {
    segments.push({ type: 'text', content });
  }

  return segments;
}

function buildStoryContextSummary(result: StoryGenerationResult, format?: StoryFormat): string {
  const parts: string[] = [];
  if (result.title) {
    parts.push(`Story Title: ${result.title}`);
  }
  parts.push(`Format: ${format === 'long' ? '16:9 Landscape/Widescreen' : '9:16 Vertical Portrait'}`);
  parts.push(`Modality: ${result.generationMode || 'image'}`);
  if (result.styleProfile) {
    parts.push(`Style Profile: Art Style: ${result.styleProfile.artStyle || 'N/A'}; Palette: ${result.styleProfile.colorPalette || 'N/A'}; Lighting: ${result.styleProfile.lighting || 'N/A'}; Era/Setting: ${result.styleProfile.eraAndSetting || 'N/A'}; Lens/Optics: ${result.styleProfile.lensAndFilmStock || 'N/A'}`);
  }
  if (result.characterSheet && Object.keys(result.characterSheet).length > 0) {
    const chars = Object.entries(result.characterSheet).map(([k, v]) => `${k}: ${v}`).join(' | ');
    parts.push(`Character Sheet: ${chars}`);
  }
  if (result.locationSheet && Object.keys(result.locationSheet).length > 0) {
    const locs = Object.entries(result.locationSheet).map(([k, v]) => `${k}: ${v}`).join(' | ');
    parts.push(`Location Sheet: ${locs}`);
  }
  if (result.thumbnail?.compiledPrompt) {
    parts.push(`Cover Thumbnail Visual Prompt: ${result.thumbnail.compiledPrompt}`);
  }
  if (result.ctaPrompt?.compiledPrompt) {
    parts.push(`Call-to-Action Outro Visual Prompt: ${result.ctaPrompt.compiledPrompt}`);
  }
  if (result.scenes && result.scenes.length > 0) {
    parts.push('Scenes & Visual Beats:');
    result.scenes.forEach((s) => {
      parts.push(`[Scene ${s.index}] Narration: "${s.narratorLine}"`);
      if (Array.isArray(s.beats)) {
        s.beats.forEach((b) => {
          parts.push(`  - Beat ${b.beatIndex} (Phrase: "${b.textSpan}", Shot: ${b.shotType || 'Standard'}, Angle: ${b.cameraAngle || 'eye-level'}, Move: ${b.cameraMovement || 'Static'}): Prompt: "${b.imagePrompt}"`);
        });
      }
    });
  }
  return parts.join('\n');
}

export default function AssistantChatDrawer({
  isOpen,
  onClose,
  onApplyStoryIdea,
  onOpenModelOptions,
  currentResult,
  format,
  onUpdateBeatPrompt,
  onUpdateThumbnailPrompt,
  onUpdateCtaPrompt,
}: AssistantChatDrawerProps) {
  const { apiKey, modelQuality, aiProvider, groqModel } = useApiKey();
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [, setErrorMessage] = useState<string | null>(null);
  const [, setLastAttemptedMessage] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [appliedRevisions, setAppliedRevisions] = useState<Record<string, { previousPrompt: string; label: string }>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Build live context string from currentResult
  const storyContext = useMemo(() => {
    if (!currentResult) return '';
    return buildStoryContextSummary(currentResult, format);
  }, [currentResult, format]);

  // Dynamic starter queries based on whether a story is active
  const starterPrompts = useMemo(() => {
    if (currentResult && currentResult.scenes && currentResult.scenes.length > 0) {
      const firstScene = currentResult.scenes[0];
      const hasTwoBeats = firstScene?.beats && firstScene.beats.length >= 2;
      return [
        {
          label: hasTwoBeats ? 'Deduplicate Scene 1 Beat 2' : 'Revise Scene 1 Beat 1',
          query: hasTwoBeats 
            ? 'In S1 B2 I want to change the visual prompt since it is slightly identical to S1 B1. Keep the exact character style, settings, and camera continuity, but provide a distinct angle and action.'
            : 'In S1 B1 I want to revise the visual prompt with a stronger dynamic pose and dramatic lighting.',
        },
        {
          label: 'Revise Cover Thumbnail',
          query: 'I want to revise the cover thumbnail visual prompt with a high-contrast cinematic hero shot and dramatic facial expression.',
        },
        {
          label: 'Revise CTA Outro Prompt',
          query: 'Please revise the CTA outro prompt to make the closing question visually striking with dramatic lighting.',
        },
        {
          label: 'Explain Story Continuity Rules',
          query: 'Explain how StoryFrame maintains locked character outfits and biomechanical weight across all visual beats.',
        },
      ];
    }
    return [
      { label: 'Who built this project?', query: 'Who built this project?' },
      { label: 'Zack D. Films story idea', query: 'Give me a captivating, curious story idea inspired by Zack D. Films with the complete story narrative from start to finish.' },
      { label: 'Unique character style', query: 'Suggest 3 unique, cinematic character art styles for my story.' },
      { label: 'How does StoryFrame work?', query: 'Explain how StoryFrame converts stories into scenes and visual beats.' },
    ];
  }, [currentResult]);

  // Load chat history from session on mount
  useEffect(() => {
    const saved = getStoredChatHistory();
    if (saved && saved.length > 0) {
      setMessages(saved);
    }
  }, []);

  // Save history on changes
  useEffect(() => {
    if (messages.length > 0) {
      saveStoredChatHistory(messages);
    }
  }, [messages]);

  // Scroll to bottom when messages update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 200);
    }
  }, [isOpen, messages, isSending]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setErrorMessage(null);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Escape key closes drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSend = async (textToSend?: string) => {
    const messageContent = (textToSend || inputText).trim();
    if (!messageContent || isSending) return;

    if (!apiKey || !apiKey.trim()) {
      const providerLabel = aiProvider === 'groq' ? 'Groq' : 'Gemini';
      setErrorMessage(`A ${providerLabel} API key is required to talk with the assistant. Please add your key under Model Options in the generator.`);
      return;
    }

    setErrorMessage(null);
    setLastAttemptedMessage(messageContent);

    const lastMsg = messages[messages.length - 1];
    const isRetryOfLastMessage = lastMsg && lastMsg.role === 'user' && lastMsg.content === messageContent;

    let historyToSend = messages;
    let newHistory = messages;

    if (!isRetryOfLastMessage) {
      const userMessage: AssistantChatMessage = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        role: 'user',
        content: messageContent,
        timestamp: Date.now(),
      };
      newHistory = [...messages, userMessage];
      setMessages(newHistory);
      historyToSend = messages;
    } else {
      historyToSend = messages.slice(0, -1);
    }

    setInputText('');
    setIsSending(true);

    try {
      const reply = await sendChatMessage(
        historyToSend, 
        messageContent, 
        apiKey, 
        modelQuality, 
        aiProvider, 
        groqModel,
        storyContext
      );
      const assistantMessage: AssistantChatMessage = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        role: 'assistant',
        content: reply,
        timestamp: Date.now(),
      };
      setMessages([...newHistory, assistantMessage]);
    } catch {
      setErrorMessage('An error occurred while connecting to the assistant. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleEditPrompt = (text: string) => {
    if (isSending) return;
    setInputText(text);
    setErrorMessage(null);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(text.length, text.length);
      }
    }, 50);
  };

  const handleClearHistory = () => {
    clearStoredChatHistory();
    setMessages([]);
    setErrorMessage(null);
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleApplyToGenerator = (id: string, text: string) => {
    if (onApplyStoryIdea) {
      onApplyStoryIdea(text);
      setAppliedId(id);
      setTimeout(() => setAppliedId(null), 2500);
      onClose();
    }
  };

  // Revision action handlers
  const handleApplyBeatRevision = (tagId: string, sceneIndex: number, beatIndex: number, newPrompt: string) => {
    if (!currentResult || !onUpdateBeatPrompt) return;
    const targetScene = currentResult.scenes.find((s) => s.index === sceneIndex);
    const targetBeat = targetScene?.beats.find((b) => b.beatIndex === beatIndex);
    const originalPrompt = targetBeat?.imagePrompt || '';

    onUpdateBeatPrompt(sceneIndex, beatIndex, newPrompt);
    setAppliedRevisions((prev) => ({
      ...prev,
      [tagId]: {
        previousPrompt: originalPrompt,
        label: `Scene ${sceneIndex} Beat ${beatIndex}`,
      },
    }));
  };

  const handleUndoBeatRevision = (tagId: string, sceneIndex: number, beatIndex: number) => {
    const revision = appliedRevisions[tagId];
    if (!revision || !onUpdateBeatPrompt) return;
    onUpdateBeatPrompt(sceneIndex, beatIndex, revision.previousPrompt);
    setAppliedRevisions((prev) => {
      const next = { ...prev };
      delete next[tagId];
      return next;
    });
  };

  const handleApplyThumbnailRevision = (tagId: string, newPrompt: string) => {
    if (!currentResult || !onUpdateThumbnailPrompt) return;
    const originalPrompt = currentResult.thumbnail?.compiledPrompt || '';
    onUpdateThumbnailPrompt(newPrompt);
    setAppliedRevisions((prev) => ({
      ...prev,
      [tagId]: {
        previousPrompt: originalPrompt,
        label: 'Cover Thumbnail',
      },
    }));
  };

  const handleUndoThumbnailRevision = (tagId: string) => {
    const revision = appliedRevisions[tagId];
    if (!revision || !onUpdateThumbnailPrompt) return;
    onUpdateThumbnailPrompt(revision.previousPrompt);
    setAppliedRevisions((prev) => {
      const next = { ...prev };
      delete next[tagId];
      return next;
    });
  };

  const handleApplyCtaRevision = (tagId: string, newPrompt: string) => {
    if (!currentResult || !onUpdateCtaPrompt) return;
    const originalPrompt = currentResult.ctaPrompt?.compiledPrompt || '';
    onUpdateCtaPrompt(newPrompt);
    setAppliedRevisions((prev) => ({
      ...prev,
      [tagId]: {
        previousPrompt: originalPrompt,
        label: 'CTA Outro',
      },
    }));
  };

  const handleUndoCtaRevision = (tagId: string) => {
    const revision = appliedRevisions[tagId];
    if (!revision || !onUpdateCtaPrompt) return;
    onUpdateCtaPrompt(revision.previousPrompt);
    setAppliedRevisions((prev) => {
      const next = { ...prev };
      delete next[tagId];
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs cursor-pointer"
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="relative w-full sm:w-[480px] md:w-[540px] h-full bg-[#0C0C0B] border-l border-white/10 flex flex-col shadow-2xl z-10 font-narrative"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assistant-drawer-title"
          >
            {/* Header */}
            <div className="px-4 sm:px-6 py-3.5 border-b border-white/10 bg-[#111110] flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-8 h-8 border border-white/30 flex items-center justify-center rounded-[2px] bg-[#1A1A18] text-white shrink-0">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 id="assistant-drawer-title" className="text-sm sm:text-base font-display text-white tracking-tight truncate">
                    StoryFrame Assistant
                  </h2>
                  {currentResult ? (
                    <div className="flex items-center gap-1.5 mt-0.5 truncate">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span className="text-[10px] font-mono text-emerald-400 truncate">
                        Connected: {currentResult.title || 'Current Story'} ({currentResult.scenes?.length || 0}S / {currentResult.scenes?.reduce((acc, s) => acc + (s.beats?.length || 0), 0) || 0}B)
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/40" />
                      <span className="text-[10px] font-mono text-[#8C8C86]">
                        Context: General Creative Co-Pilot
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-1 shrink-0">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="p-2 text-[#8C8C86] hover:text-white hover:bg-white/5 rounded-[2px] transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                    title="Clear Chat History"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-[#8C8C86] hover:text-white hover:bg-white/5 rounded-[2px] transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                  title="Close Assistant"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* API Key Missing Notice */}
            {!apiKey && (
              <div className="mx-4 mt-3 p-3 bg-[#181816] border border-amber-500/30 rounded-[2px] shrink-0 text-xs">
                <div className="flex items-start space-x-2.5">
                  <Key className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[#E6E6DF] leading-relaxed">
                      To talk with the assistant, please configure your {aiProvider === 'groq' ? 'Groq' : 'Gemini'} API key in Model Options.
                    </p>
                    {onOpenModelOptions && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenModelOptions();
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-mono text-white underline underline-offset-2 hover:text-[#D4D4D0] cursor-pointer"
                      >
                        <span>Configure Model Options</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
              {messages.length === 0 ? (
                <div className="py-6 flex flex-col items-center text-center space-y-4">
                  <div className="w-12 h-12 border border-white/20 rounded-[2px] bg-[#141412] flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-[#A0A09A]" />
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <h3 className="text-base font-display text-white">
                      StoryFrame Assistant
                    </h3>
                    <p className="text-xs text-[#9C9C96] leading-relaxed">
                      {currentResult 
                        ? 'Ask to deduplicate beats, revise specific visual prompts, change shot angles, or refine your cover thumbnail and CTA outro.' 
                        : 'Ask questions about this project, request fresh story concepts in any genre, or explore cinematic art styles.'}
                    </p>
                  </div>

                  {/* Starter Chips */}
                  <div className="w-full pt-3 text-left space-y-2">
                    <span className="font-editorial-meta text-[10px] text-[#7A7A74] tracking-widest block uppercase">
                      Suggested Inquiries
                    </span>
                    <div className="flex flex-col gap-2">
                      {starterPrompts.map((starter) => (
                        <button
                          key={starter.label}
                          type="button"
                          onClick={() => handleSend(starter.query)}
                          disabled={isSending || !apiKey}
                          className="w-full text-left p-2.5 text-xs bg-[#121211] border border-white/10 hover:border-white/30 text-[#D4D4CE] hover:text-white rounded-[2px] transition-colors flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <span className="font-narrative">{starter.label}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-[#6E6E68] group-hover:text-white transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  const segments = isUser ? [] : parseMessageSegments(msg.content, msg.id);

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-editorial-meta text-[9px] text-[#7A7A74] tracking-widest">
                          {isUser ? 'YOU' : 'STORYFRAME ASSISTANT'}
                        </span>
                      </div>

                      {isUser ? (
                        <div className="max-w-[92%] p-3.5 rounded-[2px] text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words bg-[#1E1E1C] border border-white/20 text-white">
                          {msg.content}
                        </div>
                      ) : (
                        <div className="w-full max-w-[96%] space-y-2.5">
                          {segments.map((seg, sIdx) => {
                            if (seg.type === 'text') {
                              return (
                                <div
                                  key={`text-${sIdx}`}
                                  className="p-3.5 rounded-[2px] text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words bg-[#131312] border border-white/10 text-[#E8E8E2]"
                                >
                                  {seg.content}
                                </div>
                              );
                            }

                            if (seg.type === 'revise_beat') {
                              const isApplied = Boolean(appliedRevisions[seg.tagId]);
                              const isTargetAvailable = Boolean(currentResult?.scenes?.some((s) => s.index === seg.scene));

                              return (
                                <div
                                  key={seg.tagId}
                                  className="p-3.5 bg-[#161614] border border-white/20 rounded-[2px] space-y-2.5 shadow-md"
                                >
                                  <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                                    <div className="flex items-center gap-1.5">
                                      <Layers size={13} className="text-white shrink-0" />
                                      <span className="font-editorial-meta text-[10px] text-white uppercase tracking-wider font-semibold">
                                        Scene {seg.scene} - Beat {seg.beat} Prompt Revision
                                      </span>
                                    </div>
                                    {isApplied && (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded-[1px]">
                                        <Check size={10} />
                                        <span>Applied</span>
                                      </span>
                                    )}
                                  </div>

                                  <div className="p-2.5 bg-[#0C0C0B] border border-white/10 rounded-[2px] text-xs font-mono text-[#D4D4CE] leading-relaxed select-all max-h-48 overflow-y-auto">
                                    {seg.prompt}
                                  </div>

                                  <div className="flex items-center flex-wrap gap-2 pt-1">
                                    {isTargetAvailable && (
                                      <>
                                        {!isApplied ? (
                                          <button
                                            type="button"
                                            onClick={() => handleApplyBeatRevision(seg.tagId, seg.scene, seg.beat, seg.prompt)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-black text-xs font-semibold rounded-[2px] hover:bg-[#EAEAE5] transition-colors cursor-pointer"
                                          >
                                            <Check size={12} />
                                            <span>Apply to Storyboard</span>
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleUndoBeatRevision(seg.tagId, seg.scene, seg.beat)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#222220] text-[#D4D4CE] border border-white/20 text-xs rounded-[2px] hover:text-white hover:border-white transition-colors cursor-pointer"
                                          >
                                            <RotateCcw size={12} />
                                            <span>Undo Change</span>
                                          </button>
                                        )}
                                      </>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handleCopyText(seg.tagId, seg.prompt)}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1C1C1A] text-[#B0B0A8] hover:text-white border border-white/10 text-xs rounded-[2px] transition-colors cursor-pointer"
                                      title="Copy revised prompt"
                                    >
                                      {copiedId === seg.tagId ? (
                                        <>
                                          <Check size={12} className="text-emerald-400" />
                                          <span className="text-emerald-400">Copied</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy size={12} />
                                          <span>Copy Prompt</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            if (seg.type === 'revise_thumbnail') {
                              const isApplied = Boolean(appliedRevisions[seg.tagId]);
                              const isTargetAvailable = Boolean(currentResult?.thumbnail);

                              return (
                                <div
                                  key={seg.tagId}
                                  className="p-3.5 bg-[#161614] border border-white/20 rounded-[2px] space-y-2.5 shadow-md"
                                >
                                  <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                                    <div className="flex items-center gap-1.5">
                                      <ImageIcon size={13} className="text-white shrink-0" />
                                      <span className="font-editorial-meta text-[10px] text-white uppercase tracking-wider font-semibold">
                                        Cover Thumbnail Revision
                                      </span>
                                    </div>
                                    {isApplied && (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded-[1px]">
                                        <Check size={10} />
                                        <span>Applied</span>
                                      </span>
                                    )}
                                  </div>

                                  <div className="p-2.5 bg-[#0C0C0B] border border-white/10 rounded-[2px] text-xs font-mono text-[#D4D4CE] leading-relaxed select-all max-h-48 overflow-y-auto">
                                    {seg.prompt}
                                  </div>

                                  <div className="flex items-center flex-wrap gap-2 pt-1">
                                    {isTargetAvailable && (
                                      <>
                                        {!isApplied ? (
                                          <button
                                            type="button"
                                            onClick={() => handleApplyThumbnailRevision(seg.tagId, seg.prompt)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-black text-xs font-semibold rounded-[2px] hover:bg-[#EAEAE5] transition-colors cursor-pointer"
                                          >
                                            <Check size={12} />
                                            <span>Apply to Storyboard</span>
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleUndoThumbnailRevision(seg.tagId)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#222220] text-[#D4D4CE] border border-white/20 text-xs rounded-[2px] hover:text-white hover:border-white transition-colors cursor-pointer"
                                          >
                                            <RotateCcw size={12} />
                                            <span>Undo Change</span>
                                          </button>
                                        )}
                                      </>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handleCopyText(seg.tagId, seg.prompt)}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1C1C1A] text-[#B0B0A8] hover:text-white border border-white/10 text-xs rounded-[2px] transition-colors cursor-pointer"
                                      title="Copy revised prompt"
                                    >
                                      {copiedId === seg.tagId ? (
                                        <>
                                          <Check size={12} className="text-emerald-400" />
                                          <span className="text-emerald-400">Copied</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy size={12} />
                                          <span>Copy Prompt</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            if (seg.type === 'revise_cta') {
                              const isApplied = Boolean(appliedRevisions[seg.tagId]);
                              const isTargetAvailable = Boolean(currentResult?.ctaPrompt);

                              return (
                                <div
                                  key={seg.tagId}
                                  className="p-3.5 bg-[#161614] border border-white/20 rounded-[2px] space-y-2.5 shadow-md"
                                >
                                  <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                                    <div className="flex items-center gap-1.5">
                                      <Sparkles size={13} className="text-white shrink-0" />
                                      <span className="font-editorial-meta text-[10px] text-white uppercase tracking-wider font-semibold">
                                        Call-to-Action Outro Revision
                                      </span>
                                    </div>
                                    {isApplied && (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded-[1px]">
                                        <Check size={10} />
                                        <span>Applied</span>
                                      </span>
                                    )}
                                  </div>

                                  <div className="p-2.5 bg-[#0C0C0B] border border-white/10 rounded-[2px] text-xs font-mono text-[#D4D4CE] leading-relaxed select-all max-h-48 overflow-y-auto">
                                    {seg.prompt}
                                  </div>

                                  <div className="flex items-center flex-wrap gap-2 pt-1">
                                    {isTargetAvailable && (
                                      <>
                                        {!isApplied ? (
                                          <button
                                            type="button"
                                            onClick={() => handleApplyCtaRevision(seg.tagId, seg.prompt)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-black text-xs font-semibold rounded-[2px] hover:bg-[#EAEAE5] transition-colors cursor-pointer"
                                          >
                                            <Check size={12} />
                                            <span>Apply to Storyboard</span>
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleUndoCtaRevision(seg.tagId)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#222220] text-[#D4D4CE] border border-white/20 text-xs rounded-[2px] hover:text-white hover:border-white transition-colors cursor-pointer"
                                          >
                                            <RotateCcw size={12} />
                                            <span>Undo Change</span>
                                          </button>
                                        )}
                                      </>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handleCopyText(seg.tagId, seg.prompt)}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1C1C1A] text-[#B0B0A8] hover:text-white border border-white/10 text-xs rounded-[2px] transition-colors cursor-pointer"
                                      title="Copy revised prompt"
                                    >
                                      {copiedId === seg.tagId ? (
                                        <>
                                          <Check size={12} className="text-emerald-400" />
                                          <span className="text-emerald-400">Copied</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy size={12} />
                                          <span>Copy Prompt</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            return null;
                          })}
                        </div>
                      )}

                      {/* User message edit button */}
                      {isUser && !isSending && (
                        <div className="mt-1 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => handleEditPrompt(msg.content)}
                            className="p-1.5 text-[#8C8C86] hover:text-white hover:bg-white/5 transition-colors rounded-[2px] cursor-pointer"
                            title="Edit Prompt"
                            aria-label="Edit Prompt"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Assistant message action buttons */}
                      {!isUser && (
                        <div className="mt-1 flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleCopyText(msg.id, msg.content)}
                            className="p-1.5 text-[#8C8C86] hover:text-white hover:bg-white/5 transition-colors rounded-[2px] cursor-pointer"
                            title={copiedId === msg.id ? 'Copied' : 'Copy'}
                            aria-label={copiedId === msg.id ? 'Copied' : 'Copy'}
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {onApplyStoryIdea && (
                            <button
                              type="button"
                              onClick={() => handleApplyToGenerator(msg.id, msg.content)}
                              className="p-1.5 text-[#8C8C86] hover:text-white hover:bg-white/5 transition-colors rounded-[2px] cursor-pointer"
                              title={appliedId === msg.id ? 'Applied' : 'Use in Generator'}
                              aria-label={appliedId === msg.id ? 'Applied' : 'Use in Generator'}
                            >
                              {appliedId === msg.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Streaming / Loading Skeleton */}
              {isSending && (
                <div className="flex flex-col items-start space-y-1">
                  <span className="font-editorial-meta text-[9px] text-[#7A7A74] tracking-widest">
                    STORYFRAME ASSISTANT
                  </span>
                  <div className="p-3.5 bg-[#131312] border border-white/10 rounded-[2px] max-w-[85%] space-y-2">
                    <div className="flex items-center space-x-2 text-xs text-[#8C8C86]">
                      <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
                      <span className="font-mono text-[11px]">
                        thinking with {aiProvider === 'groq' ? 'groq' : 'gemini'}...
                      </span>
                    </div>
                    <div className="space-y-1.5 w-48 sm:w-64 pt-1">
                      <div className="h-2 bg-white/10 rounded-[1px] animate-pulse" />
                      <div className="h-2 bg-white/10 rounded-[1px] animate-pulse w-4/5" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Footer Input Composer */}
            <div className="p-3 sm:p-4 border-t border-white/10 bg-[#111110] shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="w-full"
              >
                <div className="flex items-center gap-2 p-2 sm:p-2.5 bg-[#181816] border border-white/15 focus-within:border-white/50 rounded-[4px] transition-colors">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={inputText}
                    onChange={(e) => {
                      setInputText(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={isSending || !apiKey}
                    placeholder={
                      !apiKey
                        ? 'Configure API key in generator...'
                        : currentResult 
                          ? 'e.g. In S1 B2 change prompt to fix duplication with S1 B1...'
                          : 'Ask a question or request a story...'
                    }
                    className="flex-1 min-w-0 bg-transparent border-0 text-white placeholder-[#6E6E68] text-sm sm:text-xs px-1 py-1 focus:outline-none resize-none leading-relaxed font-narrative disabled:opacity-50 disabled:cursor-not-allowed max-h-28 overflow-y-auto"
                  />

                  <button
                    type="submit"
                    disabled={!inputText.trim() || isSending || !apiKey}
                    aria-label="Send Message"
                    title="Send message (Enter)"
                    className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-white hover:bg-[#EAEAE5] active:bg-[#D4D4CE] text-black rounded-[2px] border border-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-1 focus:ring-white"
                  >
                    <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black" />
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
