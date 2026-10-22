import React, { useState } from 'react';
import { X, Film, CheckCircle, Clock, Copy, Check, Sparkles, AlertCircle } from 'lucide-react';
import { SeriesEpisode } from '../services/scriptParser';

interface SeriesRoadmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  seriesTitle?: string;
  roadmap?: SeriesEpisode[];
  onSelectEpisodeForGeneration?: (episode: SeriesEpisode) => void;
  onSaveContinuity?: () => void;
  isSaved?: boolean;
}

export default function SeriesRoadmapModal({
  isOpen,
  onClose,
  seriesTitle = "Series Continuity Roadmap",
  roadmap = [],
  onSelectEpisodeForGeneration,
  onSaveContinuity,
  isSaved = false,
}: SeriesRoadmapModalProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const defaultRoadmap: SeriesEpisode[] = roadmap.length > 0 ? roadmap : [
    { episodeNumber: 1, title: 'Episode 1 — Twelve Suspects', description: 'Introduce the prize, rules, contestants’ paranoia, and first-vote cliffhanger.', status: 'completed' },
    { episodeNumber: 2, title: 'Episode 2 — The First Name', description: 'Reveal the first eliminated contestant and show how the vote creates alliances.', status: 'planned' },
    { episodeNumber: 3, title: 'Episode 3 — The Perfect Act', description: 'A confident contestant becomes the new target after a suspicious conversation.', status: 'planned' },
    { episodeNumber: 4, title: 'Episode 4 — The Private Interviews', description: 'Conflicting confessions make the contestants doubt their own theories.', status: 'planned' },
    { episodeNumber: 5, title: 'Episode 5 — The Alliance', description: 'Several contestants agree to protect one another, but one secretly breaks the deal.', status: 'planned' },
    { episodeNumber: 6, title: 'Episode 6 — The Wrong Suspect', description: 'The group eliminates someone they are certain is the outsider.', status: 'planned' },
    { episodeNumber: 7, title: 'Episode 7 — The Pattern', description: 'A contestant notices that everyone seems to be hiding the same kind of fear.', status: 'planned' },
    { episodeNumber: 8, title: 'Episode 8 — The House Turns', description: 'An argument fractures the remaining alliances, and the vote becomes personal.', status: 'planned' },
    { episodeNumber: 9, title: 'Episode 9 — No One Trusts Anyone', description: 'The contestants are close to the final two, but their theories contradict one another.', status: 'planned' },
    { episodeNumber: 10, title: 'Episode 10 — Two Remain', description: 'The final vote leaves two contestants facing the prize briefcase.', status: 'planned' },
    { episodeNumber: 11, title: 'Episode 11 — The Real Twist', description: 'The host reveals that every contestant believed he was the outsider. The real trick was that there was no actual outsider among them; the contestants had misunderstood the premise and projected their own fears onto one another.', status: 'planned' },
  ];

  const handleCopyEpisode = (index: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-[#141413] border border-white/10 rounded-lg shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="series-roadmap-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-[#191918]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/5 border border-white/10 rounded-md text-white">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 id="series-roadmap-title" className="text-base sm:text-lg font-semibold text-white tracking-tight">
                Series Continuity: 11 Episodes
              </h2>
              <p className="text-xs text-[#8C8C86]">
                {seriesTitle} · Vertical 9:16 Short-Form Mystery
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#8C8C86] hover:text-white hover:bg-white/5 rounded-md transition-colors"
            aria-label="Close series roadmap"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Continuity Directives */}
          <div className="p-3.5 bg-[#191918] border border-white/10 rounded-md space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Locked Continuity Directives</span>
            </div>
            <ul className="text-xs text-[#A0A09A] space-y-1.5 list-disc pl-4">
              <li>
                <strong className="text-white">Language Rule:</strong> Do not use the labels “gay” or “straight” in narration, dialogue, on-screen text, or generated visuals.
              </li>
              <li>
                <strong className="text-white">Cast Biometrics:</strong> Maintain identical facial features, haircuts, and wardrobe palettes for the 12 male contestants across voting cycles.
              </li>
              <li>
                <strong className="text-white">Secret Premise:</strong> Every contestant believes he alone is the outsider. The audience sees the pattern through private confessions.
              </li>
            </ul>
          </div>

          {/* Episode List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#7A7A74]">
                11-Episode Production Arc
              </span>
              <span className="text-xs text-[#8C8C86]">
                Target: 48s per episode (12 clips × 4s)
              </span>
            </div>

            <div className="space-y-2.5">
              {defaultRoadmap.map((ep, idx) => {
                const isCompleted = ep.status === 'completed';
                return (
                  <div
                    key={ep.episodeNumber}
                    className={`p-3.5 rounded-md border transition-colors ${
                      isCompleted
                        ? 'bg-white/[0.04] border-white/20'
                        : 'bg-[#181817] border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">
                            {ep.title}
                          </span>
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                              <CheckCircle className="w-3 h-3" />
                              Active Storyboard
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#7A7A74] font-medium">
                              <Clock className="w-3 h-3" />
                              Planned
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#8C8C86] leading-relaxed">
                          {ep.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyEpisode(idx, `${ep.title}\n${ep.description}`)}
                          className="p-1.5 text-[#8C8C86] hover:text-white hover:bg-white/5 rounded transition-colors"
                          title="Copy episode outline"
                        >
                          {copiedIndex === idx ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {onSelectEpisodeForGeneration && !isCompleted && (
                          <button
                            type="button"
                            onClick={() => onSelectEpisodeForGeneration(ep)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white bg-white/10 hover:bg-white/20 border border-white/15 rounded transition-colors"
                          >
                            <Sparkles className="w-3 h-3" />
                            Draft Episode
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-[#191918] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isSaved ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle className="w-4 h-4" />
                <span>Continuity Saved & Locked in Storage</span>
              </span>
            ) : (
              <span className="text-xs text-[#7A7A74]">
                Character Sheet & Style Profile will persist across future episode generations.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onSaveContinuity && (
              <button
                type="button"
                onClick={onSaveContinuity}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-md transition-colors flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSaved ? 'Re-Save Continuity' : 'Approve & Save Continuity'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-md transition-colors"
            >
              Close Roadmap
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
