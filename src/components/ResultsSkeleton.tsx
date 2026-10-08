import React, { useState, useEffect } from 'react';
import { GenerateStoryRequest } from '../types';
import {
  ArrowLeft,
  Clapperboard,
  Image as ImageIcon,
  Sparkles,
  Clock,
  Copy,
  Layers,
  Film,
  Camera,
  XCircle,
} from 'lucide-react';

interface ResultsSkeletonProps {
  request?: GenerateStoryRequest | null;
  onBackToEdit: () => void;
  onCancelRequest?: () => void;
}

const PHASES = [
  'Analyzing screenplay structure & dramatic tension...',
  'Extracting locked character sheets & visual continuity...',
  'Directing camera shot taxonomies & framing...',
  'Calibrating narration voiceover pacing & timestamps...',
  'Synthesizing visual prompts & cinematic anchors...',
];

export default function ResultsSkeleton({ request, onBackToEdit, onCancelRequest }: ResultsSkeletonProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [progress, setProgress] = useState(8);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isVideoMode = request?.generationMode === 'video';
  const autoArchitectMode = request?.autoArchitectMode || false;
  const platform = request?.platform || 'TikTok';
  const format = request?.format || 'short';

  useEffect(() => {
    // Cycle through realistic production phases
    const phaseInterval = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % PHASES.length);
    }, 2800);

    // Smooth progress bar simulation & elapsed timer
    const startTime = performance.now();
    const progressInterval = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      setElapsedSeconds(Math.floor(elapsed));
      // Asymptote towards 95%
      const target = 95 * (1 - Math.exp(-elapsed / 6));
      setProgress(Math.min(95, Math.max(8, target)));
    }, 120);

    return () => {
      clearInterval(phaseInterval);
      clearInterval(progressInterval);
    };
  }, []);

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remaining = sec % 60;
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  return (
    <div
      className="w-full max-w-5xl mx-auto space-y-6 sm:space-y-8 font-narrative text-[#F5F5F0]"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onBackToEdit}
            className="inline-flex items-center text-xs sm:text-sm text-[#9C9C96] hover:text-white transition-colors min-h-[32px] sm:min-h-[40px] py-1 sm:py-1.5 font-display cursor-pointer"
          >
            <ArrowLeft size={13} className="mr-1.5 shrink-0 sm:w-3.5 sm:h-3.5" />
            Edit Story and Settings
          </button>
        </div>

        {/* Real technical configuration badges from user's request */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {isVideoMode ? (
            <span className="stamp-chip bg-amber-950/70 text-amber-300 border-amber-800/80 font-semibold">
              <Clapperboard size={9} className="mr-1 inline text-amber-400" />
              TEXT TO VIDEO ({request?.targetVideoDuration || 5}S CLIPS)
            </span>
          ) : (
            <span className="stamp-chip bg-sky-950/25 text-sky-200/70 border-sky-800/25 font-semibold">
              <ImageIcon size={9} className="mr-1 inline text-sky-400/60" />
              TEXT TO IMAGE
            </span>
          )}
          {autoArchitectMode && (
            <span className="stamp-chip bg-amber-950/40 text-amber-300 border-amber-800/50">
              <Sparkles size={9} className="mr-1 inline text-amber-400" />
              AUTO ARCHITECT
            </span>
          )}
          <span className="stamp-chip">
            {platform.toUpperCase()} ({format === 'long' ? '16:9' : '9:16'})
          </span>
          <span className="stamp-chip bg-white/10 text-white animate-pulse">
            GENERATING...
          </span>
          {onCancelRequest && (
            <button
              type="button"
              onClick={onCancelRequest}
              className="inline-flex items-center px-2.5 py-1 text-xs font-mono rounded-[2px] bg-red-950/40 text-red-300 border border-red-800/60 hover:bg-red-900/60 hover:text-white transition-all cursor-pointer"
              title="Cancel current generation and return to editor"
            >
              <XCircle size={12} className="mr-1.5 shrink-0 text-red-400" />
              Cancel Request
            </button>
          )}
        </div>
      </div>

      {/* Production Progress & Phase Banner */}
      <div className="bg-[#111110] border border-white/10 p-4 sm:p-5 corner-bracket-container shadow-2xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2 h-2 rounded-full animate-ping shrink-0 ${
                autoArchitectMode ? 'bg-amber-400' : 'bg-white'
              }`}
            />
            <span className="font-editorial-meta text-xs tracking-wider uppercase text-white font-medium">
              {autoArchitectMode ? 'ARCHITECTING STORY & SCENE BREAKDOWN' : 'GENERATING CINEMATIC STORYBOARD'}
            </span>
          </div>
          <div className="flex items-center space-x-3 text-xs font-mono text-[#888882]">
            <span>Elapsed: {formatElapsed(elapsedSeconds)}</span>
            <span className="text-[#A0A09A] font-semibold">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Phase Description */}
        <p className="text-xs sm:text-sm text-[#C4C4BE] font-narrative transition-all duration-300 min-h-[20px]">
          {PHASES[phaseIndex]}
        </p>

        {/* Shimmering Progress Bar */}
        <div className="w-full h-1.5 bg-[#1F1F1D] rounded-[1px] overflow-hidden relative">
          <div
            className={`h-full transition-all duration-200 relative ${
              autoArchitectMode ? 'bg-amber-400' : 'bg-white'
            }`}
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-liquid-shimmer" />
          </div>
        </div>

        {/* Long story informative notice */}
        {elapsedSeconds >= 35 && (
          <div className="pt-2 text-xs text-[#9C9C96] flex items-center justify-between border-t border-white/5">
            <span>
              Detailed cinematic breakdown in progress. Long-form stories take extra time to calibrate.
            </span>
            {onCancelRequest && (
              <button
                type="button"
                onClick={onCancelRequest}
                className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2 ml-2 cursor-pointer shrink-0"
              >
                Cancel Request
              </button>
            )}
          </div>
        )}
      </div>

      {/* Visual Pacing Timeline Bar Skeleton */}
      <div className="bg-[#111110] border border-white/10 p-3 sm:p-5 space-y-2.5 corner-bracket-container shadow-2xl">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <Clock size={12} className="text-[#9C9C96]" />
            <span className="font-editorial-meta text-[10px] text-[#C4C4C0] font-medium">
              VISUAL PACING TIMELINE
            </span>
          </div>
          <div className="h-3 w-16 bg-white/10 rounded-[2px] animate-pulse" />
        </div>
        <div className="h-6 w-full bg-[#171715] border border-white/5 rounded-[2px] overflow-hidden flex gap-1 p-1">
          <div className="h-full w-1/4 bg-white/10 rounded-[1px] animate-pulse" />
          <div className="h-full w-1/3 bg-white/15 rounded-[1px] animate-pulse" style={{ animationDelay: '150ms' }} />
          <div className="h-full w-1/4 bg-white/10 rounded-[1px] animate-pulse" style={{ animationDelay: '300ms' }} />
          <div className="h-full w-1/6 bg-white/15 rounded-[1px] animate-pulse" style={{ animationDelay: '450ms' }} />
        </div>
      </div>

      {/* Action Toolbar Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#111110] border border-white/10 rounded-[2px]">
        <div className="flex items-center gap-2">
          <div className="h-8 w-36 bg-white/10 rounded-[2px] animate-pulse" />
          <div className="h-8 w-32 bg-white/5 rounded-[2px] animate-pulse" />
        </div>
        <div className="h-8 w-28 bg-white/10 rounded-[2px] animate-pulse" />
      </div>

      {/* Style & Continuity Skeleton Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Style Profile Skeleton */}
        <div className="p-4 sm:p-5 bg-[#111110] border border-white/10 rounded-[2px] space-y-3">
          <div className="flex items-center space-x-2">
            <Film size={14} className="text-[#9C9C96]" />
            <div className="h-4 w-36 bg-white/15 rounded-[2px] animate-pulse" />
          </div>
          <div className="space-y-2 pt-1">
            <div className="h-3 w-full bg-white/10 rounded-[2px] animate-pulse" />
            <div className="h-3 w-4/5 bg-white/10 rounded-[2px] animate-pulse" />
            <div className="h-3 w-3/4 bg-white/5 rounded-[2px] animate-pulse" />
          </div>
        </div>

        {/* Character Continuity Skeleton */}
        <div className="p-4 sm:p-5 bg-[#111110] border border-white/10 rounded-[2px] space-y-3">
          <div className="flex items-center space-x-2">
            <Layers size={14} className="text-[#9C9C96]" />
            <div className="h-4 w-44 bg-white/15 rounded-[2px] animate-pulse" />
          </div>
          <div className="flex items-start space-x-3 pt-1">
            <div className="w-10 h-10 rounded-[3px] bg-white/10 shrink-0 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 bg-white/15 rounded-[2px] animate-pulse" />
              <div className="h-3 w-full bg-white/10 rounded-[2px] animate-pulse" />
              <div className="h-3 w-5/6 bg-white/5 rounded-[2px] animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Scene Breakdown Skeletons (3 Scene Cards) */}
      <div className="space-y-5">
        {[1, 2, 3].map((sceneNum) => (
          <div
            key={sceneNum}
            className="p-4 sm:p-6 bg-[#111110] border border-white/10 rounded-[2px] space-y-4 corner-bracket-container shadow-xl"
            style={{ animationDelay: `${sceneNum * 120}ms` }}
          >
            {/* Scene Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center space-x-3">
                <span className="font-editorial-meta text-xs tracking-wider text-[#A0A09A]">
                  SCENE {sceneNum === 1 ? 'I' : sceneNum === 2 ? 'II' : 'III'}
                </span>
                <div className="h-4 w-40 sm:w-56 bg-white/15 rounded-[2px] animate-pulse" />
              </div>
              <div className="h-5 w-16 bg-white/10 rounded-[2px] animate-pulse" />
            </div>

            {/* Camera Taxonomy Tags */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-5 w-24 bg-white/10 rounded-[2px] animate-pulse" />
              <div className="h-5 w-20 bg-white/10 rounded-[2px] animate-pulse" />
              <div className="h-5 w-28 bg-white/10 rounded-[2px] animate-pulse" />
            </div>

            {/* Visual Image / Video Prompt Box */}
            <div className="p-3.5 bg-[#0C0C0B] border border-dashed border-white/15 rounded-[2px] space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-3 w-28 bg-white/20 rounded-[2px] animate-pulse" />
                <div className="w-5 h-5 bg-white/10 rounded-[2px] animate-pulse" />
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-3 w-full bg-white/10 rounded-[2px] animate-pulse" />
                <div className="h-3 w-11/12 bg-white/10 rounded-[2px] animate-pulse" />
                <div className="h-3 w-4/5 bg-white/5 rounded-[2px] animate-pulse" />
              </div>
            </div>

            {/* Spoken Narrator Script Box */}
            <div className="p-3.5 bg-[#171715] border border-white/10 rounded-[2px] space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-3 w-32 bg-white/20 rounded-[2px] animate-pulse" />
                <div className="h-3 w-16 bg-white/10 rounded-[2px] animate-pulse" />
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-3.5 w-full bg-white/15 rounded-[2px] animate-pulse" />
                <div className="h-3.5 w-3/4 bg-white/10 rounded-[2px] animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
