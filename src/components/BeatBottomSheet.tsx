import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Beat, GenerationMode } from '../types';
import { 
  X, 
  Copy, 
  Check, 
  Camera, 
  Video, 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  Sparkles,
  Clapperboard,
  Image as ImageIcon
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
}: BeatBottomSheetProps) {
  // Lock body scroll when bottom sheet is open
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

  // Handle escape key
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
        className="w-full max-h-[85vh] bg-[#121210] border-t border-white/20 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250 font-narrative text-[#F5F5F0]"
      >
        {/* Drag handle */}
        <div className="pt-2.5 pb-1 flex justify-center shrink-0 cursor-pointer" onClick={onClose}>
          <div className="w-10 h-1 bg-white/25 rounded-full" />
        </div>

        {/* Sheet Header */}
        <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between bg-[#161614] shrink-0">
          <div className="flex items-center space-x-2">
            <span className={`stamp-chip font-bold text-[10px] ${
              isVideoMode ? 'bg-amber-950/70 text-amber-300 border-amber-800/80' : 'bg-sky-950/25 text-sky-200/70 border-sky-800/25'
            }`}>
              BEAT {String(beat.beatIndex).padStart(2, '0')}
            </span>
            <span className="font-editorial-meta text-[10px] text-[#A8A8A2]">
              SCENE {sceneRoman}
            </span>
            <span className="font-editorial-meta text-[9px] text-[#7D7D76]">
              ({currentIndex + 1} of {allBeatsInScene.length})
            </span>
            {isVideoMode ? (
              <span className="stamp-chip bg-amber-950/70 text-amber-300 border-amber-800/80 text-[8px] py-0 px-1">
                VIDEO
              </span>
            ) : (
              <span className="stamp-chip bg-sky-950/25 text-sky-200/70 border-sky-800/25 text-[8px] py-0 px-1">
                IMAGE
              </span>
            )}
          </div>

          <button
            type="button"
            id="close-mobile-beat-sheet-btn"
            onClick={onClose}
            className="p-1.5 -mr-1 text-[#8C8C86] hover:text-white rounded-full hover:bg-white/10 transition-colors"
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
          <span className="font-editorial-meta text-[9px] text-emerald-400/90 ml-auto flex items-center gap-0.5">
            <Clock size={9} />
            ~{beat.estimatedSeconds}s
          </span>
        </div>

        {/* Sheet Body */}
        <div className="p-4 overflow-y-auto overscroll-contain space-y-3.5">
          {/* Spoken Phrase */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-editorial-meta text-[9px] text-[#9C9C96] tracking-wider uppercase">
                Spoken Phrase
              </span>
              <button
                type="button"
                id={`mobile-copy-phrase-btn-${beat.beatIndex}`}
                onClick={() => onCopy(beat.textSpan, `text-${beatKey}`)}
                className="font-editorial-meta text-[9px] text-[#9C9C96] hover:text-white transition-colors flex items-center gap-1"
              >
                {isCopiedText ? (
                  <>
                    <Check size={10} className="text-emerald-400" />
                    <span className="text-emerald-400">COPIED</span>
                  </>
                ) : (
                  <>
                    <Copy size={10} />
                    <span>COPY PHRASE</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-2.5 bg-[#0A0A09] border border-white/10 text-xs text-[#F5F5F0] italic rounded">
              &ldquo;{beat.textSpan}&rdquo;
            </div>
          </div>

          {/* Structured Visual / Video Prompt */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-editorial-meta text-[9px] text-[#9C9C96] tracking-wider uppercase flex items-center gap-1">
                {isVideoMode ? (
                  <>
                    <Clapperboard size={10} className="text-amber-400" />
                    <span className="text-amber-300 font-medium">Text to Video Prompt</span>
                  </>
                ) : (
                  <>
                    <ImageIcon size={10} className="text-sky-400/60" />
                    <span className="text-sky-200/70 font-medium">Structured Image Prompt</span>
                  </>
                )}
              </span>
              <button
                type="button"
                id={`mobile-copy-prompt-btn-${beat.beatIndex}`}
                onClick={() => onCopy(beat.imagePrompt, `prompt-${beatKey}`)}
                className={`font-editorial-meta text-[9px] px-2.5 py-1 rounded transition-colors flex items-center gap-1 font-semibold ${
                  isVideoMode
                    ? 'bg-amber-400 text-black hover:bg-amber-300'
                    : 'bg-sky-400/70 text-black hover:bg-sky-400'
                }`}
              >
                {isCopiedPrompt ? (
                  <>
                    <Check size={10} className="text-black" />
                    <span>COPIED</span>
                  </>
                ) : (
                  <>
                    <Copy size={10} className="text-black" />
                    <span>{isVideoMode ? 'COPY VIDEO PROMPT' : 'COPY IMAGE PROMPT'}</span>
                  </>
                )}
              </button>
            </div>
            <div className={`text-xs leading-relaxed p-3 border rounded selection:bg-white selection:text-black font-mono ${
              isVideoMode ? 'bg-[#080807] border-amber-900/40 text-[#F0EFEA]' : 'bg-[#04070C] border-sky-900/20 text-[#D0DFEB]'
            }`}>
              {beat.imagePrompt}
            </div>
          </div>
        </div>

        {/* Sheet Footer: Beat Navigator */}
        <div className="px-4 py-3 border-t border-white/10 bg-[#161614] flex items-center justify-between shrink-0 gap-2">
          <button
            type="button"
            disabled={!prevBeat}
            onClick={() => prevBeat && onNavigateBeat(prevBeat)}
            className={`flex-1 py-2 px-2.5 text-[10px] font-editorial-meta font-medium uppercase rounded border flex items-center justify-center gap-1 transition-colors ${
              prevBeat
                ? 'bg-[#222220] border-white/15 text-white hover:bg-[#2c2c28]'
                : 'bg-white/5 border-transparent text-[#555550] cursor-not-allowed'
            }`}
          >
            <ChevronLeft size={12} />
            <span>Prev Beat</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-2 px-3 text-[10px] font-editorial-meta font-medium uppercase text-[#8C8C86] hover:text-white transition-colors"
          >
            Done
          </button>

          <button
            type="button"
            disabled={!nextBeat}
            onClick={() => nextBeat && onNavigateBeat(nextBeat)}
            className={`flex-1 py-2 px-2.5 text-[10px] font-editorial-meta font-medium uppercase rounded border flex items-center justify-center gap-1 transition-colors ${
              nextBeat
                ? 'bg-[#222220] border-white/15 text-white hover:bg-[#2c2c28]'
                : 'bg-white/5 border-transparent text-[#555550] cursor-not-allowed'
            }`}
          >
            <span>Next Beat</span>
            <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
