import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Beat, GenerationMode, Scene, StyleProfile, StoryFormat } from '../types';
import { compileBeatPrompt } from '../services/promptCompiler';
import {
  X,
  Copy,
  Check,
  Camera,
  Video,
  ChevronLeft,
  ChevronRight,
  Clock,
  Clapperboard,
  Image as ImageIcon,
  Zap,
  RefreshCw,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';

interface BeatBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  sceneIndex: number;
  sceneRoman: string;
  scene?: Scene;
  beat: Beat | null;
  allBeatsInScene: Beat[];
  onNavigateBeat: (nextBeat: Beat) => void;
  globalBeatIndex?: number;
  totalGlobalBeats?: number;
  hasPrevGlobal?: boolean;
  hasNextGlobal?: boolean;
  onPrevGlobal?: () => void;
  onNextGlobal?: () => void;
  copiedIndex: string | null;
  isPersistedCopied?: boolean;
  clipboardError?: string | null;
  onCopy: (text: string, identifier: string) => Promise<boolean> | void;
  onCopyBeatPrompt?: (compiledPrompt: string, sceneIdx: number, beatIdx: number, advanceNext: boolean) => Promise<boolean> | void;
  generationMode?: GenerationMode;
  styleProfile?: StyleProfile;
  format?: StoryFormat;
  // Extra #5: Single-beat Quick Rewrite
  onRewriteBeat?: (sceneIndex: number, beatIndex: number, instruction: string) => Promise<boolean>;
  onUndoRewrite?: (sceneIndex: number, beatIndex: number) => void;
  canUndoRewrite?: boolean;
  isRewritingAny?: boolean;
  isRewritingThisBeat?: boolean;
  rewriteInstruction?: string;
  onRewriteInstructionChange?: (value: string) => void;
  rewriteError?: string | null;
  rewriteSuccessMessage?: string | null;
}

export default function BeatBottomSheet({
  isOpen,
  onClose,
  sceneIndex,
  sceneRoman,
  scene,
  beat,
  allBeatsInScene,
  onNavigateBeat,
  globalBeatIndex,
  totalGlobalBeats,
  hasPrevGlobal,
  hasNextGlobal,
  onPrevGlobal,
  onNextGlobal,
  copiedIndex,
  isPersistedCopied = false,
  clipboardError = null,
  onCopy,
  onCopyBeatPrompt,
  generationMode = 'image',
  styleProfile,
  format = 'short',
  onRewriteBeat,
  onUndoRewrite,
  canUndoRewrite = false,
  isRewritingAny = false,
  isRewritingThisBeat = false,
  rewriteInstruction = '',
  onRewriteInstructionChange,
  rewriteError = null,
  rewriteSuccessMessage = null,
}: BeatBottomSheetProps) {
  const [isRewriteOpen, setIsRewriteOpen] = useState(false);

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

  useEffect(() => {
    if (rewriteError) {
      setIsRewriteOpen(true);
    }
  }, [rewriteError]);

  if (!isOpen || !beat) return null;

  const isVideoMode = generationMode === 'video';
  const currentSceneIndex = allBeatsInScene.findIndex((b) => b.beatIndex === beat.beatIndex);
  const localPrevBeat = currentSceneIndex > 0 ? allBeatsInScene[currentSceneIndex - 1] : null;
  const localNextBeat =
    currentSceneIndex < allBeatsInScene.length - 1 ? allBeatsInScene[currentSceneIndex + 1] : null;

  const canGoPrev = typeof hasPrevGlobal === 'boolean' ? hasPrevGlobal : Boolean(localPrevBeat);
  const canGoNext = typeof hasNextGlobal === 'boolean' ? hasNextGlobal : Boolean(localNextBeat);

  const handlePrev = () => {
    if (onPrevGlobal && canGoPrev) {
      onPrevGlobal();
    } else if (localPrevBeat) {
      onNavigateBeat(localPrevBeat);
    }
  };

  const handleNext = () => {
    if (onNextGlobal && canGoNext) {
      onNextGlobal();
    } else if (localNextBeat) {
      onNavigateBeat(localNextBeat);
    }
  };

  const beatKey = `scene-${sceneIndex}-beat-${beat.beatIndex}`;
  const isCopiedFlash = copiedIndex === `prompt-${beatKey}`;
  const isCopiedPrompt = isCopiedFlash || isPersistedCopied;
  const isCopiedText = copiedIndex === `text-${beatKey}`;

  const activeScene: Scene = scene || {
    index: sceneIndex,
    narratorLine: beat.textSpan || '',
    estimatedSeconds: beat.estimatedSeconds || 5,
    beats: allBeatsInScene,
  };
  const compiled = compileBeatPrompt(
    beat,
    activeScene,
    styleProfile,
    'universal',
    format,
    generationMode
  );
  const promptToUse = compiled.promptText;

  const handleSubmitRewrite = async () => {
    if (!onRewriteBeat) return;
    const ok = await onRewriteBeat(sceneIndex, beat.beatIndex, rewriteInstruction);
    if (ok) {
      setIsRewriteOpen(false);
    }
  };

  const countLabel =
    typeof globalBeatIndex === 'number' && typeof totalGlobalBeats === 'number' && totalGlobalBeats > 0
      ? `(${globalBeatIndex + 1} of ${totalGlobalBeats})`
      : `(${currentSceneIndex + 1} of ${allBeatsInScene.length})`;

  return createPortal(
    <div
      id="mobile-beat-bottom-sheet-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-beat-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="mobile-beat-bottom-sheet"
        className="w-full max-h-[88vh] bg-[#121210] border-t border-white/20 rounded-t-[6px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200 font-narrative text-[#F5F5F0]"
      >
        {/* Drag handle */}
        <div className="pt-2.5 pb-1 flex justify-center shrink-0 cursor-pointer" onClick={onClose}>
          <div className="w-10 h-1 bg-white/25 rounded-[2px]" />
        </div>

        {/* Sheet Header */}
        <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between bg-[#161614] shrink-0">
          <div className="flex items-center space-x-2 min-w-0">
            <span
              id="mobile-beat-title"
              className={`stamp-chip font-bold text-[10px] ${
                isVideoMode
                  ? 'bg-amber-950/70 text-amber-300 border-amber-700/80'
                  : 'bg-white/10 text-white border-white/25'
              }`}
            >
              BEAT {String(beat.beatIndex).padStart(2, '0')}
            </span>
            <span className="font-editorial-meta text-[10px] text-[#A8A8A2]">
              SCENE {sceneRoman}
            </span>
            <span className="font-mono text-[10px] text-[#7D7D76] tabular-nums">
              {countLabel}
            </span>
            {isPersistedCopied && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-400">
                <Check size={10} />
                <span>Copied</span>
              </span>
            )}
          </div>

          <button
            type="button"
            id="close-mobile-beat-sheet-btn"
            onClick={onClose}
            className="p-2 -mr-1 text-[#8C8C86] hover:text-white rounded-[3px] hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close beat breakdown"
          >
            <X size={18} />
          </button>
        </div>

        {/* Badges strip */}
        <div className="px-4 py-2 bg-[#0E0E0D] border-b border-white/5 flex items-center gap-1.5 flex-wrap shrink-0">
          {beat.shotType && (
            <span className="stamp-chip text-[9px]">
              <Camera size={9} className="mr-1 text-[#9C9C96] shrink-0" />
              {beat.shotType}
            </span>
          )}
          {beat.cameraAngle && (
            <span className="stamp-chip text-[9px]">
              <Video size={9} className="mr-1 text-[#9C9C96] shrink-0" />
              {beat.cameraAngle}
            </span>
          )}
          {beat.cameraMovement && (
            <span className="stamp-chip text-[9px]">
              <Video size={9} className="mr-1 text-[#9C9C96] shrink-0" />
              {beat.cameraMovement}
            </span>
          )}
          {beat.visualSoundEffect && (
            <span className="stamp-chip text-[9px] bg-amber-950/60 text-amber-200 border-amber-700/60 font-bold">
              <Zap size={9} className="mr-1 text-amber-400 shrink-0" />
              SFX: {beat.visualSoundEffect}
            </span>
          )}
          {beat.overlayText && (
            <span className="stamp-chip text-[9px] bg-amber-950/60 text-amber-300 border-amber-800/50 font-mono">
              Overlay: {beat.overlayText}
            </span>
          )}
          <span className="font-mono text-[10px] text-emerald-400/90 ml-auto flex items-center gap-1 tabular-nums">
            <Clock size={10} />
            ~{beat.estimatedSeconds}s
          </span>
        </div>

        {/* Sheet Body */}
        <div className="p-4 overflow-y-auto overscroll-contain space-y-3.5">
          {clipboardError && (
            <div
              role="alert"
              className="p-3 bg-red-950/40 border border-red-700/60 rounded-[3px] text-xs text-red-200 flex items-start gap-2"
            >
              <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <span>{clipboardError}</span>
            </div>
          )}

          {/* Spoken Phrase */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-display text-xs text-[#9C9C96] font-medium">
                Spoken Phrase
              </span>
              <button
                type="button"
                id={`mobile-copy-phrase-btn-${beat.beatIndex}`}
                onClick={() => onCopy(beat.textSpan, `text-${beatKey}`)}
                className="font-display text-xs text-[#9C9C96] hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
              >
                {isCopiedText ? (
                  <>
                    <Check size={11} className="text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    <span>Copy Phrase</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-3 bg-[#0C0C0B] border border-white/10 text-xs sm:text-sm text-[#F5F5F0] italic rounded-[3px]">
              {beat.textSpan && beat.textSpan.trim().length > 0 ? (
                <>&ldquo;{beat.textSpan}&rdquo;</>
              ) : (
                <span className="not-italic font-mono text-xs text-amber-400">
                  [Silent Reaction / Action Beat - No Spoken Dialogue]
                </span>
              )}
            </div>
          </div>

          {beat.visualSoundEffect && (
            <div className="p-3 bg-[#171510] border border-amber-700/40 rounded-[3px] flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Zap size={14} className="text-amber-400 shrink-0" />
                <div>
                  <span className="font-editorial-meta text-[9px] text-amber-300 tracking-wider uppercase block">
                    Visual Sound Effect
                  </span>
                  <span className="font-bold text-xs text-amber-100 tracking-wide">
                    {beat.visualSoundEffect}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-amber-300/80">
                Baked into artwork
              </span>
            </div>
          )}

          {/* Structured Visual / Video Prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-xs tracking-wide flex items-center gap-1.5">
                {isVideoMode ? (
                  <>
                    <Clapperboard size={12} className="text-amber-400" />
                    <span className="text-amber-300 font-medium">Text to Video Prompt</span>
                  </>
                ) : (
                  <>
                    <ImageIcon size={12} className="text-[#C4C4BE]" />
                    <span className="text-white font-medium">Structured Image Prompt</span>
                  </>
                )}
              </span>
              <button
                type="button"
                id={`mobile-copy-prompt-btn-${beat.beatIndex}`}
                onClick={() => {
                  if (onCopyBeatPrompt) {
                    onCopyBeatPrompt(promptToUse, sceneIndex, beat.beatIndex, false);
                  } else {
                    onCopy(promptToUse, `prompt-${beatKey}`);
                  }
                }}
                className="font-display text-xs px-2.5 py-1.5 bg-[#222220] hover:bg-[#2C2C28] text-white border border-white/15 rounded-[3px] transition-colors flex items-center gap-1.5 font-medium cursor-pointer"
              >
                {isCopiedPrompt ? (
                  <>
                    <Check size={11} className="text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    <span>Copy Prompt</span>
                  </>
                )}
              </button>
            </div>

            {isRewritingThisBeat ? (
              <div
                aria-busy="true"
                aria-label="Rewriting beat prompt"
                className="p-3 bg-[#0C0C0B] border border-white/15 rounded-[3px] space-y-2 animate-pulse"
              >
                <div className="h-3 w-5/6 bg-white/10 rounded-[2px]" />
                <div className="h-3 w-full bg-white/10 rounded-[2px]" />
                <div className="h-3 w-4/5 bg-white/10 rounded-[2px]" />
                <div className="h-3 w-2/3 bg-white/10 rounded-[2px]" />
              </div>
            ) : (
              <div
                className={`text-xs leading-relaxed p-3 border rounded-[3px] selection:bg-white selection:text-black font-mono ${
                  isVideoMode
                    ? 'bg-[#0C0C0B] border-amber-700/40 text-[#F0EFEA]'
                    : 'bg-[#0C0C0B] border-white/15 text-[#E8E8E2]'
                }`}
              >
                {promptToUse}
              </div>
            )}

            {/* Quick Rewrite & Undo Action Row */}
            {onRewriteBeat && (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id={`mobile-quick-rewrite-toggle-${beat.beatIndex}`}
                      onClick={() => setIsRewriteOpen((prev) => !prev)}
                      disabled={isRewritingAny}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-display font-medium bg-[#1B1B19] hover:bg-[#252522] text-[#E5E5DF] border border-white/15 rounded-[3px] transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <RefreshCw size={12} className={isRewritingThisBeat ? 'animate-spin' : ''} />
                      <span>Quick Rewrite</span>
                    </button>

                    {canUndoRewrite && onUndoRewrite && (
                      <button
                        type="button"
                        id={`mobile-undo-rewrite-btn-${beat.beatIndex}`}
                        onClick={() => onUndoRewrite(sceneIndex, beat.beatIndex)}
                        disabled={isRewritingAny}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-display font-medium text-[#C4C4BE] hover:text-white bg-transparent hover:bg-white/10 border border-white/10 rounded-[3px] transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <RotateCcw size={12} />
                        <span>Undo Rewrite</span>
                      </button>
                    )}
                  </div>

                  {rewriteSuccessMessage && (
                    <span className="text-xs text-emerald-400 font-narrative">
                      {rewriteSuccessMessage}
                    </span>
                  )}
                </div>

                {isRewriteOpen && (
                  <div className="p-3 bg-[#0E0E0D] border border-white/15 rounded-[3px] space-y-2.5">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="mobile-beat-rewrite-input"
                        className="block font-display text-xs font-medium text-white"
                      >
                        Rewrite Instruction
                      </label>
                      <input
                        type="text"
                        id="mobile-beat-rewrite-input"
                        value={rewriteInstruction}
                        onChange={(e) =>
                          onRewriteInstructionChange && onRewriteInstructionChange(e.target.value)
                        }
                        disabled={isRewritingThisBeat}
                        placeholder="e.g. tighter close-up on hands, warmer lamp glow"
                        className="w-full px-3 py-2 bg-[#141412] text-[#F5F5F0] placeholder:text-[#666660] border border-white/15 rounded-[3px] text-xs focus:outline-none focus:border-white"
                      />
                    </div>

                    {rewriteError && (
                      <div
                        role="alert"
                        className="p-2.5 bg-red-950/35 border border-red-700/60 rounded-[3px] text-xs text-red-200 flex items-center justify-between gap-2"
                      >
                        <span>{rewriteError}</span>
                        <button
                          type="button"
                          onClick={handleSubmitRewrite}
                          disabled={isRewritingThisBeat}
                          className="px-2 py-1 bg-white text-black font-display font-semibold rounded-[3px] text-[11px] shrink-0 cursor-pointer"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsRewriteOpen(false)}
                        disabled={isRewritingThisBeat}
                        className="px-3 py-1.5 text-xs font-display text-[#C4C4BE] hover:text-white bg-[#1B1B19] border border-white/15 rounded-[3px] cursor-pointer disabled:opacity-40"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        id="mobile-submit-rewrite-btn"
                        onClick={handleSubmitRewrite}
                        disabled={isRewritingAny}
                        className="px-3 py-1.5 text-xs font-display font-semibold bg-white text-black hover:bg-[#EAEAE6] rounded-[3px] cursor-pointer disabled:opacity-40"
                      >
                        {isRewritingThisBeat ? 'Rewriting Beat...' : 'Rewrite Beat'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sheet Footer: Cross-Scene Beat Navigator + Copy & Next Beat */}
        <div className="px-3 py-2.5 border-t border-white/10 bg-[#161614] flex items-center justify-between shrink-0 gap-2">
          <button
            type="button"
            disabled={!canGoPrev}
            onClick={handlePrev}
            aria-label="Previous beat"
            className={`min-h-[44px] px-3 text-xs font-display font-medium rounded-[3px] border flex items-center justify-center gap-1 transition-colors cursor-pointer shrink-0 ${
              canGoPrev
                ? 'bg-[#222220] border-white/15 text-white hover:bg-[#2c2c28]'
                : 'bg-white/5 border-transparent text-[#555550] cursor-not-allowed'
            }`}
          >
            <ChevronLeft size={14} />
            <span>Prev</span>
          </button>

          <button
            type="button"
            id={`mobile-copy-next-beat-btn-${beat.beatIndex}`}
            onClick={() => {
              if (onCopyBeatPrompt) {
                onCopyBeatPrompt(promptToUse, sceneIndex, beat.beatIndex, canGoNext);
              } else {
                onCopy(promptToUse, `prompt-${beatKey}`);
                if (canGoNext) handleNext();
              }
            }}
            className={`flex-1 min-h-[44px] px-3 text-xs font-display font-semibold rounded-[3px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              isVideoMode
                ? 'bg-amber-400 text-black hover:bg-amber-300'
                : 'bg-white text-black hover:bg-[#EAEAE6]'
            }`}
          >
            {isCopiedFlash ? (
              <>
                <Check size={13} className="text-black shrink-0" />
                <span>{canGoNext ? 'Copied & Moving' : 'Copied'}</span>
              </>
            ) : (
              <>
                <Copy size={13} className="text-black shrink-0" />
                <span>{canGoNext ? 'Copy & Next Beat' : isVideoMode ? 'Copy Final Prompt' : 'Copy Final Prompt'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={!canGoNext}
            onClick={handleNext}
            aria-label="Next beat"
            className={`min-h-[44px] px-3 text-xs font-display font-medium rounded-[3px] border flex items-center justify-center gap-1 transition-colors cursor-pointer shrink-0 ${
              canGoNext
                ? 'bg-[#222220] border-white/15 text-white hover:bg-[#2c2c28]'
                : 'bg-white/5 border-transparent text-[#555550] cursor-not-allowed'
            }`}
          >
            <span>Next</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
