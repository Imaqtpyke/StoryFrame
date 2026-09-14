import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { StoryGenerationResult, StoryFormat, Beat } from '../types';
import StyleAndCharactersSection from './StyleAndCharactersSection';
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
  Table
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
  const [isMobileStyleModalOpen, setIsMobileStyleModalOpen] = useState(false);
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

  // Normalize scenes with hard beat ceilings (ensuring no beat exceeds 2s or 8 words)
  const normalizedScenes = useMemo(() => {
    return result.scenes.map((scene) => ({
      ...scene,
      beats: enforceBeatCeilings(scene.beats || [], scene.index),
    }));
  }, [result.scenes]);

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

  // Close modal on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMobileStyleModalOpen) setIsMobileStyleModalOpen(false);
        if (isExportMenuOpen) setIsExportMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileStyleModalOpen, isExportMenuOpen]);

  // Lock body scroll when mobile modal is open
  useEffect(() => {
    if (isMobileStyleModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileStyleModalOpen]);

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
    const rows: string[][] = [
      ['Scene', 'Roman Scene', 'Beat', 'Estimated Seconds', 'Shot Type', 'Camera Movement', 'Spoken Narration', 'Visual Image Prompt'],
    ];

    normalizedScenes.forEach((scene) => {
      (scene.beats || []).forEach((beat) => {
        rows.push([
          `Scene ${scene.index}`,
          `SCENE ${toRomanNumeral(scene.index)}`,
          `Beat ${beat.beatIndex}`,
          `${beat.estimatedSeconds}s`,
          beat.shotType || 'Medium Shot',
          beat.cameraMovement || 'Static',
          `"${beat.textSpan.replace(/"/g, '""')}"`,
          `"${beat.imagePrompt.replace(/"/g, '""')}"`,
        ]);
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
    md += `**Estimated Duration**: ~${formatSecondsToMinutes(result.totalDurationSeconds)}\n`;
    md += `**Total Scenes**: ${normalizedScenes.length} | **Total Visual Beats**: ${totalBeatsCount}\n\n`;

    if (result.styleProfile) {
      md += `## Visual Style Profile\n`;
      md += `- **Art Style**: ${result.styleProfile.artStyle}\n`;
      md += `- **Color Palette**: ${result.styleProfile.colorPalette}\n`;
      md += `- **Lighting**: ${result.styleProfile.lighting}\n`;
      md += `- **Era & Setting**: ${result.styleProfile.eraAndSetting}\n\n`;
    }

    if (characterEntries.length > 0) {
      md += `## Character Continuity Sheet\n`;
      characterEntries.forEach(([name, desc]) => {
        md += `- **${name}**: ${desc}\n`;
      });
      md += `\n`;
    }

    md += `## Complete Narrator Script\n\n> ${fullScript}\n\n`;

    md += `## Director Shot List Breakdown\n\n`;
    normalizedScenes.forEach((scene) => {
      md += `### SCENE ${toRomanNumeral(scene.index)} (~${scene.estimatedSeconds}s)\n`;
      md += `**Narrator Line**:\n"${scene.narratorLine}"\n\n`;
      md += `| Beat | Duration | Shot Type | Camera Motion | Spoken Words | Visual Image Prompt |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
      (scene.beats || []).forEach((b) => {
        md += `| Beat ${b.beatIndex} | ~${b.estimatedSeconds}s | ${b.shotType || 'Medium Shot'} | ${b.cameraMovement || 'Static'} | "${b.textSpan.replace(/\|/g, '-')}" | ${b.imagePrompt.replace(/\|/g, '-')} |\n`;
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
            title="Copy all beat image prompts sequentially into clipboard"
          >
            {copiedIndex === 'all-prompts' ? (
              <>
                <Check size={10} className="text-white sm:w-3 sm:h-3" />
                <span className="text-white font-semibold">COPIED</span>
              </>
            ) : (
              <>
                <Copy size={10} className="text-[#9C9C96] sm:w-3 sm:h-3" />
                <span>COPY ALL PROMPTS</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Style Drawer Button */}
      {(result.styleProfile || characterEntries.length > 0) && (
        <div className="block md:hidden">
          <button
            type="button"
            id="mobile-view-style-btn"
            onClick={() => setIsMobileStyleModalOpen(true)}
            className="w-full flex items-center justify-between p-3 bg-[#141412] hover:bg-[#1a1a18] active:bg-[#222220] border border-white/10 transition-all text-left shadow-sm min-h-[40px] group"
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-6 h-6 border border-white/30 bg-[#1e1e1c] flex items-center justify-center text-white shrink-0 group-hover:border-white">
                <Sparkles size={12} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="font-editorial-meta text-[10px] sm:text-[11px] font-semibold text-white">
                    STYLE &amp; CHARACTERS
                  </span>
                  <span className="stamp-chip stamp-chip-primary text-[9px] py-0.5 px-1.5">
                    SHEET
                  </span>
                </div>
                <p className="text-[10px] text-[#9C9C96] truncate mt-0.5 font-narrative">
                  {result.styleProfile ? result.styleProfile.artStyle : ''}
                  {characterEntries.length > 0 ? ` • ${characterEntries.length} characters` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1 font-editorial-meta text-[9px] text-white pl-2 shrink-0">
              <span>VIEW</span>
              <SlidersHorizontal size={10} className="text-[#9C9C96]" />
            </div>
          </button>
        </div>
      )}

      {/* Desktop Style & Character Section with Corner Accent Brackets */}
      <div className="hidden md:block space-y-6 corner-bracket-container" id="desktop-style-character-container">
        <StyleAndCharactersSection
          styleProfile={result.styleProfile}
          characterSheet={result.characterSheet}
          copiedIndex={copiedIndex}
          onCopy={copyToClipboard}
          isModal={false}
        />
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

                  {/* Beats Breakdown Section */}
                  <div className="space-y-3.5 sm:space-y-4 pt-1 sm:pt-2">
                    <div className="flex items-center justify-between border-t border-white/10 pt-3 sm:pt-4">
                      <div className="flex items-center space-x-1.5 sm:space-x-2">
                        <Layers size={12} className="text-[#9C9C96] sm:w-3.5 sm:h-3.5" />
                        <span className="font-editorial-meta text-[9px] sm:text-[10px] text-[#C4C4C0]">
                          CINEMATOGRAPHY &amp; VISUAL BEATS
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-editorial-meta text-[9px] sm:text-[10px] text-[#7D7D76]">
                          {beats.length} SETUPS
                        </span>
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
                            className="flex-none w-[160px] xs:w-[175px] snap-start bg-[#161614] border border-white/10 active:border-white/40 active:bg-[#1E1E1C] p-2.5 flex flex-col justify-between min-h-[96px] cursor-pointer transition-all rounded-[2px]"
                          >
                            <div className="flex items-center justify-between gap-1 border-b border-white/5 pb-1">
                              <span className="stamp-chip stamp-chip-primary font-bold text-[8px]">
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
                        TAP ANY BEAT TO SLIDE UP COMPLETE VISUAL PROMPT &amp; SCRIPT
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
                              className="bg-[#161614] border border-white/10 hover:border-white/30 hover:bg-[#1C1C1A] p-3 flex flex-col justify-between min-h-[112px] cursor-pointer transition-all group select-none rounded-[2px]"
                              title="Click to expand full beat breakdown"
                            >
                              <div className="flex items-center justify-between gap-1 border-b border-white/5 pb-1.5">
                                <span className="stamp-chip stamp-chip-primary font-bold text-[9px]">
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
                                {beat.cameraMovement && (
                                  <div className="flex items-center gap-1 text-[8px] font-editorial-meta text-[#8C8C86]">
                                    <Video size={8} className="text-[#7D7D76] shrink-0" />
                                    <span className="truncate">{beat.cameraMovement}</span>
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
                            className="col-span-full bg-[#181816] border border-white/25 p-4 sm:p-5 md:p-6 space-y-3.5 shadow-xl transition-all rounded-[2px]"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2.5 sm:pb-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="stamp-chip stamp-chip-primary font-bold">
                                  BEAT {String(beat.beatIndex).padStart(2, '0')}
                                </span>
                                {beat.shotType && (
                                  <span className="stamp-chip">
                                    <Camera size={9} className="mr-1 text-[#9C9C96] shrink-0 sm:w-2.5 sm:h-2.5" />
                                    {beat.shotType}
                                  </span>
                                )}
                                {beat.cameraMovement && (
                                  <span className="stamp-chip">
                                    <Video size={9} className="mr-1 text-[#9C9C96] shrink-0 sm:w-2.5 sm:h-2.5" />
                                    {beat.cameraMovement}
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
                                  className="inline-flex items-center justify-center font-editorial-meta text-[9px] sm:text-[10px] px-2.5 sm:px-3 py-1 text-white bg-[#222220] hover:bg-[#2e2e2a] border border-white/20 transition-colors whitespace-nowrap min-h-[28px]"
                                >
                                  {isCopiedPrompt ? (
                                    <>
                                      <Check size={10} className="mr-1 text-white shrink-0 sm:w-3 sm:h-3" />
                                      <span className="text-white font-semibold">COPIED</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={10} className="mr-1 shrink-0 text-[#9C9C96] sm:w-3 sm:h-3" />
                                      <span>COPY PROMPT</span>
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
                                  SPOKEN PHRASE (MAX 8 WORDS)
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

                            {/* Visual Image Prompt for this Beat */}
                            <div className="space-y-1">
                              <span className="font-editorial-meta text-[9px] sm:text-[10px] text-[#9C9C96]">
                                STRUCTURED VISUAL PROMPT
                              </span>
                              <div className="text-xs sm:text-sm text-[#E6E6E1] leading-relaxed font-narrative bg-[#080808] p-2.5 sm:p-3.5 border border-white/10 selection:bg-white selection:text-black">
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

      {/* Mobile Slide-in Drawer / Modal for Visual Style & Character Sheet */}
      {isMobileStyleModalOpen && createPortal(
        <div
          id="mobile-style-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-modal-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMobileStyleModalOpen(false);
          }}
        >
          <div className="w-full sm:max-w-xl max-h-[85vh] sm:max-h-[90vh] bg-[#0E0E0D] border-t sm:border border-white/15 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-white/10 bg-[#141412] shrink-0">
              <div className="flex items-center space-x-2.5">
                <Sparkles size={15} className="text-white shrink-0 sm:w-4 sm:h-4" />
                <h3 id="mobile-modal-title" className="font-editorial-meta text-xs font-semibold text-white">
                  STYLE &amp; CHARACTERS
                </h3>
              </div>
              <button
                type="button"
                id="close-mobile-style-modal-btn"
                onClick={() => setIsMobileStyleModalOpen(false)}
                aria-label="Close modal"
                className="p-2 -mr-1 text-[#9C9C96] hover:text-white hover:bg-white/5 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <X size={16} className="sm:w-[18px] sm:h-[18px]" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4">
              <StyleAndCharactersSection
                styleProfile={result.styleProfile}
                characterSheet={result.characterSheet}
                copiedIndex={copiedIndex}
                onCopy={copyToClipboard}
                isModal={true}
              />
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-white/10 bg-[#141412] shrink-0">
              <button
                type="button"
                id="dismiss-mobile-style-modal-btn"
                onClick={() => setIsMobileStyleModalOpen(false)}
                className="w-full py-2.5 bg-white text-black hover:bg-neutral-200 font-editorial-meta text-xs font-semibold transition-colors min-h-[42px] flex items-center justify-center"
              >
                DONE / RETURN TO BEATS
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

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
      />
    </div>
  );
}
