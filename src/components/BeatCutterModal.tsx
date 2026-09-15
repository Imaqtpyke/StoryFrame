import { useState } from 'react';
import { CustomSceneDefinition, CustomBeatDefinition } from '../types';
import { X, Scissors, Check, Sparkles, AlertCircle } from 'lucide-react';

interface BeatCutterModalProps {
  isOpen: boolean;
  onClose: () => void;
  storyText: string;
  scenes: CustomSceneDefinition[];
  onSave: (scenes: CustomSceneDefinition[]) => void;
  onAutoSegment: () => CustomSceneDefinition[];
}

export default function BeatCutterModal({
  isOpen,
  onClose,
  storyText: _storyText,
  scenes: initialScenes,
  onSave,
  onAutoSegment,
}: BeatCutterModalProps) {
  if (!isOpen) return null;

  const [scenes, setScenes] = useState<CustomSceneDefinition[]>(() => {
    if (initialScenes && initialScenes.length > 0) return initialScenes;
    return onAutoSegment();
  });

  const totalBeats = scenes.reduce((acc, s) => acc + s.beats.length, 0);

  // Split a beat into two halves
  const handleSplitBeat = (sceneIdx: number, beatIdx: number) => {
    const updated = [...scenes];
    const targetScene = updated[sceneIdx];
    const beat = targetScene.beats[beatIdx];
    const words = (beat.textSpan || '').trim().split(/\s+/);
    if (words.length < 2) return;

    const mid = Math.ceil(words.length / 2);
    const p1 = words.slice(0, mid).join(' ');
    const p2 = words.slice(mid).join(' ');

    const newBeat1: CustomBeatDefinition = {
      ...beat,
      textSpan: p1,
    };
    const newBeat2: CustomBeatDefinition = {
      id: `beat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      textSpan: p2,
      userGuidance: '',
      shotType: 'Close-Up',
    };

    const newBeats = [...targetScene.beats];
    newBeats.splice(beatIdx, 1, newBeat1, newBeat2);

    updated[sceneIdx] = {
      ...targetScene,
      beats: newBeats,
    };
    setScenes(updated);
  };

  // Merge beat with the previous beat
  const handleMergeWithPrev = (sceneIdx: number, beatIdx: number) => {
    if (beatIdx <= 0) return;
    const updated = [...scenes];
    const targetScene = updated[sceneIdx];
    const prevBeat = targetScene.beats[beatIdx - 1];
    const currBeat = targetScene.beats[beatIdx];

    const mergedBeat: CustomBeatDefinition = {
      ...prevBeat,
      textSpan: `${prevBeat.textSpan.trim()} ${currBeat.textSpan.trim()}`,
      userGuidance: prevBeat.userGuidance || currBeat.userGuidance,
    };

    const newBeats = [...targetScene.beats];
    newBeats.splice(beatIdx - 1, 2, mergedBeat);

    updated[sceneIdx] = {
      ...targetScene,
      beats: newBeats,
    };
    setScenes(updated);
  };

  // Update text or guidance
  const handleUpdate = (
    sceneIdx: number,
    beatIdx: number,
    field: keyof CustomBeatDefinition,
    val: string
  ) => {
    const updated = [...scenes];
    const targetScene = updated[sceneIdx];
    const newBeats = [...targetScene.beats];
    newBeats[beatIdx] = {
      ...newBeats[beatIdx],
      [field]: val,
    };
    updated[sceneIdx] = {
      ...targetScene,
      beats: newBeats,
    };
    setScenes(updated);
  };

  const handleApply = () => {
    onSave(scenes);
    onClose();
  };

  const handleResetToAuto = () => {
    const fresh = onAutoSegment();
    setScenes(fresh);
  };

  return (
    <div
      id="beat-cutter-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="beat-cutter-modal-panel"
        className="relative w-full max-w-2xl bg-[#111110] border border-white/20 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#181816] border-b border-white/10 shrink-0">
          <div className="flex items-center space-x-2">
            <Scissors size={15} className="text-amber-400" />
            <h2 className="font-display font-semibold text-sm text-white">
              Beat Cutter
            </h2>
            <span className="text-xs px-2 py-0.5 bg-[#252522] border border-white/10 text-amber-300 font-mono">
              {totalBeats} {totalBeats === 1 ? 'beat' : 'beats'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleResetToAuto}
              className="text-xs text-[#9C9C96] hover:text-white flex items-center space-x-1 px-2 py-1 hover:bg-white/5 transition-colors"
              title="Reset cuts to automatic syntax splits"
            >
              <Sparkles size={12} className="text-amber-400" />
              <span className="hidden sm:inline">Reset Auto</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-[#888880] hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-4 flex-1">
          <div className="text-xs text-[#9C9C96] bg-[#161614] border border-white/10 p-2.5 flex items-start space-x-2">
            <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <span>
              Each card is one camera shot. Tap <strong>Split</strong> to break a long line into a new frame, or add an optional note (e.g., <em>no plane visible</em> or <em>landed in forest</em>).
            </span>
          </div>

          <div className="space-y-4">
            {scenes.map((scene, sIdx) => (
              <div
                key={scene.id}
                className="border border-white/15 bg-[#141412] p-3 space-y-2.5"
              >
                <div className="text-[11px] font-editorial-meta font-semibold text-[#A0A098] tracking-wider uppercase flex justify-between items-center border-b border-white/10 pb-1.5">
                  <span>Scene {scene.sceneIndex}</span>
                  <span className="text-[10px] text-[#707068]">
                    {scene.beats.length} {scene.beats.length === 1 ? 'cut' : 'cuts'}
                  </span>
                </div>

                <div className="space-y-2">
                  {scene.beats.map((beat, bIdx) => {
                    const words = beat.textSpan.trim().split(/\s+/).filter(Boolean);
                    const canSplit = words.length >= 2;

                    return (
                      <div
                        key={beat.id}
                        className="bg-[#0A0A09] border border-white/10 p-2.5 space-y-2 transition-all hover:border-white/20"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono text-amber-300/90 font-medium">
                            #{bIdx + 1}
                          </span>

                          <div className="flex items-center space-x-1.5">
                            {canSplit && (
                              <button
                                type="button"
                                onClick={() => handleSplitBeat(sIdx, bIdx)}
                                className="inline-flex items-center space-x-1 px-2 py-0.5 bg-[#20201D] hover:bg-[#2A2A26] border border-white/15 text-[10px] text-white transition-colors"
                              >
                                <Scissors size={10} className="text-amber-400" />
                                <span>Split</span>
                              </button>
                            )}

                            {bIdx > 0 && (
                              <button
                                type="button"
                                onClick={() => handleMergeWithPrev(sIdx, bIdx)}
                                className="text-[10px] text-[#888880] hover:text-white px-1.5 py-0.5"
                                title="Merge with previous beat"
                              >
                                Join ↑
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Spoken Text Span */}
                        <input
                          type="text"
                          value={beat.textSpan}
                          onChange={(e) =>
                            handleUpdate(sIdx, bIdx, 'textSpan', e.target.value)
                          }
                          className="w-full bg-[#121210] border border-white/10 px-2.5 py-1.5 text-xs sm:text-sm text-white focus:border-white focus:outline-none"
                          placeholder="Spoken phrase"
                        />

                        {/* Optional quick visual note */}
                        <input
                          type="text"
                          value={beat.userGuidance || ''}
                          onChange={(e) =>
                            handleUpdate(sIdx, bIdx, 'userGuidance', e.target.value)
                          }
                          className="w-full bg-transparent border-b border-white/10 px-1 py-1 text-[11px] text-amber-200/80 placeholder-[#55554E] focus:border-amber-400 focus:outline-none"
                          placeholder="Director note (e.g. falling from plane, or only clouds, or jungle landing)"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-4 py-3 bg-[#181816] border-t border-white/10 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-[#9C9C96] hover:text-white transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-white hover:bg-neutral-200 text-black font-semibold text-xs transition-colors"
          >
            <Check size={14} />
            <span>Apply Cuts ({totalBeats} Beats)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
