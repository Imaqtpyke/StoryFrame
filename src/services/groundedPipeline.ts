/**
 * Grounded StoryFrame Generation Pipeline (Stages 0 to 4)
 * Orchestrates:
 * Stage 0: Narration & Timing Preparation
 * Stage 1: Whole-Story Bible Generation (with Persistent Checkpoint)
 * Stage 2: Picture-Grounded Beat Planning (Short vs Long Pacing)
 * Stage 3: Batched Self-Contained Scene Prompt Writing (Saved Per Batch)
 * Stage 4: Fast Deterministic 7-Rule Checks & Targeted Repairs
 */

import {
  GenerateStoryRequest,
  StoryGenerationResult,
  Scene,
  Beat,
  StyleProfile,
  OnPartialStoryCallback,
  StoryBible,
} from '../types';
import { stage0PrepareNarration } from './stage0Prepare';
import { stage1GenerateStoryBible } from './stage1StoryBible';
import { stage2GenerateBeatPlan, buildPlannedScenesFromCustomScenes, PlannedScene } from './stage2BeatPlan';
import {
  stage3WriteScenePromptsBatch,
  WrittenPromptBeat,
  SceneStage3Meta,
} from './stage3PromptWriter';
import { stage4VerifyAndRepairScene } from './stage4VerifyRepair';
import {
  compileThumbnailPrompt,
  buildStoryDerivedHookFallback,
  classifyVisualStyleFamily,
} from './promptCompiler';
import { paceGeminiStep } from './unifiedAiService';
import {
  buildCheckpointKey,
  clearGroundedCheckpoint,
  getGroundedCheckpoint,
  GroundedCheckpointProgress,
  saveGroundedCheckpoint,
  summarizeGroundedCheckpoint,
} from './groundedCheckpoint';

const VIDEO_CAMERA_MOTIONS = [
  'Slow Push-In',
  'Tracking Subject',
  'Smooth Pan',
  'Low Dolly Glide',
];

export function getGroundedProgressForRequest(req: GenerateStoryRequest | null | undefined): GroundedCheckpointProgress | null {
  if (!req || !req.story || !req.story.trim()) return null;

  const prepared = stage0PrepareNarration(req.story);
  if (prepared.words.length === 0) return null;

  const isVideo = req.generationMode === 'video';
  const key = buildCheckpointKey(
    prepared.cleanNarration,
    prepared.authorNotes,
    req.format || 'long',
    req.generationMode || 'image',
    req.modelQuality || 'standard',
    req.characterStyle,
    isVideo ? req.targetVideoDuration : undefined,
    req.openingHookPriority
  );
  return summarizeGroundedCheckpoint(key);
}

export function clearGroundedProgressForRequest(req: GenerateStoryRequest | null | undefined): void {
  if (!req || !req.story || !req.story.trim()) return;
  const prepared = stage0PrepareNarration(req.story);
  if (prepared.words.length === 0) return;

  const isVideo = req.generationMode === 'video';
  const key = buildCheckpointKey(
    prepared.cleanNarration,
    prepared.authorNotes,
    req.format || 'long',
    req.generationMode || 'image',
    req.modelQuality || 'standard',
    req.characterStyle,
    isVideo ? req.targetVideoDuration : undefined,
    req.openingHookPriority
  );
  clearGroundedCheckpoint(key);
}

// Story-derived hook fallback is imported from promptCompiler

function assembleGroundedStoryResult(params: {
  req: GenerateStoryRequest;
  bible: StoryBible;
  scenes: Scene[];
  cleanNarration: string;
  authorNotes?: string;
  timingSource?: 'actual' | 'estimated';
  totalPlannedScenes?: number;
  isPartial?: boolean;
  stageLabel?: string;
}): StoryGenerationResult {
  const {
    req,
    bible,
    scenes,
    cleanNarration,
    authorNotes,
    timingSource,
    totalPlannedScenes,
    isPartial,
    stageLabel,
  } = params;
  const generationMode = req.generationMode || 'image';
  const isVideo = generationMode === 'video';

  const characterSheet: Record<string, string> = {};
  for (const c of bible.cast) {
    characterSheet[c.id] = `${c.role}: ${c.visualLock}`;
  }
  if (bible.threat && bible.threat.canonicalLook) {
    characterSheet['Threat'] = bible.threat.canonicalLook;
  }

  const locationSheet: Record<string, string> = {};
  for (const l of bible.locations) {
    locationSheet[l.id] = l.visualLock;
  }

  const styleFamily = bible.styleFamily || classifyVisualStyleFamily(req.characterStyle || bible.worldStyle);
  const openingLighting = bible.lightingArc?.[0]?.lightingDescription || 'Natural atmospheric lighting';

  const styleProfile: StyleProfile = {
    artStyle: bible.worldStyle,
    colorPalette: 'Grounded period tones',
    lighting: openingLighting,
    eraAndSetting: bible.locations.map((l) => l.id).join(', '),
    styleFamily,
  };

  const totalDurationSeconds = scenes.reduce((acc, sc) => acc + sc.estimatedSeconds, 0);

  const fallbackHook = buildStoryDerivedHookFallback(cleanNarration, bible.events || []);
  const hookText = (bible.thumbnailHook?.hookText || '').trim() || fallbackHook;

  const thumbnail = isPartial
    ? undefined
    : compileThumbnailPrompt({
        rawThumbnail: {
          heroMoment:
            (bible.thumbnailHook?.heroMoment || '').trim() ||
            bible.events[bible.events.length - 1] ||
            'The decisive turning point of the narrative',
          expression:
            (bible.thumbnailHook?.expression || '').trim() ||
            'intense, emotionally charged, and highly focused',
          bgDescription: `${styleProfile.eraAndSetting} with deep atmospheric depth`,
          accentColor: 'golden hour amber',
          hookText,
          alternateHooks:
            Array.isArray(bible.thumbnailHook?.alternateHooks) && bible.thumbnailHook.alternateHooks.length > 0
              ? bible.thumbnailHook.alternateHooks
              : [fallbackHook, 'THE FINAL TURNING POINT'],
        },
        styleProfile,
        characterSheet,
        storyPremise: req.story,
        format: req.format,
        platform: req.platform,
      });

  const lastScene = scenes[scenes.length - 1];
  const defaultStageLabel =
    scenes.length > 0 && lastScene
      ? totalPlannedScenes
        ? `Scene ${lastScene.index || scenes.length} of ${totalPlannedScenes} (${lastScene.beats.length} beats ready)...`
        : `Scene ${lastScene.index || scenes.length}, Beat ${lastScene.beats.length} ready...`
      : 'Story Bible locked. Streaming Scene 1, Beat 1...';

  return {
    totalDurationSeconds: Math.round(totalDurationSeconds * 10) / 10,
    styleProfile,
    characterSheet,
    locationSheet,
    scenes: [...scenes],
    generationMode,
    targetVideoDuration: req.targetVideoDuration || (isVideo ? 5 : undefined),
    openingHookPriority: req.openingHookPriority ? true : undefined,
    thumbnail,
    storyBible: bible,
    assumptions: bible.assumptions,
    authorNotes,
    timingSource,
    progress: isPartial
      ? {
          completedScenes: scenes.length,
          totalPlannedScenes,
          isPartial: true,
          stageLabel: stageLabel || defaultStageLabel,
        }
      : undefined,
  };
}

export async function executeGroundedPipeline(
  req: GenerateStoryRequest,
  apiKey: string,
  userSignal?: AbortSignal,
  onStatusMessage?: (msg: string) => void,
  onPartialResult?: OnPartialStoryCallback
): Promise<StoryGenerationResult> {
  const modelQuality = req.modelQuality || 'standard';
  const format = req.format || 'short';
  const generationMode = req.generationMode || 'image';
  const provider = req.aiProvider || 'gemini';
  const groqModel = req.groqModel;
  const isVideo = generationMode === 'video';
  const targetVideoDuration = isVideo
    ? req.targetVideoDuration || (typeof req.durationSeconds === 'number' && req.durationSeconds <= 15 ? req.durationSeconds : 5)
    : undefined;

  // --------------------------------------------------------------------------
  // Stage 0: Preparation (Strip NOTES: from narration, index words, parse timings)
  // --------------------------------------------------------------------------
  if (onStatusMessage) onStatusMessage('Stage 0: Preparing narration, stripping notes & indexing words...');
  const prepared = stage0PrepareNarration(req.story);

  if (prepared.words.length === 0) {
    throw new Error('Narration contains no readable words. Please enter a story.');
  }

  const checkpointKey = buildCheckpointKey(
    prepared.cleanNarration,
    prepared.authorNotes,
    format,
    generationMode,
    modelQuality,
    req.characterStyle,
    targetVideoDuration,
    req.openingHookPriority
  );

  let checkpoint = getGroundedCheckpoint(checkpointKey);

  // --------------------------------------------------------------------------
  // Stage 1: Story Bible (Session + Checkpoint Restorable)
  // --------------------------------------------------------------------------
  let bible = checkpoint?.bible;
  if (bible) {
    if (onStatusMessage) {
      onStatusMessage('Resuming saved Story Bible checkpoint...');
    }
  } else {
    if (onStatusMessage) onStatusMessage('Stage 1: Architecting Story Bible (Cast, Spatial Map, Lighting Arc)...');
    bible = await stage1GenerateStoryBible(
      prepared.cleanNarration,
      prepared.authorNotes,
      apiKey,
      modelQuality,
      userSignal,
      onStatusMessage,
      provider,
      groqModel,
      req.characterStyle
    );
    saveGroundedCheckpoint({
      key: checkpointKey,
      totalWords: prepared.words.length,
      updatedAt: Date.now(),
      bible,
      completedScenes: [],
    });
    checkpoint = getGroundedCheckpoint(checkpointKey);
  }

  // Immediately exit ResultsSkeleton and show locked Story Bible + Cast before Stage 2
  if (onPartialResult && !userSignal?.aborted) {
    const resumedScenes = Array.isArray(checkpoint?.completedScenes) ? checkpoint.completedScenes : [];
    onPartialResult(
      assembleGroundedStoryResult({
        req,
        bible,
        scenes: resumedScenes,
        cleanNarration: prepared.cleanNarration,
        authorNotes: prepared.authorNotes,
        timingSource: prepared.timingSource,
        totalPlannedScenes: checkpoint?.plannedScenes?.length,
        isPartial: true,
        stageLabel:
          resumedScenes.length > 0
            ? `Resumed ${resumedScenes.length} saved scenes. Planning remaining beats...`
            : 'Story Bible locked. Planning scenes and beats...',
      })
    );
  }

  // --------------------------------------------------------------------------
  // Stage 2: Beat Planning (Resumable From Checkpoint, supports Custom Beats)
  // --------------------------------------------------------------------------
  let plannedScenes: PlannedScene[] | undefined =
    checkpoint?.plannedScenes && checkpoint.plannedScenes.length > 0 ? checkpoint.plannedScenes : undefined;

  if (plannedScenes) {
    const savedCount = checkpoint?.completedScenes?.length || 0;
    if (onStatusMessage) {
      onStatusMessage(
        savedCount > 0
          ? `Resuming saved Beat Plan (${savedCount} of ${plannedScenes.length} scenes already completed)...`
          : `Resuming saved Beat Plan (${plannedScenes.length} scenes)...`
      );
    }
  } else if (req.beatMode === 'custom' && Array.isArray(req.customScenes) && req.customScenes.length > 0) {
    if (onStatusMessage) {
      onStatusMessage('Stage 2: Locking user custom scene and beat cuts...');
    }
    plannedScenes = buildPlannedScenesFromCustomScenes(
      req.customScenes,
      prepared.words,
      bible,
      format,
      generationMode,
      targetVideoDuration
    );
    saveGroundedCheckpoint({
      key: checkpointKey,
      totalWords: prepared.words.length,
      updatedAt: Date.now(),
      bible,
      plannedScenes,
      completedScenes: checkpoint?.completedScenes || [],
      lastDepicts: checkpoint?.lastDepicts,
    });
    checkpoint = getGroundedCheckpoint(checkpointKey);
  } else {
    const stage2Label = `Stage 2: Segmenting ${isVideo ? `${targetVideoDuration}s video clip` : 'phrase-level'} beats (${format === 'short' ? '9:16 portrait' : '16:9 widescreen'})...`;
    await paceGeminiStep({
      provider,
      apiKey,
      delayMs: 1500,
      userSignal,
      onStatusMessage,
      nextStepLabel: stage2Label,
    });
    if (onStatusMessage) {
      onStatusMessage(stage2Label);
    }
    plannedScenes = await stage2GenerateBeatPlan(
      prepared.words,
      bible,
      format,
      generationMode,
      apiKey,
      modelQuality,
      userSignal,
      onStatusMessage,
      provider,
      groqModel,
      targetVideoDuration,
      Boolean(req.openingHookPriority)
    );
    saveGroundedCheckpoint({
      key: checkpointKey,
      totalWords: prepared.words.length,
      updatedAt: Date.now(),
      bible,
      plannedScenes,
      completedScenes: checkpoint?.completedScenes || [],
      lastDepicts: checkpoint?.lastDepicts,
    });
    checkpoint = getGroundedCheckpoint(checkpointKey);
  }

  // --------------------------------------------------------------------------
  // Stages 3 & 4: Sequential 2-Scene Streaming Batches + Live Beat Updates
  // --------------------------------------------------------------------------
  const finalScenes: Scene[] = Array.isArray(checkpoint?.completedScenes)
    ? [...checkpoint.completedScenes]
    : [];
  let previousDepicts: string[] = Array.isArray(checkpoint?.lastDepicts) ? [...checkpoint.lastDepicts] : [];

  // Emit beat-plan readiness immediately (or resumed checkpoint scenes)
  if (onPartialResult && !userSignal?.aborted) {
    onPartialResult(
      assembleGroundedStoryResult({
        req,
        bible,
        scenes: finalScenes,
        cleanNarration: prepared.cleanNarration,
        authorNotes: prepared.authorNotes,
        timingSource: prepared.timingSource,
        totalPlannedScenes: plannedScenes.length,
        isPartial: true,
        stageLabel:
          finalScenes.length > 0
            ? `Resumed ${finalScenes.length} of ${plannedScenes.length} scenes. Streaming next beat...`
            : `Beat plan ready (${plannedScenes.length} scenes). Streaming Scene 1, Beat 1...`,
      })
    );
  }

  const mapWrittenBeatsToSceneBeats = (writtenList: WrittenPromptBeat[]): Beat[] =>
    writtenList.map((vb) => {
      const lowerShot = (vb.shotSize || '').toLowerCase();
      const videoMotion =
        lowerShot.includes('extreme close') || lowerShot.includes('macro')
          ? 'Static Frame'
          : VIDEO_CAMERA_MOTIONS[(vb.beatIndex - 1) % VIDEO_CAMERA_MOTIONS.length];

      return {
        beatIndex: vb.beatIndex,
        textSpan: vb.textSpan,
        imagePrompt: vb.imagePrompt,
        estimatedSeconds: vb.estimatedSeconds,
        shotType: vb.shotSize,
        cameraAngle: vb.angle,
        cameraMovement: isVideo ? videoMotion : 'Static Frame',
        wordRange: vb.wordRange,
        depicts: vb.depicts,
        kind: vb.kind,
        referentId: vb.referentId,
        intensity: vb.intensity,
        subjectIds: vb.subjectIds,
        newInfo: vb.newInfo,
        overlayText: vb.overlayText,
        flaggedIssue: vb.flaggedIssue,
        shotRole: vb.shotRole,
        clipIndex: vb.clipIndex,
      };
    });

  const batchSize = format === 'short' || plannedScenes.length <= 8 ? 4 : 2;
  const cursor = finalScenes.length;
  for (let bs = cursor; bs < plannedScenes.length; bs += batchSize) {
    if (userSignal?.aborted) {
      throw new DOMException('Cancelled by user', 'AbortError');
    }

    const batchSlice = plannedScenes.slice(bs, bs + batchSize);
    const firstSceneNum = batchSlice[0].index || bs + 1;
    const lastSceneNum = batchSlice[batchSlice.length - 1].index || bs + batchSlice.length;

    await paceGeminiStep({
      provider,
      apiKey,
      delayMs: 1500,
      userSignal,
      onStatusMessage,
      nextStepLabel: `Stage 3: Streaming visual prompts for Scenes ${firstSceneNum}-${lastSceneNum} of ${plannedScenes.length}...`,
    });

    if (onStatusMessage) {
      onStatusMessage(
        `Stage 3: Streaming visual prompts for Scenes ${firstSceneNum}-${lastSceneNum} of ${plannedScenes.length}...`
      );
    }

    const batchInput = batchSlice.map((ps, offset) => ({
      sceneIndex: ps.index || bs + offset + 1,
      beats: ps.beats,
    }));

    const sceneMetaMap = new Map<number, SceneStage3Meta>();
    batchSlice.forEach((ps, offset) => {
      const sceneNum = ps.index || bs + offset + 1;
      sceneMetaMap.set(sceneNum, {
        narratorLine: ps.narratorLine,
        estimatedSeconds: ps.estimatedSeconds,
        timeOfDay: ps.timeOfDay,
        lightingState: ps.lightingState,
        beatToClipMap: ps.beatToClipMap,
      });
    });
    const writtenMap = await stage3WriteScenePromptsBatch(
      batchInput,
      bible,
      previousDepicts,
      format,
      generationMode,
      apiKey,
      modelQuality,
      userSignal,
      onStatusMessage,
      provider,
      groqModel,
      onPartialResult
        ? (partialBeatMap) => {
            if (userSignal?.aborted) return;
            const liveStreamingScenes: Scene[] = [...finalScenes];
            let latestSceneNum = firstSceneNum;
            let latestBeatNum = 1;

            for (let offset = 0; offset < batchSlice.length; offset++) {
              const plannedScene = batchSlice[offset];
              const sceneNum = plannedScene.index || bs + offset + 1;
              const partialBeats = partialBeatMap.get(sceneNum);
              if (!partialBeats || partialBeats.length === 0) continue;

              latestSceneNum = sceneNum;
              latestBeatNum = partialBeats[partialBeats.length - 1]?.beatIndex || partialBeats.length;

              liveStreamingScenes.push({
                index: sceneNum,
                narratorLine: plannedScene.narratorLine,
                estimatedSeconds: plannedScene.estimatedSeconds,
                beats: mapWrittenBeatsToSceneBeats(partialBeats),
                timeOfDay: plannedScene.timeOfDay,
                lightingState: plannedScene.lightingState,
                beatToClipMap: plannedScene.beatToClipMap,
              });
            }

            if (liveStreamingScenes.length > finalScenes.length) {
              onPartialResult(
                assembleGroundedStoryResult({
                  req,
                  bible,
                  scenes: liveStreamingScenes,
                  cleanNarration: prepared.cleanNarration,
                  authorNotes: prepared.authorNotes,
                  timingSource: prepared.timingSource,
                  totalPlannedScenes: plannedScenes.length,
                  isPartial: true,
                  stageLabel: `Scene ${latestSceneNum}, Beat ${latestBeatNum} ready...`,
                })
              );
            }
          }
        : undefined,
      sceneMetaMap,
      targetVideoDuration,
      Boolean(req.openingHookPriority)
    );

    // Run deterministic Stage 4 verification sequentially for each scene in this batch
    for (let offset = 0; offset < batchSlice.length; offset++) {
      const plannedScene = batchSlice[offset];
      const sceneNum = plannedScene.index || bs + offset + 1;
      const writtenBeats =
        writtenMap.get(sceneNum) ||
        plannedScene.beats.map((b) => ({
          ...b,
          imagePrompt: `${b.shotSize} ${format === 'short' ? 'portrait' : 'landscape'} framing, ${b.angle}. ${b.depicts}. ${bible.worldStyle}`,
        }));

      if (onStatusMessage) {
        onStatusMessage(`Stage 4: Running quality checks for Scene ${sceneNum} of ${plannedScenes.length}...`);
      }

      const verifiedBeats = await stage4VerifyAndRepairScene(
        sceneNum,
        plannedScene.narratorLine,
        writtenBeats,
        bible,
        format,
        apiKey,
        modelQuality,
        userSignal,
        onStatusMessage,
        provider,
        groqModel,
        { runLlmCritic: false, generationMode, targetVideoDuration }
      );

      previousDepicts = verifiedBeats.slice(-2).map((b) => b.depicts);

      finalScenes.push({
        index: sceneNum,
        narratorLine: plannedScene.narratorLine,
        estimatedSeconds: plannedScene.estimatedSeconds,
        beats: mapWrittenBeatsToSceneBeats(verifiedBeats),
        timeOfDay: plannedScene.timeOfDay,
        lightingState: plannedScene.lightingState,
        beatToClipMap: plannedScene.beatToClipMap,
      });

      // Checkpoint and surface each finished scene progressively right after Stage 4
      saveGroundedCheckpoint({
        key: checkpointKey,
        totalWords: prepared.words.length,
        updatedAt: Date.now(),
        bible,
        plannedScenes,
        completedScenes: finalScenes,
        lastDepicts: previousDepicts,
      });

      if (onPartialResult && !userSignal?.aborted) {
        const isLastPlanned = finalScenes.length >= plannedScenes.length;
        onPartialResult(
          assembleGroundedStoryResult({
            req,
            bible,
            scenes: finalScenes,
            cleanNarration: prepared.cleanNarration,
            authorNotes: prepared.authorNotes,
            timingSource: prepared.timingSource,
            totalPlannedScenes: plannedScenes.length,
            isPartial: true,
            stageLabel: isLastPlanned
              ? 'All scenes finished. Compiling cover thumbnail & CTA outro...'
              : `Scene ${sceneNum} of ${plannedScenes.length} ready...`,
          })
        );
      }
    }
  }

  // Clear temporary checkpoint now that all scenes succeeded cleanly
  clearGroundedCheckpoint(checkpointKey);

  return assembleGroundedStoryResult({
    req,
    bible,
    scenes: finalScenes,
    cleanNarration: prepared.cleanNarration,
    authorNotes: prepared.authorNotes,
    timingSource: prepared.timingSource,
    totalPlannedScenes: plannedScenes.length,
    isPartial: false,
  });
}
