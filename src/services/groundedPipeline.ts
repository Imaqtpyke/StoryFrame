/**
 * Grounded StoryFrame Generation Pipeline (Stages 0 to 4)
 * Orchestrates:
 * Stage 0: Narration & Timing Preparation
 * Stage 1: Whole-Story Bible Generation (with Session Caching)
 * Stage 2: Picture-Grounded Beat Planning (Short vs Long Pacing + Video Clip Mapping)
 * Stage 3: Self-Contained Scene Prompt Writing (Portrait Safe Zones + Video Trajectory)
 * Stage 4: Code Checks, Repairs & Critic Verification
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
import { stage2GenerateBeatPlan } from './stage2BeatPlan';
import { stage3WriteScenePrompts } from './stage3PromptWriter';
import { stage4VerifyAndRepairScene } from './stage4VerifyRepair';

export async function executeGroundedPipeline(
  req: GenerateStoryRequest,
  apiKey: string,
  userSignal?: AbortSignal,
  onStatusMessage?: (msg: string) => void
): Promise<StoryGenerationResult> {
  const modelQuality = req.modelQuality || 'standard';
  const format = req.format || 'short';
  const generationMode = req.generationMode || 'image';
  const isVideo = generationMode === 'video';

  // --------------------------------------------------------------------------
  // Stage 0: Preparation (Strip NOTES: from narration, index words, parse timings)
  // --------------------------------------------------------------------------
  if (onStatusMessage) onStatusMessage('Stage 0: Preparing narration, stripping notes & indexing words...');
  const prepared = stage0PrepareNarration(req.story);

  if (prepared.words.length === 0) {
    throw new Error('Narration contains no readable words. Please enter a story.');
  }

  // --------------------------------------------------------------------------
  // Stage 1: Story Bible (Session Cached per story + NOTES hash)
  // --------------------------------------------------------------------------
  if (onStatusMessage) onStatusMessage('Stage 1: Architecting Story Bible (Cast, Threat, Referents)...');
  const bible = await stage1GenerateStoryBible(
    prepared.cleanNarration,
    prepared.authorNotes,
    apiKey,
    modelQuality,
    userSignal,
    onStatusMessage
  );

  // --------------------------------------------------------------------------
  // Stage 2: Beat Planning (Pacing Calibrated by Format + Video Clip Map)
  // --------------------------------------------------------------------------
  if (onStatusMessage) {
    onStatusMessage(`Stage 2: Segmenting picture-based beats (${format === 'short' ? 'rapid short-form' : 'cinematic long-form'})...`);
  }
  const plannedScenes = await stage2GenerateBeatPlan(
    prepared.words,
    bible,
    format,
    generationMode,
    apiKey,
    modelQuality,
    userSignal,
    onStatusMessage
  );

  // --------------------------------------------------------------------------
  // Stages 3 & 4: Per-Scene Prompt Writing & Verification
  // --------------------------------------------------------------------------
  const finalScenes: Scene[] = [];
  let previousDepicts: string[] = [];

  for (let sIdx = 0; sIdx < plannedScenes.length; sIdx++) {
    const plannedScene = plannedScenes[sIdx];
    const sceneNum = plannedScene.index || sIdx + 1;

    if (onStatusMessage) {
      onStatusMessage(`Stage 3: Writing visual prompts for Scene ${sceneNum} of ${plannedScenes.length}...`);
    }

    // Stage 3: Write prompts
    const writtenBeats = await stage3WriteScenePrompts(
      sceneNum,
      plannedScene.beats,
      bible,
      previousDepicts,
      format,
      generationMode,
      apiKey,
      modelQuality,
      userSignal,
      onStatusMessage
    );

    if (onStatusMessage) {
      onStatusMessage(`Stage 4: Verifying 7 code checks & running critic for Scene ${sceneNum}...`);
    }

    // Stage 4: Verify and repair (capped at 2 rounds)
    const verifiedBeats = await stage4VerifyAndRepairScene(
      sceneNum,
      plannedScene.narratorLine,
      writtenBeats,
      bible,
      format,
      apiKey,
      modelQuality,
      userSignal,
      onStatusMessage
    );

    // Track last two depicts for context in next scene
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

    // Generate scene-level videoPrompt and startFramePrompt for Text to Video mode
    let sceneVideoPrompt: string | undefined = undefined;
    let sceneStartFramePrompt: string | undefined = undefined;

    if (isVideo && beatsForScene.length > 0) {
      const firstBeat = beatsForScene[0];
      sceneStartFramePrompt = firstBeat.imagePrompt;
      const cleanMovement = beatsForScene.map((b) => b.depicts).join('. ');
      sceneVideoPrompt = `Continuous single-take video capture, ${format === 'short' ? 'vertical 9:16 portrait' : 'cinematic 16:9 landscape'}. ${firstBeat.imagePrompt} Dynamic motion trajectory: ${cleanMovement}. Visual style: ${bible.worldStyle}. Natural lighting, seamless temporal progression, no text or overlays.`;
    }

    finalScenes.push({
      index: sceneNum,
      narratorLine: plannedScene.narratorLine,
      estimatedSeconds: plannedScene.estimatedSeconds,
      beats: beatsForScene,
      videoPrompt: sceneVideoPrompt,
      startFramePrompt: sceneStartFramePrompt,
    });
  }

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

  return {
    totalDurationSeconds: Math.round(totalDurationSeconds * 10) / 10,
    styleProfile,
    characterSheet,
    locationSheet,
    scenes: finalScenes,
    generationMode,
    targetVideoDuration: req.targetVideoDuration || (isVideo ? 5 : undefined),
    storyBible: bible,
    assumptions: bible.assumptions,
    authorNotes: prepared.authorNotes,
    timingSource: prepared.timingSource,
  };
}
