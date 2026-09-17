import { useState, useId } from 'react';
import { CustomSceneDefinition, CustomBeatDefinition } from '../types';
import { Scissors, Plus, Trash2, ArrowRight, Sparkles, ChevronDown, ChevronUp, Layers } from 'lucide-react';

interface CustomBeatEditorProps {
  storyText: string;
  scenes: CustomSceneDefinition[];
  onChange: (scenes: CustomSceneDefinition[]) => void;
  onAutoSegment: () => void;
  disabled?: boolean;
}

const SHOT_OPTIONS = [
  'Wide Shot',
  'Medium Shot',
  'Close-Up',
  'Extreme Close-Up',
  'Over-the-Shoulder',
  'Low Angle',
  'High Angle',
  'POV',
  'Whip-Pan'
];

export default function CustomBeatEditor({
  storyText,
  scenes,
  onChange,
  onAutoSegment,
  disabled = false,
}: CustomBeatEditorProps) {
  const [collapsedScenes, setCollapsedScenes] = useState<Record<string, boolean>>({});

  const toggleCollapse = (sceneId: string) => {
    setCollapsedScenes((prev) => ({
      ...prev,
      [sceneId]: !prev[sceneId],
    }));
  };

  // Add a brand new scene
  const handleAddScene = () => {
    const newSceneIndex = scenes.length + 1;
    const newScene: CustomSceneDefinition = {
      id: `scene-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sceneIndex: newSceneIndex,
      narratorLine: '',
      beats: [
        {
          id: `beat-${Date.now()}-1`,
          textSpan: '',
          userGuidance: '',
          shotType: 'Medium Shot',
        },
      ],
    };
    onChange([...scenes, newScene]);
  };

  // Delete scene
  const handleDeleteScene = (sceneIndex: number) => {
    if (scenes.length <= 1) return;
    const updated = scenes
      .filter((_, idx) => idx !== sceneIndex)
      .map((s, idx) => ({ ...s, sceneIndex: idx + 1 }));
    onChange(updated);
  };

  // Update scene narrator line
  const handleSceneNarratorChange = (sceneIndex: number, text: string) => {
    const updated = [...scenes];
    updated[sceneIndex] = {
      ...updated[sceneIndex],
      narratorLine: text,
    };
    onChange(updated);
  };

  // Add beat to scene
  const handleAddBeat = (sceneIndex: number) => {
    const updated = [...scenes];
    const targetScene = updated[sceneIndex];
    const newBeat: CustomBeatDefinition = {
      id: `beat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      textSpan: '',
      userGuidance: '',
      shotType: 'Medium Shot',
    };
    updated[sceneIndex] = {
      ...targetScene,
      beats: [...targetScene.beats, newBeat],
    };
    onChange(updated);
  };

  // Delete beat from scene
  const handleDeleteBeat = (sceneIndex: number, beatIndex: number) => {
    const updated = [...scenes];
    const targetScene = updated[sceneIndex];
    if (targetScene.beats.length <= 1) return;
    updated[sceneIndex] = {
      ...targetScene,
      beats: targetScene.beats.filter((_, idx) => idx !== beatIndex),
    };
    onChange(updated);
  };

  // Update a beat
  const handleUpdateBeat = (
    sceneIndex: number,
    beatIndex: number,
    field: keyof CustomBeatDefinition,
    value: string
  ) => {
    const updated = [...scenes];
    const targetScene = updated[sceneIndex];
    const updatedBeats = [...targetScene.beats];
    updatedBeats[beatIndex] = {
      ...updatedBeats[beatIndex],
      [field]: value,
    };
    updated[sceneIndex] = {
      ...targetScene,
      beats: updatedBeats,
    };
    onChange(updated);
  };

  // Split a beat into two at a cursor or space
  const handleSplitBeat = (sceneIndex: number, beatIndex: number) => {
    const updated = [...scenes];
    const targetScene = updated[sceneIndex];
    const currentBeat = targetScene.beats[beatIndex];
    const words = (currentBeat.textSpan || '').trim().split(/\s+/);
    if (words.length < 2) return;

    const mid = Math.ceil(words.length / 2);
    const firstPart = words.slice(0, mid).join(' ');
    const secondPart = words.slice(mid).join(' ');

    const newBeat1: CustomBeatDefinition = {
      ...currentBeat,
      textSpan: firstPart,
    };
    const newBeat2: CustomBeatDefinition = {
      id: `beat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      textSpan: secondPart,
      userGuidance: '',
      shotType: 'Close-Up',
    };

    const newBeats = [...targetScene.beats];
    newBeats.splice(beatIndex, 1, newBeat1, newBeat2);

    updated[sceneIndex] = {
      ...targetScene,
      beats: newBeats,
    };
    onChange(updated);
  };

  return (
    <div id="custom-beat-editor-container" className="space-y-4 pt-1">
      {/* Header bar with auto-segment button & explanation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-white/10">
        <div>
          <h3 className="text-sm font-semibold text-white font-display flex items-center gap-1.5">
            <Layers size={15} className="text-amber-400" />
            <span>Interactive Scene & Beat Director</span>
          </h3>
          <p className="text-xs text-[#9C9C96] mt-0.5 font-narrative">
            Choose exactly where each visual beat starts and stops. Add director notes to ensure no repeated frames.
          </p>
        </div>

        <button
          type="button"
          onClick={onAutoSegment}
          disabled={disabled || !storyText.trim()}
          className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 text-xs bg-[#1A1A18] hover:bg-[#252522] border border-white/15 text-[#E0E0D8] transition-colors self-start sm:self-auto font-narrative"
        >
          <Sparkles size={13} className="text-amber-400" />
          <span>Auto-Partition from Story</span>
        </button>
      </div>

      {/* Story reference card */}
      {storyText && (
        <div className="p-3 bg-[#111110] border border-white/10 text-xs text-[#B8B8B0] leading-relaxed max-h-24 overflow-y-auto font-narrative">
          <span className="font-editorial-meta text-[10px] text-[#808078] block mb-1">
            SOURCE STORY REFERENCE:
          </span>
          {storyText}
        </div>
      )}

      {/* Scenes container */}
      <div className="space-y-3.5">
        {scenes.map((scene, sIdx) => {
          const isCollapsed = collapsedScenes[scene.id];
          return (
            <div
              key={scene.id}
              className="bg-[#121211] border border-white/15 overflow-hidden transition-all"
            >
              {/* Scene Top Bar */}
              <div className="flex items-center justify-between px-3 py-2 bg-[#181816] border-b border-white/10">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <span className="font-display font-semibold text-xs text-white uppercase tracking-wider">
                    Scene {scene.sceneIndex}
                  </span>
                  <span className="text-[11px] text-[#888880]">
                    ({scene.beats.length} {scene.beats.length === 1 ? 'beat' : 'beats'})
                  </span>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(scene.id)}
                    className="p-1 text-[#9C9C96] hover:text-white transition-colors"
                    title={isCollapsed ? 'Expand scene' : 'Collapse scene'}
                  >
                    {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>
                  {scenes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteScene(sIdx)}
                      disabled={disabled}
                      className="p-1 text-[#888880] hover:text-red-400 transition-colors"
                      title="Remove scene"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Scene Body */}
              {!isCollapsed && (
                <div className="p-3 sm:p-4 space-y-3">
                  {/* Scene voiceover line */}
                  <div>
                    <label className="font-editorial-meta text-[10px] text-[#A0A098] block mb-1 font-semibold">
                      SCENE NARRATION LINE
                    </label>
                    <textarea
                      value={scene.narratorLine}
                      onChange={(e) => handleSceneNarratorChange(sIdx, e.target.value)}
                      placeholder="e.g. She fell two miles through open air, strapped to three airplane seats, and survived."
                      rows={2}
                      disabled={disabled}
                      className="w-full bg-[#0E0E0D] border border-white/15 px-3 py-2 text-xs sm:text-sm text-white focus:border-white focus:outline-none placeholder-[#505048] resize-none"
                    />
                  </div>

                  {/* Beats in this scene */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="font-editorial-meta text-[10px] text-[#A0A098] uppercase tracking-wider font-semibold">
                        VISUAL BEATS & PROGRESSION
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddBeat(sIdx)}
                        disabled={disabled}
                        className="inline-flex items-center space-x-1 text-[11px] text-amber-300 hover:text-amber-200 transition-colors"
                      >
                        <Plus size={12} />
                        <span>Add Beat</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {scene.beats.map((beat, bIdx) => (
                        <div
                          key={beat.id}
                          className="bg-[#0A0A09] border border-white/10 p-2.5 sm:p-3 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-display font-medium text-[#E0E0D8] text-[11px]">
                                Beat {bIdx + 1}
                              </span>
                              {((sIdx > 0 && bIdx === 0) || (sIdx < scenes.length - 1 && bIdx === scene.beats.length - 1)) && (
                                <span className="inline-flex items-center gap-1 text-[8px] font-editorial-meta text-amber-400 bg-amber-950/40 border border-amber-800/40 px-1.5 py-0.5 rounded-[1px]" title="Editing-stage transition anchor beat connecting adjacent scenes">
                                  <Layers size={8} />
                                  <span>Scene Transition Beat</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-1">
                              {/* Split phrase button */}
                              {beat.textSpan.trim().split(/\s+/).length >= 2 && (
                                <button
                                  type="button"
                                  onClick={() => handleSplitBeat(sIdx, bIdx)}
                                  disabled={disabled}
                                  className="inline-flex items-center space-x-1 px-1.5 py-0.5 bg-[#181816] hover:bg-[#222220] text-[10px] text-[#A8A8A0] hover:text-white border border-white/10"
                                  title="Split this beat into two sub-beats"
                                >
                                  <Scissors size={10} />
                                  <span>Split</span>
                                </button>
                              )}
                              {scene.beats.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBeat(sIdx, bIdx)}
                                  disabled={disabled}
                                  className="p-1 text-[#707068] hover:text-red-400 transition-colors"
                                  title="Delete beat"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Beat text span */}
                          <div>
                            <label className="font-editorial-meta text-[9px] text-[#808078] block mb-0.5">
                              TEXT SPAN (Spoken Phrase)
                            </label>
                            <input
                              type="text"
                              value={beat.textSpan}
                              onChange={(e) =>
                                handleUpdateBeat(sIdx, bIdx, 'textSpan', e.target.value)
                              }
                              placeholder="e.g. She fell"
                              disabled={disabled}
                              className="w-full bg-[#141412] border border-white/10 px-2.5 py-1.5 text-xs text-white focus:border-white focus:outline-none placeholder-[#505048]"
                            />
                          </div>

                          {/* Director's Note & Preferred Shot Type */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="sm:col-span-2">
                              <label className="font-editorial-meta text-[9px] text-[#808078] block mb-0.5">
                                VISUAL PROGRESSION NOTE (Optional)
                              </label>
                              <input
                                type="text"
                                value={beat.userGuidance || ''}
                                onChange={(e) =>
                                  handleUpdateBeat(sIdx, bIdx, 'userGuidance', e.target.value)
                                }
                                placeholder="e.g. Breaking from plane, or Freefall no plane, or Landed in jungle"
                                disabled={disabled}
                                className="w-full bg-[#141412] border border-white/10 px-2.5 py-1.5 text-xs text-amber-200/90 focus:border-amber-400 focus:outline-none placeholder-[#505048]"
                              />
                            </div>

                            <div>
                              <label className="font-editorial-meta text-[9px] text-[#808078] block mb-0.5">
                                PREFERRED SHOT
                              </label>
                              <select
                                value={beat.shotType || 'Medium Shot'}
                                onChange={(e) =>
                                  handleUpdateBeat(sIdx, bIdx, 'shotType', e.target.value)
                                }
                                disabled={disabled}
                                className="w-full bg-[#141412] border border-white/10 px-2 py-1.5 text-xs text-white focus:border-white focus:outline-none"
                              >
                                {SHOT_OPTIONS.map((shot) => (
                                  <option key={shot} value={shot}>
                                    {shot}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Editing Transition Note (Optional) */}
                          <div>
                            <div className="flex items-center justify-between mb-0.5">
                              <label className="font-editorial-meta text-[9px] text-[#808078] flex items-center gap-1">
                                <Scissors size={8} className="text-amber-400" />
                                <span>EDITING NOTE / TRANSITION ANCHOR (Optional)</span>
                              </label>
                              <span className="text-[8px] font-editorial-meta text-[#606058] italic">Post-edit cut / dissolve anchor</span>
                            </div>
                            <input
                              type="text"
                              value={beat.transitionHint || ''}
                              onChange={(e) =>
                                handleUpdateBeat(sIdx, bIdx, 'transitionHint', e.target.value)
                              }
                              placeholder="e.g. Shared circular silhouette / match cut on horizon line"
                              disabled={disabled}
                              className="w-full bg-[#141412] border border-white/10 px-2.5 py-1.5 text-xs text-amber-300/90 focus:border-amber-400 focus:outline-none placeholder-[#505048]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Scene button */}
      <button
        type="button"
        onClick={handleAddScene}
        disabled={disabled}
        className="w-full py-2.5 border border-dashed border-white/20 hover:border-white/40 bg-[#121211]/50 hover:bg-[#121211] text-xs font-medium text-[#C0C0B8] hover:text-white transition-all flex items-center justify-center space-x-1.5"
      >
        <Plus size={14} />
        <span>Add Another Scene</span>
      </button>
    </div>
  );
}
