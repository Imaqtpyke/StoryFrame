import React, { useState } from 'react';
import { X, FileText, Upload, Sparkles, Film, Check, ArrowRight, AlertCircle, Clock, ShieldCheck } from 'lucide-react';
import { ATTACHED_EPISODE_1_MARKDOWN, parseManuscriptMarkdown } from '../services/scriptParser';
import { GenerateStoryRequest, StoryGenerationResult } from '../types';

interface ManuscriptIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDirectResult?: (result: StoryGenerationResult, request: GenerateStoryRequest) => void;
  onLoadIntoForm: (parsed: {
    story: string;
    characterStyle: string;
    format: 'short' | 'long';
    generationMode: 'video' | 'image';
    targetVideoDuration: number;
    platform: string;
  }) => void;
}

export default function ManuscriptIngestModal({
  isOpen,
  onClose,
  onDirectResult,
  onLoadIntoForm,
}: ManuscriptIngestModalProps) {
  const [customMarkdown, setCustomMarkdown] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'attached' | 'custom'>('attached');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOpenAttachedDirectly = () => {
    setIsProcessing(true);
    setFeedbackNotice(null);
    try {
      const parsed = parseManuscriptMarkdown(ATTACHED_EPISODE_1_MARKDOWN);
      const request: GenerateStoryRequest = {
        story: ATTACHED_EPISODE_1_MARKDOWN,
        characterStyle: parsed.storyResult.styleProfile.artStyle,
        format: parsed.format,
        platform: 'TikTok',
        durationMode: 'preset',
        durationSeconds: parsed.totalDurationSeconds,
        generationMode: 'video',
        targetVideoDuration: 4,
        beatMode: 'automatic',
        autoArchitectMode: false,
      };

      if (onDirectResult) {
        onDirectResult(parsed.storyResult, request);
        onClose();
      } else {
        onLoadIntoForm({
          story: ATTACHED_EPISODE_1_MARKDOWN,
          characterStyle: parsed.storyResult.styleProfile.artStyle,
          format: parsed.format,
          generationMode: 'video',
          targetVideoDuration: 4,
          platform: 'TikTok',
        });
        onClose();
      }
    } catch (err: any) {
      setFeedbackNotice(err?.message || 'Failed to parse attached manuscript.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadAttachedToForm = () => {
    const parsed = parseManuscriptMarkdown(ATTACHED_EPISODE_1_MARKDOWN);
    onLoadIntoForm({
      story: ATTACHED_EPISODE_1_MARKDOWN,
      characterStyle: parsed.storyResult.styleProfile.artStyle,
      format: parsed.format,
      generationMode: 'video',
      targetVideoDuration: 4,
      platform: 'TikTok',
    });
    onClose();
  };

  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setCustomMarkdown(content);
        setActiveTab('custom');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleOpenCustomDirectly = () => {
    if (!customMarkdown.trim()) {
      setFeedbackNotice('Please upload or paste a markdown manuscript first.');
      return;
    }
    setIsProcessing(true);
    setFeedbackNotice(null);
    try {
      const parsed = parseManuscriptMarkdown(customMarkdown);
      const request: GenerateStoryRequest = {
        story: customMarkdown,
        characterStyle: parsed.storyResult.styleProfile.artStyle,
        format: parsed.format,
        platform: parsed.format === 'short' ? 'TikTok' : 'YouTube',
        durationMode: 'preset',
        durationSeconds: parsed.totalDurationSeconds,
        generationMode: parsed.generationMode,
        targetVideoDuration: parsed.storyResult.targetVideoDuration || 4,
        beatMode: 'automatic',
        autoArchitectMode: false,
      };

      if (onDirectResult) {
        onDirectResult(parsed.storyResult, request);
        onClose();
      } else {
        onLoadIntoForm({
          story: customMarkdown,
          characterStyle: parsed.storyResult.styleProfile.artStyle,
          format: parsed.format,
          generationMode: parsed.generationMode,
          targetVideoDuration: parsed.storyResult.targetVideoDuration || 4,
          platform: parsed.format === 'short' ? 'TikTok' : 'YouTube',
        });
        onClose();
      }
    } catch (err: any) {
      setFeedbackNotice(err?.message || 'Failed to parse custom manuscript.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-[#141413] border border-white/10 rounded-lg shadow-2xl overflow-hidden font-narrative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ingest-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-[#181817]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/5 border border-white/10 rounded-md text-white">
              <Film className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 id="ingest-modal-title" className="text-base sm:text-lg font-semibold text-white tracking-tight">
                Ingest Production Manuscript
              </h2>
              <p className="text-xs text-[#8C8C86]">
                Directly import structured episode plans, clip timings, and series story bibles
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#8C8C86] hover:text-white hover:bg-white/5 rounded-md transition-colors"
            aria-label="Close manuscript importer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-white/10 bg-[#121211] px-4 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('attached')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'attached'
                ? 'border-white text-white font-semibold'
                : 'border-transparent text-[#8C8C86] hover:text-white'
            }`}
          >
            Attached Episode 1 (Twelve Suspects)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'custom'
                ? 'border-white text-white font-semibold'
                : 'border-transparent text-[#8C8C86] hover:text-white'
            }`}
          >
            Custom Markdown File / Paste
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {feedbackNotice && (
            <div className="p-3 bg-red-950/40 border border-red-800/80 text-red-200 text-xs rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{feedbackNotice}</span>
            </div>
          )}

          {activeTab === 'attached' ? (
            <div className="space-y-4">
              {/* Highlight Card */}
              <div className="p-4 sm:p-5 bg-[#191918] border border-white/15 rounded-md space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      The One Who Doesn't Belong
                    </h3>
                    <p className="text-xs text-amber-300">
                      Episode 1 — Twelve Suspects (9:16 Vertical Video)
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#9C9C96]">
                    <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[11px] text-white">
                      12 Clips (4s each)
                    </span>
                    <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[11px] text-white">
                      48s Total
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-[#A0A09A] leading-relaxed">
                  <p>
                    <strong className="text-white">Premise:</strong> Twelve men enter a million-dollar game to expose one outsider, but every single contestant secretly believes he is the outsider.
                  </p>
                  <p>
                    <strong className="text-white">Language Restriction:</strong> Strictly prohibits the labels “gay” or “straight” in narration, dialogue, on-screen text, or visuals.
                  </p>
                  <p>
                    <strong className="text-white">Continuity Scope:</strong> 11-Episode Series Arc with persistent biometric cast consistency.
                  </p>
                </div>

                {/* Clips Preview List */}
                <div className="pt-2 border-t border-white/10">
                  <span className="text-[11px] font-semibold text-[#8C8C86] uppercase tracking-wider block mb-2">
                    Included Clips (0:00 to 0:48)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
                    {[
                      'Clip 1: The hook (0:00–0:04)',
                      'Clip 2: The prize (0:04–0:08)',
                      'Clip 3: The rules (0:08–0:12)',
                      'Clip 4: The danger (0:12–0:16)',
                      'Clip 5: The first suspicion (0:16–0:20)',
                      'Clip 6: Everyone has a theory (0:20–0:24)',
                      'Clip 7: A private confession (0:24–0:28)',
                      'Clip 8: The same secret (0:28–0:32)',
                      'Clip 9: The audience sees the pattern (0:32–0:36)',
                      'Clip 10: The first vote (0:36–0:40)',
                      'Clip 11: The name (0:40–0:44)',
                      'Clip 12: Cliffhanger (0:44–0:48)',
                    ].map((cName, cIdx) => (
                      <div key={cIdx} className="text-[11px] text-[#A0A09A] bg-[#121211] px-2 py-1 rounded border border-white/5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        <span className="truncate">{cName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleLoadAttachedToForm}
                  disabled={isProcessing}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-[#D4D4D0] hover:text-white bg-[#1C1C1A] hover:bg-[#282826] border border-white/15 rounded-md transition-colors"
                >
                  Load into Generator Form
                </button>

                <button
                  type="button"
                  onClick={handleOpenAttachedDirectly}
                  disabled={isProcessing}
                  className="w-full sm:w-auto px-5 py-2 text-xs font-semibold text-black bg-white hover:bg-neutral-200 rounded-md transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Open in Storyboard Directly (12 Clips)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[#C4C4C0]">
                  Paste Markdown Script or Upload File
                </label>
                <label
                  htmlFor="custom-script-upload"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-white bg-[#1C1C1A] hover:bg-[#282826] border border-white/15 rounded cursor-pointer transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose File (.md / .txt)</span>
                  <input
                    id="custom-script-upload"
                    type="file"
                    accept=".md,.txt"
                    className="hidden"
                    onChange={handleCustomFileUpload}
                  />
                </label>
              </div>

              <textarea
                rows={10}
                value={customMarkdown}
                onChange={(e) => setCustomMarkdown(e.target.value)}
                placeholder="# Series Title&#10;## Episode 1 — Title&#10;&#10;**Format:** Vertical short-form video (9:16)&#10;**Target duration:** 48 seconds&#10;&#10;### Clip 1 — The Hook (0:00–0:04)&#10;**Voice-over:** &quot;...&quot;&#10;**Visual:** ..."
                className="w-full p-3 bg-[#121211] text-white text-xs font-mono border border-white/10 rounded focus:outline-none focus:border-white leading-relaxed resize-y"
              />

              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const parsed = parseManuscriptMarkdown(customMarkdown);
                      onLoadIntoForm({
                        story: customMarkdown,
                        characterStyle: parsed.storyResult.styleProfile.artStyle,
                        format: parsed.format,
                        generationMode: parsed.generationMode,
                        targetVideoDuration: parsed.storyResult.targetVideoDuration || 4,
                        platform: parsed.format === 'short' ? 'TikTok' : 'YouTube',
                      });
                      onClose();
                    } catch (err: any) {
                      setFeedbackNotice(err?.message || 'Failed to parse custom manuscript.');
                    }
                  }}
                  disabled={!customMarkdown.trim() || isProcessing}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-[#D4D4D0] hover:text-white bg-[#1C1C1A] hover:bg-[#282826] border border-white/15 rounded-md transition-colors disabled:opacity-40"
                >
                  Load into Form
                </button>

                <button
                  type="button"
                  onClick={handleOpenCustomDirectly}
                  disabled={!customMarkdown.trim() || isProcessing}
                  className="w-full sm:w-auto px-5 py-2 text-xs font-semibold text-black bg-white hover:bg-neutral-200 rounded-md transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-40"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Open in Storyboard Directly</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-white/10 bg-[#181817] flex items-center justify-between text-xs text-[#7A7A74]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Deterministic Parsing · Zero hallucinated alterations · 8-Part Video Prompts</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[#A0A09A] hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
