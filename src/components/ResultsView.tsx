import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { StoryGenerationResult, StoryFormat, Beat, CtaPlatform, CtaModality, CtaEngagementType } from '../types';
import BeatBottomSheet from './BeatBottomSheet';
import CharacterReferenceModal from './CharacterReferenceModal';
import StyleAndCharactersSection from './StyleAndCharactersSection';
import SeriesRoadmapModal from './SeriesRoadmapModal';
import { enforceBeatCeilings, getPreviewText } from '../services/beatSplitting';
import { compileBeatPrompt, lintStoryboard, LintIssue, compileThumbnailPrompt, compileCtaPrompt } from '../services/promptCompiler';
import { generateCMX3600EDL, generateSRTSubtitles, calculatePacing } from '../services/timelineExport';
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
  AlertTriangle,
  Info,
  CheckCheck,
  ExternalLink,
  Users,
} from 'lucide-react';

import {
  syncStoryResultToContinuity,
  loadSeriesContinuity,
  initializeNextEpisodeDraft,
  hasSavedSeriesContinuity,
} from '../services/seriesContinuityStorage';

interface ResultsViewProps {
  result: StoryGenerationResult;
  format: StoryFormat;
  platform: string;
  onBackToEdit: () => void;
  onReset: () => void;
  onStartEpisodeDraft?: (payload: {
    story: string;
    characterStyle: string;
    format: 'short' | 'long';
    generationMode: 'video' | 'image';
    targetVideoDuration: number;
    platform: string;
    characterSheet?: Record<string, string>;
  }) => void;
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
  onStartEpisodeDraft,
}: ResultsViewProps) {
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Modal states
  const [isRefModalOpen, setIsRefModalOpen] = useState<boolean>(false);
  const [isStyleModalOpen, setIsStyleModalOpen] = useState<boolean>(false);
  const [isRoadmapModalOpen, setIsRoadmapModalOpen] = useState<boolean>(false);
  const [isContinuitySaved, setIsContinuitySaved] = useState<boolean>(() => hasSavedSeriesContinuity());

  // Auto-persist series continuity if manuscript has series roadmap
  useEffect(() => {
    if (result.seriesRoadmap && result.seriesRoadmap.length > 0) {
      syncStoryResultToContinuity(result, 1);
      setIsContinuitySaved(true);
    }
  }, [result]);

  const handleManualSaveContinuity = () => {
    const currentTitle = result.title || "Untitled Series";
    syncStoryResultToContinuity(result, 1, currentTitle);
    setIsContinuitySaved(true);
  };

  const handleSelectEpisodeForDraft = (ep: { episodeNumber: number; title: string; description: string }) => {
    const currentTitle = result.title || "Untitled Series";
    const continuity = loadSeriesContinuity(currentTitle) || syncStoryResultToContinuity(result, 1, currentTitle);
    const draft = initializeNextEpisodeDraft(continuity, ep.episodeNumber);
    if (onStartEpisodeDraft) {
      onStartEpisodeDraft({
        story: draft.draftStoryText,
        characterStyle: draft.characterStyle,
        format: draft.format,
        generationMode: draft.generationMode,
        targetVideoDuration: draft.targetVideoDuration,
        platform: 'TikTok',
        characterSheet: draft.inheritedCharacters,
      });
    }
    setIsRoadmapModalOpen(false);
  };

  // Mobile bottom sheet beat breakdown state
  const [mobileActiveBeat, setMobileActiveBeat] = useState<{
    sceneIndex: number;
    sceneRoman: string;
    beat: Beat;
    allBeats: Beat[];
  } | null>(null);

  // Normalize scenes with hard beat ceilings for short-form retention pacing
  const normalizedScenes = useMemo(() => {
    return result.scenes.map((scene) => ({
      ...scene,
      beats: enforceBeatCeilings(scene.beats || [], scene.index, {
        isVideoMode: result.generationMode === 'video',
        targetVideoDuration: result.targetVideoDuration || 5,
      }),
    }));
  }, [result.scenes, result.generationMode, result.targetVideoDuration]);

  // Deterministic Storyboard Linter issues (L01 - L06)
  const lintIssues = useMemo(() => {
    return lintStoryboard(normalizedScenes, result.characterSheet);
  }, [normalizedScenes, result.characterSheet]);

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

  // Beat click handler opens bottom sheet modal with full prompt details
  const handleBeatClick = (sceneIndex: number, sceneRoman: string, beat: Beat, allBeats: Beat[]) => {
    setMobileActiveBeat({ sceneIndex, sceneRoman, beat, allBeats });
  };



  const fullScript = normalizedScenes.map((s) => s.narratorLine).join(' ');
  const totalBeatsCount = normalizedScenes.reduce((acc, s) => acc + (s.beats?.length || 0), 0);
  const characterEntries = Object.entries(result.characterSheet || {});
  const isVideoMode = result.generationMode === 'video';

  // Thumbnail accordion state (defaults to collapsed)
  const [isThumbnailExpanded, setIsThumbnailExpanded] = useState<boolean>(false);
  const [thumbnailPromptMode, setThumbnailPromptMode] = useState<'full' | 'clean'>('full');

  // Story-Adaptive CTA Outro state (defaults to collapsed)
  const [isCtaExpanded, setIsCtaExpanded] = useState<boolean>(false);
  const [ctaPlatform, setCtaPlatform] = useState<CtaPlatform>(() => {
    if (platform.toLowerCase().includes('youtube')) return 'youtube_shorts';
    if (platform.toLowerCase().includes('tiktok')) return 'tiktok';
    return 'tiktok';
  });
  const [ctaModality, setCtaModality] = useState<CtaModality>(result.generationMode === 'video' ? 'video' : 'image');
  const [ctaEngagementType, setCtaEngagementType] = useState<CtaEngagementType>('question');
  const [ctaPromptMode, setCtaPromptMode] = useState<'full' | 'clean'>('full');
  const [customCtaQuestion, setCustomCtaQuestion] = useState<string>('');
  const [isEditingQuestion, setIsEditingQuestion] = useState<boolean>(false);

  const activeThumbnail = useMemo(() => {
    if (result.thumbnail) return result.thumbnail;
    return compileThumbnailPrompt({
      rawThumbnail: undefined,
      styleProfile: result.styleProfile,
      characterSheet: result.characterSheet,
      storyPremise: fullScript || '',
      format,
      platform,
    });
  }, [result.thumbnail, result.styleProfile, result.characterSheet, fullScript, format, platform]);

  const activeCta = useMemo(() => {
    return compileCtaPrompt({
      storyPremise: fullScript || '',
      styleProfile: result.styleProfile,
      characterSheet: result.characterSheet,
      format,
      platform: ctaPlatform,
      modality: ctaModality,
      questionText: customCtaQuestion,
      engagementType: ctaEngagementType,
    });
  }, [fullScript, result.styleProfile, result.characterSheet, format, ctaPlatform, ctaModality, customCtaQuestion, ctaEngagementType]);

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
        const compiled = compileBeatPrompt(
          b,
          scene,
          result.styleProfile,
          'universal',
          format,
          result.generationMode
        );
        const shotTag = b.shotType ? `[${b.shotType}] ` : '';
        lines.push(`SCENE ${toRomanNumeral(scene.index)} - BEAT ${b.beatIndex} ${shotTag}:\n${compiled.promptText}`);
      });
    });
    copyToClipboard(lines.join('\n\n'), 'all-prompts');
  };

  const handleCopyCleanScript = () => {
    copyToClipboard(fullScript, 'clean-script');
  };

  // Export functions
  const downloadEdlExport = () => {
    setIsExportMenuOpen(false);
    const edlContent = generateCMX3600EDL(normalizedScenes, platform);
    const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(edlContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `timeline-${platform.toLowerCase().replace(/[^a-z0-9]/g, '-')}.edl`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const downloadSrtExport = () => {
    setIsExportMenuOpen(false);
    const srtContent = generateSRTSubtitles(normalizedScenes);
    const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(srtContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `subtitles-${platform.toLowerCase().replace(/[^a-z0-9]/g, '-')}.srt`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };
  const downloadJsonExport = () => {
    setIsExportMenuOpen(false);
    const exportPayload = {
      ...result,
      scenes: normalizedScenes,
      thumbnail: activeThumbnail,
      ctaPrompt: activeCta,
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

    const assumptionsList = result.assumptions || result.storyBible?.assumptions || [];
    if (assumptionsList.length > 0) {
      md += `## Story Bible Assumptions\n`;
      assumptionsList.forEach((assump) => {
        md += `- ${assump}\n`;
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

    // Append Cover Thumbnail Blueprint
    md += `## Production Cover & Hero Thumbnail\n\n`;
    md += `- **Aspect Ratio**: ${activeThumbnail.aspectRatio}\n`;
    md += `- **Curiosity Hook**: "${activeThumbnail.hookText}"\n`;
    md += `- **Typography Style**: ${activeThumbnail.fontStyle}\n\n`;
    md += `### Production Thumbnail Prompt (With Typography)\n\`\`\`text\n${activeThumbnail.compiledPrompt}\n\`\`\`\n\n`;
    md += `### Clean Plate Prompt (Background Only)\n\`\`\`text\n${activeThumbnail.cleanPlatePrompt}\n\`\`\`\n\n`;

    // Append Call-to-Action Outro Visual Prompt
    md += `## Story-Adaptive Call-to-Action Outro Prompt\n\n`;
    md += `- **Platform**: ${activeCta.platform}\n`;
    md += `- **Modality**: ${activeCta.modality === 'video' ? 'Text to Video Loop (~3s)' : 'Text to Image Freeze Frame'}\n`;
    md += `- **Intrigue Question**: "${activeCta.questionText}"\n`;
    md += `- **Engagement Focus**: ${activeCta.engagementType}\n\n`;
    md += `### Production CTA Prompt (With Graphic Callout)\n\`\`\`text\n${activeCta.compiledPrompt}\n\`\`\`\n\n`;
    md += `### Clean Plate CTA Prompt (Background Loop Only)\n\`\`\`text\n${activeCta.cleanPlatePrompt}\n\`\`\`\n\n`;

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
    <div className="w-full max-w-5xl mx-auto space-y-4 sm:space-y-6 font-narrative text-[#F5F5F0]">
      {/* Sleek, Compact Top Navigation & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-white/10">
        <div className="flex items-center space-x-2.5 flex-wrap text-xs">
          <button
            type="button"
            id="back-to-edit-button"
            onClick={onBackToEdit}
            className="inline-flex items-center text-[#A0A09A] hover:text-white transition-colors py-1 font-display"
          >
            <ArrowLeft size={13} className="mr-1.5 shrink-0" />
            Edit Story
          </button>
          <span className="text-white/20">/</span>
          <button
            type="button"
            id="start-new-button"
            onClick={onReset}
            className="inline-flex items-center text-[#A0A09A] hover:text-white transition-colors py-1 font-display"
          >
            New Story
          </button>
          <span className="text-white/20">·</span>
          <span className="text-[11px] text-[#8C8C86] font-editorial-meta">
            {result.scenes.length} SCENES · {totalBeatsCount} BEATS · ~{formatSecondsToMinutes(result.totalDurationSeconds)} ({platform})
          </span>
        </div>

        {/* Compact Utility Actions Row */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
          {/* Batch Copy Prompts */}
          <button
            type="button"
            id="batch-copy-prompts-btn"
            onClick={handleCopyAllPrompts}
            className="inline-flex items-center px-2.5 py-1 bg-white text-black hover:bg-neutral-200 text-[11px] font-display font-medium transition-colors rounded shadow-sm min-h-[28px]"
            title="Copy all beat prompts"
          >
            {copiedIndex === 'all-prompts' ? (
              <>
                <Check size={11} className="mr-1 text-black" />
                <span>Copied All</span>
              </>
            ) : (
              <>
                <Copy size={11} className="mr-1 text-black" />
                <span>Copy All Prompts</span>
              </>
            )}
          </button>

          {/* Character Reference Packets Modal Button */}
          {result.characterSheet && Object.keys(result.characterSheet).length > 0 && (
            <button
              type="button"
              id="open-ref-packets-header-btn"
              onClick={() => setIsRefModalOpen(true)}
              className="inline-flex items-center px-2.5 py-1 bg-[#161614] hover:bg-[#20201e] text-[#D4D4D0] hover:text-white border border-white/15 text-[11px] font-display transition-colors rounded min-h-[28px]"
              title="Open multi-angle reference prompts for Midjourney / Kling"
            >
              <Users size={11} className="mr-1 text-[#9C9C96]" />
              <span>Character Packets</span>
            </button>
          )}

          {/* Series Roadmap Modal Button */}
          {result.seriesRoadmap && result.seriesRoadmap.length > 0 && (
            <button
              type="button"
              id="open-series-roadmap-header-btn"
              onClick={() => setIsRoadmapModalOpen(true)}
              className="inline-flex items-center px-2.5 py-1 bg-[#161614] hover:bg-[#20201e] text-[#D4D4D0] hover:text-white border border-white/15 text-[11px] font-display transition-colors rounded min-h-[28px]"
              title="Open 11-Episode Series Continuity Roadmap"
            >
              <Film size={11} className="mr-1 text-amber-400" />
              <span>Series Roadmap ({result.seriesRoadmap.length} Ep)</span>
            </button>
          )}

          {/* Jump to Cover Thumbnail */}
          <button
            type="button"
            id="jump-to-thumbnail-btn"
            onClick={() => {
              setIsThumbnailExpanded(true);
              const el = document.getElementById('thumbnail-cover-panel');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="inline-flex items-center px-2.5 py-1 bg-[#161614] hover:bg-[#20201e] text-[#D4D4D0] hover:text-white border border-white/15 text-[11px] font-display transition-colors rounded min-h-[28px]"
            title="Jump to Cover & Thumbnail Blueprint"
          >
            <ImageIcon size={11} className="mr-1 text-amber-400" />
            <span>Thumbnail</span>
          </button>

          {/* Jump to CTA Outro */}
          <button
            type="button"
            id="jump-to-cta-btn"
            onClick={() => {
              setIsCtaExpanded(true);
              const el = document.getElementById('cta-outro-panel');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="inline-flex items-center px-2.5 py-1 bg-[#161614] hover:bg-[#20201e] text-[#D4D4D0] hover:text-white border border-white/15 text-[11px] font-display transition-colors rounded min-h-[28px]"
            title="Jump to Call-to-Action Outro Visual Prompt"
          >
            <Zap size={11} className="mr-1 text-amber-400" />
            <span>CTA Outro</span>
          </button>

          {/* Quick Expand/Collapse Scenes Toggle */}
          <button
            type="button"
            id="toggle-all-scenes-btn"
            onClick={() => setAllScenesExpanded(!allExpanded)}
            className="inline-flex items-center px-2 py-1 bg-[#161614] hover:bg-[#20201e] text-[#A0A09A] hover:text-white border border-white/10 text-[11px] font-display transition-colors rounded min-h-[28px]"
            title={allExpanded ? 'Collapse all scenes' : 'Expand all scenes'}
          >
            <ChevronsUpDown size={11} className="mr-1 text-[#9C9C96]" />
            <span>{allExpanded ? 'Collapse All' : 'Expand All'}</span>
          </button>
        </div>
      </div>

      {/* Slim 1-Line Scene Jump Bar */}
      <div className="flex items-center w-full h-6 bg-[#0E0E0D] border border-white/10 rounded overflow-hidden p-0.5 gap-1">
        {sceneTimelineRanges.map((range) => {
          const roman = toRomanNumeral(range.sceneIndex);
          const sceneSec = result.scenes[range.sceneIndex - 1]?.estimatedSeconds;
          return (
            <button
              key={range.sceneIndex}
              type="button"
              onClick={() => scrollToScene(range.sceneIndex)}
              className="h-full flex-1 group bg-[#181816] hover:bg-[#282824] active:bg-[#32322e] rounded-[2px] transition-colors flex items-center justify-center px-1"
              title={`Jump to Scene ${range.sceneIndex} (SC ${roman}) • ${formatTimecode(range.startSec)} - ${formatTimecode(range.endSec)}`}
            >
              <span className="font-editorial-meta text-[9px] text-[#A0A09A] group-hover:text-white truncate">
                SC {roman} {typeof sceneSec === 'number' && `(~${sceneSec}s)`}
              </span>
            </button>
          );
        })}
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
                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-wrap">
                  <Film size={14} className="text-white shrink-0 sm:w-4 sm:h-4" />
                  <span className="font-display text-xs sm:text-base font-medium tracking-tight text-white truncate">
                    Scene {romanScene}
                  </span>
                  <span className="stamp-chip text-[9px] sm:text-[10px]">
                    {beats.length} {beats.length === 1 ? 'Beat' : 'Beats'}
                  </span>
                  <span className="font-editorial-meta text-[9px] sm:text-[10px] text-[#9C9C96] shrink-0">
                    ~{scene.estimatedSeconds}s
                  </span>
                  {(() => {
                    const scenePacing = calculatePacing(scene.narratorLine, scene.estimatedSeconds);
                    return (
                      <span
                        className={`stamp-chip text-[8px] sm:text-[9px] hidden sm:inline-flex ${
                          scenePacing.status === 'rushed'
                            ? 'bg-amber-950/70 text-amber-300 border-amber-800/80 font-semibold'
                            : 'text-[#8C8C86]'
                        }`}
                        title={`Speaking rate: ~${scenePacing.wordsPerMinute} WPM (ideal is ~140 WPM)`}
                      >
                        {scenePacing.status === 'rushed'
                          ? `Pacing: Rushed (~${scenePacing.wordsPerMinute} WPM)`
                          : `Pacing: ~${scenePacing.wordsPerMinute} WPM`}
                      </span>
                    );
                  })()}
                </div>

                <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(scene.narratorLine, `narration-${scene.index}`);
                    }}
                    className="inline-flex items-center font-editorial-meta text-[9px] sm:text-[10px] px-2 sm:px-2.5 py-1 text-[#D4D4D0] hover:text-white bg-[#1f1f1d] hover:bg-[#2a2a27] border border-white/15 transition-colors whitespace-nowrap min-h-[28px] sm:min-h-[30px] rounded-[2px]"
                    title="Copy full scene narrator line"
                  >
                    {isCopiedNarration ? (
                      <>
                        <Check size={10} className="mr-1 text-white sm:w-3 sm:h-3" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={10} className="mr-1 sm:w-3 sm:h-3" />
                        <span>Copy Line</span>
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

                      </div>
                    </div>

                    {/* COMPACT VIEW: Dense Chips Matrix with Tap-to-View (Default & Sole Layout) */}
                    <>
                      {/* Mobile Filmstrip Row */}
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
                                {beat.overlayText && (
                                  <span className="font-mono text-[8px] px-1 py-0.5 rounded-[2px] bg-amber-500/10 text-amber-300 border border-amber-500/20" title="Editor Overlay Text">
                                    {beat.overlayText}
                                  </span>
                                )}
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
                      </div>

                      {/* Desktop Compact Matrix */}
                      <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
                        {beats.map((beat) => {
                          const beatKey = `scene-${scene.index}-beat-${beat.beatIndex}`;
                          return (
                            <div
                              key={beat.beatIndex}
                              id={`desktop-beat-chip-${scene.index}-${beat.beatIndex}`}
                              onClick={() => handleBeatClick(scene.index, romanScene, beat, beats)}
                              className={`border p-3 flex flex-col justify-between min-h-[105px] cursor-pointer transition-all group select-none rounded-[2px] ${
                                isVideoMode
                                  ? 'bg-[#141310] border-amber-900/30 hover:border-amber-700/60 hover:bg-[#1A1813]'
                                  : 'bg-[#080D14] border-sky-900/15 hover:border-sky-700/30 hover:bg-[#0C141F]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 border-b border-white/5 pb-1.5">
                                <span className={`stamp-chip font-bold text-[9px] ${isVideoMode ? 'bg-amber-950/70 text-amber-300 border-amber-800/80' : 'bg-sky-950/25 text-sky-200/70 border-sky-800/25'}`}>
                                  Beat {String(beat.beatIndex).padStart(2, '0')}
                                </span>
                                {beat.overlayText && (
                                  <span className="font-mono text-[8px] px-1 py-0.5 rounded-[2px] bg-amber-500/10 text-amber-300 border border-amber-500/20" title="Editor Overlay Text">
                                    {beat.overlayText}
                                  </span>
                                )}
                                <span className="font-editorial-meta text-[9px] text-emerald-400/90">
                                  ~{beat.estimatedSeconds}s
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
                              </div>
                              <div className="pt-1.5 border-t border-white/5 flex items-center justify-between gap-1">
                                <p className="text-[11px] text-[#E6E6E1] italic font-narrative truncate max-w-[85%]">
                                  &ldquo;{getPreviewText(beat.textSpan, 6)}&rdquo;
                                </p>
                                <ChevronDown size={11} className="text-[#7D7D76] group-hover:text-white transition-colors shrink-0" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Production Cover & Thumbnail Blueprint (Collapsible) */}
      <div
        id="thumbnail-cover-panel"
        className="bg-[#121211] border border-white/10 rounded-[2px] shadow-xl overflow-hidden transition-all"
      >
        {/* Clickable Accordion Header */}
        <div
          onClick={() => setIsThumbnailExpanded(!isThumbnailExpanded)}
          className="w-full flex items-center justify-between p-3.5 sm:p-5 bg-[#161614] hover:bg-[#1a1a18] cursor-pointer transition-colors border-b border-white/10 select-none flex-wrap gap-2.5"
        >
          <div className="min-w-0 flex-1 pr-2">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="stamp-chip bg-amber-950/70 text-amber-300 border-amber-800/80 text-[8px] sm:text-[9px] font-bold">
                COVER &amp; THUMBNAIL BLUEPRINT
              </span>
              <span className="font-editorial-meta text-[9px] sm:text-[10px] text-[#9C9C96]">
                {activeThumbnail.aspectRatio} · {activeThumbnail.targetPlatform}
              </span>
              {!isThumbnailExpanded && (
                <span className="text-[9px] font-mono text-amber-300/90 truncate max-w-xs">
                  Hook: &ldquo;{activeThumbnail.hookText}&rdquo;
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-xl font-normal font-display tracking-tight text-white flex items-center gap-2">
              <span>Production Cover &amp; Hero Thumbnail</span>
            </h3>
            <p className="text-xs text-[#9C9C96] mt-0.5 font-narrative leading-relaxed">
              High-CTR hero cover synthesized from the narrative conflict. Adapted to {activeThumbnail.targetPlatform} safe zones with locked character identity.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Copy Button (always accessible) */}
            <button
              type="button"
              id="copy-thumbnail-prompt-header-btn"
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(
                  thumbnailPromptMode === 'full'
                    ? activeThumbnail.compiledPrompt
                    : activeThumbnail.cleanPlatePrompt,
                  `thumbnail-${thumbnailPromptMode}`
                );
              }}
              className="inline-flex items-center justify-center px-2.5 sm:px-3 py-1 bg-white text-black hover:bg-neutral-200 active:bg-neutral-300 text-[9px] sm:text-[10px] font-editorial-meta font-semibold transition-colors whitespace-nowrap min-h-[28px] sm:min-h-[30px] rounded-[2px] shadow-sm cursor-pointer"
              title="Copy thumbnail prompt"
            >
              {copiedIndex === `thumbnail-${thumbnailPromptMode}` ? (
                <>
                  <Check size={10} className="mr-1 text-black shrink-0 sm:w-3 sm:h-3" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={10} className="mr-1 text-black shrink-0 sm:w-3 sm:h-3" />
                  <span>Copy Prompt</span>
                </>
              )}
            </button>

            {/* Collapse/Expand toggle button */}
            <button
              type="button"
              id="toggle-thumbnail-panel-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsThumbnailExpanded(!isThumbnailExpanded);
              }}
              className="inline-flex items-center px-2.5 py-1 bg-[#1f1f1d] hover:bg-[#2a2a27] text-[#D4D4D0] hover:text-white border border-white/15 text-[10px] font-display transition-colors rounded-[2px] min-h-[28px] sm:min-h-[30px]"
              aria-expanded={isThumbnailExpanded}
              title={isThumbnailExpanded ? 'Collapse Thumbnail Blueprint' : 'Expand Thumbnail Blueprint'}
            >
              {isThumbnailExpanded ? (
                <>
                  <ChevronUp size={12} className="mr-1 text-[#9C9C96]" />
                  <span>Collapse</span>
                </>
              ) : (
                <>
                  <ChevronDown size={12} className="mr-1 text-[#9C9C96]" />
                  <span>Expand</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        {isThumbnailExpanded && (
          <div className="p-3.5 sm:p-6 md:p-8 space-y-4 bg-[#121211]">
            {/* Mode Toggle Row */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-editorial-meta text-[10px] text-[#8C8C86]">
                Thumbnail Rendering Mode:
              </span>
              <div className="inline-flex p-0.5 bg-[#181816] border border-white/10 rounded-[2px]">
                <button
                  type="button"
                  id="thumbnail-with-type-toggle"
                  onClick={() => setThumbnailPromptMode('full')}
                  className={`px-2.5 py-1 text-[9px] sm:text-[10px] font-editorial-meta rounded-[2px] transition-colors ${
                    thumbnailPromptMode === 'full'
                      ? 'bg-white text-black font-semibold shadow-xs'
                      : 'text-[#8C8C86] hover:text-white'
                  }`}
                >
                  With Typography
                </button>
                <button
                  type="button"
                  id="thumbnail-clean-plate-toggle"
                  onClick={() => setThumbnailPromptMode('clean')}
                  className={`px-2.5 py-1 text-[9px] sm:text-[10px] font-editorial-meta rounded-[2px] transition-colors ${
                    thumbnailPromptMode === 'clean'
                      ? 'bg-white text-black font-semibold shadow-xs'
                      : 'text-[#8C8C86] hover:text-white'
                  }`}
                  title="Text-free background plate for Canva or Photoshop"
                >
                  Clean Plate
                </button>
              </div>
            </div>

            {/* Narrative Hook & Story-Adaptive Typography Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
              <div className="bg-[#0A0A09] p-3 border border-white/10 rounded-[2px] space-y-1 md:col-span-1">
                <span className="font-editorial-meta text-[8px] sm:text-[9px] text-amber-300 uppercase tracking-widest block">
                  Curiosity Hook Text
                </span>
                <div className="text-sm sm:text-base font-display font-bold text-white tracking-wide">
                  &ldquo;{activeThumbnail.hookText}&rdquo;
                </div>
                {activeThumbnail.alternateHooks && activeThumbnail.alternateHooks.length > 0 && (
                  <div className="pt-1 flex flex-wrap gap-1">
                    {activeThumbnail.alternateHooks.map((alt, i) => (
                      <span
                        key={i}
                        className="text-[8px] font-mono px-1 py-0.5 bg-white/5 border border-white/10 text-[#C4C4C0] rounded-[2px]"
                      >
                        Alt: &ldquo;{alt}&rdquo;
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-[#0A0A09] p-3 border border-white/10 rounded-[2px] space-y-1 md:col-span-1">
                <span className="font-editorial-meta text-[8px] sm:text-[9px] text-[#9C9C96] uppercase tracking-widest block">
                  Story-Adapted Typography
                </span>
                <p className="text-xs text-[#E8E8E2] font-narrative leading-relaxed capitalize">
                  {activeThumbnail.fontStyle}
                </p>
              </div>

              <div className="bg-[#0A0A09] p-3 border border-white/10 rounded-[2px] space-y-1 md:col-span-1">
                <span className="font-editorial-meta text-[8px] sm:text-[9px] text-emerald-400 uppercase tracking-widest block">
                  Platform Safe Zone Clearance
                </span>
                <p className="text-[10px] sm:text-xs text-[#A8A8A2] font-editorial-meta leading-tight">
                  {activeThumbnail.aspectRatio === '16:9'
                    ? 'Bottom-right 15% kept clear for YouTube duration badge; lower 10% clear for scrub bar.'
                    : 'Top 12% clear for profile/header; bottom 25% clear for captions; right side clear for engagement icons.'}
                </p>
              </div>
            </div>

            {/* Compiled Prompt Text Block */}
            <div className="bg-[#0A0A09] p-3.5 sm:p-5 border border-white/10 rounded-[2px] space-y-2 relative group">
              <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-editorial-meta text-[#8C8C86]">
                <span>
                  {thumbnailPromptMode === 'full'
                    ? 'Production Prompt with Typography Overlay'
                    : 'Clean Plate Prompt (Text-Free Background Plate)'}
                </span>
                <span className="font-mono text-white/50">{activeThumbnail.aspectRatio}</span>
              </div>
              <p className="text-xs sm:text-sm text-[#F5F5F0] leading-relaxed font-mono whitespace-pre-wrap selection:bg-white selection:text-black">
                {thumbnailPromptMode === 'full'
                  ? activeThumbnail.compiledPrompt
                  : activeThumbnail.cleanPlatePrompt}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Story-Adaptive Call-to-Action Outro Visual Prompt (Collapsible) */}
      <div
        id="cta-outro-panel"
        className="bg-[#121211] border border-white/10 rounded-[2px] shadow-xl overflow-hidden transition-all"
      >
        {/* Clickable Accordion Header */}
        <div
          onClick={() => setIsCtaExpanded(!isCtaExpanded)}
          className="w-full flex items-center justify-between p-3.5 sm:p-5 bg-[#161614] hover:bg-[#1a1a18] cursor-pointer transition-colors border-b border-white/10 select-none flex-wrap gap-2.5"
        >
          <div className="min-w-0 flex-1 pr-2">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="stamp-chip bg-amber-950/70 text-amber-300 border-amber-800/80 text-[8px] sm:text-[9px] font-bold">
                CALL-TO-ACTION OUTRO PROMPT
              </span>
              <span className="font-editorial-meta text-[9px] sm:text-[10px] text-[#9C9C96]">
                {ctaPlatform === 'tiktok'
                  ? 'TikTok 9:16'
                  : ctaPlatform === 'youtube_shorts'
                  ? 'YouTube Shorts 9:16'
                  : 'General Platforms'} · {ctaModality === 'video' ? 'Video Loop (T2V)' : 'Static Image (T2I)'}
              </span>
              {!isCtaExpanded && (
                <span className="text-[9px] font-mono text-emerald-300/90 truncate max-w-xs">
                  &ldquo;{activeCta.questionText}&rdquo;
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-xl font-normal font-display tracking-tight text-white flex items-center gap-2">
              <span>Story-Adaptive Call-to-Action Outro</span>
            </h3>
            <p className="text-xs text-[#9C9C96] mt-0.5 font-narrative leading-relaxed">
              High-retention closing beat engineered to ignite comments, debate, and follows. Adapted to platform UI safe zones.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Copy Button */}
            <button
              type="button"
              id="copy-cta-prompt-header-btn"
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(
                  ctaPromptMode === 'full' ? activeCta.compiledPrompt : activeCta.cleanPlatePrompt,
                  `cta-${ctaPromptMode}`
                );
              }}
              className="inline-flex items-center justify-center px-2.5 sm:px-3 py-1 bg-white text-black hover:bg-neutral-200 active:bg-neutral-300 text-[9px] sm:text-[10px] font-editorial-meta font-semibold transition-colors whitespace-nowrap min-h-[28px] sm:min-h-[30px] rounded-[2px] shadow-sm cursor-pointer"
              title="Copy CTA outro prompt"
            >
              {copiedIndex === `cta-${ctaPromptMode}` ? (
                <>
                  <Check size={10} className="mr-1 text-black shrink-0 sm:w-3 sm:h-3" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={10} className="mr-1 text-black shrink-0 sm:w-3 sm:h-3" />
                  <span>Copy CTA</span>
                </>
              )}
            </button>

            {/* Accordion Toggle */}
            <button
              type="button"
              id="toggle-cta-panel-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsCtaExpanded(!isCtaExpanded);
              }}
              className="inline-flex items-center px-2.5 py-1 bg-[#1f1f1d] hover:bg-[#2a2a27] text-[#D4D4D0] hover:text-white border border-white/15 text-[10px] font-display transition-colors rounded-[2px] min-h-[28px] sm:min-h-[30px]"
              aria-expanded={isCtaExpanded}
              title={isCtaExpanded ? 'Collapse CTA Section' : 'Expand CTA Section'}
            >
              {isCtaExpanded ? (
                <>
                  <ChevronUp size={12} className="mr-1 text-[#9C9C96]" />
                  <span>Collapse</span>
                </>
              ) : (
                <>
                  <ChevronDown size={12} className="mr-1 text-[#9C9C96]" />
                  <span>Expand</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        {isCtaExpanded && (
          <div className="p-3.5 sm:p-6 md:p-8 space-y-4 bg-[#121211]">
            {/* Interactive Configuration Controls Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 p-3 bg-[#0E0E0D] border border-white/10 rounded-[2px]">
              {/* Platform Selector */}
              <div className="space-y-1">
                <label className="font-editorial-meta text-[9px] uppercase tracking-wider text-[#9C9C96] block">
                  Platform Target
                </label>
                <div className="inline-flex w-full p-0.5 bg-[#181816] border border-white/10 rounded-[2px]">
                  <button
                    type="button"
                    onClick={() => setCtaPlatform('tiktok')}
                    className={`flex-1 py-1 text-[9px] sm:text-[10px] font-editorial-meta rounded-[2px] transition-colors ${
                      ctaPlatform === 'tiktok'
                        ? 'bg-white text-black font-semibold shadow-xs'
                        : 'text-[#8C8C86] hover:text-white'
                    }`}
                  >
                    TikTok
                  </button>
                  <button
                    type="button"
                    onClick={() => setCtaPlatform('youtube_shorts')}
                    className={`flex-1 py-1 text-[9px] sm:text-[10px] font-editorial-meta rounded-[2px] transition-colors ${
                      ctaPlatform === 'youtube_shorts'
                        ? 'bg-white text-black font-semibold shadow-xs'
                        : 'text-[#8C8C86] hover:text-white'
                    }`}
                  >
                    Shorts
                  </button>
                  <button
                    type="button"
                    onClick={() => setCtaPlatform('general')}
                    className={`flex-1 py-1 text-[9px] sm:text-[10px] font-editorial-meta rounded-[2px] transition-colors ${
                      ctaPlatform === 'general'
                        ? 'bg-white text-black font-semibold shadow-xs'
                        : 'text-[#8C8C86] hover:text-white'
                    }`}
                  >
                    General
                  </button>
                </div>
              </div>

              {/* Modality Selector */}
              <div className="space-y-1">
                <label className="font-editorial-meta text-[9px] uppercase tracking-wider text-[#9C9C96] block">
                  Outro Modality
                </label>
                <div className="inline-flex w-full p-0.5 bg-[#181816] border border-white/10 rounded-[2px]">
                  <button
                    type="button"
                    onClick={() => setCtaModality('video')}
                    className={`flex-1 py-1 text-[9px] sm:text-[10px] font-editorial-meta rounded-[2px] transition-colors ${
                      ctaModality === 'video'
                        ? 'bg-white text-black font-semibold shadow-xs'
                        : 'text-[#8C8C86] hover:text-white'
                    }`}
                  >
                    Video Loop (T2V)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCtaModality('image')}
                    className={`flex-1 py-1 text-[9px] sm:text-[10px] font-editorial-meta rounded-[2px] transition-colors ${
                      ctaModality === 'image'
                        ? 'bg-white text-black font-semibold shadow-xs'
                        : 'text-[#8C8C86] hover:text-white'
                    }`}
                  >
                    Freeze Frame (T2I)
                  </button>
                </div>
              </div>

              {/* Engagement Goal Selector */}
              <div className="space-y-1">
                <label className="font-editorial-meta text-[9px] uppercase tracking-wider text-[#9C9C96] block">
                  Action Focus
                </label>
                <div className="inline-flex w-full p-0.5 bg-[#181816] border border-white/10 rounded-[2px]">
                  <button
                    type="button"
                    onClick={() => setCtaEngagementType('question')}
                    className={`flex-1 py-1 text-[9px] sm:text-[10px] font-editorial-meta rounded-[2px] transition-colors ${
                      ctaEngagementType === 'question'
                        ? 'bg-white text-black font-semibold shadow-xs'
                        : 'text-[#8C8C86] hover:text-white'
                    }`}
                  >
                    Question
                  </button>
                  <button
                    type="button"
                    onClick={() => setCtaEngagementType('follow_subscribe')}
                    className={`flex-1 py-1 text-[9px] sm:text-[10px] font-editorial-meta rounded-[2px] transition-colors ${
                      ctaEngagementType === 'follow_subscribe'
                        ? 'bg-white text-black font-semibold shadow-xs'
                        : 'text-[#8C8C86] hover:text-white'
                    }`}
                  >
                    Follow
                  </button>
                  <button
                    type="button"
                    onClick={() => setCtaEngagementType('dilemma')}
                    className={`flex-1 py-1 text-[9px] sm:text-[10px] font-editorial-meta rounded-[2px] transition-colors ${
                      ctaEngagementType === 'dilemma'
                        ? 'bg-white text-black font-semibold shadow-xs'
                        : 'text-[#8C8C86] hover:text-white'
                    }`}
                  >
                    Dilemma
                  </button>
                </div>
              </div>

              {/* Typography vs Clean Plate Toggle */}
              <div className="space-y-1">
                <label className="font-editorial-meta text-[9px] uppercase tracking-wider text-[#9C9C96] block">
                  Overlay Type
                </label>
                <div className="inline-flex w-full p-0.5 bg-[#181816] border border-white/10 rounded-[2px]">
                  <button
                    type="button"
                    onClick={() => setCtaPromptMode('full')}
                    className={`flex-1 py-1 text-[9px] sm:text-[10px] font-editorial-meta rounded-[2px] transition-colors ${
                      ctaPromptMode === 'full'
                        ? 'bg-white text-black font-semibold shadow-xs'
                        : 'text-[#8C8C86] hover:text-white'
                    }`}
                  >
                    With Text Overlay
                  </button>
                  <button
                    type="button"
                    onClick={() => setCtaPromptMode('clean')}
                    className={`flex-1 py-1 text-[9px] sm:text-[10px] font-editorial-meta rounded-[2px] transition-colors ${
                      ctaPromptMode === 'clean'
                        ? 'bg-white text-black font-semibold shadow-xs'
                        : 'text-[#8C8C86] hover:text-white'
                    }`}
                    title="Clean background plate for CapCut, Premiere, or native editor text"
                  >
                    Clean Plate
                  </button>
                </div>
              </div>
            </div>

            {/* Question Formulation and Alternates Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
              <div className="bg-[#0A0A09] p-3 border border-white/10 rounded-[2px] space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="font-editorial-meta text-[8px] sm:text-[9px] text-amber-300 uppercase tracking-widest block">
                    Story-Adapted Intrigue Question
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingQuestion(!isEditingQuestion)}
                    className="text-[9px] font-editorial-meta text-[#9C9C96] hover:text-white underline cursor-pointer"
                  >
                    {isEditingQuestion ? 'Cancel Edit' : 'Edit Question'}
                  </button>
                </div>

                {isEditingQuestion ? (
                  <div className="space-y-2 pt-1">
                    <input
                      type="text"
                      value={customCtaQuestion || activeCta.questionText}
                      onChange={(e) => setCustomCtaQuestion(e.target.value)}
                      placeholder="Type custom closing question..."
                      className="w-full px-2.5 py-1.5 bg-[#161614] border border-white/20 rounded-[2px] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/50"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingQuestion(false)}
                        className="px-2 py-0.5 bg-white text-black text-[9px] font-editorial-meta font-medium rounded-[2px]"
                      >
                        Apply Question
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomCtaQuestion('');
                          setIsEditingQuestion(false);
                        }}
                        className="px-2 py-0.5 bg-[#181816] text-[#A0A09A] hover:text-white text-[9px] font-editorial-meta rounded-[2px] border border-white/10"
                      >
                        Reset to Story Default
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm sm:text-base font-display font-bold text-white tracking-wide">
                    &ldquo;{activeCta.questionText}&rdquo;
                  </div>
                )}

                {/* Alternates Quick Selection */}
                {activeCta.alternateQuestions && activeCta.alternateQuestions.length > 0 && (
                  <div className="pt-1.5 space-y-1">
                    <span className="font-editorial-meta text-[8px] text-[#8C8C86] uppercase tracking-wider block">
                      One-Click Narrative Alternates:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeCta.alternateQuestions.map((alt, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setCustomCtaQuestion(alt);
                            setIsEditingQuestion(false);
                          }}
                          className={`text-[9px] font-narrative px-2 py-1 border transition-colors rounded-[2px] text-left ${
                            customCtaQuestion === alt
                              ? 'bg-amber-950/60 border-amber-500/50 text-amber-200'
                              : 'bg-white/5 border-white/10 text-[#C4C4C0] hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          &ldquo;{alt}&rdquo;
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Safe Zone Clearance Summary */}
              <div className="bg-[#0A0A09] p-3 border border-white/10 rounded-[2px] space-y-2 md:col-span-1">
                <span className="font-editorial-meta text-[8px] sm:text-[9px] text-emerald-400 uppercase tracking-widest block">
                  Platform Safe Zone Clearance
                </span>
                <p className="text-[10px] sm:text-xs text-[#A8A8A2] font-editorial-meta leading-relaxed">
                  {ctaPlatform === 'tiktok'
                    ? 'Right 18% strictly clear for like, comment, bookmark, and share icon stack. Bottom 22% clear for caption marquee and sound disc. Center band (35%–65% height) safe.'
                    : ctaPlatform === 'youtube_shorts'
                    ? 'Bottom 20% strictly clear of text and faces for channel avatar and red Subscribe button. Right 15% clear of thumbs-up rail.'
                    : 'Universal 10% perimeter clearance across all borders. Balanced composition compatible with Instagram Reels, X video, web embeds, and horizontal players.'}
                </p>
                <div className="pt-1 border-t border-white/5 font-editorial-meta text-[9px] text-[#8C8C86]">
                  Action cue: {ctaEngagementType === 'question' ? 'Comments driver' : ctaEngagementType === 'follow_subscribe' ? 'Follow / Subscribe badge' : 'A/B dilemma poll'}
                </div>
              </div>
            </div>

            {/* Compiled Monospace CTA Prompt Block */}
            <div className="bg-[#0A0A09] p-3.5 sm:p-5 border border-white/10 rounded-[2px] space-y-2 relative group">
              <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-editorial-meta text-[#8C8C86]">
                <span>
                  {ctaPromptMode === 'full'
                    ? `Production CTA Outro Prompt (${ctaModality === 'video' ? 'T2V 3-Second Loop' : 'T2I Still Frame'})`
                    : `Clean Plate Outro Prompt (${ctaModality === 'video' ? 'T2V 3-Second Loop' : 'T2I Still Frame'} Text-Free)`}
                </span>
                <span className="font-mono text-white/50">{activeCta.aspectRatio}</span>
              </div>
              <p className="text-xs sm:text-sm text-[#F5F5F0] leading-relaxed font-mono whitespace-pre-wrap selection:bg-white selection:text-black">
                {ctaPromptMode === 'full' ? activeCta.compiledPrompt : activeCta.cleanPlatePrompt}
              </p>
            </div>
          </div>
        )}
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
              className="inline-flex items-center justify-center px-2 sm:px-3.5 py-1 sm:py-1.5 bg-white text-black hover:bg-neutral-200 active:bg-neutral-300 text-[9px] sm:text-[10px] font-editorial-meta font-semibold transition-colors whitespace-nowrap min-h-[28px] sm:min-h-[32px] rounded-[2px] shadow-sm"
              title="Copy the complete continuous voiceover script"
            >
              {copiedIndex === 'clean-script' ? (
                <>
                  <Check size={10} className="mr-1 text-black shrink-0 sm:w-3 sm:h-3" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={10} className="mr-1 text-black shrink-0 sm:w-3 sm:h-3" />
                  <span className="sm:hidden">Copy Script</span>
                  <span className="hidden sm:inline">Copy Clean Script</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-[#0A0A09] p-3.5 sm:p-6 border border-white/10 rounded-[2px]">
          <p className="text-xs sm:text-base text-[#F5F5F0] leading-relaxed font-narrative whitespace-pre-wrap selection:bg-white selection:text-black">
            {fullScript}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 font-editorial-meta text-[9px] sm:text-[10px] text-[#9C9C96] pt-0.5 sm:pt-1">
          <span>Total Words: {fullScript.trim().split(/\s+/).filter(Boolean).length} Words</span>
          <span>Estimated Pacing: ~{formatSecondsToMinutes(result.totalDurationSeconds)}</span>
        </div>
      </div>

      {/* Bottom Production Export Section with Compact Dropdown Menu */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 sm:p-5 bg-[#121211] border border-white/10 rounded-[2px]">
        <div className="text-center sm:text-left">
          <span className="text-xs sm:text-sm font-medium font-display tracking-tight text-white block">
            Production Export &amp; Shot Lists
          </span>
          <p className="text-[10px] sm:text-xs text-[#9C9C96] mt-0.5 font-narrative">
            Download your full breakdown in EDL, Subtitles, CSV, Markdown, or JSON formats.
          </p>
        </div>

        {/* Compact Export Dropdown */}
        <div className="relative" ref={exportMenuRef}>
          <button
            type="button"
            id="export-dropdown-btn"
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            className="inline-flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-3.5 py-1.5 sm:py-2 bg-[#1C1C1A] hover:bg-[#262624] text-white border border-white/20 text-[10px] sm:text-xs font-editorial-meta transition-colors min-h-[34px] sm:min-h-[38px] rounded-[2px]"
            aria-expanded={isExportMenuOpen}
            aria-haspopup="true"
          >
            <Download size={12} className="text-[#9C9C96] sm:w-3.5 sm:h-3.5" />
            <span>Export Storyboard</span>
            <ChevronDown size={12} className={`text-[#9C9C96] transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu Items */}
          {isExportMenuOpen && (
            <div className="absolute right-0 bottom-full mb-2 w-56 sm:w-60 bg-[#161614] border border-white/20 shadow-2xl py-1.5 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150 font-narrative">
              <button
                type="button"
                id="export-edl-opt"
                onClick={downloadEdlExport}
                className="w-full flex items-center space-x-2.5 sm:space-x-3 px-3 sm:px-3.5 py-2 sm:py-2.5 text-left text-xs sm:text-sm text-[#F5F5F0] hover:text-white hover:bg-[#222220] transition-colors"
              >
                <Film size={13} className="text-[#9C9C96] shrink-0 sm:w-3.5 sm:h-3.5" />
                <div>
                  <div className="font-medium font-display text-xs sm:text-sm">Timeline EDL (.edl)</div>
                  <div className="font-editorial-meta text-[9px] text-[#9C9C96]">CMX 3600 for Premiere &amp; DaVinci</div>
                </div>
              </button>

              <button
                type="button"
                id="export-srt-opt"
                onClick={downloadSrtExport}
                className="w-full flex items-center space-x-2.5 sm:space-x-3 px-3 sm:px-3.5 py-2 sm:py-2.5 text-left text-xs sm:text-sm text-[#F5F5F0] hover:text-white hover:bg-[#222220] transition-colors"
              >
                <Clock size={13} className="text-[#9C9C96] shrink-0 sm:w-3.5 sm:h-3.5" />
                <div>
                  <div className="font-medium font-display text-xs sm:text-sm">Subtitles (.srt)</div>
                  <div className="font-editorial-meta text-[9px] text-[#9C9C96]">Timed narrator dialogue track</div>
                </div>
              </button>

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
        styleProfile={result.styleProfile}
        format={format}
      />

      {/* Multi-Angle Character Reference Packet Modal */}
      <CharacterReferenceModal
        isOpen={isRefModalOpen}
        onClose={() => setIsRefModalOpen(false)}
        characterSheet={result.characterSheet || {}}
        styleProfile={result.styleProfile}
        format={format}
      />

      {/* 11-Episode Series Continuity Roadmap Modal */}
      <SeriesRoadmapModal
        isOpen={isRoadmapModalOpen}
        onClose={() => setIsRoadmapModalOpen(false)}
        seriesTitle={result.title || "Series Roadmap"}
        roadmap={result.seriesRoadmap}
        onSelectEpisodeForGeneration={handleSelectEpisodeForDraft}
        onSaveContinuity={handleManualSaveContinuity}
        isSaved={isContinuitySaved}
      />
    </div>
  );
}
