import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { StoryGenerationResult, StoryFormat, Beat, CtaPlatform, CtaModality, CtaEngagementType, Scene } from '../types';
import BeatBottomSheet from './BeatBottomSheet';
import CharacterReferenceModal from './CharacterReferenceModal';
import StyleAndCharactersSection from './StyleAndCharactersSection';
import SeriesRoadmapModal from './SeriesRoadmapModal';
import { getPreviewText } from '../services/beatSplitting';
import { normalizeStoryboardForDisplay } from '../services/beatProgressionEngine';
import { compileBeatPrompt, lintStoryboard, compileThumbnailPrompt, compileCtaPrompt } from '../services/promptCompiler';
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
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Camera,
  Video,
  Clock,
  ChevronsUpDown,
  Table,
  Clapperboard,
  Image as ImageIcon,
  Zap,
  AlertTriangle,
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

  useEffect(() => {
    if (result.seriesRoadmap && result.seriesRoadmap.length > 0) {
      syncStoryResultToContinuity(result, 1);
      setIsContinuitySaved(true);
    }
  }, [result]);

  const handleManualSaveContinuity = () => {
    const currentTitle = result.title || 'Untitled Series';
    syncStoryResultToContinuity(result, 1, currentTitle);
    setIsContinuitySaved(true);
  };

  const handleSelectEpisodeForDraft = (ep: { episodeNumber: number; title: string; description: string }) => {
    const currentTitle = result.title || 'Untitled Series';
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

  // Mobile bottom sheet beat breakdown state (< lg)
  const [mobileActiveBeat, setMobileActiveBeat] = useState<{
    sceneIndex: number;
    sceneRoman: string;
    beat: Beat;
    allBeats: Beat[];
  } | null>(null);

  // Normalize scenes for display
  const normalizedScenes = useMemo(() => {
    return normalizeStoryboardForDisplay(result.scenes || [], {
      isVideoMode: result.generationMode === 'video',
      isLongForm: format === 'long',
      targetVideoDuration: result.targetVideoDuration || 5,
      styleProfile: result.styleProfile,
      characterSheet: result.characterSheet,
      locationSheet: result.locationSheet,
    });
  }, [
    result.scenes,
    result.generationMode,
    result.targetVideoDuration,
    result.styleProfile,
    result.characterSheet,
    result.locationSheet,
    format,
  ]);

  // Desktop inline inspector selection
  const [desktopSelection, setDesktopSelection] = useState<{ sceneIndex: number; beatIndex: number }>(() => {
    const firstScene = normalizedScenes[0];
    const firstBeat = firstScene?.beats?.[0];
    return {
      sceneIndex: firstScene?.index ?? 1,
      beatIndex: firstBeat?.beatIndex ?? 1,
    };
  });

  useEffect(() => {
    const firstScene = normalizedScenes[0];
    const firstBeat = firstScene?.beats?.[0];
    if (firstScene && firstBeat) {
      setDesktopSelection({
        sceneIndex: firstScene.index,
        beatIndex: firstBeat.beatIndex,
      });
    }
  }, [result]);

  useMemo(() => {
    return lintStoryboard(normalizedScenes, result.characterSheet, result.styleProfile);
  }, [normalizedScenes, result.characterSheet, result.styleProfile]);

  const [expandedScenes, setExpandedScenes] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    result.scenes.forEach((s) => {
      initial[s.index] = true;
    });
    return initial;
  });

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isExportMenuOpen) setIsExportMenuOpen(false);
        if (isStyleModalOpen) setIsStyleModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExportMenuOpen, isStyleModalOpen]);

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
    setExpandedScenes((prev) => ({ ...prev, [sceneIndex]: true }));
    const element = document.getElementById(`scene-card-${sceneIndex}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleBeatClick = (sceneIndex: number, sceneRoman: string, beat: Beat, allBeats: Beat[]) => {
    setDesktopSelection({ sceneIndex, beatIndex: beat.beatIndex });
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileActiveBeat({ sceneIndex, sceneRoman, beat, allBeats });
    }
  };

  const fullScript = normalizedScenes.map((s) => s.narratorLine).join(' ');
  const totalBeatsCount = normalizedScenes.reduce((acc, s) => acc + (s.beats?.length || 0), 0);
  const characterEntries = Object.entries(result.characterSheet || {});
  const isVideoMode = result.generationMode === 'video';

  // Thumbnail & CTA states
  const [isThumbnailExpanded, setIsThumbnailExpanded] = useState<boolean>(false);
  const [thumbnailPromptMode, setThumbnailPromptMode] = useState<'full' | 'clean'>('full');
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

  const effectiveTotalDuration = useMemo(() => {
    const sum = Math.round(normalizedScenes.reduce((acc, s) => acc + (s.estimatedSeconds || 0), 0) * 10) / 10;
    return sum > 0 ? sum : result.totalDurationSeconds;
  }, [normalizedScenes, result.totalDurationSeconds]);

  let accumulatedSeconds = 0;
  const sceneTimelineRanges = normalizedScenes.map((scene) => {
    const startSec = accumulatedSeconds;
    const endSec = Math.round((startSec + scene.estimatedSeconds) * 10) / 10;
    accumulatedSeconds = endSec;
    return {
      sceneIndex: scene.index,
      estimatedSeconds: scene.estimatedSeconds,
      startSec,
      endSec,
    };
  });

  // Flat list of beats for Prev/Next stepping in desktop inspector
  const flatBeatRefs = useMemo(() => {
    const list: { scene: Scene; beat: Beat }[] = [];
    normalizedScenes.forEach((scene) => {
      (scene.beats || []).forEach((beat) => {
        list.push({ scene, beat });
      });
    });
    return list;
  }, [normalizedScenes]);

  const currentFlatIndex = flatBeatRefs.findIndex(
    (item) =>
      item.scene.index === desktopSelection.sceneIndex &&
      item.beat.beatIndex === desktopSelection.beatIndex
  );
  const activeInspectorPair =
    currentFlatIndex >= 0 ? flatBeatRefs[currentFlatIndex] : flatBeatRefs[0] || null;
  const prevFlatPair = currentFlatIndex > 0 ? flatBeatRefs[currentFlatIndex - 1] : null;
  const nextFlatPair =
    currentFlatIndex >= 0 && currentFlatIndex < flatBeatRefs.length - 1
      ? flatBeatRefs[currentFlatIndex + 1]
      : null;

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
    const headers = ['Scene', 'Roman Scene', 'Beat', 'Estimated Seconds', 'Shot Type', 'Camera Angle', 'Camera Movement', 'Spoken Narration', 'Visual Image Prompt'];
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
    md += `**Estimated Duration**: ~${formatSecondsToMinutes(effectiveTotalDuration)}\n`;
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
      const sceneBeatSum = (scene.beats || []).reduce((acc, b) => acc + (b.estimatedSeconds || 0), 0);
      const effectiveSec = sceneBeatSum > 0 ? Math.round(sceneBeatSum * 10) / 10 : scene.estimatedSeconds;
      md += `### SCENE ${toRomanNumeral(scene.index)} (~${effectiveSec}s)\n`;
      md += `**Narrator Line**:\n"${scene.narratorLine}"\n\n`;

      if (scene.videoPrompt) {
        md += `#### AI Video Generation Prompt (~${result.targetVideoDuration || 5}s Clip)\n\`\`\`text\n${scene.videoPrompt}\n\`\`\`\n\n`;
      }
      if (scene.startFramePrompt) {
        md += `#### Start Frame Keyframe Prompt (Image Ingredient)\n\`\`\`text\n${scene.startFramePrompt}\n\`\`\`\n\n`;
      }

      md += `| Beat | Duration | Shot Size | Angle | Movement | Spoken Words | Visual Image Prompt |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
      (scene.beats || []).forEach((b) => {
        let cleanPrompt = (b.imagePrompt || '').replace(/\|/g, '-');
        cleanPrompt = cleanPrompt.replace(/\s*--ar\s+[0-9:]+/gi, '').replace(/,\s*ar\s+[0-9:]+[.,]?/gi, '').replace(/\bar\s+[0-9:]+[.,]?/gi, '').trim();
        cleanPrompt = cleanPrompt.replace(/\s+([,.;!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
        if (cleanPrompt && !/[.!?]$/.test(cleanPrompt)) cleanPrompt += '.';
        const promptWithAr = cleanPrompt ? `${cleanPrompt} --ar ${format === 'long' ? '16:9' : '9:16'}` : '';
        md += `| Beat ${b.beatIndex} | ~${b.estimatedSeconds}s | ${b.shotType || 'Medium Shot'} | ${b.cameraAngle || 'Eye-level'} | ${b.cameraMovement || 'Static'} | "${b.textSpan.replace(/\|/g, '-')}" | ${promptWithAr} |\n`;
      });
      md += `\n`;
    });

    md += `## Production Cover & Hero Thumbnail\n\n`;
    md += `- **Aspect Ratio**: ${activeThumbnail.aspectRatio}\n`;
    md += `- **Curiosity Hook**: "${activeThumbnail.hookText}"\n`;
    md += `- **Typography Style**: ${activeThumbnail.fontStyle}\n\n`;
    md += `### Production Thumbnail Prompt (With Typography)\n\`\`\`text\n${activeThumbnail.compiledPrompt}\n\`\`\`\n\n`;
    md += `### Clean Plate Prompt (Background Only)\n\`\`\`text\n${activeThumbnail.cleanPlatePrompt}\n\`\`\`\n\n`;

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
    <div className="w-full space-y-5 font-narrative text-[#F5F5F0]">
      {/* Decluttered Top Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3 flex-wrap text-sm">
          <button
            type="button"
            id="back-to-edit-button"
            onClick={onBackToEdit}
            className="inline-flex items-center text-[#A0A09A] hover:text-white transition-colors py-1 font-display cursor-pointer"
          >
            <ArrowLeft size={14} className="mr-1.5 shrink-0" />
            Edit Story
          </button>
          <span className="text-white/20">/</span>
          <button
            type="button"
            id="start-new-button"
            onClick={onReset}
            className="inline-flex items-center text-[#A0A09A] hover:text-white transition-colors py-1 font-display cursor-pointer"
          >
            New Story
          </button>
          <span className="text-white/20 hidden sm:inline">/</span>
          <span className="text-xs font-mono text-[#9C9C96] tabular-nums">
            {normalizedScenes.length} Scenes · {totalBeatsCount} Beats · ~{formatSecondsToMinutes(effectiveTotalDuration)} · {platform}
            {isVideoMode ? ` · ${result.targetVideoDuration || 5}s Video Clips` : ' · Image Mode'}
          </span>
        </div>

        {/* Clean Action Controls (Max 1 Primary + Essential Tools) */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            id="batch-copy-prompts-btn"
            onClick={handleCopyAllPrompts}
            className="inline-flex items-center px-3.5 py-2 bg-white text-black hover:bg-[#EAEAE5] text-xs font-display font-semibold transition-colors rounded-[3px] shadow-sm cursor-pointer"
          >
            {copiedIndex === 'all-prompts' ? (
              <>
                <Check size={13} className="mr-1.5 text-black" />
                <span>Copied All Prompts</span>
              </>
            ) : (
              <>
                <Copy size={13} className="mr-1.5 text-black" />
                <span>Copy All Prompts</span>
              </>
            )}
          </button>

          {(result.styleProfile || characterEntries.length > 0) && (
            <button
              type="button"
              id="open-style-cast-btn"
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => setIsStyleModalOpen(true)}
              className="hidden"
            >
              <Layers size={13} className="mr-1.5 text-[#9C9C96]" />
              <span>Style &amp; Cast</span>
            </button>
          )}

          {result.seriesRoadmap && result.seriesRoadmap.length > 0 && (
            <button
              type="button"
              id="open-series-roadmap-header-btn"
              onClick={() => setIsRoadmapModalOpen(true)}
              className="inline-flex items-center px-3 py-2 bg-[#161614] hover:bg-[#20201e] text-[#D4D4D0] hover:text-white border border-white/15 text-xs font-display transition-colors rounded-[3px] cursor-pointer"
            >
              <Film size={13} className="mr-1.5 text-amber-400" />
              <span>Series Roadmap ({result.seriesRoadmap.length})</span>
            </button>
          )}

          <button
            type="button"
            id="toggle-all-scenes-btn"
            onClick={() => setAllScenesExpanded(!allExpanded)}
            className="inline-flex items-center px-3 py-2 bg-[#161614] hover:bg-[#20201e] text-[#A0A09A] hover:text-white border border-white/15 text-xs font-display transition-colors rounded-[3px] cursor-pointer"
          >
            <ChevronsUpDown size={13} className="mr-1.5 text-[#9C9C96]" />
            <span>{allExpanded ? 'Collapse Scenes' : 'Expand Scenes'}</span>
          </button>
        </div>
      </div>

      {/* Readable Scene & Section Jump Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {sceneTimelineRanges.map((range) => {
          const roman = toRomanNumeral(range.sceneIndex);
          return (
            <button
              key={range.sceneIndex}
              type="button"
              onClick={() => scrollToScene(range.sceneIndex)}
              className="px-3 py-1.5 bg-[#121211] hover:bg-[#1E1E1C] border border-white/15 hover:border-white/30 rounded-[3px] transition-colors text-xs font-mono text-[#C4C4BE] hover:text-white whitespace-nowrap shrink-0 tabular-nums cursor-pointer"
              title={`Jump to Scene ${roman} (${formatTimecode(range.startSec)} - ${formatTimecode(range.endSec)})`}
            >
              Scene {roman} (~{range.estimatedSeconds}s)
            </button>
          );
        })}
        <button
          type="button"
          id="jump-to-thumbnail-btn"
          onClick={() => {
            setIsThumbnailExpanded(true);
            const el = document.getElementById('thumbnail-cover-panel');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          className="px-3 py-1.5 bg-[#121211] hover:bg-[#1E1E1C] border border-white/15 hover:border-amber-400/50 rounded-[3px] transition-colors text-xs font-display text-[#C4C4BE] hover:text-white whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ImageIcon size={12} className="text-amber-400" />
          <span>Thumbnail</span>
        </button>
        <button
          type="button"
          id="jump-to-cta-btn"
          onClick={() => {
            setIsCtaExpanded(true);
            const el = document.getElementById('cta-outro-panel');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          className="px-3 py-1.5 bg-[#121211] hover:bg-[#1E1E1C] border border-white/15 hover:border-amber-400/50 rounded-[3px] transition-colors text-xs font-display text-[#C4C4BE] hover:text-white whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Zap size={12} className="text-amber-400" />
          <span>CTA Outro</span>
        </button>
      </div>

      {(result.assumptions || []).some((a) => a.startsWith('Script coverage notice:')) && (
        <div
          id="script-coverage-warning"
          role="alert"
          className="flex items-start gap-2.5 px-4 py-3 bg-amber-950/40 border border-amber-500/40 rounded-[3px] text-xs text-amber-200"
        >
          <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            {(result.assumptions || [])
              .filter((a) => a.startsWith('Script coverage notice:'))
              .map((msg, idx) => (
                <p key={idx}>{msg}</p>
              ))}
          </div>
        </div>
      )}

      {/* Main 2-Column Workspace on Desktop: Left Scenes (7/12) + Right Sticky Beat Inspector (5/12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (7/12 on lg, full width below lg): Storyboard Scenes + Thumbnail + CTA + Script */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-5" id="scene-cards-container">
            {normalizedScenes.map((scene) => {
              const isCopiedNarration = copiedIndex === `narration-${scene.index}`;
              const beats = scene.beats || [];
              const isExpanded = expandedScenes[scene.index] ?? true;
              const romanScene = toRomanNumeral(scene.index);
              const scenePacing = calculatePacing(scene.narratorLine, scene.estimatedSeconds);

              return (
                <div
                  key={scene.index}
                  id={`scene-card-${scene.index}`}
                  className="bg-[#121211] border border-white/15 rounded-[3px] overflow-hidden"
                >
                  {/* Scene Header */}
                  <div
                    onClick={() => toggleSceneExpand(scene.index)}
                    className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 bg-[#161614] hover:bg-[#1b1b19] cursor-pointer transition-colors border-b border-white/10 select-none gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                      <Film size={15} className="text-white shrink-0" />
                      <span className="font-display text-sm sm:text-base font-medium text-white">
                        Scene {romanScene}
                      </span>
                      <span className="stamp-chip text-[10px]">
                        {beats.length} {beats.length === 1 ? 'Beat' : 'Beats'}
                      </span>
                      <span className="font-mono text-xs text-[#9C9C96] tabular-nums">
                        ~{scene.estimatedSeconds}s
                      </span>
                      <span
                        className={`stamp-chip text-[9px] hidden sm:inline-flex ${
                          scenePacing.status === 'rushed'
                            ? 'bg-amber-950/70 text-amber-300 border-amber-700/80 font-semibold'
                            : 'text-[#8C8C86]'
                        }`}
                        title={`Speaking rate: ~${scenePacing.wordsPerMinute} WPM (ideal is ~140 WPM)`}
                      >
                        {scenePacing.status === 'rushed'
                          ? `Pacing: Rushed (~${scenePacing.wordsPerMinute} WPM)`
                          : `~${scenePacing.wordsPerMinute} WPM`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(scene.narratorLine, `narration-${scene.index}`);
                        }}
                        className="inline-flex items-center font-display text-xs px-2.5 py-1 text-[#D4D4D0] hover:text-white bg-[#1f1f1d] hover:bg-[#2a2a27] border border-white/15 rounded-[3px] transition-colors whitespace-nowrap cursor-pointer"
                        title="Copy full scene narrator line"
                      >
                        {isCopiedNarration ? (
                          <>
                            <Check size={11} className="mr-1 text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} className="mr-1" />
                            <span>Copy Line</span>
                          </>
                        )}
                      </button>

                      <div className="p-1 text-[#9C9C96] hover:text-white">
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </div>
                    </div>
                  </div>

                  {/* Scene Content */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 space-y-5">
                      {/* Scene Narrator Line */}
                      <div className="space-y-1.5">
                        <span className="font-editorial-meta text-[10px] text-[#8C8C86] block">
                          SPOKEN NARRATION
                        </span>
                        <div className="bg-[#0C0C0B] px-4 py-3.5 border-l-2 border-white/40 border-y border-r border-white/10 rounded-r-[3px]">
                          <p className="text-sm sm:text-base leading-relaxed text-[#F5F5F0] font-narrative italic selection:bg-white selection:text-black">
                            &ldquo;{scene.narratorLine}&rdquo;
                          </p>
                        </div>
                      </div>

                      {/* Beats Section */}
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between border-t border-white/10 pt-3">
                          <div className="flex items-center gap-2">
                            {isVideoMode ? (
                              <>
                                <Clapperboard size={13} className="text-amber-400" />
                                <span className="font-editorial-meta text-[10px] text-amber-300 font-medium">
                                  CINEMATOGRAPHY &amp; VIDEO BEATS
                                </span>
                              </>
                            ) : (
                              <>
                                <ImageIcon size={13} className="text-[#C4C4BE]" />
                                <span className="font-editorial-meta text-[10px] text-[#C4C4BE] font-medium">
                                  CINEMATOGRAPHY &amp; VISUAL BEATS
                                </span>
                              </>
                            )}
                          </div>
                          {isVideoMode ? (
                            <span className="stamp-chip bg-amber-950/70 text-amber-300 border-amber-700/80 text-[9px]">
                              {beats.length} SHOTS (~{result.targetVideoDuration || scene.estimatedSeconds || 5}S CLIP)
                            </span>
                          ) : (
                            <span className="stamp-chip text-[9px]">
                              {beats.length} VISUAL SETUPS
                            </span>
                          )}
                        </div>

                        {/* Beat Cards Grid (Touch-friendly filmstrip on xs, grid on sm+) */}
                        <div className="flex sm:grid sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0 snap-x snap-mandatory sm:snap-none">
                          {beats.map((beat) => {
                            const isSelectedDesktop =
                              activeInspectorPair?.scene.index === scene.index &&
                              activeInspectorPair?.beat.beatIndex === beat.beatIndex;

                            return (
                              <div
                                key={beat.beatIndex}
                                id={`desktop-beat-chip-${scene.index}-${beat.beatIndex}`}
                                onClick={() => handleBeatClick(scene.index, romanScene, beat, beats)}
                                className={`flex-none w-[200px] sm:w-auto snap-start border p-3.5 flex flex-col justify-between min-h-[116px] cursor-pointer transition-colors group select-none rounded-[3px] ${
                                  isSelectedDesktop
                                    ? isVideoMode
                                      ? 'bg-[#1B1810] border-amber-400 lg:ring-1 lg:ring-amber-400/50'
                                      : 'bg-[#1A1A18] border-white lg:ring-1 lg:ring-white/40'
                                    : 'bg-[#151513] border-white/10 hover:border-white/30 hover:bg-[#191917]'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1.5 border-b border-white/10 pb-2">
                                  <span
                                    className={`stamp-chip font-bold text-[10px] ${
                                      isVideoMode
                                        ? 'bg-amber-950/70 text-amber-300 border-amber-700/80'
                                        : 'bg-white/10 text-white border-white/25'
                                    }`}
                                  >
                                    Beat {String(beat.beatIndex).padStart(2, '0')}
                                  </span>
                                  <span className="font-mono text-xs text-emerald-400/90 tabular-nums">
                                    ~{beat.estimatedSeconds}s
                                  </span>
                                </div>

                                <div className="my-2 space-y-1">
                                  <div className="flex items-center gap-1.5 text-xs font-display text-[#E6E6E1]">
                                    <Camera size={11} className="text-[#9C9C96] shrink-0" />
                                    <span className="truncate">{beat.shotType || 'Medium Shot'}</span>
                                  </div>
                                  {beat.cameraAngle && (
                                    <div className="flex items-center gap-1.5 text-[11px] font-narrative text-[#9C9C96]">
                                      <Video size={10} className="text-[#7D7D76] shrink-0" />
                                      <span className="truncate">{beat.cameraAngle}</span>
                                    </div>
                                  )}
                                </div>

                                <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-1.5">
                                  <p className="text-xs text-[#E6E6E1] italic font-narrative truncate">
                                    &ldquo;{getPreviewText(beat.textSpan, 7)}&rdquo;
                                  </p>
                                  <ChevronRight size={13} className="text-[#7D7D76] group-hover:text-white transition-colors shrink-0" />
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

          {/* Production Cover & Thumbnail Blueprint */}
          <div
            id="thumbnail-cover-panel"
            className="bg-[#121211] border border-white/15 rounded-[3px] overflow-hidden"
          >
            <div
              onClick={() => setIsThumbnailExpanded(!isThumbnailExpanded)}
              className="w-full flex items-center justify-between p-4 sm:p-5 bg-[#161614] hover:bg-[#1a1a18] cursor-pointer transition-colors border-b border-white/10 select-none flex-wrap gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="stamp-chip bg-amber-950/70 text-amber-300 border-amber-700/80 text-[9px] font-bold">
                    COVER &amp; THUMBNAIL BLUEPRINT
                  </span>
                  <span className="font-mono text-xs text-[#9C9C96]">
                    {activeThumbnail.aspectRatio} · {activeThumbnail.targetPlatform}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-medium font-display text-white">
                  Production Cover &amp; Hero Thumbnail
                </h3>
                {!isThumbnailExpanded && (
                  <p className="text-xs font-mono text-amber-300/90 mt-1 truncate">
                    Hook: &ldquo;{activeThumbnail.hookText}&rdquo;
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
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
                  className="inline-flex items-center justify-center px-3 py-1.5 bg-white text-black hover:bg-[#EAEAE5] text-xs font-display font-semibold transition-colors rounded-[3px] cursor-pointer"
                >
                  {copiedIndex === `thumbnail-${thumbnailPromptMode}` ? (
                    <>
                      <Check size={12} className="mr-1.5 text-black" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} className="mr-1.5 text-black" />
                      <span>Copy Prompt</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  id="toggle-thumbnail-panel-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsThumbnailExpanded(!isThumbnailExpanded);
                  }}
                  className="inline-flex items-center px-2.5 py-1.5 bg-[#1f1f1d] hover:bg-[#2a2a27] text-[#D4D4D0] hover:text-white border border-white/15 text-xs font-display transition-colors rounded-[3px] cursor-pointer"
                  aria-expanded={isThumbnailExpanded}
                >
                  {isThumbnailExpanded ? (
                    <>
                      <ChevronUp size={13} className="mr-1" />
                      <span>Collapse</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown size={13} className="mr-1" />
                      <span>Expand</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {isThumbnailExpanded && (
              <div className="p-4 sm:p-5 space-y-4 bg-[#121211]">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-display text-xs text-[#9C9C96]">
                    Thumbnail Rendering Mode
                  </span>
                  <div className="inline-flex p-0.5 bg-[#0C0C0B] border border-white/15 rounded-[3px]">
                    <button
                      type="button"
                      id="thumbnail-with-type-toggle"
                      onClick={() => setThumbnailPromptMode('full')}
                      className={`px-3 py-1 text-xs font-display rounded-[2px] transition-colors cursor-pointer ${
                        thumbnailPromptMode === 'full'
                          ? 'bg-white text-black font-semibold'
                          : 'text-[#8C8C86] hover:text-white'
                      }`}
                    >
                      With Typography
                    </button>
                    <button
                      type="button"
                      id="thumbnail-clean-plate-toggle"
                      onClick={() => setThumbnailPromptMode('clean')}
                      className={`px-3 py-1 text-xs font-display rounded-[2px] transition-colors cursor-pointer ${
                        thumbnailPromptMode === 'clean'
                          ? 'bg-white text-black font-semibold'
                          : 'text-[#8C8C86] hover:text-white'
                      }`}
                    >
                      Clean Plate
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-[#0C0C0B] p-3.5 border border-white/10 rounded-[3px] space-y-1.5">
                    <span className="font-editorial-meta text-[9px] text-amber-300 uppercase tracking-widest block">
                      Curiosity Hook Text
                    </span>
                    <div className="text-sm font-display font-bold text-white">
                      &ldquo;{activeThumbnail.hookText}&rdquo;
                    </div>
                  </div>
                  <div className="bg-[#0C0C0B] p-3.5 border border-white/10 rounded-[3px] space-y-1.5">
                    <span className="font-editorial-meta text-[9px] text-[#9C9C96] uppercase tracking-widest block">
                      Typography Style
                    </span>
                    <p className="text-xs text-[#E8E8E2] leading-relaxed capitalize">
                      {activeThumbnail.fontStyle}
                    </p>
                  </div>
                  <div className="bg-[#0C0C0B] p-3.5 border border-white/10 rounded-[3px] space-y-1.5">
                    <span className="font-editorial-meta text-[9px] text-emerald-400 uppercase tracking-widest block">
                      Safe Zone Clearance
                    </span>
                    <p className="text-xs text-[#A8A8A2] leading-relaxed">
                      {activeThumbnail.aspectRatio === '16:9'
                        ? 'Bottom-right 15% kept clear for duration badge.'
                        : 'Top 12% and bottom 25% kept clear for overlay UI.'}
                    </p>
                  </div>
                </div>

                <div className="bg-[#0C0C0B] p-4 border border-white/10 rounded-[3px] space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-[#8C8C86]">
                    <span>
                      {thumbnailPromptMode === 'full'
                        ? 'Production Prompt with Typography'
                        : 'Clean Plate Prompt (Text-Free)'}
                    </span>
                    <span>{activeThumbnail.aspectRatio}</span>
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

          {/* Story-Adaptive Call-to-Action Outro */}
          <div
            id="cta-outro-panel"
            className="bg-[#121211] border border-white/15 rounded-[3px] overflow-hidden"
          >
            <div
              onClick={() => setIsCtaExpanded(!isCtaExpanded)}
              className="w-full flex items-center justify-between p-4 sm:p-5 bg-[#161614] hover:bg-[#1a1a18] cursor-pointer transition-colors border-b border-white/10 select-none flex-wrap gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="stamp-chip bg-amber-950/70 text-amber-300 border-amber-700/80 text-[9px] font-bold">
                    CALL-TO-ACTION OUTRO
                  </span>
                  <span className="font-mono text-xs text-[#9C9C96]">
                    {ctaPlatform === 'tiktok'
                      ? 'TikTok 9:16'
                      : ctaPlatform === 'youtube_shorts'
                        ? 'YouTube Shorts 9:16'
                        : 'General'} · {ctaModality === 'video' ? 'Video Loop' : 'Still Frame'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-medium font-display text-white">
                  Story-Adaptive Call-to-Action Outro
                </h3>
                {!isCtaExpanded && (
                  <p className="text-xs font-mono text-emerald-300/90 mt-1 truncate">
                    &ldquo;{activeCta.questionText}&rdquo;
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
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
                  className="inline-flex items-center justify-center px-3 py-1.5 bg-white text-black hover:bg-[#EAEAE5] text-xs font-display font-semibold transition-colors rounded-[3px] cursor-pointer"
                >
                  {copiedIndex === `cta-${ctaPromptMode}` ? (
                    <>
                      <Check size={12} className="mr-1.5 text-black" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} className="mr-1.5 text-black" />
                      <span>Copy CTA</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  id="toggle-cta-panel-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCtaExpanded(!isCtaExpanded);
                  }}
                  className="inline-flex items-center px-2.5 py-1.5 bg-[#1f1f1d] hover:bg-[#2a2a27] text-[#D4D4D0] hover:text-white border border-white/15 text-xs font-display transition-colors rounded-[3px] cursor-pointer"
                  aria-expanded={isCtaExpanded}
                >
                  {isCtaExpanded ? (
                    <>
                      <ChevronUp size={13} className="mr-1" />
                      <span>Collapse</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown size={13} className="mr-1" />
                      <span>Expand</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {isCtaExpanded && (
              <div className="p-4 sm:p-5 space-y-4 bg-[#121211]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-[#0C0C0B] border border-white/10 rounded-[3px]">
                  <div className="space-y-1.5">
                    <label className="font-display text-xs text-[#9C9C96] block">
                      Platform Target
                    </label>
                    <div className="inline-flex w-full p-0.5 bg-[#161614] border border-white/10 rounded-[3px]">
                      <button
                        type="button"
                        onClick={() => setCtaPlatform('tiktok')}
                        className={`flex-1 py-1.5 text-xs font-display rounded-[2px] transition-colors cursor-pointer ${
                          ctaPlatform === 'tiktok' ? 'bg-white text-black font-semibold' : 'text-[#8C8C86] hover:text-white'
                        }`}
                      >
                        TikTok
                      </button>
                      <button
                        type="button"
                        onClick={() => setCtaPlatform('youtube_shorts')}
                        className={`flex-1 py-1.5 text-xs font-display rounded-[2px] transition-colors cursor-pointer ${
                          ctaPlatform === 'youtube_shorts' ? 'bg-white text-black font-semibold' : 'text-[#8C8C86] hover:text-white'
                        }`}
                      >
                        Shorts
                      </button>
                      <button
                        type="button"
                        onClick={() => setCtaPlatform('general')}
                        className={`flex-1 py-1.5 text-xs font-display rounded-[2px] transition-colors cursor-pointer ${
                          ctaPlatform === 'general' ? 'bg-white text-black font-semibold' : 'text-[#8C8C86] hover:text-white'
                        }`}
                      >
                        General
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-display text-xs text-[#9C9C96] block">
                      Outro Modality
                    </label>
                    <div className="inline-flex w-full p-0.5 bg-[#161614] border border-white/10 rounded-[3px]">
                      <button
                        type="button"
                        onClick={() => setCtaModality('video')}
                        className={`flex-1 py-1.5 text-xs font-display rounded-[2px] transition-colors cursor-pointer ${
                          ctaModality === 'video' ? 'bg-white text-black font-semibold' : 'text-[#8C8C86] hover:text-white'
                        }`}
                      >
                        Video Loop
                      </button>
                      <button
                        type="button"
                        onClick={() => setCtaModality('image')}
                        className={`flex-1 py-1.5 text-xs font-display rounded-[2px] transition-colors cursor-pointer ${
                          ctaModality === 'image' ? 'bg-white text-black font-semibold' : 'text-[#8C8C86] hover:text-white'
                        }`}
                      >
                        Freeze Frame
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-display text-xs text-[#9C9C96] block">
                      Action Focus
                    </label>
                    <div className="inline-flex w-full p-0.5 bg-[#161614] border border-white/10 rounded-[3px]">
                      <button
                        type="button"
                        onClick={() => setCtaEngagementType('question')}
                        className={`flex-1 py-1.5 text-xs font-display rounded-[2px] transition-colors cursor-pointer ${
                          ctaEngagementType === 'question' ? 'bg-white text-black font-semibold' : 'text-[#8C8C86] hover:text-white'
                        }`}
                      >
                        Question
                      </button>
                      <button
                        type="button"
                        onClick={() => setCtaEngagementType('follow_subscribe')}
                        className={`flex-1 py-1.5 text-xs font-display rounded-[2px] transition-colors cursor-pointer ${
                          ctaEngagementType === 'follow_subscribe' ? 'bg-white text-black font-semibold' : 'text-[#8C8C86] hover:text-white'
                        }`}
                      >
                        Follow
                      </button>
                      <button
                        type="button"
                        onClick={() => setCtaEngagementType('dilemma')}
                        className={`flex-1 py-1.5 text-xs font-display rounded-[2px] transition-colors cursor-pointer ${
                          ctaEngagementType === 'dilemma' ? 'bg-white text-black font-semibold' : 'text-[#8C8C86] hover:text-white'
                        }`}
                      >
                        Dilemma
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-display text-xs text-[#9C9C96] block">
                      Overlay Type
                    </label>
                    <div className="inline-flex w-full p-0.5 bg-[#161614] border border-white/10 rounded-[3px]">
                      <button
                        type="button"
                        onClick={() => setCtaPromptMode('full')}
                        className={`flex-1 py-1.5 text-xs font-display rounded-[2px] transition-colors cursor-pointer ${
                          ctaPromptMode === 'full' ? 'bg-white text-black font-semibold' : 'text-[#8C8C86] hover:text-white'
                        }`}
                      >
                        With Overlay
                      </button>
                      <button
                        type="button"
                        onClick={() => setCtaPromptMode('clean')}
                        className={`flex-1 py-1.5 text-xs font-display rounded-[2px] transition-colors cursor-pointer ${
                          ctaPromptMode === 'clean' ? 'bg-white text-black font-semibold' : 'text-[#8C8C86] hover:text-white'
                        }`}
                      >
                        Clean Plate
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-[#0C0C0B] p-3.5 border border-white/10 rounded-[3px] space-y-2 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <span className="font-editorial-meta text-[9px] text-amber-300 uppercase tracking-widest">
                        Story-Adapted Question
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsEditingQuestion(!isEditingQuestion)}
                        className="text-xs font-display text-[#9C9C96] hover:text-white underline cursor-pointer"
                      >
                        {isEditingQuestion ? 'Cancel Edit' : 'Edit Question'}
                      </button>
                    </div>

                    {isEditingQuestion ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={customCtaQuestion || activeCta.questionText}
                          onChange={(e) => setCustomCtaQuestion(e.target.value)}
                          placeholder="Type custom closing question..."
                          className="w-full px-3 py-2 bg-[#161614] border border-white/20 rounded-[3px] text-xs text-white focus:outline-none focus:border-white/50"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingQuestion(false)}
                            className="px-3 py-1 bg-white text-black text-xs font-display font-medium rounded-[3px] cursor-pointer"
                          >
                            Apply
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomCtaQuestion('');
                              setIsEditingQuestion(false);
                            }}
                            className="px-3 py-1 bg-[#181816] text-[#A0A09A] hover:text-white text-xs font-display rounded-[3px] border border-white/10 cursor-pointer"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm font-display font-bold text-white">
                        &ldquo;{activeCta.questionText}&rdquo;
                      </div>
                    )}

                    {activeCta.alternateQuestions && activeCta.alternateQuestions.length > 0 && (
                      <div className="pt-1 flex flex-wrap gap-1.5">
                        {activeCta.alternateQuestions.map((alt, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setCustomCtaQuestion(alt);
                              setIsEditingQuestion(false);
                            }}
                            className={`text-xs font-narrative px-2.5 py-1 border rounded-[3px] transition-colors text-left cursor-pointer ${
                              customCtaQuestion === alt
                                ? 'bg-amber-950/60 border-amber-500/50 text-amber-200'
                                : 'bg-white/5 border-white/10 text-[#C4C4C0] hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            &ldquo;{alt}&rdquo;
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-[#0C0C0B] p-3.5 border border-white/10 rounded-[3px] space-y-1.5">
                    <span className="font-editorial-meta text-[9px] text-emerald-400 uppercase tracking-widest block">
                      Platform Safe Zone
                    </span>
                    <p className="text-xs text-[#A8A8A2] leading-relaxed">
                      {ctaPlatform === 'tiktok'
                        ? 'Right 18% clear for reaction stack. Bottom 22% clear for captions. Center band (35%-65% height) safe.'
                        : ctaPlatform === 'youtube_shorts'
                          ? 'Bottom 20% clear for avatar and Subscribe button. Right 15% clear for action rail.'
                          : 'Universal 10% perimeter clearance across all borders for cross-platform players.'}
                    </p>
                  </div>
                </div>

                <div className="bg-[#0C0C0B] p-4 border border-white/10 rounded-[3px] space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-[#8C8C86]">
                    <span>
                      {ctaPromptMode === 'full'
                        ? `Production CTA Outro Prompt (${ctaModality === 'video' ? 'T2V 3s Loop' : 'T2I Frame'})`
                        : `Clean Plate Outro Prompt (${ctaModality === 'video' ? 'T2V 3s Loop' : 'T2I Frame'})`}
                    </span>
                    <span>{activeCta.aspectRatio}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#F5F5F0] leading-relaxed font-mono whitespace-pre-wrap selection:bg-white selection:text-black">
                    {ctaPromptMode === 'full' ? activeCta.compiledPrompt : activeCta.cleanPlatePrompt}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Complete Narrator Script Panel */}
          <div
            id="full-script-panel"
            className="bg-[#121211] border border-white/15 rounded-[3px] p-4 sm:p-5 space-y-3.5"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-medium font-display text-white">
                  Complete Narrator Script
                </h3>
                <p className="text-xs text-[#9C9C96] mt-0.5">
                  Continuous voiceover script for audio recording and timing.
                </p>
              </div>
              <button
                type="button"
                id="copy-clean-script-btn"
                onClick={handleCopyCleanScript}
                className="inline-flex items-center px-3 py-1.5 bg-white text-black hover:bg-[#EAEAE5] text-xs font-display font-semibold transition-colors rounded-[3px] shrink-0 cursor-pointer"
              >
                {copiedIndex === 'clean-script' ? (
                  <>
                    <Check size={12} className="mr-1.5 text-black" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} className="mr-1.5 text-black" />
                    <span>Copy Script</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-[#0C0C0B] p-4 border border-white/10 rounded-[3px]">
              <p className="text-sm sm:text-base text-[#F5F5F0] leading-relaxed font-narrative whitespace-pre-wrap selection:bg-white selection:text-black">
                {fullScript}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-[#8C8C86] tabular-nums">
              <span>{fullScript.trim().split(/\s+/).filter(Boolean).length} Words</span>
              <span>Estimated Pacing: ~{formatSecondsToMinutes(result.totalDurationSeconds)}</span>
            </div>
          </div>

          {/* Bottom Export Strip */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 sm:p-5 bg-[#121211] border border-white/15 rounded-[3px]">
            <div className="text-center sm:text-left">
              <span className="text-sm font-medium font-display text-white block">
                Production Export &amp; Shot Lists
              </span>
              <p className="text-xs text-[#9C9C96] mt-0.5">
                Download EDL timeline, SRT subtitles, CSV shot list, Markdown, or JSON.
              </p>
            </div>

            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                id="export-dropdown-btn"
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1C1C1A] hover:bg-[#262624] text-white border border-white/20 text-xs font-display font-medium transition-colors rounded-[3px] cursor-pointer"
                aria-expanded={isExportMenuOpen}
                aria-haspopup="true"
              >
                <Download size={14} className="text-[#9C9C96]" />
                <span>Export Storyboard</span>
                <ChevronDown
                  size={13}
                  className={`text-[#9C9C96] transition-transform duration-150 ${isExportMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isExportMenuOpen && (
                <div className="absolute right-0 bottom-full mb-2 w-60 bg-[#161614] border border-white/20 rounded-[3px] shadow-2xl py-1.5 z-30 font-narrative">
                  <button
                    type="button"
                    id="export-edl-opt"
                    onClick={downloadEdlExport}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-xs text-[#F5F5F0] hover:bg-[#222220] transition-colors cursor-pointer"
                  >
                    <Film size={14} className="text-[#9C9C96] shrink-0" />
                    <div>
                      <div className="font-medium font-display text-sm">Timeline EDL (.edl)</div>
                      <div className="text-[11px] text-[#8C8C86]">Premiere Pro &amp; DaVinci Resolve</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    id="export-srt-opt"
                    onClick={downloadSrtExport}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-xs text-[#F5F5F0] hover:bg-[#222220] transition-colors cursor-pointer"
                  >
                    <Clock size={14} className="text-[#9C9C96] shrink-0" />
                    <div>
                      <div className="font-medium font-display text-sm">Subtitles (.srt)</div>
                      <div className="text-[11px] text-[#8C8C86]">Timed narrator dialogue</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    id="export-csv-opt"
                    onClick={downloadCsvExport}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-xs text-[#F5F5F0] hover:bg-[#222220] transition-colors cursor-pointer"
                  >
                    <Table size={14} className="text-[#9C9C96] shrink-0" />
                    <div>
                      <div className="font-medium font-display text-sm">Shot List (.csv)</div>
                      <div className="text-[11px] text-[#8C8C86]">Spreadsheet production table</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    id="export-md-opt"
                    onClick={downloadMarkdownExport}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-xs text-[#F5F5F0] hover:bg-[#222220] transition-colors cursor-pointer"
                  >
                    <FileText size={14} className="text-[#9C9C96] shrink-0" />
                    <div>
                      <div className="font-medium font-display text-sm">Production Doc (.md)</div>
                      <div className="text-[11px] text-[#8C8C86]">Formatted Markdown storyboard</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    id="export-json-opt"
                    onClick={downloadJsonExport}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-xs text-[#F5F5F0] hover:bg-[#222220] transition-colors cursor-pointer"
                  >
                    <FileCode size={14} className="text-[#9C9C96] shrink-0" />
                    <div>
                      <div className="font-medium font-display text-sm">Structured Data (.json)</div>
                      <div className="text-[11px] text-[#8C8C86]">Full machine-readable JSON</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (5/12 on lg+): Sticky Beat Inspector Panel */}
        <aside className="hidden lg:block lg:col-span-5 lg:sticky lg:top-20">
          {activeInspectorPair ? (
            (() => {
              const inspScene = activeInspectorPair.scene;
              const inspBeat = activeInspectorPair.beat;
              const inspRoman = toRomanNumeral(inspScene.index);
              const beatKey = `scene-${inspScene.index}-beat-${inspBeat.beatIndex}`;
              const isCopiedPrompt = copiedIndex === `prompt-${beatKey}`;
              const isCopiedText = copiedIndex === `text-${beatKey}`;
              const compiled = compileBeatPrompt(
                inspBeat,
                inspScene,
                result.styleProfile,
                'universal',
                format,
                result.generationMode
              );

              return (
                <div
                  id="desktop-beat-inspector"
                  className="bg-[#121211] border border-white/15 rounded-[3px] overflow-hidden shadow-xl"
                >
                  {/* Inspector Header */}
                  <div className="px-5 py-3.5 bg-[#161614] border-b border-white/10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`stamp-chip font-bold text-[10px] ${
                          isVideoMode
                            ? 'bg-amber-950/70 text-amber-300 border-amber-700/80'
                            : 'bg-white/10 text-white border-white/25'
                        }`}
                      >
                        BEAT {String(inspBeat.beatIndex).padStart(2, '0')}
                      </span>
                      <span className="font-display text-sm font-medium text-white truncate">
                        Scene {inspRoman}
                      </span>
                      <span className="font-mono text-xs text-[#8C8C86] tabular-nums">
                        ({currentFlatIndex + 1} / {flatBeatRefs.length})
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={!prevFlatPair}
                        onClick={() =>
                          prevFlatPair &&
                          setDesktopSelection({
                            sceneIndex: prevFlatPair.scene.index,
                            beatIndex: prevFlatPair.beat.beatIndex,
                          })
                        }
                        className="p-1.5 bg-[#1E1E1C] hover:bg-[#282825] border border-white/15 rounded-[3px] text-[#C4C4BE] hover:text-white disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                        title="Previous Beat"
                        aria-label="Previous beat"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={!nextFlatPair}
                        onClick={() =>
                          nextFlatPair &&
                          setDesktopSelection({
                            sceneIndex: nextFlatPair.scene.index,
                            beatIndex: nextFlatPair.beat.beatIndex,
                          })
                        }
                        className="p-1.5 bg-[#1E1E1C] hover:bg-[#282825] border border-white/15 rounded-[3px] text-[#C4C4BE] hover:text-white disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                        title="Next Beat"
                        aria-label="Next beat"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Camera Metadata Strip */}
                  <div className="px-5 py-2.5 bg-[#0E0E0D] border-b border-white/10 flex items-center gap-2 flex-wrap">
                    {inspBeat.shotType && (
                      <span className="stamp-chip text-[10px]">
                        <Camera size={10} className="mr-1 text-[#9C9C96]" />
                        {inspBeat.shotType}
                      </span>
                    )}
                    {inspBeat.cameraAngle && (
                      <span className="stamp-chip text-[10px]">{inspBeat.cameraAngle}</span>
                    )}
                    {inspBeat.cameraMovement && (
                      <span className="stamp-chip text-[10px]">{inspBeat.cameraMovement}</span>
                    )}
                    <span className="font-mono text-xs text-emerald-400/90 ml-auto tabular-nums">
                      ~{inspBeat.estimatedSeconds}s
                    </span>
                  </div>

                  {/* Inspector Body */}
                  <div className="p-5 space-y-4 max-h-[calc(100vh-14rem)] overflow-y-auto">
                    {/* Spoken Phrase */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-xs text-[#9C9C96] font-medium">
                          Spoken Phrase
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(inspBeat.textSpan, `text-${beatKey}`)}
                          className="font-display text-xs text-[#9C9C96] hover:text-white inline-flex items-center gap-1 cursor-pointer"
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
                      <div className="p-3 bg-[#0C0C0B] border border-white/10 rounded-[3px] text-sm text-[#F5F5F0] italic leading-relaxed">
                        {inspBeat.textSpan && inspBeat.textSpan.trim().length > 0 ? (
                          <>&ldquo;{inspBeat.textSpan}&rdquo;</>
                        ) : (
                          <span className="not-italic font-mono text-xs text-amber-400">
                            [Silent Reaction / Action Beat]
                          </span>
                        )}
                      </div>
                    </div>

                    {inspBeat.visualSoundEffect && (
                      <div className="p-3 bg-[#171510] border border-amber-700/40 rounded-[3px] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Zap size={14} className="text-amber-400 shrink-0" />
                          <div>
                            <span className="font-editorial-meta text-[9px] text-amber-300 block">
                              VISUAL SOUND EFFECT
                            </span>
                            <span className="text-xs font-bold text-amber-100">
                              {inspBeat.visualSoundEffect}
                            </span>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono text-amber-300/80">On-frame text</span>
                      </div>
                    )}

                    {inspBeat.overlayText && (
                      <div className="p-3 bg-[#15140F] border border-amber-700/40 rounded-[3px] flex items-center justify-between gap-2">
                        <span className="font-editorial-meta text-[9px] text-amber-300">
                          EDITOR OVERLAY TEXT
                        </span>
                        <span className="text-xs font-mono text-white">{inspBeat.overlayText}</span>
                      </div>
                    )}

                    {/* Beat Prompt */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-xs font-medium text-white flex items-center gap-1.5">
                          {isVideoMode ? (
                            <>
                              <Clapperboard size={13} className="text-amber-400" />
                              <span className="text-amber-300">Beat Shot Prompt</span>
                            </>
                          ) : (
                            <>
                              <ImageIcon size={13} className="text-[#C4C4BE]" />
                              <span>Structured Image Prompt</span>
                            </>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(compiled.promptText, `prompt-${beatKey}`)}
                          className={`font-display text-xs px-3 py-1.5 rounded-[3px] transition-colors flex items-center gap-1.5 font-semibold cursor-pointer ${
                            isVideoMode
                              ? 'bg-amber-400 text-black hover:bg-amber-300'
                              : 'bg-white text-black hover:bg-[#EAEAE5]'
                          }`}
                        >
                          {isCopiedPrompt ? (
                            <>
                              <Check size={12} className="text-black" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} className="text-black" />
                              <span>Copy Prompt</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div
                        className={`text-xs leading-relaxed p-3.5 border rounded-[3px] font-mono selection:bg-white selection:text-black ${
                          isVideoMode
                            ? 'bg-[#0C0C0B] border-amber-700/40 text-[#F0EFEA]'
                            : 'bg-[#0C0C0B] border-white/15 text-[#E8E8E2]'
                        }`}
                      >
                        {compiled.promptText}
                      </div>
                    </div>

                    {/* Scene 8-Part Video Prompt & Start Keyframe (Video Mode Only) */}
                    {isVideoMode && inspScene.videoPrompt && (
                      <div className="pt-3 border-t border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-display text-xs font-medium text-amber-300">
                            Scene {inspRoman} Video Prompt ({result.targetVideoDuration || 5}s Clip)
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(inspScene.videoPrompt || '', `video-prompt-${inspScene.index}`)}
                            className="font-display text-xs px-2.5 py-1 bg-amber-400/15 hover:bg-amber-400/25 text-amber-200 border border-amber-500/40 rounded-[3px] inline-flex items-center gap-1 cursor-pointer"
                          >
                            {copiedIndex === `video-prompt-${inspScene.index}` ? (
                              <>
                                <Check size={11} />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={11} />
                                <span>Copy Clip Prompt</span>
                              </>
                            )}
                          </button>
                        </div>
                        <div className="p-3 bg-[#0C0C0B] border border-amber-700/35 rounded-[3px] font-mono text-xs text-[#F0EFEA] leading-relaxed">
                          {inspScene.videoPrompt}
                        </div>
                      </div>
                    )}

                    {isVideoMode && inspScene.startFramePrompt && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-display text-xs font-medium text-[#C4C4BE]">
                            Start Frame Keyframe (I2V Anchor)
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(inspScene.startFramePrompt || '', `start-frame-${inspScene.index}`)}
                            className="font-display text-xs px-2.5 py-1 bg-white/5 hover:bg-white/15 text-[#E6E6E1] border border-white/15 rounded-[3px] inline-flex items-center gap-1 cursor-pointer"
                          >
                            {copiedIndex === `start-frame-${inspScene.index}` ? (
                              <>
                                <Check size={11} className="text-emerald-400" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={11} />
                                <span>Copy Frame</span>
                              </>
                            )}
                          </button>
                        </div>
                        <div className="p-3 bg-[#0C0C0B] border border-white/10 rounded-[3px] font-mono text-xs text-[#D4D4D0] leading-relaxed">
                          {inspScene.startFramePrompt}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="bg-[#121211] border border-white/15 rounded-[3px] p-6 text-center text-sm text-[#8C8C86]">
              Select any beat card on the left to inspect its camera direction and visual prompt.
            </div>
          )}
        </aside>
      </div>

      {/* Mobile & Tablet Beat Expansion Bottom Sheet (< lg) */}
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

      {/* Style & Continuity Modal */}
      {isStyleModalOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Visual Style and Character Continuity"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsStyleModalOpen(false);
            }}
          >
            <div className="w-full max-w-3xl max-h-[88vh] bg-[#121210] border border-white/20 rounded-[4px] shadow-2xl flex flex-col overflow-hidden text-[#F5F5F0]">
              <div className="flex items-center justify-between px-5 py-3.5 bg-[#161614] border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2.5">
                  <Layers size={16} className="text-white" />
                  <h2 className="font-display text-base font-medium text-white">
                    Style Profile &amp; Continuity Sheets
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsStyleModalOpen(false)}
                  className="p-1.5 text-[#9C9C96] hover:text-white hover:bg-white/10 rounded-[3px] transition-colors cursor-pointer"
                  aria-label="Close style and cast sheets"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-5 overflow-y-auto">
                <StyleAndCharactersSection
                  styleProfile={result.styleProfile}
                  characterSheet={result.characterSheet}
                  locationSheet={result.locationSheet}
                  copiedIndex={copiedIndex}
                  onCopy={copyToClipboard}
                  isModal
                  onOpenReferencePacket={() => {
                    setIsStyleModalOpen(false);
                    setIsRefModalOpen(true);
                  }}
                />
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Multi-Angle Character Reference Packet Modal */}
      <CharacterReferenceModal
        isOpen={isRefModalOpen}
        onClose={() => setIsRefModalOpen(false)}
        characterSheet={result.characterSheet || {}}
        styleProfile={result.styleProfile}
        format={format}
      />

      {/* Series Continuity Roadmap Modal */}
      <SeriesRoadmapModal
        isOpen={isRoadmapModalOpen}
        onClose={() => setIsRoadmapModalOpen(false)}
        seriesTitle={result.title || 'Series Roadmap'}
        roadmap={result.seriesRoadmap}
        onSelectEpisodeForGeneration={handleSelectEpisodeForDraft}
        onSaveContinuity={handleManualSaveContinuity}
        isSaved={isContinuitySaved}
      />
    </div>
  );
}
