import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Beat, GenerationMode, StyleProfile, StoryFormat } from '../types';
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
} from 'lucide-react';

interface BeatBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  sceneIndex: number;
  sceneRoman: string;
  beat: Beat | null;
  allBeatsInScene: Beat[];
  onNavigateBeat: (nextBeat: Beat) => void;
  copiedIndex: string | null;
  onCopy: (text: string, identifier: string) => void;
  generationMode?: GenerationMode;
  styleProfile?: StyleProfile;
  format?: StoryFormat;
}

export default function BeatBottomSheet({
  isOpen,
  onClose,
  sceneIndex,
  sceneRoman,
  beat,
  allBeatsInScene,
  onNavigateBeat,
  copiedIndex,
  onCopy,
  generationMode = 'image',
  styleProfile,
  format = 'short',
}: BeatBottomSheetProps) {
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

  if (!isOpen || !beat) return null;

  const isVideoMode = generationMode === 'video';
  const currentIndex = allBeatsInScene.findIndex((b) => b.beatIndex === beat.beatIndex);
  const prevBeat = currentIndex > 0 ? allBeatsInScene[currentIndex - 1] : null;
  const nextBeat = currentIndex < allBeatsInScene.length - 1 ? allBeatsInScene[currentIndex + 1] : null;

  const beatKey = `scene-${sceneIndex}-beat-${beat.beatIndex}`;
  const isCopiedPrompt = copiedIndex === `prompt-${beatKey}`;
  const isCopiedText = copiedIndex === `text-${beatKey}`;

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
        className="w-full max-h-[85vh] bg-[#121210] border-t border-white/20 rounded-t-[6px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200 font-narrative text-[#F5F5F0]"
      >
        {/* Drag handle */}
        <div className="pt-2.5 pb-1 flex justify-center shrink-0 cursor-pointer" onClick={onClose}>
          <div className="w-10 h-1 bg-white/25 rounded-[2px]" />
        </div>

        {/* Sheet Header */}
        <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between bg-[#161614] shrink-0">
          <div className="flex items-center space-x-2">
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
              ({currentIndex + 1} of {allBeatsInScene.length})
            </span>
            {isVideoMode ? (
              <span className="stamp-chip bg-amber-950/70 text-amber-300 border-amber-700/80 text-[8px] py-0 px-1.5">
                VIDEO
              </span>
            ) : (
              <span className="stamp-chip bg-white/5 text-[#C4C4BE] border-white/15 text-[8px] py-0 px-1.5">
                IMAGE
              </span>
            )}
          </div>

          <button
            type="button"
            id="close-mobile-beat-sheet-btn"
            onClick={onClose}
            className="p-1.5 -mr-1 text-[#8C8C86] hover:text-white rounded-[3px] hover:bg-white/10 transition-colors cursor-pointer"
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
                    Visual Sound Effect (Comic Lettering)
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
          {(() => {
            const fakeScene = {
              index: sceneIndex,
              narratorLine: beat.textSpan || '',
              estimatedSeconds: beat.estimatedSeconds || 5,
              beats: allBeatsInScene,
            };
            const compiled = compileBeatPrompt(beat, fakeScene, styleProfile, 'universal', format, generationMode);
            const promptToUse = compiled.promptText;

            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
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
                    onClick={() => onCopy(promptToUse, `prompt-${beatKey}`)}
                    className={`font-display text-xs px-3 py-1.5 rounded-[3px] transition-colors flex items-center gap-1.5 font-semibold cursor-pointer ${
                      isVideoMode
                        ? 'bg-amber-400 text-black hover:bg-amber-300'
                        : 'bg-white text-black hover:bg-[#EAEAE5]'
                    }`}
                  >
                    {isCopiedPrompt ? (
                      <>
                        <Check size={11} className="text-black" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={11} className="text-black" />
                        <span>{isVideoMode ? 'Copy Video Prompt' : 'Copy Prompt'}</span>
                      </>
                    )}
                  </button>
                </div>
                <div
                  className={`text-xs leading-relaxed p-3 border rounded-[3px] selection:bg-white selection:text-black font-mono ${
                    isVideoMode
                      ? 'bg-[#0C0C0B] border-amber-700/40 text-[#F0EFEA]'
                      : 'bg-[#0C0C0B] border-white/15 text-[#E8E8E2]'
                  }`}
                >
                  {promptToUse}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Sheet Footer: Beat Navigator */}
        <div className="px-4 py-3 border-t border-white/10 bg-[#161614] flex items-center justify-between shrink-0 gap-2">
          <button
            type="button"
            disabled={!prevBeat}
            onClick={() => prevBeat && onNavigateBeat(prevBeat)}
            className={`flex-1 py-2 px-3 text-xs font-display font-medium rounded-[3px] border flex items-center justify-center gap-1 transition-colors cursor-pointer ${
              prevBeat
                ? 'bg-[#222220] border-white/15 text-white hover:bg-[#2c2c28]'
                : 'bg-white/5 border-transparent text-[#555550] cursor-not-allowed'
            }`}
          >
            <ChevronLeft size={13} />
            <span>Prev Beat</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-2 px-3 text-xs font-display font-medium text-[#9C9C96] hover:text-white transition-colors cursor-pointer"
          >
            Done
          </button>

          <button
            type="button"
            disabled={!nextBeat}
            onClick={() => nextBeat && onNavigateBeat(nextBeat)}
            className={`flex-1 py-2 px-3 text-xs font-display font-medium rounded-[3px] border flex items-center justify-center gap-1 transition-colors cursor-pointer ${
              nextBeat
                ? 'bg-[#222220] border-white/15 text-white hover:bg-[#2c2c28]'
                : 'bg-white/5 border-transparent text-[#555550] cursor-not-allowed'
            }`}
          >
            <span>Next Beat</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
