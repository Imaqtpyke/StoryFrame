import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { StoryGenerationResult, StoryFormat, Beat } from '../types';
import BeatBottomSheet from './BeatBottomSheet';
import { enforceBeatCeilings, getPreviewText } from '../services/beatSplitting';
import {
  Copy,
  Check,
  ArrowLeft,
  Film,
  Layers,
  Sparkles,
  FileCode,
  FileText,
  SlidersHorizontal,
  X,
  ChevronDown,
  ChevronUp,
  Download,
  Camera,
  Video,
  Clock,
  ChevronsUpDown,
  Table,
  Clapperboard,
  Image as ImageIcon,
  Zap,
  Scissors,
} from 'lucide-react';

interface ResultsViewProps {
  result: StoryGenerationResult;
  format: StoryFormat;
  platform: string;
  onBackToEdit: () => void;
  onReset: () => void;
}

// Convert numbers (1, 2, 3...) to Roman Numerals ("I", "II", "III"...) for editorial scene headers
const toRomanNumeral = (num: number): string => {
  const n = Math.floor(Number(num));
  if (isNaN(n) || n <= 0) return String(num);

  const romanMap: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];

  let remaining = n;
  let res = '';
  for (const [val, letter] of romanMap) {
    while (remaining >= val) {
      res += letter;
      remaining -= val;
    }
  }
  return res || String(num);
};

export default function ResultsView({
  result,
  format,
  platform,
  onBackToEdit,
  onReset,
}: ResultsViewProps) {
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Desktop beat inline expansion state (compact by default: empty object)
  const [expandedDesktopBeats, setExpandedDesktopBeats] = useState<Record<string, boolean>>({});

  // Mobile bottom sheet beat breakdown state
  const [mobileActiveBeat, setMobileActiveBeat] = useState<{
    sceneIndex: number;
    sceneRoman: string;
    beat: Beat;
    allBeats: Beat[];
  } | null>(null);

  // Normalize scenes with hard beat ceilings
  const normalizedScenes = useMemo(() => {
    return result.scenes.map((scene) => ({
      ...scene,
      beats: enforceBeatCeilings(scene.beats || [], scene.index, {
        isVideoMode: result.generationMode === 'video',
        targetVideoDuration: result.targetVideoDuration || 5,
      }),
    }));
  }, [result.scenes, result.generationMode, result.targetVideoDuration]);

  // Scene collapse state (default: all expanded)
  const [expandedScenes, setExpandedScenes] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    result.scenes.forEach((s) => {
      initial[s.index] = true;
    });
    return initial;
  });

  // Close export dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    if (isExportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExportMenuOpen]);

  // Close export menu on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isExportMenuOpen) setIsExportMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExportMenuOpen]);

  const formatSecondsToMinutes = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const formatTimecode = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const copyToClipboard = async (text: string, identifier: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(identifier);
      setTimeout(() => {
        setCopiedIndex((current) => (current === identifier ? null : current));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const toggleSceneExpand = (sceneIndex: number) => {
    setExpandedScenes((prev) => ({
      ...prev,
      [sceneIndex]: !prev[sceneIndex],
    }));
  };

  const setAllScenesExpanded = (expanded: boolean) => {
    const updated: Record<number, boolean> = {};
    normalizedScenes.forEach((s) => {
      updated[s.index] = expanded;
    });
    setExpandedScenes(updated);
  };

  const scrollToScene = (sceneIndex: number) => {
    // Ensure scene is expanded
    setExpandedScenes((prev) => ({ ...prev, [sceneIndex]: true }));
    const element = document.getElementById(`scene-card-${sceneIndex}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Beat interaction handlers: compact-by-default, expand inline on desktop, bottom sheet on mobile
  const handleBeatClick = (sceneIndex: number, sceneRoman: string, beat: Beat, allBeats: Beat[]) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    if (isMobile) {
      setMobileActiveBeat({ sceneIndex, sceneRoman, beat, allBeats });
    } else {
      const beatKey = `scene-${sceneIndex}-beat-${beat.beatIndex}`;
      setExpandedDesktopBeats((prev) => ({
        ...prev,
        [beatKey]: !prev[beatKey],
      }));
    }
  };

  const handleCollapseDesktopBeat = (beatKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedDesktopBeats((prev) => ({
      ...prev,
      [beatKey]: false,
    }));
  };

  const handleToggleAllBeatsInScene = (sceneIndex: number, beatsList: Beat[]) => {
    const allExpanded = beatsList.every(
      (b) => expandedDesktopBeats[`scene-${sceneIndex}-beat-${b.beatIndex}`]
    );
    setExpandedDesktopBeats((prev) => {
      const next = { ...prev };
      beatsList.forEach((b) => {
        next[`scene-${sceneIndex}-beat-${b.beatIndex}`] = !allExpanded;
      });
      return next;
    });
  };

  const fullScript = normalizedScenes.map((s) => s.narratorLine).join(' ');
  const totalBeatsCount = normalizedScenes.reduce((acc, s) => acc + (s.beats?.length || 0), 0);
  const characterEntries = Object.entries(result.characterSheet || {});
  const isVideoMode = result.generationMode === 'video';

  // Calculate timeline ranges
  let accumulatedSeconds = 0;
  const sceneTimelineRanges = normalizedScenes.map((scene) => {
    const startSec = accumulatedSeconds;
    const endSec = startSec + scene.estimatedSeconds;
    accumulatedSeconds = endSec;
    const pct = result.totalDurationSeconds > 0
      ? (scene.estimatedSeconds / result.totalDurationSeconds) * 100
      : 100 / normalizedScenes.length;
    return {
      sceneIndex: scene.index,
      startSec,
      endSec,
      percentage: Math.max(8, pct),
    };
  });

  // Batch actions
  const handleCopyAllPrompts = () => {
    const lines: string[] = [];
    normalizedScenes.forEach((scene) => {
      (scene.beats || []).forEach((b) => {
        const shotTag = b.shotType ? `[${b.shotType}] ` : '';
        lines.push(`SCENE ${toRomanNumeral(scene.index)} - BEAT ${b.beatIndex} ${shotTag}: ${b.imagePrompt}`);
      });
    });
    copyToClipboard(lines.join('\n\n'), 'all-prompts');
  };

  const handleCopyCleanScript = () => {
    copyToClipboard(fullScript, 'clean-script');
  };

  // Export functions
  const downloadJsonExport = () => {
    setIsExportMenuOpen(false);
    const exportPayload = {
      ...result,
      scenes: normalizedScenes,
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `storyboard-production-${platform.toLowerCase().replace(/[^a-z0-9]/g, '-')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const downloadCsvExport = () => {
    setIsExportMenuOpen(false);
    const hasVideo = result.generationMode === 'video' || normalizedScenes.some((s) => s.videoPrompt);
    const headers = ['Scene', 'Roman Scene', 'Beat', 'Estimated Seconds', 'Shot Type', 'Camera Angle', 'Camera Movement', 'Editing Note (Transition Anchor)', 'Spoken Narration', 'Visual Image Prompt'];
    if (hasVideo) {
      headers.push('Scene Video Prompt (8-Part)', 'Start Frame Keyframe Prompt');
    }
    const rows: string[][] = [headers];

    normalizedScenes.forEach((scene) => {
      (scene.beats || []).forEach((beat, bIdx) => {
        const row = [
          `Scene ${scene.index}`,
          `SCENE ${toRomanNumeral(scene.index)}`,
          `Beat ${beat.beatIndex}`,
          `${beat.estimatedSeconds}s`,
          beat.shotType || 'Medium Shot',
          beat.cameraAngle || 'Eye-level',
          beat.cameraMovement || 'Static',
          beat.transitionHint ? `"${beat.transitionHint.replace(/"/g, '""')}"` : '""',
          `"${beat.textSpan.replace(/"/g, '""')}"`,
          `"${beat.imagePrompt.replace(/"/g, '""')}"`,
        ];
        if (hasVideo) {
          row.push(
            bIdx === 0 ? `"${(scene.videoPrompt || '').replace(/"/g, '""')}"` : '""',
            bIdx === 0 ? `"${(scene.startFramePrompt || '').replace(/"/g, '""')}"` : '""'
          );
        }
        rows.push(row);
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.map((e) => e.join(',')).join('\n'));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', csvContent);
    downloadAnchor.setAttribute('download', `shotlist-${platform.toLowerCase().replace(/[^a-z0-9]/g, '-')}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const downloadMarkdownExport = () => {
    setIsExportMenuOpen(false);
    let md = `# Production Storyboard & Shot List\n\n`;
    md += `**Platform**: ${platform} (${format === 'long' ? '16:9 Widescreen' : '9:16 Vertical'})\n`;
    md += `**Generation Mode**: ${result.generationMode === 'video' ? `Text to Video (~${result.targetVideoDuration || 5}s clips)` : 'Text to Image'}\n`;
    md += `**Estimated Duration**: ~${formatSecondsToMinutes(result.totalDurationSeconds)}\n`;
    md += `**Total Scenes**: ${normalizedScenes.length} | **Total Visual Beats**: ${totalBeatsCount}\n\n`;

    if (result.styleProfile) {
      md += `## Visual Style Profile\n`;
      md += `- **Art Style**: ${result.styleProfile.artStyle}\n`;
      md += `- **Color Palette**: ${result.styleProfile.colorPalette}\n`;
      md += `- **Lighting**: ${result.styleProfile.lighting}\n`;
      md += `- **Era & Setting**: ${result.styleProfile.eraAndSetting}\n`;
      if (result.styleProfile.lensAndFilmStock) {
        md += `- **Lens & Film Stock**: ${result.styleProfile.lensAndFilmStock}\n`;
      }
      md += `\n`;
    }

    if (characterEntries.length > 0) {
      md += `## Character Continuity Sheet\n`;
      characterEntries.forEach(([name, desc]) => {
        md += `- **${name}**: ${desc}\n`;
      });
      md += `\n`;
    }

    const locationEntries = result.locationSheet ? Object.entries(result.locationSheet) : [];
    if (locationEntries.length > 0) {
      md += `## Location Continuity Sheet\n`;
      locationEntries.forEach(([name, desc]) => {
        md += `- **${name}**: ${desc}\n`;
      });
      md += `\n`;
    }

    md += `## Complete Narrator Script\n\n> ${fullScript}\n\n`;

    md += `## Director Shot List Breakdown\n\n`;
    normalizedScenes.forEach((scene) => {
      md += `### SCENE ${toRomanNumeral(scene.index)} (~${scene.estimatedSeconds}s)\n`;
      md += `**Narrator Line**:\n"${scene.narratorLine}"\n\n`;

      if (scene.videoPrompt) {
        md += `#### AI Video Generation Prompt (~${result.targetVideoDuration || 5}s Clip)\n\`\`\`text\n${scene.videoPrompt}\n\`\`\`\n\n`;
      }
      if (scene.startFramePrompt) {
        md += `#### Start Frame Keyframe Prompt (Image Ingredient)\n\`\`\`text\n${scene.startFramePrompt}\n\`\`\`\n\n`;
      }

      md += `| Beat | Duration | Shot Size | Angle | Movement | Editing Note | Spoken Words | Visual Image Prompt |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
      (scene.beats || []).forEach((b) => {
        const transNote = b.transitionHint ? b.transitionHint.replace(/\|/g, '-') : '-';
        md += `| Beat ${b.beatIndex} | ~${b.estimatedSeconds}s | ${b.shotType || 'Medium Shot'} | ${b.cameraAngle || 'Eye-level'} | ${b.cameraMovement || 'Static'} | ${transNote} | "${b.textSpan.replace(/\|/g, '-')}" | ${b.imagePrompt.replace(/\|/g, '-')} |\n`;
      });
      md += `\n`;
    });

    const dataStr = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(md);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `storyboard-shotlist-${platform.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const allExpanded = Object.values(expandedScenes).every(Boolean);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 sm:space-y-8 font-narrative text-[#F5F5F0]">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            id="back-to-edit-button"
            onClick={onBackToEdit}
            className="inline-flex items-center text-xs sm:text-sm text-[#9C9C96] hover:text-white transition-colors min-h-[32px] sm:min-h-[40px] py-1 sm:py-1.5 font-display"
          >
            <ArrowLeft size={13} className="mr-1.5 shrink-0 sm:w-3.5 sm:h-3.5" />
            Edit Story and Settings
          </button>
          <span className="text-white/20">/</span>
          <button
            type="button"
            id="start-new-button"
            onClick={onReset}
            className="inline-flex items-center text-xs sm:text-sm text-[#9C9C96] hover:text-white transition-colors min-h-[32px] sm:min-h-[40px] py-1 sm:py-1.5 font-display"
          >
            Start New Story
          </button>
        </div>

        {/* Technical Production Metadata Chips */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {result.generationMode === 'video' ? (
            <span className="stamp-chip bg-amber-950/70 text-amber-300 border-amber-800/80 font-semibold">
              <Clapperboard size={9} className="mr-1 inline text-amber-400" />
              TEXT TO VIDEO ({result.targetVideoDuration || 5}S CLIPS)
            </span>
          ) : (
            <span className="stamp-chip bg-sky-950/25 text-sky-200/70 border-sky-800/25 font-semibold">
              <ImageIcon size={9} className="mr-1 inline text-sky-400/60" />
              TEXT TO IMAGE
            </span>
          )}
          <span className="stamp-chip stamp-chip-primary">
            {result.scenes.length} SCENES
          </span>
          <span className="stamp-chip">
            {totalBeatsCount} BEATS
          </span>
          <span className="stamp-chip">
            ~{formatSecondsToMinutes(result.totalDurationSeconds)}
          </span>
          <span className="stamp-chip">
            {platform.toUpperCase()} ({format === 'long' ? '16:9' : '9:16'})
          </span>
        </div>
      </div>

      {/* Interactive Horizontal Pacing Timeline Bar with Corner Brackets */}
      <div className="bg-[#111110] border border-white/10 p-3 sm:p-5 space-y-2 sm:space-y-2.5 corner-bracket-container shadow-2xl">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <Clock size={12} className="text-[#9C9C96] shrink-0 sm:w-3.5 sm:h-3.5" />
            <span className="font-editorial-meta text-[9px] sm:text-[10px] text-[#C4C4C0] font-medium">
              VISUAL PACING TIMELINE
            </span>
          </div>
          <span className="font-editorial-meta text-[9px] sm:text-[10px] text-[#8C8C86]">
            00:00 &rarr; {formatTimecode(result.totalDurationSeconds)} ({formatSecondsToMinutes(result.totalDurationSeconds)})
          </span>
        </div>

        {/* Timeline Bar Segment Grid */}
        <div className="flex items-center w-full h-7 sm:h-9 bg-[#080808] border border-white/10 overflow-hidden p-0.5 gap-0.5 sm:gap-1">
          {sceneTimelineRanges.map((range) => {
            const roman = toRomanNumeral(range.sceneIndex);
            const sceneSeconds = result.scenes[range.sceneIndex - 1]?.estimatedSeconds;
            return (
              <button
                key={range.sceneIndex}
                type="button"
                onClick={() => scrollToScene(range.sceneIndex)}
                className="h-full flex-1 group relative bg-[#181816] hover:bg-[#262624] active:bg-[#333330] border border-white/5 transition-all flex items-center justify-center overflow-hidden px-0.5 sm:px-1 focus:outline-none focus:ring-1 focus:ring-white min-w-0"
                title={`Jump to Scene ${range.sceneIndex} (SC ${roman}) • ${formatTimecode(range.startSec)} - ${formatTimecode(range.endSec)}`}
              >
                <span className="font-editorial-meta text-[9px] sm:text-[10px] text-[#D4D4D0] group-hover:text-white truncate max-w-full text-center leading-none tracking-wider">
                  SC {roman}
                </span>
                {typeof sceneSeconds === 'number' && (
                  <span className="hidden md:inline-block font-editorial-meta text-[9px] text-[#7D7D76] ml-1 shrink-0">
                    ~{sceneSeconds}s
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Auto Story Architect: High-Retention Viral Hook Banner */}
      {result.hookAnalysis?.headlineHook && (
        <div
          id="viral-hook-analysis-banner"
          className="p-3.5 sm:p-4 bg-[#14130E] border border-amber-500/40 rounded-[2px] space-y-2 shadow-[0_0_20px_rgba(245,158,11,0.06)]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-amber-500/20 pb-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-editorial-meta font-bold uppercase tracking-wider text-amber-300 bg-amber-950/80 border border-amber-500/50 px-2 py-0.5 rounded-[1px]">
                <Sparkles size={11} className="text-amber-400" />
                VIRAL HOOK OPTIMIZATION
              </span>
              {result.hookAnalysis.hookType && (
                <span className="text-xs font-display text-amber-200/90 font-medium">
                  {result.hookAnalysis.hookType}
                </span>
              )}
            </div>
            <span className="text-[10px] font-editorial-meta text-amber-400/70 tracking-wider">
              AUTO-ARCHITECT 1-PASS
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-xs sm:text-sm font-display text-[#F5F5F0] italic pl-2.5 border-l-2 border-amber-400 leading-relaxed">
              &ldquo;{result.hookAnalysis.headlineHook}&rdquo;
            </div>
            {result.hookAnalysis.hookRationale && (
              <p className="text-[11px] sm:text-xs text-[#A8A8A0] font-narrative leading-relaxed pt-0.5">
                <span className="text-amber-300 font-medium">Retention Strategy:</span> {result.hookAnalysis.hookRationale}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Main Header & Clean Compact Utility Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 sm:pt-2">
        <div>
          <h2 className="text-lg sm:text-2xl font-normal font-display tracking-tight text-white">
            Scene Breakdown &amp; Visual Beats
          </h2>
          <p className="text-xs sm:text-sm text-[#9C9C96] mt-0.5 sm:mt-1 font-narrative">
            Structured cinematic prompts with shot taxonomy and frame-by-frame narrator pacing.
          </p>
        </div>

        {/* Utility Actions (Tight padding & smaller text on mobile) */}
        <div className="flex items-center gap-1.5 sm:gap-2 self-start sm:self-auto">
          {/* Quick Expand/Collapse Toggle */}
          <button
            type="button"
            id="toggle-all-scenes-btn"
            onClick={() => setAllScenesExpanded(!allExpanded)}
            className="inline-flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-[#141412] hover:bg-[#1f1f1d] text-[#D4D4D0] hover:text-white border border-white/15 text-[9px] sm:text-[10px] font-editorial-meta transition-colors min-h-[28px] sm:min-h-[32px]"
            title={allExpanded ? 'Collapse all scenes' : 'Expand all scenes'}
          >
            <ChevronsUpDown size={10} className="text-[#9C9C96] sm:w-3 sm:h-3" />
            <span>{allExpanded ? 'COLLAPSE ALL' : 'EXPAND ALL'}</span>
          </button>

          {/* Batch Copy Prompts Button */}
          <button
            type="button"
            id="batch-copy-prompts-btn"
            onClick={handleCopyAllPrompts}
            className="inline-flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 bg-[#181816] hover:bg-[#242422] text-[#F5F5F0] hover:text-white border border-white/20 text-[9px] sm:text-[10px] font-editorial-meta transition-colors min-h-[28px] sm:min-h-[32px]"
            title={isVideoMode ? 'Copy all beat video prompts into clipboard' : 'Copy all beat image prompts into clipboard'}
          >
            {copiedIndex === 'all-prompts' ? (
              <>
                <Check size={10} className="text-white sm:w-3 sm:h-3" />
                <span className="text-white font-semibold">COPIED</span>
              </>
            ) : (
              <>
                <Copy size={10} className="text-[#9C9C96] sm:w-3 sm:h-3" />
                <span>{isVideoMode ? 'COPY ALL VIDEO PROMPTS' : 'COPY ALL PROMPTS'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* STORYBOARD CARDS VIEW */}
      <div className="space-y-5 sm:space-y-8" id="scene-cards-container">
        {normalizedScenes.map((scene) => {
          const isCopiedNarration = copiedIndex === `narration-${scene.index}`;
          const beats = scene.beats || [];
          const isExpanded = expandedScenes[scene.index] ?? true;
          const romanScene = toRomanNumeral(scene.index);

          return (
            <div
              key={scene.index}
              id={`scene-card-${scene.index}`}
              className="bg-[#121211] border border-white/10 overflow-hidden transition-all shadow-lg"
            >
              {/* Scene Header (Clickable Accordion) with Generous Breathing Room */}
              <div
                onClick={() => toggleSceneExpand(scene.index)}
                className="w-full flex items-center justify-between p-3.5 sm:p-5 bg-[#161614] hover:bg-[#1a1a18] cursor-pointer transition-colors border-b border-white/10 select-none"
              >
                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                  <Film size={14} className="text-white shrink-0 sm:w-4 sm:h-4" />
                  <span className="font-display text-xs sm:text-base font-medium tracking-tight text-white truncate">
                    SCENE {romanScene}
                  </span>
                  <span className="stamp-chip text-[9px] sm:text-[10px]">
                    {beats.length} {beats.length === 1 ? 'BEAT' : 'BEATS'}
                  </span>
                  <span className="font-editorial-meta text-[9px] sm:text-[10px] text-[#9C9C96] shrink-0">
                    ~{scene.estimatedSeconds}S
                  </span>
                </div>

                <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(scene.narratorLine, `narration-${scene.index}`);
                    }}
                    className="inline-flex items-center font-editorial-meta text-[9px] sm:text-[10px] px-2 sm:px-2.5 py-1 text-[#D4D4D0] hover:text-white bg-[#1f1f1d] hover:bg-[#2a2a27] border border-white/15 transition-colors whitespace-nowrap min-h-[28px] sm:min-h-[30px]"
                    title="Copy full scene narrator line"
                  >
                    {isCopiedNarration ? (
                      <>
                        <Check size={10} className="mr-1 text-white sm:w-3 sm:h-3" />
                        <span>COPIED</span>
                      </>
                    ) : (
                      <>
                        <Copy size={10} className="mr-1 sm:w-3 sm:h-3" />
                        <span>COPY LINE</span>
                      </>
                    )}
                  </button>

                  <div className="p-1 text-[#9C9C96] hover:text-white">
                    {isExpanded ? <ChevronUp size={14} className="sm:w-4 sm:h-4" /> : <ChevronDown size={14} className="sm:w-4 sm:h-4" />}
                  </div>
                </div>
              </div>

              {/* Scene Content (Expandable) with Editorial Spacing */}
              {isExpanded && (
                <div className="p-3.5 sm:p-6 md:p-8 space-y-5 sm:space-y-8">
                  {/* Scene Narrator Line Styled as an Editorial Pulled Quote */}
                  <div className="space-y-2">
                    <span className="font-editorial-meta text-[9px] sm:text-[10px] text-[#9C9C96] block">
                      SPOKEN NARRATION
                    </span>
                    <div className="bg-[#0A0A09] p-3.5 sm:p-6 border-l-2 border-white/40 border-y border-r border-white/5 relative">
                      <p className="text-sm sm:text-base md:text-lg leading-relaxed text-[#F5F5F0] font-narrative italic selection:bg-white selection:text-black">
                        &ldquo;{scene.narratorLine}&rdquo;
                      </p>
                    </div>
                  </div>

                  {/* Beats Breakdown Section (Cinematography & Visual Beats in Image Mode / Cinematography & Video Beats in Video Mode) */}
                  <div className="space-y-3.5 sm:space-y-4 pt-1 sm:pt-2">
                    <div className="flex items-center justify-between border-t border-white/10 pt-3 sm:pt-4">
                      <div className="flex items-center space-x-1.5 sm:space-x-2">
                        {isVideoMode ? (
                          <>
                            <Clapperboard size={12} className="text-amber-400 sm:w-3.5 sm:h-3.5" />
                            <span className="font-editorial-meta text-[9px] sm:text-[10px] text-amber-300 font-medium">
                              CINEMATOGRAPHY &amp; VIDEO BEATS
                            </span>
                          </>
                        ) : (
                          <>
                            <ImageIcon size={12} className="text-sky-400/60 sm:w-3.5 sm:h-3.5" />
                            <span className="font-editorial-meta text-[9px] sm:text-[10px] text-sky-200/70 font-medium">
                              CINEMATOGRAPHY &amp; VISUAL BEATS
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {isVideoMode ? (
                          <span className="stamp-chip bg-amber-950/70 text-amber-300 border-amber-800/80 text-[8px] sm:text-[9px]">
                            {beats.length} VIDEO SHOTS (~{result.targetVideoDuration || scene.estimatedSeconds || 5}S TOTAL)
                          </span>
                        ) : (
                          <span className="stamp-chip bg-sky-950/25 text-sky-200/70 border-sky-800/25 text-[8px] sm:text-[9px]">
                            {beats.length} VISUAL SETUPS
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleAllBeatsInScene(scene.index, beats)}
                          className="hidden sm:inline-flex items-center font-editorial-meta text-[9px] text-[#A8A8A2] hover:text-white bg-white/5 hover:bg-white/10 px-2 py-0.5 border border-white/10 transition-colors"
                        >
                          {beats.every((b) => expandedDesktopBeats[`scene-${scene.index}-beat-${b.beatIndex}`])
                            ? 'COLLAPSE ALL'
                            : 'EXPAND ALL'}
                        </button>
                      </div>
                    </div>

                    {/* Mobile Filmstrip Row (Compact Scan Row: 2-3 fit on screen horizontally) */}
                    <div className="block sm:hidden space-y-2">
                      <div className="flex overflow-x-auto pb-2.5 pt-1 gap-2.5 snap-x snap-mandatory scrollbar-thin overscroll-x-contain -mx-1 px-1">
                        {beats.map((beat) => (
                          <div
                            key={beat.beatIndex}
                            id={`mobile-beat-card-${scene.index}-${beat.beatIndex}`}
                            onClick={() => handleBeatClick(scene.index, romanScene, beat, beats)}
                            className={`flex-none w-[160px] xs:w-[175px] snap-start border active:bg-[#1E1E1C] p-2.5 flex flex-col justify-between min-h-[96px] cursor-pointer transition-all rounded-[2px] ${
                              isVideoMode ? 'bg-[#141310] border-amber-900/30 active:border-amber-400/50' : 'bg-[#080D14] border-sky-900/15 active:border-sky-400/30'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 border-b border-white/5 pb-1">
                              <span className={`stamp-chip font-bold text-[8px] ${isVideoMode ? 'bg-amber-950/70 text-amber-300 border-amber-800/80' : 'bg-sky-950/25 text-sky-200/70 border-sky-800/25'}`}>
                                B{String(beat.beatIndex).padStart(2, '0')}
                              </span>
                              <span className="font-editorial-meta text-[8px] text-emerald-400/90">
                                ~{beat.estimatedSeconds}s
                              </span>
                            </div>

                            <div className="my-1.5 space-y-0.5">
                              <div className="flex items-center gap-1 text-[8px] font-editorial-meta text-[#C4C4C0]">
                                <Camera size={8} className="text-[#9C9C96] shrink-0" />
                                <span className="truncate">{beat.shotType || 'Medium Shot'}</span>
                              </div>
                              {beat.cameraMovement && (
                                <div className="flex items-center gap-1 text-[8px] font-editorial-meta text-[#8C8C86]">
                                  <Video size={8} className="text-[#7D7D76] shrink-0" />
                                  <span className="truncate">{beat.cameraMovement}</span>
                                </div>
                              )}
                              {beat.visualSoundEffect && (
                                <div className="flex items-center gap-1 text-[8px] font-editorial-meta font-bold text-purple-300">
                                  <Zap size={8} className="text-purple-400 shrink-0" />
                                  <span className="truncate">SFX: {beat.visualSoundEffect}</span>
                                </div>
                              )}
                              {beat.transitionHint && (
                                <div className="flex items-center gap-1 text-[7.5px] font-editorial-meta text-amber-400">
                                  <Scissors size={7.5} className="text-amber-400 shrink-0" />
                                  <span className="truncate">Editing Note</span>
                                </div>
                              )}
                            </div>

                            <div className="pt-1 border-t border-white/5">
                              <p className="text-[10px] text-[#E6E6E1] italic font-narrative line-clamp-2 leading-tight">
                                &ldquo;{getPreviewText(beat.textSpan, 6)}&rdquo;
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[8px] text-[#7D7D76] font-editorial-meta text-center tracking-wider">
                        {isVideoMode
                          ? 'TAP ANY BEAT TO SLIDE UP COMPLETE VIDEO PROMPT & SCRIPT'
                          : 'TAP ANY BEAT TO SLIDE UP COMPLETE VISUAL PROMPT & SCRIPT'}
                      </p>
                    </div>

                    {/* Desktop Wrapped Grid (Compact Chips by default, Expands Inline on click) */}
                    <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
                      {beats.map((beat) => {
                        const beatKey = `scene-${scene.index}-beat-${beat.beatIndex}`;
                        const isExpandedBeat = !!expandedDesktopBeats[beatKey];
                        const isCopiedPrompt = copiedIndex === `prompt-${beatKey}`;
                        const isCopiedText = copiedIndex === `text-${beatKey}`;

                        if (!isExpandedBeat) {
                          /* Compact Chip State */
                          return (
                            <div
                              key={beat.beatIndex}
                              id={`desktop-beat-chip-${scene.index}-${beat.beatIndex}`}
                              onClick={() => handleBeatClick(scene.index, romanScene, beat, beats)}
                              className={`border p-3 flex flex-col justify-between min-h-[112px] cursor-pointer transition-all group select-none rounded-[2px] ${
                                isVideoMode
                                  ? 'bg-[#141310] border-amber-900/30 hover:border-amber-700/60 hover:bg-[#1A1813]'
                                  : 'bg-[#080D14] border-sky-900/15 hover:border-sky-700/30 hover:bg-[#0C141F]'
                              }`}
                              title={isVideoMode ? 'Click to expand video prompt breakdown' : 'Click to expand visual prompt breakdown'}
                            >
                              <div className="flex items-center justify-between gap-1 border-b border-white/5 pb-1.5">
                                <span className={`stamp-chip font-bold text-[9px] ${isVideoMode ? 'bg-amber-950/70 text-amber-300 border-amber-800/80' : 'bg-sky-950/25 text-sky-200/70 border-sky-800/25'}`}>
                                  BEAT {String(beat.beatIndex).padStart(2, '0')}
                                </span>
                                <span className="font-editorial-meta text-[9px] text-emerald-400/90">
                                  ~{beat.estimatedSeconds}S
                                </span>
                              </div>

                              <div className="my-1.5 space-y-0.5">
                                <div className="flex items-center gap-1 text-[9px] font-editorial-meta text-[#C4C4C0]">
                                  <Camera size={9} className="text-[#9C9C96] shrink-0" />
                                  <span className="truncate">{beat.shotType || 'Medium Shot'}</span>
                                </div>
                                {beat.cameraAngle && (
                                  <div className="flex items-center gap-1 text-[8px] font-editorial-meta text-[#A0A098]">
                                    <Video size={8} className="text-[#8C8C86] shrink-0" />
                                    <span className="truncate">{beat.cameraAngle}</span>
                                  </div>
                                )}
                                {beat.cameraMovement && (
                                  <div className="flex items-center gap-1 text-[8px] font-editorial-meta text-[#8C8C86]">
                                    <Video size={8} className="text-[#7D7D76] shrink-0" />
                                    <span className="truncate">{beat.cameraMovement}</span>
                                  </div>
                                )}
                                {beat.visualSoundEffect && (
                                  <div className="flex items-center gap-1 text-[8px] font-editorial-meta font-bold text-purple-300">
                                    <Zap size={8} className="text-purple-400 shrink-0" />
                                    <span className="truncate">SFX: {beat.visualSoundEffect}</span>
                                  </div>
                                )}
                                {beat.transitionHint && (
                                  <div className="flex items-center gap-1 text-[8px] font-editorial-meta text-amber-400 bg-amber-950/40 border border-amber-800/40 px-1 py-0.5 rounded-[1px] w-fit">
                                    <Scissors size={8} className="text-amber-400 shrink-0" />
                                    <span className="truncate">Editing Note</span>
                                  </div>
                                )}
                              </div>

                              <div className="pt-1.5 border-t border-white/5 flex items-center justify-between gap-1">
                                <p className="text-[11px] text-[#E6E6E1] italic font-narrative truncate max-w-[85%]">
                                  &ldquo;{getPreviewText(beat.textSpan, 6)}&rdquo;
                                </p>
                                <ChevronDown size={11} className="text-[#7D7D76] group-hover:text-white transition-colors shrink-0" />
                              </div>
                            </div>
                          );
                        }

                        /* Expanded Card State in Place */
                        return (
                          <div
                            key={beat.beatIndex}
                            id={`desktop-beat-card-expanded-${scene.index}-${beat.beatIndex}`}
                            className={`col-span-full border p-4 sm:p-5 md:p-6 space-y-3.5 shadow-xl transition-all rounded-[2px] ${
                              isVideoMode ? 'bg-[#151411] border-amber-900/50' : 'bg-[#060A10] border-sky-900/25'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2.5 sm:pb-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`stamp-chip font-bold ${isVideoMode ? 'bg-amber-950/70 text-amber-300 border-amber-800/80' : 'bg-sky-950/25 text-sky-200/70 border-sky-800/25'}`}>
                                  BEAT {String(beat.beatIndex).padStart(2, '0')}
                                </span>
                                {beat.shotType && (
                                  <span className="stamp-chip">
                                    <Camera size={9} className="mr-1 text-[#9C9C96] shrink-0 sm:w-2.5 sm:h-2.5" />
                                    {beat.shotType}
                                  </span>
                                )}
                                {beat.cameraAngle && (
                                  <span className="stamp-chip">
                                    <Video size={9} className="mr-1 text-[#9C9C96] shrink-0 sm:w-2.5 sm:h-2.5" />
                                    {beat.cameraAngle}
                                  </span>
                                )}
                                {beat.cameraMovement && (
                                  <span className="stamp-chip">
                                    <Video size={9} className="mr-1 text-[#9C9C96] shrink-0 sm:w-2.5 sm:h-2.5" />
                                    {beat.cameraMovement}
                                  </span>
                                )}
                                {beat.visualSoundEffect && (
                                  <span className="stamp-chip bg-purple-950/60 text-purple-300 border-purple-800/50 font-bold">
                                    <Zap size={9} className="mr-1 text-purple-400 shrink-0 sm:w-2.5 sm:h-2.5" />
                                    SFX: {beat.visualSoundEffect}
                                  </span>
                                )}
                                {beat.transitionHint && (
                                  <span className="stamp-chip bg-amber-950/60 text-amber-300 border-amber-800/50 font-medium">
                                    <Scissors size={9} className="mr-1 text-amber-400 shrink-0 sm:w-2.5 sm:h-2.5" />
                                    Editing Note
                                  </span>
                                )}
                                <span className="font-editorial-meta text-[9px] sm:text-[10px] text-emerald-400">
                                  ~{beat.estimatedSeconds}S
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  id={`copy-beat-prompt-btn-${scene.index}-${beat.beatIndex}`}
                                  onClick={() => copyToClipboard(beat.imagePrompt, `prompt-${beatKey}`)}
                                  className={`inline-flex items-center justify-center font-editorial-meta text-[9px] sm:text-[10px] px-2.5 sm:px-3 py-1 transition-colors whitespace-nowrap min-h-[28px] ${
                                    isVideoMode
                                      ? 'bg-amber-400 text-black hover:bg-amber-300 font-semibold'
                                      : 'bg-sky-400/70 text-black hover:bg-sky-400 font-semibold'
                                  }`}
                                >
                                  {isCopiedPrompt ? (
                                    <>
                                      <Check size={10} className="mr-1 shrink-0 sm:w-3 sm:h-3 text-black" />
                                      <span className="font-semibold">COPIED</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={10} className="mr-1 shrink-0 sm:w-3 sm:h-3 text-black" />
                                      <span>{isVideoMode ? 'COPY VIDEO PROMPT' : 'COPY IMAGE PROMPT'}</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => handleCollapseDesktopBeat(beatKey, e)}
                                  className="inline-flex items-center justify-center font-editorial-meta text-[9px] sm:text-[10px] px-2 sm:px-2.5 py-1 text-[#A8A8A2] hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors whitespace-nowrap min-h-[28px]"
                                  title="Collapse to compact chip"
                                >
                                  <ChevronUp size={11} className="mr-1" />
                                  <span>COLLAPSE</span>
                                </button>
                              </div>
                            </div>

                            {/* Spoken Text Span for this Beat */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-editorial-meta text-[9px] sm:text-[10px] text-[#9C9C96]">
                                  {isVideoMode ? 'SPOKEN ACTION CLAUSE' : 'SPOKEN PHRASE (MAX 8 WORDS)'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(beat.textSpan, `text-${beatKey}`)}
                                  className="font-editorial-meta text-[9px] text-[#9C9C96] hover:text-white transition-colors"
                                >
                                  {isCopiedText ? 'COPIED' : 'COPY PHRASE'}
                                </button>
                              </div>
                              <div className="p-2 sm:p-2.5 bg-[#0D0D0C] border border-white/5 text-xs sm:text-sm font-narrative italic text-[#F5F5F0]">
                                &ldquo;{beat.textSpan}&rdquo;
                              </div>
                            </div>

                            {beat.visualSoundEffect && (
                              <div className="p-2.5 bg-purple-950/20 border border-purple-800/40 rounded flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <Zap size={14} className="text-purple-400 shrink-0" />
                                  <div>
                                    <span className="font-editorial-meta text-[9px] text-purple-300 tracking-wider uppercase block">Visual Sound Effect (Comic Lettering)</span>
                                    <span className="font-bold text-xs text-purple-200 tracking-wide">{beat.visualSoundEffect}</span>
                                  </div>
                                </div>
                                <span className="text-[9px] font-editorial-meta text-purple-400/80 italic">Integrated into image artwork</span>
                              </div>
                            )}

                            {beat.transitionHint && (
                              <div className="p-2.5 sm:p-3 bg-amber-950/20 border border-amber-800/40 rounded space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-editorial-meta text-[9px] sm:text-[10px] text-amber-300 tracking-wider uppercase flex items-center gap-1.5 font-medium">
                                    <Scissors size={11} className="text-amber-400" />
                                    <span>Editing Note • Scene Transition Anchor</span>
                                  </span>
                                  <span className="text-[9px] font-editorial-meta text-amber-400/70 italic">Post-production edit guide</span>
                                </div>
                                <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed font-sans">
                                  {beat.transitionHint}
                                </p>
                              </div>
                            )}

                            {/* Prompt for this Beat (Video Prompt in video mode, Visual Image Prompt in image mode) */}
                            <div className="space-y-1">
                              <span className="font-editorial-meta text-[9px] sm:text-[10px] text-[#9C9C96] flex items-center gap-1.5">
                                {isVideoMode ? (
                                  <>
                                    <Clapperboard size={11} className="text-amber-400" />
                                    <span className="text-amber-300 font-medium">TEXT TO VIDEO PROMPT</span>
                                  </>
                                ) : (
                                  <>
                                    <ImageIcon size={11} className="text-sky-400/60" />
                                    <span className="text-sky-200/70 font-medium">STRUCTURED IMAGE PROMPT</span>
                                  </>
                                )}
                              </span>
                              <div className={`text-xs sm:text-sm leading-relaxed p-2.5 sm:p-3.5 border selection:bg-white selection:text-black ${
                                isVideoMode ? 'bg-[#0A0A08] border-amber-900/40 font-mono text-[#F0EFEA]' : 'bg-[#04070C] border-sky-900/20 font-mono text-[#D0DFEB]'
                              }`}>
                                {beat.imagePrompt}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Full Script Summary Panel */}
      <div
        id="full-script-panel"
        className="bg-[#121211] border border-white/10 p-3.5 sm:p-6 md:p-8 space-y-3.5 sm:space-y-4 shadow-xl"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-white/10 pb-3 sm:pb-4">
          <div className="min-w-0 flex-1 pr-0 sm:pr-4">
            <h3 className="text-base sm:text-xl font-normal font-display tracking-tight text-white">
              Complete Narrator Script
            </h3>
            <p className="text-xs text-[#9C9C96] mt-0.5 sm:mt-1 font-narrative leading-relaxed">
              Continuous voiceover script for audio recording and dialogue timing.
            </p>
          </div>

          <div className="flex items-center self-start sm:self-auto shrink-0">
            <button
              type="button"
              id="copy-clean-script-btn"
              onClick={handleCopyCleanScript}
              className="inline-flex items-center justify-center px-2 sm:px-3.5 py-1 sm:py-1.5 bg-white text-black hover:bg-neutral-200 active:bg-neutral-300 text-[9px] sm:text-[10px] font-editorial-meta font-semibold transition-colors whitespace-nowrap min-h-[28px] sm:min-h-[32px] shadow-sm"
              title="Copy the complete continuous voiceover script"
            >
              {copiedIndex === 'clean-script' ? (
                <>
                  <Check size={10} className="mr-1 text-black shrink-0 sm:w-3 sm:h-3" />
                  <span>COPIED</span>
                </>
              ) : (
                <>
                  <Copy size={10} className="mr-1 text-black shrink-0 sm:w-3 sm:h-3" />
                  <span className="sm:hidden">COPY SCRIPT</span>
                  <span className="hidden sm:inline">COPY CLEAN SCRIPT</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-[#0A0A09] p-3.5 sm:p-6 border border-white/10">
          <p className="text-xs sm:text-base text-[#F5F5F0] leading-relaxed font-narrative whitespace-pre-wrap selection:bg-white selection:text-black">
            {fullScript}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 font-editorial-meta text-[9px] sm:text-[10px] text-[#9C9C96] pt-0.5 sm:pt-1">
          <span>TOTAL WORDS: {fullScript.trim().split(/\s+/).filter(Boolean).length} WORDS</span>
          <span>ESTIMATED PACING: ~{formatSecondsToMinutes(result.totalDurationSeconds)}</span>
        </div>
      </div>

      {/* Bottom Production Export Section with Compact Dropdown Menu */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 sm:p-5 bg-[#121211] border border-white/10">
        <div className="text-center sm:text-left">
          <span className="text-xs sm:text-sm font-medium font-display tracking-tight text-white block">
            Production Export &amp; Shot Lists
          </span>
          <p className="text-[10px] sm:text-xs text-[#9C9C96] mt-0.5 font-narrative">
            Download your full breakdown in CSV, Markdown, or JSON formats.
          </p>
        </div>

        {/* Compact Export Dropdown */}
        <div className="relative" ref={exportMenuRef}>
          <button
            type="button"
            id="export-dropdown-btn"
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            className="inline-flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-3.5 py-1.5 sm:py-2 bg-[#1C1C1A] hover:bg-[#262624] text-white border border-white/20 text-[10px] sm:text-xs font-editorial-meta transition-colors min-h-[34px] sm:min-h-[38px]"
            aria-expanded={isExportMenuOpen}
            aria-haspopup="true"
          >
            <Download size={12} className="text-[#9C9C96] sm:w-3.5 sm:h-3.5" />
            <span>EXPORT STORYBOARD</span>
            <ChevronDown size={12} className={`text-[#9C9C96] transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu Items */}
          {isExportMenuOpen && (
            <div className="absolute right-0 bottom-full mb-2 w-56 sm:w-60 bg-[#161614] border border-white/20 shadow-2xl py-1.5 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150 font-narrative">
              <button
                type="button"
                id="export-csv-opt"
                onClick={downloadCsvExport}
                className="w-full flex items-center space-x-2.5 sm:space-x-3 px-3 sm:px-3.5 py-2 sm:py-2.5 text-left text-xs sm:text-sm text-[#F5F5F0] hover:text-white hover:bg-[#222220] transition-colors"
              >
                <Table size={13} className="text-[#9C9C96] shrink-0 sm:w-3.5 sm:h-3.5" />
                <div>
                  <div className="font-medium font-display text-xs sm:text-sm">Shot List (.csv)</div>
                  <div className="font-editorial-meta text-[9px] text-[#9C9C96]">Spreadsheet production table</div>
                </div>
              </button>

              <button
                type="button"
                id="export-md-opt"
                onClick={downloadMarkdownExport}
                className="w-full flex items-center space-x-2.5 sm:space-x-3 px-3 sm:px-3.5 py-2 sm:py-2.5 text-left text-xs sm:text-sm text-[#F5F5F0] hover:text-white hover:bg-[#222220] transition-colors"
              >
                <FileText size={13} className="text-[#9C9C96] shrink-0 sm:w-3.5 sm:h-3.5" />
                <div>
                  <div className="font-medium font-display text-xs sm:text-sm">Production Storyboard (.md)</div>
                  <div className="font-editorial-meta text-[9px] text-[#9C9C96]">Formatted documentation</div>
                </div>
              </button>

              <button
                type="button"
                id="export-json-opt"
                onClick={downloadJsonExport}
                className="w-full flex items-center space-x-2.5 sm:space-x-3 px-3 sm:px-3.5 py-2 sm:py-2.5 text-left text-xs sm:text-sm text-[#F5F5F0] hover:text-white hover:bg-[#222220] transition-colors"
              >
                <FileCode size={13} className="text-[#9C9C96] shrink-0 sm:w-3.5 sm:h-3.5" />
                <div>
                  <div className="font-medium font-display text-xs sm:text-sm">Structured Schema (.json)</div>
                  <div className="font-editorial-meta text-[9px] text-[#9C9C96]">Machine-readable JSON data</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Beat Expansion Bottom Sheet */}
      <BeatBottomSheet
        isOpen={Boolean(mobileActiveBeat)}
        onClose={() => setMobileActiveBeat(null)}
        sceneIndex={mobileActiveBeat?.sceneIndex ?? 1}
        sceneRoman={mobileActiveBeat?.sceneRoman ?? 'I'}
        beat={mobileActiveBeat?.beat ?? null}
        allBeatsInScene={mobileActiveBeat?.allBeats ?? []}
        onNavigateBeat={(nextBeat) => {
          if (mobileActiveBeat) {
            setMobileActiveBeat({
              ...mobileActiveBeat,
              beat: nextBeat,
            });
          }
        }}
        copiedIndex={copiedIndex}
        onCopy={copyToClipboard}
        generationMode={result.generationMode || 'image'}
      />
    </div>
  );
}
