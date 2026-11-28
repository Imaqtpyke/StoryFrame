/**
 * Stage 2: Picture-Grounded Beat Planning
 * Divides the numbered words into contiguous, non-overlapping picture beats
 * governed by strict pacing constants (short-form vs long-form) and clip mapping for video.
 */

import {
  StoryBible,
  StoryFormat,
  GenerationMode,
  AiProvider,
  GeminiModelQuality,
  ShotRole,
  CustomSceneDefinition,
} from '../types';
import { NumberedWord } from './stage0Prepare';
import { executeGeminiSchemaCall, executeJsonLlmCall } from './unifiedAiService';

export interface PacingConfig {
  minDwell: number;
  fastCutBelow: number;
  maxDwell: number;
  targetAvgMin: number;
  targetAvgMax: number;
}

export const SHORT_FORM_PACING: PacingConfig = {
  minDwell: 0.8,
  fastCutBelow: 1.1,
  maxDwell: 2.0,
  targetAvgMin: 1.2,
  targetAvgMax: 1.8,
};

export const LONG_FORM_PACING: PacingConfig = {
  minDwell: 0.8,
  fastCutBelow: 1.2,
  maxDwell: 3.0,
  targetAvgMin: 1.5,
  targetAvgMax: 2.5,
};

// Default constants for backward compatibility
export const MIN_DWELL = 0.8;
export const FAST_CUT_BELOW = 1.2;
export const MAX_DWELL = 3.0;
export const TARGET_SCENE_AVG_MIN = 1.5;
export const TARGET_SCENE_AVG_MAX = 2.5;

export interface PlannedBeat {
  beatIndex: number;
  wordRange: [number, number]; // [startIndex, endIndex] inclusive
  textSpan: string;
  depicts: string;
  kind: 'literal' | 'figurative' | 'withheld-effect';
  referentId?: string;
  intensity: 'low' | 'medium' | 'high';
  subjectIds: string[];
  shotSize: string;
  angle: string;
  newInfo: string;
  overlayText?: string;
  estimatedSeconds: number;
  flaggedIssue?: string;
  clipIndex?: number;
  shotRole?: ShotRole;
  transitionHint?: string;
}

export interface PlannedScene {
  index: number;
  narratorLine: string;
  beats: PlannedBeat[];
  estimatedSeconds: number;
  averageBeatSeconds: number;
  fastCutRatio: number;
  beatToClipMap?: Record<number, number>;
  timeOfDay?: string;
  lightingState?: string;
}

export const BEAT_PLAN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    scenes: {
      type: 'ARRAY',
      description: 'Ordered sequence of scenes containing contiguous visual beats',
      items: {
        type: 'OBJECT',
        properties: {
          index: { type: 'INTEGER' },
          narratorLine: { type: 'STRING' },
          timeOfDay: { type: 'STRING', description: 'Time of day for this scene matching lightingArc' },
          lightingState: {
            type: 'STRING',
            description: 'Natural descriptive lighting words for this scene (no Kelvin numbers)',
          },
          beats: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                startWordIndex: { type: 'INTEGER' },
                endWordIndex: { type: 'INTEGER' },
                depicts: { type: 'STRING', description: 'One plain sentence of what is visible in story terms' },
                kind: { type: 'STRING', enum: ['literal', 'figurative', 'withheld-effect'] },
                referentId: { type: 'STRING', description: 'Referent ID from bible if figurative' },
                intensity: { type: 'STRING', enum: ['low', 'medium', 'high'] },
                subjectIds: {
                  type: 'ARRAY',
                  items: { type: 'STRING' },
                  description: 'Entity IDs from the Bible who are visually present in this shot',
                },
                shotSize: {
                  type: 'STRING',
                  enum: ['wide', 'medium', 'close-up', 'extreme close-up', 'over-the-shoulder'],
                },
                angle: {
                  type: 'STRING',
                  enum: ['eye level', 'high', 'low', 'overhead', 'dutch tilt'],
                },
                shotRole: {
                  type: 'STRING',
                  enum: ['story_action', 'dialogue_acting', 'explainer_cutaway', 'visual_simile', 'match_cut_pair'],
                  description: 'Functional cinematic role of this shot',
                },
                transitionHint: {
                  type: 'STRING',
                  description: 'Optional internal visual bridge or match-cut continuity cue from previous beat',
                },
                newInfo: {
                  type: 'STRING',
                  description: 'Specific visual progression not seen in earlier beats in this scene',
                },
                overlayText: {
                  type: 'STRING',
                  description: 'Optional on-screen text for editor (e.g. 1348), never part of image prompt',
                },
              },
              required: [
                'startWordIndex',
                'endWordIndex',
                'depicts',
                'kind',
                'intensity',
                'subjectIds',
                'shotSize',
                'angle',
                'newInfo',
              ],
            },
          },
        },
        required: ['index', 'narratorLine', 'beats'],
      },
    },
  },
  required: ['scenes'],
};

/**
 * Validates and repairs beat pacing deterministically:
 * - Sub-minDwell beats merged into neighbor (unless custom beat boundaries are preserved).
 * - Fast cut rules: < fastCutBelow allowed only if high intensity, distinct visual, max 25% per scene, max 2 in a row.
 * - Trailing beat after fast cuts holds >= 2.0s (or >= 1.5s in short-form).
 * - For video mode: groups at most 2-3 consecutive beats with same subject capped at targetVideoDuration (or 8s default).
 */
export function enforceStage2Pacing(
  rawScenes: PlannedScene[],
  words: NumberedWord[],
  format: StoryFormat = 'long',
  generationMode: GenerationMode = 'image',
  targetVideoDuration?: number,
  options?: { preserveBeatBoundaries?: boolean }
): PlannedScene[] {
  const config = format === 'short' ? SHORT_FORM_PACING : LONG_FORM_PACING;
  const isVideo = generationMode === 'video';
  const effectiveMinDwell = isVideo ? config.minDwell : 0.45;
  const clipCeiling = targetVideoDuration && targetVideoDuration > 0 ? targetVideoDuration : 8.0;
  const maxBeatsPerClip = clipCeiling <= 4.5 ? 2 : 3;

  return rawScenes.map((scene) => {
    let beats = [...scene.beats];
    if (beats.length === 0) return scene;

    // 1. Merge tiny single-word stubs below effectiveMinDwell into neighbor
    if (!options?.preserveBeatBoundaries) {
      let i = 0;
      while (i < beats.length) {
        const b = beats[i];
        if (b.estimatedSeconds < effectiveMinDwell && beats.length > 1) {
          if (i < beats.length - 1) {
            const next = beats[i + 1];
            const newStart = Math.min(b.wordRange[0], next.wordRange[0]);
            const newEnd = Math.max(b.wordRange[1], next.wordRange[1]);
            const mergedWords = words.slice(newStart, newEnd + 1);
            const newDuration = Math.round((b.estimatedSeconds + next.estimatedSeconds) * 10) / 10;
            beats[i + 1] = {
              ...next,
              wordRange: [newStart, newEnd],
              textSpan: mergedWords.map((w) => w.word).join(' '),
              estimatedSeconds: newDuration,
              newInfo: `${b.newInfo} ${next.newInfo}`.trim(),
              overlayText: b.overlayText || next.overlayText,
            };
            beats.splice(i, 1);
          } else {
            const prev = beats[i - 1];
            const newStart = Math.min(prev.wordRange[0], b.wordRange[0]);
            const newEnd = Math.max(prev.wordRange[1], b.wordRange[1]);
            const mergedWords = words.slice(newStart, newEnd + 1);
            const newDuration = Math.round((prev.estimatedSeconds + b.estimatedSeconds) * 10) / 10;
            beats[i - 1] = {
              ...prev,
              wordRange: [newStart, newEnd],
              textSpan: mergedWords.map((w) => w.word).join(' '),
              estimatedSeconds: newDuration,
              newInfo: `${prev.newInfo} ${b.newInfo}`.trim(),
              overlayText: prev.overlayText || b.overlayText,
            };
            beats.splice(i, 1);
          }
        } else {
          i++;
        }
      }
    }

    // 2. Video Mode fast-cut ceiling (Image Mode uses Option B 2-6 word Phrase Cuts freely across distinct visual phrases)
    if (isVideo && !options?.preserveBeatBoundaries) {
      let consecutiveFastCuts = 0;
      const postFastCutHold = format === 'short' ? 1.5 : 2.0;

      for (let j = 0; j < beats.length; j++) {
        const b = beats[j];
        const isFastCut = b.estimatedSeconds < config.fastCutBelow;

        if (isFastCut) {
          consecutiveFastCuts++;
          if (consecutiveFastCuts > 2 || b.intensity !== 'high' || !b.newInfo.trim()) {
            b.estimatedSeconds = config.fastCutBelow;
            consecutiveFastCuts = 0;
          }
        } else {
          if (consecutiveFastCuts > 0) {
            b.estimatedSeconds = Math.max(postFastCutHold, b.estimatedSeconds);
          }
          consecutiveFastCuts = 0;
        }
      }

      // Cap fast cuts to at most 25% of scene in Video Mode
      const fastCutCount = beats.filter((b) => b.estimatedSeconds < config.fastCutBelow).length;
      const maxAllowedFastCuts = Math.floor(beats.length * 0.25);
      if (fastCutCount > maxAllowedFastCuts) {
        let excess = fastCutCount - maxAllowedFastCuts;
        for (const b of beats) {
          if (excess <= 0) break;
          if (b.estimatedSeconds < config.fastCutBelow) {
            b.estimatedSeconds = config.fastCutBelow;
            excess--;
          }
        }
      }
    }

    // Re-index beats
    beats = beats.map((b, idx) => ({ ...b, beatIndex: idx + 1 }));

    // 3. Video clip mapping: one beat = one clip, or consecutive beats with same subject capped at clipCeiling
    let beatToClipMap: Record<number, number> | undefined = undefined;
    if (isVideo) {
      beatToClipMap = {};
      let currentClip = 1;
      let clipDur = 0;
      let clipCount = 0;
      let clipSub = '';

      for (let k = 0; k < beats.length; k++) {
        const b = beats[k];
        const primarySub = b.subjectIds[0] || 'scene';
        const canGroup =
          clipCount > 0 &&
          clipCount < maxBeatsPerClip &&
          clipSub === primarySub &&
          clipDur + b.estimatedSeconds <= clipCeiling;

        if (canGroup) {
          b.clipIndex = currentClip;
          clipDur += b.estimatedSeconds;
          clipCount++;
        } else {
          if (clipCount > 0) currentClip++;
          b.clipIndex = currentClip;
          clipDur = b.estimatedSeconds;
          clipCount = 1;
          clipSub = primarySub;
        }
        beatToClipMap[b.beatIndex] = b.clipIndex;
      }
    }

    const totalSec = beats.reduce((acc, b) => acc + b.estimatedSeconds, 0);
    const avgSec = beats.length > 0 ? Math.round((totalSec / beats.length) * 10) / 10 : 0;
    const currentFastCutRatio =
      beats.length > 0 ? beats.filter((b) => b.estimatedSeconds < config.fastCutBelow).length / beats.length : 0;

    return {
      ...scene,
      beats,
      estimatedSeconds: Math.round(totalSec * 10) / 10,
      averageBeatSeconds: avgSec,
      fastCutRatio: Math.round(currentFastCutRatio * 100) / 100,
      beatToClipMap,
    };
  });
}

function normalizeCustomShotSize(rawShot?: string): string {
  const lower = (rawShot || '').toLowerCase();
  if (lower.includes('extreme close')) return 'extreme close-up';
  if (lower.includes('close')) return 'close-up';
  if (lower.includes('over-the-shoulder') || lower.includes('ots')) return 'over-the-shoulder';
  if (lower.includes('wide')) return 'wide';
  return 'medium';
}

/**
 * Deterministically converts user-defined Custom Scenes & Beats into PlannedScene[]
 * for Stage 3/4 execution without losing user cut boundaries or guidance.
 */
export function buildPlannedScenesFromCustomScenes(
  customScenes: CustomSceneDefinition[],
  words: NumberedWord[],
  bible: StoryBible,
  format: StoryFormat = 'short',
  generationMode: GenerationMode = 'image',
  targetVideoDuration?: number
): PlannedScene[] {
  let cursor = 0;
  const maxWordIndex = Math.max(0, words.length - 1);

  const rawScenes: PlannedScene[] = customScenes.map((cScene, sIdx) => {
    const rawBeats = Array.isArray(cScene.beats) && cScene.beats.length > 0
      ? cScene.beats
      : [{ id: `custom-${sIdx}-1`, textSpan: cScene.narratorLine }];

    const beats: PlannedBeat[] = rawBeats.map((cb, bIdx) => {
      const spanTokens = (cb.textSpan || '').trim().split(/\s+/).filter(Boolean);
      const tokenLen = Math.max(1, spanTokens.length);
      const start = Math.min(cursor, maxWordIndex);
      const isFinalBeatOverall = sIdx === customScenes.length - 1 && bIdx === rawBeats.length - 1;
      const end = isFinalBeatOverall
        ? maxWordIndex
        : Math.min(maxWordIndex, Math.max(start, start + tokenLen - 1));
      cursor = Math.min(maxWordIndex, end + 1);

      const spanWords = words.slice(start, end + 1);
      const startSec = spanWords[0]?.startSec ?? 0;
      const endSec = spanWords[spanWords.length - 1]?.endSec ?? startSec + 1.5;
      const duration = Math.max(0.5, Math.round((endSec - startSec) * 10) / 10);

      const combinedText = `${cb.textSpan || ''} ${cb.userGuidance || ''}`.toLowerCase();
      const matchedSubjects: string[] = [];
      for (const c of bible.cast || []) {
        const token = c.id.toLowerCase().replace(/_/g, ' ');
        const roleToken = c.role.toLowerCase();
        if (combinedText.includes(c.id.toLowerCase()) || combinedText.includes(token) || combinedText.includes(roleToken)) {
          matchedSubjects.push(c.id);
        }
      }
      for (const l of bible.locations || []) {
        const locToken = l.id.toLowerCase().replace(/_/g, ' ');
        if (combinedText.includes(l.id.toLowerCase()) || combinedText.includes(locToken)) {
          matchedSubjects.push(l.id);
        }
      }

      const guidance = (cb.userGuidance || '').trim();
      const textSpan = (cb.textSpan || '').trim() || spanWords.map((w) => w.word).join(' ');

      return {
        beatIndex: bIdx + 1,
        wordRange: [start, end] as [number, number],
        textSpan,
        depicts: guidance || `Visual story beat illustrating: ${textSpan}`,
        kind: 'literal' as const,
        intensity: 'medium' as const,
        subjectIds: matchedSubjects.slice(0, 3),
        shotSize: normalizeCustomShotSize(cb.shotType),
        angle: 'eye level',
        shotRole: 'story_action' as ShotRole,
        transitionHint: cb.transitionHint,
        newInfo: guidance || `Visual progression for beat ${bIdx + 1}`,
        estimatedSeconds: duration,
      };
    });

    const totalSec = beats.reduce((acc, b) => acc + b.estimatedSeconds, 0);
    const lightingPhase = bible.lightingArc?.[Math.min(sIdx, Math.max(0, (bible.lightingArc?.length || 1) - 1))];

    return {
      index: cScene.sceneIndex || sIdx + 1,
      narratorLine: cScene.narratorLine || beats.map((b) => b.textSpan).join(' '),
      beats,
      estimatedSeconds: Math.round(totalSec * 10) / 10,
      averageBeatSeconds: beats.length > 0 ? Math.round((totalSec / beats.length) * 10) / 10 : 0,
      fastCutRatio: 0,
      timeOfDay: lightingPhase?.timeOfDay,
      lightingState: lightingPhase?.lightingDescription,
    };
  });

  return enforceStage2Pacing(rawScenes, words, format, generationMode, targetVideoDuration, {
    preserveBeatBoundaries: true,
  });
}

/**
 * Stage 2 directive and deterministic framing contrast for Opening 3s Visual Hook Priority.
 */
export function buildOpeningHookStage2Guidance(isVideoMode: boolean): string {
  const clipConstraint = isVideoMode
    ? 'Keep Video Mode clip cohesion intact: stay within the clip duration and subject continuity without cramming contradictory locations into one clip.'
    : 'Keep natural 2-6 word phrase cuts cleanly aligned to grammar boundaries.';
  return [
    '8. OPENING 3-SECOND VISUAL HOOK PRIORITY (Scene 1 beats starting under 3.0s):',
    '   - Make Beat 1 and immediate follow-up beats visually arresting instead of generic eye-level medium shots: choose bold contrasting shotSize + angle pairs (e.g., low angle hero silhouette, extreme close-up tactile detail, or stark wide contrast pivoting immediately to a close-up).',
    '   - Set intensity="high" on genuinely gripping opening moments.',
    `   - CANON & SPOILER SAFETY: NEVER spoil Withheld mysteries before their reveal scene and NEVER invent shock props outside the narration/Story Bible. ${clipConstraint}`,
  ].join('\n');
}

export function applyOpeningHookContrast(scenes: PlannedScene[]): PlannedScene[] {
  if (!Array.isArray(scenes) || scenes.length === 0) return scenes;

  return scenes.map((scene, sIdx) => {
    if (sIdx !== 0 || !Array.isArray(scene.beats) || scene.beats.length === 0) {
      return scene;
    }

    let elapsedSec = 0;
    const updatedBeats: PlannedBeat[] = [];

    for (let bIdx = 0; bIdx < scene.beats.length; bIdx++) {
      const beat = scene.beats[bIdx];
      const startsWithinOpeningWindow = elapsedSec < 3.0;
      elapsedSec += beat.estimatedSeconds || 0;

      if (!startsWithinOpeningWindow) {
        updatedBeats.push(beat);
        continue;
      }

      let nextShotSize = (beat.shotSize || 'medium').toLowerCase();
      let nextAngle = (beat.angle || 'eye level').toLowerCase();
      let nextIntensity = beat.intensity || 'medium';

      if (bIdx === 0) {
        if (nextShotSize === 'medium' && nextAngle === 'eye level') {
          nextAngle = 'low';
        }
        if (nextIntensity === 'low') {
          nextIntensity = 'medium';
        }
      } else {
        const prev = updatedBeats[bIdx - 1];
        const prevShot = (prev.shotSize || 'medium').toLowerCase();
        const prevAngle = (prev.angle || 'eye level').toLowerCase();

        if (nextShotSize === prevShot && nextAngle === prevAngle) {
          if (prevShot === 'close-up' || prevShot === 'extreme close-up') {
            nextShotSize = 'medium';
            nextAngle = prevAngle === 'low' ? 'eye level' : 'low';
          } else {
            nextShotSize = 'close-up';
            nextAngle = prevAngle === 'eye level' ? 'low' : 'eye level';
          }
        }
      }

      updatedBeats.push({
        ...beat,
        shotSize: nextShotSize,
        angle: nextAngle,
        intensity: nextIntensity,
      });
    }

    return {
      ...scene,
      beats: updatedBeats,
    };
  });
}

/**
 * Main Stage 2 entry point
 */
export async function stage2GenerateBeatPlan(
  words: NumberedWord[],
  bible: StoryBible,
  format: StoryFormat = 'long',
  generationMode: GenerationMode = 'image',
  apiKey: string,
  modelQuality: GeminiModelQuality = 'standard',
  userSignal?: AbortSignal,
  onStatusMessage?: (msg: string) => void,
  provider: AiProvider = 'gemini',
  groqModel?: string,
  targetVideoDuration?: number,
  openingHookPriority?: boolean
): Promise<PlannedScene[]> {
  const isShortForm = format === 'short';
  const isVideoMode = generationMode === 'video';
  const clipSeconds = targetVideoDuration && targetVideoDuration > 0 ? targetVideoDuration : 5;
  const maxWordsPerVideoScene = Math.max(6, Math.round(clipSeconds * 2.2));
  const videoBeatsPerClip = clipSeconds <= 4.5 ? '1 to 2' : '2 to 3';

  const pacingDesc = isVideoMode
    ? isShortForm
      ? `SHORT-FORM VIDEO PACING (~${clipSeconds}s CLIPS): partition into ~${clipSeconds}s scene clips (max ~${maxWordsPerVideoScene} spoken words per scene, ${videoBeatsPerClip} cohesive beats per clip, min dwell 0.8s, max dwell ${Math.max(2.0, clipSeconds)}s)`
      : `LONG-FORM VIDEO PACING (~${clipSeconds}s CLIPS): cinematic scene clips (max ~${maxWordsPerVideoScene} spoken words per scene, ${videoBeatsPerClip} cohesive beats per clip, min dwell 0.8s, max dwell ${Math.max(3.0, clipSeconds)}s)`
    : isShortForm
      ? 'SHORT-FORM PHRASE-CUT IMAGE PACING: rapid phrase-level cuts every 2 to 6 words (~0.7s to 2.0s per image) so every spoken phrase lands on a distinct visual frame'
      : 'LONG-FORM PHRASE-CUT IMAGE PACING: phrase-level visual cuts every 2 to 6 words (~0.7s to 2.4s per image) along natural grammatical phrase boundaries so every spoken phrase receives its own fresh visual composition';

  const segmentationRule1 = isVideoMode
    ? `1. COHESIVE ${clipSeconds}-SECOND CLIP BUDGETING: Each Scene represents ONE continuous ~${clipSeconds}s video clip (keep spoken narration ~${maxWordsPerVideoScene} words max per Scene; if a sentence is longer, spill cleanly across consecutive Scenes). Within each Scene clip, plan ${videoBeatsPerClip} cohesive beats sharing a continuous physical space and subject progression. Never isolate meaningless fragments ("with a", "of the") into solo beats.`
    : '1. PHRASE-LEVEL VISUAL SEGMENTATION (2-6 WORDS PER BEAT): Split spoken narration at natural grammatical/syntactic phrase boundaries aiming for ~2 to 6 words per beat (example: "If you pay off" | "your mortgage" | "ten years early," | "your lender" | "might hit you" | "with a massive penalty"). NEVER strand bare articles, possessives, or hanging prepositions away from their noun (never leave "with a" or "of the" as a solo beat). Give EVERY phrase beat a distinct focal subject, shotSize, or angle so adjacent beats never depict the same frozen shot.';

  const dynamicRule5 = isVideoMode
    ? '5. FAST CUTS & CLIP COHESION: Fast cuts (< 1.2s) allowed ONLY if intensity="high" and newInfo adds a distinct visual action. Never pack two contradictory location jumps inside one 4s clip.'
    : '5. VISUAL SHIFT PER PHRASE: Each 2-6 word beat MUST vary shotSize, angle, or focal subject/detail in depicts & newInfo (e.g. action closeup -> mortgaged house -> calendar turning -> lender silhouette -> warning stamp).';

  const indexedWordsText = words
    .map((w) => `[${w.index}] ${w.word} (${w.startSec}s-${w.endSec}s)`)
    .join(' ');

  const locationsContract = bible.locations
    .map((l) => (l.spatialPlacement ? `${l.id} [${l.spatialPlacement}]` : l.id))
    .join('; ');
  const lightingContract = (bible.lightingArc || [])
    .map((lp) => `${lp.phase} (${lp.timeOfDay}): ${lp.lightingDescription}`)
    .join(' -> ');
  const parallelContract = (bible.parallelCast || [])
    .map((pc) => `${pc.sourceId} <-> ${pc.parallelId} (${pc.continuityBridge})`)
    .join('; ');

  const prompt = `You are a cinematic storyboard director.
Divide the following narration words into PICTURE BEATS.
Format: ${format === 'short' ? '9:16 Vertical Portrait' : '16:9 Widescreen Landscape'}.
Mode: ${generationMode === 'video' ? `Text to Video (${clipSeconds}s clips)` : 'Text to Image'}.
${pacingDesc}.

STORY BIBLE CONTRACT:
Cast: ${bible.cast.map((c) => `${c.id} (${c.role})`).join(', ')}
${parallelContract ? `Parallel Cast Links: ${parallelContract}` : ''}
Threat: ${bible.threat.canonicalLook}
Locations: ${locationsContract}
${bible.spatialMap ? `Spatial Map: ${bible.spatialMap}` : ''}
${lightingContract ? `Lighting Arc: ${lightingContract}` : ''}
Referents: ${bible.referents.map((r) => `"${r.phrase}" -> ${r.concreteEntity} (${r.visualDepiction})`).join('; ')}
Withheld (Do NOT reveal cause): ${bible.withheld.join('; ')}
Forbidden: ${bible.forbidden.join('; ')}

INDEXED NARRATION WORDS (Tile from word 0 to word ${words.length - 1} with NO GAPS and NO OVERLAPS):
"""
${indexedWordsText}
"""

RULES FOR BEAT PLANNING:
${segmentationRule1}
2. CONTINUOUS TILING: The first beat of scene 0 must start at word 0. Every beat's startWordIndex must equal the previous beat's endWordIndex + 1. The final beat must end at word ${words.length - 1}.
3. FIGURATIVE LINES & VISUAL SIMILES: For lines in Bible Referents, mark kind="figurative", set referentId, and depict the concrete referent, NOT the spoken metaphor. Tag shotRole appropriately (story_action, dialogue_acting, explainer_cutaway, visual_simile, or match_cut_pair).
4. WITHHELD MYSTERIES: For moments that the story hides, mark kind="withheld-effect", and depict only physical effects or reactions, NEVER the hidden source.
${dynamicRule5}
6. LIGHTING & TIME OF DAY: Assign scene "timeOfDay" and "lightingState" matching the Lighting Arc using natural descriptive words only (ZERO Kelvin numbers).
7. OVERLAY TEXT & SHOT VOCABULARY: If narration mentions an explicit year/date, put it in "overlayText", never in image prose. shotSize in ['wide', 'medium', 'close-up', 'extreme close-up', 'over-the-shoulder']. Angle in ['eye level', 'high', 'low', 'overhead', 'dutch tilt']. OTS strictly requires two people.${openingHookPriority ? `\n${buildOpeningHookStage2Guidance(isVideoMode)}` : ''}

Output valid JSON matching the schema without em dashes.`;

  let parsed: any;

  if (provider === 'groq') {
    parsed = await executeJsonLlmCall<any>({
      provider: 'groq',
      apiKey,
      systemPrompt: 'You are a cinematic storyboard director. Divide narration words into picture beats. Output valid JSON without em dashes.',
      userPrompt: prompt,
      modelQuality,
      groqModel,
      userSignal,
      onStatusMessage,
      temperature: 0.2,
    });
  } else {
    parsed = await executeGeminiSchemaCall<any>({
      apiKey,
      prompt,
      modelQuality,
      responseSchema: BEAT_PLAN_SCHEMA,
      temperature: 0.2,
      thinkingLevel: 'minimal',
      errorContext: 'Beat Plan generation',
      userSignal,
      onRetryMessage: (attempt, _max, delayMs) => {
        if (onStatusMessage) {
          onStatusMessage(`Planning visual story beats (Attempt ${attempt}/4, waiting ${Math.round(delayMs / 1000)}s)...`);
        }
      },
    });
  }

  const rawScenes: PlannedScene[] = (parsed.scenes || []).map((sc: any, scIdx: number) => {
    const beats: PlannedBeat[] = (sc.beats || []).map((b: any, bIdx: number) => {
      const start = Math.max(0, Math.min(words.length - 1, b.startWordIndex || 0));
      const end = Math.max(start, Math.min(words.length - 1, b.endWordIndex || start));
      const spanWords = words.slice(start, end + 1);
      const startSec = spanWords[0]?.startSec || 0;
      const endSec = spanWords[spanWords.length - 1]?.endSec || startSec + 1.5;
      const duration = Math.max(0.5, Math.round((endSec - startSec) * 10) / 10);

      return {
        beatIndex: bIdx + 1,
        wordRange: [start, end] as [number, number],
        textSpan: spanWords.map((w) => w.word).join(' '),
        depicts: b.depicts || '',
        kind: b.kind || 'literal',
        referentId: b.referentId,
        intensity: b.intensity || 'medium',
        subjectIds: Array.isArray(b.subjectIds) ? b.subjectIds : [],
        shotSize: b.shotSize || 'medium',
        angle: b.angle || 'eye level',
        shotRole: b.shotRole || 'story_action',
        transitionHint: typeof b.transitionHint === 'string' ? b.transitionHint.trim() : undefined,
        newInfo: b.newInfo || '',
        overlayText: b.overlayText,
        estimatedSeconds: duration,
      };
    });

    const totalSec = beats.reduce((acc, b) => acc + b.estimatedSeconds, 0);

    return {
      index: sc.index || scIdx + 1,
      narratorLine: sc.narratorLine || beats.map((b) => b.textSpan).join(' '),
      beats,
      estimatedSeconds: Math.round(totalSec * 10) / 10,
      averageBeatSeconds: beats.length > 0 ? Math.round((totalSec / beats.length) * 10) / 10 : 0,
      fastCutRatio: 0,
      timeOfDay: typeof sc.timeOfDay === 'string' ? sc.timeOfDay.trim() : undefined,
      lightingState: typeof sc.lightingState === 'string' ? sc.lightingState.trim() : undefined,
    };
  });

  const pacedScenes = enforceStage2Pacing(rawScenes, words, format, generationMode, targetVideoDuration);
  return openingHookPriority ? applyOpeningHookContrast(pacedScenes) : pacedScenes;
}

