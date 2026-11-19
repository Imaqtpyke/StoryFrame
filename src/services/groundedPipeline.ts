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
} from '../types';
import { stage0PrepareNarration } from './stage0Prepare';
import { stage1GenerateStoryBible } from './stage1StoryBible';
import { stage2GenerateBeatPlan, PlannedScene } from './stage2BeatPlan';
import { stage3WriteScenePromptsBatch } from './stage3PromptWriter';
import { stage4VerifyAndRepairScene } from './stage4VerifyRepair';
import { compileThumbnailPrompt } from './promptCompiler';
import {
  buildCheckpointKey,
  clearGroundedCheckpoint,
  getGroundedCheckpoint,
  GroundedCheckpointProgress,
  saveGroundedCheckpoint,
  summarizeGroundedCheckpoint,
} from './groundedCheckpoint';

const SCENE_BATCH_SIZE = 4;

export function getGroundedProgressForRequest(req: GenerateStoryRequest | null | undefined): GroundedCheckpointProgress | null {
  if (!req || !req.story || !req.story.trim()) return null;
  if (req.format !== 'long' || req.generationMode === 'video') return null;

  const prepared = stage0PrepareNarration(req.story);
  if (prepared.words.length === 0) return null;

  const key = buildCheckpointKey(
    prepared.cleanNarration,
    prepared.authorNotes,
    req.format || 'long',
    req.generationMode || 'image',
    req.modelQuality || 'standard',
    req.characterStyle
  );
  return summarizeGroundedCheckpoint(key);
}

export function clearGroundedProgressForRequest(req: GenerateStoryRequest | null | undefined): void {
  if (!req || !req.story || !req.story.trim()) return;
  const prepared = stage0PrepareNarration(req.story);
  if (prepared.words.length === 0) return;

  const key = buildCheckpointKey(
    prepared.cleanNarration,
    prepared.authorNotes,
    req.format || 'long',
    req.generationMode || 'image',
    req.modelQuality || 'standard',
    req.characterStyle
  );
  clearGroundedCheckpoint(key);
}

function buildStoryDerivedHookFallback(storyText: string, events: string[]): string {
  const source = (events[events.length - 1] || storyText || '').trim();
  const stop = new Set('the a an in on at to of and or is was were are that this with for from into over as by'.split(' '));
  const keywords = source
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w.toLowerCase()))
    .slice(0, 3)
    .map((w) => w.toUpperCase());
  if (keywords.length >= 2) {
    return keywords.join(' ');
  }
  return 'WHAT HAPPENED NEXT';
}

export async function executeGroundedPipeline(
  req: GenerateStoryRequest,
  apiKey: string,
  userSignal?: AbortSignal,
  onStatusMessage?: (msg: string) => void
): Promise<StoryGenerationResult> {
  const modelQuality = req.modelQuality || 'standard';
  const format = req.format || 'short';
  const generationMode = req.generationMode || 'image';
  const provider = req.aiProvider || 'gemini';
  const groqModel = req.groqModel;
  const isVideo = generationMode === 'video';

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
    req.characterStyle
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
    if (onStatusMessage) onStatusMessage('Stage 1: Architecting Story Bible (Cast, Threat, Referents)...');
    bible = await stage1GenerateStoryBible(
      prepared.cleanNarration,
      prepared.authorNotes,
      apiKey,
      modelQuality,
      userSignal,
      onStatusMessage,
      provider,
      groqModel
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

  // --------------------------------------------------------------------------
  // Stage 2: Beat Planning (Resumable From Checkpoint)
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
  } else {
    if (onStatusMessage) {
      onStatusMessage(`Stage 2: Segmenting picture-based beats (${format === 'short' ? 'rapid short-form' : 'cinematic long-form'})...`);
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
      groqModel
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
  // Stages 3 & 4: Batched Scene Prompt Writing & Fast Verification + Checkpointing
  // --------------------------------------------------------------------------
  const finalScenes: Scene[] = Array.isArray(checkpoint?.completedScenes)
    ? [...checkpoint.completedScenes]
    : [];
  let previousDepicts: string[] = Array.isArray(checkpoint?.lastDepicts) ? [...checkpoint.lastDepicts] : [];

  const startIdx = finalScenes.length;

  for (let batchStart = startIdx; batchStart < plannedScenes.length; batchStart += SCENE_BATCH_SIZE) {
    if (userSignal?.aborted) {
      throw new DOMException('Cancelled by user', 'AbortError');
    }

    const batchSlice = plannedScenes.slice(batchStart, batchStart + SCENE_BATCH_SIZE);
    const batchInput = batchSlice.map((ps, offset) => ({
      sceneIndex: ps.index || batchStart + offset + 1,
      beats: ps.beats,
    }));

    const firstSceneNum = batchInput[0].sceneIndex;
    const lastSceneNum = batchInput[batchInput.length - 1].sceneIndex;
    const rangeLabel = firstSceneNum === lastSceneNum ? `Scene ${firstSceneNum}` : `Scenes ${firstSceneNum}-${lastSceneNum}`;

    if (onStatusMessage) {
      onStatusMessage(
        `Stage 3: Writing visual prompts for ${rangeLabel} of ${plannedScenes.length}${batchStart > 0 ? ` (${batchStart} saved)` : ''}...`
      );
    }

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
      groqModel
    );

    for (let offset = 0; offset < batchSlice.length; offset++) {
      const plannedScene = batchSlice[offset];
      const sceneNum = plannedScene.index || batchStart + offset + 1;
      const writtenBeats = writtenMap.get(sceneNum) || plannedScene.beats.map((b) => ({
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
        { runLlmCritic: false }
      );

      previousDepicts = verifiedBeats.slice(-2).map((b) => b.depicts);

      const beatsForScene: Beat[] = verifiedBeats.map((vb) => ({
        beatIndex: vb.beatIndex,
        textSpan: vb.textSpan,
        imagePrompt: vb.imagePrompt,
        estimatedSeconds: vb.estimatedSeconds,
        shotType: vb.shotSize,
        cameraAngle: vb.angle,
        cameraMovement: isVideo ? 'Continuous Camera Pan' : 'Static',
        wordRange: vb.wordRange,
        depicts: vb.depicts,
        kind: vb.kind,
        referentId: vb.referentId,
        intensity: vb.intensity,
        subjectIds: vb.subjectIds,
        newInfo: vb.newInfo,
        overlayText: vb.overlayText,
        flaggedIssue: vb.flaggedIssue,
      }));

      finalScenes.push({
        index: sceneNum,
        narratorLine: plannedScene.narratorLine,
        estimatedSeconds: plannedScene.estimatedSeconds,
        beats: beatsForScene,
      });
    }

    // Persist checkpoint after every completed batch so transient busy errors never erase finished work
    saveGroundedCheckpoint({
      key: checkpointKey,
      totalWords: prepared.words.length,
      updatedAt: Date.now(),
      bible,
      plannedScenes,
      completedScenes: finalScenes,
      lastDepicts: previousDepicts,
    });
  }

  // Clear temporary checkpoint now that all scenes succeeded cleanly
  clearGroundedCheckpoint(checkpointKey);

  // Build characterSheet and locationSheet from Bible
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

  const styleProfile: StyleProfile = {
    artStyle: bible.worldStyle,
    colorPalette: 'Grounded period tones',
    lighting: 'Natural atmospheric lighting',
    eraAndSetting: bible.locations.map((l) => l.id).join(', '),
  };

  const totalDurationSeconds = finalScenes.reduce((acc, sc) => acc + sc.estimatedSeconds, 0);

  const fallbackHook = buildStoryDerivedHookFallback(prepared.cleanNarration, bible.events || []);
  const hookText = (bible.thumbnailHook?.hookText || '').trim() || fallbackHook;

  const thumbnail = compileThumbnailPrompt({
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

  return {
    totalDurationSeconds: Math.round(totalDurationSeconds * 10) / 10,
    styleProfile,
    characterSheet,
    locationSheet,
    scenes: finalScenes,
    generationMode,
    targetVideoDuration: req.targetVideoDuration || (isVideo ? 5 : undefined),
    thumbnail,
    storyBible: bible,
    assumptions: bible.assumptions,
    authorNotes: prepared.authorNotes,
    timingSource: prepared.timingSource,
  };
}
